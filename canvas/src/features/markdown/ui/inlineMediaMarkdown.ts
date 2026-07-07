const ESCAPED_INLINE_MEDIA_RE = /!\\?\[((?:\\.|[^\]\\])*)\]\\?\((\\?<?[^)\r\n]+>?)\\?\)/g

const unescapeMarkdownPunctuation = (value: string): string =>
  String(value || '').replace(/\\([\\`*_{}\[\]()#+\-.!_:<>])/g, '$1')

const normalizeMediaDestination = (value: string): string => {
  const unescaped = unescapeMarkdownPunctuation(value).trim().replace(/\\+$/g, '')
  const unwrapped = unescaped.startsWith('<') && unescaped.endsWith('>')
    ? unescaped.slice(1, -1).trim()
    : unescaped
  if (/^(?:https?:\/\/|\/(?:api\/storage|__fetch_remote|__webpage_asset_path|__webpage_asset_proxy|__chat_asset_proxy)\b)/i.test(unwrapped)) {
    return unwrapped.replace(/\s+/g, '')
  }
  return unwrapped
}

export const normalizeEscapedInlineMediaMarkdown = (markdown: string): string => {
  const raw = String(markdown || '')
  if (!raw.includes('!\\[') && !raw.includes('\\(')) return raw
  return raw.replace(ESCAPED_INLINE_MEDIA_RE, (_match, altRaw: string, destinationRaw: string) => {
    const alt = unescapeMarkdownPunctuation(altRaw).replace(/\r?\n/g, ' ').trim() || 'Image'
    const destination = normalizeMediaDestination(destinationRaw)
    if (!destination) return _match
    return `![${alt.replace(/]/g, '\\]')}](${destination})`
  })
}
