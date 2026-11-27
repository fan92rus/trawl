<script lang="ts" setup>
const docsUrl = useDocsUrl()
</script>

<template>
  <section id="dashboard" class="section">
    <div class="container">
      <p class="eyebrow">local observability</p>
      <h2 class="section-title">every request. in view.</h2>
      <p class="section-lead">
        See what TRAWL handled, which tier succeeded and why a request failed. Persistent SQLite history survives
        container replacement when you mount the metrics volume.
      </p>
      <div class="dashboard-facts">
        <span>live activity</span><span>tier outcomes</span><span>failure causes</span><span>domain history</span
        ><span>JSON export</span>
      </div>
      <a
        class="dashboard-preview"
        href="/dashboard.png"
        target="_blank"
        rel="noopener"
        aria-label="Open the full dashboard screenshot"
      >
        <img
          src="/dashboard.png"
          alt="TRAWL dashboard with illustrative request history, tier outcomes and failure details"
          width="2048"
          height="4096"
          loading="lazy"
          decoding="async"
        />
      </a>
      <div class="dashboard-caption">
        <p>Illustrative traffic. Your dashboard shows requests handled by your own instance.</p>
        <a :href="`${docsUrl}/api-reference/health-stats#local-metrics-dashboard`">Dashboard setup and metrics ↗</a>
      </div>
    </div>
  </section>
</template>

<style scoped>
.dashboard-facts {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 24px;
  color: var(--accent);
  font-size: 11px;
  margin-bottom: 24px;
}
.dashboard-preview {
  display: block;
  border: 1px solid var(--border-strong);
  background: #0d0d10;
  overflow: hidden;
}
.dashboard-preview img {
  width: 100%;
  height: auto;
  display: block;
}
.dashboard-caption {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  margin-top: 16px;
  font-size: 11px;
  color: var(--text-muted);
}
.dashboard-caption a {
  color: var(--accent);
}
@media (max-width: 640px) {
  .dashboard-caption {
    flex-direction: column;
    gap: 10px;
  }
}
</style>
