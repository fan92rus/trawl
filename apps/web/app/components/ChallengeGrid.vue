<!-- biome-ignore-all lint/a11y/noNoninteractiveTabindex: The horizontally scrollable support table must be keyboard accessible. -->
<script lang="ts" setup>
const docsUrl = useDocsUrl()
const challenges = [
  {
    name: "Cloudflare interstitial",
    local: "Browser JS, Turnstile interaction and clearance recovery",
    external: "Site profile for supported Turnstile challenges",
    group: "Browser protection",
    description: "JavaScript interstitials and managed challenges",
    localLabel: "Built-in",
    externalLabel: "Profile",
    localTone: "native",
    externalTone: "profile",
  },
  {
    name: "Akamai Bot Manager",
    local: "Supported sensors and press-and-hold flows",
    external: "No dedicated external task",
    group: "Browser protection",
    description: "Sensor checks and press-and-hold challenges",
    localLabel: "Built-in",
    externalLabel: "Not offered",
    localTone: "native",
    externalTone: "unsupported",
  },
  {
    name: "Imperva / Incapsula",
    local: "Sensor-cookie flow; own interactive CAPTCHA unsupported locally",
    external: "Site profile required",
    group: "Browser protection",
    description: "Sensor cookies and interactive CAPTCHA walls",
    localLabel: "Partial",
    externalLabel: "Profile",
    localTone: "partial",
    externalTone: "profile",
  },
  {
    name: "DDoS-Guard",
    local: "JavaScript challenge and cookie recovery",
    external: "No dedicated external task",
    group: "Browser protection",
    description: "JavaScript checks and clearance cookies",
    localLabel: "Built-in",
    externalLabel: "Not offered",
    localTone: "native",
    externalTone: "unsupported",
  },
  {
    name: "AWS WAF",
    local: "Token challenge; interactive CAPTCHA detected separately",
    external: "Site profile for CAPTCHA",
    group: "Browser protection",
    description: "Silent token challenges or a visual CAPTCHA",
    localLabel: "Partial",
    externalLabel: "Profile",
    localTone: "partial",
    externalTone: "profile",
  },
  {
    name: "DataDome",
    local: "Device Check with the opt-in headful pool; slider and hard-block detection",
    external: "Site profile for slider CAPTCHA",
    group: "Browser protection",
    description: "Device Check, slider CAPTCHA and IP blocks",
    localLabel: "Partial",
    externalLabel: "Profile",
    localTone: "partial",
    externalTone: "profile",
  },
  {
    name: "Turnstile widget",
    local: "Shadow-DOM/frame interaction and response-token checks",
    external: "Automatic fallback for supported declarative widgets",
    group: "CAPTCHA widgets",
    description: "Embedded checkbox and invisible widgets",
    localLabel: "Built-in",
    externalLabel: "Automatic",
    localTone: "native",
    externalTone: "native",
  },
  {
    name: "reCAPTCHA v2",
    local: "Checkbox and audio solving",
    external: "Automatic fallback for supported declarative widgets",
    group: "CAPTCHA widgets",
    description: "Checkbox verification with audio fallback",
    localLabel: "Built-in",
    externalLabel: "Automatic",
    localTone: "native",
    externalTone: "native",
  },
  {
    name: "reCAPTCHA Enterprise / v3",
    local: "No dedicated built-in solver",
    external: "Declarative v2 Enterprise fallback; profiles for v3",
    group: "CAPTCHA widgets",
    description: "Enterprise v2 widgets and score-based v3",
    localLabel: "External only",
    externalLabel: "Automatic / profile",
    localTone: "unsupported",
    externalTone: "profile",
  },
  {
    name: "hCaptcha",
    local: "Auto-pass and audio where offered; no image-grid solver",
    external: "No external catalogue entry",
    group: "CAPTCHA widgets",
    description: "Auto-pass, audio or an interactive image grid",
    localLabel: "Partial",
    externalLabel: "Not offered",
    localTone: "partial",
    externalTone: "unsupported",
  },
  {
    name: "GeeTest Slide",
    local: "Puzzle matching with verified-state checks",
    external: "Site profile required",
    group: "CAPTCHA widgets",
    description: "Drag a puzzle piece into position",
    localLabel: "Built-in",
    externalLabel: "Profile",
    localTone: "native",
    externalTone: "profile",
  },
  {
    name: "ALTCHA / Friendly Captcha",
    local: "Native widget execution and response checks",
    external: "Site profile required",
    group: "Proof of work",
    description: "Cryptographic work performed in the browser",
    localLabel: "Built-in",
    externalLabel: "Profile",
    localTone: "native",
    externalTone: "profile",
  },
  {
    name: "CAP proof of work",
    local: "Native widget execution; verifies all visible widgets",
    external: "No external catalogue entry",
    group: "Proof of work",
    description: "Lightweight, self-hosted CAPTCHA widgets",
    localLabel: "Built-in",
    externalLabel: "Not offered",
    localTone: "native",
    externalTone: "unsupported",
  },
  {
    name: "Anubis",
    local: "Native JS proof of work and metarefresh handling",
    external: "No external catalogue entry",
    group: "Proof of work",
    description: "Browser proof of work before the real page loads",
    localLabel: "Built-in",
    externalLabel: "Not offered",
    localTone: "native",
    externalTone: "unsupported",
  },
  {
    name: "DuckDuckGo anomaly wall",
    local: "Detected as CAPTCHA-required; no local image-puzzle solver",
    external: "No dedicated external task",
    group: "Other detected walls",
    description: "Image-selection verification on search traffic",
    localLabel: "Detected only",
    externalLabel: "Not offered",
    localTone: "unsupported",
    externalTone: "unsupported",
  },
]
</script>

