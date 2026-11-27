<script lang="ts" setup>
const colorMode = useColorMode()
const showScrollTop = shallowRef(false)
const controlsBottom = shallowRef(24)
let footer: HTMLElement | null = null

function toggleTheme() {
  colorMode.preference = colorMode.value === "dark" ? "light" : "dark"
}

function scrollToTop() {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
  window.scrollTo({ top: 0, behavior: reducedMotion ? "auto" : "smooth" })
}

function onScroll() {
  showScrollTop.value = window.scrollY > 400
  controlsBottom.value = footer ? Math.max(24, window.innerHeight - footer.getBoundingClientRect().top + 16) : 24
}

onMounted(() => {
  footer = document.getElementById("site-footer")
  onScroll()
  window.addEventListener("scroll", onScroll, { passive: true })
  window.addEventListener("resize", onScroll)
})
onUnmounted(() => {
  window.removeEventListener("scroll", onScroll)
  window.removeEventListener("resize", onScroll)
})
</script>

<template>
  <div class="floating-controls" :style="{ bottom: `${controlsBottom}px` }">
    <button
      type="button"
      class="float-btn float-theme"
      :title="colorMode.value === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'"
      :aria-label="colorMode.value === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'"
      @click="toggleTheme"
    >
      <span v-if="colorMode.value === 'dark'" aria-hidden="true">☀</span>
      <span v-else aria-hidden="true">◐</span>
    </button>

    <Transition name="slide-up">
      <button
        type="button"
        v-if="showScrollTop"
        class="float-btn float-scroll"
        title="Scroll to top"
        aria-label="Scroll to top"
        @click="scrollToTop"
      >
        ↑
      </button>
    </Transition>
  </div>
</template>

<style scoped>
.floating-controls {
  position: fixed;
  right: 24px;
  z-index: 200;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.float-btn {
  width: 36px;
  height: 36px;
  background: var(--bg-subtle);
  border: 1px solid var(--border);
  color: var(--text-muted);
  font-family: inherit;
  font-size: 15px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.float-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}

@media (max-width: 1100px) {
  .floating-controls {
    right: 8px;
  }
  .float-btn {
    width: 24px;
    height: 28px;
  }
}

.slide-up-enter-active,
.slide-up-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}
.slide-up-enter-from,
.slide-up-leave-to {
  opacity: 0;
  transform: translateY(10px);
}
</style>
