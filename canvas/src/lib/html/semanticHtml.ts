export type SemanticHtmlContainerTag =
  | 'main'
  | 'section'
  | 'article'
  | 'aside'
  | 'nav'
  | 'header'
  | 'footer'

const GENERIC_CONTAINER_TAG = 'div'
const DEFAULT_CONTAINER_TAG: SemanticHtmlContainerTag = 'section'
const OPAQUE_HTML_BLOCK_RE = /<(script|style|textarea|template)\b[\s\S]*?<\/\1\s*>/gi

const ROLE_CONTAINER_TAGS: Record<string, SemanticHtmlContainerTag> = {
  article: 'article',
  banner: 'header',
  complementary: 'aside',
  contentinfo: 'footer',
  main: 'main',
  navigation: 'nav',
  region: 'section',
  search: 'section',
}

const readDomParserCtor = (): typeof DOMParser | null => {
  const ctor = (globalThis as unknown as { DOMParser?: typeof DOMParser }).DOMParser
  return typeof ctor === 'function' ? ctor : null
}

const isFullHtmlDocument = (html: string): boolean => /<!doctype\b|<html[\s>]/i.test(html)

const resolveSemanticContainerTag = (el: Element): SemanticHtmlContainerTag => {
  const role = String(el.getAttribute('role') || '').trim().toLowerCase()
  return ROLE_CONTAINER_TAGS[role] || DEFAULT_CONTAINER_TAG
}

const replaceElementTag = (doc: Document, el: Element, tag: SemanticHtmlContainerTag): void => {
  const replacement = doc.createElement(tag)
  for (const name of el.getAttributeNames()) {
    const value = el.getAttribute(name)
    if (value != null) replacement.setAttribute(name, value)
  }
  while (el.firstChild) replacement.appendChild(el.firstChild)
  el.replaceWith(replacement)
}

const normalizeWithDomParser = (html: string): string | null => {
  const Parser = readDomParserCtor()
  if (!Parser || !/<\s*div\b/i.test(html)) return null

  const fullDocument = isFullHtmlDocument(html)
  const parsed = new Parser().parseFromString(fullDocument ? html : `<body>${html}</body>`, 'text/html')
  const divs = Array.from(parsed.querySelectorAll(GENERIC_CONTAINER_TAG))
  if (divs.length === 0) return html

  for (const div of divs) {
    replaceElementTag(parsed, div, resolveSemanticContainerTag(div))
  }

  if (!fullDocument) return parsed.body?.innerHTML || html

  const root = parsed.documentElement?.outerHTML
  if (!root) return html
  return /^\s*<!doctype\b/i.test(html) ? `<!doctype html>${root}` : root
}

const normalizeLexically = (html: string): string => {
  const opaqueBlocks: string[] = []
  const masked = html.replace(OPAQUE_HTML_BLOCK_RE, block => {
    const index = opaqueBlocks.push(block) - 1
    return `<!--kg-semantic-html-opaque-${index}-->`
  })
  const normalized = masked
    .replace(/<\s*div\b/gi, '<section')
    .replace(/<\s*\/\s*div\s*>/gi, '</section>')

  return normalized.replace(/<!--kg-semantic-html-opaque-(\d+)-->/g, (_match, index: string) => {
    const block = opaqueBlocks[Number(index)]
    return typeof block === 'string' ? block : ''
  })
}

export const normalizeSemanticHtmlContainers = (html: string): string => {
  const raw = String(html || '')
  if (!/<\s*div\b/i.test(raw)) return raw
  return normalizeWithDomParser(raw) ?? normalizeLexically(raw)
}
