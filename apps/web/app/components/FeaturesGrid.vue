<script lang="ts" setup>
const features = [
  {
    icon: "⬡",
    title: "Adaptive tier engine",
    badge: "HTTP first",
    featured: true,
    desc: "Start with HTTP and reuse accepted Cloudflare or Anubis clearance without opening a page. Escalate to browser solving and an optional residential proxy when needed.",
  },
  {
    icon: "⇄",
    title: "MCP for AI agents",
    badge: "6 tools",
    featured: true,
    desc: "Read Markdown or text, scrape HTML, extract JSON records, capture screenshots and inspect browser activity. Connect any Streamable HTTP MCP client to known public URLs.",
  },
  {
    icon: "◎",
    title: "Isolated browser sessions",
    badge: "v1.8.0",
    featured: true,
    desc: "Keep cookies, localStorage and sessionStorage across native, MCP and FlareSolverr-compatible requests. Sessions have capacity and idle limits and can be invalidated under memory pressure.",
  },
  {
    icon: "▣",
    title: "Local metrics dashboard",
    badge: "live",
    featured: false,
    desc: "Persistent request history, winning tiers, failure causes and timings at /dashboard. Live updates and JSON export, with stored URLs limited to domains.",
  },
  {
    icon: "⟁",
    title: "Browser challenge flows",
    badge: "native",
    featured: false,
    desc: "Provider-specific handling for Cloudflare, Akamai, Imperva, DDoS-Guard, AWS WAF, DataDome and Anubis. Persistent walls are reported as failures.",
  },
  {
    icon: "⬢",
    title: "Built-in CAPTCHA solvers",
    badge: "local first",
    featured: false,
    desc: "Turnstile, reCAPTCHA v2 audio, hCaptcha auto-pass/audio, GeeTest Slide, ALTCHA, Friendly Captcha and CAP. Support depends on the widget variant.",
  },
  {
    icon: "↝",
    title: "Optional external solver",
    badge: "2Captcha",
    featured: false,
    desc: "Paid fallback for supported declarative reCAPTCHA v2/Enterprise and standalone Turnstile. Other catalogue tasks use hostname-specific profiles; disabled by default.",
  },
  {
    icon: "⇄",
    title: "Challenge-aware proxy",
    badge: "HTTP / HTTPS",
    featured: false,
    desc: "Forward ordinary traffic directly. Detected walls use the same scraping tiers. WebSockets, binary streaming and Range requests retain direct proxy semantics.",
  },
  {
    icon: "◈",
    title: "Camoufox Firefox",
    badge: "browser",
    featured: false,
    desc: "Firefox with fingerprint patches at the C++/Juggler level. Browser identity and solved domain sessions can be reused when the target accepts them.",
  },
  {
    icon: "⟳",
    title: "Resource-aware lifecycle",
    badge: "configurable",
    featured: false,
    desc: "Shared deadlines, cancellation cleanup, crash recovery and memory-aware recycling. Start with one warm browser; optional idle retirement and ad-blocking controls tune the workload.",
  },
  {
    icon: "⊕",
    title: "Extraction and captures",
    badge: "native + MCP",
    featured: false,
    desc: "Wait for visible content, extract CSS-selected records and capture a viewport, full page or element. Native requests can also collect bounded network and console diagnostics.",
  },
  {
    icon: "◇",
    title: "FlareSolverr compatibility",
    badge: "/v1",
    featured: false,
    desc: "Connect Prowlarr or Jackett through the familiar request and session API. Point your integration at TRAWL and keep your existing indexer configuration.",
  },
]
</script>

<template>
  <section id="features" class="section">
    <div class="container">
      <p class="eyebrow">capabilities</p>
      <h2 class="section-title">one engine for the protected web.</h2>
      <p class="section-sub">
        APIs for applications, MCP for agents, browser sessions for repeat work and a dashboard for everything TRAWL
        handles.
      </p>

      <div class="features-grid">
        <div
          v-for="(f, i) in features"
          :key="f.title"
          v-motion
          :initial="{ opacity: 0, y: 24 }"
          :visible-once="{ opacity: 1, y: 0, transition: { delay: i * 50, duration: 400 } }"
          class="feature-card"
          :class="{ featured: f.featured }"
        >
          <div class="feature-icon">{{ f.icon }}</div>
          <div class="feature-body">
            <h3 class="feature-title">
              {{ f.title }}
              <span v-if="f.badge" class="feature-badge">{{ f.badge }}</span>
            </h3>
            <p class="feature-desc">{{ f.desc }}</p>
          </div>
        </div>
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

.section-sub {
  font-size: 13px;
  line-height: 1.75;
  color: var(--text-muted);
  max-width: 500px;
  margin-bottom: 48px;
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1px;
  background: var(--border);
}

.feature-card {
  background: var(--bg);
  padding: 32px 28px;
  display: flex;
  gap: 18px;
  transition:
    background 0.15s,
    border-color 0.15s;
  border: 1px solid transparent;
  position: relative;
}

.feature-card:hover {
  background: var(--accent-tint);
  border-color: var(--accent);
  z-index: 1;
}

.feature-card.featured::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--accent);
}

.feature-icon {
  font-size: 16px;
  color: var(--accent);
  flex-shrink: 0;
  margin-top: 2px;
}

.feature-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

@media (min-width: 901px) {
  .feature-card:last-child:nth-child(3n + 1) {
    grid-column: 1 / -1;
  }

  .feature-card:last-child:nth-child(3n + 1) .feature-body {
    max-width: 720px;
  }
}

.feature-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text);
  letter-spacing: 0.02em;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.feature-badge {
  font-size: 9px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: 2px 6px;
  background: var(--accent-tint);
  color: var(--accent);
  border: 1px solid var(--accent);
}

.feature-desc {
  font-size: 12px;
  line-height: 1.75;
  color: var(--text-muted);
}

@media (max-width: 900px) {
  .features-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
@media (max-width: 600px) {
  .features-grid {
    grid-template-columns: 1fr;
  }
  .feature-card {
    padding: 24px 20px;
  }
}
</style>
