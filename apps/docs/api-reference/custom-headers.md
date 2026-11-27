---
title: Custom Headers
description: Pass custom HTTP headers through TRAWL to the target URL across all execution tiers.
---

# Custom Headers

Both `/v1` and `/scrape` accept an optional `headers` object. Allowed headers are forwarded to the
target URL across all four execution tiers.

## Usage

**`/v1` (FlareSolverr-compat)**

```json
{
  "url": "https://example.com",
  "headers": {
    "Authorization": "Bearer my-token",
    "Referer": "https://parent-site.com"
  }
}
```

**`/scrape` (native API)**

```json
{
  "url": "https://example.com",
  "headers": {
    "X-API-Key": "secret",
    "Origin": "https://trusted-site.com"
  }
}
```

Custom headers are merged after browser defaults. Security-sensitive routing and fingerprint headers
are removed at the public API boundary rather than overridden.

## API header policy

The JSON APIs accept application headers such as `Accept`, `Cache-Control`, `Content-Type`,
`Origin`, `Referer`, `Range`, validators, and custom API-key headers. They intentionally discard:

- `Authorization`, `Cookie`, `Proxy-Authorization`, and `User-Agent`;
- `Host`, `Content-Length`, connection/framing headers, and forwarding headers;
- browser-controlled `Sec-Fetch-*`, `Sec-CH-UA-*`, and Cloudflare routing headers.

If an integration needs transparent forwarding of authentication cookies, authorization, or its own
user agent, use the [HTTP/HTTPS proxy](/proxy/overview). Its trusted proxy path preserves end-to-end
headers and strips only hop-by-hop connection headers.

## How headers are applied per tier

| Tier                                      | Mechanism                           | Scope                            |
| ----------------------------------------- | ----------------------------------- | -------------------------------- |
| **Tier 1** - plain HTTP fetch             | Case-insensitive default overrides | All requests (there is only one) |
| **Tier 2** - cached browser session       | `page.route(url, ...)` interception | Main document request only       |
| **Tier 3** - fresh challenge solve        | `page.route(url, ...)` interception | Main document request only       |
| **Tier 4** - residential proxy escalation | `page.route(url, ...)` interception | Main document request only       |

Tier 1 honors the caller's `Accept-Encoding` instead of adding its browser defaults to it.
The forward proxy retains the negotiated encoding and original response bytes. An explicit empty
`Accept-Encoding` requests an unencoded response; omitting the header retains the browser defaults.

For browser tiers, route interception is scoped to the **exact target URL**. Subresources (JS, CSS,
images, fonts, third-party CDNs) and provider challenge endpoints are not given the caller's custom
headers.

## Challenge + custom headers flow

When a page requires both challenge bypass and custom headers, the sequence is:

```
1. page.goto(url) - route fires, custom headers added to initial request
2. The WAF serves a challenge interstitial
3. Provider scripts run on their own endpoints without caller headers
4. The browser completes the supported challenge flow and returns to the target
5. route fires again → custom headers applied to the real page load ✓
```

## Common use cases

| Use case                               | Header                             |
| -------------------------------------- | ---------------------------------- |
| Embed-only / iframe-restricted content | `Referer: https://parent-site.com` |
| CORS-restricted endpoints              | `Origin: https://allowed-site.com` |
| Custom API keys                        | `X-API-Key: <key>`                 |
| Conditional or partial requests        | `If-None-Match`, `Range`           |

::: warning Authentication headers
`Authorization`, `Cookie`, and caller-controlled `User-Agent` values are not accepted by `/v1` or
`/scrape`. Configure TRAWL as a forward proxy when those headers must pass through unchanged.
:::
