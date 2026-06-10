import { Second, waitFor } from './time'

export const waitForFunction = async (
  fn: () => boolean | Promise<boolean>,
  options?: {
    timeout?: number
    interval?: number
  },
): Promise<boolean> => {
  const start = Date.now()
  const timeout = options?.timeout ?? 10 * Second
  const interval = options?.interval ?? 0.1 * Second

  while (Date.now() - start < timeout) {
    if (await fn()) return true

    await waitFor(interval)
  }

  return false
}
