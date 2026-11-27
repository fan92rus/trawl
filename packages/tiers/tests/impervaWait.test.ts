import { expect, test } from "bun:test"
import type { Page } from "patchright"
import { waitForImpervaResolution } from "../src/utils/impervaWait"

const wall = '<html><iframe src="/_Incapsula_Resource?challenge"></iframe></html>'

test("Imperva respects a short budget before its sensor boot delay", async () => {
  const started = Date.now()
  const page = {
    url: () => "https://example.test/",
    content: async () => (Date.now() - started < 100 ? wall : "<article>Ready</article>"),
    context: () => ({ cookies: async () => [{ name: "reese84", domain: "example.test" }] }),
    waitForLoadState: async () => {},
  } as unknown as Page
  expect(await Promise.race([waitForImpervaResolution(page, 40), Bun.sleep(200).then(() => "still-running")])).toBe(
    "timeout",
  )
})

test("Imperva does not accept an empty document after receiving a sensor cookie", async () => {
  let reads = 0
  const page = {
    url: () => "https://example.test/",
    content: async () => (++reads === 1 ? wall : ""),
    context: () => ({ cookies: async () => [{ name: "reese84", domain: "example.test" }] }),
    waitForLoadState: async () => {},
  } as unknown as Page
  expect(await waitForImpervaResolution(page, 1300)).toBe("timeout")
})

test("Imperva recognizes a cleared document without waiting for a particular sensor cookie", async () => {
  let reads = 0
  let cookieReads = 0
  const page = {
    url: () => "https://example.test/",
    content: async () => (++reads === 1 ? wall : "<article>Requested content</article>"),
    context: () => ({
      cookies: async () => (++cookieReads < 2 ? [] : [{ name: "reese84", domain: "example.test" }]),
    }),
    waitForLoadState: async () => {},
  } as unknown as Page
  expect(await waitForImpervaResolution(page, 1500)).toBe("ok")
  expect(cookieReads).toBe(0)
})
