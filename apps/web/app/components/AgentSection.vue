<script lang="ts" setup>
const docsUrl = useDocsUrl()
const tools = [
  { name: "read", description: "Main content as Markdown or text. Raw TXT, JSON and XML stay intact." },
  { name: "scrape", description: "Page HTML with final URL, tier timings and scrape metadata." },
  { name: "extract", description: "CSS-selected JSON records, with optional JavaScript rendering and readiness." },
  { name: "screenshot", description: "Viewport, full-page or selected-element JPEG captures." },
  { name: "inspect", description: "Browser console, network activity, redirects and timings." },
  { name: "scrape_url", description: "Compatibility alias for scrape." },
]
</script>

<template>
  <section id="mcp" class="section">
    <div class="container">
      <p class="eyebrow">MCP for AI agents</p>
      <h2 class="section-title">give your agent the page behind the wall.</h2>
      <p class="section-lead">
        Connect a Streamable HTTP MCP client to the same challenge-aware engine your applications use. Load a known
        public URL, then choose the output your workflow needs.
      </p>
      <div class="agent-layout">
        <div class="tool-list">
          <div v-for="tool in tools" :key="tool.name" class="tool-row">
            <code>{{ tool.name }}</code>
            <p>{{ tool.description }}</p>
          </div>
        </div>
        <div class="agent-setup">
          <p class="eyebrow">connect once</p>
          <pre><code>MCP_ENABLED=true

Transport: Streamable HTTP
URL: http://localhost:8191/mcp</code></pre>
          <p>
            Works with clients that support remote MCP servers. Keep the endpoint on a private network. TRAWL loads
            URLs; search discovery belongs to your search provider.
          </p>
          <a :href="`${docsUrl}/integrations/mcp`" class="btn btn-outline">MCP setup and tools ↗</a>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.agent-layout {
  display: grid;
  grid-template-columns: 1.2fr 1fr;
  gap: 48px;
  align-items: start;
}
.tool-row {
  display: grid;
  grid-template-columns: 110px 1fr;
  gap: 20px;
  padding: 18px 0;
  border-bottom: 1px solid var(--border);
}
.tool-row code {
  color: var(--accent);
  font-size: 13px;
}
.tool-row p,
.agent-setup p {
  font-size: 12px;
  line-height: 1.8;
  color: var(--text-muted);
}
.agent-setup {
  border: 1px solid var(--border);
  padding: 28px;
  background: var(--bg-subtle);
}
.agent-setup pre {
  font-size: 12px;
  line-height: 1.9;
  overflow: auto;
  margin: 0 0 24px;
}
.agent-setup .btn {
  margin-top: 24px;
}
@media (max-width: 700px) {
  .agent-layout {
    grid-template-columns: 1fr;
    gap: 24px;
  }
  .agent-setup {
    padding: 20px;
  }
  .tool-row {
    grid-template-columns: 95px 1fr;
    gap: 12px;
  }
}
</style>
