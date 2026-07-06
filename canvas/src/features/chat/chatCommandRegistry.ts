import { coerceHttpUrl } from '@/lib/url'

export type ChatCommandOption = {
  id: 'ingest-url'
  label: string
  slashCommand: string
  summary: string
  keywords: readonly string[]
}

export const CHAT_COMMAND_OPTIONS: readonly ChatCommandOption[] = [
  {
    id: 'ingest-url',
    label: 'Ingest URL',
    slashCommand: '/ingest-url',
    summary: 'Import a URL through the shared workspace ingestion pipeline.',
    keywords: ['import', 'url', 'source', 'deerflow'],
  },
]

export const parseChatIngestUrlCommand = (raw: unknown): { url: string } | null => {
  const text = String(raw || '').trim()
  if (!text) return null
  const match = text.match(/^(?:\/)?(?:deerflow|deerflow-import|ingest|ingest-url)\s+(.+)$/i)
  if (!match?.[1]) return null
  const urlRaw = String(match[1]).trim()
  const url = coerceHttpUrl(urlRaw) || urlRaw
  return /^https?:\/\//i.test(url) ? { url } : null
}
