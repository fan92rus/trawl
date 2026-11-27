import { afterEach, describe, expect, spyOn, test } from "bun:test"
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import forge from "node-forge"
import { MitmCa } from "./ca"

const temporaryDirectories: string[] = []

afterEach(() => {
  for (const dir of temporaryDirectories.splice(0)) rmSync(dir, { recursive: true, force: true })
})

describe("MitmCa certificates", () => {
  test("new roots and leaves contain matching key identifiers and pass strict verification", () => {
    const dir = temporaryDirectory()
    const ca = new MitmCa(dir)
    const root = certificate(ca.caCertPem)
    const leafPem = ca.leafCertPem("example.test")
    const leaf = certificate(leafPem)

    const rootSki = extension(root, "subjectKeyIdentifier")
    const leafSki = extension(leaf, "subjectKeyIdentifier")
    const leafAki = extension(leaf, "authorityKeyIdentifier")
    expect(rootSki.critical).not.toBe(true)
    expect(leafSki.critical).not.toBe(true)
    expect(leafAki.critical).not.toBe(true)
    expect(authorityKeyIdentifier(leafAki)).toBe(rootSki.subjectKeyIdentifier as string)
    expect(existsSync(join(dir, ".ca.lock"))).toBe(false)

    verifyStrict(dir, ca.caCertPem, leafPem)
  })

  test("leaf serials remain valid DER when random bytes start with zeros", () => {
    const dir = temporaryDirectory()
    const ca = new MitmCa(dir)
    const random = spyOn(forge.random, "getBytesSync").mockReturnValueOnce(`\x00\x68${"\x00".repeat(14)}`)
    let leafPem: string
    try {
      leafPem = ca.leafCertPem("example.test")
    } finally {
      random.mockRestore()
    }
    verifyStrict(dir, ca.caCertPem, leafPem)
  })

  test("migrates a legacy root once without changing its identity fields or private key", () => {
    const dir = temporaryDirectory()
    const legacy = createLegacyCa()
    const certPath = join(dir, "ca.crt")
    const keyPath = join(dir, "ca.key")
    const originalKeyPem = forge.pki.privateKeyToPem(legacy.key)
    const originalCertPem = forge.pki.certificateToPem(legacy.cert)
    const originalCert = certificate(originalCertPem)
    writeFileSync(certPath, originalCertPem)
    writeFileSync(keyPath, originalKeyPem)

    const ca = new MitmCa(dir)
    const migrated = certificate(ca.caCertPem)
    expect(extension(migrated, "subjectKeyIdentifier").subjectKeyIdentifier).toBe(
      migrated.generateSubjectKeyIdentifier().toHex(),
    )
    expect(readFileSync(keyPath, "utf8")).toBe(originalKeyPem)
    expect(migrated.subject.attributes).toEqual(originalCert.subject.attributes)
    expect(migrated.serialNumber).toBe(originalCert.serialNumber)
    expect(migrated.validity.notBefore.getTime()).toBe(originalCert.validity.notBefore.getTime())
    expect(migrated.validity.notAfter.getTime()).toBe(originalCert.validity.notAfter.getTime())

    const leafPem = ca.leafCertPem("migrated.example")
    verifyStrict(dir, ca.caCertPem, leafPem)

    const inodeAfterMigration = statSync(certPath).ino
    const pemAfterMigration = readFileSync(certPath, "utf8")
    const loadedAgain = new MitmCa(dir)
    expect(statSync(certPath).ino).toBe(inodeAfterMigration)
    expect(loadedAgain.caCertPem).toBe(pemAfterMigration)
  })

  test("rejects a certificate and private key that do not match", () => {
    const dir = temporaryDirectory()
    const legacy = createLegacyCa()
    const other = forge.pki.rsa.generateKeyPair(2048)
    writeFileSync(join(dir, "ca.crt"), forge.pki.certificateToPem(legacy.cert))
    writeFileSync(join(dir, "ca.key"), forge.pki.privateKeyToPem(other.privateKey))

    expect(() => new MitmCa(dir)).toThrow(/Cannot safely load MITM CA.*public key does not match ca\.key/)
    expect(existsSync(join(dir, ".ca.lock"))).toBe(false)
  })

  test("rejects an existing Subject Key Identifier that does not match the CA public key", () => {
    const dir = temporaryDirectory()
    const malformed = createCaWithIncorrectSki()
    writeFileSync(join(dir, "ca.crt"), forge.pki.certificateToPem(malformed.cert))
    writeFileSync(join(dir, "ca.key"), forge.pki.privateKeyToPem(malformed.key))

    expect(() => new MitmCa(dir)).toThrow(/Subject Key Identifier that does not match its public key/)
    expect(existsSync(join(dir, ".ca.lock"))).toBe(false)
  })

  test("rejects an incomplete persisted CA instead of silently rotating it", () => {
    const dir = temporaryDirectory()
    writeFileSync(join(dir, "ca.crt"), "not used")
    expect(() => new MitmCa(dir)).toThrow(/Incomplete MITM CA.*refusing to generate a new identity/)
  })

  test("serializes concurrent first-time initialization across processes", async () => {
    const dir = temporaryDirectory()
    const projectRoot = join(import.meta.dir, "../../../..")
    const script = `import { MitmCa } from "./apps/api/src/proxy/ca.ts"; new MitmCa(process.argv.at(-1)!)`
    const processes = [
      Bun.spawn([process.execPath, "-e", script, dir], { cwd: projectRoot, stderr: "pipe" }),
      Bun.spawn([process.execPath, "-e", script, dir], { cwd: projectRoot, stderr: "pipe" }),
    ]
    const exitCodes = await Promise.all(processes.map((process) => process.exited))

    expect(exitCodes).toEqual([0, 0])
    expect(existsSync(join(dir, ".ca.lock"))).toBe(false)
    expect(() => new MitmCa(dir)).not.toThrow()
  })
})

