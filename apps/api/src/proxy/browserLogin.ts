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
 * Currently recognizes:
 *   - rutracker.org login.php (login_username / login_password / login)
 *
 * The detection is deliberately generic (field-name based) so other forums using
 * the same convention can be added without code changes — just extend the map.
 */
export function parseLoginFormData(
  url: string,
  method: string,
  body: string | undefined,
): { username: string; password: string; submitField: string } | null {
  if (method !== "POST" || !body) return null
  try {
    const params = new URLSearchParams(body)
    // rutracker.org / torrentpier forums
    const username = params.get("login_username") ?? params.get("username") ?? params.get("user")
    const password = params.get("login_password") ?? params.get("password") ?? params.get("pass")
    if (username && password) {
      return { username, password, submitField: "login" }
    }
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
 *   1. Acquire a browser from the pool.
 *   2. Open a fresh context with user cookies injected (bb_session etc.).
 *   3. Navigate to the login URL — CF challenge (if any) is solved by Camoufox.
 *   4. Wait for the login form, fill username/password, click submit.
 *   5. Wait for navigation to complete (rutracker redirects to index.php).
 *   6. Capture the final HTML + cookies, return them to the proxy caller.
 *
 * The proxy caller sets Set-Cookie headers from the returned cookies so Prowlarr
 * picks up the real session cookies (bb_session) and stores them in its own DB.
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
  let tempCtx: any = null

  try {
    // Use the pool's shared context — it already has accumulated CF clearance.
    const ctx = handle.context

    // Inject user cookies (bb_session etc.) so the login page is already authenticated
    // context — CF challenge is less likely and the form is the logged-out variant only
    // if cookies are expired.
    const userCookies = userCookiesForHost(host)
    if (userCookies && userCookies.length > 0) {
      await ctx.addCookies(
        userCookies.map((c) => ({
          name: c.name,
          value: c.value,
          domain: c.domain ?? `.${host}`,
          path: c.path ?? "/",
        })),
      ).catch(() => {})
    }

    page = await ctx.newPage()

    if (opts.debug) console.log(`[login] navigating to ${url} (CF solve if needed)...`)

    // Navigate to the login page. CF challenge is solved here by Camoufox.
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90_000 }).catch((e: Error) => {
      // CF challenges can trigger "navigation interrupted" — non-fatal, the page
      // may have loaded enough to proceed.
      if (opts.debug) console.log(`[login] goto (non-fatal): ${e.message.split("\n")[0]}`)
    })

    // Wait for the username field to appear (CF challenge resolved + form rendered).
    // Rutracker's form: input[name="login_username"]
    const usernameSelector = [
      'input[name="login_username"]',
      'input[name="username"]',
      'input[name="user"]',
      'input[id="username"]',
    ].join(", ")

    try {
      await page.waitForSelector(usernameSelector, { state: "visible", timeout: 60_000 })
    } catch {
      if (opts.debug) console.log(`[login] login form not found — page may already be logged in or CF unsolved`)
      // If already logged in (user cookies valid), return the current page.
      const html = await page.content()
      if (html.includes('id="logged-in-username"') || html.includes("logged-in-username")) {
        return buildLoginResult(html, [], "text/html; charset=utf-8")
      }
      return null
    }

    if (opts.debug) console.log(`[login] filling form: ${formData.username}`)

    // Fill the form fields.
    await page.fill('input[name="login_username"], input[name="username"], input[name="user"]', formData.username).catch(() => {})
    await page.fill('input[name="login_password"], input[name="password"], input[name="pass"]', formData.password).catch(() => {})

    // Submit the form — wait for navigation to complete.
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
      page.click(submitSelector).catch(() =>
        // Fallback: press Enter in the password field
        page.press('input[name="login_password"], input[name="password"]', "Enter").catch(() => {}),
      ),
    ])

    // Give the page a moment to settle after redirect.
    await page.waitForTimeout(2000).catch(() => {})

    const html = await page.content()
    const cookies = await ctx.cookies().catch(() => [])

    const loggedIn = html.includes("logged-in-username")
    if (opts.debug) console.log(`[login] result: loggedIn=${loggedIn} cookies=${cookies.length} html=${html.length}b`)

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
  // The proxy writer joins array-valued headers with \r\nSet-Cookie: .
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
