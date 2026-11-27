<script lang="ts" setup>
const apps = [
  { name: "Prowlarr" },
  { name: "Jackett" },
  { name: "Sonarr" },
  { name: "Radarr" },
  { name: "Lidarr" },
  { name: "Readarr" },
  { name: "Whisparr" },
]
</script>

<template>
  <div class="eco-banner">
    <div class="container eco-inner">
      <span class="eco-label">FlareSolverr v2 compatible -</span>
      <div class="eco-apps">
        <span v-for="(app, i) in apps" :key="app.name" class="eco-app" :style="{ animationDelay: `${i * 0.5}s` }">{{
          app.name
        }}</span>
      </div>
      <span class="eco-label">- connect with a single URL change</span>
    </div>
  </div>
</template>

<style scoped>
.eco-banner {
  border-top: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
  background: var(--bg-subtle);
  padding: 16px 0;
}

.eco-inner {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.eco-label {
  font-size: 11px;
  color: var(--text-muted);
  letter-spacing: 0.05em;
  white-space: nowrap;
}

.eco-apps {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}

.eco-app {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border: 1px solid var(--border);
  background: var(--surface);
  font-size: 11px;
  font-weight: 500;
  color: var(--text);
  letter-spacing: 0.04em;
  animation: train-pulse 3.5s ease-in-out infinite;
}

@media (max-width: 640px) {
  .eco-inner {
    flex-direction: column;
    align-items: center;
    gap: 10px;
    text-align: center;
  }
  .eco-label {
    white-space: normal;
  }
  .eco-apps {
    justify-content: center;
  }
}

@keyframes train-pulse {
  0%,
  100% {
    border-color: var(--border);
    color: var(--text);
    background: var(--surface);
  }
  10% {
    border-color: var(--accent);
    color: var(--accent);
    background: var(--accent-tint);
  }
  20% {
    border-color: var(--border);
    color: var(--text);
    background: var(--surface);
  }
}
</style>
