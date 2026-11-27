---
title: Architecture Overview
description: How TRAWL's API, forward proxy, browser pool, session cache, and tiered challenge engine fit together.
---

# Architecture Overview

```
Client (Prowlarr, MCP client, curl, your code)
           │
      ┌────┴───────────────┐
      ▼                    ▼
 Elysia API          HTTP/HTTPS proxy :8192
 POST /v1            Tier 0 direct forwarding
 POST /scrape        + challenge detection
 POST /mcp
 GET /health                │ detected wall
      └──────────────┬──────┘
                     ▼
      Orchestrator (packages/tiers)
    ┌──────────────────────────────────────┐
    │    ├── Tier 1: HTTP + clearance reuse │
    │    ├── Tier 2: cached session + pool │
    │    ├── Tier 3: fresh solve + pool    │
    │    └── Tier 4: residential proxy     │
    └──────────────┬───────────────────────┘
          ┌────────┴──────────┐
          ▼                   ▼
   BrowserPool          SessionCache
   (packages/browser)   (packages/browser)
          │                   │
          ▼                   ▼
     Camoufox            Redis or memory
     Firefox N×
```

## Components

### API (`apps/api`)

An Elysia HTTP server. Accepts scrape requests and calls the orchestrator inline - all browser work happens in the same process. Exposes `/` for a FlareSolverr-style readiness message, plus `/health` and `/stats` for monitoring. Routes live under `apps/api/src/routes/`, with shared config/pool state in `config.ts`/`deps.ts`.

### Forward Proxy (`apps/api/src/proxy`)

An optional general HTTP/HTTPS proxy on port `8192`. Ordinary requests use direct TCP/TLS forwarding, preserving methods, bodies, authentication headers, redirects, WebSocket upgrades, binary content, and HTTP Range semantics. Small textual responses are buffered for challenge detection; media and large files can stream directly. When a response is identified as a challenge wall, the proxy sends the request through the same four-tier orchestrator used by `/scrape`.

HTTPS inspection requires clients to trust TRAWL's generated root CA. See [Proxy overview](/proxy/overview) and [CA installation](/proxy/ca-installation).

### Browser Pool (`packages/browser/src/pool.ts`)

Maintains warm browser instances using [Camoufox](https://github.com/daijro/camoufox) (Firefox with fingerprint patching at the C++/Juggler level). Acquisition prefers a browser that last served the same hostname. Fresh solves use temporary contexts; named sessions retain isolated contexts and storage. Automatic clearance reuse is managed separately by the session cache.

### Session Cache (`packages/browser/src/session.ts`)

Stores cookies, browser User-Agent, save time, optional proxy identity and direct-origin provenance in Redis or a bounded in-memory backend, keyed by hostname (`session:v2:example.com`). Successful eligible browser requests populate or refresh the entry when cookies are available. Tier 1 can reuse valid direct Cloudflare or supported Anubis clearance over HTTP; Tier 2 can inject cached cookies into the browser when HTTP is unsuitable or rejected. Proxy-bound sessions retain their original configured proxy in an isolated temporary context.

The configurable TTL defaults to one hour and does not extend cookie expiry. Named sessions and imported login cookies do not populate the shared cache. See [Session Cache](/architecture/session-cache) for eligibility and fallback rules.

Redis is optional: single-process deployments can select `SESSION_CACHE_DRIVER=memory`. With the default Redis driver, an empty or unset `REDIS_URL` disables shared session caching. Ordinary HTTP still runs; blocked requests need a fresh browser solve.

### Tiers (`packages/tiers`)

The escalation logic, provider-specific detection and browser solving flows. Detected access challenges must resolve before content is returned. Embedded form-widget attempts are controlled separately by `solveEmbeddedCaptchas`: native and MCP scraping default to attempts, while `/v1` defaults to page delivery. See [Tiered Execution](/architecture/tiered-execution) for supported flows and [Performance & Benchmarks](/getting-started/performance) for measured behavior.
