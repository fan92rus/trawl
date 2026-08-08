// UTF-8 → windows-1251 (CP1251) re-encoding helper.
//
// Some indexers (Prowlarr's native RuTracker parser) decode responses as
// windows-1251 regardless of what the server actually sent. When the browser
// tiers render a page whose upstream charset is windows-1251, TRAWL hands the
// HTML back as a UTF-8 JS string — sending those bytes verbatim would make the
// parser see mojibake. For configured CP1251_HOSTS we re-encode the rendered
// HTML to windows-1251 so the client decodes it correctly.

// CP1251 mapping for code points that differ from Latin-1 (0x80-0xFF range).
// Everything else in the Cyrillic block (0xC0-0xFF == cp1251) is identity.
const CP1251_OVERRIDES = new Map<number, number>([
  // 0x80-0x9F: Cyrillic-dedicated slots in cp1251 (replaces C1 controls)
  [0x0402, 0x80], // Ђ
  [0x0403, 0x81], // Ѓ
  [0x201a, 0x82], // ‚
  [0x0453, 0x83], // ѓ
  [0x201e, 0x84], // „
  [0x2026, 0x85], // …
  [0x2020, 0x86], // †
  [0x2021, 0x87], // ‡
  [0x20ac, 0x88], // €
  [0x2030, 0x89], // ‰
  [0x0409, 0x8a], // Љ
  [0x2039, 0x8b], // ‹
  [0x040a, 0x8c], // Њ
  [0x040c, 0x8d], // Ќ
  [0x040b, 0x8e], // Ћ
  [0x040f, 0x8f], // Џ
  [0x0452, 0x90], // ђ
  [0x2018, 0x91], // ‘
  [0x2019, 0x92], // ’
  [0x201c, 0x93], // “
  [0x201d, 0x94], // ”
  [0x2022, 0x95], // •
  [0x2013, 0x96], // –
  [0x2014, 0x97], // —
  [0x2122, 0x99], // ™
  [0x0459, 0x9a], // љ
  [0x203a, 0x9b], // ›
  [0x045a, 0x9c], // њ
  [0x045c, 0x9d], // ќ
  [0x045b, 0x9e], // ћ
  [0x045f, 0x9f], // џ
  // 0xA0: nbsp at 0xA0 same as Latin-1 — no override needed.
  // 0xA1-0xAF: ukrainian/belarusian + misc
  [0x040e, 0xa1], // Ў
  [0x045e, 0xa2], // ў
  [0x0408, 0xa3], // Ј
  [0x0490, 0xa5], // Ґ
  [0x0401, 0xa8], // Ё
  [0x0404, 0xaa], // Є
  [0x0407, 0xaf], // Ї
  [0x0406, 0xb2], // І
  [0x0456, 0xb3], // і
  [0x0491, 0xb4], // ґ
  [0x0451, 0xb8], // ё
  [0x2116, 0xb9], // №
  [0x0454, 0xba], // є
  [0x0457, 0xbf], // ї
])

// Reverse map (byte → code point) for the overrides, plus the identity ranges.
const BYTE_TO_CODEPOINT: Map<number, number> = new Map()
for (const [code, byte] of CP1251_OVERRIDES) BYTE_TO_CODEPOINT.set(byte, code)

// Encode a JS string to windows-1251 bytes. Characters with no cp1251 mapping
// fall back to '?' (0x3F) — matches Python's errors='replace' behaviour.
export function encodeCp1251(text: string): Uint8Array {
  const out = new Uint8Array(text.length) // 1 byte per BMP char max
  let n = 0
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0
    if (code <= 0x7f) {
      out[n++] = code
    } else if (code >= 0x0410 && code <= 0x044f) {
      // Cyrillic А-я (U+0410-U+044F) → cp1251 0xC0-0xFF
      out[n++] = code - 0x350
    } else if (code >= 0xa0 && code <= 0xff) {
      // Latin-1 range: cp1251 == Latin-1 for all non-override bytes (©, «», °, ±, µ, ¶, ·, ÷, nbsp…)
      out[n++] = code
    } else {
      const mapped = CP1251_OVERRIDES.get(code)
      out[n++] = mapped ?? 0x3f // '?'
    }
  }
  return out.subarray(0, n)
}

// Decode windows-1251 bytes into a JS string (used in tests / verification).
// Implemented via the reverse map instead of TextDecoder — Bun ships without
// full ICU, so TextDecoder("windows-1251") throws RangeError.
export function decodeCp1251(bytes: Uint8Array): string {
  let out = ""
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i]
    if (b <= 0x7f) {
      out += String.fromCharCode(b)
    } else {
      const override = BYTE_TO_CODEPOINT.get(b)
      if (override !== undefined) {
        out += String.fromCharCode(override)
      } else if (b >= 0xc0 && b <= 0xff) {
        out += String.fromCharCode(b + 0x350) // cp1251 0xC0-0xFF → Cyrillic U+0410-U+044F
      } else if (b >= 0xa0 && b <= 0xbf) {
        out += String.fromCharCode(b) // Latin-1 identity (©, «», °, ±, …)
      } else {
        out += "\uFFFD"
      }
    }
  }
  return out
}
