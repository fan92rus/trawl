import { describe, expect, test } from "bun:test"
import { charsetFromContentType, decodeTextBody, decodeWindows1252, sniffCharset } from "../src/utils/charset"

// 'Привет' in windows-1251: 0xCF 0xF0 0xE8 0xE2 0xE5 0xF2
const CP1251_PRIVET = new Uint8Array([0xcf, 0xf0, 0xe8, 0xe2, 0xe5, 0xf2])

describe("charsetFromContentType", () => {
  test("parses quoted and unquoted charset params", () => {
    expect(charsetFromContentType("text/html; charset=windows-1251")).toBe("windows-1251")
    expect(charsetFromContentType('text/html; charset="iso-8859-1"')).toBe("iso-8859-1")
    expect(charsetFromContentType("text/html; charset=UTF-8")).toBe("utf-8")
  })

  test("normalizes aliases", () => {
    expect(charsetFromContentType("text/html; charset=cp1251")).toBe("windows-1251")
    expect(charsetFromContentType("text/html; charset=ansi_1251")).toBe("windows-1251")
    expect(charsetFromContentType("text/html; charset=latin1")).toBe("iso-8859-1")
  })

  test("returns null when absent", () => {
    expect(charsetFromContentType("text/html")).toBeNull()
    expect(charsetFromContentType(undefined)).toBeNull()
  })
})

describe("sniffCharset", () => {
  test("BOM wins over header and meta", () => {
    const bom = new Uint8Array([
      0xef,
      0xbb,
      0xbf,
      ...Array.from(new TextEncoder().encode("<meta charset=windows-1251>")),
    ])
    expect(sniffCharset(bom, "text/html; charset=windows-1251")).toBe("utf-8")
    const utf16 = new Uint8Array([0xff, 0xfe, 0x41, 0x00])
    expect(sniffCharset(utf16, "text/html")).toBe("utf-16le")
  })

  test("header charset beats meta tag", () => {
    const bytes = new TextEncoder().encode('<html><head><meta charset="windows-1252"></head>')
    expect(sniffCharset(bytes, "text/html; charset=windows-1251")).toBe("windows-1251")
  })

  test("sniffs meta charset when header has none", () => {
    const bytes = new TextEncoder().encode(
      '<html><head><meta http-equiv="Content-Type" content="text/html; charset=windows-1251">',
    )
    expect(sniffCharset(bytes, "text/html")).toBe("windows-1251")
    expect(sniffCharset(new TextEncoder().encode('<meta charset="windows-1251">'), undefined)).toBe("windows-1251")
  })

  test("falls back to utf-8 for unsupported charsets (koi8-r, gbk)", () => {
    expect(sniffCharset(new Uint8Array([0xd0, 0xb0]), "text/html; charset=koi8-r")).toBe("utf-8")
    expect(sniffCharset(new TextEncoder().encode('<meta charset="gb2312">'), "text/html")).toBe("utf-8")
  })

  test("defaults to utf-8", () => {
    expect(sniffCharset(new TextEncoder().encode("<html>plain</html>"), "text/html")).toBe("utf-8")
  })
})

describe("decodeTextBody", () => {
  test("decodes windows-1251 via header charset", () => {
    const text = decodeTextBody(CP1251_PRIVET, "text/html; charset=windows-1251")
    expect(text).toBe("Привет")
  })

  test("decodes windows-1251 via meta sniffing (no header)", () => {
    const html = new Uint8Array([
      ...Array.from(new TextEncoder().encode('<meta charset="windows-1251"><title>')),
      ...Array.from(CP1251_PRIVET),
    ])
    expect(decodeTextBody(html)).toContain("Привет")
  })

  test("decodes windows-1251 with cp1251-only slots (№, ё)", () => {
    // '№' = 0xB9, 'ё' = 0xB8 in cp1251
    const bytes = new Uint8Array([0xb9, 0xb8])
    expect(decodeTextBody(bytes, "text/html; charset=windows-1251")).toBe("№ё")
  })

  test("decodes utf-8 (default path unchanged)", () => {
    const bytes = new TextEncoder().encode("<p>Привет мир</p>")
    expect(decodeTextBody(bytes, "text/html; charset=utf-8")).toBe("<p>Привет мир</p>")
  })

  test("decodes latin1 by byte identity", () => {
    // 'café' in latin-1: 0x63 0x61 0x66 0xE9
    expect(decodeTextBody(new Uint8Array([0x63, 0x61, 0x66, 0xe9]), "text/html; charset=iso-8859-1")).toBe("café")
  })

  test("decodes utf-16le with BOM", () => {
    const text = "<html><body>ok</body></html>"
    const full = new Uint8Array(2 + text.length * 2)
    full[0] = 0xff
    full[1] = 0xfe
    for (const [i, ch] of Array.from(text).entries()) {
      const code = ch.codePointAt(0) ?? 0
      full[2 + i * 2] = code & 0xff
      full[3 + i * 2] = code >> 8
    }
    expect(decodeTextBody(full, "text/html")).toBe(text)
  })

  test("unsupported charset falls back to lossy utf-8 without throwing", () => {
    const bytes = new TextEncoder().encode("hello")
    expect(decodeTextBody(bytes, "text/html; charset=shift_jis")).toBe("hello")
  })
})

describe("decodeWindows1252", () => {
  test("maps € and typographic quotes", () => {
    // '€' = 0x80, '"' (left) = 0x93, '"' (right) = 0x94 in windows-1252
    const text = decodeWindows1252(new Uint8Array([0x80, 0x93, 0x61, 0x62, 0x94]))
    expect(text).toBe("€“ab”")
  })

  test("keeps latin-1 identity outside 0x80-0x9F", () => {
    const text = decodeWindows1252(new Uint8Array([0xe9, 0xa9])) // é ©
    expect(text).toBe("é©")
  })
})
