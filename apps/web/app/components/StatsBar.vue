<script lang="ts" setup>
import { repeatSpeedup } from "../utils/benchmarks"

const cells = [
  { value: "4", prefix: "", suffix: "", label: "execution tiers" },
  { value: "1", prefix: "", suffix: "", label: "warm browser by default" },
  {
    value: repeatSpeedup ?? "n/a",
    prefix: "",
    suffix: repeatSpeedup ? "×" : "",
    label: "faster repeat median vs FlareSolverr on 1337x · default /v1",
  },
  { value: "0", prefix: "", suffix: "", label: "paid solvers required" },
]
</script>

<template>
  <section class="section stats-bar">
    <div class="stats-grid">
      <div
        v-for="(cell, i) in cells"
        :key="cell.label"
        v-motion
        :initial="{ opacity: 0, y: 16 }"
        :visible-once="{ opacity: 1, y: 0, transition: { delay: i * 80, duration: 400 } }"
        class="stat-cell"
      >
        <div class="stat-value">{{ cell.prefix }}<span class="accent">{{ cell.value }}</span>{{ cell.suffix }}</div>
        <div class="stat-label">{{ cell.label }}</div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.stats-bar {
  padding: 0;
}

.stats-grid {
  max-width: 1100px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  border-left: 1px solid var(--border);
}

.stat-cell {
  padding: 40px 32px;
  border-right: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.stat-value {
  font-size: clamp(28px, 4vw, 40px);
  font-weight: 700;
  letter-spacing: -0.03em;
  line-height: 1;
  color: var(--text);
}

.stat-label {
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-muted);
}

@media (max-width: 700px) {
  .stats-grid {
    grid-template-columns: 1fr 1fr;
    border-left: none;
  }
  .stat-cell {
    padding: 28px 20px;
  }
}

@media (max-width: 400px) {
  .stat-value {
    font-size: clamp(22px, 8vw, 32px);
  }
  .stat-cell {
    padding: 22px 14px;
  }
}
</style>
