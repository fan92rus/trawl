<script lang="ts" setup>
type Tab = "curl" | "js" | "python" | "prowlarr" | "headers" | "sessions"
const active = shallowRef<Tab>("curl")

const tabs: { id: Tab; label: string }[] = [
  { id: "curl", label: "curl" },
  { id: "sessions", label: "sessions" },
  { id: "js", label: "javascript" },
  { id: "python", label: "python" },
  { id: "prowlarr", label: "prowlarr" },
  { id: "headers", label: "custom headers" },
]

const code: Record<Tab, string> = {
  curl: `<span class="c"># Native scraping API</span>
curl -s -X POST http://localhost:8191/scrape \\
  -H <span class="s">"Content-Type: application/json"</span> \\
  -d <span class="s">'{"url":"https://nopecha.com/demo/cloudflare","maxTimeout":60000}'</span> | jq <span class="s">'{tier,totalMs}'</span>

<span class="c"># FlareSolverr-compatible request</span>
curl -s -X POST http://localhost:8191/v1 \\
  -H <span class="s">"Content-Type: application/json"</span> \\
  -d <span class="s">'{
    "cmd": "request.get",
    "url": "https://nopecha.com/demo/cloudflare",
    "maxTimeout": 60000
  }'</span> | jq <span class="s">'.solution.response'</span>`,

  js: `<span class="c">// FlareSolverr-compatible endpoint</span>
<span class="kw">const</span> res = <span class="kw">await</span> fetch(<span class="s">"http://localhost:8191/v1"</span>, {
  method: <span class="s">"POST"</span>,
  headers: { <span class="s">"Content-Type"</span>: <span class="s">"application/json"</span> },
  body: JSON.stringify({
    cmd: <span class="s">"request.get"</span>,
    url: <span class="s">"https://nopecha.com/demo/cloudflare"</span>,
    maxTimeout: <span class="n">60000</span>,
  }),
})

<span class="kw">const</span> { solution } = <span class="kw">await</span> res.json()

console.log(solution.response)  <span class="c">// full HTML</span>
console.log(solution.cookies)   <span class="c">// solved session cookies</span>
console.log(solution.userAgent) <span class="c">// browser UA used</span>`,

  python: `<span class="kw">import</span> requests

<span class="c"># FlareSolverr-compatible endpoint</span>
res = requests.post(<span class="s">"http://localhost:8191/v1"</span>, json={
    <span class="s">"cmd"</span>: <span class="s">"request.get"</span>,
    <span class="s">"url"</span>: <span class="s">"https://nopecha.com/demo/cloudflare"</span>,
    <span class="s">"maxTimeout"</span>: <span class="n">60000</span>,
}, timeout=<span class="n">65</span>)

data = res.json()
assert data[<span class="s">"status"</span>] == <span class="s">"ok"</span>

html    = data[<span class="s">"solution"</span>][<span class="s">"response"</span>]
cookies = data[<span class="s">"solution"</span>][<span class="s">"cookies"</span>]`,

  headers: `<span class="c"># Pass any header - forwarded to the target across all tiers</span>
curl -s -X POST http://localhost:8191/v1 \\
  -H <span class="s">"Content-Type: application/json"</span> \\
  -d <span class="s">'{
    "cmd": "request.get",
    "url": "https://example.com/embed",
    "headers": {
      "Authorization": "Bearer my-token",
      "Referer": "https://parent-site.com",
      "Origin": "https://parent-site.com"
    }
  }'</span>

<span class="c"># Native API - same headers field, richer response</span>
curl -s -X POST http://localhost:8191/scrape \\
  -H <span class="s">"Content-Type: application/json"</span> \\
  -d <span class="s">'{
    "url": "https://example.com/embed",
    "headers": { "X-API-Key": "secret" }
  }'</span>

<span class="c"># Headers are scoped to the target URL only.</span>
<span class="c"># CF challenge endpoints and subresources are never intercepted.</span>`,

  sessions: `<span class="c"># Create an isolated browser session</span>
curl -s -X POST http://localhost:8191/sessions \\
  -H <span class="s">"Content-Type: application/json"</span> \\
  -d <span class="s">'{"id":"research"}'</span>

<span class="c"># Reuse cookies and browser storage</span>
curl -s -X POST http://localhost:8191/scrape \\
  -H <span class="s">"Content-Type: application/json"</span> \\
  -d <span class="s">'{"url":"https://nopecha.com/demo/cloudflare","sessionId":"research"}'</span>

<span class="c"># Close the session when done</span>
curl -s -X DELETE http://localhost:8191/sessions/research

<span class="c"># Sessions are process-local. Recreate them after restart or eviction.</span>`,

  prowlarr: `<span class="c"># Prowlarr → Settings → Indexers → FlareSolverr</span>
<span class="c"># Paste one of these into the FlareSolverr URL field:</span>

<span class="c"># running on this machine:</span>
<span class="s">http://localhost:8191</span>

<span class="c"># running in Docker alongside Prowlarr:</span>
<span class="s">http://trawl:8191</span>

<span class="c"># Use the FlareSolverr-compatible endpoint for requests and sessions.</span>`,
}
</script>

