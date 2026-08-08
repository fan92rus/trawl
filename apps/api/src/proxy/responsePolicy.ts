import { encodeCp1251 } from "@trawl/tiers"
import type { ScrapeResult } from "@trawl/types"

export interface ProxyBufferedResponse {
  body: Buffer
  contentType: string
  headers: Record<string, string>
}

const TRANSFORMED_BODY_HEADERS = new Set([
  "content-encoding",
  "content-length",
  "content-md5",
  "content-range",
  "accept-ranges",
  "etag",
  "transfer-encoding",
])

function isHtml(contentType: string): boolean {
  const base = contentType.split(";", 1)[0]?.trim().toLowerCase()
  return base === "text/html" || base === "application/xhtml+xml"
}

// Some indexers (Prowlarr's RuTracker parser) decode responses as windows-1251
// regardless of upstream charset. When the browser renders a cp1251 page, TRAWL
// hands it back as a UTF-8 JS string — sending those bytes makes the parser see
// mojibake. `cp1251Hosts` (set membership checked by hostname) opts specific
// domains into re-encoding the rendered HTML to windows-1251.
export function responseFromScrapeResult(
  result: ScrapeResult,
  cp1251Hosts?: ReadonlySet<string>,
): ProxyBufferedResponse {
  const contentType = result.contentType ?? result.responseHeaders?.["content-type"] ?? "text/html; charset=utf-8"
  const useRenderedHtml = isHtml(contentType) && result.html.length > 0

  let body: Buffer
  let bodyIsCp1251 = false
  if (useRenderedHtml) {
    // If this domain is opted into cp1251, re-encode the rendered HTML (currently
    // a UTF-8 JS string) to windows-1251 bytes so the client decodes it correctly.
    const host = resultUrlHost(result.url)
    if (cp1251Hosts && host && cp1251Hosts.has(host.toLowerCase())) {
      body = Buffer.from(encodeCp1251(result.html))
      bodyIsCp1251 = true
    } else {
      body = Buffer.from(result.html, "utf8")
    }
  } else {
    body = result.body ? Buffer.from(result.body) : Buffer.from(result.html, "utf8")
  }

  const headers: Record<string, string> = {}
  for (const [name, value] of Object.entries(result.responseHeaders ?? {})) {
    const lower = name.toLowerCase()
    if (useRenderedHtml && TRANSFORMED_BODY_HEADERS.has(lower)) continue
    headers[lower] = value
  }
  // Reflect the actual body encoding in the Content-Type header.
  headers["content-type"] = bodyIsCp1251 ? contentType.replace(/charset=[^;\s]+/i, "charset=windows-1251") : contentType

  return { body, contentType: headers["content-type"], headers }
}

function resultUrlHost(url: string): string | undefined {
  try {
    return new URL(url).hostname
  } catch {
    return undefined
  }
}
