import { expect, test } from "bun:test"
import type { Page } from "patchright"
import { solveTurnstile } from "../src/solvers/turnstile"

function fixture(requiredClicks: number) {
  const clicks: number[] = []
  const frame = {
    url: () => "https://challenges.cloudflare.com/turnstile/widget",
    evaluateHandle: async () => {
      throw new Error("Shadow root unavailable")
    },
    locator: () => ({
      first: () => ({
        isVisible: async () => true,
        click: async () => {
          clicks.push(Date.now())
        },
      }),
    }),
  }
  const page = {
    evaluate: async () => clicks.length >= requiredClicks,
    evaluateHandle: async () => ({
      evaluate: async (read: any) => read({ verified: () => clicks.length >= requiredClicks, disconnect() {} }),
      dispose: async () => {},
    }),
    frames: () => [frame],
  }
  return { page: page as unknown as Page, clicks }
}

test("embedded Turnstile can retry before the remaining budget is too short to click", async () => {
  const { page, clicks } = fixture(2)
  expect(await solveTurnstile(page, 4500)).toBe(true)
  expect(clicks).toHaveLength(2)
  expect((clicks[1] ?? 0) - (clicks[0] ?? 0)).toBeGreaterThanOrEqual(1500)
})

test("a verified embedded Turnstile token prevents further clicks", async () => {
  const { page, clicks } = fixture(1)
  expect(await solveTurnstile(page, 4500)).toBe(true)
  expect(clicks).toHaveLength(1)
})
