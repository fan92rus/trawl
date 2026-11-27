import { parseHTML } from "linkedom"

/** Only widget mounts or executable SDK references justify waiting for lazy widgets. */
export function embeddedWidgetHints(html: string) {
  const { document } = parseHTML(html)
  const scripts = Array.from(document.querySelectorAll("script")).filter((script) => {
    const type = (script.getAttribute("type") ?? "").split(";")[0]?.trim() ?? ""
    return !type || /^(?:module|(?:text|application)\/(?:java|ecma)script)$/i.test(type)
  })
  const sources = scripts.map((script) => script.getAttribute("src") ?? "").join("\n")
  const code = scripts.map((script) => script.textContent ?? "").join("\n")
  return {
    turnstile:
      Boolean(
        document.querySelector(
          '.cf-turnstile, #cf-turnstile, input[name="cf-turnstile-response"], iframe[src*="challenges.cloudflare.com"], iframe[src*="cdn-cgi/challenge-platform"]',
        ),
      ) ||
      /(?:cloudflare\.com\/turnstile|turnstile[^/]*\.js)/i.test(sources) ||
      /\bturnstile\s*(?:\.|\[)/.test(code),
    recaptcha:
      Boolean(document.querySelector('.g-recaptcha, input[name="g-recaptcha-response"], iframe[src*="recaptcha"]')) ||
      /(?:google\.com\/recaptcha|recaptcha\.net\/|recaptcha[^/]*\.js)/i.test(sources) ||
      /\bgrecaptcha\s*(?:\.|\[)/.test(code),
    hcaptcha:
      Boolean(document.querySelector('.h-captcha, input[name="h-captcha-response"], iframe[src*="hcaptcha.com"]')) ||
      /(?:hcaptcha\.com\/|hcaptcha[^/]*\.js)/i.test(sources) ||
      /\bhcaptcha\s*(?:\.|\[)/.test(code),
  }
}
