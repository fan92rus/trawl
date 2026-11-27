<script lang="ts" setup>
type CellTone = "check" | "cross" | "partial"
interface ComparisonCell {
  text: string
  tone: CellTone
}

const statusMarks: Record<CellTone, string> = { check: "✓", partial: "~", cross: "✗" }
const cell = (tone: CellTone, text: string): ComparisonCell => ({ text, tone })

const rows = [
  {
    icon: "⬡",
    feature: "Adaptive routing",
    trawl: cell("check", "HTTP → cache → browser → residential"),
    flaresolver: cell("cross", "Browser only"),
    byparr: cell("cross", "Browser only"),
  },
  {
    icon: "⇄",
    feature: "Challenge proxy",
    trawl: cell("check", "HTTP/S, WebSockets, Range"),
    flaresolver: cell("cross", "API only"),
    byparr: cell("cross", "API + web loader"),
  },
  {
    icon: "↝",
    feature: "Proxy escalation",
    trawl: cell("check", "Automatic fallback to a residential proxy"),
    flaresolver: cell("partial", "Manual proxy selection"),
    byparr: cell("partial", "Manual proxy selection"),
  },
  {
    icon: "◎",
    feature: "Domain clearance cache",
    trawl: cell("check", "Accepted sessions cached by domain"),
    flaresolver: cell("partial", "Explicit named sessions"),
    byparr: cell("cross", "No shared domain cache"),
  },
  {
    icon: "▣",
    feature: "Warm browser pool",
    trawl: cell("check", "Configurable pool; one browser by default"),
    flaresolver: cell("partial", "Temporary or named-session browsers"),
    byparr: cell("cross", "Browser created per request"),
  },
  {
    icon: "⟳",
    feature: "Pool recovery",
    trawl: cell("check", "Health checks, recycling and crash recovery"),
    flaresolver: cell("cross", "No shared warm pool"),
    byparr: cell("cross", "No shared warm pool"),
  },
  {
    icon: "⊕",
    feature: "Target request headers",
    trawl: cell("check", "Custom headers across all scraping tiers"),
    flaresolver: cell("cross", "Parameter deprecated; not forwarded"),
    byparr: cell("cross", "No target-header field"),
  },
  {
    icon: "◎",
    feature: "Browser sessions",
    trawl: cell("check", "Native, MCP and /v1; domain cache"),
    flaresolver: cell("partial", "Permanent /v1 sessions"),
    byparr: cell("partial", "FlareSolverr-compatible request API"),
  },
  {
    icon: "◈",
    feature: "Browser engine",
    trawl: cell("check", "Camoufox Firefox"),
    flaresolver: cell("check", "Chrome + undetected-chromedriver"),
    byparr: cell("check", "InvisiblePlaywright"),
  },
  {
    icon: "◇",
    feature: "Native MCP",
    trawl: cell("check", "Six Streamable HTTP MCP tools"),
    flaresolver: cell("cross", "Not documented"),
    byparr: cell("cross", "Not documented; Open WebUI loader"),
  },
  {
    icon: "▣",
    feature: "Local dashboard",
    trawl: cell("check", "Persistent metrics and live history"),
    flaresolver: cell("cross", "No documented dashboard; Prometheus metrics"),
    byparr: cell("cross", "Not documented"),
  },
  {
    icon: "⊕",
    feature: "Page outputs",
    trawl: cell("check", "HTML, Markdown, CSS-selected JSON, screenshots"),
    flaresolver: cell("partial", "HTML, cookies and screenshots"),
    byparr: cell("partial", "HTML, cookies and Open WebUI loader"),
  },
  {
    icon: "⬡",
    feature: "Dedicated challenge flows",
    trawl: cell("check", "Cloudflare, Akamai, Imperva, Anubis and more"),
    flaresolver: cell("partial", "Cloudflare and DDoS-Guard"),
    byparr: cell("partial", "Cloudflare interstitial and Turnstile"),
  },
  {
    icon: "○",
    feature: "Paid solver",
    trawl: cell("check", "Local first; optional 2Captcha"),
    flaresolver: cell("partial", "Not required for browser solving"),
    byparr: cell("partial", "Not required for browser solving"),
  },
]
</script>

