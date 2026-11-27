import { describe, expect, test } from "bun:test"
import { fileURLToPath } from "node:url"

const waitFor = async (ready: () => Promise<boolean>, timeoutMs = 60_000) => {
  const deadline = performance.now() + timeoutMs
  while (performance.now() < deadline) {
    if (await ready()) return
    await Bun.sleep(25)
  }
  throw new Error("Shutdown fixture did not reach the expected state")
}

describe.skipIf(process.env.TRAWL_SHUTDOWN_TESTS !== "1")("API shutdown with real browser processes", () => {
  test.each([
    { name: "HTTP scrape", signal: "SIGTERM", browser: false, session: false },
    { name: "browser scrape", signal: "SIGTERM", browser: true, session: false },
    { name: "named /v1 session", signal: "SIGINT", browser: true, session: true },
  ] as const)(
    "finishes $name on $signal",
    async ({ signal, browser, session }) => {
      const finish = Promise.withResolvers<void>()
      let reached = false
      const fixture = Bun.serve({
        hostname: "127.0.0.1",
        port: 0,
        async fetch(request) {
          if (new URL(request.url).pathname === "/slow") {
            reached = true
            await finish.promise
          }
          return new Response(`<html><body>${"Owned shutdown fixture. ".repeat(30)}</body></html>`, {
            headers: { "content-type": "text/html" },
          })
        },
      })
      const reservation = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: () => new Response() })
      const port = reservation.port
      await reservation.stop(true)
      const proc = Bun.spawn([process.execPath, "run", fileURLToPath(new URL("./index.ts", import.meta.url))], {
        env: {
          ...process.env,
          PORT: String(port),
          SESSION_CACHE_DRIVER: "memory",
          REDIS_URL: "",
          METRICS_DB_PATH: ":memory:",
          BROWSER_POOL_SIZE: "1",
          BROWSER_HEADFUL_POOL_SIZE: "0",
          BROWSER_SHUTDOWN_DRAIN_MS: "10000",
          MITM_ENABLED: "false",
        },
        stdout: "pipe",
        stderr: "pipe",
      })
      const logs = Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text()])
      const base = `http://127.0.0.1:${port}`
      const send = async (path: string, body: unknown) => {
        const response = await fetch(base + path, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        })
        return { status: response.status, body: await response.json() }
      }
      try {
        await waitFor(async () => {
          try {
            return (await fetch(`${base}/health`, { signal: AbortSignal.timeout(1000) })).ok
          } catch {
            if (proc.exitCode !== null) throw new Error((await logs).join("\n"))
            return false
          }
        })
        if (session) expect((await send("/v1", { cmd: "sessions.create", session: "shutdown" })).status).toBe(200)
        const url = `http://127.0.0.1:${fixture.port}/slow`
        const request = send(
          session ? "/v1" : "/scrape",
          session
            ? { cmd: "request.get", session: "shutdown", url, maxTimeout: 20000 }
            : { url, maxTimeout: 20000, skipHttp: browser, maxTier: browser ? 3 : 1 },
        ).catch((error) => ({ status: 0, body: String(error) }))
        await waitFor(async () => reached, 20000)
        proc.kill(signal)
        await waitFor(async () => {
          try {
            await fetch(`${base}/health`, { signal: AbortSignal.timeout(1000) })
            return false
          } catch {
            return true
          }
        }, 5000)
        finish.resolve()
        const result = await request
        await waitFor(async () => proc.exitCode !== null, 20000)
        expect(result.status, (await logs).join("\n")).toBe(200)
        expect(session ? result.body.solution.response : result.body.html).toContain("Owned shutdown fixture.")
        expect(await proc.exited).toBe(0)
      } finally {
        finish.resolve()
        if (proc.exitCode === null) proc.kill("SIGKILL")
        await proc.exited
        await logs
        await fixture.stop(true)
      }
    },
    120000,
  )
})
