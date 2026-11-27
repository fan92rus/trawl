import { SHUTDOWN_DRAIN_MS } from "./config"
import { shutdownPools } from "./deps"
import { Sentry } from "./logger"

export interface LifecycleOptions {
  onShutdown?: () => Promise<void>
}

export async function stopServer(
  server: Pick<Bun.Server<unknown>, "stop"> | null | undefined,
  drainTimeoutMs = SHUTDOWN_DRAIN_MS,
): Promise<void> {
  if (!server) return
  if (drainTimeoutMs === 0) return server.stop(true)
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    await Promise.race([
      server.stop(false),
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, drainTimeoutMs)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
    await server.stop(true)
  }
}

function isMalformedBrowserPageError(error: unknown): boolean {
  // Camoufox can omit a page-error location expected by Playwright's dispatcher.
  if (!(error instanceof TypeError)) return false
  const stack = error.stack ?? ""
  if (!/playwright-core[\\/].*(?:browserContextDispatcher|coreBundle)\.js/.test(stack)) return false
  return (
    /evaluating ['"]pageError\.location\.url['"]/.test(error.message) ||
    (/Cannot read properties of (?:undefined|null) \(reading ['"]url['"]\)/.test(error.message) &&
      /browserContextDispatcher/.test(stack))
  )
}

export const registerLifecycleHandlers = (opts: LifecycleOptions = {}): void => {
  let stopping = false
  let exitCode = 0

  const shutdown = async (code = 0) => {
    exitCode = Math.max(exitCode, code)
    if (stopping) return
    stopping = true
    const deadline = setTimeout(() => process.exit(exitCode || 1), SHUTDOWN_DRAIN_MS + 30_000)
    try {
      try {
        await opts.onShutdown?.()
      } finally {
        // The HTTP server has already used the drain window before pool cleanup.
        await shutdownPools(0)
      }
    } catch (error) {
      exitCode = 1
      Sentry.captureException(error)
      console.error("[api] shutdown error:", error)
    } finally {
      clearTimeout(deadline)
      process.exit(exitCode)
    }
  }

  const handleFailure = (event: string, error: unknown) => {
    // Fork: report process-level failures to Glitchtip before upstream's graceful
    // shutdown, so a restart never loses the original error.
    Sentry.captureException(error)
    if (isMalformedBrowserPageError(error)) {
      console.error(`[api] ${event} (malformed browser page error):`, error)
      return
    }
    console.error(`[api] ${event}:`, error)
    void shutdown(1)
  }

  process.on("uncaughtException", (error) => handleFailure("uncaughtException", error))
  process.on("unhandledRejection", (error) => handleFailure("unhandledRejection", error))
  process.on("SIGTERM", () => {
    void shutdown()
  })
  process.on("SIGINT", () => {
    void shutdown()
  })
}
