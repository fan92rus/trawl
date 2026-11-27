import { describe, expect, test } from "bun:test"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js"
import { createApiApp } from "./app"

describe("MCP opt-in registration", () => {
  test("does not expose /mcp by default when disabled", async () => {
    const response = await createApiApp({ mcpEnabled: false }).handle(new Request("http://localhost/mcp"))
    expect(response.status).toBe(404)
  })

  test("registers /mcp when enabled", async () => {
    const response = await createApiApp({ mcpEnabled: true }).handle(
      new Request("http://localhost/mcp", { headers: { accept: "text/event-stream" } }),
    )
    expect(response.status).toBe(200)
    await response.body?.cancel()
  })

  test("interoperates with the official generic MCP client", async () => {
    const app = createApiApp({ mcpEnabled: true })
    const server = Bun.serve({ port: 0, fetch: (request) => app.handle(request) })
    const client = new Client({ name: "trawl-smoke-test", version: "1.0.0" })
    try {
      await client.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${server.port}/mcp`)))
      const tools = await client.listTools()
      expect(tools.tools.map((tool) => tool.name)).toEqual([
        "scrape",
        "scrape_url",
        "read",
        "extract",
        "screenshot",
        "inspect",
      ])
    } finally {
      await client.close()
      server.stop(true)
    }
  })
})
