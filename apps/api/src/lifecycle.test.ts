import { describe, expect, test } from "bun:test"
import { stopServer } from "./lifecycle"

const lifecycleUrl = new URL("./lifecycle.ts", import.meta.url).href

describe("HTTP shutdown drain", () => {
  test("finishes an admitted response and refuses new connections", async () => {
    const entered = Promise.withResolvers<void>()
    const finish = Promise.withResolvers<void>()
    const server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      async fetch() {
        entered.resolve()
        await finish.promise
        return new Response("completed")
      },
    })
    const url = `http://127.0.0.1:${server.port}`
    const response = fetch(url).then((r) => r.text())
    try {
      await entered.promise
      const stopping = stopServer(server, 1000)
      await expect(fetch(url)).rejects.toThrow()
      finish.resolve()
      expect(await response).toBe("completed")
      await stopping
    } finally {
      finish.resolve()
      await server.stop(true)
    }
  })

  test.each([0, 50])("bounds unfinished responses with a %dms drain", async (drainMs) => {
    const entered = Promise.withResolvers<void>()
    const finish = Promise.withResolvers<void>()
    const server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      async fetch() {
        entered.resolve()
        await finish.promise
        return new Response("too late")
      },
    })
    const response = fetch(`http://127.0.0.1:${server.port}`).catch(() => undefined)
    try {
      await entered.promise
      const start = performance.now()
      await stopServer(server, drainMs)
      expect(performance.now() - start).toBeGreaterThanOrEqual(drainMs * 0.8)
      expect(performance.now() - start).toBeLessThan(1000)
      expect(await response).toBeUndefined()
    } finally {
      finish.resolve()
      await server.stop(true)
    }
  })
})

async function child(body: string) {
  const proc = Bun.spawn(
    [
      process.execPath,
      "--eval",
      `
    import { registerLifecycleHandlers } from ${JSON.stringify(lifecycleUrl)};
    registerLifecycleHandlers({ onShutdown: async () => { console.log("shutdown"); await Bun.sleep(10) } });
    ${body}
    setTimeout(() => process.exit(0), 150);
  `,
    ],
    { stdout: "pipe", stderr: "pipe" },
  )
  const [code, stdout, stderr] = await Promise.all([
    proc.exited,
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ])
  return { code, stdout, stderr }
}

describe("process lifecycle", () => {
  test.each(["uncaughtException", "unhandledRejection"])("drains and exits on an unexpected %s", async (event) => {
    const result = await child(`process.emit("${event}", new Error("unexpected fixture failure"));`)
    expect(result.code).toBe(1)
    expect(result.stdout.trim()).toBe("shutdown")
    expect(result.stderr).toContain("unexpected fixture failure")
  })

  test("does not suppress an application TypeError about a missing URL", async () => {
    const result = await child(`
      const error = new TypeError("Cannot read properties of undefined (reading 'url')");
      error.stack = "TypeError: missing url\\n at app (/app/apps/api/src/app.ts:10:1)";
      process.emit("uncaughtException", error);
    `)
    expect(result.code).toBe(1)
  })

  test("retains the specific malformed browser page-error workaround", async () => {
    const result = await child(`
      const error = new TypeError("undefined is not an object (evaluating 'pageError.location.url')");
      error.stack = "TypeError: missing location\\n at <anonymous> (/app/node_modules/playwright-core/lib/coreBundle.js:49624:30)";
      process.emit("uncaughtException", error);
    `)
    expect(result.code).toBe(0)
    expect(result.stdout.trim()).toBe("")
    expect(result.stderr).toContain("malformed browser page error")
  })

  test("coalesces repeated shutdown signals", async () => {
    const result = await child(`process.emit("SIGTERM"); process.emit("SIGINT");`)
    expect(result.code).toBe(0)
    expect(result.stdout.trim()).toBe("shutdown")
  })
})
