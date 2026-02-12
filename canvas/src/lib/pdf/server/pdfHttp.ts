export function readNumberFromEnv(key: string, fallback: number): number {
  const raw = String(process.env[key] || '').trim()
  const n = raw ? Number(raw) : NaN
  return Number.isFinite(n) ? Math.floor(n) : fallback
}

export function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(String(value || '').trim())
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

export function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  const ms = Number.isFinite(timeoutMs) ? Math.max(1, Math.floor(timeoutMs)) : 0
  if (!ms) return promise
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), ms)
  })
  return Promise.race([promise.finally(() => timeoutId != null && clearTimeout(timeoutId)), timeoutPromise])
}

export async function readRequestBodyBytes(args: {
  req: import('http').IncomingMessage
  maxBytes: number
  timeoutMs: number
}): Promise<Buffer> {
  const maxBytes = Number.isFinite(args.maxBytes) ? Math.max(0, Math.floor(args.maxBytes)) : 0
  const timeoutMs = Number.isFinite(args.timeoutMs) ? Math.max(0, Math.floor(args.timeoutMs)) : 0
  return await withTimeout(
    new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = []
      let size = 0

      const cleanup = () => {
        args.req.off('data', onData)
        args.req.off('end', onEnd)
        args.req.off('error', onError)
        args.req.off('aborted', onAborted)
        args.req.off('close', onClose)
      }

      const fail = (err: unknown) => {
        cleanup()
        reject(err)
      }

      const onError = (err: unknown) => fail(err)
      const onAborted = () => fail(new Error('Request aborted'))
      const onClose = () => fail(new Error('Request closed'))

      const onData = (chunk: Buffer) => {
        size += chunk.length
        if (maxBytes > 0 && size > maxBytes) {
          try {
            args.req.pause()
          } catch {
            void 0
          }
          fail(new Error('Request body too large'))
          return
        }
        chunks.push(chunk)
      }

      const onEnd = () => {
        cleanup()
        resolve(Buffer.concat(chunks))
      }

      args.req.on('data', onData)
      args.req.on('end', onEnd)
      args.req.on('error', onError)
      args.req.on('aborted', onAborted)
      args.req.on('close', onClose)
    }),
    timeoutMs,
    'Request body read timed out',
  )
}

export async function fetchBytesWithLimits(args: {
  url: string
  maxBytes: number
  timeoutMs: number
  headers?: Record<string, string>
}): Promise<{ bytes: Buffer; contentType: string | null; status: number }> {
  const url = String(args.url || '').trim()
  if (!url) throw new Error('Missing url')
  const maxBytes = Number.isFinite(args.maxBytes) ? Math.max(0, Math.floor(args.maxBytes)) : 0
  const timeoutMs = Number.isFinite(args.timeoutMs) ? Math.max(0, Math.floor(args.timeoutMs)) : 0

  const controller = timeoutMs > 0 ? new AbortController() : null
  const timeoutId = controller
    ? setTimeout(() => {
        try {
          controller.abort()
        } catch {
          void 0
        }
      }, timeoutMs)
    : null
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: args.headers,
      signal: controller?.signal,
    })

    const contentType = String(res.headers.get('content-type') || '').trim() || null
    const contentLengthHeader = String(res.headers.get('content-length') || '').trim()
    const contentLength = contentLengthHeader ? Number(contentLengthHeader) : NaN
    if (maxBytes > 0 && Number.isFinite(contentLength) && contentLength > maxBytes) {
      try {
        controller?.abort()
      } catch {
        void 0
      }
      throw new Error('Upstream response too large')
    }

    const body = res.body
    if (!body) return { bytes: Buffer.alloc(0), contentType, status: res.status }
    const reader = body.getReader()
    const chunks: Uint8Array[] = []
    let size = 0
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (!value) continue
      size += value.byteLength
      if (maxBytes > 0 && size > maxBytes) {
        try {
          controller?.abort()
        } catch {
          void 0
        }
        throw new Error('Upstream response too large')
      }
      chunks.push(value)
    }
    return { bytes: Buffer.concat(chunks), contentType, status: res.status }
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
  }
}
