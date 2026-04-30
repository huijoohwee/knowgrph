type ParsedHtmlFragment = {
  body: HTMLElement
  firstElement: Element | null
}

const HTML_PARSE_CACHE_LIMIT = 48
const htmlFragmentCache = new Map<string, ParsedHtmlFragment | null>()

const readDomParserCtor = (): typeof DOMParser | null => {
  const ctor = (globalThis as unknown as { DOMParser?: typeof DOMParser }).DOMParser
  return typeof ctor === 'function' ? ctor : null
}

export const parseHtmlFragmentCached = (rawHtml: string): ParsedHtmlFragment | null => {
  const raw = String(rawHtml || '').trim()
  if (!raw || !raw.includes('<')) return null
  const cached = htmlFragmentCache.get(raw)
  if (cached !== undefined) return cached
  const DomParserCtor = readDomParserCtor()
  if (!DomParserCtor) return null
  let parsed: ParsedHtmlFragment | null = null
  try {
    const parser = new DomParserCtor()
    const doc = parser.parseFromString(`<body>${raw}</body>`, 'text/html')
    parsed = {
      body: doc.body,
      firstElement: doc.body.firstElementChild,
    }
  } catch {
    parsed = null
  }
  if (htmlFragmentCache.size >= HTML_PARSE_CACHE_LIMIT) {
    const oldest = htmlFragmentCache.keys().next().value
    if (typeof oldest === 'string') htmlFragmentCache.delete(oldest)
  }
  htmlFragmentCache.set(raw, parsed)
  return parsed
}
