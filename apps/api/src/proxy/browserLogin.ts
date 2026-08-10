import type { OrchestratorDeps } from "@trawl/tiers"
import { userCookiesForHost } from "../config"
import type { MitmProxyOptions } from "./server"

export interface LoginResult {
  statusCode: number
  headers: Record<string, string[]>
  body: Buffer
  contentType: string
}

/**
 * Detect whether an incoming MITM request looks like a site's login form POST.
 * Returns the parsed username/password if recognized, otherwise null.
 *
 * Recognizes common field names: login_username/username/user + login_password/password/pass.
 */
export function parseLoginFormData(
  url: string,
  method: string,
  body: string | undefined,
): { username: string; password: string } | null {
  if (method !== "POST" || !body) return null
  try {
    const params = new URLSearchParams(body)
    const username = params.get("login_username") ?? params.get("username") ?? params.get("user")
    const password = params.get("login_password") ?? params.get("password") ?? params.get("pass")
    if (username && password) return { username, password }
    return null
  } catch {
    return null
  }
}

/**
 * Perform a real browser-based form login instead of route-intercepting the POST.
 *
 * Why: Cloudflare challenge solve in a browser involves page redirects. When TRAWL
 * tries to convert a GET navigation into a POST via route.continue(), the postData
 * is lost after CF redirects the browser. A real form submission (fill fields → click
 * submit) survives CF because the browser sends a genuine POST with all cookies and
 * cf_clearance already established.
 *
 * Flow:
 *   1. Acquire a browser from the pool (shared context with accumulated CF clearance).
 *   2. Navigate to the login URL — CF challenge (if any) is solved by Camoufox.
 *   3. If the page shows a login form → fill username/password, click submit.
 *   4. If already logged in (bb_session valid) → rutracker redirects to index.php,
 *      no form to fill — return the logged-in page as-is.
 *   5. Capture the final HTML + cookies, return with Set-Cookie headers.
 */
export async function handleBrowserLogin(
  url: string,
  formData: { username: string; password: string },
  opts: MitmProxyOptions,
  deps: OrchestratorDeps,
): Promise<LoginResult | null> {
  let host: string
  try {
    host = new URL(url).hostname
  } catch {
    return null
  }

  const handle = await deps.acquireBrowser(host, opts.maxTimeout ?? 90_000)
  let page: any = null

  try {
    const ctx = handle.context

    // Inject user cookies (bb_session etc.) so the login page has forum context.
    const userCookies = userCookiesForHost(host)
    if (userCookies && userCookies.length > 0) {
      await ctx
        .addCookies(
          userCookies.map((c) => ({
            name: c.name,
            value: c.value,
            domain: c.domain ?? `.${host}`,
            path: c.path ?? "/",
          })),
        )
        .catch(() => {})
    }

    page = await ctx.newPage()

    if (opts.debug) console.log(`[login] navigating to ${url} (CF solve if needed)...`)

    // Navigate to the login page. CF challenge is solved here by Camoufox.
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90_000 }).catch((e: Error) => {
      if (opts.debug) console.log(`[login] goto (non-fatal): ${e.message.split("\n")[0]}`)
    })

    // Common username field selectors across forum/CMS platforms.
    const usernameSelector = [
      'input[name="login_username"]',
      'input[name="username"]',
      'input[name="user"]',
      'input[id="username"]',
    ].join(", ")

    // Wait for the username field (CF challenge resolved + form rendered).
    let formFound = true
    try {
      await page.waitForSelector(usernameSelector, { state: "visible", timeout: 30_000 })
    } catch {
      formFound = false
    }

    if (formFound) {
      // ── Login form visible → fill and submit ──
      if (opts.debug) console.log(`[login] filling form: ${formData.username}`)
      await page
        .fill('input[name="login_username"], input[name="username"], input[name="user"]', formData.username)
        .catch(() => {})
      await page
        .fill('input[name="login_password"], input[name="password"], input[name="pass"]', formData.password)
        .catch(() => {})

      if (opts.debug) console.log(`[login] submitting form...`)
      const submitSelector = [
        'input[name="login"]',
        'button[type="submit"]',
        'input[type="submit"]',
        'button[name="login"]',
      ].join(", ")

      await Promise.all([
        page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 60_000 }).catch((e: Error) => {
          if (opts.debug) console.log(`[login] nav after submit (non-fatal): ${e.message.split("\n")[0]}`)
        }),
        page
          .click(submitSelector)
          .catch(() => page.press('input[name="login_password"], input[name="password"]', "Enter").catch(() => {})),
      ])
      await page.waitForTimeout(2000).catch(() => {})
    } else {
      // ── No login form found ──
      // Could be: already logged in (redirected to index.php), CF challenge
      // unsolved, or unexpected page. Wait a moment for any redirect to settle.
      await page.waitForTimeout(3000).catch(() => {})
    }

    // Capture the final state regardless of path.
    const html = await page.content().catch(() => "")
    let finalUrl = url
    try {
      finalUrl = page.url()
    } catch {}
    const cookies = await ctx.cookies().catch(() => [])

    const loggedIn = html.includes("logged-in-username")
    if (opts.debug) {
      console.log(
        `[login] result: finalUrl=${finalUrl} loggedIn=${loggedIn} cookies=${cookies.length} html=${html.length}b`,
      )
    }

    if (loggedIn) {
      return buildLoginResult(html, cookies, "text/html; charset=utf-8")
    }

    // Login failed — return the page anyway so Prowlarr sees the response.
    return buildLoginResult(html, cookies, "text/html; charset=utf-8")
  } catch (err) {
    if (opts.debug) console.error(`[login] error:`, err instanceof Error ? err.message : err)
    return null
  } finally {
    if (page) await page.close().catch(() => {})
    deps.releaseBrowser(handle.id, handle.lease)
  }
}

function buildLoginResult(html: string, cookies: any[], contentType: string): LoginResult {
  // Build Set-Cookie headers — HTTP allows multiple Set-Cookie headers.
  const setCookies: string[] = []
  for (const c of cookies) {
    if (!c.name || !c.value) continue
    let cookieStr = `${c.name}=${c.value}`
    if (c.path) cookieStr += `; path=${c.path}`
    if (c.domain) cookieStr += `; domain=${c.domain}`
    if (c.expires && typeof c.expires === "number" && c.expires > 0) {
      cookieStr += `; expires=${new Date(c.expires * 1000).toUTCString()}`
    }
    if (c.secure) cookieStr += "; secure"
    if (c.httpOnly) cookieStr += "; httponly"
    setCookies.push(cookieStr)
  }

  return {
    statusCode: 200,
    headers: setCookies.length > 0 ? { "set-cookie": setCookies } : {},
    body: Buffer.from(html, "utf8"),
    contentType,
  }
}
