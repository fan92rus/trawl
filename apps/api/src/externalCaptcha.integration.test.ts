import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { newFreshContext } from "@trawl/browser"
import { Elysia } from "elysia"
import { ExternalCaptchaSession } from "../../../packages/tiers/src/solvers/externalCaptcha"
import { getDeps, getPool, initPool, shutdownPools } from "./deps"
import { scrapeRoute } from "./routes/scrape"
import { v1Route } from "./routes/v1"

const createTestApi = (deps: typeof getDeps) =>
  new Elysia().use(scrapeRoute(deps)).use(v1Route({ orchestratorDeps: deps }))

describe.skipIf(process.env.TRAWL_EXTERNAL_CAPTCHA_TESTS !== "1")("external CAPTCHA browser integration", () => {
  let fixture: ReturnType<typeof Bun.serve>
  let proxy: ReturnType<typeof Bun.serve>
  let api: ReturnType<typeof createTestApi>
  const originalFetch = globalThis.fetch
  const calls: string[] = []
  const tasks: Record<string, unknown>[] = []
  const browserRequests: { path: string; agent: string | null; proxied: boolean }[] = []
  const url = (path: string) => `http://127.0.0.1:${fixture.port}${path}`
  const options = { apiKey: "owned-fixture-key", maxTasks: 1, timeoutMs: 12000, localTimeoutMs: 1000 }

  beforeAll(async () => {
    fixture = Bun.serve({
      port: 0,
      async fetch(request) {
        const path = new URL(request.url).pathname
        if (path === "/createTask" || path === "/getTaskResult") {
          calls.push(path)
          const body = await request.json()
          expect(body.clientKey).toBe("owned-fixture-key")
          if (path === "/createTask") tasks.push(body.task)
          return Response.json(
            path === "/createTask"
              ? { errorId: 0, taskId: 42 }
              : {
                  errorId: 0,
                  status: "ready",
                  solution: {
                    token: "owned-provider-response",
                    gRecaptchaResponse: "owned-provider-response",
                    ...(tasks.at(-1)?.pagedata
                      ? {
                          userAgent: String(tasks.at(-1)?.websiteURL).includes("agent-mismatch")
                            ? "owned-other-agent"
                            : tasks.at(-1)?.userAgent,
                        }
                      : {}),
                  },
                },
          )
        }
        if (path.startsWith("/managed")) {
          browserRequests.push({
            path,
            agent: request.headers.get("user-agent"),
            proxied: request.headers.get("x-owned-proxy") === "yes",
          })
          if (new URL(request.url).searchParams.get("accepted") === "owned-provider-response")
            return new Response(
              `<html><title>Owned destination</title><body><h1>Verified destination content</h1><p>${"Complete results. ".repeat(30)}</p></body></html>`,
              { headers: { "content-type": "text/html" } },
            )
          return new Response(
            `<html><title>Just a moment...</title><body><form id="challenge-form">Checking your browser</form><script nonce="owned-fixture">
            const initialize = window.ownedInitialize = () => {
            window.turnstile = {render(target, options) {
              document.body.dataset.originalRender = 'true';
              window.ownedWidget = options;
              ${path.includes("local") ? "options.callback('owned-provider-response');" : ""}
              ${path.includes("render-error") ? "throw new Error('Owned render failure');" : ""}
              return 'owned-widget';
            }, reset(){}, remove(){}};
            window.turnstile.render('#challenge-form', {
              sitekey: 'owned-managed-sitekey', action: 'managed', cData: 'owned-dynamic-data', ${path.includes("incomplete") ? "" : "chlPageData: 'owned-page-data',"}
              callback(token) {
                if (document.body.dataset.originalRender === 'true' && token === 'owned-provider-response')
                  ${path.includes("unchanged") ? "document.cookie='cf_clearance=owned-not-enough; Path=/'" : "location.replace(location.pathname + '?accepted=' + token)"};
              }
            });
            };
            ${path.includes("delayed") ? "setTimeout(initialize, 300)" : "initialize()"};
          </script></body></html>`,
            {
              headers: {
                "content-type": "text/html",
                "cf-mitigated": "challenge",
                "content-security-policy": "script-src 'nonce-owned-fixture'",
              },
            },
          )
        }
        const recaptcha = path === "/recaptcha" || path === "/recaptcha-net" || path === "/enterprise"
        const multiple = path === "/multiple"
        const fieldName =
          path === "/custom-field"
            ? "owned-turnstile-token"
            : recaptcha || path === "/compat"
              ? "g-recaptcha-response"
              : "cf-turnstile-response"
        const attrs =
          path === "/custom-field"
            ? 'data-response-field-name="owned-turnstile-token"'
            : path === "/no-field"
              ? 'data-response-field="false"'
              : ""
        const widget = `<div ${path === "/enterprise" ? 'data-s="owned-s"' : ""} ${attrs} class="${recaptcha ? "g-recaptcha" : "cf-turnstile"}" data-sitekey="owned-sitekey" data-callback="fixture.accept"></div>`
        return new Response(
          `<html><head><title>Owned contact form</title>${path === "/enterprise" ? '<script src="https://www.google.com/recaptcha/enterprise.js"></script>' : path === "/recaptcha-net" ? '<script src="https://www.recaptcha.net/recaptcha/api.js"></script>' : path === "/compat" ? '<script src="https://challenges.cloudflare.com/turnstile/v0/api.js?compat=recaptcha"></script>' : ""}</head><body><form>${widget}${multiple ? widget : ""}${path === "/no-field" ? "" : `<textarea name="${fieldName}" hidden></textarea>`}<button type="submit">Submit</button></form><p>${"Fixture page content ".repeat(20)}</p><script>window.fixture={accept(token){if(token==='owned-provider-response')document.body.dataset.accepted='true'}};document.querySelector('form').onsubmit=e=>{e.preventDefault();document.body.dataset.submitted='true'}</script></body></html>`,
          {
            headers: {
              "content-type": "text/html",
              ...(path === "/csp" ? { "content-security-policy": "script-src 'none'" } : {}),
            },
          },
        )
      },
    })
    proxy = Bun.serve({
      port: 0,
      fetch(request) {
        const target = new URL(request.url)
        if (target.hostname !== "owned-cloudflare.invalid") return new Response("Unexpected target", { status: 502 })
        target.hostname = "127.0.0.1"
        const headers = new Headers(request.headers)
        headers.delete("host")
        headers.set("x-owned-proxy", "yes")
        return originalFetch(target, { headers, redirect: "manual", signal: request.signal })
      },
    })
    // Only the provider transport is redirected to the owned HTTP fixture.
    // No real paid endpoint is reached, including on failure.
    globalThis.fetch = ((input: string | URL | Request, init?: RequestInit) => {
      const target = new URL(typeof input === "string" || input instanceof URL ? input : input.url)
      if (target.hostname === "api.2captcha.com") return originalFetch(url(target.pathname), init)
      return originalFetch(input, init)
    }) as typeof fetch
    await initPool({ poolSize: 1, headfulPoolSize: 0 })
    const deps = () => ({ ...getDeps(), externalCaptcha: options })
    api = new Elysia()
      .use(scrapeRoute(deps))
      .use(v1Route({ orchestratorDeps: deps }))
      .listen(0)
  }, 120000)

  afterAll(async () => {
    globalThis.fetch = originalFetch
    await api?.stop()
    await shutdownPools()
    proxy?.stop(true)
    fixture?.stop(true)
  })

  test("native and Prowlarr routes run local solving before external fallback", async () => {
    for (const route of ["/scrape", "/v1"]) {
      const before = calls.length
      const response = await originalFetch(`http://127.0.0.1:${api.server?.port}${route}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          route === "/scrape"
            ? { url: url("/turnstile"), skipHttp: true, maxTier: 3, maxTimeout: 20000 }
            : { cmd: "request.get", url: url("/turnstile"), maxTimeout: 20000, solveEmbeddedCaptchas: true },
        ),
      })
      const result = await response.json()
      expect(response.status, JSON.stringify(result)).toBe(200)
      const html = result.html ?? result.solution?.response
      expect(html).toContain('data-accepted="true"')
      expect(html).not.toContain('data-submitted="true"')
      if (route === "/scrape") expect(result.captchasSolved).toEqual(["turnstile:2captcha"])
      expect(calls.slice(before)).toEqual(["/createTask", "/getTaskResult"])
      const deadline = Date.now() + 20000
      while (!getPool()?.getStats().available && Date.now() < deadline) await Bun.sleep(20)
      expect(getPool()?.getStats().available).toBe(1)
    }
  }, 50000)

  test("declarative reCAPTCHA without an anchor iframe falls back through the native API", async () => {
    const response = await originalFetch(`http://127.0.0.1:${api.server?.port}/scrape`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: url("/recaptcha"), skipHttp: true, maxTier: 3, maxTimeout: 20000 }),
    })
    const result = await response.json()
    expect(response.status, JSON.stringify(result)).toBe(200)
    expect(result.captchasSolved).toEqual(["recaptcha-v2:2captcha"])
    expect(result.html).toContain('data-accepted="true"')
  }, 30000)

  test("managed Cloudflare pages fall back automatically through native and Prowlarr routes", async () => {
    for (const route of ["/scrape", "/v1"]) {
      const before = tasks.length
      const target = url(route === "/v1" ? "/managed-delayed-v1" : "/managed-scrape")
      const response = await originalFetch(`http://127.0.0.1:${api.server?.port}${route}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          route === "/scrape"
            ? { url: target, skipHttp: true, maxTier: 3, maxTimeout: 15000 }
            : { cmd: "request.get", url: target, maxTimeout: 15000 },
        ),
      })
      const result = await response.json()
      expect(response.status, JSON.stringify(result)).toBe(200)
      expect(result.html ?? result.solution?.response).toContain("Verified destination content")
      expect(tasks.slice(before)).toHaveLength(1)
      expect(tasks.at(-1)).toMatchObject({
        type: "TurnstileTaskProxyless",
        websiteURL: target,
        websiteKey: "owned-managed-sitekey",
        action: "managed",
        data: "owned-dynamic-data",
        pagedata: "owned-page-data",
        userAgent: expect.any(String),
      })
      if (route === "/scrape") expect(result.captchasSolved).toEqual(["cloudflare-challenge:2captcha"])
    }
  }, 45000)

  test("managed tasks preserve the browser proxy and its actual HTTP user agent", async () => {
    const pool = getPool()
    if (!pool) throw new Error("pool not ready")
    const lease = await pool.acquire()
    const context = await newFreshContext(lease.browser, { proxy: proxy.url.origin })
    try {
      const page = await context.newPage()
      const session = new ExternalCaptchaSession(options, globalThis.fetch, async () => {})
      await session.preparePage(page)
      await page.goto(`http://owned-cloudflare.invalid:${fixture.port}/managed-proxy`)
      expect(await session.solve(page, "cloudflare-challenge", 12000, undefined, proxy.url.origin)).toBe(true)
      await page.waitForURL("**?accepted=owned-provider-response")
      expect(await page.content()).toContain("Verified destination content")
      const request = browserRequests.find(({ path }) => path === "/managed-proxy")
      expect(request?.proxied).toBe(true)
      expect(tasks.at(-1)).toMatchObject({
        type: "TurnstileTask",
        proxyType: "http",
        proxyAddress: proxy.url.hostname,
        proxyPort: proxy.port,
        userAgent: request?.agent,
      })
    } finally {
      await context.close()
      pool.release(lease.id, lease.lease)
    }
  }, 15000)

  test("managed fallback survives repeated requests on one page without accumulating init scripts", async () => {
    const pool = getPool()
    if (!pool) throw new Error("pool not ready")
    const lease = await pool.acquire()
    const context = await newFreshContext(lease.browser)
    try {
      const page = await context.newPage()
      for (let i = 0; i < 3; i++) {
        const before = tasks.length
        const session = new ExternalCaptchaSession(options, globalThis.fetch, async () => {})
        await session.preparePage(page)
        await page.goto(url(`/managed-repeat-${i}`))
        expect(await session.solve(page, "cloudflare-challenge", 12000)).toBe(true)
        await page.waitForURL("**?accepted=owned-provider-response")
        expect(await page.content()).toContain("Verified destination content")
        expect(tasks.length - before).toBe(1)
        expect(
          await page.evaluate(
            "mw:Object.getOwnPropertyNames(window).filter(key => key.startsWith('__trawl_cf_')).length",
          ),
        ).toBe(1)
      }
    } finally {
      await context.close()
      pool.release(lease.id, lease.lease)
    }
  }, 30000)

  test("managed tasks refuse incomplete, consumed, expired, replaced and navigated challenges", async () => {
    const pool = getPool()
    if (!pool) throw new Error("pool not ready")
    const lease = await pool.acquire()
    const context = await newFreshContext(lease.browser)
    try {
      for (const scenario of [
        "unobserved",
        "incomplete",
        "consumed",
        "expired",
        "render-error",
        "replaced",
        "sdk-replaced",
        "reset",
        "reload",
        "agent-mismatch",
      ]) {
        const before = tasks.length
        const page = await context.newPage()
        const session = new ExternalCaptchaSession(options, globalThis.fetch, async () => {
          if (scenario === "replaced") await page.evaluate("mw:window.ownedInitialize()")
          if (scenario === "sdk-replaced") await page.evaluate("mw:window.turnstile = {}")
          if (scenario === "reset") await page.evaluate("mw:window.turnstile.reset()")
          if (scenario === "reload") await page.reload()
        })
        if (scenario !== "unobserved") await session.preparePage(page)
        await page.goto(url(`/managed-${scenario}`))
        if (scenario === "consumed") await page.evaluate("mw:window.ownedWidget.callback('owned-local-answer')")
        if (scenario === "expired") await page.evaluate("mw:window.ownedWidget['expired-callback']()")
        expect(await session.solve(page, "cloudflare-challenge", 12000), scenario).toBe(false)
        expect(page.url(), scenario).not.toContain("accepted=")
        expect(tasks.length - before, scenario).toBe(
          ["unobserved", "incomplete", "consumed", "expired", "render-error"].includes(scenario) ? 0 : 1,
        )
        expect(await session.solve(page, "cloudflare-challenge", 12000), scenario).toBe(false)
        if (scenario === "agent-mismatch")
          expect(session.diagnostics()).toContainEqual({ kind: "cloudflare-challenge", status: "identity-mismatch" })
        await page.close()
      }
    } finally {
      await context.close()
      pool.release(lease.id, lease.lease)
    }
  }, 20000)

  test("local managed solves spend nothing and a clearance cookie alone cannot become API success", async () => {
    for (const scenario of ["local", "unchanged"]) {
      const before = tasks.length
      const response = await originalFetch(`http://127.0.0.1:${api.server?.port}/scrape`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: url(`/managed-${scenario}`), skipHttp: true, maxTier: 3, maxTimeout: 9000 }),
      })
      const result = await response.json()
      expect(response.status, JSON.stringify(result)).toBe(scenario === "local" ? 200 : 500)
      if (scenario === "local") expect(result.html).toContain("Verified destination content")
      expect(tasks.length - before).toBe(scenario === "local" ? 0 : 1)
    }
  }, 20000)

  test("Turnstile custom response names and callback-only widgets receive the token", async () => {
    const pool = getPool()
    if (!pool) throw new Error("pool not ready")
    const lease = await pool.acquire()
    const context = await newFreshContext(lease.browser)
    try {
      const page = await context.newPage()
      await page.route("https://challenges.cloudflare.com/**", (route: { abort(): Promise<void> }) => route.abort())
      for (const path of ["/custom-field", "/no-field", "/compat"]) {
        await page.goto(url(path))
        expect(await new ExternalCaptchaSession(options).solve(page, "turnstile", 12000)).toBe(true)
        expect(await page.evaluate(() => document.body.dataset.accepted)).toBe("true")
        expect(
          await page.evaluate(
            () => document.querySelector<HTMLTextAreaElement>('[name="owned-turnstile-token"]')?.value ?? null,
          ),
        ).toBe(path === "/custom-field" ? "owned-provider-response" : null)
        expect(await page.evaluate(() => document.querySelector('[name="cf-turnstile-response"]'))).toBeNull()
        if (path === "/compat")
          expect(
            await page.evaluate(
              () => document.querySelector<HTMLTextAreaElement>('[name="g-recaptcha-response"]')?.value,
            ),
          ).toBe("owned-provider-response")
      }
    } finally {
      await context.close()
      pool.release(lease.id, lease.lease)
    }
  }, 35000)

  test("reCAPTCHA callback runs in the page realm; ambiguous widgets spend nothing and CSP fails safely", async () => {
    const pool = getPool()
    if (!pool) throw new Error("pool not ready")
    const lease = await pool.acquire()
    const context = await newFreshContext(lease.browser)
    try {
      const page = await context.newPage()
      await page.route("https://www.recaptcha.net/**", (route: { abort(): Promise<void> }) => route.abort())
      await page.goto(url("/recaptcha-net"))
      expect(await new ExternalCaptchaSession(options).solve(page, "recaptcha-v2", 12000)).toBe(true)
      expect(tasks.at(-1)).toMatchObject({
        apiDomain: "recaptcha.net",
        userAgent: await page.evaluate(() => navigator.userAgent),
      })
      expect(await page.evaluate(() => document.body.dataset.accepted)).toBe("true")
      await page.route("https://www.google.com/**", (route: { abort(): Promise<void> }) => route.abort())
      await page.goto(url("/enterprise"))
      expect(await new ExternalCaptchaSession(options).solve(page, "recaptcha-v2-enterprise", 12000)).toBe(true)
      expect(tasks.at(-1)).toMatchObject({
        type: "RecaptchaV2EnterpriseTaskProxyless",
        enterprisePayload: { s: "owned-s" },
      })
      expect(await page.evaluate(() => document.body.dataset.accepted)).toBe("true")
      const before = calls.length
      await page.goto(url("/multiple"))
      expect(await new ExternalCaptchaSession(options).solve(page, "turnstile", 12000)).toBe(false)
      expect(calls.length).toBe(before)
      await page.goto(url("/csp"))
      expect(await new ExternalCaptchaSession(options).solve(page, "turnstile", 12000)).toBe(false)
      expect(await page.evaluate(() => document.querySelector<HTMLTextAreaElement>("textarea")?.value)).toBe("")
    } finally {
      await context.close()
      pool.release(lease.id, lease.lease)
    }
  }, 35000)
})
