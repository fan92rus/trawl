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

  test("disables the Firefox content sandbox when user namespaces are unavailable", async () => {
    const pool = new BrowserPool({ poolSize: 1 })
    await pool.init()

    const prefs = (launches.at(-1)?.firefox_user_prefs ?? {}) as Record<string, unknown>
    // Without this, Camoufox exits SIGSEGV on "CanCreateUserNamespace() clone()
    // failure: EPERM", the restart loop fills the disk with core dumps, and the
    // health endpoint disappears with the process.
    expect(prefs["security.sandbox.content.level"]).toBe(0)

    await pool.shutdown()
  })
})
