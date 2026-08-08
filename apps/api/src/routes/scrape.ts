import { PoolExhaustedError } from "@trawl/browser"
import { RequestValidationError, ScrapeError, sanitizeHeaders, scrape } from "@trawl/tiers"
import type { ScrapeRequest } from "@trawl/types"
import { Elysia } from "elysia"
import { flareSolverrError } from "../adapters/flaresolverr"
import { getDeps, getPool } from "../deps"
import { normalizeRequestCookies, requestUrl, validateScrapeRequest } from "../validation"

// Native TRAWL API — richer response (tier, timings, sessionCached).
// Error mapping:
//   503 — pool still initializing (native { error })
//   429 — pool exhausted (FlareSolverr envelope; uniform with /v1)
//   500 — other scrape exception (native { error })
export function scrapeRoute() {
  return new Elysia().post("/scrape", async ({ body, set }) => {
    try {
      validateScrapeRequest(body)
      const req: ScrapeRequest = body
      if (!getPool()) {
        set.status = 503
        return { error: "Browser pool initializing, retry in a few seconds" }
      }
      // Normalize the optional cookies array (domain defaults to the request host).
      let host: string | undefined
      try {
        host = new URL(req.url).hostname
      } catch {}
      req.cookies = normalizeRequestCookies(req.cookies, host)
      return await scrape({ ...req, headers: sanitizeHeaders(req.headers) }, getDeps())
    } catch (err) {
      if (err instanceof RequestValidationError) {
        set.status = err.statusCode
        return { error: err.message }
      }
      if (err instanceof PoolExhaustedError) {
        set.status = 429
        return flareSolverrError(requestUrl(body), "Browser pool saturated, retry shortly")
      }
      set.status = 500
      if (err instanceof ScrapeError) {
        return { error: err.message, timings: err.timings }
      }
      return { error: err instanceof Error ? err.message : String(err) }
    }
  })
}
