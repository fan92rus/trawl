import { describe, expect, mock, test } from "bun:test"

// camoufox-js resolves `geoip` by calling several public "what is my IP" endpoints before
// Playwright starts. On this host those endpoints are unreachable, so `geoip: true` throws
// InvalidIP during pool.init() and the container enters a restart loop. Capture the real
// launch options instead of launching a browser so the regression is testable offline.
const launches: Array<Record<string, unknown>> = []
mock.module("camoufox-js", () => ({
  Camoufox: async (options: Record<string, unknown>) => {
    launches.push(options)
    const context = {
      addInitScript: async () => {},
      pages: () => [],
      close: async () => {},
    }
    return {
      isConnected: () => true,
      newContext: async () => context,
      close: async () => {},
    }
  },
}))

const { BrowserPool } = await import("../src/pool")

describe("Camoufox launch options", () => {
  test("does not depend on a public-IP lookup at startup", async () => {
    const pool = new BrowserPool({ poolSize: 1 })
    await pool.init()

    expect(launches).toHaveLength(1)
    expect(launches[0]?.geoip).not.toBe(true)
    // Fingerprint coherence comes from explicit values, not from the IP lookup.
    expect(launches[0]?.timezone).toBeString()
    expect(launches[0]?.locale).toBeString()

    await pool.shutdown()
  })
})
