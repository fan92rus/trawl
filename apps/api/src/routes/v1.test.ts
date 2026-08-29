import { describe, expect, test } from "bun:test"
import { type OrchestratorDeps, ScrapeError } from "@trawl/tiers"
import { v1Route } from "./v1"

describe("POST /v1", () => {
  test("returns a FlareSolverr error envelope when an explicit proxy fails", async () => {
    const app = v1Route({
      poolReady: () => true,
      orchestratorDeps: () => ({}) as OrchestratorDeps,
      runScrape: async () => {
        throw new ScrapeError("All tiers exhausted. Last failure: proxy-connection-failed", [
          { tier: 1, status: "error", durationMs: 1, reason: "proxy-connection-failed" },
        ])
      },
    })

    const response = await app.handle(
      new Request("http://localhost/v1", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          cmd: "request.get",
          url: "https://target.example",
          proxy: "http://proxy.example:8080",
        }),
      }),
    )

    expect(response.status).toBe(500)
    expect(await response.json()).toMatchObject({
      status: "error",
      message: "All tiers exhausted. Last failure: proxy-connection-failed",
      solution: { url: "https://target.example", status: 0, response: "" },
    })
  })
})
