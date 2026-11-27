import { expect, test } from "bun:test"
import { solveRecaptchaV2 } from "../src/solvers/recaptcha"

test("reCAPTCHA auto-pass returns immediately after confirmed checkbox success", async () => {
  const clicks: string[] = []
  const page = {
    waitForSelector: async () => ({}),
    frameLocator: () => ({
      first() {
        return this
      },
      locator: (selector: string) => ({
        click: async () => {
          clicks.push(selector)
        },
        waitFor: async () => {},
        isVisible: async () => true,
      }),
    }),
  }
  const started = Date.now()
  expect(await solveRecaptchaV2(page as never, 4000)).toBe(true)
  expect(clicks).toEqual(["#recaptcha-anchor"])
  expect(Date.now() - started).toBeLessThan(1000)
})
