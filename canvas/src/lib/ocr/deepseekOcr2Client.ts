export type DeepseekOcr2InferRequest = {
  filename: string
  prompt: string
  imageBase64: string
}

export type DeepseekOcr2InferResponse = { ok: true; markdown: string } | { ok: false; error: string }

export async function deepseekOcr2InferImageToMarkdown(args: {
  endpoint: string
  imageBytes: Buffer
  filename: string
  prompt?: string
  timeoutMs?: number
}): Promise<DeepseekOcr2InferResponse> {
  const endpoint = String(args.endpoint || '').trim()
  if (!endpoint) return { ok: false, error: 'Missing OCR endpoint' }

  const prompt = String(args.prompt || '').trim() || '<image>\n<|grounding|>Convert the document to markdown. '
  const timeoutMs = (() => {
    const n = args.timeoutMs
    if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0) return 60_000
    return Math.max(2_000, Math.min(5 * 60_000, Math.floor(n)))
  })()

  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const req: DeepseekOcr2InferRequest = {
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
      const msg = json && typeof json === 'object' && 'error' in json ? String((json as any).error || '') : ''
      return { ok: false, error: msg || `OCR request failed (${res.status})` }
    }
    if (!json || typeof json !== 'object') return { ok: false, error: 'OCR response not JSON' }
    if ('ok' in json && (json as any).ok === false) return { ok: false, error: String((json as any).error || 'OCR failed') }
    const md = 'markdown' in json ? String((json as any).markdown || '') : ''
    if (!md.trim()) return { ok: false, error: 'OCR returned empty markdown' }
    return { ok: true, markdown: md }
  } catch (e) {
    const msg = e && typeof e === 'object' && 'message' in e ? String((e as any).message || '') : ''
    return { ok: false, error: msg || 'OCR request failed' }
  } finally {
    clearTimeout(t)
  }
}

