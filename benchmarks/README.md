# Cloudflare interstitial benchmarks

[Results](RESULTS.md) · [Measurements](../apps/web/public/benchmarks/latest.json) · [Performance guide](../apps/docs/getting-started/performance.md)

The website and generated report use one dataset, `apps/web/public/benchmarks/latest.json`.
It records the 2026-10-17 comparison of the development build after v1.8.0, FlareSolverr and
Byparr. Image identities and source-verification metadata identify the build at measurement time.

Best values are the fastest verified responses in this sample. The report also includes
medians, failures, resource costs and supplementary named-session results. Failed requests
never count as fast successful responses. A tool with no verified response has no timing.

## Workload

- Three URLs: NopeCHA's Cloudflare demo, 1337x and EZTV, observed serving Cloudflare interstitials.
- Two rounds in reverse tool order. Each round sends one first request and two repeats per URL.
- The default workload uses the same `/v1` `request.get` payload without a named session.
- TRAWL's domain cache is cleared before each target. Its browser is already warm, so a first
  request measures an empty clearance cache, not container or browser startup.
- Supplementary TRAWL and FlareSolverr runs use named sessions on the first two targets.
  Session creation is measured separately; these requests are outside the default resource totals.

These are page-access tests on protected sites. A browser visit or repeat HTTP request may be
accepted directly, so every recorded request is not necessarily a fresh challenge solve.
Standalone CAPTCHA widgets and other protection providers are outside this comparison.

## Verification

The collector checks expected content, final hostname/path, API and document status, and the
absence of recognized challenge walls. Status 200 alone is insufficient: FlareSolverr
synthesizes document status 200. NopeCHA can redirect `/demo/cloudflare` to `/demo`; both paths
are accepted explicitly. Other targets must match their requested path.

The workload requires page content after access challenges clear. It does not require an
optional embedded form token. TRAWL's `/v1` adapter uses that page-delivery behavior by default;
native `/scrape` and MCP `scrape` can opt into it with `solveEmbeddedCaptchas: false`.
Detected blocking challenges still require resolution. An unverified widget is never reported
in `captchasSolved`.

## Configuration and session reuse

TRAWL uses one warm browser, no headful pool, ad blocking disabled, content-process preference
1 and reported hardware concurrency 4, with Redis caching, MCP and the dashboard enabled.
These are the selected economy settings, not the untouched application defaults. FlareSolverr
and Byparr use their published defaults. Full settings are recorded in the dataset and runner.

TRAWL tries eligible saved clearance and the browser's User-Agent over HTTP before using its
browser tiers. Rejected clearance, detected JavaScript shells or CAPTCHA widgets fall back
to the browser. Each request still fetches the target; response bodies are not cached.
See [Session Cache](../apps/docs/architecture/session-cache.md) for origin, cookie, TLS and proxy rules.

Named sessions retain browser state. FlareSolverr keeps its Chrome driver and page, while
TRAWL retains an isolated context and storage but closes request pages. They do not use
TRAWL's automatic HTTP clearance path. Their separate timings show the cost of each workflow.

## Resources and timing

Applications run sequentially on the same ARM64 machine and egress, without an application
memory cap or CPU quota, with 1 GiB shared-memory capacity. Payloads request `maxTimeout: 30000`.
Client timing includes API overhead, browser startup performed during the request, solving and
response transfer. Application startup is outside the measurements. A tool's own timeout can
exclude setup or cleanup that still contributes to client time.

A separate observer samples cgroup CPU, memory and process counts every 250 ms. Observer costs
are outside the application. TRAWL's Redis is sampled separately and included in its CPU and
memory summaries. The memory sum combines application and Redis peaks within each request
window; peaks need not be simultaneous. Working memory subtracts inactive file cache. Total
memory includes it. Neither is process RSS.

Matched CPU comparisons use only target/round/attempt keys verified by all three tools.
Full-workload CPU includes failed work; memory peaks cover the entire default workload.
Supplementary named-session resources are separate. Best CPU, fastest response and memory
peaks can belong to different requests.

Challenge difficulty, fingerprints, IP reputation, network and host load vary. Best times are
not typical latency or guarantees. Zero observed OOM kills does not establish memory safety
for arbitrary pages. Docker image size is stored separately from runtime RAM.

## Reproduce

Use native ARM64 Docker images. The runner pins FlareSolverr and Byparr image digests;
pull the references at the top of `run.py`, then build TRAWL from the repository root:

```bash
docker build -f apps/api/Dockerfile -t trawl:benchmark .
python3 benchmarks/run.py --trawl-image trawl:benchmark --rounds 2 --timeout-ms 30000 --session-products trawl flaresolverr --output /tmp/trawl-comparison-new
```

Check the collector's content/destination gates with `python3 benchmarks/verify_test.py`.

The output directory must not exist. Private runtime logs and observer samples stay outside
Git. `results.json` contains numeric measurements, public URLs, verification results and image
metadata. Provider HTML, cookies and tokens must not be published.

`--targets` selects another target file; `--products` selects tools for a focused check.
Sessions cover the first two targets. Keep configurations, targets, timeouts and workload
sizes equal when comparing resource usage or latency.

After reviewing a complete campaign, replace the current dataset and regenerate the report:

```bash
cp /tmp/trawl-comparison-new/results.json apps/web/public/benchmarks/latest.json
bun run benchmarks/report.ts > benchmarks/RESULTS.md
```

The runner removes only its own containers and network. It checks existing TRAWL and Prowlarr
startup identities before and after the campaign and does not reconfigure them.
