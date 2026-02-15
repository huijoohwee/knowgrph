import { hashText } from '@/features/parsers/hash'
import { LRUCache } from '@/lib/cache/LRUCache'

type HastNode = {
  type?: unknown
  tagName?: unknown
  children?: unknown
  properties?: unknown
  value?: unknown
}

const stripHastElements = (node: HastNode, banned: Set<string>): void => {
  const kids = Array.isArray(node.children) ? (node.children as HastNode[]) : null
  if (!kids || kids.length === 0) return
  const next: HastNode[] = []
  for (const k of kids) {
    const t = typeof k?.type === 'string' ? k.type : ''
    const tag = t === 'element' && typeof k?.tagName === 'string' ? k.tagName.toLowerCase() : ''
    if (tag && banned.has(tag)) continue
    stripHastElements(k, banned)
    next.push(k)
  }
  node.children = next
}

const resolveHastUrls = (node: HastNode, baseUrl: string): void => {
  const kids = Array.isArray(node.children) ? (node.children as HastNode[]) : null
  const t = typeof node?.type === 'string' ? node.type : ''
  const tag = t === 'element' && typeof node?.tagName === 'string' ? node.tagName.toLowerCase() : ''
  const props = node && typeof node.properties === 'object' && node.properties ? (node.properties as Record<string, unknown>) : null
  const resolve = (value: unknown): string => {
    const raw = typeof value === 'string' ? value.trim() : ''
    if (!raw) return ''
    if (/^(data:|mailto:|tel:|javascript:)/i.test(raw)) return raw
    try {
      return new URL(raw, baseUrl).toString()
    } catch {
      return raw
    }
  }
  if (props && tag) {
    if (tag === 'a' && typeof props.href === 'string') props.href = resolve(props.href)
    if ((tag === 'img' || tag === 'iframe' || tag === 'audio' || tag === 'video') && typeof props.src === 'string') {
      props.src = resolve(props.src)
    }
    if (tag === 'source' && typeof props.src === 'string') props.src = resolve(props.src)
    if (tag === 'link' && typeof props.href === 'string') props.href = resolve(props.href)
  }
  if (!kids || kids.length === 0) return
  for (const k of kids) resolveHastUrls(k, baseUrl)
}

export type HtmlToMarkdownUnifiedResult =
  | { ok: true; markdown: string }
  | { ok: false; error: string }

type HtmlToMarkdownProgressPhase = 'parse' | 'transform' | 'toMarkdown' | 'stringify'

const CACHE = new LRUCache<string, string>(60, 5 * 60_000)

