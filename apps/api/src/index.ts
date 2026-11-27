import { TIER1_TRANSPORT, verifyTier1Transport } from "@trawl/tiers"
import { createApiApp } from "./app"
import {
  CP1251_HOSTS,
  HEADFUL_POOL_SIZE,
  MITM_ALWAYS_SCRAPE,
  MITM_CA_DIR,
  MITM_DEBUG,
  MITM_ENABLED,
  MITM_ESCALATE_429,
  MITM_HOST,
  MITM_MAX_TIER,
  MITM_PORT,
  POOL_SIZE,
  PORT,
  SCRAPE_MIN_TIER,
  SCRAPE_PROXY_SELECTION,
  SHUTDOWN_DRAIN_MS,
  USER_PREFS,
} from "./config"
import { getDeps, initPool } from "./deps"
import { registerLifecycleHandlers, stopServer } from "./lifecycle"
import { log } from "./logger"
import { type MitmProxyHandle, shutdownMitmProxy, startMitmProxy } from "./proxy/server"
import { startMemoryMonitor } from "./runtimeMemory"

if (SCRAPE_MIN_TIER === 1) await verifyTier1Transport()

const app = createApiApp().listen(PORT)

log.api.info({ port: PORT, poolSize: POOL_SIZE }, "TRAWL starting")
if (SCRAPE_MIN_TIER > 1) console.log(`[api] scraper tier floor: ${SCRAPE_MIN_TIER}`)
if (SCRAPE_MIN_TIER === 1 && TIER1_TRANSPORT !== "bun") console.log(`[api] Tier 1 transport: ${TIER1_TRANSPORT}`)
if (SCRAPE_PROXY_SELECTION !== "failover") console.log(`[api] proxy selection: ${SCRAPE_PROXY_SELECTION}`)
if (Object.keys(USER_PREFS).length > 0) console.log(`[api] user prefs changed: ${Object.keys(USER_PREFS).join(", ")}`)

const state: { proxyHandle?: MitmProxyHandle } = {}
const stopMemoryMonitor = startMemoryMonitor(POOL_SIZE, HEADFUL_POOL_SIZE)

const poolReady = initPool()

// Tier 0 does not need a browser, and browser-backed requests already have a
// bounded acquire queue. Start accepting proxy traffic while the pool warms.
if (MITM_ENABLED) {
  state.proxyHandle = startMitmProxy({
    port: MITM_PORT,
    host: MITM_HOST,
    caDir: MITM_CA_DIR,
    deps: getDeps(),
    maxTier: MITM_MAX_TIER,
    alwaysScrape: MITM_ALWAYS_SCRAPE,
    escalate429: MITM_ESCALATE_429,
    debug: MITM_DEBUG,
    cp1251Hosts: CP1251_HOSTS,
  })
}

poolReady.catch((err) => {
  log.api.error({ err }, "startup failed")
  process.exit(1)
})

registerLifecycleHandlers({
  onShutdown: async () => {
    stopMemoryMonitor()
    await Promise.all([
      stopServer(app.server, SHUTDOWN_DRAIN_MS),
      state.proxyHandle ? shutdownMitmProxy(state.proxyHandle) : undefined,
    ])
  },
})
