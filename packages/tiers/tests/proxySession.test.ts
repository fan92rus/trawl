import { describe, expect, test } from "bun:test"
import type { BrowserHandle } from "@trawl/browser"
import type { Cookie, SessionData } from "@trawl/types"
import { type OrchestratorDeps, scrape } from "../src/orchestrator"
import type { runTier2 } from "../src/tiers/2"
import { ProxyPool } from "../src/utils/proxyRotator"

const url = "https://fixture.example/"
const proxy = "http://fixture-user:fixture-password@proxy.example:8080"
const cookie: Cookie = {
  name: "cf_clearance",
  value: "owned-fixture-clearance",
  domain: "fixture.example",
  path: "/",
  expires: -1,
  httpOnly: true,
  secure: true,
}
const handle: BrowserHandle = {
  id: 1,
  lease: 1,
  headful: false,
  context: {},
  browser: {},
  fingerprint: { userAgent: "fixture-agent", platform: "Linux x86_64", locale: "en-US", timezone: "UTC" },
}
const success = {
  status: "success" as const,
  durationMs: 1,
  html: "<html><body>Owned content</body></html>",
  cookies: [cookie],
  userAgent: "fixture-agent",
}

function fixture() {
  const cache = new Map<string, SessionData>()
  const deps: OrchestratorDeps = {
    acquireBrowser: async () => handle,
    releaseBrowser() {},
    loadSession: async (domain) => cache.get(domain),
    saveSession: async (domain, data) => {
      cache.set(domain, structuredClone(data))
    },
    invalidateSession: async (domain) => {
      cache.delete(domain)
    },
  }
  return { deps, cache }
}

describe("configured proxy session reuse", () => {
  test.each([3, 4] as const)("retains the Tier %s proxy across cached requests and cookie rotation", async (tier) => {
    const { deps, cache } = fixture()
    if (tier === 3) deps.proxyPool = new ProxyPool([proxy, "http://other-proxy.example:8080"], "roundrobin")
    else deps.residentialProxyPool = new ProxyPool([proxy])
    const first = await scrape({ url, skipHttp: true, maxTier: tier }, deps, {
      tier3: async () => (tier === 3 ? { ...success, tier: 3 } : { tier: 3, status: "blocked", durationMs: 1 }),
      tier4: async () => ({ ...success, tier: 4 }),
    })
    expect(first.proxyUsed).toBe(true)
    const routes: unknown[] = []
    const runners = {
      tier2: async (...args: Parameters<typeof runTier2>) => {
        routes.push(args[10])
        return { ...success, tier: 2 as const, cookies: [{ ...cookie, value: "rotated" }] }
      },
    }
    const second = await scrape({ url, skipHttp: true, maxTier: 2 }, deps, runners)
    const third = await scrape({ url, skipHttp: true, maxTier: 2 }, deps, runners)
    expect(routes).toEqual([proxy, proxy])
    expect(second).toMatchObject({ tier: 2, sessionCached: true, proxyUsed: true, userAgent: "fixture-agent" })
    expect(third.proxyUsed).toBe(true)
    expect(cache.get("fixture.example")?.cookies[0]?.value).toBe("rotated")
    expect(cache.get("fixture.example")?.httpOrigin).toBeUndefined()
    expect(JSON.stringify(cache.get("fixture.example"))).not.toContain("fixture-password")
    if (tier === 3) expect(deps.proxyPool?.next("fixture.example")).toBe("http://other-proxy.example:8080")
  })

  test.each(["removed", "credentials changed", "cooldown"])(
    "does not reuse cookies when the proxy is %s",
    async (change) => {
      const { deps } = fixture()
      deps.proxyPool = new ProxyPool([proxy])
      await scrape({ url, skipHttp: true, maxTier: 3 }, deps, {
        tier3: async () => ({ ...success, tier: 3 }),
      })
      if (change === "removed") deps.proxyPool = undefined
      else if (change === "credentials changed")
        deps.proxyPool = new ProxyPool([proxy.replace("fixture-password", "new-password")])
      else deps.proxyPool.markBad(proxy)

      let replayed = false
      const result = await scrape({ url, skipHttp: true, maxTier: 3 }, deps, {
        tier2: async () => {
          replayed = true
          return { ...success, tier: 2 }
        },
        tier3: async () => ({ ...success, tier: 3 }),
      })
      expect(replayed).toBe(false)
      expect(result.tier).toBe(3)
    },
  )
})
