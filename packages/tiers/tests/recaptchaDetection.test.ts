import { describe, expect, test } from "bun:test"
import { detectChallengeType, hasRecaptcha } from "../src/utils/detect"

const V3_RENDER_SCRIPT = "https://www.google.com/recaptcha/api.js?render=6Leez8oZAAAAABJqF0uuw35s7N50I1pZkIJBO1QT"

describe("reCAPTCHA shell detection", () => {
  test("ignores invisible v3 render scripts on ordinary pages", () => {
    // Regression for missav.ws: its real page loads reCAPTCHA v3 for site forms.
    const html = `<html><body>${"content ".repeat(1000)}<script>script.src = '${V3_RENDER_SCRIPT}'</script>${"content ".repeat(500)}</body></html>`
    expect(hasRecaptcha(html)).toBe(false)
    expect(detectChallengeType(html)).toBe("none")
  })

  test("ignores tiny pages that only reference the v3 render API", () => {
    expect(hasRecaptcha(`<html><body><script src="${V3_RENDER_SCRIPT}"></script></body></html>`)).toBe(false)
  })

  test("detects a visible v2 checkbox shell", () => {
    expect(hasRecaptcha('<html><body><div class="g-recaptcha" data-sitekey="owned"></div></body></html>')).toBe(true)
  })

  test("detects a v2 API shell without the widget markup", () => {
    expect(
      hasRecaptcha('<html><body><script src="https://www.google.com/recaptcha/api.js"></script></body></html>'),
    ).toBe(true)
  })

  test("detects the v2 anchor iframe", () => {
    expect(
      hasRecaptcha(
        '<html><body><iframe src="https://www.recaptcha.net/recaptcha/api2/anchor?k=owned"></iframe></body></html>',
      ),
    ).toBe(true)
  })

  test("preserves v2 widget detection on large documents", () => {
    const html = `<html><body><div class="g-recaptcha" data-sitekey="owned"></div>${"content ".repeat(3000)}</body></html>`
    expect(html.length).toBeGreaterThan(20_000)
    expect(hasRecaptcha(html)).toBe(true)
  })

  test("recognizes explicit v2 rendering without static widget markup", () => {
    const html =
      '<html><script src="https://www.google.com/recaptcha/api.js?onload=ready&render=explicit"></script></html>'
    expect(hasRecaptcha(html)).toBe(true)
  })

  test("keeps v2 detection when a page also loads v3", () => {
    const html = `<script src="${V3_RENDER_SCRIPT}"></script><script src="https://www.google.com/recaptcha/api.js"></script>`
    expect(hasRecaptcha(html)).toBe(true)
  })
})
