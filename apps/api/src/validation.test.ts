import { describe, expect, test } from "bun:test"
import { RequestValidationError } from "@trawl/tiers"
import { normalizeRequestCookies, requestUrl, validateFlareSolverrRequest, validateScrapeRequest } from "./validation"

const invalidBodies: unknown[] = [undefined, null, [], "text", 42, true]

describe("API request validation", () => {
  for (const body of invalidBodies) {
    test(`rejects non-object body ${JSON.stringify(body)}`, () => {
      expect(() => validateFlareSolverrRequest(body)).toThrow(
        new RequestValidationError("Request body must be a JSON object", 400),
      )
      expect(() => validateScrapeRequest(body)).toThrow(
        new RequestValidationError("Request body must be a JSON object", 400),
      )
    })
  }

  for (const url of [undefined, null, "", "   ", 42]) {
    test(`rejects invalid url ${JSON.stringify(url)}`, () => {
      expect(() => validateFlareSolverrRequest({ url })).toThrow(
        new RequestValidationError("url must be a non-empty string", 400),
      )
      expect(() => validateScrapeRequest({ url })).toThrow(
        new RequestValidationError("url must be a non-empty string", 400),
      )
    })
  }

  test("accepts valid request bodies for both API shapes", () => {
    expect(() => validateFlareSolverrRequest({ cmd: "request.get", url: "https://example.com" })).not.toThrow()
    expect(() => validateScrapeRequest({ method: "GET", url: "https://example.com" })).not.toThrow()
  })

  test("extracts only string URLs for error envelopes", () => {
    expect(requestUrl({ url: "https://example.com" })).toBe("https://example.com")
    expect(requestUrl({ url: 42 })).toBe("")
    expect(requestUrl(null)).toBe("")
  })
})

describe("normalizeRequestCookies", () => {
  test("returns undefined when cookies omitted", () => {
    expect(normalizeRequestCookies(undefined, "rutracker.org")).toBeUndefined()
  })

  test("fills domain from host and path from default", () => {
    const out = normalizeRequestCookies([{ name: "bb_session", value: "sess-123" }], "rutracker.org")!
    expect(out).toHaveLength(1)
    expect(out[0].name).toBe("bb_session")
    expect(out[0].value).toBe("sess-123")
    expect(out[0].domain).toBe(".rutracker.org")
    expect(out[0].path).toBe("/")
  })

  test("keeps explicit domain and path", () => {
    const out = normalizeRequestCookies(
      [{ name: "bb_session", value: "s", domain: "rutracker.org", path: "/forum" }],
      "rutracker.org",
    )!
    expect(out[0].domain).toBe("rutracker.org")
    expect(out[0].path).toBe("/forum")
  })

  test("rejects non-array cookies", () => {
    expect(() => normalizeRequestCookies({ name: "x", value: "y" }, "h")).toThrow(
      new RequestValidationError("cookies must be an array of {name, value}", 400),
    )
  })

  test("rejects cookie without name or value", () => {
    expect(() => normalizeRequestCookies([{ name: "", value: "y" }], "h")).toThrow(
      new RequestValidationError("each cookie requires string name and value", 400),
    )
    expect(() => normalizeRequestCookies([{ name: "x", value: 5 }], "h")).toThrow(
      new RequestValidationError("each cookie requires string name and value", 400),
    )
  })
})
