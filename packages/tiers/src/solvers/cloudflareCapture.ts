import type { Page } from "patchright"

export interface CloudflareRender {
  id: string
  websiteURL: string
  websiteKey: string
  action: string
  data: string
  pagedata: string
  userAgent: string
}

function observeCloudflare(key: string) {
  if (window !== window.top) return
  type Callback = (...args: unknown[]) => unknown
  type SDK = Record<string, unknown>
  let captured: { render: CloudflareRender; callback: Callback; used: boolean } | undefined
  const valid = (value: unknown, max: number): value is string =>
    typeof value === "string" && value.length > 0 && value.length <= max
  const read = () =>
    captured &&
    !captured.used &&
    captured.render.websiteURL === location.href &&
    document.querySelector("#challenge-form")
      ? { ...captured.render }
      : null
  const bridge = {
    read,
    deliver(expected: CloudflareRender, token: string) {
      if (!captured || JSON.stringify(read()) !== JSON.stringify(expected)) return false
      captured.used = true
      captured.callback(token)
      return true
    },
  }
  Object.defineProperty(window, key, { value: bridge })
  const wrapped = new WeakSet<SDK>()
  const wrap = (sdk: unknown) => {
    if (!sdk || typeof sdk !== "object" || wrapped.has(sdk as SDK)) return
    wrapped.add(sdk as SDK)
    const target = sdk as SDK
    const descriptor = Object.getOwnPropertyDescriptor(target, "render")
    if (descriptor && (!descriptor.configurable || descriptor.get || descriptor.set)) return
    const intercept = (render: unknown) => {
      if (typeof render !== "function") return render
      return function (this: unknown, container: unknown, options: Record<string, unknown>) {
        captured = undefined
        if (
          options &&
          valid(options.sitekey, 512) &&
          valid(options.action, 512) &&
          valid(options.cData, 4096) &&
          valid(options.chlPageData, 65536) &&
          typeof options.callback === "function"
        ) {
          const callback = options.callback as Callback
          const current = {
            render: {
              id: `${Date.now()}-${Math.random()}`,
              websiteURL: location.href,
              websiteKey: options.sitekey,
              action: options.action,
              data: options.cData,
              pagedata: options.chlPageData,
              userAgent: navigator.userAgent,
            },
            callback,
            used: false,
          }
          captured = current
          options = {
            ...options,
            callback: function (this: unknown, ...args: unknown[]) {
              current.used = true
              return callback.apply(this, args)
            },
          }
          for (const name of ["expired-callback", "error-callback"] as const) {
            const handler = options[name]
            options[name] = function (this: unknown, ...args: unknown[]) {
              current.used = true
              if (typeof handler === "function") return handler.apply(this, args)
            }
          }
        }
        try {
          return render.call(this, container, options)
        } catch (error) {
          captured = undefined
          throw error
        }
      }
    }
    let render = intercept(target.render)
    Object.defineProperty(target, "render", {
      configurable: true,
      enumerable: descriptor?.enumerable ?? true,
      get: () => render,
      set: (value) => {
        captured = undefined
        render = intercept(value)
      },
    })
    for (const name of ["reset", "remove"]) {
      const method = target[name]
      if (typeof method !== "function") continue
      target[name] = function (this: unknown, ...args: unknown[]) {
        captured = undefined
        return method.apply(this, args)
      }
    }
  }
  const descriptor = Object.getOwnPropertyDescriptor(window, "turnstile")
  if (descriptor && (!descriptor.configurable || descriptor.get || descriptor.set)) return
  let sdk = (window as unknown as SDK).turnstile
  wrap(sdk)
  Object.defineProperty(window, "turnstile", {
    configurable: true,
    enumerable: descriptor?.enumerable ?? true,
    get: () => sdk,
    set(value) {
      if (sdk !== value) captured = undefined
      sdk = value
      wrap(value)
    },
  })
}

/** Camoufox's mw: prefix reaches page scripts without weakening the page CSP. */
export class CloudflareCapture {
  private readonly key = `__trawl_cf_${crypto.randomUUID().replaceAll("-", "")}`

  async install(page: Page): Promise<void> {
    await page.addInitScript(`mw:(${observeCloudflare.toString()})(${JSON.stringify(this.key)})`)
  }

  async read(page: Page): Promise<CloudflareRender | null> {
    return page
      .evaluate<CloudflareRender | null>(`mw:window[${JSON.stringify(this.key)}]?.read() ?? null`)
      .catch(() => null)
  }

  async deliver(page: Page, render: CloudflareRender, token: string): Promise<boolean> {
    return page
      .evaluate<boolean>(
        `mw:window[${JSON.stringify(this.key)}]?.deliver(${JSON.stringify(render)},${JSON.stringify(token)}) === true`,
      )
      .catch(() => false)
  }
}
