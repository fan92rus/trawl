import { describe, expect, test } from "bun:test"
import { decodeCp1251, encodeCp1251 } from "../src/utils/cp1251"

describe("encodeCp1251", () => {
  test("passes through ASCII unchanged", () => {
    const bytes = encodeCp1251("hello world <div>")
    expect(decodeCp1251(bytes)).toBe("hello world <div>")
  })

  test("encodes Cyrillic via the 0x350 offset", () => {
    const bytes = encodeCp1251("Чёрный факел / Black Torch")
    const decoded = decodeCp1251(bytes)
    expect(decoded).toBe("Чёрный факел / Black Torch")
    // 'Ч' = U+0427 → 0xD7, 'ё' = U+0451 → 0xB8 (cp1251 override)
    expect(bytes[0]).toBe(0xd7)
    expect(Array.from(bytes).includes(0xb8)).toBe(true)
  })

  test("encodes special cp1251 overrides (№, Ё, —, …, „)", () => {
    const bytes = encodeCp1251("№ ёлка — «кавычки» …")
    expect(decodeCp1251(bytes)).toBe("№ ёлка — «кавычки» …")
    // № = U+2116 → 0xB9
    expect(Array.from(bytes).includes(0xb9)).toBe(true)
    // — = U+2014 → 0x97
    expect(Array.from(bytes).includes(0x97)).toBe(true)
  })

  test("replaces unmappable chars with '?'", () => {
    const bytes = encodeCp1251("тест 🚀 эмодзи")
    const decoded = decodeCp1251(bytes)
    expect(decoded).toContain("тест")
    expect(decoded).toContain("эмодзи")
    // rocket emoji U+1F680 has no cp1251 mapping → '?'
    expect(decoded).toContain("?")
  })
})
