import { sleep } from "../utils/deadline"
// Cloudflare Turnstile solver - handles both:
//
// 1. Interstitial mode: CF serves a full-page Turnstile challenge BEFORE
//    letting the user through. The challengeWait.ts loop handles this by
//    clicking the iframe widget while polling for cf_clearance.
//
// 2. Embedded mode: The page itself contains a <div class="cf-turnstile"> widget.
//    This is used by sites as a form protection (not as a page gate).
//    Solving it generates a turnstile token in the hidden input, which the
//    page's JS can then use to allow form submission or reveal content.
//
// Non-interactive mode: When Cloudflare determines the browser has a good
// risk score (Camoufox Firefox, residential IP, no automation signals), Turnstile
// auto-solves without any click - a spinner briefly appears then turns into
// a green checkmark.

import type { Page } from "patchright"

import { attemptTurnstileClick } from "../utils/challengeWait"

export async function solveTurnstile(page: Page, timeoutMs = 25_000, signal?: AbortSignal): Promise<boolean> {
  if (timeoutMs <= 0 || signal?.aborted) return false
  signal = signal
    ? AbortSignal.any([signal, AbortSignal.timeout(Math.max(1, timeoutMs))])
    : AbortSignal.timeout(Math.max(1, timeoutMs))
  const deadline = Date.now() + timeoutMs

  const verification = await observeTurnstile(page)
  try {
    let lastClick = 0
    while (Date.now() < deadline && !signal.aborted) {
      if (await verification.evaluate((state) => state.verified()).catch(() => false)) return true
      const now = Date.now()
      if (now - lastClick >= 2000 && deadline - now > 2000) {
        if (await attemptTurnstileClick(page, false).catch(() => false)) lastClick = now
      }
      await sleep(Math.min(250, Math.max(0, deadline - Date.now())), signal)
    }
    return false
  } finally {
    await verification.evaluate((state) => state.disconnect()).catch(() => {})
    await verification.dispose().catch(() => {})
  }
}

function observeTurnstile(page: Page) {
  return page.evaluateHandle(() => {
    const selector = '[name="cf-turnstile-response"]'
    const valid = (value: unknown) => typeof value === "string" && value.length > 10
    const hasToken = (root: ParentNode) =>
      (root instanceof Element && root.matches(selector) && valid((root as HTMLInputElement).value)) ||
      Array.from(root.querySelectorAll<HTMLInputElement>(selector)).some((field) => valid(field.value))
    let consumedToken = false
    // Mutation records retain removed inputs after a synchronous success callback.
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.removedNodes) {
          if (node instanceof Element && hasToken(node)) consumedToken = true
        }
      }
    })
    observer.observe(document, { childList: true, subtree: true })
    return {
      verified() {
        if (consumedToken || hasToken(document)) return true
        const api = (window as unknown as { turnstile?: { getResponse?: () => string } }).turnstile
        try {
          return valid(api?.getResponse?.())
        } catch {
          return false
        }
      },
      disconnect() {
        observer.disconnect()
      },
    }
  })
}
