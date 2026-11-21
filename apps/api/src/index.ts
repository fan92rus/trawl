import { Elysia } from "elysia"
import {
  MITM_PROXY_CA_DIR,
  MITM_PROXY_DEBUG,
  MITM_PROXY_ENABLED,
  MITM_PROXY_HOST,
  MITM_PROXY_MAX_TIER,
  MITM_PROXY_PORT,
  POOL_SIZE,
  PORT,
} from "./config"
import { getDeps, initPool } from "./deps"
import { registerLifecycleHandlers } from "./lifecycle"
import { log } from "./logger"
import { type MitmProxyHandle, shutdownMitmProxy, startMitmProxy } from "./proxy/server"
import { healthRoute } from "./routes/health"
import { indexRoute } from "./routes/index"
import { proxyCaRoute } from "./routes/proxy-ca"
import { scrapeRoute } from "./routes/scrape"
import { statsRoute } from "./routes/stats"
import { v1Route } from "./routes/v1"

new Elysia()
  .use(indexRoute())
  .use(healthRoute())
  .use(statsRoute())
  .use(v1Route())
  .use(scrapeRoute())
  .use(proxyCaRoute())
  .listen(PORT)

log.api.info({ port: PORT, poolSize: POOL_SIZE }, "TRAWL starting")

const state: { proxyHandle?: MitmProxyHandle } = {}

const poolReady = initPool()

// Tier 0 does not need a browser, and browser-backed requests already have a
// bounded acquire queue. Start accepting proxy traffic while the pool warms.
if (MITM_PROXY_ENABLED) {
  state.proxyHandle = startMitmProxy({
    port: MITM_PROXY_PORT,
    host: MITM_PROXY_HOST,
    caDir: MITM_PROXY_CA_DIR,
    deps: getDeps(),
    maxTier: MITM_PROXY_MAX_TIER,
    debug: MITM_PROXY_DEBUG,
  })
}

poolReady.catch((err) => {
  log.api.error({ err }, "startup failed")
  process.exit(1)
})

registerLifecycleHandlers({
  onShutdown: async () => {
    if (state.proxyHandle) await shutdownMitmProxy(state.proxyHandle)
  },
})
