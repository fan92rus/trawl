import { describe, expect, test } from "bun:test"
import type { BrowserHandle } from "@trawl/browser"
import { type OrchestratorDeps, ProxyPool, ScrapeError, scrape } from "../src"

const browserHandle = (): BrowserHandle => ({
  id: 1,
  lease: 1,
  headful: false,
  context: {},
  browser: {},
  fingerprint: { userAgent: "browser-agent", platform: "Linux x86_64", locale: "en-US", timezone: "UTC" },
})

const dependencies = (overrides: Partial<OrchestratorDeps>): OrchestratorDeps => ({
  acquireBrowser: async () => browserHandle(),
  releaseBrowser: () => {},
  loadSession: async () => undefined,
  saveSession: async () => {},
  invalidateSession: async () => {},
  ...overrides,
})

describe("scrape proxy selection", () => {
  test("round-robins Tier 3 proxies between requests to the same domain", async () => {
    const proxies: Array<string | undefined> = []
    const deps = dependencies({
      minTier: 3,
      proxyPool: new ProxyPool(["http://p1:8080", "http://p2:8080"], "roundrobin"),
    })
    const runners = {
      tier3: async (_url: string, _handle: BrowserHandle, _timeout: number, proxy?: string) => {
        proxies.push(proxy)
        return { tier: 3 as const, status: "success" as const, durationMs: 1, html: "<html>ok</html>" }
      },
    }

    await scrape({ url: "https://example.test", maxTier: 3 }, deps, runners)
    await scrape({ url: "https://example.test", maxTier: 3 }, deps, runners)

    expect(proxies).toEqual(["http://p1:8080", "http://p2:8080"])
  })

  test("round-robins Tier 4 proxies between requests to the same domain", async () => {
    const proxies: string[] = []
    const deps = dependencies({
      minTier: 4,
      residentialProxyPool: new ProxyPool(["http://r1:8080", "http://r2:8080"], "roundrobin"),
    })
    const runners = {
      tier4: async (_url: string, _handle: BrowserHandle, _timeout: number, proxy: string) => {
        proxies.push(proxy)
        return { tier: 4 as const, status: "success" as const, durationMs: 1, html: "<html>ok</html>" }
      },
    }

    await scrape({ url: "https://example.test" }, deps, runners)
    await scrape({ url: "https://example.test" }, deps, runners)

    expect(proxies).toEqual(["http://r1:8080", "http://r2:8080"])
  })

  test("retries a blocked proxy once with the next healthy endpoint", async () => {
    const proxies: Array<string | undefined> = []
    const deps = dependencies({
      minTier: 3,
      proxyPool: new ProxyPool(["http://p1:8080", "http://p2:8080", "http://p3:8080"], "roundrobin"),
    })

    const failure = await scrape({ url: "https://example.test", maxTier: 3 }, deps, {
      tier3: async (_url, _handle, _timeout, proxy) => {
        proxies.push(proxy)
        return { tier: 3, status: "blocked", durationMs: 1, reason: "proxy-ip-blocked" }
      },
    }).catch((error: unknown) => error)

    expect(failure).toBeInstanceOf(ScrapeError)
    expect(proxies).toEqual(["http://p1:8080", "http://p2:8080"])
  })
})
