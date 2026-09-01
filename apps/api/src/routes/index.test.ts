import { describe, expect, test } from "bun:test"
import { indexRoute } from "./index"

// Prowlarr's FlareSolverr proxy validation pings {host}/ping (FlareSolverr
// answers the plain text "Pong"); without it Prowlarr cannot save TRAWL as a
// FlareSolverr proxy (Prowlarr Test() → request.get on {host}/ping).
describe("GET /ping", () => {
  test("answers FlareSolverr-style Pong", async () => {
    const response = await indexRoute().handle(new Request("http://localhost/ping"))

    expect(response.status).toBe(200)
    expect(await response.text()).toBe("Pong")
  })
})
