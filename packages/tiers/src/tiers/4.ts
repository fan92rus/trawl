import type { BrowserHandle } from "@trawl/browser"
import { FINGERPRINT, newFreshContext } from "@trawl/browser"
import type { Cookie, TierResult } from "@trawl/types"
import { solvePageCaptchas } from "../solvers"
import { waitForAkamaiResolution } from "../utils/akamaiWait"
import { waitForChallengeResolution } from "../utils/challengeWait"
import { normalizeSameSite, toCookies } from "../utils/cookies"
import {
  detectChallengeType,
  hasAkamaiChallenge,
  hasImpervaChallenge,
  isBlocked,
  isBrowserErrorPage,
  isCloudflarePage,
} from "../utils/detect"
import { normalizeHtml } from "../utils/html"
import { waitForImpervaResolution } from "../utils/impervaWait"
import { isHardNetworkFailure } from "../utils/network"
import { captureResponse, isTextContentType, type MinimalResponse } from "../utils/response"
import type { RouteLike } from "../utils/sanitize"
import { routeContinueOverrides } from "../utils/sanitize"

export interface Tier4Result extends TierResult {
  tier: 4
  html?: string
  body?: Uint8Array
  responseHeaders?: Record<string, string>
  contentType?: string
  cookies?: Cookie[]
  userAgent?: string
  statusCode?: number
  captchasSolved?: string[]
}

export async function runTier4(
  url: string,
  handle: BrowserHandle,
  maxTimeout: number,
  proxyUrl: string,
  extraHeaders?: Record<string, string>,
  method?: string,
  body?: string,
  requestCookies?: Cookie[],
): Promise<Tier4Result> {
  const start = Date.now()

  // Create an isolated context routed through the proxy.
  // Proxies must be set at context creation time in Playwright — they cannot be
  // applied per-request. We create a fresh context here and close it when done,
  // leaving the pool's shared context untouched.
  const state: { proxyContext?: Awaited<ReturnType<typeof newFreshContext>> } = {}

  try {
    const proxyContext = await newFreshContext(handle.browser, { proxy: proxyUrl })
    state.proxyContext = proxyContext

    const page = await proxyContext.newPage()

    // Inject auth/session cookies before navigation (same rationale as Tier 3).
    if (requestCookies && requestCookies.length > 0) {
      await proxyContext.addCookies(
        requestCookies.map((c) => ({
          name: c.name,
          value: c.value,
          domain: c.domain,
          path: c.path,
          expires: c.expires,
          httpOnly: c.httpOnly,
          secure: c.secure,
          sameSite: normalizeSameSite(c.sameSite),
        })),
      )
    }

    if ((extraHeaders && Object.keys(extraHeaders).length > 0) || method === "POST") {
      await page.route(url, (route: RouteLike) => {
        route.continue(routeContinueOverrides(route, extraHeaders, method, body))
      })
    }

    let statusCode = 200
    const mainResponseHolder: { value?: MinimalResponse } = {}
    page.on("response", (res: MinimalResponse) => {
      try {
        if (res.url() === url || res.url().startsWith(url.replace(/\/$/, ""))) {
          statusCode = res.status()
          if (!mainResponseHolder.value) mainResponseHolder.value = res
        }
      } catch {}
    })

    const gotoErr = await page
      .goto(url, {
        waitUntil: "domcontentloaded",
        timeout: Math.min(maxTimeout, 30_000),
      })
      .catch((e: Error) => e)

    if (isHardNetworkFailure(gotoErr)) {
      return { tier: 4, status: "error", durationMs: Date.now() - start, reason: gotoErr.message.split("\n")[0] }
    }

    const remaining = maxTimeout - (Date.now() - start)
    const peekHtml = await page.content().catch(() => "")
    const challengeType = detectChallengeType(peekHtml)
    const resolution =
      challengeType === "imperva"
        ? await waitForImpervaResolution(page, remaining, url)
        : challengeType === "akamai"
          ? await waitForAkamaiResolution(page, remaining, url)
          : await waitForChallengeResolution(page, remaining, url)

    if (resolution !== "ok") {
      return {
        tier: 4,
        status: resolution === "ip-blocked" ? "blocked" : "timeout",
        durationMs: Date.now() - start,
        reason:
          resolution === "ip-blocked"
            ? "proxy-ip-blocked"
            : `${challengeType === "none" ? "cloudflare" : challengeType}-challenge-timeout`,
      }
    }

    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {})

    // Attempt to solve any embedded captcha widgets on the page (Turnstile, reCaptcha, hCaptcha) —
    // same as Tier 3. Sites that reach Tier 4 for IP reputation can still have an in-page widget.
    const solveRemaining = maxTimeout - (Date.now() - start)
    let captchasSolved: string[] = []
    if (solveRemaining > 5000) {
      const solveResult = await solvePageCaptchas(page, solveRemaining).catch(() => ({ attempted: [], solved: [] }))
      captchasSolved = solveResult.solved
    }

    const html = await page.content()

    if (html.length < 100) {
      return { tier: 4, status: "error", durationMs: Date.now() - start, reason: "page returned empty content" }
    }

    if (isBrowserErrorPage(html)) {
      return {
        tier: 4,
        status: "error",
        durationMs: Date.now() - start,
        reason: "browser network error (about:neterror)",
      }
    }

    if (isCloudflarePage(html, {})) {
      return {
        tier: 4,
        status: "blocked",
        durationMs: Date.now() - start,
        reason: "cloudflare-persistent",
      }
    }

    if (hasImpervaChallenge(html)) {
      return {
        tier: 4,
        status: "blocked",
        durationMs: Date.now() - start,
        reason: "imperva-persistent",
      }
    }

    if (hasAkamaiChallenge(html)) {
      return {
        tier: 4,
        status: "blocked",
        durationMs: Date.now() - start,
        reason: "akamai-persistent",
      }
    }

    if (isBlocked(statusCode, html)) {
      return { tier: 4, status: "blocked", durationMs: Date.now() - start, reason: `http-${statusCode}` }
    }

    const cookies: Cookie[] = toCookies(await proxyContext.cookies())

    const captured = await captureResponse(mainResponseHolder.value)

    return {
      tier: 4,
      status: "success",
      durationMs: Date.now() - start,
      html: !captured.contentType || isTextContentType(captured.contentType) ? normalizeHtml(html) : "",
      ...captured,
      cookies,
      userAgent: await page.evaluate(() => navigator.userAgent).catch(() => FINGERPRINT.userAgent),
      statusCode,
      captchasSolved: captchasSolved.length > 0 ? captchasSolved : undefined,
    }
  } catch (err) {
    return {
      tier: 4,
      status: "error",
      durationMs: Date.now() - start,
      reason: err instanceof Error ? err.message : String(err),
    }
  } finally {
    // Same timeout-bounded close as tier3 — see comment there.
    if (state.proxyContext) {
      await Promise.race([state.proxyContext.close(), new Promise<void>((resolve) => setTimeout(resolve, 5000))]).catch(
        () => {},
      )
    }
  }
}
