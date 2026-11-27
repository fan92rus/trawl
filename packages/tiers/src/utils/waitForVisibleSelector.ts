import type { Page } from "patchright"

const MAX_WAIT_MS = 10_000

export async function waitForVisibleSelector(page: Page, selector: string, budgetMs: number): Promise<boolean> {
  const timeout = Math.min(MAX_WAIT_MS, Math.max(0, budgetMs))
  if (timeout <= 0) return false

  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      page.waitForSelector(selector, { state: "visible", timeout }).then(
        () => true,
        () => false,
      ),
      new Promise<false>((resolve) => {
        timer = setTimeout(() => resolve(false), timeout)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}
