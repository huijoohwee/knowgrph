import { coerceHttpUrl } from '@/lib/url'

export const parseChatIngestUrlCommand = (raw: unknown): { url: string } | null => {
  const text = String(raw || '').trim()
  if (!text) return null
  const match = text.match(/^\/ingest-url\s+(.+)$/i)
  if (!match?.[1]) return null
  const urlRaw = String(match[1]).trim()
  const url = coerceHttpUrl(urlRaw) || urlRaw
  return /^https?:\/\//i.test(url) ? { url } : null
}