<template>
  <section id="captcha" class="section">
    <div class="container">
      <p class="eyebrow">challenge coverage</p>
      <h2 class="section-title">built to get past the wall.</h2>
      <p class="section-sub">
        Detect the protection, run the matching browser flow and check that it cleared. Built-in solvers handle
        supported challenges without a paid service; optional 2Captcha support adds another route when needed.
      </p>
      <div class="coverage-legend">
        <span><i class="legend-dot native" /> Built-in: a local solving flow</span>
        <span><i class="legend-dot partial" /> Partial: specific challenge variants</span>
        <span><i class="legend-dot profile" /> Profile: configure inputs for your site</span>
      </div>
      <section
        class="table-wrap"
        tabindex="0"
        aria-label="Challenge support table, scroll horizontally on small screens"
      >
        <table>
          <caption class="sr-only">
            TRAWL local challenge handling and optional external solver support
          </caption>
          <thead>
            <tr>
              <th class="col-name" scope="col">challenge / CAPTCHA</th>
              <th class="col-trawl" scope="col">local solving</th>
              <th scope="col">optional 2Captcha</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="(challenge, index) in challenges" :key="challenge.name">
              <tr v-if="index === 0 || challenges[index - 1]?.group !== challenge.group" class="group-row">
                <th colspan="3" scope="colgroup">{{ challenge.group }}</th>
              </tr>
              <tr>
                <th scope="row" class="col-name">
                  <span class="challenge-name">{{ challenge.name }}</span>
                  <span class="challenge-description">{{ challenge.description }}</span>
                </th>
                <td class="col-trawl">
                  <span class="support-state" :class="challenge.localTone">{{ challenge.localLabel }}</span>
                  <span class="support-detail">{{ challenge.local }}</span>
                </td>
                <td>
                  <span class="support-state" :class="challenge.externalTone">{{ challenge.externalLabel }}</span>
                  <span v-if="challenge.externalLabel !== 'Not offered'" class="support-detail">{{
                    challenge.external
                  }}</span>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </section>
      <p class="coverage-note">
        DataDome needs <code>BROWSER_HEADFUL_POOL_SIZE=1</code>, which adds a browser pool. IP blocks can require a
        different egress IP. A detected challenge or widget token does not guarantee target-server acceptance.
        <a :href="`${docsUrl}/architecture/tiered-execution`">See supported flows and limits.</a>
      </p>
      <details class="external-catalogue">
        <summary>More provider and puzzle tasks through site profiles</summary>
        <p>
          Arkose/FunCaptcha, Capy, KeyCaptcha, Lemin, CyberSiara, MTCaptcha, CutCaptcha, ATB, Tencent, Prosopo,
          CaptchaFox, VK, Yidun, Binance, Hunt, TSPD, Basilisk, Alibaba and Yandex SmartCaptcha.
        </p>
        <p>
          Profiles also support image/text/audio, rotation, coordinates, grids, drawing, bounding boxes, drag-and-drop,
          Temu, SmartCaptcha image, Pazl and VK image tasks. Each profile supplies task inputs, response delivery and
          verification for one exact hostname. SDK markers alone never start a paid task.
        </p>
        <p>
          2Captcha is disabled by default and requires an API key and credit. Profiles connect supported tasks to a
          specific site's widget and verification flow.
          <a :href="`${docsUrl}/getting-started/configuration#optional-external-captcha-solver`"
            >Configure the external solver.</a
          >
        </p>
      </details>
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

.table-wrap {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  border: 1px solid var(--border);
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
  min-width: 720px;
}

th,
td {
  padding: 12px 18px;
  text-align: left;
  border-bottom: 1px solid var(--border);
  white-space: normal;
}

thead th {
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

tbody tr:last-child td {
  border-bottom: none;
}

tbody tr:hover td {
  background: var(--bg-subtle);
}

/* Challenge name column - allow wrapping */
.col-name {
  white-space: normal;
  width: 31%;
  min-width: 200px;
  color: var(--text);
}

.challenge-name {
  display: block;
  font-weight: 600;
  color: var(--text);
  margin-bottom: 8px;
}

/* TRAWL column highlight */
.col-trawl {
  width: 38%;
  background: var(--accent-tint);
}

tbody tr:hover .col-trawl {
  width: 38%;
  background: color-mix(in srgb, var(--accent-tint) 160%, transparent);
}

.coverage-note {
  margin-top: 20px;
  max-width: 800px;
  font-size: 12px;
  line-height: 1.8;
  color: var(--text-muted);
}
.coverage-note a {
  color: var(--accent);
  text-decoration: underline;
  text-underline-offset: 3px;
}
.external-catalogue {
  margin-top: 24px;
  padding: 20px;
  border: 1px solid var(--border);
  font-size: 12px;
  color: var(--text-muted);
}
.external-catalogue summary {
  cursor: pointer;
  color: var(--text);
}
.external-catalogue p {
  margin-top: 16px;
  line-height: 1.8;
}

.coverage-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 24px;
  margin: -20px 0 24px;
  color: var(--text-muted);
  font-size: 10px;
  line-height: 1.7;
}
.legend-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  margin-right: 7px;
  background: currentColor;
}
.native {
  color: var(--accent);
}
.partial {
  color: #d99941;
}
.profile {
  color: var(--text);
}
.unsupported {
  color: var(--text-muted);
}
.support-state {
  display: block;
  margin-bottom: 8px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.support-detail,
.challenge-description {
  display: block;
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 400;
  line-height: 1.75;
}
.group-row th {
  padding: 10px 18px;
  background: var(--bg-subtle);
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
</style>
