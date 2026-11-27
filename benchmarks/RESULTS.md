# Cloudflare interstitial page-access comparison

Measured 2026-10-17 UTC. [Method and reproduction](README.md). [Numeric source](../apps/web/public/benchmarks/latest.json).

All three tools use the same request workload on sites observed serving Cloudflare interstitials. Other challenge families and standalone CAPTCHA widgets are outside this comparison.

Best times below are observed minima of verified responses. First and repeat statistics are separate.

The default workload measures page delivery after access challenges, not optional form-token completion.

## Per-site timings

| Site                        | Tool                         | Verified | Best first | First median | Best repeat | Repeat median | Best verified CPU |
| --------------------------- | ---------------------------- | -------: | ---------: | -----------: | ----------: | ------------: | ----------------: |
| nopecha.com/demo/cloudflare | TRAWL economy                |      6/6 |       6.0s |         7.9s |       879ms |          1.2s |              57ms |
| nopecha.com/demo/cloudflare | FlareSolverr 3.5.2           |      5/6 |      11.7s |        11.7s |       12.3s |         12.7s |              8.1s |
| nopecha.com/demo/cloudflare | Byparr 3.0.4                 |      6/6 |      37.6s |        40.7s |       18.5s |         22.6s |             28.0s |
| nopecha.com/demo/cloudflare | TRAWL economy + session      |      6/6 |       5.1s |         5.8s |        1.9s |          2.2s |             954ms |
| nopecha.com/demo/cloudflare | FlareSolverr 3.5.2 + session |      6/6 |      12.5s |        13.2s |       715ms |         961ms |             772ms |
| 1337x.to                    | TRAWL economy                |      6/6 |       3.8s |         4.3s |        85ms |         141ms |              28ms |
| 1337x.to                    | FlareSolverr 3.5.2           |      6/6 |      11.1s |        12.1s |       11.0s |         11.2s |              6.8s |
| 1337x.to                    | Byparr 3.0.4                 |      6/6 |      12.6s |        18.1s |       11.3s |         20.7s |             24.9s |
| 1337x.to                    | TRAWL economy + session      |      6/6 |       3.9s |         4.2s |        1.2s |          1.2s |             489ms |
| 1337x.to                    | FlareSolverr 3.5.2 + session |      6/6 |      10.7s |        11.2s |       187ms |         329ms |             229ms |
| eztvx.to/home               | TRAWL economy                |      6/6 |       4.6s |         5.0s |       473ms |         651ms |              62ms |
| eztvx.to/home               | FlareSolverr 3.5.2           |      6/6 |      11.2s |        11.2s |       11.2s |         11.3s |              5.9s |
| eztvx.to/home               | Byparr 3.0.4                 |      6/6 |      14.6s |        16.5s |        9.7s |         16.8s |             17.8s |

Named-session rows are supplementary workloads for the respective tools. Session creation is outside request timings; it is included in the numeric source. These rows are not part of the default resource totals below.

## Default workload resources

| Tool               | Verified | All CPU, including failures | Matched CPU | Peak working RAM | Peak total memory |  OOM |
| ------------------ | -------: | --------------------------: | ----------: | ---------------: | ----------------: | ---: |
| TRAWL economy      |    18/18 |                      27.12s |      19.23s |          991 MiB |          1291 MiB |    0 |
| FlareSolverr 3.5.2 |    17/18 |                     193.55s |     145.00s |         1059 MiB |          1198 MiB |    0 |
| Byparr 3.0.4       |    18/18 |                     722.37s |     668.74s |         1620 MiB |          1863 MiB |    0 |

Matched CPU covers 17 identical target/round/attempt keys verified by all three tools, not identical challenges. Full CPU totals include failures, which can have different costs.

TRAWL includes Redis. Memory is the maximum sum of per-request application and Redis sampled peaks; peaks may not be simultaneous. Working memory excludes inactive file cache. Best CPU, best latency and memory peaks can come from different requests and must not be described as one simultaneous result.

## Image identities

- trawl: trawl:page-access-anubis-20261017; image ID sha256:9c5c25209e7e6e7379ea66c71a96b19f73b94625db51a97e41abd3a2f1af27b2.
- flaresolverr: ghcr.io/flaresolverr/flaresolverr@sha256:91c0774e7d634f8b55a69d5027fa13a7fcad9b59b420efb286364fc8236634f1; image ID sha256:91c0774e7d634f8b55a69d5027fa13a7fcad9b59b420efb286364fc8236634f1.
- byparr: ghcr.io/thephaseless/byparr@sha256:deee7a375152218eadd4ee571ce2073e1a7cc2d320f3492947b1cd9d87c4f0d4; image ID sha256:deee7a375152218eadd4ee571ce2073e1a7cc2d320f3492947b1cd9d87c4f0d4.

The selected TRAWL build contains local changes after v1.8.0. It is not the published v1.8.0 image. Results vary across host load, networks, IPs, fingerprints and challenges. The recorded sample does not establish a universal bypass success rate.
