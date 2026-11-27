import { expect, test } from "bun:test"
import { embeddedWidgetHints } from "../src/solvers/widgetMarkup"

test("provider links and documentation text do not justify widget waits", () => {
  expect(
    embeddedWidgetHints(
      '<a href="https://google.com/recaptcha/">grecaptcha.render</a><a href="https://hcaptcha.com/">hCaptcha</a><a href="https://cloudflare.com/turnstile/">cf-turnstile</a>',
    ),
  ).toEqual({ turnstile: false, recaptcha: false, hcaptcha: false })
})

test("inert script data does not initialize a CAPTCHA SDK", () => {
  expect(
    embeddedWidgetHints(
      '<script type="application/ld+json">{"example":"grecaptcha.render hcaptcha.render turnstile.render"}</script>',
    ),
  ).toEqual({ turnstile: false, recaptcha: false, hcaptcha: false })
})

test("lazy SDK scripts and actual widget mounts retain detection", () => {
  for (const [kind, html] of [
    ["recaptcha", '<script src="https://www.google.com/recaptcha/api.js"></script>'],
    ["recaptcha", "<script>grecaptcha.ready(() => {})</script>"],
    ["recaptcha", '<div class="g-recaptcha"></div>'],
    ["hcaptcha", '<script src="https://js.hcaptcha.com/1/api.js"></script>'],
    ["hcaptcha", '<script>hcaptcha.render("captcha")</script>'],
    ["hcaptcha", '<div class="h-captcha"></div>'],
    ["turnstile", '<script src="https://challenges.cloudflare.com/turnstile/v0/api.js"></script>'],
    ["turnstile", '<script>turnstile.render("captcha")</script>'],
    ["turnstile", '<input name="cf-turnstile-response" value="verified-token">'],
  ] as const)
    expect(embeddedWidgetHints(html)[kind]).toBe(true)
})
