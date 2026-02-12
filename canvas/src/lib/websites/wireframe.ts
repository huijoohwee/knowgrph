export function buildWireframeMarkdownFromMarkdown(args: { markdown: string; url: string }): string {
  const MAX_LABEL_WIDTH = 72
  const MAX_HEADINGS = 120
  const MAX_DETAIL_BOXES_PER_SECTION = 6
  const MAX_DETAIL_TEXT = 52
  const MAX_INPUT_CHARS = 2_000_000
  const MAX_SCAN_LINES = 30_000

  type Stats = {
    paragraphs: number
    listItems: number
    images: number
    links: number
    codeBlocks: number
    tables: number
    embeds: number
    media: number
    anim: number
    ui: number
    timecodes: number
    prices: number
    quotes: number
    hr: number
  }

  type Detail =
    | { kind: 'img'; label: string }
    | { kind: 'lnk'; label: string }
    | { kind: 'li'; label: string }
    | { kind: 'tbl'; label: string }
    | { kind: 'code'; label: string }
    | { kind: 'emb'; label: string }
    | { kind: 'med'; label: string }
    | { kind: 'ani'; label: string }
    | { kind: 'ui'; label: string }
    | { kind: 'tim'; label: string }
    | { kind: 'pri'; label: string }

  type SectionNode = {
    level: number
    title: string
    stats: Stats
    details: Detail[]
    detailCounts: Map<string, number>
    children: SectionNode[]
  }

  const newStats = (): Stats => ({
    paragraphs: 0,
    listItems: 0,
    images: 0,
    links: 0,
    codeBlocks: 0,
    tables: 0,
    embeds: 0,
    media: 0,
    anim: 0,
    ui: 0,
    timecodes: 0,
    prices: 0,
    quotes: 0,
    hr: 0,
  })

  const normalizeInline = (raw: string) => String(raw || '').replace(/\s+/g, ' ').trim()
  const truncate = (raw: string, max: number) => {
    const s = normalizeInline(raw)
    if (s.length <= max) return s
    return `${s.slice(0, Math.max(0, max - 1)).trimEnd()}…`
  }

  const renderBox = (labelRaw: string) => {
    const label = truncate(labelRaw, MAX_LABEL_WIDTH)
    const innerWidth = Math.min(MAX_LABEL_WIDTH, Math.max(12, label.length))
    const top = `+${'-'.repeat(innerWidth + 2)}+`
    const body = `| ${label.padEnd(innerWidth, ' ')} |`
    const bot = `+${'-'.repeat(innerWidth + 2)}+`
    return [top, body, bot]
  }

  const renderNode = (node: { label: string; depth: number }, out: string[]) => {
    const indent = ' '.repeat(Math.max(0, node.depth) * 4)
    const box = renderBox(node.label)
    for (const l of box) out.push(`${indent}${l}`)
  }

  const statsLabel = (s: Stats) => {
    const parts: string[] = []
    if (s.paragraphs) parts.push(`p:${s.paragraphs}`)
    if (s.listItems) parts.push(`li:${s.listItems}`)
    if (s.images) parts.push(`img:${s.images}`)
    if (s.links) parts.push(`ln:${s.links}`)
    if (s.tables) parts.push(`tb:${s.tables}`)
    if (s.codeBlocks) parts.push(`cd:${s.codeBlocks}`)
    if (s.embeds) parts.push(`em:${s.embeds}`)
    if (s.media) parts.push(`med:${s.media}`)
    if (s.anim) parts.push(`an:${s.anim}`)
    if (s.ui) parts.push(`ui:${s.ui}`)
    if (s.timecodes) parts.push(`t:${s.timecodes}`)
    if (s.prices) parts.push(`$:${s.prices}`)
    if (s.quotes) parts.push(`qt:${s.quotes}`)
    if (s.hr) parts.push(`hr:${s.hr}`)
    return parts.length ? `(${parts.join(' ')})` : ''
  }

  const trackDetail = (sec: SectionNode, detail: Detail) => {
    const key = detail.label
    const prev = sec.detailCounts.get(key) || 0
    sec.detailCounts.set(key, prev + 1)
    if (prev > 0) return
    if (sec.details.length >= MAX_DETAIL_BOXES_PER_SECTION) return
    sec.details.push(detail)
  }

  const classifyLinkLabel = (labelRaw: string): 'cta' | 'nav' | 'lnk' => {
    const s = normalizeInline(labelRaw).toLowerCase()
    if (!s) return 'lnk'
    const ctaWords = [
      'sign up',
      'signup',
      'sign in',
      'signin',
      'log in',
      'login',
      'get started',
      'start',
      'try',
      'download',
      'install',
      'create',
      'open',
      'join',
      'contact',
      'request',
      'book a demo',
      'demo',
    ]
    for (const w of ctaWords) {
      if (s === w) return 'cta'
    }
    if (s.startsWith('get started')) return 'cta'
    if (s.startsWith('download')) return 'cta'
    const navWords = [
      'docs',
      'documentation',
      'user guide',
      'guide',
      'learn',
      'learning',
      'tutorials',
      'blog',
      'community',
      'resources',
      'pricing',
      'features',
      'changelog',
      'about',
      'github',
      'api',
    ]
    for (const w of navWords) {
      if (s === w) return 'nav'
    }
    return 'lnk'
  }

  const tagNameFromHtmlLine = (line: string) => {
    const s = String(line || '').trimStart()
    if (!s.startsWith('<')) return null
    const m = s.match(/^<\s*([a-zA-Z][a-zA-Z0-9-]*)\b/)
    if (!m) return null
    return String(m[1] || '').toLowerCase()
  }

  const classifyHtmlTag = (tag: string): Detail | null => {
    switch (tag) {
      case 'header':
      case 'nav':
      case 'main':
      case 'section':
      case 'article':
      case 'aside':
      case 'footer':
        return { kind: 'ui', label: `[REGION] ${tag}` }
      case 'iframe':
        return { kind: 'emb', label: `[EMBED] iframe` }
      case 'video':
        return { kind: 'med', label: `[MEDIA] video` }
      case 'audio':
        return { kind: 'med', label: `[MEDIA] audio` }
      case 'svg':
        return { kind: 'ani', label: `[ANIM] svg` }
      case 'canvas':
        return { kind: 'ani', label: `[ANIM] canvas` }
      case 'lottie-player':
        return { kind: 'ani', label: `[ANIM] lottie` }
      case 'model-viewer':
        return { kind: 'ani', label: `[ANIM] model-viewer` }
      case 'button':
      case 'input':
      case 'select':
      case 'form':
        return { kind: 'ui', label: `[UI] ${tag}` }
      default:
        return null
    }
  }

  const addInlineLinksAndImages = (sec: SectionNode, line: string) => {
    const s = String(line || '')
    const imgRe = /!\[([^\]]*)\]\(([^)]+)\)/g
    let m: RegExpExecArray | null
    while ((m = imgRe.exec(s))) {
      sec.stats.images += 1
      const alt = truncate(m[1] || 'image', MAX_DETAIL_TEXT)
      trackDetail(sec, { kind: 'img', label: `[IMG] ${alt}` })
    }
    const linkRe = /\[([^\]]+)\]\(([^)]+)\)/g
    while ((m = linkRe.exec(s))) {
      const idx = m.index
      if (idx > 0 && s.charCodeAt(idx - 1) === 33) continue
      sec.stats.links += 1
      const text = truncate(m[1] || 'link', MAX_DETAIL_TEXT)
      const kind = classifyLinkLabel(text)
      const prefix = kind === 'cta' ? '[CTA]' : kind === 'nav' ? '[NAV]' : '[LINK]'
      trackDetail(sec, { kind: 'lnk', label: `${prefix} ${text}` })
    }
  }

  const addInlinePriceSignals = (sec: SectionNode, line: string) => {
    const s = String(line || '')
    if (!s) return
    const priceRe = /(\$\s?\d{1,3}(?:,\d{3})*(?:\.\d+)?(?:\s*\/\s*(?:mo|month|yr|year))?)/gi
    let m: RegExpExecArray | null
    while ((m = priceRe.exec(s))) {
      const token = truncate(m[1] || '', MAX_DETAIL_TEXT)
      if (!token) continue
      sec.stats.prices += 1
      trackDetail(sec, { kind: 'pri', label: `[PRICE] ${token}` })
    }
    const perRe = /\b\d+(?:\.\d+)?\s*\/\s*(?:mo|month|yr|year)\b/gi
    while ((m = perRe.exec(s))) {
      if (typeof m.index === 'number' && m.index > 0 && s.charCodeAt(m.index - 1) === 36) continue
      const token = truncate(m[0] || '', MAX_DETAIL_TEXT)
      if (!token) continue
      sec.stats.prices += 1
      trackDetail(sec, { kind: 'pri', label: `[PRICE] ${token}` })
    }
  }

  const addInlineTimecodes = (sec: SectionNode, line: string) => {
    const s = String(line || '')
    if (!s) return
    const timeRe = /\b\d{1,2}:\d{2}\b/g
    let m: RegExpExecArray | null
    while ((m = timeRe.exec(s))) {
      const token = truncate(m[0] || '', MAX_DETAIL_TEXT)
      if (!token) continue
      sec.stats.timecodes += 1
      trackDetail(sec, { kind: 'tim', label: `[TIME] ${token}` })
    }
  }

  const addInlineUiHints = (sec: SectionNode, line: string) => {
    const s = normalizeInline(line).toLowerCase()
    if (!s) return
    const push = (label: string) => {
      sec.stats.ui += 1
      trackDetail(sec, { kind: 'ui', label })
    }
    if (s.includes('drag and drop')) push('[UI] drag-and-drop')
    if (s.includes('choose an emoji') || s.includes('choose emoji')) push('[UI] emoji-picker')
    if (s.includes('switch to dark mode') || s.includes('dark mode')) push('[UI] theme-toggle')
    if (s.includes('export')) push('[UI] export')
    if (s.includes('play') || s.includes('pause')) push('[UI] media-controls')
  }

  const markdown = (() => {
    const raw = String(args.markdown || '')
    if (raw.length <= MAX_INPUT_CHARS) return raw
    return raw.slice(0, MAX_INPUT_CHARS)
  })()

  const lines = markdown.split(/\r?\n/)

  let startIdx = 0
  if (lines[0] === '---') {
    for (let i = 1; i < Math.min(lines.length, 400); i += 1) {
      if (lines[i] === '---') {
        startIdx = i + 1
        break
      }
    }
  }

  const root: SectionNode = { level: 0, title: 'PAGE', stats: newStats(), details: [], detailCounts: new Map(), children: [] }
  const stack: SectionNode[] = [root]
  const current = () => stack[stack.length - 1] || root

  let inFence = false
  let fenceLang = ''
  let sawAnyHeading = false
  let pendingParagraph = false

  let scannedLines = 0
  for (let i = startIdx; i < lines.length; i += 1) {
    scannedLines += 1
    if (scannedLines > MAX_SCAN_LINES) break
    const line = lines[i]
    const trimmed = line.trim()

    const fence = trimmed.match(/^```\s*([a-zA-Z0-9_-]+)?\s*$/)
    if (fence) {
      if (!inFence) {
        inFence = true
        fenceLang = String(fence[1] || '').trim()
        current().stats.codeBlocks += 1
        trackDetail(current(), { kind: 'code', label: fenceLang ? `[CODE] ${fenceLang}` : `[CODE]` })
        pendingParagraph = false
      } else {
        inFence = false
        fenceLang = ''
      }
      continue
    }
    if (inFence) continue

    if (!trimmed) {
      pendingParagraph = false
      continue
    }

    const hr = trimmed.match(/^(-{3,}|\*{3,}|_{3,})$/)
    if (hr) {
      current().stats.hr += 1
      pendingParagraph = false
      continue
    }

    const h = line.match(/^(#{1,6})\s+(.+?)\s*$/)
    if (h) {
      const level = h[1].length
      const title = normalizeInline(h[2] || '')
      if (!title) continue
      sawAnyHeading = true
      pendingParagraph = false

      while (stack.length > 1 && stack[stack.length - 1].level >= level) stack.pop()
      const parent = current()
      const node: SectionNode = { level, title, stats: newStats(), details: [], detailCounts: new Map(), children: [] }
      parent.children.push(node)
      stack.push(node)
      if (parent.children.length >= MAX_HEADINGS && parent === root) break
      continue
    }

    const quote = line.match(/^\s*>\s+(.+?)\s*$/)
    if (quote) {
      current().stats.quotes += 1
      addInlineLinksAndImages(current(), quote[1] || '')
      addInlinePriceSignals(current(), quote[1] || '')
      addInlineTimecodes(current(), quote[1] || '')
      addInlineUiHints(current(), quote[1] || '')
      pendingParagraph = false
      continue
    }

    const li = line.match(/^\s{0,3}([-*+]|\d+\.)\s+(.+?)\s*$/)
    if (li) {
      current().stats.listItems += 1
      trackDetail(current(), { kind: 'li', label: `[LI] ${truncate(li[2] || '', MAX_DETAIL_TEXT)}` })
      addInlineLinksAndImages(current(), li[2] || '')
      addInlinePriceSignals(current(), li[2] || '')
      addInlineTimecodes(current(), li[2] || '')
      addInlineUiHints(current(), li[2] || '')
      pendingParagraph = false
      continue
    }

    const looksLikeTableHeader = trimmed.includes('|')
    if (looksLikeTableHeader && i + 1 < lines.length) {
      const next = String(lines[i + 1] || '').trim()
      const isDivider = /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(next)
      if (isDivider) {
        current().stats.tables += 1
        const cols = trimmed.split('|').filter(x => x.trim()).length
        trackDetail(current(), { kind: 'tbl', label: cols ? `[TABLE] cols:${cols}` : `[TABLE]` })
        pendingParagraph = false
        continue
      }
    }

    const tag = tagNameFromHtmlLine(line)
    if (tag) {
      if (tag === 'table') {
        current().stats.tables += 1
        trackDetail(current(), { kind: 'tbl', label: `[TABLE] html` })
        pendingParagraph = false
        continue
      }
      const d = classifyHtmlTag(tag)
      if (d) {
        if (d.kind === 'emb') current().stats.embeds += 1
        if (d.kind === 'med') current().stats.media += 1
        if (d.kind === 'ani') current().stats.anim += 1
        if (d.kind === 'ui') current().stats.ui += 1
        trackDetail(current(), d)
        pendingParagraph = false
        continue
      }
    }

    if (/@keyframes\b/i.test(line)) {
      current().stats.anim += 1
      trackDetail(current(), { kind: 'ani', label: `[ANIM] css keyframes` })
      pendingParagraph = false
      continue
    }

    if (!pendingParagraph) {
      current().stats.paragraphs += 1
      pendingParagraph = true
    }
    addInlineLinksAndImages(current(), line)
    addInlinePriceSignals(current(), line)
    addInlineTimecodes(current(), line)
    addInlineUiHints(current(), line)
  }

  const pageTitle = (() => {
    const firstH1 = (() => {
      const walk = (n: SectionNode): string | null => {
        for (const c of n.children) {
          if (c.level === 1 && c.title) return c.title
          const inner = walk(c)
          if (inner) return inner
        }
        return null
      }
      return walk(root)
    })()
    return firstH1 || (sawAnyHeading ? 'Untitled' : 'No headings found')
  })()

  const accumulateStats = (n: SectionNode, out: Stats) => {
    out.paragraphs += n.stats.paragraphs
    out.listItems += n.stats.listItems
    out.images += n.stats.images
    out.links += n.stats.links
    out.codeBlocks += n.stats.codeBlocks
    out.tables += n.stats.tables
    out.embeds += n.stats.embeds
    out.media += n.stats.media
    out.anim += n.stats.anim
    out.ui += n.stats.ui
    out.timecodes += n.stats.timecodes
    out.prices += n.stats.prices
    out.quotes += n.stats.quotes
    out.hr += n.stats.hr
    for (const c of n.children) accumulateStats(c, out)
  }
  const total = newStats()
  accumulateStats(root, total)

  const bodyLines: string[] = []
  renderNode({ label: `[PAGE] ${pageTitle} ${statsLabel(total)}`.trim(), depth: 0 }, bodyLines)
  for (const d of root.details) {
    const count = root.detailCounts.get(d.label) || 0
    const suffix = count > 1 ? ` x${count}` : ''
    renderNode({ label: `${d.label}${suffix}`, depth: 1 }, bodyLines)
  }

  const renderSection = (sec: SectionNode, depth: number) => {
    const label = `[H${sec.level}] ${sec.title} ${statsLabel(sec.stats)}`.trim()
    renderNode({ label, depth }, bodyLines)
    for (const d of sec.details) {
      const count = sec.detailCounts.get(d.label) || 0
      const suffix = count > 1 ? ` x${count}` : ''
      renderNode({ label: `${d.label}${suffix}`, depth: depth + 1 }, bodyLines)
    }
    for (const c of sec.children) renderSection(c, depth + 1)
  }

  for (const c of root.children) renderSection(c, 1)

  const legendLines = [
    'Legend:',
    '  [PAGE] page frame',
    '  [Hn] section/heading frame',
    '  [NAV]/[CTA]/[LINK] interactive link types',
    '  [LI] list item',
    '  [IMG] image',
    '  [TABLE] table',
    '  [CODE] code fence',
    '  [EMBED] embedded external frame (iframe)',
    '  [MEDIA] media element (video/audio)',
    '  [ANIM] animation/canvas/svg/lottie/model-viewer',
    '  [UI] interaction hint',
    '  [TIME] timecode token',
    '  [PRICE] pricing/cost token',
  ]

  return [`# Wireframe`, '', `URL: ${args.url}`, '', '```text', ...legendLines, '', ...bodyLines, '```', ''].join('\n')
}
