import {
  allBenchmarks,
  formatDuration,
  formatMemory,
  matchedRequestCount,
  resourceBenchmarks,
} from "../apps/web/app/utils/benchmarks"
import measurements from "../apps/web/public/benchmarks/latest.json"

const lines = [
  "# Cloudflare interstitial page-access comparison",
  "",
  `Measured ${measurements.method.date} UTC. [Method and reproduction](README.md). [Numeric source](../apps/web/public/benchmarks/latest.json).`,
  "",
  "All three tools use the same request workload on sites observed serving Cloudflare interstitials. Other challenge families and standalone CAPTCHA widgets are outside this comparison.",
  "",
  "Best times below are observed minima of verified responses. First and repeat statistics are separate.",
  "",
  "The default workload measures page delivery after access challenges, not optional form-token completion.",
  "",
  "## Per-site timings",
  "",
  "| Site | Tool | Verified | Best first | First median | Best repeat | Repeat median | Best verified CPU |",
  "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |",
]
for (const site of allBenchmarks) {
  for (const result of site.results) {
    lines.push(
      `| ${site.name} | ${result.name} | ${result.verified}/${result.total} | ${formatDuration(result.firstBestMs)} | ${formatDuration(result.firstMedianMs)} | ${formatDuration(result.repeatBestMs)} | ${formatDuration(result.repeatMedianMs)} | ${formatDuration(result.bestCpuSeconds === null ? null : result.bestCpuSeconds * 1000)} |`,
    )
  }
}
lines.push(
  "",
  "Named-session rows are supplementary workloads for the respective tools. Session creation is outside request timings; it is included in the numeric source. These rows are not part of the default resource totals below.",
  "",
  "## Default workload resources",
  "",
  "| Tool | Verified | All CPU, including failures | Matched CPU | Peak working RAM | Peak total memory | OOM |",
  "| --- | ---: | ---: | ---: | ---: | ---: | ---: |",
)
for (const result of resourceBenchmarks) {
  lines.push(
    `| ${result.name} | ${result.verified}/${result.total} | ${result.cpuSeconds.toFixed(2)}s | ${result.matchedCpuSeconds.toFixed(2)}s | ${formatMemory(result.peakWorkingBytes)} | ${formatMemory(result.peakTotalBytes)} | ${result.oomKills} |`,
  )
}
lines.push(
  "",
  `Matched CPU covers ${matchedRequestCount} identical target/round/attempt keys verified by all three tools, not identical challenges. Full CPU totals include failures, which can have different costs.`,
  "",
  "TRAWL includes Redis. Memory is the maximum sum of per-request application and Redis sampled peaks; peaks may not be simultaneous. Working memory excludes inactive file cache. Best CPU, best latency and memory peaks can come from different requests and must not be described as one simultaneous result.",
  "",
  "## Image identities",
  "",
)
for (const [name, image] of Object.entries(measurements.products)) {
  lines.push(`- ${name}: ${image.reference}; image ID ${image.imageId}.`)
}
lines.push(
  "",
  "The selected TRAWL build contains local changes after v1.8.0. It is not the published v1.8.0 image. Results vary across host load, networks, IPs, fingerprints and challenges. The recorded sample does not establish a universal bypass success rate.",
)
console.log(lines.join("\n"))
