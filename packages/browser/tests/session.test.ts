import { expect, test } from "bun:test"
import { SessionCache } from "../src/session"

test("SessionCache fails fast when Redis is unavailable", async () => {
  const cache = new SessionCache({ redisUrl: "redis://127.0.0.1:1", ttlSeconds: 60 })
  const startedAt = performance.now()

  await expect(cache.connect(250)).rejects.toBeInstanceOf(Error)
  expect(performance.now() - startedAt).toBeLessThan(500)
})
