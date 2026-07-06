const INLINE_MEDIA_CONTEXT_URL_PATTERN = /(?:\bhttps?:\/\/[^\s"'<>)]*\.(?:avif|gif|jpe?g|m4a|m4v|mov|mp3|mp4|ogg|png|svg|wav|webm|webp)(?:[?#][^\s"'<>)]*)?|\bblob:[^\s"'<>)]{4,}|\bdata:(?:image|audio|video)\/[^\s"'<>)]{4,})/i

type InlineMediaCommandContextOptions = {
  maxDepth?: number
  maxLines?: number
}

const normalizeInlineMediaContextKey = (raw: string): string => {
  const key = String(raw || '')
    .normalize('NFKC')
    .replace(/[^A-Za-z0-9_.-]+/g, '.')
    .replace(/^\.+|\.+$/g, '')
  return key || 'mediaUrl'
}

const normalizeInlineMediaContextValue = (raw: unknown): string => {
  if (typeof raw !== 'string') return ''
  return raw.normalize('NFKC').replace(/\s+/g, ' ').trim()
}

const hasInlineMediaContextUrl = (value: string): boolean => INLINE_MEDIA_CONTEXT_URL_PATTERN.test(value)

export function buildInlineMediaCommandContextFromRecord(
  record: unknown,
  options: InlineMediaCommandContextOptions = {},
): string {
  const maxDepth = Number.isFinite(options.maxDepth) ? Math.max(0, Number(options.maxDepth)) : 4
  const maxLines = Number.isFinite(options.maxLines) ? Math.max(1, Number(options.maxLines)) : 48
  const lines: string[] = []
  const seen = new Set<string>()
  const seenObjects = new WeakSet<object>()

  const push = (path: string, value: string) => {
    if (!hasInlineMediaContextUrl(value)) return
    const key = normalizeInlineMediaContextKey(path)
    const dedupeKey = `${key}\u0000${value}`.toLowerCase()
    if (seen.has(dedupeKey)) return
    seen.add(dedupeKey)
    lines.push(`${key}: ${JSON.stringify(value)}`)
  }

  const visit = (value: unknown, path: string, depth: number) => {
    if (lines.length >= maxLines) return
    const scalar = normalizeInlineMediaContextValue(value)
    if (scalar) {
      push(path, scalar)
      return
    }
    if (!value || typeof value !== 'object' || depth >= maxDepth) return
    if (seenObjects.has(value)) return
    seenObjects.add(value)
    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, `${path}.${index}`, depth + 1))
      return
    }
    for (const [key, nextValue] of Object.entries(value as Record<string, unknown>)) {
      visit(nextValue, path ? `${path}.${key}` : key, depth + 1)
      if (lines.length >= maxLines) return
    }
  }

  visit(record, '', 0)
  return lines.join('\n')
}
