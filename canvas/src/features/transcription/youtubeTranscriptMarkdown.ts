import { unwrapUserProvidedText } from '@/lib/url'
import type { JSONValue } from '@/lib/graph/types'

export type YouTubeTranscriptMarkdownResult =
  | {
      markdown: string
      displayName: string
      transcriptJsonText: string | null
      transcript: Record<string, JSONValue> | null
      sourceUrl: string
    }
  | { error: string }

export async function fetchYouTubeTranscriptMarkdown(args: {
  url: string
  lang?: string
}): Promise<YouTubeTranscriptMarkdownResult | null> {
  const rawUrl = String(args.url || '').trim()
  if (!rawUrl) return null
  try {
    const cleaned = unwrapUserProvidedText(rawUrl) || rawUrl
    const lang = typeof args.lang === 'string' ? args.lang.trim() : ''
    const qs = new URLSearchParams({ url: cleaned })
    if (lang && lang !== 'en') qs.set('lang', lang)
    const res = await fetch(`/__youtube_transcript?${qs.toString()}`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
      },
    })
    const json = (await res.json()) as {
      ok?: unknown
      markdown?: unknown
      error?: unknown
      name?: unknown
      transcript?: unknown
    }
    if (json && json.ok === true && typeof json.markdown === 'string') {
      const name = typeof json.name === 'string' && json.name.trim() ? json.name.trim() : 'youtube-transcript.md'
      const sourceUrl = (() => {
        if (!json.transcript || typeof json.transcript !== 'object' || Array.isArray(json.transcript)) return rawUrl
        const tr = json.transcript as Record<string, unknown>
        const s1 = typeof tr.source_url === 'string' ? tr.source_url.trim() : ''
        if (s1) return s1
        return rawUrl
      })()
      const transcriptJsonText = (() => {
        if (!json.transcript || typeof json.transcript !== 'object' || Array.isArray(json.transcript)) return null
        try {
          return JSON.stringify(json.transcript, null, 2)
        } catch {
          return null
        }
      })()
      const transcript = (() => {
        if (!transcriptJsonText) return null
        try {
          const parsed = JSON.parse(transcriptJsonText) as JSONValue
          if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
          return parsed as Record<string, JSONValue>
        } catch {
          return null
        }
      })()
      return { markdown: json.markdown, displayName: name, transcriptJsonText, transcript, sourceUrl }
    }
    const err = typeof json?.error === 'string' && json.error.trim() ? json.error.trim() : ''
    if (err) return { error: err }
    if (!res.ok) return { error: `HTTP ${res.status}` }
    return { error: 'YouTube conversion failed' }
  } catch {
    return null
  }
}

