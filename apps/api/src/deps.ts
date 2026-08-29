import { BrowserPool, SessionCache } from "@trawl/browser"
import type { AcquireOptions, OrchestratorDeps } from "@trawl/tiers"
import type { SessionData } from "@trawl/types"
import {
  ACQUIRE_TIMEOUT_MS,
  CLOSE_TIMEOUT_MS,
  CONTENT_PROCESSES,
  HEADFUL_POOL_SIZE,
  LAUNCH_TIMEOUT_MS,
  POOL_SIZE,
  proxyPool,
  RECYCLE_AFTER_TEMPORARY_CONTEXTS,
  REDIS_URL,
  residentialProxyPool,
  SESSION_TTL,
  STALL_TIMEOUT_MS,
} from "./config"

const state: {
  pool?: BrowserPool
  headfulPool?: BrowserPool
  sessionCache?: SessionCache
} = {}

const handleOwners = new WeakMap<object, BrowserPool>()

type BrowserPoolOptions = ConstructorParameters<typeof BrowserPool>[0]

interface InitPoolOptions {
  poolSize?: number
  headfulPoolSize?: number
  createPool?: (options: BrowserPoolOptions) => BrowserPool
  initCache?: () => Promise<void>
}

export const getPool = () => state.pool
export const getHeadfulPool = () => state.headfulPool

const initSessionCache = async (): Promise<void> => {
  try {
    const sessionCache = new SessionCache({
      redisUrl: REDIS_URL,
      ttlSeconds: SESSION_TTL,
    })
    await sessionCache.connect()
    state.sessionCache = sessionCache
    console.log("[api] session cache connected  (Tier 2 fast-path enabled)")
  } catch (err) {
    state.sessionCache = undefined
    console.warn("[api] session cache unavailable — Tier 2 disabled:", err instanceof Error ? err.message : err)
  }
}

export const shutdownPools = async (): Promise<void> => {
  await Promise.all([state.pool?.shutdown(), state.headfulPool?.shutdown()])
}

export const initPool = async ({
  poolSize = POOL_SIZE,
  headfulPoolSize = HEADFUL_POOL_SIZE,
  createPool = (options) => new BrowserPool(options),
  initCache = initSessionCache,
}: InitPoolOptions = {}): Promise<void> => {
  const pool = createPool({
    poolSize,
    acquireTimeoutMs: ACQUIRE_TIMEOUT_MS,
    recycleAfterTemporaryContexts: RECYCLE_AFTER_TEMPORARY_CONTEXTS,
    contentProcesses: CONTENT_PROCESSES,
    stallAfterMs: STALL_TIMEOUT_MS,
    closeTimeoutMs: CLOSE_TIMEOUT_MS,
    launchTimeoutMs: LAUNCH_TIMEOUT_MS,
  })

  state.headfulPool = undefined
  if (headfulPoolSize > 0) {
    state.headfulPool = createPool({
      poolSize: headfulPoolSize,
      acquireTimeoutMs: ACQUIRE_TIMEOUT_MS,
      recycleAfterTemporaryContexts: RECYCLE_AFTER_TEMPORARY_CONTEXTS,
      contentProcesses: CONTENT_PROCESSES,
      virtualDisplay: true,
      label: "pool:headful",
      stallAfterMs: STALL_TIMEOUT_MS,
      closeTimeoutMs: CLOSE_TIMEOUT_MS,
      launchTimeoutMs: LAUNCH_TIMEOUT_MS,
    })
  }
  // Publish the pool before its first await. Tier 1 can serve immediately and
  // browser-backed requests can wait in acquire() while capacity warms.
  state.pool = pool

  try {
    await Promise.all([initCache(), pool.init()])
    pool.startHealthCheck()
    if (state.headfulPool) {
      await state.headfulPool.init()
      state.headfulPool.startHealthCheck()
      console.log(`[api] headful pool warm (${headfulPoolSize} browser${headfulPoolSize === 1 ? "" : "s"})`)
    }
  } catch (error) {
    await Promise.all([pool.shutdown(), state.headfulPool?.shutdown()])
    throw error
  }

  console.log(`[api] ready — all ${poolSize} browser${poolSize === 1 ? "" : "s"} warm`)
}

export const getDeps = (): OrchestratorDeps => {
  if (!state.pool) throw new Error("pool not ready")
  const p = state.pool
  return {
    acquireBrowser: async (d: string, budgetMs?: number, options?: AcquireOptions) => {
      if (options?.headful) {
        const headful = state.headfulPool
        if (!headful) throw new Error("DataDome requires BROWSER_HEADFUL_POOL_SIZE greater than 0")
        const handle = await headful.acquire(d, budgetMs)
        handleOwners.set(handle, headful)
        return handle
      }
      const handle = await p.acquire(d, budgetMs)
      handleOwners.set(handle, p)
      return handle
    },
    releaseBrowser: (handle) => {
      handleOwners.get(handle)?.release(handle.id, handle.lease)
      handleOwners.delete(handle)
    },
    loadSession: (d: string) =>
      state.sessionCache ? state.sessionCache.load(d).catch(() => undefined) : Promise.resolve(undefined),
    saveSession: (d: string, data: SessionData) =>
      state.sessionCache ? state.sessionCache.save(d, data).catch(() => {}) : Promise.resolve(),
    invalidateSession: (d: string) =>
      state.sessionCache ? state.sessionCache.invalidate(d).catch(() => {}) : Promise.resolve(),
    proxyPool,
    residentialProxyPool,
  }
}
