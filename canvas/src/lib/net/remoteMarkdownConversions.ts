import { unwrapUserProvidedText } from '@/lib/url'
import { deriveMarkdownNameFromPdfFilename } from '@/features/toolbar/ingestUtils'

export type RemoteMarkdownConversionOk = { ok: true; name: string; markdown: string }
export type RemoteMarkdownConversionErr = { ok: false; error: string }
export type RemoteMarkdownConversionResult = RemoteMarkdownConversionOk | RemoteMarkdownConversionErr

export async function convertPdfUrlToMarkdown(rawUrl: string): Promise<RemoteMarkdownConversionResult | null> {
  const url = String(rawUrl || '').trim()
  if (!url) return null
  try {
    const res = await fetch(`/__convert_pdf?url=${encodeURIComponent(url)}`, {
      method: 'POST',
      headers: { Accept: 'application/json' },
    })
    const json = (await res.json()) as { ok?: unknown; markdown?: unknown; error?: unknown; name?: unknown }
    if (json && json.ok === true && typeof json.markdown === 'string') {
      const name =
        typeof json.name === 'string' && json.name.trim()
          ? json.name.trim()
          : (() => {
              try {
                const u = new URL(url)
                const parts = u.pathname.split('/').filter(Boolean)
                const last = parts[parts.length - 1] || ''
                return deriveMarkdownNameFromPdfFilename(last)
              } catch {
                return 'document.md'
              }
            })()
      return { ok: true as const, name, markdown: json.markdown }
    }
    const err = typeof json?.error === 'string' && json.error.trim() ? json.error.trim() : ''
    if (err) return { ok: false as const, error: err }
    if (!res.ok) return { ok: false as const, error: `HTTP ${res.status}` }
    return { ok: false as const, error: 'PDF conversion failed' }
  } catch {
    return null
  }
}

export async function convertPdfFileToMarkdown(file: File): Promise<RemoteMarkdownConversionResult | null> {
  try {
    const buf = await file.arrayBuffer()
    const res = await fetch('/__convert_pdf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/pdf',
        Accept: 'application/json',
        'X-Import-Filename': file.name || '',
      },
      body: buf,
    })
    const json = (await res.json()) as { ok?: unknown; markdown?: unknown; error?: unknown; name?: unknown }
    if (json && json.ok === true && typeof json.markdown === 'string') {
      const name = typeof json.name === 'string' && json.name.trim() ? json.name.trim() : deriveMarkdownNameFromPdfFilename(file.name)
      return { ok: true as const, name, markdown: json.markdown }
    }
    const err = typeof json?.error === 'string' && json.error.trim() ? json.error.trim() : ''
    if (err) return { ok: false as const, error: err }
    if (!res.ok) return { ok: false as const, error: `HTTP ${res.status}` }
    return { ok: false as const, error: 'PDF conversion failed' }
  } catch {
    return null
  }
}

export async function fetchYouTubeTranscriptMarkdown(rawUrl: string, opts?: { lang?: string }): Promise<RemoteMarkdownConversionResult | null> {
  const cleaned = unwrapUserProvidedText(String(rawUrl || '').trim()) || String(rawUrl || '').trim()
  if (!cleaned) return null
  try {
    const qs = new URLSearchParams({ url: cleaned })
    const lang = typeof opts?.lang === 'string' ? opts.lang.trim() : ''
    if (lang && lang !== 'en') qs.set('lang', lang)
    const res = await fetch(`/__youtube_transcript?${qs.toString()}`, {
      method: 'POST',
      headers: { Accept: 'application/json' },
    })
    const json = (await res.json()) as { ok?: unknown; markdown?: unknown; error?: unknown; name?: unknown }
    if (json && json.ok === true && typeof json.markdown === 'string') {
      const name = typeof json.name === 'string' && json.name.trim() ? json.name.trim() : 'youtube-transcript.md'
      return { ok: true as const, name, markdown: json.markdown }
    }
    const err = typeof json?.error === 'string' && json.error.trim() ? json.error.trim() : ''
    if (err) return { ok: false as const, error: err }
    if (!res.ok) return { ok: false as const, error: `HTTP ${res.status}` }
    return { ok: false as const, error: 'YouTube conversion failed' }
  } catch {
    return null
  }
}
