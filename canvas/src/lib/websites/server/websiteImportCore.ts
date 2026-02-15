import { createHash } from 'node:crypto'

export const safeJsonParse = <T,>(raw: string): T | null => {
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export const hashHex = (input: string): string => createHash('sha256').update(String(input || ''), 'utf8').digest('hex')

export const clampInt = (v: unknown, fallback: number, min: number, max: number): number => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN
  if (!Number.isFinite(n)) return fallback
  return Math.max(min, Math.min(max, Math.floor(n)))
}

export const extractXmlLocs = (xml: string): string[] => {
  const s = String(xml || '')
  const out: string[] = []
  const re = /<loc>\s*([^<]+?)\s*<\/loc>/gi
  while (true) {
    const m = re.exec(s)
    if (!m) break
    const loc = String(m[1] || '').trim()
    if (loc) out.push(loc)
  }
  return out
}

export const looksLikeSitemapIndex = (xml: string): boolean => /<sitemapindex\b/i.test(String(xml || ''))

export const normalizeUrl = (raw: string): string | null => {
  try {
    const u = new URL(String(raw || '').trim())
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    u.hash = ''
    return u.toString()
  } catch {
    return null
  }
}

export const isSameHost = (a: string, b: string): boolean => {
  try {
    return new URL(a).host === new URL(b).host
  } catch {
    return false
  }
}

export const urlToTreePath = (urlRaw: string): string => {
  try {
    const u = new URL(urlRaw)
    const p = u.pathname || '/'
    if (p === '/' || p.trim() === '') return '/'
    return p
  } catch {
    return '/'
  }
}

export const fetchTextWithLimit = async (url: string, opts: { timeoutMs: number; maxBytes: number; accept?: string }): Promise<{ ok: true; text: string } | { ok: false; error: string }> => {
  const ctrl = new AbortController()
  const timeoutId = setTimeout(() => ctrl.abort(), opts.timeoutMs)
  try {
    const upstream = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: ctrl.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: opts.accept || '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    })
    const reader = upstream.body?.getReader()
    let buf: Buffer
    if (!reader) {
      const contentLengthRaw = upstream.headers.get('content-length')
      const len = contentLengthRaw ? Number(contentLengthRaw) : NaN
      if (Number.isFinite(len) && len > opts.maxBytes) return { ok: false, error: 'Upstream response too large' }
      buf = Buffer.from(await upstream.arrayBuffer())
    } else {
      const chunks: Buffer[] = []
      let total = 0
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        if (!value || value.byteLength === 0) continue
        total += value.byteLength
        if (total > opts.maxBytes) {
          try {
            await reader.cancel()
          } catch {
            void 0
          }
          return { ok: false, error: 'Upstream response too large' }
        }
        chunks.push(Buffer.from(value))
      }
      buf = Buffer.concat(chunks)
    }
    if (!upstream.ok) return { ok: false, error: `HTTP ${upstream.status}` }
    return { ok: true, text: buf.toString('utf8') }
  } catch (e) {
    const msg = e && typeof e === 'object' && 'message' in e ? String((e as { message?: unknown }).message || '') : ''
    if (/aborted/i.test(msg) || /timeout/i.test(msg)) return { ok: false, error: 'Request timed out' }
    return { ok: false, error: msg || 'Request failed' }
  } finally {
    clearTimeout(timeoutId)
  }
}

export const __testkit = {
  extractXmlLocs,
  looksLikeSitemapIndex,
  urlToTreePath,
  normalizeUrl,
  isSameHost,
}
