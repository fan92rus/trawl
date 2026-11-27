import { describe, expect, test } from "bun:test"
import { STREAM_THRESHOLD_BYTES, shouldStream } from "../streaming"

describe("shouldStream", () => {
  describe("size threshold", () => {
    test("streams responses >= 8 MiB", () => {
      expect(
        shouldStream("https://example.com/file.bin", STREAM_THRESHOLD_BYTES, "application/octet-stream"),
      ).toMatchObject({
        stream: true,
        reason: "size-threshold",
      })
      expect(shouldStream("https://example.com/file.bin", STREAM_THRESHOLD_BYTES + 1, "text/plain")).toMatchObject({
        stream: true,
        reason: "size-threshold",
      })
    })

    test("buffers responses below 8 MiB", () => {
      const d = shouldStream("https://example.com/data.json", 1024, "application/json")
      expect(d).toEqual({ stream: false, reason: "default-buffer" })
    })
  })

  describe("content-type", () => {
    test("streams video/*", () => {
      expect(shouldStream("https://x/y", 1024, "video/mp4")).toMatchObject({
        stream: true,
        reason: "video-content-type",
      })
      expect(shouldStream("https://x/y", 1024, "video/webm; codecs=vp9")).toMatchObject({
        stream: true,
        reason: "video-content-type",
      })
    })

    test("streams audio/*", () => {
      expect(shouldStream("https://x/y", 1024, "audio/mpeg")).toMatchObject({
        stream: true,
        reason: "audio-content-type",
      })
      expect(shouldStream("https://x/y", 1024, "audio/ogg; codecs=opus")).toMatchObject({
        stream: true,
        reason: "audio-content-type",
      })
    })

    test("unknown length + binary content-type → stream (safe default)", () => {
      expect(shouldStream("https://x/y", undefined, "application/octet-stream")).toMatchObject({
        stream: true,
        reason: "unknown-length-binary",
      })
      expect(shouldStream("https://x/y", undefined, "application/pdf")).toMatchObject({
        stream: true,
        reason: "unknown-length-binary",
      })
    })

    test("unknown length + text content-type → buffer (challenge detection possible)", () => {
      const d = shouldStream("https://x/y", undefined, "text/html")
      expect(d).toEqual({ stream: false, reason: "default-buffer" })
    })
  })

  describe("URL extension", () => {
    test.each([
      "https://cdn.example/movie.mp4",
      "https://cdn.example/clip.mkv?token=xyz",
      "https://cdn.example/episode.webm",
      "https://cdn.example/track.mp3",
      "https://cdn.example/manifest.m3u8",
      "https://cdn.example/segment.ts",
      "https://dl.example/installer.dmg",
      "https://dl/example/archive.zip",
      "https://dl/example/disk.iso",
      "https://dl/example/setup.exe",
      "https://dl/example/font.woff2",
      "https://dl/example/document.pdf",
    ])("streams binary extension %s", (url) => {
      expect(shouldStream(url, 1024, "application/octet-stream").stream).toBe(true)
    })

    test("buffers HTML/JSON even with no extension", () => {
      expect(shouldStream("https://api.example/data", 1024, "application/json").stream).toBe(false)
      expect(shouldStream("https://example.com/page", 1024, "text/html").stream).toBe(false)
    })
  })

  describe("edge cases", () => {
    test("missing content-type and length → buffer (text-y assumption)", () => {
      expect(shouldStream("https://example.com/").stream).toBe(false)
      expect(shouldStream("https://example.com/", undefined, undefined).stream).toBe(false)
    })

    test("empty content-type with explicit length → size decides", () => {
      expect(shouldStream("https://example.com/", 100, "").stream).toBe(false)
      expect(shouldStream("https://example.com/", STREAM_THRESHOLD_BYTES + 1, "").stream).toBe(true)
    })

    test("content-type with charset parameter is parsed correctly", () => {
      // "text/html; charset=utf-8" → base "text/html" → not a video/audio type
      expect(shouldStream("https://example.com/", 1024, "text/html; charset=utf-8").stream).toBe(false)
    })
  })
})
