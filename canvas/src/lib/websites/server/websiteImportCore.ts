import path from 'node:path'
import { createHash } from 'node:crypto'
import { spawn } from 'node:child_process'

export type WebpageConvertPayload =
  | { ok: true; markdown: string; name: string; title: string; source_url: string; images: string[] }
  | { ok: false; error: string }

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

const withRepoPythonPath = (repoRoot: string, env: NodeJS.ProcessEnv): NodeJS.ProcessEnv => {
  const current = String(env.PYTHONPATH || '').trim()
  const next = current ? `${repoRoot}${path.delimiter}${current}` : repoRoot
  return { ...env, PYTHONPATH: next }
}

export const runWebpageConvert = (args: { repoRoot: string; pythonBin: string; url: string; includeImages: boolean }): Promise<WebpageConvertPayload> => {
  return new Promise((resolve) => {
    const timeoutMs = (() => {
      const raw = Number(process.env.KG_WEBPAGE_CONVERT_TIMEOUT_MS || '')
      const fallback = 60_000
      const min = 10_000
      const max = 300_000
      if (!Number.isFinite(raw)) return fallback
      return Math.min(max, Math.max(min, Math.floor(raw)))
    })()
    const cliArgs = ['-m', 'knowgrph_parser', 'webpage', '--emit', 'json', '--url', args.url]
    if (!args.includeImages) cliArgs.push('--no-images')

    const child = spawn(args.pythonBin, cliArgs, {
      cwd: args.repoRoot,
      env: withRepoPythonPath(args.repoRoot, process.env),
      timeout: timeoutMs,
    })
    let stdout = ''
    let stderr = ''
    let exited = false

    const cleanup = () => {
      if (exited) return
      try {
        child.kill()
      } catch {
        void 0
      }
      exited = true
    }

    const timer = setTimeout(() => {
      cleanup()
      resolve({ ok: false, error: `Webpage conversion timed out after ${timeoutMs}ms` })
    }, timeoutMs)

    child.stdout?.setEncoding('utf8')
    child.stdout?.on('data', (chunk) => {
      stdout += String(chunk || '')
    })
    child.stderr?.setEncoding('utf8')
    child.stderr?.on('data', (chunk) => {
      stderr += String(chunk || '')
    })

    child.on('error', (err) => {
      clearTimeout(timer)
      if (exited) return
      exited = true
      resolve({ ok: false, error: err.message || 'Webpage conversion process error' })
    })

    child.on('close', (code) => {
      clearTimeout(timer)
      if (exited) return
      exited = true

      const out = stdout.trim()
      if (code !== 0) {
        const parsed = safeJsonParse<Record<string, unknown>>(out)
        const candidate = parsed && parsed.ok === false && typeof parsed.error === 'string' ? parsed.error.trim() : ''
        const msg = candidate || stderr.trim() || out || `Webpage conversion failed (exit ${code ?? 'unknown'})`
        resolve({ ok: false, error: msg })
        return
      }

      if (!out) {
        resolve({ ok: false, error: 'Webpage conversion returned empty output' })
        return
      }
      const parsed = safeJsonParse<Record<string, unknown>>(out)
      if (!parsed || parsed.ok !== true) {
        const candidate = parsed && typeof parsed.error === 'string' ? parsed.error.trim() : ''
        resolve({ ok: false, error: candidate || 'Webpage conversion JSON parse error' })
        return
      }
      const markdown = typeof parsed.markdown === 'string' ? parsed.markdown : ''
      const name = typeof parsed.name === 'string' && parsed.name.trim() ? parsed.name.trim() : 'webpage.md'
      const title = typeof parsed.title === 'string' ? parsed.title : ''
      const source_url = typeof parsed.source_url === 'string' ? parsed.source_url : ''
      const images = Array.isArray(parsed.images) ? parsed.images.map(String) : []
      resolve({ ok: true, markdown, name, title, source_url, images })
    })
  })
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
