import { expect, test } from "bun:test"
import { detectChallengeType, isBlocked, isCloudflarePage } from "../src/utils/detect"

// Real rutracker.org tracker.php CF challenge response (403 + "Just a moment")
const TRACKER_CF_HTML = `<!DOCTYPE html><html lang="en-US"><head><title>Just a moment...</title><meta http-equiv="Content-Type" content="text/html; charset=UTF-8"><meta http-equiv="X-UA-Compatible" content="IE=Edge"><meta name="robots" content="noindex,nofollow"><style>body{margin:0;padding:0;font-family:sans-serif}</style><script src="/cdn-cgi/challenge-platform/h/g/orchestrate/chl_page/v1?ray=abc"></script><script src="https://challenges.cloudflare.com/turnstile/v0/api.js" defer></script></head><body><div id="challenge-running"><div class="cf-turnstile" data-sitekey="0x4AAAAAAA"></div></div></body></html>`

// Real rutracker.org index.php guest page (200 OK, IS_GUEST, no CF challenge)
const INDEX_GUEST_HTML = `<!DOCTYPE html><html lang="ru"><head><meta charset="Windows-1251"><title>RuTracker.org</title></head><body><script>window.BB = {IS_GUEST: '1'}</script></body></html>`

test("rutracker tracker.php CF challenge detected", () => {
  const headers = { "cf-mitigated": "challenge" }
  expect(isCloudflarePage(TRACKER_CF_HTML, headers)).toBe(true)
  expect(["cloudflare-turnstile", "cloudflare-interstitial"]).toContain(detectChallengeType(TRACKER_CF_HTML, headers))
  expect(isBlocked(403, TRACKER_CF_HTML)).toBe(true)
})

test("rutracker index.php guest page NOT detected as challenge", () => {
  expect(isCloudflarePage(INDEX_GUEST_HTML, {})).toBe(false)
  expect(detectChallengeType(INDEX_GUEST_HTML, {})).toBe("none")
  expect(isBlocked(200, INDEX_GUEST_HTML)).toBe(false)
})
