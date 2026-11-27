import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { type BrowserHandle, MemorySessionCache } from "@trawl/browser"
import type { OrchestratorDeps } from "@trawl/tiers"
import { Elysia } from "elysia"
import { launchAnubisBrowser } from "../../../packages/browser/tests/helpers/anubisBrowser"
import { solvePageCaptchas } from "../../../packages/tiers/src/solvers"
import { MetricsStore } from "./metrics"
import { scrapeRoute } from "./routes/scrape"
import { v1Route } from "./routes/v1"

describe.skipIf(process.env.TRAWL_TURNSTILE_TESTS !== "1")("embedded Turnstile lifecycle", () => {
  let browser: Awaited<ReturnType<typeof launchAnubisBrowser>>
  let server: ReturnType<typeof Bun.serve>
  let handle: BrowserHandle
  let api: ReturnType<typeof createApi>
  let deps: OrchestratorDeps
  const cache = new MemorySessionCache({ ttlSeconds: 60 })
  const metrics = new MetricsStore()
  const createApi = () =>
    new Elysia()
      .use(
        scrapeRoute(
          () => deps,
          () => true,
          metrics,
        ),
      )
      .use(v1Route({ orchestratorDeps: () => deps, poolReady: () => true, metricsStore: metrics }))
  const target = (mode = "remove", delay = 600) => `http://127.0.0.1:${server.port}/${mode}?delay=${delay}`

  beforeAll(async () => {
    server = Bun.serve({
      hostname: "0.0.0.0",
      port: 0,
      fetch(request) {
        const url = new URL(request.url)
        const mode = url.pathname.slice(1)
        const delay = Number(url.searchParams.get("delay")) || 600
        return new Response(
          `<html><body><h1>Owned widget fixture</h1>
          <div class="cf-turnstile"><input type="hidden" name="cf-turnstile-response"></div>
          <p id="status">waiting</p><script>
            const widget = document.querySelector('.cf-turnstile');
            const field = widget.querySelector('input');
            window.turnstile = {
              getResponse() {
                if (!widget.isConnected || !field.isConnected) throw new Error('Could not find widget');
                return field.value;
              },
              remove() { widget.remove(); }
            };
            setTimeout(() => {
              const mode = ${JSON.stringify(mode)};
              field.value = mode === 'empty' ? '' : mode === 'short' ? 'invalid' : 'owned-turnstile-token';
              if (mode === 'reset') field.value = '';
              if (mode === 'input') field.remove();
              else if (mode !== 'keep') turnstile.remove();
              document.querySelector('#status').textContent = field.value.length > 10 ? 'solved' : 'cancelled';
            }, ${delay});
          </script></body></html>`,
          { headers: { "content-type": "text/html" } },
        )
      },
    })
    browser = await launchAnubisBrowser()
    const context = await browser.newContext()
    const page = await context.newPage()
    const userAgent = await page.evaluate(() => navigator.userAgent)
    await page.close()
    handle = {
      id: 1,
      lease: 1,
      headful: false,
      browser,
      context,
      fingerprint: { userAgent, platform: "Linux x86_64", locale: "en-US", timezone: "UTC" },
    }
    deps = {
      minTier: 3,
      acquireBrowser: async () => handle,
      releaseBrowser() {},
      loadSession: (domain) => cache.load(domain),
      saveSession: (domain, data) => cache.save(domain, data),
      invalidateSession: (domain) => cache.invalidate(domain),
    }
    api = createApi()
  }, 120000)

  afterAll(async () => {
    await browser?.close()
    server?.stop(true)
    cache.close()
    metrics.close()
  })

  test.each(["remove", "input", "keep"])(
    "recognizes a verified token when the widget uses %s",
    async (mode) => {
      const context = await browser.newContext()
      try {
        const page = await context.newPage()
        await page.goto(target(mode), { waitUntil: "domcontentloaded" })
        const start = Date.now()
        expect(await solvePageCaptchas(page as unknown as Parameters<typeof solvePageCaptchas>[0], 2500)).toEqual({
          attempted: ["turnstile"],
          solved: ["turnstile"],
        })
        expect(Date.now() - start).toBeLessThan(2000)
        expect(await page.locator("#status").textContent()).toBe("solved")
        expect(await page.locator('[name="cf-turnstile-response"]').count()).toBe(mode === "keep" ? 1 : 0)
      } finally {
        await context.close()
      }
    },
    10000,
  )

  test.each(["empty", "short", "reset"])(
    "does not treat removal with a %s token as success",
    async (mode) => {
      const context = await browser.newContext()
      try {
        const page = await context.newPage()
        await page.goto(target(mode), { waitUntil: "domcontentloaded" })
        expect(await solvePageCaptchas(page as unknown as Parameters<typeof solvePageCaptchas>[0], 1100)).toEqual({
          attempted: ["turnstile"],
          solved: [],
        })
        expect(await page.locator("#status").textContent()).toBe("cancelled")
      } finally {
        await context.close()
      }
    },
    10000,
  )

  test("cancels widget solving without reporting a token", async () => {
    const context = await browser.newContext()
    try {
      const page = await context.newPage()
      await page.goto(target("remove", 2000), { waitUntil: "domcontentloaded" })
      const start = Date.now()
      const result = await solvePageCaptchas(
        page as unknown as Parameters<typeof solvePageCaptchas>[0],
        5000,
        AbortSignal.timeout(150),
      )
      expect(result.solved).toEqual([])
      expect(Date.now() - start).toBeLessThan(1500)
      expect(await page.locator("#status").textContent()).toBe("waiting")
    } finally {
      await context.close()
    }
  }, 10000)

  for (const route of ["/scrape", "/v1"]) {
    test.each([2, 3] as const)(
      `${route} returns content after self-removal in Tier %s`,
      async (tier) => {
        deps.minTier = tier
        await cache.save("127.0.0.1", { cookies: [], userAgent: handle.fingerprint.userAgent, savedAt: Date.now() })
        const start = Date.now()
        const response = await api.handle(
          new Request(`http://localhost${route}`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              url: target("remove", 1200),
              cmd: "request.get",
              skipHttp: true,
              solveEmbeddedCaptchas: true,
              maxTier: tier,
              maxTimeout: 8000,
            }),
          }),
        )
        const body = await response.json()
        expect(response.status, JSON.stringify(body)).toBe(200)
        if (route === "/scrape") {
          expect(body.captchasSolved).toEqual(["turnstile"])
          expect(body.tier).toBe(tier)
        }
        expect(route === "/scrape" ? body.html : body.solution.response).toContain('id="status">solved</p>')
        expect(Date.now() - start).toBeLessThan(5000)
        expect(browser.contexts()).toHaveLength(1)
      },
      15000,
    )
  }
})
