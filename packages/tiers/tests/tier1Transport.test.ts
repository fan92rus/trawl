import { describe, expect, test } from "bun:test"

function inspectTransport(value: string) {
  return Bun.spawnSync({
    cmd: [
      process.execPath,
      "-e",
      `
      const { createRequire } = await import("node:module")
      const require = createRequire(import.meta.url)
      const transport = await import("./src/utils/tier1Transport.ts")
      await transport.verifyTier1Transport()
      console.log(JSON.stringify({
        selected: transport.TIER1_TRANSPORT,
        nativeLoaded: Object.keys(require.cache).some(path => path.includes("node-wreq")),
        userAgent: await transport.tier1UserAgent("existing-browser-agent"),
      }))
      `,
    ],
    cwd: `${import.meta.dir}/..`,
    env: { ...process.env, TIER1_TRANSPORT: value },
  })
}

describe("Tier 1 transport selection", () => {
  test.each(["", "bun", " BUN "])("keeps the native addon unloaded for %s", (value) => {
    const result = inspectTransport(value)
    expect(result.exitCode).toBe(0)
    expect(JSON.parse(result.stdout.toString())).toEqual({
      selected: "bun",
      nativeLoaded: false,
      userAgent: "existing-browser-agent",
    })
  })

  test("loads the selected Firefox transport without requiring a Node.js runtime", () => {
    const result = inspectTransport(" WREQ ")
    expect(result.exitCode).toBe(0)
    expect(JSON.parse(result.stdout.toString())).toMatchObject({ selected: "wreq", nativeLoaded: true })
    expect(JSON.parse(result.stdout.toString()).userAgent).toMatch(/Firefox\/\d+\.0$/)
  })

  test("rejects an invalid transport at startup", () => {
    const result = inspectTransport("unknown")
    expect(result.exitCode).not.toBe(0)
    expect(result.stderr.toString()).toContain("Invalid TIER1_TRANSPORT")
  })
})
