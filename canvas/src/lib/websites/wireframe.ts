export type WebpageWireframeDetailLevel = 'compact' | 'standard' | 'detailed'

import {
  extractLinkSignalLabelsFromLine,
  extractPriceSignalLabelsFromLine,
  extractTimeSignalLabelsFromLine,
} from './signalTokens'

export function buildWireframeMarkdownFromMarkdown(args: {
  markdown: string
  url: string
  detailLevel?: WebpageWireframeDetailLevel
  title?: string
}): string {
  const detailLevel: WebpageWireframeDetailLevel =
    args.detailLevel === 'compact' ? 'compact' : args.detailLevel === 'detailed' ? 'detailed' : 'standard'
  const MAX_LABEL_WIDTH = detailLevel === 'compact' ? 56 : detailLevel === 'detailed' ? 88 : 72
  const MAX_HEADINGS = detailLevel === 'compact' ? 80 : detailLevel === 'detailed' ? 240 : 120
  const MAX_DETAIL_BOXES_PER_SECTION = detailLevel === 'compact' ? 3 : detailLevel === 'detailed' ? 12 : 6
  const MAX_DETAIL_TEXT = detailLevel === 'compact' ? 36 : detailLevel === 'detailed' ? 72 : 52
  const MAX_INPUT_CHARS = 2_000_000
  const MAX_SCAN_LINES = detailLevel === 'compact' ? 20_000 : detailLevel === 'detailed' ? 40_000 : 30_000

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
  effects: number
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
  | { kind: 'fx'; label: string }
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
  effects: 0,
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

  const mergeBoxRows = (boxes: string[][], gap: number) => {
    const safeGap = Math.max(1, Math.floor(gap))
    const heights = boxes.map(b => (Array.isArray(b) ? b.length : 0))
    const maxH = Math.max(0, ...heights)
    const widths = boxes.map(b => Math.max(0, ...(b || []).map(l => String(l || '').length)))
    const padded = boxes.map((b, i) => {
      const w = widths[i] || 0
      const out: string[] = []
      for (let r = 0; r < maxH; r += 1) {
        const line = r < (b?.length || 0) ? String(b?.[r] || '') : ''
        out.push(line.padEnd(w, ' '))
      }
      return out
    })
    const out: string[] = []
    for (let r = 0; r < maxH; r += 1) {
      const parts = padded.map(p => p[r] || '')
      out.push(parts.join(' '.repeat(safeGap)).trimEnd())
    }
    return out
  }

  const renderNode = (node: { label: string; depth: number }, out: string[]) => {
    const indent = ' '.repeat(Math.max(0, node.depth) * 4)
    const box = renderBox(node.label)
    for (const l of box) out.push(`${indent}${l}`)
  }

  const renderNodeRow = (args: { labels: string[]; depth: number; maxPerRow: number; gap?: number }, out: string[]) => {
    const labels = (args.labels || []).map(s => String(s || '')).filter(Boolean)
    if (labels.length < 2) return
    const perRow = Math.max(2, Math.floor(args.maxPerRow))
    const indent = ' '.repeat(Math.max(0, args.depth) * 4)
    const gap = args.gap == null ? 4 : args.gap
    for (let i = 0; i < labels.length; i += perRow) {
      const slice = labels.slice(i, i + perRow)
      if (slice.length < 2) break
      const merged = mergeBoxRows(slice.map(renderBox), gap)
      for (const l of merged) out.push(`${indent}${l}`)
    }
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
  if (s.effects) parts.push(`fx:${s.effects}`)
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
      case 'img':
        return { kind: 'img', label: `[IMG] html img` }
      case 'picture':
        return { kind: 'img', label: `[IMG] picture` }
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
      case 'details':
      case 'summary':
        return { kind: 'ui', label: `[UI] ${tag}` }
      case 'dialog':
        return { kind: 'ui', label: `[UI] dialog` }
      case 'button':
      case 'input':
      case 'select':
      case 'textarea':
      case 'form':
        return { kind: 'ui', label: `[UI] ${tag}` }
      case 'table':
        return { kind: 'tbl', label: `[TABLE] html` }
      default:
        return null
    }
  }

  const addInlineFxTokens = (sec: SectionNode, line: string) => {
    const s = normalizeInline(line).toLowerCase()
    if (!s) return

    const push = (label: string) => {
      sec.stats.effects += 1
      trackDetail(sec, { kind: 'fx', label })
    }

    if (s.includes('lottie')) push('[FX] lottie')
    if (s.includes('gsap')) push('[FX] gsap')
    if (s.includes('three.js') || s.includes('threejs') || s.includes(' three ')) push('[FX] three')
    if (s.includes('webgl')) push('[FX] webgl')
    if (s.includes('parallax')) push('[FX] parallax')
    if (s.includes('carousel')) push('[FX] carousel')
    if (s.includes('slider')) push('[FX] slider')
    if (s.includes('accordion')) push('[FX] accordion')
    if (s.includes('tabs') || s.includes('tabbed')) push('[FX] tabs')
    if (s.includes('tooltip')) push('[FX] tooltip')
    if (s.includes('modal')) push('[FX] modal')
    if (s.includes('transition:') || s.includes('animation:')) push('[FX] css motion')
  }

  const addInlineHtmlTags = (sec: SectionNode, line: string): boolean => {
    const s = String(line || '')
    if (!s.includes('<')) return false
    let matched = false
    const re = /<\s*([a-zA-Z][a-zA-Z0-9-]*)\b/g
    while (true) {
      const m = re.exec(s)
      if (!m) break
      const tag = String(m[1] || '').toLowerCase()
      const d = classifyHtmlTag(tag)
      if (!d) continue
      matched = true
      if (d.kind === 'emb') sec.stats.embeds += 1
      if (d.kind === 'med') sec.stats.media += 1
      if (d.kind === 'ani') sec.stats.anim += 1
      if (d.kind === 'img') sec.stats.images += 1
      if (d.kind === 'ui') sec.stats.ui += 1
      if (d.kind === 'tbl') sec.stats.tables += 1
      trackDetail(sec, d)
    }
    return matched
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
    const linkLabels = extractLinkSignalLabelsFromLine(s, { maxLabelLen: MAX_DETAIL_TEXT })
    for (const label of linkLabels) {
      sec.stats.links += 1
      trackDetail(sec, { kind: 'lnk', label })
    }
  }

  const addInlinePriceSignals = (sec: SectionNode, line: string) => {
    const labels = extractPriceSignalLabelsFromLine(String(line || ''), { maxLabelLen: MAX_DETAIL_TEXT })
    for (const label of labels) {
      sec.stats.prices += 1
      trackDetail(sec, { kind: 'pri', label })
    }
  }

  const addInlineTimecodes = (sec: SectionNode, line: string) => {
    const labels = extractTimeSignalLabelsFromLine(String(line || ''), { maxLabelLen: MAX_DETAIL_TEXT })
    for (const label of labels) {
      sec.stats.timecodes += 1
      trackDetail(sec, { kind: 'tim', label })
    }
  }

  const addInlineUiHints = (sec: SectionNode, line: string) => {
    const s = normalizeInline(line).toLowerCase()
    if (!s) return
    const push = (label: string) => {
      sec.stats.ui += 1
      trackDetail(sec, { kind: 'ui', label })
    }
    if (s.includes('drag') && s.includes('drop')) push('[UI] drag-and-drop')
    if (s.includes('dark mode') || s.includes('theme')) push('[UI] theme-toggle')
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
      addInlineFxTokens(current(), quote[1] || '')
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
      addInlineFxTokens(current(), li[2] || '')
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

    if (addInlineHtmlTags(current(), line)) {
      pendingParagraph = false
      continue
    }

    addInlineFxTokens(current(), line)

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
    const explicit = String(args.title || '').trim()
    if (explicit) return explicit
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
    out.effects += n.stats.effects
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

    const maxPerRow = detailLevel === 'compact' ? 1 : detailLevel === 'detailed' ? 3 : 2
    const allowRow = maxPerRow > 1 && sec.children.length > 1 && depth <= 3
    if (allowRow) {
      const labels = sec.children.map(c => `[H${c.level}] ${c.title} ${statsLabel(c.stats)}`.trim()).filter(Boolean)
      renderNodeRow({ labels, depth: depth + 1, maxPerRow, gap: 6 }, bodyLines)
    }

    for (const c of sec.children) renderSection(c, depth + 1)
  }

  for (const c of root.children) renderSection(c, 1)

  const legendLines = [
    'Legend:',
    '  [PAGE] page frame',
    '  [Hn] section/heading frame',
    '  (row layout) sibling headings may render horizontally',
    '  [NAV]/[CTA]/[LINK] interactive link types',
    '  [LI] list item',
    '  [IMG] image',
    '  [TABLE] table',
    '  [CODE] code fence',
    '  [EMBED] embedded external frame (iframe)',
    '  [MEDIA] media element (video/audio)',
    '  [ANIM] animation/canvas/svg/lottie/model-viewer',
    '  [FX] motion/animation effects hint',
    '  [UI] interaction hint',
    '  [TIME] timecode token',
    '  [PRICE] pricing/cost token',
  ]

  const aggregateDetailCounts = (() => {
    const out = new Map<string, number>()
    const walk = (n: SectionNode) => {
      for (const [k, v] of n.detailCounts.entries()) {
        out.set(k, (out.get(k) || 0) + v)
      }
      for (const c of n.children) walk(c)
    }
    walk(root)
    return out
  })()

  const addStoryboard = () => {
    const limit = detailLevel === 'compact' ? 3 : detailLevel === 'detailed' ? 10 : 6
    const pick = (prefix: string) => {
      const items: Array<{ label: string; count: number }> = []
      for (const [label, count] of aggregateDetailCounts.entries()) {
        if (!label.startsWith(prefix)) continue
        items.push({ label, count })
      }
      items.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
      return items.slice(0, limit)
    }

    const ctas = pick('[CTA]')
    const nav = pick('[NAV]')
    const fx = pick('[FX]')
    const media = pick('[MEDIA]')

    if (ctas.length + nav.length + fx.length + media.length === 0) return

    bodyLines.push('')
    renderNode({ label: `[FLOWS] Suggested journeys`, depth: 0 }, bodyLines)
    for (const it of ctas) renderNode({ label: `${it.label}${it.count > 1 ? ` x${it.count}` : ''}`, depth: 1 }, bodyLines)
    for (const it of nav) renderNode({ label: `${it.label}${it.count > 1 ? ` x${it.count}` : ''}`, depth: 1 }, bodyLines)
    if (fx.length || media.length) {
      renderNode({ label: `[RICH] Media & motion`, depth: 1 }, bodyLines)
      for (const it of media) renderNode({ label: `${it.label}${it.count > 1 ? ` x${it.count}` : ''}`, depth: 2 }, bodyLines)
      for (const it of fx) renderNode({ label: `${it.label}${it.count > 1 ? ` x${it.count}` : ''}`, depth: 2 }, bodyLines)
    }
  }

  addStoryboard()

  const renderFrame = (args: { title: string; width: number; body: string[] }): string[] => {
    const width = Math.max(44, Math.min(120, Math.floor(args.width)))
    const title = truncate(String(args.title || '').trim() || 'SECTION', width - 6)
    const innerW = width - 2
    const top = `┌${'─'.repeat(innerW)}┐`
    const titleLine = `│ ${title.padEnd(innerW - 2, ' ')} │`
    const sep = `├${'─'.repeat(innerW)}┤`
    const out: string[] = [top, titleLine, sep]

    const safeBody = (args.body || []).map(l => truncate(String(l || ''), innerW - 2))
    for (const line of safeBody) {
      out.push(`│ ${line.padEnd(innerW - 2, ' ')} │`)
    }
    if (safeBody.length === 0) out.push(`│ ${''.padEnd(innerW - 2, ' ')} │`)
    out.push(`└${'─'.repeat(innerW)}┘`)
    return out
  }

  const renderMockup = (): string[] => {
    const width = detailLevel === 'compact' ? 88 : detailLevel === 'detailed' ? 104 : 96
    const out: string[] = []
    out.push('[MOCKUP]')
    out.push('')

    const topNav = (() => {
      const items: string[] = []
      for (const [label, count] of aggregateDetailCounts.entries()) {
        if (!label.startsWith('[NAV]') && !label.startsWith('[CTA]')) continue
        const suffix = count > 1 ? ` x${count}` : ''
        items.push(`${label}${suffix}`)
      }
      items.sort((a, b) => a.localeCompare(b))
      const cap = detailLevel === 'compact' ? 5 : detailLevel === 'detailed' ? 10 : 7
      const picked = items.slice(0, cap)
      return picked.length ? picked.join(' | ') : ''
    })()

    out.push(
      ...renderFrame({
        title: 'HEADER',
        width,
        body: [topNav ? `Nav: ${topNav}` : 'Nav: (none detected)', 'Search: [input]'],
      }),
    )
    out.push('')

    const heroCtas = (() => {
      const items: string[] = []
      for (const [label, count] of aggregateDetailCounts.entries()) {
        if (!label.startsWith('[CTA]')) continue
        const suffix = count > 1 ? ` x${count}` : ''
        items.push(`${label}${suffix}`)
      }
      items.sort((a, b) => a.localeCompare(b))
      const cap = detailLevel === 'compact' ? 3 : detailLevel === 'detailed' ? 8 : 5
      return items.slice(0, cap)
    })()

    const priceTokens = (() => {
      const items: string[] = []
      for (const [label, count] of aggregateDetailCounts.entries()) {
        if (!label.startsWith('[PRICE]')) continue
        const suffix = count > 1 ? ` x${count}` : ''
        items.push(`${label}${suffix}`)
      }
      items.sort((a, b) => a.localeCompare(b))
      const cap = detailLevel === 'compact' ? 2 : detailLevel === 'detailed' ? 6 : 4
      return items.slice(0, cap)
    })()

    const timeTokens = (() => {
      const items: string[] = []
      for (const [label, count] of aggregateDetailCounts.entries()) {
        if (!label.startsWith('[TIME]')) continue
        const suffix = count > 1 ? ` x${count}` : ''
        items.push(`${label}${suffix}`)
      }
      items.sort((a, b) => a.localeCompare(b))
      const cap = detailLevel === 'compact' ? 1 : detailLevel === 'detailed' ? 4 : 2
      return items.slice(0, cap)
    })()

    out.push(
      ...renderFrame({
        title: 'HERO',
        width,
        body: [
          `Title: ${pageTitle}`,
          total.media || total.anim || total.effects ? `Media/Motion: med:${total.media} an:${total.anim} fx:${total.effects}` : 'Media/Motion: none',
          heroCtas.length ? `Primary actions: ${heroCtas.join(' | ')}` : 'Primary actions: (none detected)',
          priceTokens.length ? `Pricing: ${priceTokens.join(' | ')}` : 'Pricing: (none detected)',
          timeTokens.length ? `Timing: ${timeTokens.join(' | ')}` : 'Timing: (none detected)',
        ],
      }),
    )
    out.push('')

    const flowSummaryLines = (() => {
      const lines: string[] = []
      const join = (items: string[], cap: number) => (items.length ? items.slice(0, cap).join(' → ') : '')

      const navOnly = (() => {
        const items: string[] = []
        for (const [label, count] of aggregateDetailCounts.entries()) {
          if (!label.startsWith('[NAV]')) continue
          items.push(`${label}${count > 1 ? ` x${count}` : ''}`)
        }
        items.sort((a, b) => a.localeCompare(b))
        return items
      })()

      const ctaOnly = (() => {
        const items: string[] = []
        for (const [label, count] of aggregateDetailCounts.entries()) {
          if (!label.startsWith('[CTA]')) continue
          items.push(`${label}${count > 1 ? ` x${count}` : ''}`)
        }
        items.sort((a, b) => a.localeCompare(b))
        return items
      })()

      const cap = detailLevel === 'compact' ? 3 : detailLevel === 'detailed' ? 7 : 5
      const navTrail = join(navOnly.map(s => s.replace(/^\[NAV\]\s*/, '[NAV] ')), cap)
      const ctaTrail = join(ctaOnly.map(s => s.replace(/^\[CTA\]\s*/, '[CTA] ')), cap)
      if (navTrail) lines.push(`Browse: ${navTrail}`)
      if (ctaTrail) lines.push(`Convert: ${ctaTrail}`)
      if (!lines.length) lines.push('Browse: (none detected)')
      return lines
    })()

    out.push(
      ...renderFrame({
        title: 'FLOWS',
        width,
        body: flowSummaryLines,
      }),
    )
    out.push('')

    const richSummaryLines = (() => {
      const lines: string[] = []
      lines.push(`Counts: [MEDIA] ${total.media} | [ANIM] ${total.anim} | [FX] ${total.effects} | [UI] ${total.ui}`)

      const keySignals = (() => {
        const picked: string[] = []
        const prefixes = ['[MEDIA]', '[ANIM]', '[FX]', '[UI]']
        for (const [label, count] of aggregateDetailCounts.entries()) {
          if (!prefixes.some(p => label.startsWith(p))) continue
          picked.push(`${label}${count > 1 ? ` x${count}` : ''}`)
        }
        picked.sort((a, b) => b.localeCompare(a))
        const cap = detailLevel === 'compact' ? 3 : detailLevel === 'detailed' ? 10 : 6
        return picked.slice(0, cap)
      })()

      if (keySignals.length) lines.push(`Signals: ${keySignals.join(' | ')}`)
      return lines
    })()

    out.push(
      ...renderFrame({
        title: 'RICH MEDIA & MOTION',
        width,
        body: richSummaryLines,
      }),
    )
    out.push('')

    const sections: SectionNode[] = []
    const walk = (n: SectionNode) => {
      for (const c of n.children) {
        if (c.level === 2) sections.push(c)
        walk(c)
      }
    }
    walk(root)
    const cap = detailLevel === 'compact' ? 4 : detailLevel === 'detailed' ? 14 : 8
    const picked = sections.slice(0, cap)

    const storyboardLines = (() => {
      const beats: string[] = []
      beats.push('1. HEADER')
      beats.push(`2. HERO: ${pageTitle}`)
      let step = 3
      const secCap = detailLevel === 'compact' ? 3 : detailLevel === 'detailed' ? 8 : 5
      for (const sec of picked.slice(0, secCap)) {
        const signals = sec.details
          .map(d => d.label)
          .filter(l => l.startsWith('[CTA]') || l.startsWith('[NAV]') || l.startsWith('[MEDIA]') || l.startsWith('[ANIM]') || l.startsWith('[FX]') || l.startsWith('[UI]') || l.startsWith('[PRICE]') || l.startsWith('[TIME]'))
        const sigCap = detailLevel === 'compact' ? 2 : detailLevel === 'detailed' ? 6 : 3
        const suffix = signals.length ? ` (${signals.slice(0, sigCap).join(' | ')})` : ''
        beats.push(`${step}. ${truncate(sec.title || `H${sec.level}`, 28)}${suffix}`)
        step += 1
      }
      if (detailLevel !== 'compact') beats.push(`${step}. FOOTER`)
      const lineCap = detailLevel === 'compact' ? 6 : detailLevel === 'detailed' ? 14 : 10
      return beats.slice(0, lineCap)
    })()

    out.push(
      ...renderFrame({
        title: 'STORYBOARD',
        width,
        body: storyboardLines,
      }),
    )
    out.push('')

    for (const sec of picked) {
      const details = sec.details
        .map(d => d.label)
        .filter(
          l =>
            l.startsWith('[CTA]') ||
            l.startsWith('[NAV]') ||
            l.startsWith('[MEDIA]') ||
            l.startsWith('[ANIM]') ||
            l.startsWith('[FX]') ||
            l.startsWith('[UI]') ||
            l.startsWith('[PRICE]') ||
            l.startsWith('[TIME]'),
        )
      const lines: string[] = []
      lines.push(`Stats: ${statsLabel(sec.stats) || '(none)'}`)
      if (details.length) {
        const dcap = detailLevel === 'compact' ? 3 : detailLevel === 'detailed' ? 10 : 6
        lines.push(`Signals: ${details.slice(0, dcap).join(' | ')}`)
      }
      out.push(...renderFrame({ title: sec.title || `H${sec.level}`, width, body: lines }))
      out.push('')
    }

    return out
  }

  const mockupLines = renderMockup()
  return [`# Wireframe`, '', `URL: ${args.url}`, `Detail: ${detailLevel}`, '', '```text', ...mockupLines, ...legendLines, '', ...bodyLines, '```', ''].join('\n')
}
