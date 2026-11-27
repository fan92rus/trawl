export type OutboundUrlValidator = (url: string) => Promise<void>

interface BrowserRoute {
  abort(errorCode?: string): Promise<void>
  fallback(): Promise<void>
  request(): { url(): string }
}

interface RoutablePage {
  route(pattern: string, handler: (route: BrowserRoute) => Promise<void>): Promise<unknown>
}

const policies = new WeakMap<RoutablePage, { validate: OutboundUrlValidator }>()

export async function installOutboundPolicy(page: RoutablePage, validate?: OutboundUrlValidator): Promise<void> {
  if (!validate) return
  const existing = policies.get(page)
  if (existing) {
    existing.validate = validate
    return
  }
  // Retained pages can send requests between operations, including during eval.
  const policy = { validate }
  const enforce = async (route: BrowserRoute) => {
    try {
      await policy.validate(route.request().url())
      await route.fallback()
    } catch {
      await route.abort("blockedbyclient")
    }
  }
  await page.route("**/*", enforce)
  policies.set(page, policy)
}