<template>
  <section id="usage" class="section">
    <div class="container">
      <p class="eyebrow">API usage</p>
      <h2 class="section-title">one engine. several ways in.</h2>

      <div
        v-motion
        :initial="{ opacity: 0, y: 20 }"
        :visible-once="{ opacity: 1, y: 0, transition: { duration: 400 } }"
        class="code-block"
      >
        <fieldset class="tabs">
          <legend class="sr-only">API example language</legend>
          <button
            type="button"
            v-for="tab in tabs"
            :key="tab.id"
            class="tab"
            :class="{ active: active === tab.id }"
            :aria-pressed="active === tab.id"
            @click="active = tab.id"
          >
            {{ tab.label }}
          </button>
          <div class="tab-spacer" />
          <span class="tab-hint">native API + /v1 compatibility</span>
        </fieldset>
        <pre class="code-body" aria-live="polite"><code v-html="code[active]" /></pre>
      </div>
    </div>
  </section>
</template>

<style scoped>
.section-title {
  font-size: clamp(22px, 3vw, 32px);
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--text);
  margin-bottom: 32px;
}

.code-block {
  border: 1px solid var(--border);
  overflow: hidden;
}

.tabs {
  min-width: 0;
  padding: 0;
  margin: 0;
  border: 0;
  display: flex;
  align-items: center;
  border-bottom: 1px solid var(--border);
  background: var(--bg-subtle);
  overflow-x: auto;
}

.tab {
  padding: 10px 18px;
  font-family: inherit;
  font-size: 11px;
  letter-spacing: 0.06em;
  color: var(--text-muted);
  background: transparent;
  border: none;
  border-right: 1px solid var(--border);
  cursor: pointer;
  white-space: nowrap;
  transition:
    color 0.12s,
    background-color 0.12s,
    border-color 0.12s;
}

.tab:hover {
  color: var(--text);
  background: var(--bg);
}

.tab.active {
  color: var(--accent);
  background: var(--accent-tint);
  border-bottom: 1px solid var(--accent);
}

.tab-spacer {
  flex: 1;
}

.tab-hint {
  font-size: 10px;
  letter-spacing: 0.04em;
  color: var(--border-strong);
  padding: 0 16px;
  white-space: nowrap;
}

.code-body {
  margin: 0;
  padding: 28px 32px;
  overflow-x: auto;
  background: var(--bg);
  font-size: 13px;
  line-height: 1.8;
  color: var(--text-muted);
}

.code-body :deep(.kw) {
  color: #a78bfa;
}
.code-body :deep(.s) {
  color: #86efac;
}
.code-body :deep(.n) {
  color: #fb923c;
}
.code-body :deep(.c) {
  color: var(--border-strong);
  font-style: italic;
}

@media (max-width: 600px) {
  .code-body {
    padding: 20px;
    font-size: 12px;
  }
}
</style>
