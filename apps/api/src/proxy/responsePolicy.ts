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

  // Decide whether to use the browser-rendered DOM (result.html) or the raw HTTP
  // response body (result.body). The rendered DOM is normally richer (JS-executed),
  // but right after a Cloudflare challenge solve on a cold browser context the DOM
  // can still be empty/incomplete (e.g. 1.6 KB) even though the server sent the
  // full 250 KB page. In that case the raw body is far more complete and reliable.
  const bodyBytes = result.body ?? null
  const bodyLen = bodyBytes ? bodyBytes.byteLength : 0
  const htmlLen = result.html.length
  const renderedLooksIncomplete = bodyLen > 0 && htmlLen > 0 && htmlLen < bodyLen * 0.2 && htmlLen < 10_000
  const useRenderedHtml = isHtml(contentType) && htmlLen > 0 && !renderedLooksIncomplete

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
  } else if (bodyBytes) {
    // Use the raw HTTP response body as-is. It is already in the server's native
    // encoding (e.g. windows-1251 for rutracker.org), so NO re-encoding is needed —
    // but we must report the correct charset so the client decodes it properly.
    body = Buffer.from(bodyBytes)
  } else {
    body = Buffer.from(result.html, "utf8")
  }

  const headers: Record<string, string> = {}
  for (const [name, value] of Object.entries(result.responseHeaders ?? {})) {
    const lower = name.toLowerCase()
    // When we replace the response body with a re-rendered DOM, the original
    // transport-level headers (content-encoding, content-length, etag, …) no
    // longer describe what we actually send, so strip them. In all other paths
    // (raw HTTP body or utf-8 fallback) the original headers stay valid.
    if (useRenderedHtml && TRANSFORMED_BODY_HEADERS.has(lower)) continue
    headers[lower] = value
  }
  headers["content-type"] = bodyIsCp1251
    ? contentType.replace(/charset=[^;\s]+/i, "charset=windows-1251")
    : contentType

  return { body, contentType: headers["content-type"], headers }
}

function resultUrlHost(url: string): string | undefined {
  try {
    return new URL(url).hostname
  } catch {
    return undefined
  }
}
