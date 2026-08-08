import { PoolExhaustedError } from "@trawl/browser"
import { RequestValidationError, scrape } from "@trawl/tiers"
import type { FlareSolverrRequest, FlareSolverrResponse } from "@trawl/types"
import { Elysia } from "elysia"
import { buildScrapeRequestFromFlareSolverr, flareSolverrError } from "../adapters/flaresolverr"
import { userCookiesForHost } from "../config"
import { getDeps, getPool } from "../deps"
import { normalizeRequestCookies, requestUrl, validateFlareSolverrRequest } from "../validation"

// FlareSolverr v2 compat — always open (the v2 spec has no auth header)
export function v1Route() {
  return new Elysia().post("/v1", async ({ body, set }) => {
    const startTimestamp = Date.now()

    try {
      validateFlareSolverrRequest(body)
      const req: FlareSolverrRequest = body
      const cmd = req.cmd ?? "request.get"

      if (cmd !== "request.get" && cmd !== "request.post") {
        set.status = 400
        return flareSolverrError(req.url, `Unknown cmd: ${cmd}`)
      }

      if (!getPool()) {
        set.status = 503
        return flareSolverrError(req.url, "Browser pool initializing, retry in a few seconds")
      }

      // Normalize the optional cookies array (domain defaults to the request host).
      let host: string | undefined
      try {
        host = new URL(req.url).hostname
      } catch {}
      req.cookies = normalizeRequestCookies(req.cookies, host)

      // Merge per-domain user cookies (from USER_COOKIES_JSON, e.g. rutracker bb_session)
      // so the caller doesn't need to pass them in every request. Request-supplied
      // cookies take precedence (they override user cookies with the same name).
      const userCookies = host ? userCookiesForHost(host) : undefined
      if (userCookies && userCookies.length > 0) {
        const existingNames = new Set((req.cookies ?? []).map((c) => c.name))
        const merged = [...(req.cookies ?? [])]
        for (const uc of userCookies) {
          if (!existingNames.has(uc.name)) {
            merged.push({ name: uc.name, value: uc.value, domain: uc.domain ?? (host ? `.${host}` : ""), path: uc.path ?? "/", expires: -1, httpOnly: false, secure: false })
          }
        }
        req.cookies = merged
      }

      const scrapeRequest = buildScrapeRequestFromFlareSolverr(req)
      const result = await scrape(scrapeRequest, getDeps())
      return {
        status: "ok",
        message: "",
        startTimestamp,
        endTimestamp: Date.now(),
        version: "2.0.0",
        solution: {
          url: result.url,
          status: result.statusCode,
          headers: {},
          response: result.html,
          cookies: result.cookies,
          userAgent: result.userAgent,
        },
      } satisfies FlareSolverrResponse
    } catch (err) {
      if (err instanceof RequestValidationError) {
        set.status = err.statusCode
        return flareSolverrError(requestUrl(body), err.message)
      }
      set.status = err instanceof PoolExhaustedError ? 429 : 500
      return flareSolverrError(requestUrl(body), err instanceof Error ? err.message : String(err))
    }
  })
}
