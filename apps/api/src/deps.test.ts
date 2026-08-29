import { describe, expect, test } from "bun:test"
import type { BrowserPool } from "@trawl/browser"
import type { BrowserHandle } from "@trawl/types"
import { getDeps, getHeadfulPool, initPool, shutdownPools } from "./deps"

const handle = (headful: boolean): BrowserHandle => ({
  id: 0,
  lease: headful ? 2 : 1,
  headful,
  context: {},
  browser: {},
  fingerprint: { userAgent: "test", platform: "Linux x86_64", locale: "en-US", timezone: "UTC" },
})

function poolFactory(options: { failHeadful?: boolean } = {}) {
  const pools: Array<{
    headful: boolean
    events: string[]
    releases: Array<[number, number | undefined]>
    pool: BrowserPool
  }> = []
  const createPool = (config: ConstructorParameters<typeof BrowserPool>[0]): BrowserPool => {
    const headful = config.virtualDisplay === true
    const record = { headful, events: [] as string[], releases: [] as Array<[number, number | undefined]> }
    const pool = {
      init: async () => {
        record.events.push("init")
        if (headful && options.failHeadful) throw new Error("xvfb launch failed")
      },
      startHealthCheck: () => record.events.push("health"),
      shutdown: async () => record.events.push("shutdown"),
      acquire: async () => handle(headful),
      release: (id: number, lease?: number) => record.releases.push([id, lease]),
      getStats: () => ({ total: 1, busy: 0, available: 1, restarts: 0, avgRestarts: 0, stalled: 0, live: 1 }),
    } as unknown as BrowserPool
    pools.push({ ...record, pool })
    return pool
  }
  return { pools, createPool }
}

describe("browser pool dependencies", () => {
  test("disabled headful configuration starts only the main pool and fails headful acquisition clearly", async () => {
    const factory = poolFactory()
    await initPool({ poolSize: 1, headfulPoolSize: 0, createPool: factory.createPool, initCache: async () => {} })

    expect(factory.pools).toHaveLength(1)
    expect(factory.pools[0]?.events).toEqual(["init", "health"])
    expect(getHeadfulPool()).toBeUndefined()
    await expect(getDeps().acquireBrowser("example.test", 100, { headful: true })).rejects.toThrow(
      "BROWSER_HEADFUL_POOL_SIZE greater than 0",
    )
    await shutdownPools()
  })

  test("starts and shuts down both pools and returns equal-id handles to their owner", async () => {
    const factory = poolFactory()
    await initPool({ poolSize: 1, headfulPoolSize: 1, createPool: factory.createPool, initCache: async () => {} })
    const deps = getDeps()
    const headless = await deps.acquireBrowser("example.test", 100, { headful: false })
    const headful = await deps.acquireBrowser("example.test", 100, { headful: true })

    expect(headless.id).toBe(headful.id)
    deps.releaseBrowser(headless)
    deps.releaseBrowser(headful)
    expect(factory.pools[0]?.releases).toEqual([[0, 1]])
    expect(factory.pools[1]?.releases).toEqual([[0, 2]])

    await shutdownPools()
    expect(factory.pools[0]?.events).toEqual(["init", "health", "shutdown"])
    expect(factory.pools[1]?.events).toEqual(["init", "health", "shutdown"])
  })

  test("a headful launch failure closes both pools and rejects startup", async () => {
    const factory = poolFactory({ failHeadful: true })
    await expect(
      initPool({ poolSize: 1, headfulPoolSize: 1, createPool: factory.createPool, initCache: async () => {} }),
    ).rejects.toThrow("xvfb launch failed")
    expect(factory.pools[0]?.events).toEqual(["init", "health", "shutdown"])
    expect(factory.pools[1]?.events).toEqual(["init", "shutdown"])
  })
})
