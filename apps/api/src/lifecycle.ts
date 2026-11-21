import { shutdownPools } from "./deps"
import { log, Sentry } from "./logger"

export interface LifecycleOptions {
  onShutdown?: () => Promise<void>
}

export const registerLifecycleHandlers = (opts: LifecycleOptions = {}): void => {
  // Camoufox (Firefox) emits page-error events in a shape playwright-core's dispatcher
  // doesn't expect for some target-page JS errors (e.g. missing `error.location`), which
  // throws inside the library's own internal event handling — outside any try/catch we
  // control, since it fires from a page-level event listener, not from our request path.
  // Without this, one target site's malformed error crashes the entire process and drops
  // every in-flight request across all clients, not just the one that triggered it.
  process.on("uncaughtException", (err) => {
    Sentry.captureException(err)
    log.api.error({ err }, "uncaughtException (continuing)")
  })

  process.on("unhandledRejection", (reason) => {
    Sentry.captureException(reason)
    log.api.error({ err: reason }, "unhandledRejection (continuing)")
  })

  const shutdown = async () => {
    if (opts.onShutdown) {
      try {
        await opts.onShutdown()
      } catch (err) {
        log.api.error({ err }, "onShutdown error")
      }
    }
    await shutdownPools()
    process.exit(0)
  }

  process.on("SIGTERM", shutdown)
  process.on("SIGINT", shutdown)
}
