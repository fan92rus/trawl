import measurements from "../../public/benchmarks/latest.json"

export type Product = "trawl" | "flaresolverr" | "byparr"
export type TimingMetric = "repeatBestMs" | "repeatMedianMs" | "firstMedianMs"

export interface BenchmarkRequest {
  product: Product
  round: number
  mode: string
  site: string
  attempt: number
  clientMs: number
  verified: boolean
  destinationVerified?: boolean
  cpuSeconds: number
  oomKills: number
  redisCpuSeconds?: number
  redisPeakWorking?: number
  redisPeakMemory?: number
  widgets?: { turnstileFields: number; turnstileTokens: number }
  peak: { working: number; memory: number }
}

interface BenchmarkBatch {
  completed: boolean
  method: { date: string; rounds: number }
  sites: { id: string; name: string; protection: string; url: string }[]
  requests: BenchmarkRequest[]
}

export const productNames: Record<Product, string> = {
  trawl: "TRAWL economy",
  flaresolverr: "FlareSolverr 3.5.2",
  byparr: "Byparr 3.0.4",
}
const products = Object.keys(productNames) as Product[]
const batch = measurements as BenchmarkBatch

export function median(values: number[]): number | null {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? (sorted[middle] ?? null) : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
}

function minimum(values: number[]) {
  return values.length ? Math.min(...values) : null
}

export function summarizeTimings(
  requests: BenchmarkRequest[],
  accept: (request: BenchmarkRequest) => boolean = () => true,
) {
  const verified = requests.filter((request) => request.verified && accept(request))
  const first = verified.filter((request) => request.attempt === 1).map((request) => request.clientMs)
  const repeats = verified.filter((request) => request.attempt > 1).map((request) => request.clientMs)
  return {
    firstBestMs: minimum(first),
    repeatBestMs: minimum(repeats),
    firstMedianMs: median(first),
    repeatMedianMs: median(repeats),
    bestCpuSeconds: minimum(verified.map((request) => request.cpuSeconds + (request.redisCpuSeconds ?? 0))),
    verified: verified.length,
    total: requests.length,
  }
}

export function formatDuration(ms: number | null) {
  if (ms === null) return "not verified"
  return ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`
}

export function formatMemory(bytes: number) {
  return `${Math.round(bytes / 1024 ** 2)} MiB`
}

if (!batch.completed) throw new Error("Benchmark dataset is incomplete")
export const benchmarkDate = batch.method.date
export const benchmarkSiteCount = batch.sites.length
const defaultRequests = batch.requests.filter((request) => request.mode === "default")

function compareProducts(requests: BenchmarkRequest[], accept?: (request: BenchmarkRequest) => boolean) {
  return products.map((product) => ({
    product,
    name: productNames[product],
    ...summarizeTimings(
      requests.filter((request) => request.product === product),
      accept,
    ),
  }))
}

export const allBenchmarks = batch.sites.map((site) => {
  const results = compareProducts(defaultRequests.filter((request) => request.site === site.id))
  const sessions = products.flatMap((product) => {
    const requests = batch.requests.filter(
      (request) => request.site === site.id && request.mode === "session" && request.product === product,
    )
    return requests.length
      ? [{ product: `${product}-session`, name: `${productNames[product]} + session`, ...summarizeTimings(requests) }]
      : []
  })
  const trawl = results[0]
  if (!trawl) throw new Error("Missing TRAWL benchmark")
  return {
    ...site,
    timingComparable: results.every((result) => result.verified > 0),
    firstMs: trawl.firstBestMs,
    repeatMs: trawl.repeatBestMs,
    firstMedianMs: trawl.firstMedianMs,
    repeatMedianMs: trawl.repeatMedianMs,
    results: [...results, ...sessions],
  }
})

export const featuredBenchmarks = ["cloudflare-demo", "1337x", "eztv"].map((id) => {
  const site = allBenchmarks.find((entry) => entry.id === id)
  if (!site) throw new Error(`Missing featured benchmark: ${id}`)
  return site
})
const bestPublicRepeatMs = minimum(
  featuredBenchmarks.flatMap((site) => (site.repeatMs === null ? [] : [site.repeatMs])),
)
const cloudflareSite = featuredBenchmarks.find((site) => site.repeatMs === bestPublicRepeatMs)
if (!cloudflareSite) throw new Error("Missing Cloudflare repeat benchmark")
export const cloudflareRepeatBenchmark = cloudflareSite
const speedupSite = allBenchmarks.find((site) => site.id === "1337x")
const flaresolverrRepeat = speedupSite?.results.find((result) => result.product === "flaresolverr")?.repeatMedianMs
export const repeatSpeedup =
  flaresolverrRepeat && speedupSite?.repeatMedianMs
    ? (Math.floor((flaresolverrRepeat / speedupSite.repeatMedianMs) * 10) / 10).toFixed(1)
    : null

const key = (request: BenchmarkRequest) => `${request.round}/${request.site}/${request.attempt}`
const verifiedKeys = products.map(
  (product) => new Set(defaultRequests.filter((request) => request.product === product && request.verified).map(key)),
)
export const matchedRequestCount = [...(verifiedKeys[0] ?? [])].filter((entry) =>
  verifiedKeys.every((keys) => keys.has(entry)),
).length

export const resourceBenchmarks = products.map((product) => {
  const requests = defaultRequests.filter((request) => request.product === product)
  const matched = requests.filter((request) => verifiedKeys.every((keys) => keys.has(key(request))))
  return {
    product,
    name: productNames[product],
    verified: requests.filter((request) => request.verified).length,
    total: requests.length,
    matchedCpuSeconds: matched.reduce((sum, request) => sum + request.cpuSeconds + (request.redisCpuSeconds ?? 0), 0),
    cpuSeconds: requests.reduce((sum, request) => sum + request.cpuSeconds + (request.redisCpuSeconds ?? 0), 0),
    peakWorkingBytes: Math.max(...requests.map((request) => request.peak.working + (request.redisPeakWorking ?? 0))),
    peakTotalBytes: Math.max(...requests.map((request) => request.peak.memory + (request.redisPeakMemory ?? 0))),
    oomKills: requests.reduce((sum, request) => sum + request.oomKills, 0),
  }
})
