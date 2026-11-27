import { expect, test } from "bun:test"
import { matchGeetestPiece } from "../src/solvers/geetestImage"

function images() {
  const width = 160,
    height = 60,
    pw = 30,
    ph = 30,
    top = 15,
    target = 93
  const pixels = new Uint8Array(width * height * 4)
  let state = 37
  for (let i = 0; i < pixels.length; i += 4) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    pixels[i] = state & 255
    pixels[i + 1] = (state >>> 8) & 255
    pixels[i + 2] = (state >>> 16) & 255
    pixels[i + 3] = 255
  }
  const tile = new Uint8Array(pw * ph * 4)
  for (let y = 4; y < ph - 4; y++)
    for (let x = 4; x < pw - 4; x++) {
      const from = ((top + y) * width + target + x) * 4,
        to = (y * pw + x) * 4
      tile.set(pixels.subarray(from, from + 4), to)
      for (let c = 0; c < 3; c++) pixels[from + c] = Math.round(pixels[from + c] * 0.6)
    }
  return { background: { width, height, pixels }, piece: { width: pw, height: ph, pixels: tile }, top, target }
}

test("finds a darkened cutout without counting transparent piece padding", () => {
  const { background, piece, top, target } = images()
  expect(matchGeetestPiece(background, piece, top)).toBe(target)
})

test("does not invent a match for a flat or transparent piece", () => {
  const { background, piece, top } = images()
  piece.pixels.fill(255)
  expect(matchGeetestPiece(background, piece, top)).toBeUndefined()
  piece.pixels.fill(0)
  expect(matchGeetestPiece(background, piece, top)).toBeUndefined()
})

test("rejects incomplete pixel buffers and out-of-bounds layouts", () => {
  const { background, piece } = images()
  expect(matchGeetestPiece(background, piece, -1)).toBeUndefined()
  expect(matchGeetestPiece(background, piece, background.height)).toBeUndefined()
  expect(matchGeetestPiece({ ...background, pixels: [] }, piece, 0)).toBeUndefined()
})

test("failed page inspection is never reported as GeeTest success", async () => {
  const { isGeetestSuccess } = await import("../src/solvers/geetest")
  const page = {
    evaluate: async () => {
      throw new Error("navigation")
    },
  }
  expect(await isGeetestSuccess(page as never)).toBe(false)
})

test("GeeTest references alone do not activate the solver or a widget wait", async () => {
  const { hasGeetestSlide } = await import("../src/solvers/geetest")
  let waits = 0
  const page = {
    content: async () => '<a href="/captcha/geetest">GeeTest demo</a><svg id="icon-geetest"></svg>',
    evaluate: async () => ({ visible: false, initializing: false }),
    waitForSelector: async () => {
      waits++
      return {}
    },
  }
  expect(await hasGeetestSlide(page as never)).toBe(false)
  expect(waits).toBe(0)
})

test("a visible GeeTest entry point or puzzle is detected immediately", async () => {
  const { hasGeetestSlide } = await import("../src/solvers/geetest")
  const page = {
    content: async () => '<div class="geetest_bg"></div>',
    evaluate: async () => ({ visible: true, initializing: false }),
    waitForSelector: async () => {
      throw new Error("visible widget should not need a wait")
    },
  }
  expect(await hasGeetestSlide(page as never)).toBe(true)
})

test("GeeTest SDK initialization retains a bounded wait for a visible widget", async () => {
  const { hasGeetestSlide } = await import("../src/solvers/geetest")
  let options: unknown
  const page = {
    content: async () => '<script src="https://static.geetest.com/v4/gt4.js"></script>',
    evaluate: async () => ({ visible: false, initializing: true }),
    waitForSelector: async (_selector: string, settings: unknown) => {
      options = settings
      return {}
    },
  }
  expect(await hasGeetestSlide(page as never, 250)).toBe(true)
  expect(options).toEqual({ timeout: 250, state: "visible" })
  page.waitForSelector = async () => {
    throw new Error("timeout")
  }
  expect(await hasGeetestSlide(page as never, 250)).toBe(false)
})

test.each([false, true])(
  "GeeTest completes a browser-animated drag with transient geometry=%s",
  async (staleGeometry) => {
    const { solveGeetestSlide } = await import("../src/solvers/geetest")
    const sample = images()
    let currentX = 0
    let imageReads = 0
    let verified = false
    let pressed = false
    const page = {
      evaluate: async (_fn: unknown, arg: unknown) => {
        if (typeof arg === "number") {
          imageReads++
          return sample
        }
        if (typeof arg !== "string") return verified
        if (arg.includes(".geetest_slice,")) return { x: 0, y: sample.top, width: 30, height: 30 }
        if (arg.includes(".geetest_slider_button")) return { x: 0, y: 80, width: 30, height: 20 }
        if (arg === ".geetest_bg, .geetest_canvas_bg, .gt_cut_bg")
          return { x: staleGeometry && imageReads === 1 ? 1000 : 0, y: 0, width: 160, height: 60 }
        if (arg === ".geetest_slider, .geetest_slider_track, .gt_slider") return { x: 0, y: 80, width: 160, height: 20 }
        return undefined
      },
      mouse: {
        move: async (x: number) => {
          await Bun.sleep(80)
          currentX = x
        },
        down: async () => {
          pressed = true
        },
        up: async () => {
          verified = pressed && Math.abs(currentX - 15 - sample.target) < 0.1
          pressed = false
        },
      },
    }
    expect(await solveGeetestSlide(page as never, 800)).toBe(true)
    expect(pressed).toBe(false)
  },
)
