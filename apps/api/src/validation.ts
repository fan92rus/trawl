import {
  isValidMethod,
  RequestValidationError,
  requireContentTypeForBody,
  SUPPORTED_METHODS,
  sanitizeHeaders,
} from "@trawl/tiers"
import type { Cookie, FlareSolverrRequest, ScrapeRequest } from "@trawl/types"

type RequestRecord = Record<string, unknown>

function requireRequestRecord(body: unknown): asserts body is RequestRecord {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new RequestValidationError("Request body must be a JSON object", 400)
  }
}

function requireUrl(req: RequestRecord): void {
  if (typeof req.url !== "string" || req.url.trim().length === 0) {
    throw new RequestValidationError("url must be a non-empty string", 400)
  }
}

export function requestUrl(body: unknown): string {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return ""
  const url = (body as RequestRecord).url
  return typeof url === "string" ? url : ""
}

// Accepts a `cookies` array of {name, value, domain?, path?} objects (FlareSolverr v2
// shape). Domain defaults to the request host when omitted; path defaults to "/".
// Returns the normalized Cookie[] (with a host-based domain for FlareSolverr-style
// callers that only pass name/value). Rejects malformed entries.
export function normalizeRequestCookies(cookies: unknown, host: string | undefined): Cookie[] | undefined {
  if (cookies === undefined) return undefined
  if (!Array.isArray(cookies)) {
    throw new RequestValidationError("cookies must be an array of {name, value}", 400)
  }
  const out: Cookie[] = []
  for (const entry of cookies) {
    if (typeof entry !== "object" || entry === null) {
      throw new RequestValidationError("each cookie must be an object", 400)
    }
    const rec = entry as Record<string, unknown>
    const name = rec.name
    const value = rec.value
    if (typeof name !== "string" || name.length === 0 || typeof value !== "string") {
      throw new RequestValidationError("each cookie requires string name and value", 400)
    }
    const domainRaw = rec.domain
    const pathRaw = rec.path
    if (domainRaw !== undefined && typeof domainRaw !== "string") {
      throw new RequestValidationError("cookie domain must be a string", 400)
    }
    if (pathRaw !== undefined && typeof pathRaw !== "string") {
      throw new RequestValidationError("cookie path must be a string", 400)
    }
    const fallbackDomain = host ? (host.startsWith(".") ? host : "." + host) : "."
    out.push({
      name,
      value,
      domain: (domainRaw as string | undefined) ?? fallbackDomain,
      path: (pathRaw as string | undefined) ?? "/",
      expires: -1,
      httpOnly: false,
      secure: false,
    })
  }
  return out
}

export function validateFlareSolverrRequest(body: unknown): asserts body is FlareSolverrRequest {
  requireRequestRecord(body)
  requireUrl(body)
}

export function validateScrapeRequest(body: unknown): asserts body is ScrapeRequest {
  requireRequestRecord(body)
  requireUrl(body)
  const req = body as RequestRecord & Partial<ScrapeRequest>
  if (!isValidMethod(req.method)) {
    throw new RequestValidationError(
      `Unsupported method: ${String(req.method)} (allowed: ${SUPPORTED_METHODS.join(", ")})`,
      400,
    )
  }
  requireContentTypeForBody(sanitizeHeaders(req.headers), Boolean(req.body))
}
