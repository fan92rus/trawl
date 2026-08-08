import { ProxyPool } from "@trawl/tiers"

export const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379"
export const PORT = Number(process.env.PORT ?? "8191")
export const POOL_SIZE = Number(process.env.BROWSER_POOL_SIZE ?? "3")
// How long acquire() will poll for a free browser before rejecting with PoolExhaustedError.
// 15s covers a full CF challenge burst with pool=3 (queue depth 7, slowest finishes at ~12s).
// Tune lower for fast-fail feedback in dev; tune higher for very heavy upstream targets.
export const ACQUIRE_TIMEOUT_MS = Number(process.env.BROWSER_ACQUIRE_TIMEOUT_MS ?? "15000")
export const SESSION_TTL = Number(process.env.SESSION_TTL_SECONDS ?? "3600")
export const RECYCLE_AFTER_TEMPORARY_CONTEXTS = Number(process.env.BROWSER_RECYCLE_AFTER_CONTEXTS ?? "8")
// Caps Firefox content processes per browser. Default `2` keeps thread/RAM footprint
// minimal while still allowing CF/Imperva challenges to resolve. Raise if specific
// targets fail with empty content (rare).
export const CONTENT_PROCESSES = Number(process.env.BROWSER_CONTENT_PROCESSES ?? "2")
// How long a browser may stay checked out before the pool calls it wedged rather than
// busy. A scrape's own budget is req.maxTimeout (default 60s), so 3x that is well clear
// of anything legitimate while still catching a hung checkout within a few minutes.
export const STALL_TIMEOUT_MS = Number(process.env.BROWSER_STALL_TIMEOUT_MS ?? "180000")
// Upper bound on a single browser/context close during a recycle. Camoufox can hang on
// close when a content process is wedged; past this we abandon the close and relaunch.
export const CLOSE_TIMEOUT_MS = Number(process.env.BROWSER_CLOSE_TIMEOUT_MS ?? "10000")
// Upper bound on a browser launch. A cold Camoufox start is a few seconds, but launches
// have been observed to hang indefinitely — without a bound that strands the pool entry.
export const LAUNCH_TIMEOUT_MS = Number(process.env.BROWSER_LAUNCH_TIMEOUT_MS ?? "90000")

// PROXY_URL / RESIDENTIAL_PROXY_URL accept a comma-separated list of proxy URLs (a single
// URL still works — it's just a 1-element list). *_LIST_FILE is an alternative source
// (one proxy per line) for lists too large for a single env var.
export const proxyPool = ProxyPool.fromEnv(process.env.PROXY_URL, process.env.PROXY_LIST_FILE)
export const residentialProxyPool = ProxyPool.fromEnv(
  process.env.RESIDENTIAL_PROXY_URL,
  process.env.RESIDENTIAL_PROXY_LIST_FILE,
)

// ── MITM forward-proxy mode ────────────────────────────────────────────────────
// Optional browser-backed HTTP(S) forward proxy (apps/api/src/proxy). Off by default.
// When enabled, point a client's HTTP(S) proxy at MITM_PROXY_PORT and every request is
// re-issued through the browser pool — for clients that only consume cookies+UA from
// /v1 and re-fetch themselves, which fails on fingerprint-bound Cloudflare clearances.
// See proxy/server.ts for the full rationale.
export const MITM_PROXY_ENABLED = /^(1|true|yes)$/i.test(process.env.MITM_PROXY_ENABLED ?? "")
export const MITM_PROXY_PORT = Number(process.env.MITM_PROXY_PORT ?? "8192")
// Default 0.0.0.0 — the dominant deployment is docker-compose (clients reach trawl
// through the docker bridge, which requires a non-loopback bind). Loopback-only
// operators can set MITM_PROXY_HOST=127.0.0.1. The primary safety guard remains
// MITM_PROXY_ENABLED=false.
export const MITM_PROXY_HOST = process.env.MITM_PROXY_HOST ?? "0.0.0.0"
// CA cert + key live here (persist across restarts so the CA is installed once).
export const MITM_PROXY_CA_DIR = process.env.MITM_PROXY_CA_DIR ?? "/data/proxy-ca"
// Cap the tier the proxy will escalate to (e.g. keep it off residential Tier 4).
const configuredMaxTier = Number(process.env.MITM_PROXY_MAX_TIER)
const isTier = (tier: number): tier is 1 | 2 | 3 | 4 => tier === 1 || tier === 2 || tier === 3 || tier === 4
export const MITM_PROXY_MAX_TIER = isTier(configuredMaxTier) ? configuredMaxTier : undefined
// Log one line per proxied request (method, url, status, content-type, bytes). Off by
// default — proxied clients can be chatty. Errors are always logged.
export const MITM_PROXY_DEBUG = /^(1|true|yes)$/i.test(process.env.MITM_PROXY_DEBUG ?? "")

// ── Auth cookies injection (per-domain) ─────────────────────────────────────────
// Optional JSON file mapping a hostname to an array of {name, value, domain?, path?}
// cookies that are injected into the browser context before every request to that
// domain. Needed for sites requiring login (e.g. rutracker.org bb_session) where
// the caller (Prowlarr) has no cookies of its own to forward. Mirrors the
// flaresolver-proxy user_cookies.json design.
export interface UserCookie {
  name: string
  value: string
  domain?: string
  path?: string
}

function loadUserCookies(): Record<string, UserCookie[]> {
  const path = process.env.USER_COOKIES_JSON
  if (!path) return {}
  try {
    // Synchronous read at startup (config is loaded once) — fine for a small file.
    let text = ""
    try {
      text = require("node:fs").readFileSync(path, "utf8")
    } catch {
      text = ""
    }
    if (!text.trim()) return {}
    const parsed: unknown = JSON.parse(text)
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      console.warn("[config] USER_COOKIES_JSON: root must be an object {hostname: [cookies]}")
      return {}
    }
    const out: Record<string, UserCookie[]> = {}
    for (const [host, arr] of Object.entries(parsed as Record<string, unknown>)) {
      if (!Array.isArray(arr)) continue
      out[host.toLowerCase()] = (arr as unknown[]).filter(
        (c): c is UserCookie => typeof c === "object" && c !== null && typeof (c as UserCookie).name === "string",
      )
    }
    console.log(`[config] user cookies loaded for domains: ${Object.keys(out).join(", ") || "(none)"}`)
    return out
  } catch (err) {
    console.warn("[config] USER_COOKIES_JSON load failed:", err instanceof Error ? err.message : err)
    return {}
  }
}

export const userCookiesByDomain: Record<string, UserCookie[]> = loadUserCookies()

export function userCookiesForHost(host: string): UserCookie[] | undefined {
  const key = host.toLowerCase()
  return userCookiesByDomain[key] ?? userCookiesByDomain[key.replace(/^\./, "")]
}

// Domains whose HTML responses are re-encoded from UTF-8 to windows-1251 before being
// returned. Prowlarr's RuTracker indexer decodes responses as windows-1251, so serving
// UTF-8 bytes would produce mojibake. Comma-separated hostnames, e.g. CP1251_HOSTS=rutracker.org
const CP1251_HOSTS_ENV = process.env.CP1251_HOSTS ?? ""
export const CP1251_HOSTS: ReadonlySet<string> = new Set(
  CP1251_HOSTS_ENV.split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean),
)

export const startTime = Date.now()
