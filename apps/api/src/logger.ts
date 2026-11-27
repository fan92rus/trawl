import { randomUUID } from "node:crypto"
import * as Sentry from "@sentry/node"
import { pino } from "pino"

export type LogLevel = "error" | "warn" | "info" | "debug" | "silent"
type LogValue = string | number | boolean | null | undefined

const ranks: Record<LogLevel, number> = { error: 0, warn: 1, info: 2, debug: 3, silent: -1 }

export function parseLogLevel(value: string | undefined): LogLevel {
  const level = (value?.trim().toLowerCase() || "info") as LogLevel
  if (level in ranks) return level
  throw new Error(`Invalid LOG_LEVEL ${JSON.stringify(value)}; expected error, warn, info, debug, or silent`)
}

export const LOG_LEVEL = parseLogLevel(process.env.LOG_LEVEL)

const quote = (value: LogValue): string => {
  if (value === null) return "null"
  if (value === undefined) return ""
  if (typeof value !== "string") return String(value)
  return /^[A-Za-z0-9._:/-]+$/.test(value) ? value : JSON.stringify(value)
}

export function safeUrl(candidate: string): string {
  try {
    const url = new URL(candidate)
    return `${url.protocol}//${url.host}${url.pathname}`
  } catch {
    return "<unparseable-url>"
  }
}

export function safeMessage(message: string): string {
  return message.replace(/https?:\/\/[^\s"'<>]+/gi, (candidate) => safeUrl(candidate))
}

export function requestId(): string {
  return randomUUID().slice(0, 8)
}

function logLine(level: Exclude<LogLevel, "silent">, scope: string, fields: Record<string, LogValue>): void {
  if (LOG_LEVEL === "silent" || ranks[level] > ranks[LOG_LEVEL]) return
  const line = [`level=${level}`, `scope=${scope}`]
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) line.push(`${key}=${quote(value)}`)
  }
  const message = line.join(" ")
  if (level === "error") console.error(message)
  else if (level === "warn") console.warn(message)
  else console.log(message)
}

// ── Fork observability: Sentry + structured JSON logs ─────────────────────────
// DSN is overridable via SENTRY_DSN; the default points at the self-hosted
// Glitchtip instance. Set SENTRY_ENVIRONMENT to tag events (dev/prod/...).
export const SENTRY_DSN = process.env.SENTRY_DSN ?? "https://5be2900e-8111-4034-9c9d-82d90114b816@glitchtip.local/5"
export const SENTRY_ENVIRONMENT = process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? "development"

// Tests import config.ts (which imports this module) — keep Sentry quiet there.
const sentryDisabled = Boolean(process.env.BUN_TEST) || process.env.NODE_ENV === "test"

export const sentryInitialized: boolean = Boolean(
  SENTRY_DSN && !sentryDisabled
    ? Sentry.init({
        dsn: SENTRY_DSN,
        environment: SENTRY_ENVIRONMENT,
        // Glitchtip doesn't need tracing; keep the transport to errors only.
        tracesSampleRate: 0,
      })
    : false,
)

// registerLifecycleHandlers() reports process-level failures to Sentry.
export { Sentry }

// Child loggers carry the component (api/proxy/...) as a field, replacing the
// old `[api]`/`[proxy]` string prefixes. `log` stays callable so upstream's
// log("info", "scope", {...}) call sites and our log.api.info({...}) call sites
// can coexist during and after the upstream merge.
const jsonLogger = pino({
  level: LOG_LEVEL === "silent" ? "fatal" : LOG_LEVEL,
  base: { service: "trawl" },
})

export const log = Object.assign(logLine, {
  api: jsonLogger.child({ component: "api" }),
  proxy: jsonLogger.child({ component: "proxy" }),
  login: jsonLogger.child({ component: "login" }),
  config: jsonLogger.child({ component: "config" }),
  v1: jsonLogger.child({ component: "v1" }),
})
