// Universal charset-aware text decoding for HTTP response bodies.
//
// Bun ships without full ICU, so TextDecoder only supports UTF-8/16/32 —
// legacy charsets (windows-1251, windows-1252, latin1) throw RangeError.
// We sniff the charset the way browsers do and decode with small manual
// tables where needed. Unsupported charsets (koi8-r, gbk, shift_jis, …)
// fall back to lossy UTF-8 — same behaviour as before this module existed.
//
// Used by tier1 (plain fetch): browser tiers (2/3/4) get correct text from
// page.content() because the browser engine decodes per Content-Type/meta.

import { decodeCp1251 } from "./cp1251"

// windows-1252 slots 0x80-0x9F that differ from Latin-1. Everything else is
// byte-identity with Latin-1. 0x81/0x8D/0x8F/0x90/0x9D are unassigned → U+FFFD.
const WIN1252_OVERRIDES: Map<number, number> = new Map([
  [0x80, 0x20ac], // €
  [0x82, 0x201a], // ‚
  [0x83, 0x0192], // ƒ
  [0x84, 0x201e], // „
  [0x85, 0x2026], // …
  [0x86, 0x2020], // †
  [0x87, 0x2021], // ‡
  [0x88, 0x02c6], // ˆ
  [0x89, 0x2030], // ‰
  [0x8a, 0x0160], // Š
  [0x8b, 0x2039], // ‹
  [0x8c, 0x0152], // Œ
  [0x8e, 0x017d], // Ž
  [0x91, 0x2018], // '
  [0x92, 0x2019], // '
  [0x93, 0x201c], // "
  [0x94, 0x201d], // "
  [0x95, 0x2022], // •
  [0x96, 0x2013], // –
  [0x97, 0x2014], // —
  [0x98, 0x02dc], // ˜
  [0x99, 0x2122], // ™
  [0x9a, 0x0161], // š
  [0x9b, 0x203a], // ›
  [0x9c, 0x0153], // œ
  [0x9e, 0x017e], // ž
  [0x9f, 0x0178], // Ÿ
])

export function decodeWindows1252(bytes: Uint8Array): string {
  let out = ""
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i]
    const override = WIN1252_OVERRIDES.get(b)
    if (override !== undefined) out += String.fromCharCode(override)
    else if (b === 0x81 || b === 0x8d || b === 0x8f || b === 0x90 || b === 0x9d) out += "\uFFFD"
    else out += String.fromCharCode(b) // Latin-1 identity for 0x00-0xFF
  }
  return out
}

export function decodeLatin1(bytes: Uint8Array): string {
  let out = ""
  for (let i = 0; i < bytes.length; i++) out += String.fromCharCode(bytes[i])
  return out
}

// Extract charset=... from a Content-Type header value, lowercased and
// normalized, or null when absent/unknown-form.
export function charsetFromContentType(contentType?: string): string | null {
  if (!contentType) return null
  const match = /charset\s*=\s*"?([A-Za-z0-9_\-.:]+)"?/i.exec(contentType)
  if (!match) return null
  return normalizeCharset(match[1])
}

function normalizeCharset(raw: string): string {
  const name = raw.trim().toLowerCase().replace(/^["']|["']$/g, "")
  switch (name) {
    case "utf8":
    case "utf-8":
    case "us-ascii":
    case "ascii":
      return "utf-8"
    case "utf-16le":
    case "utf16le":
      return "utf-16le"
    case "utf-16be":
    case "utf16be":
      return "utf-16be"
    case "utf-16":
      return "utf-16le" // BOM decides endianness; assume LE like browsers do
    case "windows-1251":
    case "cp1251":
    case "cp-1251":
    case "ansi-1251":
    case "ansi_1251":
    case "x-cp1251":
      return "windows-1251"
    case "windows-1252":
    case "cp1252":
    case "cp-1252":
      return "windows-1252"
    case "iso-8859-1":
    case "iso8859-1":
    case "latin1":
    case "latin-1":
    case "l1":
      return "iso-8859-1"
    default:
      return name
  }
}

// Sniff charset the way browsers do, in priority order:
// 1. BOM (utf-8/utf-16le/utf-16be)
// 2. charset= from the Content-Type header
// 3. <meta charset=...> / <meta http-equiv="content-type" content="...charset=...">
//    in the first 2 KiB (lossy UTF-8 preview is safe: the markup around the
//    charset name is ASCII)
// 4. utf-8 fallback
export function sniffCharset(bytes: Uint8Array, contentType?: string): string {
  if (bytes.length >= 2) {
    if (bytes[0] === 0xff && bytes[1] === 0xfe) return "utf-16le"
    if (bytes[0] === 0xfe && bytes[1] === 0xff) return "utf-16be"
    if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return "utf-8"
  }

  const fromHeader = charsetFromContentType(contentType)
  if (fromHeader && isSupportedCharset(fromHeader)) return fromHeader

  const preview = new TextDecoder("utf-8", { fatal: false }).decode(bytes.subarray(0, Math.min(bytes.length, 2048)))
  const metaMatch =
    /<meta[^>]+charset\s*=\s*["']?\s*([A-Za-z0-9_\-.:]+)/i.exec(preview) ??
    /<\?xml[^>]+encoding\s*=\s*["']([A-Za-z0-9_\-.:]+)/i.exec(preview)
  if (metaMatch) {
    const name = normalizeCharset(metaMatch[1])
    if (isSupportedCharset(name)) return name
  }

  // Header present but unsupported (koi8-r, gbk, …) → lossy UTF-8 like before.
  return "utf-8"
}

function isSupportedCharset(name: string): boolean {
  switch (name) {
    case "utf-8":
    case "utf-16le":
    case "utf-16be":
    case "windows-1251":
    case "windows-1252":
    case "iso-8859-1":
      return true
    default:
      return false
  }
}

// Decode a text response body using the sniffed charset. Never throws —
// unknown sequences become U+FFFD and unsupported charsets fall back to
// lossy UTF-8.
export function decodeTextBody(bytes: Uint8Array, contentType?: string): string {
  const charset = sniffCharset(bytes, contentType)
  switch (charset) {
    case "utf-8":
      return new TextDecoder("utf-8", { fatal: false }).decode(bytes)
    case "utf-16le":
    case "utf-16be":
      try {
        return new TextDecoder(charset).decode(bytes)
      } catch {
        return new TextDecoder("utf-8", { fatal: false }).decode(bytes)
      }
    case "windows-1251":
      return decodeCp1251(bytes)
    case "windows-1252":
      return decodeWindows1252(bytes)
    case "iso-8859-1":
      return decodeLatin1(bytes)
    default:
      return new TextDecoder("utf-8", { fatal: false }).decode(bytes)
  }
}
