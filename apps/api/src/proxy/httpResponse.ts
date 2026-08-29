import type net from "node:net"
import { RESPONSE_HOP_BY_HOP_HEADERS } from "@trawl/tiers"

function reason(status: number): string {
  const map: Record<number, string> = {
    200: "OK",
    403: "Forbidden",
    404: "Not Found",
    500: "Internal Server Error",
    502: "Bad Gateway",
  }
  return map[status] ?? "OK"
}

function appendHeader(headerLines: string[], name: string, value: string): void {
  if (name.toLowerCase() !== "set-cookie") {
    headerLines.push(`${name}: ${value}`)
    return
  }
  for (const cookie of value.split(/\r?\n/)) {
    if (cookie.trim().length > 0) headerLines.push(`${name}: ${cookie}`)
  }
}

export function serializeResponseHeaders(
  status: number,
  upstreamHeaders: Record<string, string>,
  fallbackContentType: string,
  options: { bodyLength?: number; streamed?: boolean; requestBodyLength?: number } = {},
): string {
  const headerLines: string[] = [`HTTP/1.1 ${status} ${reason(status)}`]
  let emittedContentType = false
  for (const [name, value] of Object.entries(upstreamHeaders)) {
    const lower = name.toLowerCase()
    if (RESPONSE_HOP_BY_HOP_HEADERS.has(lower) && !(options.streamed && lower === "transfer-encoding")) continue
    if (!options.streamed && lower === "content-length") continue
    if (lower === "content-type") emittedContentType = true
    appendHeader(headerLines, name, value)
  }
  if (!emittedContentType) headerLines.push(`Content-Type: ${fallbackContentType}`)
  if (options.bodyLength !== undefined) headerLines.push(`Content-Length: ${options.bodyLength}`)
  if ((options.requestBodyLength ?? 0) > 0) headerLines.push(`X-Forwarded-Body-Length: ${options.requestBodyLength}`)
  headerLines.push("Connection: close")
  return `${headerLines.join("\r\n")}\r\n\r\n`
}

export function writeResponse(
  sock: net.Socket,
  status: number,
  body: Buffer,
  contentType = "text/html; charset=utf-8",
): void {
  const head =
    `HTTP/1.1 ${status} ${reason(status)}\r\n` +
    `Content-Type: ${contentType}\r\n` +
    `Content-Length: ${body.length}\r\n` +
    "Connection: close\r\n\r\n"
  sock.write(head)
  sock.write(body)
  sock.end()
}

export function writeResponseFromBuffer(
  sock: net.Socket,
  status: number,
  upstreamHeaders: Record<string, string>,
  body: Buffer,
  fallbackContentType: string,
): void {
  sock.write(serializeResponseHeaders(status, upstreamHeaders, fallbackContentType, { bodyLength: body.length }))
  sock.write(body)
  sock.end()
}

// Buffered response with multi-value headers (Record<string, string[]>), used by
// the browser-login path where Set-Cookie arrives as an array (HTTP allows several
// Set-Cookie headers, and single-hosting them with \r\n separators breaks the
// cookie parser on some clients).
export function writeResponseFromBufferMulti(
  sock: net.Socket,
  status: number,
  upstreamHeaders: Record<string, string[]>,
  body: Buffer,
  fallbackContentType: string,
): void {
  const headerLines: string[] = [`HTTP/1.1 ${status} ${reason(status)}`]
  let emittedContentType = false
  for (const [name, values] of Object.entries(upstreamHeaders)) {
    const lower = name.toLowerCase()
    if (RESPONSE_HOP_BY_HOP_HEADERS.has(lower)) continue
    if (lower === "content-length") continue
    if (lower === "content-type") emittedContentType = true
    for (const value of values) appendHeader(headerLines, name, value)
  }
  if (!emittedContentType) headerLines.push(`Content-Type: ${fallbackContentType}`)
  headerLines.push(`Content-Length: ${body.length}`)
  headerLines.push("Connection: close")
  sock.write(`${headerLines.join("\r\n")}\r\n\r\n`)
  sock.write(body)
  sock.end()
}

export function writeResponseFromStream(
  sock: net.Socket,
  status: number,
  upstreamHeaders: Record<string, string>,
  upstreamSocket: net.Socket,
  fallbackContentType: string,
  requestBodyLength: number,
  prefix?: Buffer,
): void {
  sock.write(
    serializeResponseHeaders(status, upstreamHeaders, fallbackContentType, { streamed: true, requestBodyLength }),
  )
  if (prefix?.length) sock.write(prefix)
  upstreamSocket.pipe(sock)
  sock.on("error", () => upstreamSocket.destroy())
  upstreamSocket.on("error", () => sock.destroy())
  upstreamSocket.on("end", () => sock.end())
  upstreamSocket.on("close", () => sock.end())
}
