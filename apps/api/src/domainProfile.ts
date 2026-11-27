import type { ScrapeRequest, TierResult } from "@trawl/types"

const TTL_MS = 30 * 60 * 1000
const MAX_ENTRIES = 1_000
const TIER1_SKIP_STREAK = 2
const entries = new Map<string, { lastSeen: number; tier1NeedsJsStreak: number }>()

function keyFor(req: ScrapeRequest): string | undefined {
  if (
    (req.method && req.method !== "GET") ||
    req.skipHttp !== undefined ||
    req.maxTier === 1 ||
    req.proxy ||
    req.body !== undefined ||
    req.sessionId ||
    req.ignoreCertificateErrors ||
    req.cookies?.length ||
    (req.headers && Object.keys(req.headers).length > 0)
  )
    return
  try {
    const url = new URL(req.url)
    url.hash = ""
    return url.href
  } catch {
    return
  }
}

function entryFor(key: string) {
  const entry = entries.get(key)
  if (entry && Date.now() - entry.lastSeen <= TTL_MS) return entry
  entries.delete(key)
}

export function applyDomainProfile(req: ScrapeRequest): ScrapeRequest {
  const key = keyFor(req)
  const entry = key ? entryFor(key) : undefined
  return entry && entry.tier1NeedsJsStreak >= TIER1_SKIP_STREAK ? { ...req, skipHttp: true } : req
}

export function refreshDomainProfile(
  req: ScrapeRequest,
  timings: TierResult[],
  opts: { resultTier?: number; failure?: boolean; sessionCached?: boolean },
): void {
  const key = keyFor(req)
  if (!key) return
  const tier1 = timings.find((t) => t.tier === 1)
  const contentNeedsBrowser =
    tier1?.status === "needs-js" &&
    (tier1.reason === "javascript-shell" || tier1.reason === "session-content-needs-browser")
  // Retry HTTP after failure, a fresh solve, or an outcome that breaks the streak.
  if (opts.failure || (!opts.sessionCached && (opts.resultTier ?? 0) >= 2) || (tier1 && !contentNeedsBrowser)) {
    entries.delete(key)
    return
  }
  if (!contentNeedsBrowser) return
  const streak = (entryFor(key)?.tier1NeedsJsStreak ?? 0) + 1
  entries.delete(key)
  const oldest = entries.keys().next().value
  if (entries.size >= MAX_ENTRIES && oldest !== undefined) entries.delete(oldest)
  entries.set(key, { lastSeen: Date.now(), tier1NeedsJsStreak: streak })
}
