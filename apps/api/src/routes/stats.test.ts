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
      () => stats({ total: 3, available: 2, busy: 1, queueDepth: 2, longestBusyMs: 4200 }),
      () => stats({ total: 1, restarts: 2 }),
    ).handle(new Request("http://localhost/stats"))

    expect(await response.json()).toEqual({
      browsers: 3,
      available: 2,
      busy: 1,
      stalled: 0,
      live: 1,
      restarts: 0,
      queueDepth: 2,
      longestBusyMs: 4200,
      draining: false,
      headful: {
        browsers: 1,
        available: 1,
        busy: 0,
        stalled: 0,
        live: 1,
        restarts: 2,
        queueDepth: 0,
        longestBusyMs: 0,
        draining: false,
      },
    })
  })

  test("uses null when headful capacity is disabled", async () => {
    const response = await statsRoute(
      () => stats(),
      () => undefined,
    ).handle(new Request("http://localhost/stats"))
    expect((await response.json()).headful).toBeNull()
  })

  test("reports a pool draining for shutdown", async () => {
    const response = await statsRoute(
      () => stats({ draining: true }),
      () => stats({ draining: true }),
    ).handle(new Request("http://localhost/stats"))
    const body = await response.json()
    expect(body.draining).toBeTrue()
    expect(body.headful.draining).toBeTrue()
  })
})
