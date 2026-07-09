const MARKDOWN_IMAGE_EMBED_RE = /!\[[^\]\r\n]*\]\((?:<[^>\r\n]*>|[^)\r\n]*)\)/g
const HTML_MEDIA_BLOCK_RE = /<(?:audio|video)\b[^>]*>[\s\S]*?<\/(?:audio|video)\s*>/gi
const HTML_MEDIA_SELF_CLOSING_RE = /<(?:audio|video)\b[^>]*\/?>/gi

export function readStoryboardCardSummaryText(value: unknown): string {
  const raw = String(value ?? '').replace(/\r/g, '')
  if (!raw.trim()) return ''
  return raw
    .replace(HTML_MEDIA_BLOCK_RE, '\n')
    .replace(HTML_MEDIA_SELF_CLOSING_RE, '\n')
    .replace(MARKDOWN_IMAGE_EMBED_RE, '')
    .split('\n')
    .map(line => line.replace(/[ \t]{2,}/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
    .trim()
}
