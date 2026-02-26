import { unwrapUserProvidedText } from '@/lib/url'
import { deriveMarkdownNameFromPdfFilename } from '@/features/toolbar/ingestUtils'
import { buildPdfConvertQueryParamsFromStore } from '@/lib/pdf/pdfImportClientPrefs'
import { convertWebpageUrlToMarkdownViaBrowser } from '@/lib/websites/webpageClientConvert'

export type RemoteMarkdownConversionOk = {
  ok: true
  name: string
  markdown: string
  transcriptJsonText?: string
  conversionJsonText?: string
}
export type RemoteMarkdownConversionErr = { ok: false; error: string }
export type RemoteMarkdownConversionResult = RemoteMarkdownConversionOk | RemoteMarkdownConversionErr

const WEBPAGE_MD_CACHE = new Map<string, { res: RemoteMarkdownConversionOk; atMs: number }>()
const WEBPAGE_MD_INFLIGHT = new Map<string, Promise<RemoteMarkdownConversionResult | null>>()
const WEBPAGE_MD_CACHE_MAX = 24
const WEBPAGE_MD_CACHE_TTL_MS = 3 * 60_000

async function readConversionJson(res: Response): Promise<{ ok?: unknown; markdown?: unknown; error?: unknown; name?: unknown } | null> {
  try {
    return (await res.json()) as { ok?: unknown; markdown?: unknown; error?: unknown; name?: unknown }
  } catch {
    return null
  }
}

async function describeNonJsonConversionFailure(res: Response): Promise<string> {
  const status = `HTTP ${res.status}`
  const contentType = String(res.headers.get('content-type') || '').toLowerCase()
  if (contentType.includes('text/html')) return `${status} (conversion endpoint unavailable)`
  try {
    const text = await res.text()
    const clipped = text.length > 200 ? `${text.slice(0, 200)}…` : text
    const cleaned = clipped.replace(/\s+/g, ' ').trim()
    return cleaned ? `${status}: ${cleaned}` : status
  } catch {
    return status
  }
}

export async function convertPdfUrlToMarkdown(rawUrl: string): Promise<RemoteMarkdownConversionResult | null> {
  const url = String(rawUrl || '').trim()
  if (!url) return null
  try {
    const qs = buildPdfConvertQueryParamsFromStore()
    qs.set('url', url)
    const res = await fetch(`/__convert_pdf?${qs.toString()}`, {
      method: 'POST',
      headers: { Accept: 'application/json' },
    })
    const json = await readConversionJson(res)
    if (!json) return { ok: false as const, error: await describeNonJsonConversionFailure(res) }
    if (json && json.ok === true && typeof json.markdown === 'string') {
      const serverName = typeof json.name === 'string' && json.name.trim() ? json.name.trim() : ''
      const name = (() => {
        if (serverName) {
          return /\.pdf$/i.test(serverName) ? deriveMarkdownNameFromPdfFilename(serverName) : serverName
        }
        return (() => {
              try {
                const u = new URL(url)
                const parts = u.pathname.split('/').filter(Boolean)
                const last = parts[parts.length - 1] || ''
                return deriveMarkdownNameFromPdfFilename(last)
              } catch {
                return 'document.md'
              }
            })()
      })()
      return { ok: true as const, name, markdown: json.markdown }
    }
    const err = typeof json?.error === 'string' && json.error.trim() ? json.error.trim() : ''
    if (err) return { ok: false as const, error: err }
    if (!res.ok) return { ok: false as const, error: `HTTP ${res.status}` }
    return { ok: false as const, error: 'PDF conversion failed' }
  } catch {
    return { ok: false as const, error: 'Request failed' }
  }
}

