import { describe, expect, test } from "bun:test"
import type { PoolStats } from "@trawl/types"
import { statsRoute } from "./stats"

const stats = (overrides: Partial<PoolStats> = {}): PoolStats => ({
  total: 1,
  busy: 0,
  available: 1,
  restarts: 0,
  avgRestarts: 0,
  stalled: 0,
  live: 1,
  queueDepth: 0,
  ...overrides,
})

describe("GET /stats", () => {
  test("reports the optional headful pool additively", async () => {
    const response = await statsRoute(
      () => stats({ total: 3, available: 2, busy: 1 }),
      () => stats({ total: 1, restarts: 2 }),
    ).handle(new Request("http://localhost/stats"))

    expect(await response.json()).toEqual({
      browsers: 3,
      available: 2,
      busy: 1,
      stalled: 0,
      live: 1,
      restarts: 0,
      queueDepth: 0,
      headful: { browsers: 1, available: 1, busy: 0, stalled: 0, live: 1, restarts: 2 },
    })
  })

  test("uses null when headful capacity is disabled", async () => {
    const response = await statsRoute(
      () => stats(),
      () => undefined,
    ).handle(new Request("http://localhost/stats"))
    expect((await response.json()).headful).toBeNull()
  })
})
