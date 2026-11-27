<script setup lang="ts">
import {
  featuredBenchmarks,
  formatDuration,
  formatMemory,
  resourceBenchmarks,
  type TimingMetric,
} from "../utils/benchmarks"

const views: { metric: TimingMetric; label: string }[] = [
  { metric: "repeatBestMs", label: "Best repeat" },
  { metric: "repeatMedianMs", label: "Repeat median" },
  { metric: "firstMedianMs", label: "First request median" },
]
const metric = shallowRef<TimingMetric>("repeatBestMs")
const productLabels: Record<string, string> = { trawl: "TRAWL", flaresolverr: "FlareSolverr", byparr: "Byparr" }
const metricLabel = computed(() => views.find((view) => view.metric === metric.value)?.label.toLowerCase())
const sites = computed(() =>
  featuredBenchmarks.map((site) => {
    const results = site.results.filter((result) => Object.hasOwn(productLabels, result.product))
    const maximum = Math.max(1, ...results.map((result) => result[metric.value] ?? 0))
    return {
      ...site,
      results: results.map((result) => ({
        ...result,
        ms: result[metric.value],
        width: `${((result[metric.value] ?? 0) / maximum) * 100}%`,
      })),
    }
  }),
)
</script>

<template>
  <div class="benchmark-results">
    <fieldset class="benchmark-controls">
      <legend class="sr-only">Benchmark timing metric</legend>
      <button
        v-for="view in views"
        :key="view.metric"
        type="button"
        :aria-pressed="metric === view.metric"
        @click="metric = view.metric"
      >
        {{ view.label }}
      </button>
    </fieldset>

    <div class="benchmark-grid">
      <article v-for="site in sites" :key="site.id" class="benchmark-card">
        <div class="benchmark-heading">
          <h3>{{ site.name }}</h3>
          <span>{{ site.protection }} · Request times</span>
        </div>
        <p class="trawl-timing">
          <span class="accent">{{ formatDuration(site.results[0]?.ms ?? null) }}</span>
          TRAWL · {{ metricLabel }}
        </p>
        <div v-for="result in site.results" :key="result.product" class="benchmark-result">
          <div class="benchmark-row" :class="{ accent: result.product === 'trawl' }">
            <span class="benchmark-name">{{ productLabels[result.product] }}</span>
            <template v-if="result.ms !== null">
              <span class="benchmark-track" aria-hidden="true">
                <span class="benchmark-bar" :style="{ width: result.width }" />
              </span>
              <span class="benchmark-time">{{ formatDuration(result.ms) }}</span>
            </template>
            <span v-else class="benchmark-unavailable">Not completed</span>
          </div>
        </div>
      </article>
    </div>

    <p class="benchmark-note">
      First visits and accepted-session repeats. Only verified page content counts; best times vary by site and
      connection.
    </p>

    <div class="resource-grid">
      <article
        v-for="result in resourceBenchmarks"
        :key="result.product"
        class="resource-card"
        :class="{ 'resource-trawl': result.product === 'trawl' }"
      >
        <h3>{{ productLabels[result.product] }}</h3>
        <dl>
          <div>
            <dt>CPU on matched requests</dt>
            <dd>{{ result.matchedCpuSeconds.toFixed(1) }}s</dd>
          </div>
          <div>
            <dt>Peak working RAM</dt>
            <dd>{{ formatMemory(result.peakWorkingBytes) }}</dd>
          </div>
          <div>
            <dt>Peak total memory</dt>
            <dd>{{ formatMemory(result.peakTotalBytes) }}</dd>
          </div>
        </dl>
      </article>
    </div>

    <p class="benchmark-note">
      Same machine and network. CPU compares requests completed by every tool; RAM covers the full test. TRAWL includes
      Redis.
      <a href="/benchmarks/latest.json" target="_blank" rel="noopener">Full measurements ↗</a>
    </p>
  </div>
</template>

<style scoped>
.benchmark-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 0 0 20px;
  padding: 0;
  border: 0;
  min-width: 0;
}

dl {
  margin: 20px 0 0;
}

dl > div {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 12px;
  margin-top: 12px;
  font-size: 10px;
}

dt {
  color: var(--text-muted);
}

dd {
  margin: 0;
  color: var(--text);
  font-weight: 600;
  white-space: nowrap;
}

.accent,
.resource-trawl dd {
  color: var(--accent);
}

.trawl-timing {
  margin: 0 0 24px;
  font-size: 10px;
  color: var(--text-muted);
}

.trawl-timing > span {
  display: block;
  margin-bottom: 8px;
  font-size: 28px;
  font-weight: 700;
}

.benchmark-unavailable {
  flex: 1;
  text-align: right;
  font-size: 11px;
}

.benchmark-controls button {
  border: 1px solid var(--border);
  background: var(--bg-subtle);
  color: var(--text-muted);
  padding: 8px 12px;
  font: inherit;
  font-size: 11px;
  cursor: pointer;
}

.benchmark-controls button[aria-pressed="true"] {
  color: var(--accent);
  border-color: var(--accent);
  background: var(--accent-tint);
}

.benchmark-controls button:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
}

.benchmark-grid,
.resource-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1px;
  background: var(--border);
  border: 1px solid var(--border);
}

.benchmark-card,
.resource-card {
  min-width: 0;
  background: var(--bg);
  padding: 24px;
}

.benchmark-heading {
  margin-bottom: 24px;
}

h3 {
  font-size: 12px;
  color: var(--text);
  margin: 0 0 8px;
}

.benchmark-heading > span {
  color: var(--text-muted);
  font-size: 10px;
}

.benchmark-result + .benchmark-result {
  margin-top: 16px;
}

.benchmark-row {
  display: flex;
  align-items: center;
  gap: 12px;
  color: var(--text-muted);
  font-size: 10px;
}

.benchmark-row.accent {
  color: var(--accent);
}

.benchmark-name {
  width: 150px;
  flex-shrink: 0;
}

.benchmark-track {
  flex: 1;
  min-width: 0;
  height: 4px;
  background: var(--border);
}

.benchmark-bar {
  display: block;
  height: 100%;
  background: currentColor;
}

.benchmark-time {
  width: 78px;
  flex-shrink: 0;
  text-align: right;
}

.benchmark-note {
  margin: 20px 0 28px;
  max-width: 950px;
  color: var(--text-muted);
  font-size: 10px;
  line-height: 1.8;
}

.benchmark-note a {
  color: var(--accent);
  text-decoration: underline;
  text-underline-offset: 3px;
}

.resource-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.resource-trawl {
  background: var(--accent-tint);
}

@media (max-width: 900px) {
  .benchmark-grid,
  .resource-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 420px) {
  .benchmark-card,
  .resource-card {
    padding: 20px 16px;
  }

  .benchmark-row {
    gap: 6px;
  }

  .benchmark-name {
    width: 118px;
  }

  .benchmark-time {
    width: 72px;
  }
}
</style>
