export type RemoteOcrInferRequest = {
  filename: string
  prompt: string
  imageBase64: string
}

export type RemoteOcrInferResponse = { ok: true; markdown: string } | { ok: false; error: string }

export async function inferImageToMarkdownViaRemoteOcr(args: {
  endpoint: string
  imageBytes: Buffer
  filename: string
  prompt?: string
  timeoutMs?: number
}): Promise<RemoteOcrInferResponse> {
  const endpoint = String(args.endpoint || '').trim()
  if (!endpoint) return { ok: false, error: 'Missing OCR endpoint' }

  type RemoteOcrInferJson = {
    ok?: unknown
    error?: unknown
    markdown?: unknown
  }

  const prompt = String(args.prompt || '').trim() || 'Convert the document image to markdown.'
  const timeoutMs = (() => {
    const n = args.timeoutMs
    if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0) return 60_000
    return Math.max(2_000, Math.min(5 * 60_000, Math.floor(n)))
  })()

  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const req: RemoteOcrInferRequest = {
      filename: String(args.filename || '').trim() || 'image.png',
      prompt,
      imageBase64: args.imageBytes.toString('base64'),
    }
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(req),
      signal: controller.signal,
    })

    const json = (await res.json().catch(() => null)) as unknown
    if (!res.ok) {
      const obj: RemoteOcrInferJson | null = json && typeof json === 'object' ? (json as RemoteOcrInferJson) : null
      const msg = obj && 'error' in obj ? String(obj.error || '') : ''
      return { ok: false, error: msg || `OCR request failed (${res.status})` }
    }
    if (!json || typeof json !== 'object') return { ok: false, error: 'OCR response not JSON' }
    const obj: RemoteOcrInferJson = json as RemoteOcrInferJson
    if (obj.ok === false) return { ok: false, error: String(obj.error || 'OCR failed') }
    const md = typeof obj.markdown === 'string' ? obj.markdown : obj.markdown != null ? String(obj.markdown) : ''
    if (!md.trim()) return { ok: false, error: 'OCR returned empty markdown' }
    return { ok: true, markdown: md }
  } catch (e) {
    const msg = e instanceof Error ? e.message : ''
    return { ok: false, error: msg || 'OCR request failed' }
  } finally {
    clearTimeout(t)
  }
}

