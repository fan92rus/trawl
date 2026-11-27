---
title: "*arr Apps"
description: Connect Sonarr, Radarr, Lidarr, Readarr and other *arr apps via Prowlarr or Jackett.
---

# *arr Apps

Sonarr, Radarr, Lidarr, and Readarr do not talk to FlareSolverr directly. They go through
**Prowlarr** (recommended) or **Jackett** as an indexer proxy. Configure TRAWL once in the indexer
manager and the connected *arr apps can use its challenge handling.

## Recommended setup

```
Sonarr / Radarr / Lidarr / Readarr
         │
         ▼
      Prowlarr  ← configure TRAWL here
         │
         ▼
      TRAWL
```

Configure TRAWL in Prowlarr following the [Prowlarr guide](/integrations/prowlarr), then add Prowlarr as an indexer source in each *arr app normally. No TRAWL configuration is needed in the *arr apps themselves.

## Sonarr

1. **Settings → Indexers → Add Indexer → Prowlarr**
2. Enter your Prowlarr URL and API key
3. Click **Test** then **Save**

Sonarr will now route all indexer searches through Prowlarr, which uses TRAWL for any Cloudflare-protected trackers.

## Radarr

Same steps as Sonarr. **Settings → Indexers → Add → Prowlarr**.

## Lidarr

Same pattern. Lidarr supports Prowlarr natively since v1.3.

## Readarr

Same pattern. **Settings → Indexers → Add → Prowlarr**.

## Bazarr

Bazarr uses subtitle providers, not torrent indexers, so it does not use FlareSolverr at all. No TRAWL configuration needed.

## Performance expectations

| Request type                                 | Expected path                              |
| -------------------------------------------- | ------------------------------------------ |
| Unprotected response                         | Tier 1, no browser                         |
| Recognized WAF challenge                     | Tier 3 fresh browser solve                 |
| Repeat request with an accepted session      | Tier 2 cached browser session              |
| Direct/datacenter path rejected              | Tier 4, when a residential proxy is set    |

The session cache TTL is configurable via `REDIS_SESSION_TTL_SECONDS` (default 1 hour). Actual latency
depends on the indexer, challenge variant, IP reputation, and whether its saved session remains valid.
