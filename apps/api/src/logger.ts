import * as Sentry from "@sentry/node"
import { pino } from "pino"

// ── Sentry ─────────────────────────────────────────────────────────────────────
// DSN is overridable via SENTRY_DSN; the default points at the self-hosted
// Glitchtip instance. Set SENTRY_ENVIRONMENT to tag events (dev/prod/...).
export const SENTRY_DSN = process.env.SENTRY_DSN ?? "https://5be2900e-8111-4034-9c9d-82d90114b816@glitchtip.local/5"

export const SENTRY_ENVIRONMENT = process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? "development"

// Tests import config.ts (which imports this module) — keep Sentry quiet there.
const sentryDisabled = !!process.env.BUN_TEST || process.env.NODE_ENV === "test"

export const sentryInitialized =
  SENTRY_DSN && !sentryDisabled
    ? Sentry.init({
        dsn: SENTRY_DSN,
        environment: SENTRY_ENVIRONMENT,
        // Glitchtip doesn't need tracing; keep the transport to errors only.
        tracesSampleRate: 0,
      })
    : false

// Report unexpected process-level failures even though the handlers below keep
// the process alive.
process.on("uncaughtException", (err) => {
  Sentry.captureException(err)
})
process.on("unhandledRejection", (reason) => {
  Sentry.captureException(reason)
})

export { Sentry }

// ── pino structured logging (JSON to stdout) ──────────────────────────────────
// Child loggers carry the component (api/proxy/...) as a field, replacing the
// old `[api]`/`[proxy]` string prefixes.
export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  base: { service: "trawl" },
})

export const log = {
  api: logger.child({ component: "api" }),
  proxy: logger.child({ component: "proxy" }),
  login: logger.child({ component: "login" }),
  config: logger.child({ component: "config" }),
  v1: logger.child({ component: "v1" }),
}
