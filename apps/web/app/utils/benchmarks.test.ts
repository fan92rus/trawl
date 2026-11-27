import { expect, test } from "bun:test"
import measurements from "../../public/benchmarks/latest.json"
import {
  allBenchmarks,
  type BenchmarkRequest,
  cloudflareRepeatBenchmark,
  featuredBenchmarks,
  formatDuration,
  median,
  summarizeTimings,
} from "./benchmarks"

const request = (clientMs: number, verified: boolean, attempt: number): BenchmarkRequest => ({
  product: "trawl",
  round: 1,
  mode: "default",
  site: "test",
  attempt,
  clientMs,
  verified,
  cpuSeconds: clientMs / 1000,
  oomKills: 0,
  peak: { working: 100, memory: 200 },
})

test("a fast failed response cannot improve advertised timings", () => {
  const summary = summarizeTimings([request(1, false, 2), request(2000, true, 1), request(300, true, 2)])
  expect(summary.firstBestMs).toBe(2000)
  expect(summary.repeatBestMs).toBe(300)
  expect(summary.repeatMedianMs).toBe(300)
  expect(summary.bestCpuSeconds).toBe(0.3)
  expect(summary.verified).toBe(2)
  expect(summary.total).toBe(3)
})

test("unverified sites have no invented zero latency", () => {
  const summary = summarizeTimings([request(20, false, 1)])
  expect(summary.firstBestMs).toBeNull()
  expect(summary.repeatBestMs).toBeNull()
  expect(formatDuration(summary.firstBestMs)).toBe("not verified")
  expect(median([90, 10, 30, 20])).toBe(25)
})

test("fast page access without a token cannot improve widget-completion timings", () => {
  const ready = { ...request(2500, true, 2), widgets: { turnstileFields: 1, turnstileTokens: 1 } }
  const empty = { ...request(200, true, 2), widgets: { turnstileFields: 1, turnstileTokens: 0 } }
  const summary = summarizeTimings([empty, ready], (row) => (row.widgets?.turnstileTokens ?? 0) > 0)
  expect(summary.repeatBestMs).toBe(2500)
  expect(summary.verified).toBe(1)
  expect(summary.total).toBe(2)
})

test("highlights distinguish protected repeat latency from coverage and preserve the full comparison", () => {
  expect(cloudflareRepeatBenchmark.protection).toBe("Cloudflare")
  expect(featuredBenchmarks.map((site) => site.id)).toEqual(["cloudflare-demo", "1337x", "eztv"])
  for (const site of featuredBenchmarks.filter((site) => !site.timingComparable)) {
    expect(site.results[0]?.verified).toBeGreaterThan(0)
    for (const competitor of site.results.slice(1)) {
      if (competitor.verified === 0) expect(competitor.repeatBestMs).toBeNull()
    }
  }
  const sessionSite = allBenchmarks.find((site) => site.id === "cloudflare-demo")
  for (const product of ["trawl", "flaresolverr"]) {
    const rows = measurements.requests.filter(
      (row) => row.product === product && row.site === sessionSite?.id && row.mode === "session",
    )
    if (rows.length) {
      const session = sessionSite?.results.find((result) => result.product === `${product}-session`)
      expect(session?.total).toBe(rows.length)
    }
  }
  expect(allBenchmarks.every((site) => site.protection === "Cloudflare")).toBe(true)
  for (const id of ["nowsecure", "anubis-kernel", "sourceware", "http-control"]) {
    expect(allBenchmarks.some((site) => site.id === id)).toBe(false)
  }
})

test("published data contains a complete workload for every compared product", () => {
  expect(measurements.completed).toBe(true)
  for (const product of ["trawl", "flaresolverr", "byparr"]) {
    const rows = measurements.requests.filter((row) => row.product === product && row.mode === "default")
    expect(rows).toHaveLength(measurements.method.rounds * measurements.sites.length * 3)
    expect(new Set(rows.map((row) => `${row.round}/${row.site}/${row.attempt}`)).size).toBe(rows.length)
    for (const row of rows) {
      expect(row.clientMs).toBeGreaterThan(0)
      expect(row.cpuSeconds).toBeGreaterThanOrEqual(0)
      expect(row.peak.working).toBeGreaterThan(0)
      expect(row.peak.memory).toBeGreaterThanOrEqual(row.peak.working)
      if (row.verified) expect(row.destinationVerified).toBe(true)
    }
  }
})