export async function convertHtmlToMarkdownUnified(args: {
  html: string
  baseUrl?: string
  maxInputChars?: number
  includeImages?: boolean
  fidelityLevel?: 1 | 2 | 3 | 4
  onProgress?: (phase: HtmlToMarkdownProgressPhase, percentage: number) => void
}): Promise<HtmlToMarkdownUnifiedResult> {
  try {
    const raw = String(args.html || '')
    const baseUrl = typeof args.baseUrl === 'string' ? args.baseUrl.trim() : ''
    const includeImages = args.includeImages !== false
    const fidelityLevelRaw = args.fidelityLevel
    const fidelityLevel: 1 | 2 | 3 | 4 =
      fidelityLevelRaw === 1 || fidelityLevelRaw === 2 || fidelityLevelRaw === 3 || fidelityLevelRaw === 4
        ? fidelityLevelRaw
        : 3
    const maxInputChars =
      typeof args.maxInputChars === 'number' && Number.isFinite(args.maxInputChars)
        ? Math.max(10_000, Math.min(12_000_000, Math.floor(args.maxInputChars)))
        : 2_500_000
    const html = raw.length > maxInputChars ? raw.slice(0, maxInputChars) : raw
    if (!html.trim()) return { ok: false, error: 'Missing HTML' }

    const cacheKey = `${baseUrl}|${html.length}|${hashText(html)}`
    const cached = CACHE.get(cacheKey)
    if (cached) return { ok: true, markdown: cached }

    try {
      args.onProgress?.('parse', 10)
    } catch {
      void 0
    }

    const [{ unified }, rehypeParseMod, rehypeRemarkMod, remarkStringifyMod, remarkGfmMod, hastToHtmlMod] = await Promise.all([
      import('unified'),
      import('rehype-parse'),
      import('rehype-remark'),
      import('remark-stringify'),
      import('remark-gfm'),
      import('hast-util-to-html'),
    ])

    const rehypeParse = (rehypeParseMod as unknown as { default?: unknown }).default
    const rehypeRemark = (rehypeRemarkMod as unknown as { default?: unknown }).default
    const remarkStringify = (remarkStringifyMod as unknown as { default?: unknown }).default
    const remarkGfm = (remarkGfmMod as unknown as { default?: unknown }).default
    const toHtml = (hastToHtmlMod as unknown as { toHtml?: unknown }).toHtml

    if (typeof rehypeParse !== 'function') return { ok: false, error: 'rehype-parse not available' }
    if (typeof rehypeRemark !== 'function') return { ok: false, error: 'rehype-remark not available' }
    if (typeof remarkStringify !== 'function') return { ok: false, error: 'remark-stringify not available' }
    if (typeof toHtml !== 'function') return { ok: false, error: 'hast-util-to-html not available' }

    const preserveAsHtmlHandler = (tagName: string) => {
      return (_state: unknown, node: unknown) => {
        const value = toHtml(node as never)
        return { type: 'html', value, position: null }
      }
    }

    const preserveTags = new Set<string>(['iframe', 'svg', 'video', 'audio', 'details', 'summary'])
    if (includeImages) {
      preserveTags.add('img')
      preserveTags.add('picture')
      preserveTags.add('source')
      preserveTags.add('figure')
      preserveTags.add('figcaption')
    }
    if (fidelityLevel >= 3) {
      preserveTags.add('canvas')
    }
    if (fidelityLevel >= 4) {
      preserveTags.add('style')
      preserveTags.add('link')
      preserveTags.add('form')
      preserveTags.add('input')
      preserveTags.add('textarea')
      preserveTags.add('select')
      preserveTags.add('option')
      preserveTags.add('button')
    }
    const handlers = Object.fromEntries(Array.from(preserveTags).map(t => [t, preserveAsHtmlHandler(t)])) as unknown

    try {
      args.onProgress?.('transform', 35)
    } catch {
      void 0
    }

    const processor = unified()
      .use(rehypeParse as never, { fragment: true } as never)
      .use(() => {
        return (tree: unknown) => {
          try {
            const banned = new Set(['script', 'noscript'])
            if (fidelityLevel < 4) banned.add('style')
            if (!includeImages) {
              banned.add('img')
              banned.add('picture')
            }
            stripHastElements(tree as HastNode, banned)
            if (baseUrl) resolveHastUrls(tree as HastNode, baseUrl)
          } catch {
            void 0
          }
        }
      })
      .use(rehypeRemark as never, { handlers } as never)
      .use(remarkGfm as never)

    try {
      args.onProgress?.('toMarkdown', 65)
    } catch {
      void 0
    }

    processor.use(remarkStringify as never, {
      allowDangerousHtml: true,
      bullet: '-',
      fences: true,
      fence: '```',
      listItemIndent: 'one',
    } as never)

    try {
      args.onProgress?.('stringify', 85)
    } catch {
      void 0
    }

    const file = await processor.process(html)
    const markdown = String(file || '').trim()
    if (!markdown) return { ok: false, error: 'Conversion produced empty markdown' }
    CACHE.set(cacheKey, markdown)
    try {
      args.onProgress?.('stringify', 100)
    } catch {
      void 0
    }
    return { ok: true, markdown }
  } catch (e) {
    const msg = e && typeof e === 'object' && 'message' in e ? String((e as { message?: unknown }).message || '') : ''
    return { ok: false, error: msg || 'Unified conversion failed' }
  }
}
