import { timingSafeEqual } from "node:crypto"
import { Elysia } from "elysia"
import { METRICS_DASHBOARD_ENABLED, METRICS_DASHBOARD_TOKEN } from "../config"
import { type MetricsStore, metricRanges, metrics } from "../metrics"
import { dashboardPage } from "./dashboardPage"

function validToken(header: string | null, secret: string): boolean {
  if (!header?.startsWith("Bearer ")) return false
  const supplied = Buffer.from(header.slice(7))
  const expected = Buffer.from(secret)
  return supplied.length === expected.length && timingSafeEqual(supplied, expected)
}

export function dashboardRoute(
  secret = METRICS_DASHBOARD_TOKEN,
  store: MetricsStore = metrics,
  enabled = METRICS_DASHBOARD_ENABLED,
) {
  const app = new Elysia()
  if (!secret && !enabled) return app
  const authorized = (header: string | null) => !secret || validToken(header, secret)
  return app
    .get("/dashboard", ({ set }) => {
      set.headers["Content-Type"] = "text/html; charset=utf-8"
      set.headers["Cache-Control"] = "no-store"
      set.headers["Content-Security-Policy"] =
        "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'"
      return dashboardPage(Boolean(secret))
    })
    .get("/dashboard/metrics", ({ request, set }) => {
      set.headers["Cache-Control"] = "no-store"
      if (!authorized(request.headers.get("authorization"))) {
        set.status = 401
        return { error: "Unauthorized" }
      }
      const value = Number(new URL(request.url).searchParams.get("minutes") || 60)
      return store.snapshot(
        metricRanges.includes(value as (typeof metricRanges)[number]) ? (value as (typeof metricRanges)[number]) : 60,
      )
    })
    .get("/dashboard/events", ({ request, set }) => {
      if (!authorized(request.headers.get("authorization"))) {
        set.status = 401
        return { error: "Unauthorized" }
      }
      let cleanup = () => {}
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          const encoder = new TextEncoder()
          const send = () => controller.enqueue(encoder.encode("event: update\ndata: {}\n\n"))
          controller.enqueue(encoder.encode(": connected\n\n"))
          const unsubscribe = store.subscribe(send)
          const heartbeat = setInterval(() => controller.enqueue(encoder.encode(": heartbeat\n\n")), 20_000)
          const close = () => {
            clearInterval(heartbeat)
            unsubscribe()
            try {
              controller.close()
            } catch {
              /* Already closed. */
            }
          }
          cleanup = close
          request.signal.addEventListener("abort", close, { once: true })
        },
        cancel() {
          cleanup()
        },
      })
      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-store",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
        },
      })
    })
}
