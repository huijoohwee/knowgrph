import { unwrapUserProvidedText } from '@/lib/url'
import type { JSONValue } from '@/lib/graph/types'

export type YouTubeTranscriptConversionOk = {
  ok: true
  name: string
  markdown: string
  transcriptJsonText: string | null
  transcript: Record<string, JSONValue> | null
  sourceUrl: string
}

export type YouTubeTranscriptConversionErr = {
  ok: false
  error: string
}

export type YouTubeTranscriptConversionResult = YouTubeTranscriptConversionOk | YouTubeTranscriptConversionErr

const YOUTUBE_TRANSCRIPT_CACHE_LIMIT = 4
const YOUTUBE_TRANSCRIPT_CACHE_TTL_MS = 2 * 60_000
const YOUTUBE_TRANSCRIPT_TIMEOUT_MS = 120_000

const transcriptCache = new Map<string, { result: YouTubeTranscriptConversionResult; atMs: number }>()
const transcriptInflight = new Map<string, Promise<YouTubeTranscriptConversionResult | null>>()

const readErrorMessage = (value: unknown, fallback: string): string => {
  if (typeof value === 'string' && value.trim()) return value.trim()
  return fallback
}

const normalizeTranscript = (value: unknown): Record<string, JSONValue> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  try {
    const text = JSON.stringify(value)
    const parsed = JSON.parse(text) as JSONValue
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    return parsed as Record<string, JSONValue>
  } catch {
    return null
  }
}

const readTranscriptJsonText = (raw: unknown, transcript: Record<string, JSONValue> | null): string | null => {
  if (typeof raw === 'string' && raw.trim()) return raw
  if (!transcript) return null
  try {
    return JSON.stringify(transcript, null, 2)
  } catch {
    return null
  }
}

const readSourceUrl = (transcript: Record<string, JSONValue> | null, fallback: string): string => {
  const sourceUrl = typeof transcript?.source_url === 'string' ? transcript.source_url.trim() : ''
  return sourceUrl || fallback
}

const readCached = (key: string): YouTubeTranscriptConversionResult | null => {
  const cached = transcriptCache.get(key) || null
  if (!cached) return null
  if (Date.now() - cached.atMs > YOUTUBE_TRANSCRIPT_CACHE_TTL_MS) {
    transcriptCache.delete(key)
    return null
  }
  transcriptCache.delete(key)
  transcriptCache.set(key, cached)
  return cached.result
}

const writeCached = (key: string, result: YouTubeTranscriptConversionResult): YouTubeTranscriptConversionResult => {
  transcriptCache.set(key, { result, atMs: Date.now() })
  if (transcriptCache.size > YOUTUBE_TRANSCRIPT_CACHE_LIMIT) {
    const oldestKey = transcriptCache.keys().next().value
    if (typeof oldestKey === 'string') transcriptCache.delete(oldestKey)
  }
  return result
}

export async function fetchYouTubeTranscriptConversion(rawUrl: string, opts?: {
  lang?: string
  timeoutMs?: number
}): Promise<YouTubeTranscriptConversionResult | null> {
  const cleaned = unwrapUserProvidedText(String(rawUrl || '').trim()) || String(rawUrl || '').trim()
  if (!cleaned) return null
  const lang = typeof opts?.lang === 'string' ? opts.lang.trim() : ''
  const key = `youtube-transcript:v2:${lang || 'default'}:${cleaned}`
  const cached = readCached(key)
  if (cached) return cached
  const inflight = transcriptInflight.get(key)
  if (inflight) return await inflight

  const timeoutMs = (() => {
    const raw = Number(opts?.timeoutMs)
    if (!Number.isFinite(raw)) return YOUTUBE_TRANSCRIPT_TIMEOUT_MS
    return Math.max(10_000, Math.min(10 * 60_000, Math.floor(raw)))
  })()

  const request = (async () => {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const qs = new URLSearchParams({ url: cleaned, emit: 'json' })
      if (lang && lang !== 'en') qs.set('lang', lang)
      const res = await fetch(`/__youtube_transcript?${qs.toString()}`, {
        method: 'POST',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      })
      const json = (await res.json()) as {
        ok?: unknown
        markdown?: unknown
        error?: unknown
        name?: unknown
        transcript?: unknown
        transcriptJsonText?: unknown
      }
      if (json && json.ok === true && typeof json.markdown === 'string') {
        const transcript = normalizeTranscript(json.transcript)
        const transcriptJsonText = readTranscriptJsonText(json.transcriptJsonText, transcript)
        return writeCached(key, {
          ok: true,
          name: typeof json.name === 'string' && json.name.trim() ? json.name.trim() : 'youtube-transcript.md',
          markdown: json.markdown,
          transcriptJsonText,
          transcript,
          sourceUrl: readSourceUrl(transcript, cleaned),
        })
      }
      const err = readErrorMessage(json?.error, '')
      if (err) return { ok: false as const, error: err }
      if (!res.ok) return { ok: false as const, error: `HTTP ${res.status}` }
      return { ok: false as const, error: 'YouTube conversion failed' }
    } catch (error) {
      if (controller.signal.aborted) return { ok: false as const, error: `YouTube conversion timed out after ${timeoutMs}ms` }
      const message = error && typeof error === 'object' && 'message' in error
        ? String((error as { message?: unknown }).message || '')
        : ''
      return { ok: false as const, error: message.trim() || 'Request failed' }
    } finally {
      clearTimeout(timeoutId)
    }
  })()

  transcriptInflight.set(key, request)
  try {
    return await request
  } finally {
    transcriptInflight.delete(key)
  }
}
