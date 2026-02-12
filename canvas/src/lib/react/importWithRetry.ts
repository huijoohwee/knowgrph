export async function importWithRetry<T>(
  factory: () => Promise<T>,
  opts?: { retries?: number; retryDelayMs?: number },
): Promise<T> {
  const retries = typeof opts?.retries === 'number' && Number.isFinite(opts.retries) ? Math.max(0, Math.floor(opts.retries)) : 0
  const retryDelayMs =
    typeof opts?.retryDelayMs === 'number' && Number.isFinite(opts.retryDelayMs) ? Math.max(0, Math.floor(opts.retryDelayMs)) : 0

  const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))
  const isRetryable = (e: unknown) => {
    const anyErr = e as { name?: unknown; message?: unknown }
    const name = typeof anyErr?.name === 'string' ? anyErr.name : ''
    const message = typeof anyErr?.message === 'string' ? anyErr.message : String(e)
    const msg = `${name} ${message}`.toLowerCase()
    if (msg.includes('abort')) return true
    if (msg.includes('err_aborted')) return true
    if (msg.includes('failed to fetch')) return true
    if (msg.includes('dynamically imported module')) return true
    return false
  }

  let lastError: unknown = null
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await factory()
    } catch (e) {
      lastError = e
      if (attempt >= retries) throw e
      if (!isRetryable(e)) throw e
      const backoff = retryDelayMs * Math.pow(2, attempt)
      if (backoff > 0) await sleep(backoff)
    }
  }
  throw lastError
}

