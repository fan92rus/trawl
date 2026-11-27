import { afterEach, describe, expect, test } from "bun:test"
import { runTier1 } from "../src/tiers/1"

let server: ReturnType<typeof Bun.serve> | undefined

afterEach(() => server?.stop(true))

describe("Tier 1 outbound policy", () => {
  test("validates every redirect before contacting the next target", async () => {
    let privateTargetHits = 0
    server = Bun.serve({
      port: 0,
      fetch(request) {
        if (new URL(request.url).pathname === "/private") {
          privateTargetHits++
          return new Response("should not be reached")
        }
        return Response.redirect(new URL("/private", request.url), 302)
      },
    })
    const startUrl = `http://127.0.0.1:${server.port}/start`
    const result = await runTier1(startUrl, undefined, undefined, undefined, undefined, async (url) => {
      if (new URL(url).pathname === "/private") throw new Error("private redirect blocked")
    })

    expect(result).toMatchObject({ tier: 1, status: "error", reason: "private redirect blocked" })
    expect(privateTargetHits).toBe(0)
  })
})
