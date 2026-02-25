import { hashText } from '../../features/parsers/hash'
import { LRUCache } from '../cache/LRUCache'

type HastNode = {
  type?: unknown
  tagName?: unknown
  children?: unknown
  properties?: unknown
  value?: unknown
}

type HtmlHeadArtifactMeta = {
  name?: string
  property?: string
  httpEquiv?: string
  charset?: string
  content?: string
}

type HtmlHeadArtifactLink = {
  rel?: string
  href?: string
  as?: string
  type?: string
  sizes?: string
}

type HtmlHeadArtifacts = {
  title?: string
  baseHref?: string
  metas: HtmlHeadArtifactMeta[]
  links: HtmlHeadArtifactLink[]
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

const filterHastElements = (node: HastNode, args: { remove: Set<string>; unwrap: Set<string> }): void => {
  const kids = Array.isArray(node.children) ? (node.children as HastNode[]) : null
  if (!kids || kids.length === 0) return
  const next: HastNode[] = []
  for (const k of kids) {
    const t = typeof k?.type === 'string' ? k.type : ''
    const tag = t === 'element' && typeof k?.tagName === 'string' ? k.tagName.toLowerCase() : ''
    if (tag && args.remove.has(tag)) continue
    filterHastElements(k, args)
    if (tag && args.unwrap.has(tag)) {
      const unwrappedKids = Array.isArray(k.children) ? (k.children as HastNode[]) : []
      next.push(...unwrappedKids)
      continue
    }
    next.push(k)
  }
  node.children = next
}

const extractTextLen = (node: HastNode): number => {
  return extractHastText(node).replace(/\s+/g, ' ').trim().length
}

const pickBestContentRoot = (root: HastNode): HastNode | null => {
  let best: { node: HastNode; score: number } | null = null

  const getProp = (node: HastNode, key: string): string => {
    const props = node && typeof node.properties === 'object' && node.properties ? (node.properties as Record<string, unknown>) : null
    if (!props) return ''
    const v = props[key]
    if (typeof v === 'string') return v
    if (Array.isArray(v)) return v.map(x => String(x || '')).join(' ').trim()
    return ''
  }

  const visit = (node: HastNode): void => {
    const t = typeof node?.type === 'string' ? node.type : ''
    const tag = t === 'element' && typeof node?.tagName === 'string' ? node.tagName.toLowerCase() : ''

    if (tag === 'main' || tag === 'article' || getProp(node, 'role') === 'main') {
      const score = extractTextLen(node)
      if (!best || score > best.score) best = { node, score }
    }

    const kids = Array.isArray(node.children) ? (node.children as HastNode[]) : null
    if (!kids || kids.length === 0) return
    for (const k of kids) visit(k)
  }

  visit(root)
  if (!best) return null
  if (best.score < 500) return null
  return best.node
}

const fillEmptyAnchorText = (root: HastNode): void => {
  const getProp = (node: HastNode, key: string): string => {
    const props = node && typeof node.properties === 'object' && node.properties ? (node.properties as Record<string, unknown>) : null
    if (!props) return ''
    const v = props[key]
    if (typeof v === 'string') return v
    if (Array.isArray(v)) return v.map(x => String(x || '')).join(' ').trim()
    return ''
  }

  const visit = (node: HastNode): void => {
    const t = typeof node?.type === 'string' ? node.type : ''
    const tag = t === 'element' && typeof node?.tagName === 'string' ? node.tagName.toLowerCase() : ''
    const kids = Array.isArray(node.children) ? (node.children as HastNode[]) : null

    if (tag === 'a') {
      const text = extractHastText(node).replace(/\s+/g, ' ').trim()
      if (!text) {
        const label =
          getProp(node, 'aria-label') ||
          getProp(node, 'ariaLabel') ||
          getProp(node, 'title') ||
          getProp(node, 'data-label') ||
          ''
        const href = getProp(node, 'href')
        const nextText = (label || href || '').trim()
        if (nextText) {
          node.children = [{ type: 'text', value: nextText }] as unknown as HastNode[]
        }
      }
    }

    if (!kids || kids.length === 0) return
    for (const k of kids) visit(k)
  }

  visit(root)
}

const resolveUrlLoose = (rawValue: unknown, baseUrl: string): string => {
  const raw = typeof rawValue === 'string' ? rawValue.trim() : ''
  if (!raw) return ''
  if (/^(data:|mailto:|tel:|javascript:)/i.test(raw)) return raw
  if (!baseUrl) return raw
  try {
    return new URL(raw, baseUrl).toString()
  } catch {
    return raw
  }
}

const resolveHastUrls = (node: HastNode, baseUrl: string): void => {
  const kids = Array.isArray(node.children) ? (node.children as HastNode[]) : null
  const t = typeof node?.type === 'string' ? node.type : ''
  const tag = t === 'element' && typeof node?.tagName === 'string' ? node.tagName.toLowerCase() : ''
  const props = node && typeof node.properties === 'object' && node.properties ? (node.properties as Record<string, unknown>) : null
  if (props && tag) {
    if (tag === 'a' && typeof props.href === 'string') props.href = resolveUrlLoose(props.href, baseUrl)
    if ((tag === 'img' || tag === 'iframe' || tag === 'audio' || tag === 'video') && typeof props.src === 'string') {
      props.src = resolveUrlLoose(props.src, baseUrl)
    }
    if (tag === 'source' && typeof props.src === 'string') props.src = resolveUrlLoose(props.src, baseUrl)
    if (tag === 'link' && typeof props.href === 'string') props.href = resolveUrlLoose(props.href, baseUrl)
  }
  if (!kids || kids.length === 0) return
  for (const k of kids) resolveHastUrls(k, baseUrl)
}

const extractHastText = (node: HastNode): string => {
  const t = typeof node?.type === 'string' ? node.type : ''
  if (t === 'text') return typeof node.value === 'string' ? node.value : ''
  const kids = Array.isArray(node.children) ? (node.children as HastNode[]) : null
  if (!kids || kids.length === 0) return ''
  return kids.map(k => extractHastText(k)).join('')
}

const normalizeLinkRel = (rel: unknown): string => {
  if (Array.isArray(rel)) return rel.map(v => String(v || '').trim()).filter(Boolean).join(' ')
  return typeof rel === 'string' ? rel.trim() : ''
}

const collectHeadArtifacts = (tree: HastNode): HtmlHeadArtifacts => {
  const artifacts: HtmlHeadArtifacts = { metas: [], links: [] }

  const visit = (node: HastNode, inHead: boolean): void => {
    const t = typeof node?.type === 'string' ? node.type : ''
    const tag = t === 'element' && typeof node?.tagName === 'string' ? node.tagName.toLowerCase() : ''
    const kids = Array.isArray(node.children) ? (node.children as HastNode[]) : null
    const props = node && typeof node.properties === 'object' && node.properties ? (node.properties as Record<string, unknown>) : null

    const nextInHead = inHead || tag === 'head'
    const isHeadishTag = nextInHead || tag === 'title' || tag === 'base' || tag === 'meta' || tag === 'link'
    if (isHeadishTag && tag) {
      if (tag === 'title' && !artifacts.title) {
        const text = extractHastText(node).replace(/\s+/g, ' ').trim()
        if (text) artifacts.title = text
      }
      if (tag === 'base' && props && !artifacts.baseHref && typeof props.href === 'string') {
        const href = String(props.href || '').trim()
        if (href) artifacts.baseHref = href
      }
      if (tag === 'meta' && props) {
        const name = typeof props.name === 'string' ? String(props.name || '').trim() : ''
        const property = typeof props.property === 'string' ? String(props.property || '').trim() : ''
        const httpEquiv = typeof props['http-equiv'] === 'string' ? String(props['http-equiv'] || '').trim() : ''
        const charset = typeof props.charset === 'string' ? String(props.charset || '').trim() : ''
        const content = typeof props.content === 'string' ? String(props.content || '').trim() : ''
        if (name || property || httpEquiv || charset || content) {
          artifacts.metas.push({
            name: name || undefined,
            property: property || undefined,
            httpEquiv: httpEquiv || undefined,
            charset: charset || undefined,
            content: content || undefined,
          })
        }
      }
      if (tag === 'link' && props) {
        const rel = normalizeLinkRel(props.rel)
        const href = typeof props.href === 'string' ? String(props.href || '').trim() : ''
        const as = typeof props.as === 'string' ? String(props.as || '').trim() : ''
        const type = typeof props.type === 'string' ? String(props.type || '').trim() : ''
        const sizes = typeof props.sizes === 'string' ? String(props.sizes || '').trim() : ''
        if (rel || href || as || type || sizes) {
          artifacts.links.push({
            rel: rel || undefined,
            href: href || undefined,
            as: as || undefined,
            type: type || undefined,
            sizes: sizes || undefined,
          })
        }
      }
    }

    if (!kids || kids.length === 0) return
    for (const k of kids) visit(k, nextInHead)
  }

  visit(tree, false)
  return artifacts
}

const renderHeadSectionMarkdown = (head: HtmlHeadArtifacts, baseUrl: string): string => {
  const inline = (v: unknown): string => {
    return String(v ?? '')
      .replace(/\r/g, '')
      .replace(/\n+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }
  const cell = (v: unknown): string => inline(v).replace(/\|/g, '\\|')

  const lines: string[] = []
  lines.push('## HTML Head')
  lines.push('')
  if (head.title) lines.push(`- Title: ${inline(head.title)}`)
  if (head.baseHref) lines.push(`- Base Href: ${inline(head.baseHref)}`)
  if (baseUrl) lines.push(`- Resolved Base URL: ${inline(baseUrl)}`)

  if (head.metas.length > 0) {
    const filtered = head.metas.filter(m => {
      const name = String(m.name || '').toLowerCase()
      if (name === 'csrf-param' || name === 'csrf-token') return false
      return true
    })
    if (filtered.length === 0) return lines.join('\n')
    lines.push('')
    lines.push('| name | property | httpEquiv | charset | content |')
    lines.push('|---|---|---|---|---|')
    filtered.forEach(m => {
      lines.push(`| ${cell(m.name)} | ${cell(m.property)} | ${cell(m.httpEquiv)} | ${cell(m.charset)} | ${cell(m.content)} |`)
    })
  }

  if (head.links.length > 0) {
    lines.push('')
    lines.push('| rel | href | as | type | sizes |')
    lines.push('|---|---|---|---|---|')
    head.links.forEach(l => {
      lines.push(`| ${cell(l.rel)} | ${cell(l.href)} | ${cell(l.as)} | ${cell(l.type)} | ${cell(l.sizes)} |`)
    })
  }

  return lines.join('\n')
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
  includeHeadSection?: boolean
  injectTitleHeading?: boolean
  onProgress?: (phase: HtmlToMarkdownProgressPhase, percentage: number) => void
}): Promise<HtmlToMarkdownUnifiedResult> {
  try {
    const raw = String(args.html || '')
    const baseUrl = typeof args.baseUrl === 'string' ? args.baseUrl.trim() : ''
    const includeImages = args.includeImages !== false
    const includeHeadSection = args.includeHeadSection === true
    const injectTitleHeading = args.injectTitleHeading === true
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

    const cacheKey = [
      baseUrl,
      includeImages ? 'img:1' : 'img:0',
      `fid:${fidelityLevel}`,
      includeHeadSection ? 'head:1' : 'head:0',
      injectTitleHeading ? 'title:1' : 'title:0',
      String(html.length),
      hashText(html),
    ].join('|')
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

    const preserveAsHtmlHandler = () => {
      return (_state: unknown, node: unknown) => {
        const value = toHtml(node as never)
        return { type: 'html', value, position: null }
      }
    }

    const handlers = Object.fromEntries([]) as unknown

    try {
      args.onProgress?.('transform', 35)
    } catch {
      void 0
    }

    let extractedHead: HtmlHeadArtifacts | null = null
    let resolvedBaseUrl = baseUrl

    const replaceMediaEmbedsWithLinks = (tree: HastNode) => {
      const getProp = (node: HastNode, key: string): string => {
        const el = node as unknown as { properties?: Record<string, unknown> }
        const props = el?.properties || {}
        const v = props[key]
        if (typeof v === 'string') return v
        if (Array.isArray(v)) return v.map(x => String(x || '')).join(' ').trim()
        return ''
      }

      const makeLinkPara = (label: string, href: string): HastNode => {
        return {
          type: 'element',
          tagName: 'p',
          properties: {},
          children: [
            { type: 'text', value: `${label}: ` },
            { type: 'element', tagName: 'a', properties: { href }, children: [{ type: 'text', value: href }] },
          ],
        } as unknown as HastNode
      }

      const makeLinksList = (label: string, hrefs: string[]): HastNode => {
        const items = hrefs.map(href => ({
          type: 'element',
          tagName: 'li',
          properties: {},
          children: [{ type: 'element', tagName: 'a', properties: { href }, children: [{ type: 'text', value: href }] }],
        }))
        return {
          type: 'element',
          tagName: 'div',
          properties: {},
          children: [
            { type: 'element', tagName: 'p', properties: {}, children: [{ type: 'text', value: `${label}:` }] },
            { type: 'element', tagName: 'ul', properties: {}, children: items as unknown as HastNode[] },
          ],
        } as unknown as HastNode
      }

      const uniq = (items: string[]): string[] => {
        const out: string[] = []
        const seen = new Set<string>()
        for (const it of items) {
          const t = String(it || '').trim()
          if (!t) continue
          if (seen.has(t)) continue
          seen.add(t)
          out.push(t)
        }
        return out
      }

      const visit = (node: HastNode) => {
        const el = node as unknown as { type?: string; tagName?: string; children?: HastNode[] }
        const type = String(el?.type || '')
        if (type !== 'element' && type !== 'root') return
        const children = Array.isArray(el.children) ? el.children : []
        for (let i = 0; i < children.length; i += 1) {
          const child = children[i] as HastNode
          const cEl = child as unknown as { type?: string; tagName?: string; children?: HastNode[] }
          if (cEl?.type === 'element') {
            const tag = String(cEl.tagName || '').toLowerCase()
            if (tag === 'iframe') {
              const src = getProp(child, 'src')
              if (src) {
                children[i] = makeLinkPara('Embed', src)
                continue
              }
            }
            if (tag === 'video' || tag === 'audio') {
              const src = getProp(child, 'src')
              const sourceEls = Array.isArray(cEl.children) ? cEl.children : []
              const sources = sourceEls
                .filter(n => (n as unknown as { type?: string; tagName?: string }).type === 'element')
                .filter(n => String((n as unknown as { tagName?: string }).tagName || '').toLowerCase() === 'source')
                .map(n => getProp(n as HastNode, 'src'))
              const all = uniq([src, ...sources])
              if (all.length === 1) {
                children[i] = makeLinkPara(tag === 'video' ? 'Video' : 'Audio', all[0] || '')
                continue
              }
              if (all.length > 1) {
                children[i] = makeLinksList(tag === 'video' ? 'Video' : 'Audio', all)
                continue
              }
            }
          }
          visit(child)
        }
      }

      visit(tree)
    }

    const processor = unified()
      .use(rehypeParse as never, { fragment: true } as never)
      .use(() => {
        return (tree: unknown) => {
          try {
            extractedHead = collectHeadArtifacts(tree as HastNode)
            if (!resolvedBaseUrl && extractedHead?.baseHref) {
              const baseHrefResolved = resolveUrlLoose(extractedHead.baseHref, baseUrl)
              resolvedBaseUrl = baseHrefResolved || extractedHead.baseHref
            }
            if (extractedHead?.links?.length && resolvedBaseUrl) {
              extractedHead.links = extractedHead.links.map(l => {
                if (l.href) return { ...l, href: resolveUrlLoose(l.href, resolvedBaseUrl) }
                return l
              })
            }
            const bestRoot = pickBestContentRoot(tree as HastNode)
            if (bestRoot && bestRoot !== (tree as HastNode)) {
              ;(tree as HastNode).children = [bestRoot] as unknown as HastNode[]
            }
            replaceMediaEmbedsWithLinks(tree as HastNode)
            const filter = {
              remove: new Set([
              'script',
              'head',
              'meta',
              'link',
              'title',
              'base',
              'style',
              'svg',
              'input',
              'textarea',
              'select',
              'option',
              'canvas',
              ...(includeImages ? [] : ['img', 'picture']),
            ]),
              unwrap: new Set(['button', 'form', 'noscript']),
            }
            if (!includeImages) {
              void 0
            }
            filterHastElements(tree as HastNode, filter)
            fillEmptyAnchorText(tree as HastNode)
            if (resolvedBaseUrl) resolveHastUrls(tree as HastNode, resolvedBaseUrl)
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
      fence: '`',
      listItemIndent: 'one',
      lineWidth: 0,
    } as never)

    try {
      args.onProgress?.('stringify', 85)
    } catch {
      void 0
    }

    const file = await processor.process(html)
    const coreMarkdown = String(file || '').trim()

    const headSection = (() => {
      if (!extractedHead) return ''
      const hasAnyHead =
        !!extractedHead.title || !!extractedHead.baseHref || extractedHead.metas.length > 0 || extractedHead.links.length > 0
      if (!hasAnyHead) return ''
      if (includeHeadSection) return renderHeadSectionMarkdown(extractedHead, resolvedBaseUrl)
      return ''
    })()

    const titleHeading = (() => {
      if (!injectTitleHeading) return ''
      const title = String(extractedHead?.title || '').trim()
      if (!title) return ''
      const firstLine = (coreMarkdown.split('\n')[0] || '').trim()
      if (firstLine.startsWith('# ')) return ''
      return `# ${title}`
    })()

    const parts = [titleHeading, headSection, coreMarkdown].filter(Boolean)
    const markdown = parts.join('\n\n').trim()
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
