import { describe, expect, test } from "bun:test"
import type { Page } from "patchright"
import { waitForVisibleSelector } from "../src/utils/waitForVisibleSelector"

describe("waitForVisibleSelector", () => {
  test("stops at the request budget when the browser wait does not settle", async () => {
    let requestedTimeout = 0
    const page = {
      waitForSelector: async (_selector: string, options: { timeout: number }) => {
        requestedTimeout = options.timeout
        return new Promise(() => {})
      },
    } as unknown as Page

    const start = performance.now()
    expect(await waitForVisibleSelector(page, ".ready", 20)).toBe(false)
    expect(requestedTimeout).toBe(20)
    expect(performance.now() - start).toBeLessThan(500)
  })

  test("does not call the browser after the budget is exhausted", async () => {
    const page = {
      waitForSelector: () => {
        throw new Error("unexpected browser wait")
      },
    } as unknown as Page
    expect(await waitForVisibleSelector(page, ".ready", 0)).toBe(false)
  })
})
