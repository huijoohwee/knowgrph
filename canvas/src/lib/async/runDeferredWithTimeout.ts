export async function runDeferredWithTimeout<T>(args: {
  timeoutMs: number
  deferMs?: number
  run: () => Promise<T>
  onErrorMessage?: (message: string) => void
}): Promise<T | null> {
  const timeoutMs = (() => {
    const raw = args.timeoutMs
    if (typeof raw === 'number' && Number.isFinite(raw)) return Math.max(1, Math.floor(raw))
    return 20_000
  })()
  const deferMs = (() => {
    const raw = args.deferMs
    if (typeof raw === 'number' && Number.isFinite(raw)) return Math.max(0, Math.floor(raw))
    return 0
  })()

  return new Promise((resolve) => {
    let settled = false
    const settle = (v: T | null) => {
      if (settled) return
      settled = true
      resolve(v)
    }

    const timeoutIdObj = setTimeout(() => settle(null), timeoutMs)
    ;(timeoutIdObj as unknown as { unref?: () => void }).unref?.()
    const timeoutId = timeoutIdObj as unknown as number

    const deferIdObj = setTimeout(() => {
      Promise.resolve()
        .then(() => args.run())
        .then((v) => {
          if (settled) return
          try {
            clearTimeout(timeoutId)
          } catch {
            void 0
          }
          settle(v)
        })
        .catch((err: unknown) => {
          try {
            const msg = String((err as { message?: unknown })?.message ?? err)
            if (msg) args.onErrorMessage?.(msg)
          } catch {
            void 0
          }
          if (settled) return
          try {
            clearTimeout(timeoutId)
          } catch {
            void 0
          }
          settle(null)
        })
    }, deferMs)
    ;(deferIdObj as unknown as { unref?: () => void }).unref?.()
  })
}