export async function convertPdfFileToMarkdown(file: File): Promise<RemoteMarkdownConversionResult | null> {
  try {
    const buf = await file.arrayBuffer()
    const qs = buildPdfConvertQueryParamsFromStore()
    const res = await fetch(`/__convert_pdf?${qs.toString()}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/pdf',
        Accept: 'application/json',
        'X-Import-Filename': file.name || '',
      },
      body: buf,
    })
    const json = await readConversionJson(res)
    if (!json) return { ok: false as const, error: await describeNonJsonConversionFailure(res) }
    if (json && json.ok === true && typeof json.markdown === 'string') {
      const serverName = typeof json.name === 'string' && json.name.trim() ? json.name.trim() : ''
      const name = serverName
        ? /\.pdf$/i.test(serverName)
          ? deriveMarkdownNameFromPdfFilename(serverName)
          : serverName
        : deriveMarkdownNameFromPdfFilename(file.name)
      return { ok: true as const, name, markdown: json.markdown }
    }
    const err = typeof json?.error === 'string' && json.error.trim() ? json.error.trim() : ''
    if (err) return { ok: false as const, error: err }
    if (!res.ok) return { ok: false as const, error: `HTTP ${res.status}` }
    return { ok: false as const, error: 'PDF conversion failed' }
  } catch {
    return { ok: false as const, error: 'Request failed' }
  }
}

export async function fetchYouTubeTranscriptMarkdown(rawUrl: string, opts?: { lang?: string }): Promise<RemoteMarkdownConversionResult | null> {
  const cleaned = unwrapUserProvidedText(String(rawUrl || '').trim()) || String(rawUrl || '').trim()
  if (!cleaned) return null
  try {
    const qs = new URLSearchParams({ url: cleaned, emit: 'json' })
    const lang = typeof opts?.lang === 'string' ? opts.lang.trim() : ''
    if (lang && lang !== 'en') qs.set('lang', lang)
    const res = await fetch(`/__youtube_transcript?${qs.toString()}`, {
      method: 'POST',
      headers: { Accept: 'application/json' },
    })
    const json = (await res.json()) as { ok?: unknown; markdown?: unknown; error?: unknown; name?: unknown; transcriptJsonText?: unknown }
    if (json && json.ok === true && typeof json.markdown === 'string') {
      const name = typeof json.name === 'string' && json.name.trim() ? json.name.trim() : 'youtube-transcript.md'
      const transcriptJsonText = typeof json.transcriptJsonText === 'string' ? json.transcriptJsonText : undefined
      return { ok: true as const, name, markdown: json.markdown, transcriptJsonText }
    }
    const err = typeof json?.error === 'string' && json.error.trim() ? json.error.trim() : ''
    if (err) return { ok: false as const, error: err }
    if (!res.ok) return { ok: false as const, error: `HTTP ${res.status}` }
    return { ok: false as const, error: 'YouTube conversion failed' }
  } catch {
    return null
  }
}

export async function fetchWebpageMarkdown(
  rawUrl: string,
  opts?: { emit?: 'markdown' | 'json'; includeImages?: boolean; signal?: AbortSignal },
): Promise<RemoteMarkdownConversionResult | null> {
  const cleaned = unwrapUserProvidedText(String(rawUrl || '').trim()) || String(rawUrl || '').trim()
  if (!cleaned) return null
  try {
    void opts?.includeImages
    const emit = opts?.emit === 'json' ? 'json' : 'markdown'
    const key = `webpage:v3:${emit}:${cleaned}`
    const cached = WEBPAGE_MD_CACHE.get(key)
    if (cached && Date.now() - cached.atMs <= WEBPAGE_MD_CACHE_TTL_MS) return cached.res

    const inflight = WEBPAGE_MD_INFLIGHT.get(key)
    if (inflight) return await inflight

    const p = (async () => {
      const res = await convertWebpageUrlToMarkdownViaBrowser({ url: cleaned })
      if (res.ok !== true) return { ok: false as const, error: res.error }
      const name = 'webpage.md'
      const conversionJsonText =
        emit === 'json'
          ? (() => {
              try {
                return JSON.stringify({ ok: true, name, markdown: res.markdown, title: res.title, source_url: cleaned, images: [] }, null, 2)
              } catch {
                return undefined
              }
            })()
          : undefined
      const out: RemoteMarkdownConversionOk = { ok: true as const, name, markdown: res.markdown, conversionJsonText }
      WEBPAGE_MD_CACHE.set(key, { res: out, atMs: Date.now() })
      if (WEBPAGE_MD_CACHE.size > WEBPAGE_MD_CACHE_MAX) {
        const oldest = WEBPAGE_MD_CACHE.keys().next().value as string | undefined
        if (oldest) WEBPAGE_MD_CACHE.delete(oldest)
      }
      return out
    })()
    WEBPAGE_MD_INFLIGHT.set(key, p)
    try {
      return await p
    } finally {
      WEBPAGE_MD_INFLIGHT.delete(key)
    }
  } catch {
    return null
  }
}
