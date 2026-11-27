import { expect, test } from "bun:test"
import type { BrowserHandle } from "@trawl/browser"
import type { TierResult } from "@trawl/types"
import { type OrchestratorDeps, scrape } from "../src/orchestrator"
import { ProxyPool } from "../src/utils/proxyRotator"

const wall = '<html><title>Just a moment...</title><body id="challenge-form">Checking your browser</body></html>'
const content = `<html><body><article>${"Owned destination content. ".repeat(20)}</article></body></html>`

function fixture() {
  let closed = 0
  let released = 0
  const attempts: TierResult[] = []
  const page = {
    setDefaultTimeout() {},
    on() {},
    off() {},
    goto: async () => undefined,
    title: async () => "Just a moment...",
    content: async () => wall,
    url: () => "https://fixture.example/",
    frames: () => [],
    waitForLoadState: async () => {},
    evaluate: async () => "fixture-agent",
    context: () => context,
    keyboard: { press: async () => {} },
  }
  const context = {
    addInitScript: async () => {},
    cookies: async () => [],
    newPage: async () => page,
    close: async () => {
      closed++
    },
  }
  const handle: BrowserHandle = {
    id: 1,
    lease: 1,
    headful: false,
    browser: { newContext: async () => context },
    context,
    fingerprint: { userAgent: "fixture-agent", platform: "Linux x86_64", locale: "en-US", timezone: "UTC" },
  }
  const deps: OrchestratorDeps = {
    minTier: 3,
    acquireBrowser: async () => handle,
    releaseBrowser() {
      released++
    },
    loadSession: async () => undefined,
    saveSession: async () => {},
    invalidateSession: async () => {},
    residentialProxyPool: new ProxyPool(["http://residential.example:8080"]),
    onTierAttempt: (attempt) => attempts.push(attempt),
  }
  return { deps, page, attempts, closed: () => closed, released: () => released }
}

test("a stalled Cloudflare solve leaves time for a configured residential fallback", async () => {
  const site = fixture()
  let fallbackRemaining = 0
  const result = await scrape({ url: "https://fixture.example/", maxTimeout: 1800 }, site.deps, {
    tier4: async (_url, _handle, timeout) => {
      expect(site.closed()).toBe(1)
      fallbackRemaining = timeout
      await Bun.sleep(50)
      return { tier: 4, status: "success", durationMs: 50, html: content }
    },
  })
  expect(result.tier).toBe(4)
  expect(result.html).toBe(content)
  expect(fallbackRemaining).toBeGreaterThan(100)
  expect(site.attempts.map(({ tier, status }) => ({ tier, status }))).toEqual([
    { tier: 3, status: "timeout" },
    { tier: 4, status: "success" },
  ])
  expect(site.released()).toBe(1)
}, 5000)

test.each(["maxTier", "unconfigured", "cooldown", "explicit"])(
  "does not reserve fallback time when residential escalation is %s",
  async (mode) => {
    const site = fixture()
    if (mode === "unconfigured") site.deps.residentialProxyPool = undefined
    if (mode === "cooldown") site.deps.residentialProxyPool?.markBad("http://residential.example:8080")
    await scrape(
      {
        url: "https://fixture.example/",
        maxTier: mode === "maxTier" ? 3 : 4,
        maxTimeout: 1000,
        proxy: mode === "explicit" ? "socks5://explicit.example:1080" : undefined,
      },
      site.deps,
      {
        tier3: async (...args) => {
          expect(args[9]?.cloudflareDeadline).toBeUndefined()
          return { tier: 3, status: "success", durationMs: 1, html: content }
        },
      },
    )
  },
)

test("datacenter retries share one cutoff and leave the residential selection untouched", async () => {
  const site = fixture()
  site.deps.proxyPool = new ProxyPool(["http://dc1.example:8080", "http://dc2.example:8080"])
  site.deps.residentialProxyPool = new ProxyPool(
    ["http://residential.example:8080", "http://other.example:8080"],
    "roundrobin",
  )
  const deadlines: (number | undefined)[] = []
  await scrape({ url: "https://fixture.example/", maxTimeout: 120000 }, site.deps, {
    tier3: async (...args) => {
      deadlines.push(args[9]?.cloudflareDeadline)
      await Bun.sleep(5)
      return { tier: 3, status: "blocked", reason: "proxy-ip-blocked", durationMs: 5 }
    },
    tier4: async (...args) => {
      expect(args[3]).toBe("http://residential.example:8080")
      expect(args[9]?.cloudflareDeadline).toBeUndefined()
      expect((deadlines[0] ?? 0) - Date.now()).toBeGreaterThan(85000)
      expect((deadlines[0] ?? 0) - Date.now()).toBeLessThanOrEqual(90000)
      return { tier: 4, status: "success", durationMs: 1, html: content }
    },
  })
  expect(deadlines).toHaveLength(2)
  expect(deadlines[0]).toBeDefined()
  expect(deadlines[1]).toBe(deadlines[0])
})

test("ordinary page readiness retains its full budget with residential fallback configured", async () => {
  const site = fixture()
  site.page.title = async () => "Article"
  site.page.content = async () => content
  const result = await scrape({ url: "https://fixture.example/", maxTimeout: 1800 }, site.deps)
  expect(result.tier).toBe(3)
  expect(result.html).toBe(content)
  expect(site.released()).toBe(1)
}, 5000)