function temporaryDirectory(): string {
  const dir = mkdtempSync(join(tmpdir(), "trawl-ca-test-"))
  temporaryDirectories.push(dir)
  return dir
}

function certificate(pem: string): forge.pki.Certificate {
  return forge.pki.certificateFromPem(pem)
}

type ParsedExtension = forge.pki.CertificateField & {
  critical?: boolean
  subjectKeyIdentifier?: string
  value: string
}

function extension(cert: forge.pki.Certificate, name: string): ParsedExtension {
  const found = cert.getExtension({ name })
  if (!found) throw new Error(`Missing ${name} extension`)
  return found as ParsedExtension
}

function authorityKeyIdentifier(ext: ParsedExtension): string {
  const sequence = forge.asn1.fromDer(ext.value)
  const keyIdentifier = (sequence.value as forge.asn1.Asn1[]).find((entry) => entry.type === 0)
  if (!keyIdentifier || typeof keyIdentifier.value !== "string") throw new Error("Missing AKI keyIdentifier")
  return forge.util.bytesToHex(keyIdentifier.value)
}

function createLegacyCa(): { cert: forge.pki.Certificate; key: forge.pki.rsa.PrivateKey } {
  const keys = forge.pki.rsa.generateKeyPair(2048)
  const cert = forge.pki.createCertificate()
  cert.publicKey = keys.publicKey
  cert.serialNumber = "00112233445566778899aabbccddeeff"
  cert.validity.notBefore = new Date("2025-01-01T00:00:00Z")
  cert.validity.notAfter = new Date("2035-01-01T00:00:00Z")
  const attrs = [
    { name: "commonName", value: "Legacy TRAWL MITM CA" },
    { name: "organizationName", value: "TRAWL" },
  ]
  cert.setSubject(attrs)
  cert.setIssuer(attrs)
  cert.setExtensions([
    { name: "basicConstraints", cA: true, critical: true },
    { name: "keyUsage", keyCertSign: true, cRLSign: true, critical: true },
  ])
  cert.sign(keys.privateKey, forge.md.sha256.create())
  return { cert, key: keys.privateKey }
}

function createCaWithIncorrectSki(): { cert: forge.pki.Certificate; key: forge.pki.rsa.PrivateKey } {
  const originalKeys = forge.pki.rsa.generateKeyPair(2048)
  const actualKeys = forge.pki.rsa.generateKeyPair(2048)
  const cert = forge.pki.createCertificate()
  cert.publicKey = originalKeys.publicKey
  cert.serialNumber = "00aabbccddeeff"
  cert.validity.notBefore = new Date("2025-01-01T00:00:00Z")
  cert.validity.notAfter = new Date("2035-01-01T00:00:00Z")
  const attrs = [{ name: "commonName", value: "Malformed TRAWL MITM CA" }]
  cert.setSubject(attrs)
  cert.setIssuer(attrs)
  cert.setExtensions([
    { name: "basicConstraints", cA: true, critical: true },
    { name: "keyUsage", keyCertSign: true, cRLSign: true, critical: true },
    { name: "subjectKeyIdentifier" },
  ])
  cert.publicKey = actualKeys.publicKey
  cert.sign(actualKeys.privateKey, forge.md.sha256.create())
  return { cert, key: actualKeys.privateKey }
}

function verifyStrict(dir: string, caPem: string, leafPem: string): void {
  const openssl = Bun.which("openssl")
  if (!openssl) return
  const caPath = join(dir, "strict-ca.crt")
  const leafPath = join(dir, "strict-leaf.crt")
  writeFileSync(caPath, caPem)
  writeFileSync(leafPath, leafPem)
  const result = Bun.spawnSync([openssl, "verify", "-x509_strict", "-CAfile", caPath, leafPath])
  expect(result.exitCode, result.stderr.toString()).toBe(0)
}
