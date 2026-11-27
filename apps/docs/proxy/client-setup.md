---
title: Proxy Client Setup
description: Configure curl, browsers, Prowlarr, JDownloader, and system-wide proxy settings.
---

# Client setup

Install the [TRAWL root CA](/proxy/ca-installation) before enabling HTTPS proxying. Configure both
the HTTP and HTTPS proxy address as `http://<trawl-host>:8192`; the proxy endpoint itself uses
plain HTTP, including for HTTPS `CONNECT`.

## curl

```bash
curl --proxy http://127.0.0.1:8192 https://example.com/
```

Before installing the CA system-wide, point curl at it explicitly:

```bash
curl --proxy http://127.0.0.1:8192 \
  --cacert ./trawl-ca.crt \
  https://example.com/
```

Use verbose output to see `CONNECT`, certificate validation, response headers, and redirects:

```bash
curl -v --proxy http://127.0.0.1:8192 https://example.com/
```

## Browser or operating-system proxy

Set:

```text
HTTP proxy:  <trawl-host>:8192
HTTPS proxy: <trawl-host>:8192
```

Do not configure TRAWL as a SOCKS proxy. Install the CA in every trust store used by the browser.
Some Firefox profiles use their own NSS store even when the operating-system store is configured.

Using TRAWL system-wide sends sensitive application traffic through a TLS-terminating service.
Prefer per-application or per-domain proxy rules when possible.

## Prowlarr

For indexers that support FlareSolverr, the normal `/v1` integration remains the simplest option.
Use the forward proxy when the indexer performs its own follow-up fetch and the solved cookie is not
portable.

1. Open **Settings → Indexer Proxies**.
2. Add an **HTTP** proxy.
3. Set the host to the TRAWL hostname and port to `8192`.
4. Assign a tag if only selected indexers should use the proxy.
5. Add that tag to the intended indexers.

The Prowlarr host or container must trust the TRAWL CA. Prowlarr is a .NET application; install the
CA into its operating-system or container trust store.

## Jackett

Jackett normally uses TRAWL through its FlareSolverr-compatible API. If a tracker plugin permits a
general HTTP proxy and needs connection-bound clearance, configure `<trawl-host>:8192` there and
install the CA in Jackett's host/container trust store.

## JDownloader

1. Import the CA into JDownloader's bundled Java trust store.
2. Open **Settings → Connection Manager**.
3. Add an HTTP proxy using the TRAWL host and port `8192`.
4. Restart JDownloader after changing its Java trust store.

TRAWL forwards normal downloads, Range requests, redirects, and binary responses. Challenge
escalation is designed primarily for navigation/document requests. On a challenged request with a
binary upload body, the browser fallback is not byte-transparent because `/scrape` accepts a text
body.

## changedetection.io and other services

Use `http://<trawl-host>:8192` as the service's HTTP and HTTPS proxy and add the CA to its container
trust store. Environment variable conventions differ, but many command-line applications support:

```ini
HTTP_PROXY=http://trawl:8192
HTTPS_PROXY=http://trawl:8192
NO_PROXY=localhost,127.0.0.1,trawl
```

Avoid setting these globally inside the TRAWL container itself; that can create a proxy loop.

## Troubleshooting

| Symptom                                                  | Likely cause                                                                             |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `CERTIFICATE_VERIFY_FAILED`, `PKIX path building failed` | The application does not trust TRAWL's root CA                                           |
| `400 Bad Request`                                        | Invalid proxy request framing, URL, method, or `Content-Length`                          |
| Challenge HTML is returned                               | Challenge was not recognized, solving failed, or the response was intentionally streamed |
| A small website downloads slowly                         | Host is cached as challenged and is entering the browser tiers                           |
| Range request returns `200`                              | The destination ignored `Range`; TRAWL does not synthesize partial responses             |
| WebSocket handshake is rejected                          | The direct handshake lacked required cookies or authorization                            |
| Proxy works in curl but not the application              | The application uses a separate trust store or ignores system proxy settings             |

Enable `MITM_DEBUG=true`, reproduce one request, and inspect the TRAWL logs to see whether it
used Tier 0, streaming, or the scrape fallback.
