<script lang="ts" setup>
import { siteDescription as description, siteTitle } from "./utils/site"

useSchemaOrg([
  defineWebPage({
    name: `TRAWL - ${siteTitle}`,
    description,
  }),
  defineSoftwareApp({
    name: "TRAWL",
    description,
    applicationCategory: "DeveloperApplication",
    operatingSystem: "Linux, Docker",
    license: "https://www.gnu.org/licenses/agpl-3.0.html",
    author: {
      "@type": "Person",
      name: "germondai",
      url: "https://github.com/germondai",
    },
    offers: {
      "@type": "Offer",
      price: 0,
      priceCurrency: "USD",
    },
  }),
])
</script>

<template>
  <div class="layout">
    <a class="skip-link" href="#main-content">Skip to content</a>
    <NavBar />
    <main id="main-content" tabindex="-1">
      <HeroSection />
      <EcosystemBanner />
      <StatsBar />
      <FeaturesGrid />
      <TierFlow />
      <CompareTable />
      <ChallengeGrid />
      <ProxySection />
      <AgentSection />
      <DashboardSection />
      <CtaSection />
      <CodeExample />
    </main>
    <FooterBar />
    <FloatingButtons />
  </div>
</template>

<style>
/* ── CSS custom properties ── */
:root {
  color-scheme: light;
  --bg: #fafafa;
  --bg-subtle: #f4f4f5;
  --surface: #ffffff;
  --border: #e4e4e7;
  --border-strong: #d4d4d8;
  --text: #09090b;
  --text-muted: #71717a;
  --accent: #00b85e;
  --accent-tint: rgba(0, 184, 94, 0.08);
  --accent-glow: rgba(0, 184, 94, 0.25);
  --shadow: 0 1px 3px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04);
}

.dark {
  color-scheme: dark;
  --bg: #0d0d10;
  --bg-subtle: #17171b;
  --surface: #1c1c21;
  --border: #2a2a30;
  --border-strong: #404048;
  --text: #f0f0f2;
  --text-muted: #9898a6;
  --accent: #00e87a;
  --accent-tint: rgba(0, 232, 122, 0.09);
  --accent-glow: rgba(0, 232, 122, 0.22);
  --shadow: 0 1px 3px rgba(0, 0, 0, 0.4), 0 1px 2px rgba(0, 0, 0, 0.3);
}

/* ── Base reset ── */
*,
*::before,
*::after {
  box-sizing: border-box;
}

html {
  background: var(--bg);
  color: var(--text);
  font-family: "Geist Mono", "JetBrains Mono", "Fira Code", ui-monospace, monospace;
  font-size: 14px;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
  scroll-behavior: smooth;
  transition:
    background 0.2s,
    color 0.2s;
}

body {
  margin: 0;
}

a {
  color: inherit;
  text-decoration: none;
}
button {
  font-family: inherit;
  cursor: pointer;
}

:where(a, button, [tabindex]):focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
}
h1,
h2,
h3,
h4,
h5,
h6 {
  font-family: inherit;
  margin: 0;
}
pre,
code {
  font-family: inherit;
}
img {
  display: block;
  max-width: 100%;
}
p {
  margin: 0;
}

/* ── Layout ── */
.layout {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
}
main {
  flex: 1;
  padding-top: 60px;
}

.skip-link {
  position: fixed;
  top: 8px;
  left: 8px;
  z-index: 1000;
  padding: 8px 12px;
  color: #080808;
  background: var(--accent);
  transform: translateY(-150%);
}

.skip-link:focus {
  transform: translateY(0);
}

/* ── Shared section wrapper ── */
.section {
  padding: 80px 0;
  border-top: 1px solid var(--border);
}

[id] {
  scroll-margin-top: 76px;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.container {
  max-width: 1100px;
  margin: 0 auto;
  padding: 0 24px;
}

/* ── Section label ── */
.eyebrow {
  font-size: 11px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-muted);
  margin-bottom: 32px;
}

.section-title {
  font-size: clamp(22px, 3vw, 34px);
  font-weight: 700;
  letter-spacing: -0.02em;
  margin-bottom: 12px;
}
.section-lead {
  font-size: 13px;
  line-height: 1.8;
  color: var(--text-muted);
  max-width: 700px;
  margin-bottom: 32px;
}

/* ── Accent highlight ── */
.accent {
  color: var(--accent);
}

/* ── Buttons ── */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 22px;
  font-family: inherit;
  font-size: 12px;
  letter-spacing: 0.06em;
  cursor: pointer;
  transition:
    color 0.15s,
    background-color 0.15s,
    border-color 0.15s,
    opacity 0.15s;
  border: 1px solid transparent;
  white-space: nowrap;
}

.btn-primary {
  background: var(--accent);
  color: #080808;
  border-color: var(--accent);
}
.btn-primary:hover {
  opacity: 0.88;
}

.btn-outline {
  background: transparent;
  color: var(--text);
  border-color: var(--border-strong);
}
.btn-outline:hover {
  border-color: var(--accent);
  color: var(--accent);
}

/* ── Page transition ── */
.page-enter-active,
.page-leave-active {
  transition: opacity 0.2s;
}
.page-enter-from,
.page-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  html {
    scroll-behavior: auto;
  }

  *,
  *::before,
  *::after {
    scroll-behavior: auto;
    animation-duration: 0.01ms;
    animation-iteration-count: 1;
    transition-duration: 0.01ms;
  }
}

/* ── Mobile globals ── */
@media (max-width: 640px) {
  .section {
    padding: 48px 0;
  }
  .container {
    padding: 0 16px;
  }
  .eyebrow {
    margin-bottom: 20px;
  }
}

/* ── Scrollbar ── */
::-webkit-scrollbar {
  width: 6px;
}
::-webkit-scrollbar-track {
  background: var(--bg);
}
::-webkit-scrollbar-thumb {
  background: var(--border-strong);
}
</style>
