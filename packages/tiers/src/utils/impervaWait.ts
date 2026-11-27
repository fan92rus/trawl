// Imperva/Incapsula sensor-cookie wait - mirrors challengeWait.ts's CF polling loop.
// Imperva's reese84 (current) / ___utmvc (legacy) cookies are produced by an obfuscated
// in-page JS challenge that a real browser executing real JS satisfies without any
// challenge-specific logic - we just wait for the cookie and let the page proceed.
//
// Known risk: unlike CF Turnstile, Imperva's script sometimes layers in TLS/JA3 and
// behavioral checks beyond plain cookie generation - success isn't guaranteed just
// because we're a real browser. Validate against a real Imperva-protected site.

import type { Page } from "patchright"
import { sleep } from "./deadline"
import { hasImpervaChallenge } from "./detect"

export async function waitForImpervaResolution(
  page: Page,
  timeoutMs: number,
  originalUrl?: string,
): Promise<"ok" | "ip-blocked" | "timeout"> {
  if (timeoutMs <= 0) return "timeout"
  const deadline = Date.now() + timeoutMs
  const remaining = () => Math.max(0, deadline - Date.now())
  let sensorCookieAt: number | undefined

  const targetHost = (() => {
    try {
      return new URL(originalUrl ?? page.url()).hostname
    } catch {
      return ""
    }
  })()

  const earlyHtml = await page.content().catch(() => "")
  if (earlyHtml.trim() && !hasImpervaChallenge(earlyHtml)) {
    await page.waitForLoadState("networkidle", { timeout: Math.max(1, Math.min(5000, remaining())) }).catch(() => {})
    return "ok"
  }

  // Let Imperva's sensor JS boot up before polling
  await sleep(Math.min(1000, remaining()))

  while (Date.now() < deadline) {
    try {
      const html = await page.content().catch(() => "")
      if (html.trim() && !hasImpervaChallenge(html)) {
        await page.waitForLoadState("load", { timeout: Math.max(1, Math.min(5000, remaining())) }).catch(() => {})
        return "ok"
      }

      const cookies: Array<{ name: string; domain: string }> = await page
        .context()
        .cookies()
        .catch(() => [])
      const hasSensorCookie = cookies.some(
        (c) =>
          (c.name === "reese84" || c.name === "___utmvc") &&
          targetHost &&
          (c.domain === targetHost ||
            c.domain === `.${targetHost}` ||
            targetHost.endsWith(`.${c.domain.replace(/^\./, "")}`)),
      )

      if (hasSensorCookie) {
        if (sensorCookieAt === undefined) {
          sensorCookieAt = Date.now()
          console.log("[imperva] sensor cookie obtained")
        }

        // Sensor cookie set but still on the challenge page - Imperva's redirect
        // sometimes doesn't auto-fire (unlike CF). Navigate ourselves after a grace period.
        if (originalUrl && Date.now() - sensorCookieAt > 5000) {
          console.log("[imperva] sensor cookie set but still on challenge page - navigating to original URL")
          await page
            .goto(originalUrl, { waitUntil: "domcontentloaded", timeout: Math.max(1, Math.min(15000, remaining())) })
            .catch(() => {})
          await page
            .waitForLoadState("networkidle", { timeout: Math.max(1, Math.min(8000, remaining())) })
            .catch(() => {})
          const html2 = await page.content().catch(() => "")
          if (!html2.trim() || hasImpervaChallenge(html2)) return "ip-blocked"
          return "ok"
        }
      }
    } catch {
      // Page is mid-navigation - keep polling
    }

    await sleep(Math.min(300, remaining()))
  }

  return "timeout"
}
