export async function mapLimit<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number, signal?: AbortSignal) => Promise<R>,
  opts?: {
    signal?: AbortSignal
    onProgress?: (p: { done: number; total: number }) => void
    yieldEvery?: number
  },
): Promise<R[]> {
  const total = Array.isArray(items) ? items.length : 0
  if (total === 0) return []
  const c = Number.isFinite(concurrency) ? Math.floor(concurrency) : 1
  const limit = c < 1 ? 1 : c
  const yieldEvery = typeof opts?.yieldEvery === 'number' && Number.isFinite(opts.yieldEvery) ? Math.max(1, Math.floor(opts.yieldEvery)) : 25

  let nextIndex = 0
  let done = 0
  const results = new Array<R>(total)

  const maybeAbort = () => {
    const s = opts?.signal
    if (s?.aborted) throw new Error('aborted')
  }

  const yieldNow = async () => {
    await new Promise<void>(resolve => setTimeout(resolve, 0))
  }

  const worker = async () => {
    while (true) {
      maybeAbort()
      const i = nextIndex
      if (i >= total) return
      nextIndex += 1

      results[i] = await mapper(items[i] as T, i, opts?.signal)
      done += 1
      opts?.onProgress?.({ done, total })
      if (done % yieldEvery === 0) await yieldNow()
    }
  }

  const workers = Array.from({ length: Math.min(limit, total) }, () => worker())
  await Promise.all(workers)
  return results
}

