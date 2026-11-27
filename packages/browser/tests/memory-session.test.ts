import { expect, test } from "bun:test"
import type { SessionData } from "@trawl/types"
import { MemorySessionCache } from "../src/memory-session"

const cookie: SessionData = {
  cookies: [
    {
      name: "cf_clearance",
      value: "abc123",
      domain: ".example.com",
      path: "/",
      expires: Date.now() / 1000 + 3600,
      httpOnly: true,
      secure: true,
    },
  ],
  userAgent: "Mozilla/5.0",
  savedAt: Date.now(),
}

test("MemorySessionCache.connect() resolves instantly", async () => {
  const cache = new MemorySessionCache({ ttlSeconds: 60 })
  await expect(cache.connect()).resolves.toBeUndefined()
})

test("MemorySessionCache saves and loads by domain", async () => {
  const cache = new MemorySessionCache({ ttlSeconds: 60 })
  await cache.save("example.com", cookie)
  const loaded = await cache.load("example.com")
  expect(loaded).toEqual(cookie)
})

test("MemorySessionCache returns undefined for unknown domain", async () => {
  const cache = new MemorySessionCache({ ttlSeconds: 60 })
  const loaded = await cache.load("nope.com")
  expect(loaded).toBeUndefined()
})

test("MemorySessionCache invalidate removes the entry", async () => {
  const cache = new MemorySessionCache({ ttlSeconds: 60 })
  await cache.save("example.com", cookie)
  await cache.invalidate("example.com")
  const loaded = await cache.load("example.com")
  expect(loaded).toBeUndefined()
})

test("MemorySessionCache expires entries after TTL", async () => {
  let now = 1_000
  const cache = new MemorySessionCache({ ttlSeconds: 1, now: () => now })
  await cache.save("example.com", cookie)
  expect(await cache.load("example.com")).toEqual(cookie)

  now += 500
  expect(await cache.load("example.com")).toEqual(cookie)
  now += 500
  expect(await cache.load("example.com")).toBeUndefined()
})

test("MemorySessionCache.prune removes only expired entries", async () => {
  let now = 1_000
  const cache = new MemorySessionCache({ ttlSeconds: 1, now: () => now })
  await cache.save("a.com", cookie)
  await cache.save("b.com", cookie)

  now += 1_000
  expect(cache.prune()).toBe(2)
  await cache.save("c.com", cookie)

  expect(cache.prune()).toBe(0)
  expect(cache.size).toBe(1)
  expect(await cache.load("c.com")).toEqual(cookie)
})

test("MemorySessionCache automatically prunes expired entries before save", async () => {
  let now = 1_000
  const cache = new MemorySessionCache({ ttlSeconds: 1, now: () => now })
  await cache.save("expired.com", cookie)
  now += 1_000
  await cache.save("fresh.com", cookie)

  expect(cache.size).toBe(1)
  expect(await cache.load("fresh.com")).toEqual(cookie)
})

test("MemorySessionCache overwrites on re-save", async () => {
  const cache = new MemorySessionCache({ ttlSeconds: 60 })
  await cache.save("example.com", cookie)
  const updated: SessionData = { ...cookie, userAgent: "Mozilla/5.0 (updated)" }
  await cache.save("example.com", updated)
  const loaded = await cache.load("example.com")
  expect(loaded?.userAgent).toBe("Mozilla/5.0 (updated)")
})

test("MemorySessionCache evicts the least recently used entry at capacity", async () => {
  const cache = new MemorySessionCache({ ttlSeconds: 60, maxEntries: 2 })
  await cache.save("a.com", cookie)
  await cache.save("b.com", cookie)
  await cache.load("a.com")
  await cache.save("c.com", cookie)

  expect(await cache.load("a.com")).toEqual(cookie)
  expect(await cache.load("b.com")).toBeUndefined()
  expect(await cache.load("c.com")).toEqual(cookie)
})

test("MemorySessionCache isolates stored values from caller mutations", async () => {
  const cache = new MemorySessionCache({ ttlSeconds: 60 })
  const saved = structuredClone(cookie)
  await cache.save("example.com", saved)
  saved.userAgent = "mutated after save"

  const firstLoad = await cache.load("example.com")
  expect(firstLoad?.userAgent).toBe(cookie.userAgent)
  if (firstLoad) firstLoad.userAgent = "mutated after load"
  expect((await cache.load("example.com"))?.userAgent).toBe(cookie.userAgent)
})

test("MemorySessionCache.close clears all entries", async () => {
  const cache = new MemorySessionCache({ ttlSeconds: 60 })
  await cache.save("example.com", cookie)
  cache.close()
  expect(cache.size).toBe(0)
})

test("MemorySessionCache rejects invalid bounds", () => {
  expect(() => new MemorySessionCache({ ttlSeconds: 0 })).toThrow("TTL must be a positive integer")
  expect(() => new MemorySessionCache({ ttlSeconds: 60, maxEntries: 0 })).toThrow(
    "max entries must be a positive integer",
  )
})
