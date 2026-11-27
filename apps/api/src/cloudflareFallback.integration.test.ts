import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { type BrowserHandle, MemorySessionCache } from "@trawl/browser"
import { type OrchestratorDeps, ProxyPool } from "@trawl/tiers"
import type { TierResult } from "@trawl/types"
import { Elysia } from "elysia"
import { launchAnubisBrowser } from "../../../packages/browser/tests/helpers/anubisBrowser"
import { MetricsStore } from "./metrics"
import { scrapeRoute } from "./routes/scrape"
import { v1Route } from "./routes/v1"

describe.skipIf(process.env.TRAWL_CLOUDFLARE_FALLBACK_TESTS !== "1")("Cloudflare residential fallback", () => {
  let browser: Awaited<ReturnType<typeof launchAnubisBrowser>>
  let origin: ReturnType<typeof Bun.serve>
  let datacenter: ReturnType<typeof Bun.serve>
  let residential: ReturnType<typeof Bun.serve>
  let deps: OrchestratorDeps
  let app: ReturnType<typeof createApp>
  const cache = new MemorySessionCache({ ttlSeconds: 60 })
  const metrics = new MetricsStore()
  const attempts: TierResult[] = []
  const requests: { egress: string; cookie: string }[] = []
  const createApp = () =>
    new Elysia()
      .use(
        scrapeRoute(
          () => deps,
          () => true,
          metrics,
        ),
      )
      .use(v1Route({ orchestratorDeps: () => deps, poolReady: () => true, metricsStore: metrics }))

  beforeAll(async () => {
    origin = Bun.serve({
      hostname: "0.0.0.0",
      port: 0,
      fetch(request) {
        const path = new URL(request.url).pathname
        const egress = request.headers.get("x-owned-egress") ?? "direct"
        const cookie = request.headers.get("cookie") ?? ""
        requests.push({ egress, cookie })
        if (egress === "residential" && cookie.includes("cf_clearance=residential")) {
          return new Response(
            `<html><title>Owned destination</title><body><h1>Residential destination content</h1><p>${"Complete results. ".repeat(30)}</p></body></html>`,
            { headers: { "content-type": "text/html" } },
          )
        }
        if (egress === "datacenter" && path === "/stalled" && cookie.includes("cf_clearance=datacenter")) {
          return new Response(
            new ReadableStream({
              start(controller) {
                controller.enqueue(new TextEncoder().encode("<html><title>Just a moment...</title>"))
              },
            }),
            { headers: { "content-type": "text/html", "cf-mitigated": "challenge" } },
          )
        }
        return new Response(
          `<html><title>Just a moment...</title><body id="challenge-form">Checking your browser<script>
          ${egress === "residential" ? "document.cookie='cf_clearance=residential; Path=/';location.reload()" : path === "/no-clearance" ? "" : "document.cookie='cf_clearance=datacenter; Path=/'"}
          </script></body></html>`,
          { headers: { "content-type": "text/html", "cf-mitigated": "challenge" } },
        )
      },
    })
    const proxy = (egress: string) =>
      Bun.serve({
        hostname: "127.0.0.1",
        port: 0,
        fetch(request) {
          const target = new URL(request.url)
          if (target.hostname !== "cloudflare-fallback.invalid")
            return new Response("Unexpected target", { status: 502 })
          target.hostname = "127.0.0.1"
          const headers = new Headers(request.headers)
          headers.delete("host")
          headers.set("x-owned-egress", egress)
          return fetch(target, { headers, signal: request.signal, redirect: "manual", decompress: false })
        },
      })
    datacenter = proxy("datacenter")
    residential = proxy("residential")
    browser = await launchAnubisBrowser()
    const handle: BrowserHandle = {
      id: 1,
      lease: 1,
      headful: false,
      browser,
      context: await browser.newContext(),
      fingerprint: { userAgent: "fixture-agent", platform: "Linux x86_64", locale: "en-US", timezone: "UTC" },
    }
    deps = {
      minTier: 3,
      acquireBrowser: async () => handle,
      releaseBrowser() {},
      loadSession: (domain) => cache.load(domain),
      saveSession: (domain, data) => cache.save(domain, data),
      invalidateSession: (domain) => cache.invalidate(domain),
      onTierAttempt: (attempt) => attempts.push(attempt),
    }
    app = createApp()
  }, 120000)

  afterAll(async () => {
    await browser?.close()
    datacenter?.stop(true)
    residential?.stop(true)
    origin?.stop(true)
    cache.close()
    metrics.close()
  })

  for (const [route, path, timeout, expected] of [
    ["/scrape", "/no-clearance", 9000, "timeout"],
    ["/v1", "/no-clearance", 9000, "timeout"],
    ["/scrape", "/persistent", 20000, "blocked"],
    ["/scrape", "/stalled", 9000, "timeout"],
  ] as const) {
    test(`${route} preserves residential fallback after ${path}`, async () => {
      deps.proxyPool = new ProxyPool([`http://127.0.0.1:${datacenter.port}`])
      deps.residentialProxyPool = new ProxyPool([`http://127.0.0.1:${residential.port}`])
      attempts.length = 0
      requests.length = 0
      const start = Date.now()
      const response = await app.handle(
        new Request(`http://localhost${route}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            url: `http://cloudflare-fallback.invalid:${origin.port}${path}`,
            cmd: "request.get",
            maxTimeout: timeout,
            solveEmbeddedCaptchas: false,
          }),
        }),
      )
      const body = await response.json()
      expect(response.status, JSON.stringify(body)).toBe(200)
      expect(route === "/scrape" ? body.html : body.solution.response).toContain("Residential destination content")
      expect(attempts.map(({ tier, status }) => ({ tier, status }))).toEqual([
        { tier: 3, status: expected },
        { tier: 4, status: "success" },
      ])
      expect(Date.now() - start).toBeLessThan(timeout)
      expect(requests.some(({ egress }) => egress === "datacenter")).toBe(true)
      expect(requests.some(({ egress }) => egress === "residential")).toBe(true)
      expect(
        requests.filter(({ egress }) => egress === "residential").every(({ cookie }) => !cookie.includes("datacenter")),
      ).toBe(true)
      expect(browser.contexts()).toHaveLength(1)
    }, 30000)
  }
})