<template>
  <section id="compare" class="section">
    <div class="container">
      <p class="eyebrow">benchmarks</p>
      <h2 class="section-title">Clear Cloudflare. Keep the next request fast.</h2>
      <p class="section-lead">
        Real sites behind Cloudflare interstitials, tested through the same API. Reuse accepted sessions and get the
        page content without repeating the expensive work.
      </p>

      <BenchmarkResults />
      <p class="benchmark-note comparison-source">
        Green: included. Orange: a different or more limited approach. Muted: no dedicated functionality.
      </p>

      <div class="table-wrap" style="margin-top: 56px;">
        <table>
          <caption class="sr-only">
            Feature comparison across TRAWL, FlareSolverr, and Byparr
          </caption>
          <colgroup>
            <col class="feature-width" />
            <col class="trawl-width" />
            <col class="competitor-width" />
            <col class="competitor-width" />
          </colgroup>
          <thead>
            <tr>
              <th>capability</th>
              <th class="col-trawl"><span class="accent">TRAWL</span></th>
              <th>FlareSolverr</th>
              <th>Byparr</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="row.feature">
              <td class="feature-col">
                <span class="feature-icon" aria-hidden="true">{{ row.icon }}</span>{{ row.feature }}
              </td>
              <td class="col-trawl">
                <span :class="row.trawl.tone"
                  ><span class="status-mark">{{ statusMarks[row.trawl.tone] }}</span>{{ row.trawl.text }}</span
                >
              </td>
              <td>
                <span :class="row.flaresolver.tone"
                  ><span class="status-mark">{{ statusMarks[row.flaresolver.tone] }}</span>
                  {{ row.flaresolver.text }}</span
                >
              </td>
              <td>
                <span :class="row.byparr.tone"
                  ><span class="status-mark">{{ statusMarks[row.byparr.tone] }}</span>{{ row.byparr.text }}</span
                >
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>
</template>

<style scoped>
.section-title {
  font-size: clamp(22px, 3vw, 34px);
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--text);
  margin-bottom: 12px;
}

.section-lead {
  font-size: 13px;
  line-height: 1.75;
  color: var(--text-muted);
  max-width: 650px;
  margin-bottom: 24px;
}

.benchmark-note {
  color: var(--text-muted);
  font-size: 10px;
  line-height: 1.6;
}

.benchmark-note {
  max-width: 950px;
  margin-top: 24px;
}
.comparison-source {
  margin-top: 16px;
}

/* ── Feature table ── */
.table-wrap {
  overflow-x: auto;
  border: 1px solid var(--border);
}

table {
  width: 100%;
  table-layout: fixed;
  min-width: 760px;
  border-collapse: collapse;
  font-size: 12px;
}

.feature-width {
  width: 19%;
}

.trawl-width {
  width: 31%;
}

.competitor-width {
  width: 25%;
}

th,
td {
  padding: 11px 14px;
  text-align: left;
  border-bottom: 1px solid var(--border);
  white-space: normal;
  line-height: 1.75;
  vertical-align: top;
}

th {
  font-size: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-muted);
  background: var(--bg-subtle);
  font-weight: 600;
}

td {
  color: var(--text-muted);
}

.feature-col {
  color: var(--text);
  font-weight: 500;
  white-space: normal;
}

.feature-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  margin-right: 8px;
  color: var(--accent);
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
  vertical-align: middle;
}

.col-trawl {
  background: var(--accent-tint);
}

tr:last-child td {
  border-bottom: none;
}
tr:hover td {
  background: var(--bg-subtle);
}
tr:hover .col-trawl {
  background: color-mix(in srgb, var(--accent-tint) 150%, transparent);
}

.check {
  color: var(--accent);
  font-weight: 600;
}
.cross {
  color: var(--text-muted);
  opacity: 0.4;
}
.partial {
  color: #f59e0b;
}

.status-mark {
  display: inline-block;
  width: 16px;
  font-weight: 700;
}

@media (max-width: 800px) {
  table {
    min-width: 860px;
    table-layout: auto;
  }
}
.benchmark-note a {
  color: var(--accent);
  text-decoration: underline;
  text-underline-offset: 3px;
}
</style>
