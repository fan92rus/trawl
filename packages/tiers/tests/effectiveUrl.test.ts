import { afterAll, describe, expect, test } from "bun:test"
import type { OrchestratorDeps } from "../src/orchestrator"
import { scrape } from "../src/orchestrator"
import { runTier1 } from "../src/tiers/1"

const server = Bun.serve({
  port: 0,
  fetch(request) {
    const url = new URL(request.url)
    if (url.pathname === "/start") {
      return Response.redirect(new URL("/final?ok=1", url), 302)
    }
    return new Response("<html><body>final response</body></html>", {
      headers: { "Content-Type": "text/html" },
    })
  },
})

afterAll(() => server.stop(true))

const baseUrl = `http://127.0.0.1:${server.port}`
const unusedBrowserDeps: OrchestratorDeps = {
  acquireBrowser: async () => {
    throw new Error("Tier 1 success should not acquire a browser")
  },
  releaseBrowser: () => {},
  loadSession: async () => undefined,
  saveSession: async () => {},
  invalidateSession: async () => {},
}

describe("effective URL reporting", () => {
  test("Tier 1 and the orchestrator report the final URL after a redirect", async () => {
    const requestedUrl = `${baseUrl}/start`
    const finalUrl = `${baseUrl}/final?ok=1`

    const tierResult = await runTier1(requestedUrl)
    expect(tierResult.status).toBe("success")
    expect(tierResult.effectiveUrl).toBe(finalUrl)

    const result = await scrape({ url: requestedUrl }, unusedBrowserDeps)
    expect(result.url).toBe(finalUrl)
  })

  test("a request without a redirect retains its requested URL", async () => {
    const requestedUrl = `${baseUrl}/final?ok=1`

    const result = await scrape({ url: requestedUrl }, unusedBrowserDeps)
    expect(result.url).toBe(requestedUrl)
  })
})
