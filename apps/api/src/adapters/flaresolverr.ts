import type { SupportedMethod } from "@trawl/tiers"
import { normalizeProxy, requireContentTypeForBody, sanitizeHeaders } from "@trawl/tiers"
import type { FlareSolverrRequest, FlareSolverrResponse, ScrapeRequest } from "@trawl/types"
import { MITM_PROXY_ENABLED, MITM_PROXY_PORT } from "../config"

function normalizeProwlarrHeaders(headers?: Record<string, string>): Record<string, string> | undefined {
  if (!headers) return

  const normalized: Record<string, string> = {}
  let serializedContentType: string | undefined
  let hasStandardContentType = false

  for (const [name, value] of Object.entries(headers)) {
    const lowerName = name.trim().toLowerCase()
    if (lowerName === "contenttype") {
      serializedContentType ??= value
      continue
    }
    if (lowerName === "contentlength") continue
    if (lowerName === "content-type") hasStandardContentType = true
    normalized[name] = value
  }

  // Prowlarr serializes these HttpHeader properties without HTTP's hyphens.
  // Keep an explicitly supplied standard header authoritative, even if invalid;
  // the normal body validation below will then reject an empty value.
  if (!hasStandardContentType && serializedContentType !== undefined) {
    normalized["Content-Type"] = serializedContentType
  }

  return normalized
}

export function buildScrapeRequestFromFlareSolverr(req: FlareSolverrRequest): ScrapeRequest {
  const method: SupportedMethod = req.cmd === "request.post" ? "POST" : "GET"
  const headers = sanitizeHeaders(normalizeProwlarrHeaders(req.headers))
  requireContentTypeForBody(headers, Boolean(req.postData))
  const proxy = normalizeProxy(req.proxy)
  return {
    url: req.url,
    maxTimeout: req.maxTimeout ?? 60_000,
    headers,
    method,
    body: req.postData,
    cookies: req.cookies,
    // Prowlarr's Cardigann flow serializes proxy as {url, username, password};
    // other callers may send a plain URL string. Normalize to a single URL string
    // here so downstream Playwright/Camoufox `newContext({proxy})` calls receive
    // a string (issue #12 — proxy.server: expected string, got object).
    // Prowlarr additionally injects its global HTTP proxy into EVERY FlareSolverr
    // request — when that proxy is our own MITM listener, honoring it makes TRAWL
    // scrape through itself (challenge never resolves → "proxy-connection-failed").
    // A proxy pointing at the own MITM listener is a scrape loop, so drop it.
    proxy: isSelfMitmProxy(proxy) ? undefined : proxy,
  }
}

function isSelfMitmProxy(proxyUrl: string | undefined): boolean {
  if (!proxyUrl || !MITM_PROXY_ENABLED) return false
  try {
    return new URL(proxyUrl).port === String(MITM_PROXY_PORT)
  } catch {
    return false
  }
}

// Build a FlareSolverr v2-shaped error envelope. Used by /v1 for every error
// path and by /scrape when the pool is exhausted (PoolExhaustedError → 429).
export function flareSolverrError(url: string, message: string): FlareSolverrResponse {
  const now = Date.now()
  return {
    status: "error",
    message,
    startTimestamp: now,
    endTimestamp: now,
    version: "2.0.0",
    solution: {
      url,
      status: 0,
      headers: {},
      response: "",
      cookies: [],
      userAgent: "",
    },
  }
}
