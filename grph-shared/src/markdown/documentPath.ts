export function normalizeMarkdownDocumentPath(raw: unknown): string {
  const text = String(raw || '').trim()
  if (!text) return ''

  const hashIndex = text.indexOf('#')
  const noHash = (hashIndex >= 0 ? text.slice(0, hashIndex) : text).trim()

  const withoutFileScheme = (() => {
    if (!noHash.startsWith('file://')) return noHash
    return noHash.replace(/^file:\/\/+/, '')
  })()

  const normalizedSlashes = withoutFileScheme.replace(/\\/g, '/').trim()
  return normalizedSlashes.replace(/^\/+/, '').trim()
}

export function matchesMarkdownDocumentPath(a: unknown, b: unknown): boolean {
  const left = normalizeMarkdownDocumentPath(a)
  const right = normalizeMarkdownDocumentPath(b)
  if (!left || !right) return !left || !right
  if (left === right) return true
  if (left.endsWith(`/${right}`)) return true
  if (right.endsWith(`/${left}`)) return true
  return false
}

