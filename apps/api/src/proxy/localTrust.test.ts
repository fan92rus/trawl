import { afterEach, describe, expect, test } from "bun:test"
import net from "node:net"
import { localProxyCa, registerLocalProxy } from "./localTrust"

const cleanups: Array<() => void> = []

afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup()
})

describe("local MITM proxy trust", () => {
  test("returns CA only for the active local listener", async () => {
    const server = net.createServer()
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
    const address = server.address()
    if (!address || typeof address === "string") throw new Error("test listener has no TCP address")
    const unregister = registerLocalProxy({ server, configuredPort: 0, ca: "TEST CA" })
    cleanups.push(unregister, () => server.close())

    expect(await localProxyCa(`http://127.0.0.1:${address.port}`)).toBe("TEST CA")
    expect(await localProxyCa(`http://localhost:${address.port}`)).toBe("TEST CA")
    expect(await localProxyCa(`http://127.0.0.1:${address.port + 1}`)).toBeUndefined()
    expect(await localProxyCa(`https://127.0.0.1:${address.port}`)).toBeUndefined()
    expect(await localProxyCa(`http://proxy.example:${address.port}`)).toBeUndefined()

    unregister()
    expect(await localProxyCa(`http://127.0.0.1:${address.port}`)).toBeUndefined()
  })
})
