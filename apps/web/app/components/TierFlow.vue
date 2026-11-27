<script lang="ts" setup>
const tiers = [
  {
    num: "01",
    name: "Plain HTTP Fetch",
    time: "HTTP first",
    tag: "no browser",
    desc: "Fetch ordinary content directly, or replay accepted Cloudflare and Anubis clearance with the matching browser identity. No new browser page is needed when HTTP is accepted.",
  },
  {
    num: "02",
    name: "Cached Browser Session",
    time: "session reuse",
    tag: "redis hit",
    desc: "Restores solved cookies from Redis into a warm pooled browser. No challenge re-solve while the target accepts the session. Cache TTL is configurable; rejected sessions escalate.",
  },
  {
    num: "03",
    name: "Live Challenge Solve",
    time: "challenge-dependent",
    tag: "fresh context",
    desc: "A fresh Camoufox context runs the matching challenge flow, including Cloudflare and Anubis. Supported embedded widgets use their own solver and completion checks. Cookies are cached on success.",
  },
  {
    num: "04",
    name: "Residential Proxy",
    time: "challenge-dependent",
    tag: "optional",
    desc: "Same as Tier 3 but routed through a residential proxy. Only triggered after the direct or datacenter path fails, so paid residential bandwidth is used only when necessary.",
  },
]
</script>

<template>
  <section id="how-it-works" class="section">
    <div class="container">
      <p class="eyebrow">how it works</p>
      <h2 class="section-title">four tiers, one request.</h2>
      <p class="section-sub">
        TRAWL starts with the cheapest eligible path and escalates when needed. Accepted clearance sessions can avoid a
        fresh solve. A shared request deadline bounds fetching, browser work and captures.
      </p>

      <div class="tiers">
        <div
          v-for="(tier, i) in tiers"
          :key="tier.num"
          v-motion
          :initial="{ opacity: 0, x: -20 }"
          :visible-once="{ opacity: 1, x: 0, transition: { delay: i * 100, duration: 400 } }"
          class="tier-item"
        >
          <div class="tier-num">{{ tier.num }}</div>
          <div class="tier-body">
            <div class="tier-header">
              <span class="tier-name">{{ tier.name }}</span>
              <span class="tier-time">{{ tier.time }}</span>
              <span class="tier-tag">{{ tier.tag }}</span>
            </div>
            <p class="tier-desc">{{ tier.desc }}</p>
          </div>
          <div v-if="i < tiers.length - 1" class="tier-arrow">↓ escalates on failure</div>
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
  max-width: 580px;
  margin-bottom: 48px;
}

.tiers {
  display: flex;
  flex-direction: column;
  gap: 0;
  border: 1px solid var(--border);
}

.tier-item {
  position: relative;
  display: flex;
  gap: 28px;
  padding: 28px 32px;
  border-bottom: 1px solid var(--border);
  transition: background 0.12s;
}

.tier-item:last-child {
  border-bottom: none;
}
.tier-item:hover {
  background: var(--bg-subtle);
}

.tier-num {
  font-size: 28px;
  font-weight: 700;
  color: var(--border-strong);
  letter-spacing: -0.03em;
  line-height: 1;
  flex-shrink: 0;
  min-width: 36px;
}

.tier-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
}

.tier-header {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.tier-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
}

.tier-time {
  font-size: 11px;
  padding: 2px 8px;
  background: var(--accent-tint);
  color: var(--accent);
  border: 1px solid var(--accent);
  letter-spacing: 0.04em;
}

.tier-tag {
  font-size: 10px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-muted);
  padding: 2px 8px;
  border: 1px solid var(--border-strong);
}

.tier-desc {
  font-size: 12px;
  line-height: 1.75;
  color: var(--text-muted);
  max-width: 600px;
}

.tier-arrow {
  position: absolute;
  bottom: -13px;
  left: 32px;
  font-size: 10px;
  letter-spacing: 0.06em;
  color: var(--text-muted);
  background: var(--bg);
  padding: 0 8px;
  z-index: 1;
}

@media (max-width: 600px) {
  .tier-item {
    flex-direction: column;
    gap: 12px;
    padding: 20px;
  }
}
</style>
