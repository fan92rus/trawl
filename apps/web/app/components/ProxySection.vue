<script lang="ts" setup>
const docsUrl = useDocsUrl()
</script>

<template>
  <section id="proxy" class="section proxy-section">
    <div class="container">
      <p class="eyebrow">challenge-aware proxy</p>
      <h2 class="section-title">one proxy. challenge-aware by default.</h2>
      <p class="section-sub">
        Enable MITM_ENABLED=true and point your HTTP-compatible client at port 8192. Normal traffic takes the direct
        path; detected challenge pages automatically escalate through TRAWL's browser solver and return the resolved
        response.
      </p>

      <div class="proxy-panel">
        <div
          v-motion
          :initial="{ opacity: 0, x: -20 }"
          :visible-once="{ opacity: 1, x: 0, transition: { duration: 450 } }"
          class="proxy-flow"
        >
          <div class="flow-row">
            <span class="flow-node">your client</span>
            <span class="flow-arrow">→</span>
            <span class="flow-node flow-node-accent">:8192</span>
            <span class="flow-arrow">→</span>
            <span class="flow-node">direct web</span>
          </div>
          <div class="flow-branch">
            <span class="branch-line">└─ challenge detected</span>
            <span class="flow-arrow">→</span>
            <span class="flow-node flow-node-accent">tier solver</span>
            <span class="flow-arrow">→</span>
            <span class="flow-node">resolved response</span>
          </div>

          <div class="proxy-code">
            <span class="code-prompt">$</span>
            <code>curl --cacert trawl-ca.crt --proxy http://localhost:8192 https://nopecha.com/demo/cloudflare</code>
          </div>
        </div>

        <div
          v-motion
          :initial="{ opacity: 0, x: 20 }"
          :visible-once="{ opacity: 1, x: 0, transition: { duration: 450, delay: 100 } }"
          class="proxy-capabilities"
        >
          <div class="capability">
            <span class="capability-mark">✓</span>
            <span><strong>General traffic</strong> HTTP, HTTPS, WebSockets, binary files, and downloads.</span>
          </div>
          <div class="capability">
            <span class="capability-mark">✓</span>
            <span><strong>Complete requests</strong> Authentication, cookies, custom headers, and request bodies.</span>
          </div>
          <div class="capability">
            <span class="capability-mark">✓</span>
            <span><strong>Download semantics</strong> Range requests, 206 responses, and large-file streaming.</span>
          </div>
          <div class="capability">
            <span class="capability-mark">✓</span>
            <span><strong>Automatic escalation</strong> Browser work starts only after a challenge is detected.</span>
          </div>
        </div>
      </div>

      <p class="proxy-note">
        HTTPS interception requires the generated TRAWL CA certificate to be trusted by the client.
        <a :href="`${docsUrl}/proxy/ca-installation`" target="_blank" rel="noopener noreferrer">
          installation guide ↗
        </a>
      </p>
    </div>
  </section>
</template>

<style scoped>
.section-title {
  margin-bottom: 12px;
  color: var(--text);
  font-size: clamp(22px, 3vw, 34px);
  font-weight: 700;
  letter-spacing: -0.02em;
}

.section-sub {
  max-width: 720px;
  margin-bottom: 42px;
  color: var(--text-muted);
  font-size: 13px;
  line-height: 1.75;
}

.proxy-panel {
  overflow: hidden;
  display: grid;
  grid-template-columns: 1.15fr 0.85fr;
  border: 1px solid var(--border-strong);
  background: var(--bg);
}

.proxy-flow,
.proxy-capabilities {
  padding: 34px;
}

.proxy-flow {
  display: flex;
  min-width: 0;
  flex-direction: column;
  justify-content: center;
  border-right: 1px solid var(--border);
}

.flow-row,
.flow-branch {
  display: flex;
  align-items: center;
  gap: 10px;
  white-space: nowrap;
}

.flow-branch {
  margin: 16px 0 0 72px;
}

.flow-node {
  padding: 7px 10px;
  border: 1px solid var(--border-strong);
  color: var(--text);
  font-size: 10px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.flow-node-accent {
  border-color: var(--accent);
  background: var(--accent-tint);
  color: var(--accent);
}

.flow-arrow,
.branch-line {
  color: var(--text-muted);
  font-size: 11px;
}

.proxy-code {
  display: flex;
  gap: 10px;
  overflow-x: auto;
  margin-top: 32px;
  padding: 14px 16px;
  border: 1px solid var(--border);
  background: var(--bg-subtle);
  color: var(--text-muted);
  font-size: 11px;
  white-space: nowrap;
}

.code-prompt,
.capability-mark {
  color: var(--accent);
}

.proxy-capabilities {
  min-width: 0;
  overflow-wrap: anywhere;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 22px;
}

.capability {
  display: grid;
  grid-template-columns: 16px 1fr;
  gap: 10px;
  color: var(--text-muted);
  font-size: 11px;
  line-height: 1.7;
}

.capability strong {
  display: block;
  color: var(--text);
  font-size: 11px;
  font-weight: 600;
}

.proxy-note {
  margin-top: 16px;
  color: var(--text-muted);
  font-size: 10px;
  line-height: 1.6;
}

.proxy-note a {
  color: var(--accent);
}

@media (max-width: 1100px) {
  .proxy-panel {
    grid-template-columns: 1fr;
  }

  .proxy-flow {
    border-right: 0;
    border-bottom: 1px solid var(--border);
  }
}

@media (max-width: 800px) {
  .proxy-flow,
  .proxy-capabilities {
    padding: 24px 20px;
  }

  .flow-branch {
    margin-left: 0;
  }
}

@media (max-width: 560px) {
  .flow-row,
  .flow-branch {
    align-items: flex-start;
    flex-direction: column;
  }

  .flow-arrow {
    transform: rotate(90deg);
  }
}
</style>
