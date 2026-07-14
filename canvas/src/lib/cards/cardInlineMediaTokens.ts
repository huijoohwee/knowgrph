import { readCardMarkdownPreviewMediaLabel } from '@/lib/cards/cardMarkdownPreviewUtils'

const INLINE_MEDIA_TOKEN_RE = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)|<(audio|video)\b([^>]*)>\s*(?:<\/\3>)?/gi
const HTML_ATTR_RE = /\s([a-zA-Z][a-zA-Z0-9:-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g

export type CardInlineMediaToken = {
  end: number
  kind: 'image' | 'audio' | 'video'
  label: string
  start: number
  url: string
}

const readHtmlAttr = (attrs: string, name: string): string => {
  HTML_ATTR_RE.lastIndex = 0
  for (const match of attrs.matchAll(HTML_ATTR_RE)) {
    if (String(match[1] || '').toLowerCase() !== name.toLowerCase()) continue
    return String(match[2] ?? match[3] ?? match[4] ?? '').trim()
  }
  return ''
}

const parseInlineMediaToken = (match: RegExpExecArray): CardInlineMediaToken | null => {
  const start = match.index ?? 0
  const end = start + String(match[0] || '').length
  if (match[2]) {
    const url = String(match[2] || '').trim()
    if (!url) return null
    return {
      end,
      kind: 'image',
      label: readCardMarkdownPreviewMediaLabel(match[1], 'Image'),
      start,
      url,
    }
  }
  const kind = String(match[3] || '').toLowerCase()
  if (kind !== 'audio' && kind !== 'video') return null
  const attrs = String(match[4] || '')
  const url = readHtmlAttr(attrs, 'src')
  if (!url) return null
  return {
    end,
    kind,
    label: readCardMarkdownPreviewMediaLabel(readHtmlAttr(attrs, 'title'), kind === 'audio' ? 'Audio' : 'Video'),
    start,
    url,
  }
}

export function readCardInlineMediaTokens(raw: unknown): CardInlineMediaToken[] {
  const source = String(raw || '')
  const tokens: CardInlineMediaToken[] = []
  INLINE_MEDIA_TOKEN_RE.lastIndex = 0
  for (const match of source.matchAll(INLINE_MEDIA_TOKEN_RE)) {
    const token = parseInlineMediaToken(match)
    if (token) tokens.push(token)
  }
  return tokens
}
