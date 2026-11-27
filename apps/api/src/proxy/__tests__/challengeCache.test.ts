import { describe, expect, test } from "bun:test"
import { ChallengeCache } from "../challengeCache"

describe("ChallengeCache", () => {
  test("returns undefined for unknown host", () => {
    const c = new ChallengeCache()
    expect(c.get("never-seen.example.com")).toBeUndefined()
  })

  test("set + get round-trips modes", () => {
    const c = new ChallengeCache()
    c.set("a.example.com", "direct")
    c.set("b.example.com", "cf")
    c.set("c.example.com", "unknown")
    expect(c.get("a.example.com")).toBe("direct")
    expect(c.get("b.example.com")).toBe("cf")
    expect(c.get("c.example.com")).toBe("unknown")
  })

  test("respects TTL - entries past TTL are not returned", () => {
    const c = new ChallengeCache({ ttlMs: 10 })
    c.set("host.example", "direct")
    expect(c.get("host.example")).toBe("direct")
    // Sleep past TTL
    const deadline = Date.now() + 50
    while (Date.now() < deadline) {
      // tight spin - 10ms ttl + 50ms margin
    }
    expect(c.get("host.example")).toBeUndefined()
  })

  test("prune() evicts expired entries and returns count", () => {
    const c = new ChallengeCache({ ttlMs: 5 })
    c.set("a.example", "direct")
    c.set("b.example", "cf")
    c.set("c.example", "direct")
    const deadline = Date.now() + 30
    while (Date.now() < deadline) {
      // wait
    }
    const removed = c.prune()
    expect(removed).toBe(3)
    expect(c.size()).toBe(0)
  })

  test("delete() removes a specific entry", () => {
    const c = new ChallengeCache()
    c.set("x.example", "direct")
    c.set("y.example", "cf")
    c.delete("x.example")
    expect(c.get("x.example")).toBeUndefined()
    expect(c.get("y.example")).toBe("cf")
  })

  test("clear() empties everything", () => {
    const c = new ChallengeCache()
    c.set("a", "direct")
    c.set("b", "cf")
    expect(c.size()).toBe(2)
    c.clear()
    expect(c.size()).toBe(0)
    expect(c.get("a")).toBeUndefined()
    expect(c.get("b")).toBeUndefined()
  })

  test("size() reflects current entries", () => {
    const c = new ChallengeCache()
    expect(c.size()).toBe(0)
    c.set("a", "direct")
    c.set("b", "direct")
    c.set("c", "cf")
    expect(c.size()).toBe(3)
    c.delete("a")
    expect(c.size()).toBe(2)
  })

  test("set() refreshes lastCheck (extends TTL window)", () => {
    const c = new ChallengeCache({ ttlMs: 50 })
    c.set("host", "direct")
    // Wait partway through TTL
    const midDeadline = Date.now() + 25
    while (Date.now() < midDeadline) {
      // tight spin
    }
    c.set("host", "direct") // refresh timestamp
    // Wait past original TTL but within refreshed window
    const endDeadline = Date.now() + 35
    while (Date.now() < endDeadline) {
      // tight spin
    }
    expect(c.get("host")).toBe("direct") // refreshed - still valid
  })
})
