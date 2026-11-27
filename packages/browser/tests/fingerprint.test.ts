import { describe, expect, test } from "bun:test"
import { mkdirSync, mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { resolveFingerprintPool } from "../src/fingerprint"

const platforms = (installDir: string) => resolveFingerprintPool(installDir).map(({ platform }) => platform)

describe("runtime fingerprint availability", () => {
  test("keeps all upstream profiles for managed installs without an explicit directory", () => {
    expect(platforms("")).toEqual(["Win32", "MacIntel", "Linux x86_64", "Linux armv8"])
  })

  test("uses Linux-only profiles when spoofed OS font bundles are pruned", () => {
    const installDir = mkdtempSync(join(tmpdir(), "trawl-fonts-pruned-"))
    try {
      expect(platforms(installDir)).toEqual(["Linux x86_64", "Linux armv8"])
    } finally {
      rmSync(installDir, { recursive: true, force: true })
    }
  })

  test("enables only profiles whose optional font bundle exists", () => {
    const installDir = mkdtempSync(join(tmpdir(), "trawl-fonts-partial-"))
    try {
      mkdirSync(join(installDir, "fonts", "windows"), { recursive: true })
      expect(platforms(installDir)).toEqual(["Win32", "Linux x86_64", "Linux armv8"])

      mkdirSync(join(installDir, "fonts", "macos"), { recursive: true })
      expect(platforms(installDir)).toEqual(["Win32", "MacIntel", "Linux x86_64", "Linux armv8"])
    } finally {
      rmSync(installDir, { recursive: true, force: true })
    }
  })
})
