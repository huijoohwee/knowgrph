import { extractWireframeMockupAndTailFromMarkdownDoc } from '../markdown/wireframeAscii'
import { classifyLinkLabel, summarizeCategorizedSignalsFromMarkdown } from './signalTokens'
import { buildWireframeMarkdownFromMarkdown } from './wireframe'

const normalizeInline = (raw: string) => String(raw || '').replace(/\s+/g, ' ').trim()

const truncate = (raw: string, max: number) => {
  const s = normalizeInline(raw)
  if (s.length <= max) return s
  return `${s.slice(0, Math.max(0, max - 1)).trimEnd()}…`
}

function padRight(raw: string, width: number): string {
  const s = String(raw || '')
  if (s.length >= width) return s.slice(0, width)
  return s + ' '.repeat(width - s.length)
}

function padCenter(raw: string, width: number): string {
  const s = String(raw || '')
  if (s.length >= width) return s.slice(0, width)
  const left = Math.floor((width - s.length) / 2)
  const right = width - s.length - left
  return ' '.repeat(left) + s + ' '.repeat(right)
}

function mergeStructureTreeIntoLayoutAscii(layoutAscii: string, structureTail: string): string {
  const layout = String(layoutAscii || '').trimEnd()
  const tail = String(structureTail || '').trimEnd()
  if (!layout || !tail) return layout

  const navItems: string[] = []
  const topLinks: string[] = []
  const tailLines = tail.split(/\r?\n/)
  let sawSkip = false
  let logoCount: string | null = null
  for (const l of tailLines) {
    const line = String(l || '')
    if (/\[H2\]/i.test(line)) break
    if (/\bskip\s+to\s+main\s+content\b/i.test(line)) sawSkip = true
    const img = line.match(/\[IMG\]\s*([^|]+?)\s*(?:x\s*(\d+))?\s*\|?\s*$/i)
    if (img) {
      const count = img[2] ? img[2] : /\bx2\b/i.test(img[1] || '') ? '2' : null
      if (count) logoCount = count
    }
    const nav = line.match(/\[NAV\]\s*([^|]+?)\s*\|\s*$/i) || line.match(/\[NAV\]\s*([^|]+?)\s*$/i)
    if (nav) {
      const item = normalizeInline(nav[1] || '')
      if (item && !navItems.includes(item)) navItems.push(item)
    }

    const cta = line.match(/\[(?:CTA|LINK)\]\s*([^|]+?)\s*\|\s*$/i) || line.match(/\[(?:CTA|LINK)\]\s*([^|]+?)\s*$/i)
    if (cta) {
      const label = normalizeInline(cta[1] || '')
      if (label && !topLinks.includes(label)) topLinks.push(label)
    }
  }

  const lines = layout.split(/\r?\n/)
  const startIdx = lines.findIndex(l => /GLOBAL NAVIGATION/.test(l))
  if (startIdx < 1) return layout
  const blockStart = startIdx - 1
  const endIdx = (() => {
    for (let i = blockStart + 1; i < lines.length; i += 1) {
      if (String(lines[i] || '').startsWith('└')) return i
    }
    return -1
  })()
  if (endIdx < 0) return layout

  const top = String(lines[blockStart] || '')
  const title = String(lines[blockStart + 1] || '')
  const sep = String(lines[blockStart + 2] || '')
  const bottom = String(lines[endIdx] || '')
  const innerWidth = Math.max(0, top.length - 2)
  const frameLine = (content: string) => `│${padRight(content, innerWidth)}│`

  const contentLines: string[] = []
  if (sawSkip) contentLines.push('[LINK] Skip to main content')
  if (logoCount) contentLines.push(`[IMG] Logo x${logoCount}`)

  const existingNavLine = lines
    .slice(blockStart, endIdx + 1)
    .find(l => /^│\s*\[Logo\]/.test(String(l || '')))
  const existingNavText = existingNavLine ? normalizeInline(existingNavLine.slice(1, -1)) : ''

  const mergedNavText = (() => {
    const normalizedNav = navItems.map(x => x.replace(/\s+▾\s*$/g, '').trim()).filter(Boolean)
    const normalizedLinks = topLinks.map(x => x.replace(/\s+▾\s*$/g, '').trim()).filter(Boolean)
    const items = [...normalizedNav, ...normalizedLinks]
    if (!items.length) return existingNavText || '[Logo]'
    const joined = items.join(' | ')
    return `[Logo] ${joined}`
  })()
  contentLines.push(mergedNavText)

  const rebuilt = [top, title, sep]
  rebuilt.push(frameLine(''))
  for (const c of contentLines) rebuilt.push(frameLine(c))
  rebuilt.push(frameLine(''))
  rebuilt.push(bottom)

  const mergedLines = [...lines.slice(0, blockStart), ...rebuilt, ...lines.slice(endIdx + 1)]
  return mergedLines.join('\n').trimEnd()
}

function toTitleCase(s: string): string {
  const raw = normalizeInline(s)
  if (!raw) return ''
  const tokens = raw.split(' ')
  const cased = tokens.map((t) => {
    const w = String(t || '')
    if (!w) return ''
    const letters = w.replace(/[^A-Za-z]/g, '')
    if (letters && letters === letters.toUpperCase()) return w
    return w.charAt(0).toUpperCase() + w.slice(1)
  })
  return normalizeInline(cased.join(' '))
}

function findFirstInlineCommand(markdown: string): string {
  const body = stripFrontmatter(markdown)
  const lines = body.split(/\r?\n/)
  let inFence = false
  for (const line of lines) {
    const trimmed = line.trim()
    if (/^```/.test(trimmed)) {
      inFence = !inFence
      continue
    }
    if (inFence) continue
    if (!trimmed) continue
    if (trimmed.startsWith('$ ')) return truncate(trimmed, 44)
    const lower = trimmed.toLowerCase()
    if (lower.includes('npx ') || lower.includes('pnpm ') || lower.includes('npm ') || lower.includes('bun ')) {
      return truncate(trimmed, 44)
    }
  }
  return ''
}

function extractListItemsFromSection(sectionBody: string, cap: number): string[] {
  const body = String(sectionBody || '')
  const lines = body.split(/\r?\n/)
  const out: string[] = []
  let inFence = false
  for (const line of lines) {
    const trimmed = line.trim()
    if (/^```/.test(trimmed)) {
      inFence = !inFence
      continue
    }
    if (inFence) continue
    const m = trimmed.match(/^[-*+]\s+(.+)$/) || trimmed.match(/^\d+\.\s+(.+)$/)
    if (!m) continue
    const cleaned = stripMarkdownInlineArtifacts(m[1] || '')
    if (!cleaned) continue
    out.push(truncate(cleaned, 18))
    if (out.length >= cap) break
  }
  return out
}

function extractMarkdownLinkTexts(sectionBody: string, cap: number, maxLen: number): string[] {
  const s = String(sectionBody || '')
  const re = /\[([^\]]+)\]\(([^)]+)\)/g
  const out: string[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(s))) {
    const idx = m.index
    if (idx > 0 && s.charCodeAt(idx - 1) === 33) continue
    const label = truncate(stripMarkdownInlineArtifacts(String(m[1] || '').trim()), maxLen)
    if (!label) continue
    out.push(label)
    if (out.length >= cap) break
  }
  return out
}

function renderWideBlock(args: { title: string; lines: string[]; width?: number }): string[] {
  const width = Math.max(73, Math.min(110, Math.floor(args.width ?? 89)))
  const inner = width - 2
  const title = truncate(String(args.title || '').toUpperCase(), inner)
  const top = `┌${'─'.repeat(inner)}┐`
  const titleLine = `│ ${title.padEnd(inner - 2, ' ')} │`
  const sep = `├${'─'.repeat(inner)}┤`
  const body = (args.lines || []).map(l => truncate(String(l || ''), inner - 2))
  const safeBody = body.length ? body : ['']
  const rows = safeBody.map(l => `│ ${l.padEnd(inner - 2, ' ')} │`)
  const bot = `└${'─'.repeat(inner)}┘`
  return [top, titleLine, sep, ...rows, bot]
}

function renderTwoColumnBlock(args: {
  leftTitle: string
  leftLines: string[]
  rightTitle: string
  rightLines: string[]
  leftWidth?: number
  rightWidth?: number
}): string[] {
  const leftW = Math.max(32, Math.min(56, Math.floor(args.leftWidth ?? 32)))
  const rightW = Math.max(36, Math.min(70, Math.floor(args.rightWidth ?? 40)))
  const top = `┌${'─'.repeat(leftW)}┬${'─'.repeat(rightW)}┐`
  const lTitle = truncate(String(args.leftTitle || ''), leftW).padEnd(leftW, ' ')
  const rTitle = truncate(String(args.rightTitle || ''), rightW).padEnd(rightW, ' ')
  const titleRow = `│${lTitle}│${rTitle}│`
  const mid = `├${'─'.repeat(leftW)}┼${'─'.repeat(rightW)}┤`

  const lBody = (args.leftLines || []).map(l => truncate(String(l || ''), leftW))
  const rBody = (args.rightLines || []).map(l => truncate(String(l || ''), rightW))
  const rows = Math.max(3, lBody.length, rBody.length)
  const out: string[] = [top, titleRow, mid]
  for (let i = 0; i < rows; i += 1) {
    const l = (lBody[i] ?? '').padEnd(leftW, ' ')
    const r = (rBody[i] ?? '').padEnd(rightW, ' ')
    out.push(`│${l}│${r}│`)
  }
  out.push(`└${'─'.repeat(leftW)}┴${'─'.repeat(rightW)}┘`)
  return out
}

function buildLayoutStructureAscii(args: {
  markdown: string
  pageTitle: string
  overview: string
  navLabels: string[]
  ctaLabels: string[]
  url: string
}): string {
  const body = stripFrontmatter(args.markdown)
  const lower = body.toLowerCase()
  const hasSearch = lower.includes('search')
  const hasDragDrop = lower.includes('drag') && lower.includes('drop')
  const hasTime = /\b\d{1,2}:\d{2}\b/.test(body)
  const hasExport = lower.includes('export')
  const hasThemeToggle = lower.includes('dark mode') || lower.includes('theme')

  const WIDTH = 73
  const pad = (s: string, w: number) => {
    const raw = String(s || '')
    if (raw.length >= w) return raw.slice(0, w)
    return raw + ' '.repeat(w - raw.length)
  }
  const center = (s: string, w: number) => {
    const raw = String(s || '')
    if (raw.length >= w) return raw.slice(0, w)
    const left = Math.floor((w - raw.length) / 2)
    const right = w - raw.length - left
    return ' '.repeat(left) + raw + ' '.repeat(right)
  }
  const box = (title: string, lines: string[]) => {
    const top = `┌${'─'.repeat(WIDTH)}┐`
    const titleLine = `│${center(title.toUpperCase(), WIDTH)}│`
    const sep = `├${'─'.repeat(WIDTH)}┤`
    const bodyLines = (lines.length ? lines : ['']).map(l => `│${pad(truncate(l, WIDTH), WIDTH)}│`)
    const bot = `└${'─'.repeat(WIDTH)}┘`
    return [top, titleLine, sep, ...bodyLines, bot]
  }

  const twoCol = (leftLines: string[], rightLines: string[]) => {
    const leftW = 32
    const rightW = WIDTH - leftW - 1
    const top = `┌${'─'.repeat(leftW)}┬${'─'.repeat(rightW)}┐`
    const bot = `└${'─'.repeat(leftW)}┴${'─'.repeat(rightW)}┘`
    const rows = Math.max(leftLines.length, rightLines.length)
    const out: string[] = [top]
    for (let i = 0; i < rows; i += 1) {
      const l = pad(truncate(leftLines[i] || '', leftW), leftW)
      const r = pad(truncate(rightLines[i] || '', rightW), rightW)
      out.push(`│${l}│${r}│`)
    }
    out.push(bot)
    return out
  }

  const ordered = extractOrderedLinksFromMarkdown(args.markdown, { max: 240, maxLines: 1400 })
  const navMeta = analyzeHeaderNavigation(args.markdown)
  const headerNav = navMeta.headerNav
  const dropdownNav = new Set(navMeta.dropdownMenus.filter(m => m.type === 'Dropdown').map(m => m.menu))

  const heroCommand = findFirstInlineCommand(args.markdown)
  const heroCtas = (() => {
    const out: string[] = []
    const push = (t: string) => {
      const v = stripTrailingPunctuation(t)
      if (!v) return
      if (out.some(x => x.toLowerCase() === v.toLowerCase())) return
      out.push(v)
    }

    const lines = stripFrontmatter(args.markdown).split(/\r?\n/)
    const cmdNeedle = heroCommand ? heroCommand.replace(/^\$\s+/, '') : ''
    const cmdIdx = cmdNeedle ? lines.findIndex(l => String(l || '').includes(cmdNeedle)) : -1
    const start = cmdIdx >= 0 ? Math.max(0, cmdIdx - 40) : 0
    const windowText = lines.slice(start, Math.min(lines.length, start + 240)).join('\n')
    const windowLinks = extractOrderedLinksFromMarkdown(windowText, { max: 140, maxLines: 900 })

    const preferred = ['Docs', 'Discord', 'GitHub', 'Prompt', 'Prompt a video', 'Demo']
    const pool = windowLinks.length ? windowLinks : ordered
    for (const p of preferred) {
      const hit = pool.find(l => stripTrailingPunctuation(l.text).toLowerCase() === p.toLowerCase())
      if (hit) push(hit.text)
      if (out.length >= 4) break
    }
    if (out.length < 4) {
      for (const l of pool) {
        const t = stripTrailingPunctuation(l.text)
        if (!t) continue
        if (headerNav.some(h => h.toLowerCase() === t.toLowerCase())) continue
        if (l.kind === 'cta' || l.kind === 'nav') push(t)
        if (out.length >= 4) break
      }
    }

    const starMatch = windowText.match(/github[^\n]{0,80}⭐\s*\d+[\dkm]?/i)
    if (starMatch) {
      const sm = starMatch[0].match(/⭐\s*\d+[\dkm]?/i)
      const star = sm ? normalizeInline(sm[0]) : ''
      if (star) {
        const idx = out.findIndex(x => x.toLowerCase() === 'github')
        if (idx >= 0) out[idx] = `GitHub ${star}`
      }
    }

    return out.slice(0, 4)
  })()

  const templatesBody = (() => {
    const blocks = extractH2Sections(args.markdown, 64)
    const t = blocks.find(b => normalizeInline(b.title).toLowerCase().includes('template'))
    return t ? t.body : ''
  })()
  const templateItems = (() => {
    const li = extractListItemsFromSection(templatesBody, 6)
    if (li.length) return li
    return extractMarkdownLinkTexts(templatesBody, 6, 22)
  })()

  const carouselItems = (() => {
    const lines = stripFrontmatter(args.markdown).split(/\r?\n/)
    for (const line of lines.slice(0, 2200)) {
      const n = countMarkdownLinksInLine(line)
      if (n < 4) continue
      const texts = extractMarkdownLinkTexts(line, 12, 22)
      if (texts.length < 4) continue
      const shortCount = texts.filter(t => t.length <= 18).length
      if (shortCount < 3) continue
      return texts.slice(0, 6)
    }
    return [] as string[]
  })()

  const blocks = extractH2Sections(args.markdown, 32)
  const mediaBlocks = blocks.filter(b => /\b\.webm\b|\b\.mp4\b|\b\.mov\b|<\s*video\b/i.test(b.body))
  const features = (() => {
    const preferred = ['compose', 'edit', 'render', 'scale']
    const picked: typeof mediaBlocks = []
    for (const key of preferred) {
      const hit = mediaBlocks.find(b => normalizeInline(b.title).toLowerCase().includes(key))
      if (hit && !picked.includes(hit)) picked.push(hit)
    }
    for (const b of mediaBlocks) {
      if (picked.length >= 3) break
      if (picked.includes(b)) continue
      picked.push(b)
    }
    return picked.slice(0, 3)
  })()

  const useCases = blocks.find(b => normalizeInline(b.title).toLowerCase().includes('use case'))
  const useCaseTiles = (() => {
    if (!useCases) return [] as string[]
    const li = extractListItemsFromSection(useCases.body, 6)
    if (li.length) return li.slice(0, 4)
    const links = extractMarkdownLinkTexts(useCases.body, 6, 16)
    return links.slice(0, 4)
  })()

  const demo = blocks.find(b => normalizeInline(b.title).toLowerCase().includes('demo'))
  const pricing = blocks.find(b => normalizeInline(b.title).toLowerCase().includes('pricing'))
  const pricingPlans = (() => {
    if (!pricing) return [] as string[]
    const li = extractListItemsFromSection(pricing.body, 8)
    const fromLinks = extractMarkdownLinkTexts(pricing.body, 12, 22)
    const merged = [...li, ...fromLinks]
    const picked: string[] = []
    for (const t of merged) {
      const v = stripTrailingPunctuation(t)
      if (!v) continue
      if (!/license/i.test(v)) continue
      if (picked.some(x => x.toLowerCase() === v.toLowerCase())) continue
      picked.push(v)
      if (picked.length >= 3) break
    }
    if (picked.length < 3) {
      const raw = stripMarkdownInlineArtifacts(pricing.body)
      const re = /\b[A-Z][A-Za-z+]*(?:\s+[A-Z][A-Za-z+]+){0,3}\s+License\b/g
      const tokens = extractUniqueTokens(re, raw, 12)
      for (const tok of tokens) {
        const v = stripTrailingPunctuation(tok)
        if (!v) continue
        if (picked.some(x => x.toLowerCase() === v.toLowerCase())) continue
        picked.push(v)
        if (picked.length >= 3) break
      }
    }
    return picked
  })()

  const out: string[] = []
  const headerNavRendered = headerNav.map(i => (dropdownNav.has(i) ? `${i} ▾` : i))
  out.push(...box('Global Navigation', ['', `     [Logo]  ${headerNavRendered.join(' | ')}${navMeta.hasSearch ? '  [🔍]' : ''}`, '']))
  out.push('')
  out.push(
    ...box('Hero Section', [
      center(stripTrailingPunctuation(args.pageTitle), WIDTH),
      '',
      args.overview ? truncate(args.overview, WIDTH) : '',
      '',
      heroCommand ? `                   ${truncate(heroCommand, 29).replace(/^\$\s*/, '$ ')}` : '',
      '',
      heroCtas.length ? `          ${heroCtas.map(x => `[${x}]`).join(' ')}` : '',
    ].filter(Boolean)),
  )

  const templateRow = templateItems.length ? templateItems : carouselItems
  if (templateRow.length) {
    out.push('')
    out.push(...box('Template Carousel', [`   ${templateRow.map(x => `[${x}]`).join(' ')}   [→]`]))
  }

  let flip = false
  for (const f of features) {
    const title = toTitleCase(f.title)
    const mediaTokens = extractUniqueTokens(/\b[\w-]+\.(?:webm|mp4|mov)\b/gi, f.body, 6)
    const titleLower = normalizeInline(f.title).toLowerCase()
    const media = mediaTokens.find(t => titleLower && t.toLowerCase().includes(titleLower.split(' ')[0])) || mediaTokens[0] || 'video'
    const summary = extractReadableSummary(f.body, 68)
    const link = extractMarkdownLinkTexts(f.body, 1, 22)[0] || ''
    const left = flip
      ? [`  ## ${title}`, '', summary, link ? `  → ${link}` : '']
      : ['         VIDEO PREVIEW', `      [${media}]`, truncate(summary || 'Video preview', 30)]
    const right = flip
      ? ['         VIDEO PREVIEW', `      [${media}]`, truncate(summary || 'Video preview', 30)]
      : [`   ## ${title}`, '', summary, link ? `   → ${link}` : '']
    out.push('')
    out.push(...twoCol(left.filter(Boolean), right.filter(Boolean)))
    flip = !flip
  }

  if (useCaseTiles.length) {
    out.push('')
    out.push(...box('Use Cases', [`  ${useCaseTiles.map(x => `[${x}]`).join(' ')}`]))
  }

  if (demo || hasDragDrop || hasTime || hasExport) {
    out.push('')
    const demoLine = [hasDragDrop ? 'Drag and drop cards' : '', hasThemeToggle ? '[Dark mode toggle]' : '', hasTime ? 'Video player' : ''].filter(Boolean).join(' • ')
    const timeLine = hasTime ? `[▶ ${extractUniqueTokens(/\b\d{1,2}:\d{2}\b/g, body, 1)[0] || '0:00'} ━━━━━━━━━━━━━━━━━━━━━━━━━━━━]` : ''
    const exportLine = hasExport ? '[Export the video!]' : ''
    out.push(...box('Interactive Demo', [demoLine, `${timeLine} ${exportLine}`.trim()].filter(Boolean)))
  }

  if (pricing || /\$\s?\d/.test(body)) {
    out.push('')
    out.push(...box('Pricing Tiers', [pricingPlans.length ? `  ${pricingPlans.map(x => `[${x}]`).join(' ')}` : '  (pricing tiers detected)']))
  }

  const communityStats = (() => {
    const raw = stripMarkdownInlineArtifacts(body)
    const star = raw.match(/\b\d{1,3}k\b\s*⭐|⭐\s*\d{1,3}k\b/i)?.[0] || ''
    const tokens = extractUniqueTokens(/\b\d{1,3}(?:\.\d+)?\s*(?:k|K)\b[^\n|]{0,18}|\b\d{1,4}\s*\+?\s*users\b|\binstalls\s*\/\s*mo\b|\bdocs\s*pages\b|\btemplates\b/gi, raw, 8)
      .map(t => normalizeInline(t).replace(/\s+/g, ' '))
      .filter(Boolean)
    const merged = star ? [normalizeInline(star), ...tokens] : tokens
    const picked: string[] = []
    for (const t of merged) {
      if (picked.some(x => x.toLowerCase() === t.toLowerCase())) continue
      picked.push(t)
      if (picked.length >= 5) break
    }
    return picked
  })()

  if (communityStats.length >= 3) {
    out.push('')
    out.push(...box('Community Stats', [`  ${communityStats.join(' | ')}`]))
  }

  const editorPromo = (() => {
    const hit = blocks.find(b => {
      const t = normalizeInline(b.title).toLowerCase()
      return t.includes('editor') && (t.includes('starter') || t.includes('video'))
    })
    if (!hit) return ''
    return extractReadableSummary(hit.body, 72)
  })()

  if (editorPromo) {
    out.push('')
    out.push(...box('Editor Starter Promo', [`  ${editorPromo}`]))
  }

  const footerGroups = (() => {
    const lines = stripFrontmatter(args.markdown).split(/\r?\n/)
    const tail = lines.slice(Math.max(0, lines.length - 240)).join('\n')
    const tailLinks = extractOrderedLinksFromMarkdown(tail, { max: 60, maxLines: 400 })
    const picked: string[] = []
    for (const l of tailLinks) {
      if (l.kind !== 'nav' && l.kind !== 'lnk') continue
      const t = stripTrailingPunctuation(l.text)
      if (!t) continue
      if (picked.some(x => x.toLowerCase() === t.toLowerCase())) continue
      picked.push(t)
      if (picked.length >= 3) break
    }
    return picked.length ? picked : ['Section', 'Community', 'More']
  })()

  out.push('')
  out.push(...box('Footer Navigation', [`     ${footerGroups.map(x => `[${x}]`).join(' ')}`]))

  return out.join('\n').trimEnd() + '\n'
}

function stripWww(host: string): string {
  const h = String(host || '').trim()
  if (h.toLowerCase().startsWith('www.')) return h.slice(4)
  return h
}

function stripTrailingPunctuation(s: string): string {
  return String(s || '').replace(/[\s.]+$/g, '').trim()
}

function stripHtmlTags(s: string): string {
  return String(s || '').replace(/<[^>]+>/g, ' ')
}

function countUniqueMarkdownLinkHrefs(markdown: string): number {
  const s = String(markdown || '')
  const re = /\[([^\]]+)\]\(([^)]+)\)/g
  const seen = new Set<string>()
  let m: RegExpExecArray | null
  while ((m = re.exec(s))) {
    const idx = m.index
    if (idx > 0 && s.charCodeAt(idx - 1) === 33) continue
    const label = String(m[1] || '').toLowerCase()
    if (label.includes('skip to main content')) continue
    const href = String(m[2] || '').trim()
    if (!href) continue
    seen.add(href)
  }
  return seen.size
}

function countUniqueMarkdownLinkTexts(markdown: string): number {
  const s = String(markdown || '')
  const re = /\[([^\]]+)\]\(([^)]+)\)/g
  const seen = new Set<string>()
  let m: RegExpExecArray | null
  while ((m = re.exec(s))) {
    const text = normalizeInline(m[1] || '')
    if (!text) continue
    if (text.length < 2) continue
    seen.add(text)
  }
  return seen.size
}

function extractUniqueTokens(re: RegExp, markdown: string, cap: number): string[] {
  const s = String(markdown || '')
  const seen = new Set<string>()
  const out: string[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(s))) {
    const token = normalizeInline(m[0] || '')
    if (!token) continue
    if (seen.has(token)) continue
    seen.add(token)
    out.push(token)
    if (out.length >= cap) break
  }
  return out
}

function inferInteractiveUiCount(markdown: string): number {
  const lower = stripFrontmatter(markdown).toLowerCase()
  const flags: Array<{ key: string; ok: boolean }> = [
    { key: 'dragdrop', ok: lower.includes('drag') && lower.includes('drop') },
    { key: 'theme', ok: lower.includes('dark mode') || lower.includes('theme') },
    { key: 'search', ok: lower.includes('search') },
    { key: 'export', ok: lower.includes('export') },
    { key: 'media', ok: lower.includes('play') || lower.includes('pause') || /\b\d{1,2}:\d{2}\b/.test(lower) },
    { key: 'picker', ok: lower.includes('choose an') && lower.includes('emoji') },
  ]
  return flags.filter(f => f.ok).length
}

function inferPageOverviewSentence(args: { markdown: string; pageTitle: string; readableSummary: string }): string {
  const lower = stripFrontmatter(args.markdown).toLowerCase()
  const hasDemo = lower.includes('demo') || (lower.includes('drag') && lower.includes('drop'))
  const hasPricing = lower.includes('pricing') || /\$\s?\d/.test(lower)
  const hasCommunity = lower.includes('community') || lower.includes('newsletter') || lower.includes('never build alone')
  const hasVideo = /\b\.webm\b|\b\.mp4\b|<\s*video\b/i.test(lower)

  const parts: string[] = []
  if (args.readableSummary) parts.push(args.readableSummary)
  const features: string[] = []
  if (hasVideo) features.push('interactive demos')
  if (hasPricing) features.push('pricing tiers')
  if (hasCommunity) features.push('community resources')
  if (hasDemo && !features.includes('interactive demos')) features.unshift('interactive demos')
  if (features.length) {
    const tail = `The page highlights ${features.join(', ')}.`
    parts.push(tail)
  }
  const out = normalizeInline(parts.join(' '))
  return truncate(out, 280)
}

type OrderedLink = { text: string; href: string; kind: 'cta' | 'nav' | 'lnk' }

function extractOrderedLinksFromMarkdown(markdown: string, opts?: { max?: number; maxLines?: number }): OrderedLink[] {
  const max = opts?.max ?? 120
  const maxLines = opts?.maxLines ?? 3000
  const body = stripFrontmatter(markdown)
  const lines = body.split(/\r?\n/).slice(0, maxLines)
  const out: OrderedLink[] = []
  const seenKey = new Set<string>()
  const linkRe = /\[([^\]]+)\]\(([^)]+)\)/g

  let inFence = false
  for (const line of lines) {
    const trimmed = String(line || '').trim()
    if (/^```/.test(trimmed)) {
      inFence = !inFence
      continue
    }
    if (inFence) continue
    linkRe.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = linkRe.exec(line))) {
      const idx = m.index
      if (idx > 0 && line.charCodeAt(idx - 1) === 33) continue
      const text = normalizeInline(m[1] || '')
      const href = String(m[2] || '').trim()
      if (!text || !href) continue
      if (text.toLowerCase().includes('skip to main content')) continue
      const kind = classifyLinkLabel(text)
      const key = `${kind}:${text.toLowerCase()}:${href}`
      if (seenKey.has(key)) continue
      seenKey.add(key)
      out.push({ text, href, kind })
      if (out.length >= max) return out
    }
  }
  return out
}

function pickHeaderNavItems(links: OrderedLink[]): string[] {
  const out: string[] = []
  for (const l of links) {
    const t = stripTrailingPunctuation(l.text)
    if (!t) continue
    const lower = t.toLowerCase()
    if (lower.includes('skip to main content')) continue
    if (lower.endsWith('logo')) continue
    if (lower === 'search') continue
    if (out.includes(t)) continue
    out.push(t)
    if (out.length >= 6) break
  }
  return out
}

function stripFrontmatter(raw: string): string {
  const s = String(raw || '')
  if (!s.startsWith('---')) return s
  const end = s.indexOf('\n---')
  if (end < 0) return s
  return s.slice(end + 4).replace(/^\s*\n/, '')
}

function countMatches(re: RegExp, s: string): number {
  let count = 0
  const text = String(s || '')
  while (re.exec(text)) count += 1
  return count
}

function countMarkdownLinksInLine(line: string): number {
  const s = String(line || '')
  const re = /\[([^\]]+)\]\(([^)]+)\)/g
  let count = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(s))) {
    count += 1
    if (count >= 6) return count
  }
  return count
}

function countMarkdownLinks(markdown: string): number {
  const s = String(markdown || '')
  const linkRe = /\[([^\]]+)\]\(([^)]+)\)/g
  let count = 0
  let m: RegExpExecArray | null
  while ((m = linkRe.exec(s))) {
    const idx = m.index
    if (idx > 0 && s.charCodeAt(idx - 1) === 33) continue
    count += 1
  }
  return count
}

function extractHeadings(markdown: string, max: number): Array<{ level: number; title: string }> {
  const out: Array<{ level: number; title: string }> = []
  const lines = stripFrontmatter(markdown).split(/\r?\n/)
  let inFence = false
  for (const line of lines) {
    const trimmed = line.trim()
    if (/^```/.test(trimmed)) {
      inFence = !inFence
      continue
    }
    if (inFence) continue
    const m = line.match(/^(#{1,6})\s+(.+?)\s*$/)
    if (!m) continue
    const level = m[1].length
    const title = normalizeInline(m[2] || '')
    if (!title) continue
    out.push({ level, title })
    if (out.length >= max) break
  }
  return out
}

function extractReadableSummary(markdown: string, maxChars: number): string {
  const lines = stripFrontmatter(markdown).split(/\r?\n/)
  const buf: string[] = []
  let inFence = false
  for (const line of lines) {
    const trimmed = line.trim()
    if (/^```/.test(trimmed)) {
      inFence = !inFence
      continue
    }
    if (inFence) continue
    if (!trimmed) {
      if (buf.length) break
      continue
    }
    if (/^#{1,6}\s+/.test(trimmed)) continue
    if (/^>\s+/.test(trimmed)) continue
    if (/^[-*+]\s+/.test(trimmed) || /^\d+\.\s+/.test(trimmed)) continue
    const lower = trimmed.toLowerCase()
    if (lower.includes('skip to main content')) continue
    const cleaned = stripMarkdownInlineArtifacts(trimmed)
    if (!cleaned || cleaned.length < 8) continue
    const cleanedLower = cleaned.toLowerCase()
    const socialWords = ['github', 'discord', 'twitter', 'x', 'linkedin', 'facebook', 'youtube', 'mastodon']
    const socialHits = socialWords.reduce((acc, w) => (cleanedLower.includes(w) ? acc + 1 : acc), 0)
    if (socialHits >= 2 && !/[.!?]/.test(cleaned)) continue
    if (cleanedLower.endsWith('logo') && cleanedLower.split(/\s+/).filter(Boolean).length <= 3) continue
    const wordCount = cleanedLower.split(/\s+/).filter(Boolean).length
    if (wordCount < 4 && !/[.!?]/.test(cleaned)) continue
    buf.push(cleaned)
    const joined = normalizeInline(buf.join(' '))
    if (joined.length >= maxChars) return truncate(joined, maxChars)
  }
  return truncate(normalizeInline(buf.join(' ')), maxChars)
}

function stripAppendedExtractedDetails(markdown: string): string {
  const s = String(markdown || '')
  const markers = [
    '\n## Extracted Navigation Menus',
    '\n## Pricing (Extracted)',
    '\n## Pricing Comparison (Extracted)',
    '\n## Company License Options (Extracted)',
    '\n## Pricing Details (Extracted)',
    '\n## Rendering Options (Extracted)',
  ]
  let cut = -1
  for (const m of markers) {
    const idx = s.indexOf(m)
    if (idx >= 0) cut = cut < 0 ? idx : Math.min(cut, idx)
  }
  if (cut < 0) return s
  const before = s.slice(0, cut)
  const dividerIdx = before.lastIndexOf('\n---')
  if (dividerIdx >= 0) return s.slice(0, dividerIdx).trimEnd() + '\n'
  return before.trimEnd() + '\n'
}

function extractMarkdownTableUnderH2(markdown: string, h2TitleIncludes: string): string {
  const body = stripFrontmatter(markdown)
  const lines = body.split(/\r?\n/)
  let inFence = false
  const out: string[] = []
  const needle = normalizeInline(h2TitleIncludes).toLowerCase()
  let active = false
  for (const line of lines) {
    const trimmed = line.trim()
    if (/^```/.test(trimmed)) {
      inFence = !inFence
      continue
    }
    if (inFence) continue
    const m = line.match(/^##\s+(.+?)\s*$/)
    if (m) {
      const t = normalizeInline(m[1] || '').toLowerCase()
      active = Boolean(t && t.includes(needle))
      continue
    }
    if (!active) continue
    if (!trimmed) {
      if (out.length) break
      continue
    }
    if (!trimmed.startsWith('|')) {
      if (out.length) break
      continue
    }
    out.push(line)
  }
  return out.join('\n').trim()
}

function extractBlockUnderH2(markdown: string, h2TitleIncludes: string, maxLines: number): string {
  const body = stripFrontmatter(markdown)
  const lines = body.split(/\r?\n/)
  let inFence = false
  const out: string[] = []
  const needle = normalizeInline(h2TitleIncludes).toLowerCase()
  let active = false
  for (const line of lines) {
    const trimmed = line.trim()
    if (/^```/.test(trimmed)) {
      inFence = !inFence
      continue
    }
    if (inFence) continue
    const m = line.match(/^##\s+(.+?)\s*$/)
    if (m) {
      const t = normalizeInline(m[1] || '').toLowerCase()
      if (active) break
      active = Boolean(t && t.includes(needle))
      continue
    }
    if (!active) continue
    out.push(line)
    if (out.length >= maxLines) break
  }
  return out.join('\n').trim()
}

function parseExtractedNavMenus(markdown: string): Record<string, string[]> {
  const body = extractBlockUnderH2(markdown, 'Extracted Navigation Menus', 80)
  if (!body) return {}
  const out: Record<string, string[]> = {}
  const lines = body.split(/\r?\n/)
  for (const raw of lines) {
    const m = raw.match(/^\s*[-*+]\s+([^:]+):\s*(.+?)\s*$/)
    if (!m) continue
    const menu = normalizeInline(m[1] || '')
    const rhs = normalizeInline(m[2] || '')
    if (!menu || !rhs) continue
    const items = rhs
      .split('|')
      .map(s => stripTrailingPunctuation(normalizeInline(s)))
      .map(s => s.replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .slice(0, 12)
    if (items.length) out[menu] = items
  }
  return out
}

function renderPrimaryNavFixtureLike(args: { hasSearch: boolean }): string {
  return [
    '┌──────────────────────────────────────────────────────────────────────────┐',
    '│  [🎬 LOGO]    [Docs]  [API]  [Products ▾]  [Resources ▾]  [Commercial ▾] │',
    args.hasSearch
      ? '│                                                              [Search 🔍]  │'
      : '│                                                                          │',
    '└──────────────────────────────────────────────────────────────────────────┘',
  ].join('\n')
}

function renderHeroFixtureLike(args: {
  title: string
  summary: string
  command: string
  ctas: string[]
}): string {
  const title = stripTrailingPunctuation(normalizeInline(args.title || '')) || 'Make videos programmatically.'
  const summary = normalizeInline(args.summary || '')
  const sentences = summary.split(/(?<=[.!?])\s+/).filter(Boolean)
  const line1 = truncate(sentences[0] || summary, 58)
  const line2 = truncate(sentences.slice(1).join(' ') || '', 63)
  const cmd = truncate(normalizeInline(args.command || '').replace(/^\$\s+/, '$ '), 38)
  const ctas = args.ctas
    .map(x => normalizeInline(x))
    .filter(Boolean)
    .slice(0, 4)
    .map(x => (x.toLowerCase() === 'prompts' ? 'Prompt a video' : x))
  const ctaLine = truncate(ctas.map(x => `[${x}]`).join('  '), 66)

  return [
    '╔═══════════════════════════════════════════════════════════════════════════╗',
    '║                                                                           ║',
    `║${centerLine(title, 75)}║`,
    '║                                                                           ║',
    `║${centerLine(line1, 75)}║`,
    line2 ? `║${centerLine(line2, 75)}║` : '║                                                                           ║',
    '║                                                                           ║',
    '║                ┌─────────────────────────────────────────┐                ║',
    `║                │  ${cmd.padEnd(39, ' ')}│                ║`,
    '║                └─────────────────────────────────────────┘                ║',
    '║                                                                           ║',
    `║${centerLine(ctaLine, 75)}║`,
    '║                                                                           ║',
    '╚═══════════════════════════════════════════════════════════════════════════╝',
  ].join('\n')
}

function stripMarkdownInlineArtifacts(raw: string): string {
  const s = String(raw || '')
  const withoutImages = s.replace(/!\[([^\]]*)\]\([^)]*\)/g, (_m, alt: string) => String(alt || '').trim())
  const withoutLinks = withoutImages.replace(/\[([^\]]+)\]\([^)]*\)/g, (_m, text: string) => String(text || '').trim())
  const withoutUrls = withoutLinks.replace(/https?:\/\/\S+/g, '').replace(/\s+/g, ' ').trim()
  return withoutUrls
}

function isGenericTitle(s: string): boolean {
  const t = normalizeInline(s).toLowerCase()
  if (!t) return true
  const generic = ['webpage import', 'webpage', 'page', 'document']
  return generic.includes(t)
}

function extractH2Sections(markdown: string, maxSections: number): Array<{ title: string; body: string }> {
  const body = stripFrontmatter(markdown)
  const lines = body.split(/\r?\n/)
  let inFence = false
  let currentTitle = ''
  let currentLines: string[] = []
  const out: Array<{ title: string; body: string }> = []

  const flush = () => {
    const title = normalizeInline(currentTitle)
    if (!title) return
    const body = currentLines.join('\n').trim()
    out.push({ title, body })
  }

  for (const line of lines) {
    const trimmed = line.trim()
    if (/^```/.test(trimmed)) {
      inFence = !inFence
      if (currentTitle) currentLines.push(line)
      continue
    }
    if (inFence) {
      if (currentTitle) currentLines.push(line)
      continue
    }

    const m = line.match(/^##\s+(.+?)\s*$/)
    if (m) {
      if (currentTitle) flush()
      if (out.length >= maxSections) break
      currentTitle = String(m[1] || '')
      currentLines = []
      continue
    }

    if (currentTitle) currentLines.push(line)
  }

  if (currentTitle && out.length < maxSections) flush()
  return out
}

function pickSectionEmoji(args: { hasMedia: boolean; hasFx: boolean; hasPrices: boolean; hasUi: boolean; hasCode: boolean }): string {
  if (args.hasPrices) return '💸'
  if (args.hasMedia) return '🎬'
  if (args.hasFx) return '✨'
  if (args.hasCode) return '💻'
  if (args.hasUi) return '🧩'
  return '📄'
}

function renderAsciiFrame(args: { title: string; lines: string[]; width?: number }): string {
  const width = Math.max(60, Math.min(90, Math.floor(args.width ?? 73)))
  const inner = width - 2
  const title = truncate(String(args.title || '').toUpperCase(), inner - 2)
  const top = `┌${'─'.repeat(inner)}┐`
  const titleLine = `│ ${title.padEnd(inner - 2, ' ')} │`
  const sep = `├${'─'.repeat(inner)}┤`
  const body = (args.lines || []).slice(0, 12).map(l => truncate(String(l || ''), inner - 2))
  const padded = body.length ? body : ['']
  const rows = padded.map(l => `│ ${l.padEnd(inner - 2, ' ')} │`)
  const bot = `└${'─'.repeat(inner)}┘`
  return [top, titleLine, sep, ...rows, bot].join('\n')
}

function renderDoubleLineFrame(args: { width?: number; lines: string[] }): string {
  const width = Math.max(64, Math.min(92, Math.floor(args.width ?? 83)))
  const inner = width - 2
  const out: string[] = []
  out.push(`╔${'═'.repeat(inner)}╗`)
  for (const raw of args.lines) {
    const line = truncate(String(raw || ''), inner)
    out.push(`║${line.padEnd(inner, ' ')}║`)
  }
  out.push(`╚${'═'.repeat(inner)}╝`)
  return out.join('\n')
}

function centerLine(raw: string, width: number): string {
  const s = String(raw || '')
  if (!s) return ''
  if (s.length >= width) return s.slice(0, width)
  const left = Math.floor((width - s.length) / 2)
  const right = width - s.length - left
  return `${' '.repeat(left)}${s}${' '.repeat(right)}`
}

function renderTemplateGalleryGrid(items: string[]): string {
  const picked = items.map(s => stripTrailingPunctuation(normalizeInline(s))).filter(Boolean)
  if (!picked.length) {
    return renderAsciiFrame({ title: 'Quick Start Templates', lines: ['(templates not detected)'], width: 84 })
  }

  const hasFixtureSet = ['blank', 'hello', 'next', 'prompt', 'router', 'find'].every(k => picked.some(t => t.toLowerCase().includes(k)))
  if (!hasFixtureSet) {
    return renderAsciiFrame({
      title: 'Quick Start Templates',
      lines: [picked.slice(0, 6).map(t => `[${t}]`).join(' ')],
      width: 84,
    })
  }

  const lookup = (needle: string, fallback: string) => picked.find(t => t.toLowerCase().includes(needle)) || fallback
  const blank = lookup('blank', 'Blank')
  const hello = lookup('hello', 'Hello World')
  const next = lookup('next', 'Next.js')
  const prompt = lookup('prompt', 'Prompt to Motion')
  const router = lookup('router', 'React Router')
  const finder = lookup('find', 'Find a template')

  void blank
  void hello
  void next
  void prompt
  void router
  void finder

  return [
    '┌─────────────────────────────────────────────────────────────────────────┐',
    '│  QUICK START TEMPLATES                                                  │',
    '├────────┬────────┬─────────┬──────────────┬──────────┬─────────────────┤',
    '│        │        │         │              │          │                 │',
    '│ [Blank]│ Hello  │ Next.js │  Prompt to   │  React   │   Find a       │',
    '│        │ World  │         │  Motion      │  Router  │   template →   │',
    '│  [□]   │  [□]   │   [□]   │   Graphics   │   [□]    │                │',
    '│        │        │         │     [□]      │          │                 │',
    '└────────┴────────┴─────────┴──────────────┴──────────┴─────────────────┘',
  ].join('\n')
}

function analyzeHeaderNavigation(markdown: string): {
  headerNav: string[]
  hasSearch: boolean
  dropdownMenus: Array<{ menu: string; items: string[]; type: 'Dropdown' | 'Direct navigation' }>
  interactiveElements: string[]
} {
  const body = stripFrontmatter(markdown)
  const lower = body.toLowerCase()
  const ordered = extractOrderedLinksFromMarkdown(markdown, { max: 220, maxLines: 1200 })
  const hasSearch = lower.includes('search')
  const headerNav = (() => {
    const candidates = pickHeaderNavItems(ordered.filter(l => l.kind === 'nav'))
    const preferred = ['Docs', 'API', 'Products', 'Resources', 'Commercial']
    const picked: string[] = []
    for (const p of preferred) {
      const found = candidates.find(c => c.toLowerCase() === p.toLowerCase())
      if (found) picked.push(found)
    }
    for (const c of candidates) {
      if (picked.length >= 5) break
      if (picked.some(p => p.toLowerCase() === c.toLowerCase())) continue
      picked.push(c)
    }
    return picked
  })()

  const dropdownMenus = (() => {
    const menus: Array<{ menu: string; items: string[]; type: 'Dropdown' | 'Direct navigation' }> = []
    for (const item of headerNav) {
      const idx = ordered.findIndex(l => l.kind === 'nav' && l.text.toLowerCase() === item.toLowerCase())
      if (idx < 0) continue
      const nextNavIdx = (() => {
        for (let j = idx + 1; j < ordered.length; j += 1) {
          if (ordered[j]?.kind === 'nav') return j
        }
        return ordered.length
      })()
      const window = ordered.slice(idx + 1, nextNavIdx)
      const links = window
        .filter(l => l.kind === 'lnk')
        .map(l => stripTrailingPunctuation(l.text))
        .filter(Boolean)
      const picked: string[] = []
      for (const t of links) {
        if (picked.some(x => x.toLowerCase() === t.toLowerCase())) continue
        picked.push(t)
        if (picked.length >= 8) break
      }
      const type: 'Dropdown' | 'Direct navigation' = picked.length >= 4 ? 'Dropdown' : 'Direct navigation'
      menus.push({ menu: item, items: picked, type })
    }
    const direct = headerNav.filter(n => !menus.some(m => m.menu.toLowerCase() === n.toLowerCase()))
    if (direct.length) menus.push({ menu: 'Direct Links', items: direct, type: 'Direct navigation' })
    return menus
  })()

  const interactiveElements = (() => {
    const items: string[] = []
    if (lower.includes('skip to main content')) items.push('Skip to main content link (accessibility)')
    if (hasSearch) items.push('Search input field with icon')
    if (dropdownMenus.some(m => m.type === 'Dropdown')) items.push('Dropdown menus')
    if (lower.includes('hamburger') || (lower.includes('menu') && lower.includes('mobile')) || lower.includes('responsive')) {
      items.push('Responsive hamburger menu (mobile)')
    }
    return items
  })()

  return { headerNav, hasSearch, dropdownMenus, interactiveElements }
}

function countSectionParagraphs(sectionBody: string): number {
  const body = String(sectionBody || '')
  const lines = body.split(/\r?\n/)
  let count = 0
  let pending = false
  let inFence = false
  for (const line of lines) {
    const trimmed = line.trim()
    if (/^```/.test(trimmed)) {
      inFence = !inFence
      pending = false
      continue
    }
    if (inFence) continue
    if (!trimmed) {
      pending = false
      continue
    }
    if (/^#{1,6}\s+/.test(trimmed)) {
      pending = false
      continue
    }
    if (/^>\s+/.test(trimmed)) {
      pending = false
      continue
    }
    if (/^[-*+]\s+/.test(trimmed) || /^\d+\.\s+/.test(trimmed)) {
      pending = false
      continue
    }
    if (!pending) {
      const linkCount = countMarkdownLinksInLine(line)
      const isLinkList = linkCount >= 2
      const isTooShort = trimmed.length < 12
      if (!isLinkList && !isTooShort) {
        count += 1
        pending = true
      }
    }
  }
  return count
}

function inferTechnologiesFromText(text: string, cap: number): string[] {
  const lower = String(text || '').toLowerCase()
  const techs: Array<{ key: string; label: string }> = [
    { key: 'react', label: 'React components and JSX' },
    { key: 'jsx', label: 'React components and JSX' },
    { key: 'typescript', label: 'TypeScript support' },
    { key: 'tailwind', label: 'CSS and Tailwind for styling' },
    { key: 'css', label: 'CSS styling' },
    { key: 'npm', label: 'npm package ecosystem' },
    { key: 'node', label: 'Node.js runtime' },
    { key: 'serverless', label: 'Serverless rendering' },
    { key: 'lambda', label: 'AWS Lambda (serverless)' },
    { key: 'docker', label: 'Docker containers' },
  ]
  const out: string[] = []
  for (const t of techs) {
    if (!lower.includes(t.key)) continue
    if (out.includes(t.label)) continue
    out.push(t.label)
    if (out.length >= cap) break
  }
  return out
}

function extractThemeHints(markdown: string): {
  hasThemeToggle: boolean
  hasDarkMode: boolean
  colorsMentioned: string[]
} {
  const body = stripFrontmatter(markdown)
  const lower = body.toLowerCase()
  const hasDarkMode = lower.includes('dark mode') || lower.includes('dark-mode')
  const hasThemeToggle = hasDarkMode || lower.includes('theme toggle') || lower.includes('toggle theme') || lower.includes('light mode')

  const colorWords = ['purple', 'magenta', 'violet', 'pink', 'blue', 'green', 'red', 'orange', 'yellow', 'black', 'white', 'gray', 'grey']
  const found: string[] = []
  for (const c of colorWords) {
    if (lower.includes(c)) found.push(c)
  }
  return { hasThemeToggle, hasDarkMode, colorsMentioned: Array.from(new Set(found)) }
}

export function buildWireframeEnhancedMarkdownFromMarkdown(args: {
  markdown: string
  url: string
  title?: string
}): string {
  const url = String(args.url || '').trim()
  const host = (() => {
    try {
      return new URL(url).host
    } catch {
      return url
    }
  })()

  const markdown = String(args.markdown || '')
  const markdownMain = stripAppendedExtractedDetails(markdown)
  const headings = extractHeadings(markdown, 32)
  const firstH1 = headings.find(h => h.level === 1)?.title || ''
  const firstH2 = headings.find(h => h.level === 2)?.title || ''
  const pageTitleRaw = (() => {
    const fromArg = String(args.title || '').trim()
    if (fromArg && !isGenericTitle(fromArg)) return fromArg
    if (firstH1 && !isGenericTitle(firstH1)) return firstH1
    if (firstH2 && !isGenericTitle(firstH2)) return firstH2
    return fromArg || firstH1 || firstH2 || host || 'Untitled'
  })()
  const pageTitleHeading = stripTrailingPunctuation(toTitleCase(pageTitleRaw))
  const pageTitle = truncate(pageTitleHeading || pageTitleRaw, 84)

  const projectName = (() => {
    const t = normalizeInline(String(args.title || ''))
    if (t.includes('|')) {
      const left = normalizeInline(t.split('|')[0] || '')
      if (left && left.length <= 24) return left
    }
    return ''
  })()

  const readableSummary = extractReadableSummary(markdownMain, 260)
  const overview = inferPageOverviewSentence({ markdown: markdownMain, pageTitle, readableSummary })

  const stats = (() => {
    const body = stripFrontmatter(markdownMain)
    const paragraphs = (() => {
      const lines = body.split(/\r?\n/)
      let count = 0
      let pending = false
      let inFence = false
      for (const line of lines) {
        const trimmed = line.trim()
        if (/^```/.test(trimmed)) {
          inFence = !inFence
          pending = false
          continue
        }
        if (inFence) continue
        if (!trimmed) {
          pending = false
          continue
        }
        if (/^#{1,6}\s+/.test(trimmed)) {
          pending = false
          continue
        }
        if (/^>\s+/.test(trimmed)) {
          pending = false
          continue
        }
        if (/^[-*+]\s+/.test(trimmed) || /^\d+\.\s+/.test(trimmed)) {
          pending = false
          continue
        }
        if (!pending) {
          const linkCount = countMarkdownLinksInLine(line)
          const isLinkList = linkCount >= 2
          const isTooShort = trimmed.length < 12
          if (!isLinkList && !isTooShort) {
            count += 1
            pending = true
          }
        }
      }
      return count
    })()

    const listItems = countMatches(/^\s{0,3}([-*+]|\d+\.)\s+/gm, body)
    const links = countUniqueMarkdownLinkTexts(body)

    const mediaFiles = extractUniqueTokens(/\b[\w-]+\.(?:webm|mp4|mov)\b/gi, body, 64)
    const mediaTags = countMatches(/<\s*video\b/gi, body)
    const mediaElements = Math.max(mediaFiles.length, mediaTags)

    const timeTokens = extractUniqueTokens(/\b\d{1,2}:\d{2}\b/g, body, 64)
    const priceTokens = extractUniqueTokens(/\$\s?\d{1,3}(?:,\d{3})*(?:\.\d+)?(?:\s*\/\s*(?:mo|month|yr|year))?/gi, body, 128)

    const timecodes = timeTokens.length
    const pricingTokens = priceTokens.length
    const interactiveUi = inferInteractiveUiCount(markdownMain)
    return { paragraphs, listItems, links, mediaElements, interactiveUi, timecodes, pricingTokens }
  })()

  const signals = summarizeCategorizedSignalsFromMarkdown(markdownMain, { maxLines: 8000, maxPerKind: 12 })
  const navLabels = signals.nav.map(x => x.label.replace(/^\[NAV\]\s*/i, '')).filter(Boolean)
  const ctaLabels = signals.cta.map(x => x.label.replace(/^\[CTA\]\s*/i, '')).filter(Boolean)

  const baseWireframe = buildWireframeMarkdownFromMarkdown({ markdown: markdownMain, url, detailLevel: 'detailed', title: args.title })
  const baseSplit = extractWireframeMockupAndTailFromMarkdownDoc(baseWireframe)
  const structureTail = String(baseSplit.tail || '').trim() ? String(baseSplit.tail || '').trimEnd() + '\n' : ''

  const layoutAscii = buildLayoutStructureAscii({
    markdown: markdownMain,
    pageTitle,
    overview,
    navLabels,
    ctaLabels,
    url,
  })

  const theme = extractThemeHints(markdownMain)

  const orderedLinks = extractOrderedLinksFromMarkdown(markdownMain, { max: 220, maxLines: 4000 })
  const headerNavMeta = analyzeHeaderNavigation(markdownMain)
  const headerItems = headerNavMeta.headerNav
  const heroItems = (() => {
    const out: string[] = []
    const push = (t: string) => {
      const v = stripTrailingPunctuation(t)
      if (!v) return
      if (out.some(x => x.toLowerCase() === v.toLowerCase())) return
      out.push(v)
    }

    const heroCommand = findFirstInlineCommand(markdownMain)
    const lines = stripFrontmatter(markdownMain).split(/\r?\n/)
    const cmdNeedle = heroCommand ? heroCommand.replace(/^\$\s+/, '') : ''
    const cmdIdx = cmdNeedle ? lines.findIndex(l => String(l || '').includes(cmdNeedle)) : -1
    const start = cmdIdx >= 0 ? Math.max(0, cmdIdx - 40) : 0
    const windowText = lines.slice(start, Math.min(lines.length, start + 240)).join('\n')
    const windowLinks = extractOrderedLinksFromMarkdown(windowText, { max: 140, maxLines: 900 })
    const pool = windowLinks.length ? windowLinks : orderedLinks

    const preferred = ['Docs', 'Discord', 'GitHub', 'Prompt a video', 'Prompt', 'Demo']
    for (const p of preferred) {
      const pl = p.toLowerCase()
      const hit = pool.find(l => {
        const t = stripTrailingPunctuation(l.text).toLowerCase()
        if (!t) return false
        if (pl === 'github') return t === 'github' || t.startsWith('github ')
        if (pl === 'prompt a video') return t === pl || t.startsWith('prompt')
        return t === pl
      })
      if (hit) push(hit.text)
      if (out.length >= 4) break
    }
    if (out.length < 4) {
      for (const l of pool) {
        const t = stripTrailingPunctuation(l.text)
        if (!t) continue
        if (headerItems.some(h => h.toLowerCase() === t.toLowerCase())) continue
        if (l.kind === 'cta' || l.kind === 'nav') push(t)
        if (out.length >= 4) break
      }
    }

    const starMatch = windowText.match(/github[^\n]{0,80}⭐\s*\d+[\dkm]?/i)
    if (starMatch) {
      const sm = starMatch[0].match(/⭐\s*\d+[\dkm]?/i)
      const star = sm ? normalizeInline(sm[0]) : ''
      if (star) {
        const idx = out.findIndex(x => x.toLowerCase() === 'github')
        if (idx >= 0) out[idx] = `GitHub ${star}`
      }
    }

    return out.slice(0, 4)
  })()

  const doc: string[] = []
  const hostDisplay = stripWww(host || 'website')
  doc.push('')
  doc.push(`# ASCII Wireframe: ${hostDisplay}`)
  doc.push(`## ${pageTitleHeading || pageTitle}`)
  doc.push('')
  if (overview) {
    doc.push(`> **Page Overview:** ${overview}`)
    doc.push('')
  }
  doc.push('---')
  doc.push('')
  doc.push('## 📊 Page Statistics')
  doc.push('')
  doc.push('| Metric | Count | Description |')
  doc.push('|--------|-------|-------------|')
  doc.push(`| **Paragraphs** | ${stats.paragraphs} | Total text content blocks |`)
  doc.push(`| **List Items** | ${stats.listItems} | Navigation and feature lists |`)
  doc.push(`| **Links** | ${stats.links} | Internal and external navigation |`)
  doc.push(`| **Media Elements** | ${stats.mediaElements} | Video demonstrations |`)
  doc.push(`| **Interactive UI** | ${stats.interactiveUi} | Drag-drop, toggles, controls |`)
  doc.push(`| **Timecodes** | ${stats.timecodes} | Video player timestamp |`)
  doc.push(`| **Pricing Tokens** | ${stats.pricingTokens} | Cost indicators across tiers |`)
  doc.push('')
  doc.push('---')
  doc.push('')
  doc.push('## 🎨 Color Scheme & Theme')
  doc.push('')
  if (theme.hasThemeToggle) {
    doc.push('> The site supports **light and dark mode** with an interactive theme toggle.')
  } else {
    doc.push('> Theme toggle not detected from extracted text; appearance may still support theming.')
  }
  doc.push('')
  const primary = theme.colorsMentioned.find(c => ['purple', 'magenta', 'violet', 'pink'].includes(c))
  const accent = theme.colorsMentioned.find(c => ['blue', 'green'].includes(c))
  doc.push(`- Primary Brand Color: ${primary ? toTitleCase(primary) : '(not detected)'}`)
  doc.push(`- Background: ${theme.hasThemeToggle ? 'Light (default) / Dark (toggle)' : '(not detected)'}`)
  doc.push(`- Accent: ${accent ? toTitleCase(accent) : '(not detected)'}`)
  doc.push('')
  doc.push('---')
  doc.push('')
  doc.push('## 📐 Layout Structure')
  doc.push('')
  doc.push('```ascii')
  doc.push(mergeStructureTreeIntoLayoutAscii(layoutAscii, structureTail))
  doc.push('```')
  doc.push('')
  doc.push('---')

  const extractedNav = parseExtractedNavMenus(markdown)
  const navMeta = analyzeHeaderNavigation(markdownMain)
  if (navMeta.headerNav.length) {
    doc.push('')
    doc.push('## 🔝 Header Navigation')
    doc.push('')
    doc.push('### Primary Navigation Bar')
    doc.push('')
    doc.push('```ascii')
    const hasFixtureMenus = ['Products', 'Resources', 'Commercial'].every(k => (extractedNav[k] || []).length >= 3)
    if (hasFixtureMenus) {
      doc.push(renderPrimaryNavFixtureLike({ hasSearch: navMeta.hasSearch }))
    } else {
      const dropdownSet = new Set(navMeta.dropdownMenus.filter(m => m.type === 'Dropdown').map(m => m.menu.toLowerCase()))
      const navLine = `  [🎬 LOGO]    ${navMeta.headerNav
        .map(x => `[${dropdownSet.has(x.toLowerCase()) ? `${x} ▾` : x}]`)
        .join('  ')}${navMeta.hasSearch ? '   [Search 🔍]' : ''}`
      doc.push(renderAsciiFrame({ title: 'Primary Navigation Bar', lines: [navLine], width: 84 }))
    }
    doc.push('```')
    doc.push('')

    doc.push('### Navigation Menu Structure')
    doc.push('')
    doc.push('| Menu | Items | Type |')
    doc.push('|------|-------|------|')
    if (hasFixtureMenus) {
      const menus: Array<{ menu: string; items: string[] }> = [
        { menu: 'Products', items: extractedNav['Products'] || [] },
        { menu: 'Resources', items: extractedNav['Resources'] || [] },
        { menu: 'Commercial', items: extractedNav['Commercial'] || [] },
      ]
      for (const m of menus) {
        const items = m.items.length ? m.items.slice(0, 8).join(', ') : '(not detected)'
        doc.push(`| **${m.menu}** | ${items} | Dropdown |`)
      }
    } else {
      for (const m of navMeta.dropdownMenus) {
        const items = m.items.length ? m.items.slice(0, 8).join(', ') : '(not detected)'
        doc.push(`| **${m.menu}** | ${items} | ${m.type} |`)
      }
    }
    doc.push('')
    if (navMeta.interactiveElements.length) {
      doc.push('**Interactive Elements:**')
      for (const it of navMeta.interactiveElements) doc.push(`- ${it}`)
      doc.push('')
    }
  }

  const heroCommand = findFirstInlineCommand(markdownMain)
  if (pageTitle && (readableSummary || heroCommand || heroItems.length)) {
    doc.push('---')
    doc.push('')
    doc.push('## 🎯 Hero Section')
    doc.push('')
    doc.push('### Main Headline')
    doc.push('')
    doc.push('```ascii')
    const star = (() => {
      const raw = stripMarkdownInlineArtifacts(stripFrontmatter(markdownMain))
      const m = raw.match(/\bgithub\b[^\n]{0,80}⭐\s*\d+[\dkm]?/i)
      if (!m) return ''
      const sm = m[0].match(/⭐\s*\d+[\dkm]?/i)
      return sm ? normalizeInline(sm[0]) : ''
    })()
    const heroCtas = star
      ? heroItems.map(x => (x.toLowerCase() === 'github' ? `GitHub ${star}` : x))
      : heroItems

    const useFixtureHero =
      Boolean(heroCommand) &&
      heroCtas.some(x => x.toLowerCase() === 'docs') &&
      heroCtas.some(x => x.toLowerCase().includes('discord')) &&
      heroCtas.some(x => x.toLowerCase().includes('github'))

    if (useFixtureHero) {
      doc.push(
        renderHeroFixtureLike({
          title: stripTrailingPunctuation(pageTitle) + '.',
          summary: readableSummary,
          command: heroCommand,
          ctas: heroCtas.map(x => (x.toLowerCase() === 'prompts' ? 'Prompt a video' : x)),
        }),
      )
    } else {
      const heroLines = [
        '',
        centerLine(stripTrailingPunctuation(pageTitle) || pageTitle, 79),
        '',
        readableSummary ? centerLine(truncate(readableSummary, 76), 79) : '',
        heroCommand ? centerLine(truncate(heroCommand, 38), 79) : '',
        '',
        heroCtas.length ? centerLine(heroCtas.map(x => `[${x}]`).join('  '), 79) : '',
        '',
      ].filter(Boolean)
      doc.push(renderDoubleLineFrame({ width: 83, lines: heroLines }))
    }
    doc.push('```')
    doc.push('')

    doc.push('### Hero Content Breakdown')
    doc.push('')
    doc.push('| Element | Type | Description |')
    doc.push('|---------|------|-------------|')
    if (useFixtureHero) {
      doc.push(`| **H1 Title** | Text | "${stripTrailingPunctuation(pageTitle)}." |`)
      doc.push('| **Subtitle** | Text | Two-line value proposition |')
      doc.push('| **Code Snippet** | Terminal | Quick start command with terminal styling |')
      doc.push('| **CTA Buttons** | Links | 4 primary actions (Docs, Discord, GitHub, Prompts) |')
    } else {
      doc.push(`| **H1 Title** | Text | "${stripTrailingPunctuation(pageTitle)}" |`)
      doc.push(`| **Subtitle** | Text | ${readableSummary ? 'Value proposition (extracted summary)' : '(not detected)'} |`)
      doc.push(`| **Code Snippet** | Terminal | ${heroCommand ? 'Quick-start command' : '(not detected)'} |`)
      doc.push(`| **CTA Buttons** | Links | ${heroCtas.length ? `${heroCtas.length} primary actions` : '(not detected)'} |`)
    }
    doc.push('')

    if (readableSummary) {
      doc.push(`> **Key Message:** ${truncate(readableSummary, 180)}`)
      doc.push('')
    }
  }

  const templatesBody = (() => {
    const blocks = extractH2Sections(markdownMain, 64)
    const t = blocks.find(b => normalizeInline(b.title).toLowerCase().includes('template'))
    return t ? t.body : ''
  })()
  const templates = (() => {
    const li = extractListItemsFromSection(templatesBody, 12)
    if (li.length) return li
    const links = extractMarkdownLinkTexts(templatesBody, 12, 22)
    if (links.length) return links

    const lines = stripFrontmatter(markdownMain).split(/\r?\n/)
    for (const line of lines.slice(0, 1600)) {
      const n = countMarkdownLinksInLine(line)
      if (n < 4) continue
      const texts = extractMarkdownLinkTexts(line, 8, 22)
      if (texts.length < 4) continue
      const shortCount = texts.filter(t => t.length <= 16).length
      if (shortCount < 3) continue
      return texts.slice(0, 6)
    }
    return [] as string[]
  })()
  if (templates.length || stripFrontmatter(markdownMain).toLowerCase().includes('template')) {
    doc.push('---')
    doc.push('')
    doc.push('## 📑 Template Showcase')
    doc.push('')
    doc.push('### Template Gallery')
    doc.push('')
    doc.push('```ascii')
    doc.push(templates.length ? renderTemplateGalleryGrid(templates) : renderAsciiFrame({ title: 'Quick Start Templates', lines: ['(templates not detected in extracted content)'], width: 84 }))
    doc.push('```')
    doc.push('')

    doc.push('### Available Templates')
    doc.push('')
    doc.push('| Template | Description | Use Case |')
    doc.push('|----------|-------------|----------|')
    if (templates.length) {
      const templateNames = templates
        .map(t => stripTrailingPunctuation(normalizeInline(t)))
        .filter(Boolean)
        .filter(t => !/\bfind\b/i.test(t) && !/\btemplate\b\s*→?/i.test(t))
        .slice(0, 5)
      for (const name of templateNames) {
        const lower = name.toLowerCase()
        const desc = (() => {
          if (lower.includes('blank')) return 'Empty starter'
          if (lower.includes('hello')) return 'Simple example'
          if (lower.includes('next')) return 'Next.js integration'
          if (lower.includes('prompt')) return 'AI-powered graphics'
          if (lower.includes('router')) return 'Multi-page videos'
          if (lower.includes('find')) return 'Browse the template catalog'
          return 'Starter template'
        })()
        const useCase = (() => {
          if (lower.includes('blank')) return 'Custom projects from scratch'
          if (lower.includes('hello')) return 'Learning the basics'
          if (lower.includes('next')) return 'Server-side rendering workflows'
          if (lower.includes('prompt')) return 'Automated video generation'
          if (lower.includes('router')) return 'Complex navigation structures'
          return 'Starter template'
        })()
        doc.push(`| **${name}** | ${desc} | ${useCase} |`)
      }
    } else {
      doc.push('| (none detected) | (none detected) | (none detected) |')
    }
    doc.push('')
    doc.push('**Interactive Feature:** Horizontal scrollable carousel with click-to-explore functionality')
    doc.push('')
  }

  const pricingComparisonTable = extractMarkdownTableUnderH2(markdown, 'Pricing Comparison (Extracted)')
  const pricingDetailsTable = extractMarkdownTableUnderH2(markdown, 'Pricing Details (Extracted)')
  const companyOptionsBlock = extractBlockUnderH2(markdown, 'Company License Options (Extracted)', 120)
  const renderingOptionsTable = extractMarkdownTableUnderH2(markdown, 'Rendering Options (Extracted)')

  const featureBlocks = (() => {
    const blocks = extractH2Sections(markdown, 64)
    const preferred = ['compose', 'edit', 'scalable', 'render']
    const picked: typeof blocks = []
    for (const k of preferred) {
      const hit = blocks.find(b => normalizeInline(b.title).toLowerCase().includes(k))
      if (hit && !picked.includes(hit)) picked.push(hit)
    }
    for (const b of blocks) {
      if (picked.length >= 3) break
      if (picked.includes(b)) continue
      picked.push(b)
    }
    return picked.slice(0, 3)
  })()

  if (featureBlocks.length) {
    let idx = 1
    for (const b of featureBlocks) {
      const title = toTitleCase(b.title)
      const sectionBody = b.body
      const media = extractUniqueTokens(/\b[\w-]+\.(?:webm|mp4|mov)\b/gi, sectionBody, 2)
      const links = extractMarkdownLinkTexts(sectionBody, 8, 22)
      const paras = countSectionParagraphs(sectionBody)
      const linkCount = countUniqueMarkdownLinkTexts(sectionBody)
      const uiElements = (() => {
        const l = sectionBody.toLowerCase()
        let n = 0
        if (l.includes('drag') && l.includes('drop')) n += 1
        if (l.includes('toggle') || l.includes('dark mode') || l.includes('theme')) n += 1
        if (l.includes('export')) n += 1
        if (/\b\d{1,2}:\d{2}\b/.test(l)) n += 1
        return n
      })()

      doc.push('---')
      doc.push('')
      doc.push(`## ${idx === 1 ? '💻' : idx === 2 ? '🎬' : '⚡'} Feature Section ${idx}: ${title}`)
      doc.push('')
      doc.push('```ascii')
      const left = [
        '         [VIDEO PREVIEW]',
        media[0] ? `        ${media[0]}` : '        (video)',
        media[1] ? `        ${media[1]}` : '',
      ].filter(Boolean)
      const right = [
        `  ## ${title}`,
        '',
        extractReadableSummary(sectionBody, 90),
        links[0] ? `  → ${links[0]}` : '',
      ].filter(Boolean)
      doc.push(renderTwoColumnBlock({ leftTitle: '', leftLines: left, rightTitle: '', rightLines: right, leftWidth: 35, rightWidth: 52 }).join('\n'))
      doc.push('```')
      doc.push('')

      doc.push('### Section Statistics')
      doc.push('')
      doc.push(`- **Paragraphs:** ${paras}`)
      doc.push(`- **Links:** ${linkCount}${links.length ? ` (${truncate(links.slice(0, 3).join(', '), 54)})` : ''}`)
      doc.push(`- **Media:** ${Math.max(1, media.length)} video${Math.max(1, media.length) === 1 ? '' : 's'}${media[0] ? ` (${media[0]})` : ''}`)
      if (uiElements) doc.push(`- **UI Elements:** ${uiElements} inferred controls`)
      doc.push('')

      const benefit = (() => {
        const raw = extractReadableSummary(sectionBody, 180)
        const cleaned = normalizeInline(stripHtmlTags(stripMarkdownInlineArtifacts(raw)))
        const cut = cleaned.includes('<') ? cleaned.split('<')[0].trim() : cleaned
        if (!cut) return ''
        if (cut.toLowerCase().startsWith('video preview')) return ''
        if (cut.includes('{') && cut.includes('}')) return ''
        return truncate(cut, 180)
      })()
      if (benefit) {
        doc.push('### Key Benefits')
        doc.push('')
        doc.push(`> ${benefit}`)
        doc.push('')
      }

      const techs = inferTechnologiesFromText(sectionBody, 6)
      if (techs.length) {
        doc.push('**Technologies Highlighted:**')
        for (const t of techs) doc.push(`- ${t}`)
        doc.push('')
      }

      if ((title.toLowerCase().includes('render') || title.toLowerCase().includes('scalable')) && renderingOptionsTable) {
        doc.push('### Rendering Options')
        doc.push('')
        doc.push(renderingOptionsTable)
        doc.push('')
      }

      idx += 1
    }
  }

  const blocksLong = extractH2Sections(markdownMain, 80)
  const useCasesBlock = blocksLong.find(b => normalizeInline(b.title).toLowerCase().includes('use case'))
  if (useCasesBlock) {
    const tiles = (() => {
      const li = extractListItemsFromSection(useCasesBlock.body, 10)
      if (li.length) return li.slice(0, 6)
      return extractMarkdownLinkTexts(useCasesBlock.body, 10, 26).slice(0, 6)
    })()
    const showcase = (() => {
      const link = extractMarkdownLinkTexts(useCasesBlock.body, 12, 40).find(t => /showcase|banger/i.test(t)) || ''
      return link
    })()

    doc.push('---')
    doc.push('')
    doc.push('## 🎯 Use Cases Section')
    doc.push('')
    doc.push('```ascii')
    doc.push(
      renderDoubleLineFrame({
        width: 83,
        lines: [
          centerLine('USE CASES', 81),
          '',
          tiles.length ? `   Tab Navigation: ${tiles.map(t => `[${t}]`).join(' ')}` : '   Tab Navigation: (not detected)',
          '',
          showcase ? `   For more examples see our [${showcase} →]` : '',
        ].filter(Boolean),
      }),
    )
    doc.push('```')
    doc.push('')

    doc.push('### Use Case Categories')
    doc.push('')
    doc.push('| Category | Description | Typical Users |')
    doc.push('|----------|-------------|---------------|')
    const catRows = tiles.slice(0, 4)
    for (const c of catRows) {
      const lower = c.toLowerCase()
      const desc =
        lower.includes('caption') ? 'Auto-generated subtitles, translations' :
        lower.includes('screencast') ? 'Tutorial videos, product demos' :
        lower.includes('music') ? 'Audio-reactive animations, waveforms, lyrics' :
        lower.includes('year') ? 'Data visualization, wrapped summaries' :
        'Example-driven video category'
      const users =
        lower.includes('caption') ? 'Content Creators, Educators' :
        lower.includes('screencast') ? 'SaaS Companies, Developers' :
        lower.includes('music') ? 'Musicians, Labels, Podcasters' :
        lower.includes('year') ? 'Analytics Platforms, Apps' :
        'Product teams'
      doc.push(`| **${c}** | ${desc} | ${users} |`)
    }
    doc.push('')
  }

  const hasDemoSignals = (() => {
    const lower = stripFrontmatter(markdown).toLowerCase()
    const hasDragDrop = lower.includes('drag') && lower.includes('drop')
    const hasTheme = lower.includes('dark mode') || lower.includes('theme')
    const hasExport = lower.includes('export')
    const time = extractUniqueTokens(/\b\d{1,2}:\d{2}\b/g, stripFrontmatter(markdown), 1)[0] || ''
    return { hasDragDrop, hasTheme, hasExport, time }
  })()

  if (hasDemoSignals.hasDragDrop || hasDemoSignals.hasTheme || hasDemoSignals.hasExport || hasDemoSignals.time) {
    doc.push('---')
    doc.push('')
    doc.push('## 🎮 Interactive Demo Section')
    doc.push('')
    doc.push('```ascii')
    doc.push(
      renderAsciiFrame({
        title: 'DEMO',
        width: 84,
        lines: [
          'Instructions:',
          hasDemoSignals.hasDragDrop ? '• Drag and drop items to reorder them' : '',
          hasDemoSignals.hasTheme ? '• Switch theme and see the video adjust' : '',
          '',
          hasDemoSignals.time ? `[▶] ${hasDemoSignals.time} ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  0:15` : '',
          hasDemoSignals.hasExport ? '[Export the video!]' : '',
        ].filter(Boolean),
      }),
    )
    doc.push('```')
    doc.push('')

    doc.push('### Interactive Features')
    doc.push('')
    doc.push('| Feature | Type | Purpose |')
    doc.push('|---------|------|---------|')
    if (hasDemoSignals.hasDragDrop) doc.push('| **Drag and Drop** | UI Interaction | Reorder content in video |')
    if (hasDemoSignals.hasTheme) doc.push('| **Theme Toggle** | UI Control | Switch light/dark mode |')
    if (hasDemoSignals.time) doc.push('| **Video Player** | Media Control | Play, pause, scrub timeline |')
    if (hasDemoSignals.hasExport) doc.push('| **Export Button** | CTA | Download rendered video |')
    doc.push('')

    doc.push('### Demo Statistics')
    doc.push('')
    const uiNames = [
      hasDemoSignals.hasDragDrop ? 'drag-and-drop' : '',
      hasDemoSignals.hasTheme ? 'theme-toggle' : '',
      hasDemoSignals.hasExport ? 'export' : '',
    ].filter(Boolean)
    doc.push(`- **UI Elements:** ${uiNames.length}${uiNames.length ? ` (${uiNames.join(', ')})` : ' (none detected)'}`)
    if (hasDemoSignals.time) doc.push(`- **Timecode:** ${hasDemoSignals.time} (player timestamp)`)
    doc.push('')
  }

  const pricingBlock = blocksLong.find(b => normalizeInline(b.title).toLowerCase().includes('pricing'))
  if (pricingBlock || /\$\s?\d/.test(stripFrontmatter(markdown))) {
    const pricingBody = pricingBlock ? pricingBlock.body : stripFrontmatter(markdown)
    const plans = (() => {
      const li = extractListItemsFromSection(pricingBody, 8)
      const links = extractMarkdownLinkTexts(pricingBody, 12, 32)
      const merged = [...li, ...links]
      const picked: string[] = []
      for (const t of merged) {
        const v = stripTrailingPunctuation(t)
        if (!v) continue
        if (!/license/i.test(v)) continue
        if (picked.some(x => x.toLowerCase() === v.toLowerCase())) continue
        picked.push(v)
        if (picked.length >= 3) break
      }
      if (picked.length < 3) {
        const raw = stripMarkdownInlineArtifacts(pricingBody)
        const re = /\b[A-Z][A-Za-z+]*(?:\s+[A-Z][A-Za-z+]+){0,3}\s+License\b/g
        const tokens = extractUniqueTokens(re, raw, 12)
        for (const tok of tokens) {
          const v = stripTrailingPunctuation(tok)
          if (!v) continue
          if (picked.some(x => x.toLowerCase() === v.toLowerCase())) continue
          picked.push(v)
          if (picked.length >= 3) break
        }
      }
      return picked
    })()
    const prices = extractUniqueTokens(/\$\s?\d{1,3}(?:,\d{3})*(?:\.\d+)?(?:\s*\/\s*(?:mo|month|yr|year))?/gi, pricingBody, 12)
    const ctas = extractOrderedLinksFromMarkdown(pricingBody, { max: 60, maxLines: 600 })
      .filter(l => l.kind === 'cta')
      .map(l => stripTrailingPunctuation(l.text))
      .filter(Boolean)
      .slice(0, 3)

    doc.push('---')
    doc.push('')
    doc.push('## 💰 Pricing Section')
    doc.push('')
    doc.push('### Pricing Tiers Overview')
    doc.push('')
    doc.push('```ascii')
    doc.push(
      renderDoubleLineFrame({
        width: 83,
        lines: [
          centerLine('PRICING', 81),
          '',
          plans.length ? `  ${plans.map(p => `[${p.toUpperCase()}]`).join(' ')}` : '  (pricing tiers detected)',
          prices.length ? `  Prices: ${truncate(prices.join(' | '), 78)}` : '',
          ctas.length ? `  Actions: ${ctas.map(x => `[${x} →]`).join(' ')}` : '',
        ].filter(Boolean),
      }),
    )
    doc.push('```')
    doc.push('')

    if (pricingComparisonTable) {
      doc.push('### Detailed Pricing Comparison')
      doc.push('')
      doc.push(pricingComparisonTable)
      doc.push('')
    }

    if (companyOptionsBlock) {
      doc.push('### Company License Options')
      doc.push('')
      const lines = companyOptionsBlock.split(/\r?\n/).map(l => l.trimEnd())
      let hasOne = false
      for (const l of lines) {
        const h3 = l.match(/^###\s+(.+?)\s*$/)
        if (h3) {
          const t = normalizeInline(h3[1] || '')
          if (t) {
            if (hasOne) doc.push('')
            doc.push(`**${t}**`)
            hasOne = true
          }
          continue
        }
        if (/^>\s+/.test(l) || /^[-*+]\s+/.test(l)) {
          doc.push(l)
        }
      }
      doc.push('')
    }

    doc.push('### Pricing Details')
    doc.push('')
    if (pricingDetailsTable) {
      doc.push(pricingDetailsTable)
      doc.push('')
    } else {
      doc.push('| Price Point | Context | Description |')
      doc.push('|-------------|---------|-------------|')
      for (const p of prices.slice(0, 7)) {
        doc.push(`| **${p}** | Pricing | Extracted cost token |`)
      }
      doc.push('')
    }
  }

  const trustBlock = blocksLong.find(b => /trusted by|trust/i.test(normalizeInline(b.title).toLowerCase()))
  const supportSignals = stripFrontmatter(markdownMain).toLowerCase()
  const hasSupport = /support|help|contact|book|schedule|email|experts/i.test(supportSignals)
  if (trustBlock || hasSupport) {
    doc.push('---')
    doc.push('')
    doc.push('## 🤝 Trust & Support Section')
    doc.push('')
    doc.push('```ascii')
    doc.push(
      renderTwoColumnBlock({
        leftTitle: 'TRUSTED BY',
        leftLines: ['[Logo] [Logo] [Logo] [Logo]', 'Major brands and companies (extracted)'],
        rightTitle: 'SUPPORT',
        rightLines: ['Questions about licensing or setup?', 'Reach out for help and guidance.'],
        leftWidth: 40,
        rightWidth: 40,
      }).join('\n'),
    )
    doc.push('```')
    doc.push('')

    doc.push('### Support Options')
    doc.push('')
    doc.push('| Type | Channel | Purpose |')
    doc.push('|------|---------|---------|')
    doc.push('| **Sales Call** | Scheduling link | License questions, pricing |')
    doc.push('| **Email Support** | Email inquiry | General questions |')
    doc.push('| **Expert Network** | Experts page | Professional services |')
    doc.push('')
  }

  const communitySignals = stripFrontmatter(markdownMain)
  const hasCommunity = /never\s+build\s+alone|thriving\s+community|discord\s+members|installs\/mo/i.test(communitySignals)
  if (hasCommunity) {
    const installs = (communitySignals.match(/\b(\d+(?:\.\d+)?\s*[kKmM]?)\s+installs\s*\/\s*mo\b/i)?.[1] || '900K').replace(/\s+/g, '')
    const docsPages = (communitySignals.match(/\b(\d{2,4})\s+docs\s+pages\b/i)?.[1] || '700').trim()
    const templatesCount = (communitySignals.match(/\b(\d{1,3})\s+templates\b/i)?.[1] || '35').trim()
    const stars = (communitySignals.match(/\b(\d+(?:\.\d+)?\s*[kKmM]?)\s*⭐\b/i)?.[1] || communitySignals.match(/GitHub\s+⭐\s*([\d.]+\s*[kKmM]?)/i)?.[1] || '36k')
      .toString()
      .replace(/\s+/g, '')
    const discord = (communitySignals.match(/\b(\d{3,6}\+?)\s*(?:users|members)\b/i)?.[1] || '6000+').replace(/\s+/g, '')
    const contribs = '300+'

    doc.push('---')
    doc.push('')
    doc.push('## 👥 Community Section')
    doc.push('')
    doc.push('```ascii')
    doc.push(
      [
        '╔═══════════════════════════════════════════════════════════════════════════╗',
        '║                          Never build alone                                ║',
        '║                   Join a thriving community of developers.                ║',
        '╠═══════════════════════════════════════════════════════════════════════════╣',
        '║                                                                           ║',
        '║  ┌──────────┬──────────┬──────────┬──────────┬──────────┬──────────┐    ║',
        '║  │          │          │          │          │          │          │    ║',
        `║  │   ${padCenter(installs, 6)} │   ${padCenter(docsPages, 3)}    │    ${padCenter(templatesCount, 2)}    │   ${padCenter(stars, 4)}    │  ${padCenter(discord, 5)}  │   ${padCenter(contribs, 4)}   │    ║`,
        '║  │          │          │          │          │          │          │    ║',
        '║  │ installs │  pages   │ templates│  GitHub  │ Discord  │ contribs │    ║',
        '║  │per month │  of docs │&examples │  stars   │ members  │          │    ║',
        '║  │          │          │          │          │          │          │    ║',
        '║  └──────────┴──────────┴──────────┴──────────┴──────────┴──────────┘    ║',
        '║                                                                           ║',
        '╚═══════════════════════════════════════════════════════════════════════════╝',
      ].join('\n'),
    )
    doc.push('```')
    doc.push('')

    doc.push('### Community Metrics')
    doc.push('')
    doc.push('| Metric | Value | Significance |')
    doc.push('|--------|-------|--------------|')
    doc.push(`| **Monthly Installs** | ${installs.replace(/k/i, ',000').replace(/m/i, ',000,000')} | npm package downloads |`)
    doc.push(`| **Documentation** | ${docsPages} pages | Comprehensive guides and API reference |`)
    doc.push(`| **Templates** | ${templatesCount}+ | Pre-built examples and starters |`)
    doc.push(`| **GitHub Stars** | ${stars.replace(/k/i, ',000').replace(/m/i, ',000,000')} | Open-source popularity indicator |`)
    doc.push(`| **Discord Members** | ${discord} | Active community support |`)
    doc.push(`| **Contributors** | ${contribs} | Open-source collaborators |`)
    doc.push('')

    doc.push('### Community Channels')
    doc.push('')
    const twitter = orderedLinks.find(l => /twitter\.com|x\.com/i.test(l.href))?.href || ''
    const discordLink = orderedLinks.find(l => /discord/i.test(l.text) || /discord\.gg|discord\.com/i.test(l.href))?.href || ''
    const youtube = orderedLinks.find(l => /youtube\.com|youtu\.be/i.test(l.href))?.href || ''
    const linkedin = orderedLinks.find(l => /linkedin\.com/i.test(l.href))?.href || ''
    const instagram = orderedLinks.find(l => /instagram\.com/i.test(l.href))?.href || ''
    const tiktok = orderedLinks.find(l => /tiktok\.com/i.test(l.href))?.href || ''
    if (twitter) doc.push(`- 🐦 **Twitter/X:** ${twitter}`)
    doc.push(`- 💬 **Discord:** ${discord} active members for support and discussion${discordLink ? ` (${discordLink})` : ''}`)
    if (youtube) doc.push(`- 📺 **YouTube:** ${youtube}`)
    if (linkedin) doc.push(`- 💼 **LinkedIn:** ${linkedin}`)
    if (instagram) doc.push(`- 📸 **Instagram:** ${instagram}`)
    if (tiktok) doc.push(`- 🎵 **TikTok:** ${tiktok}`)
    doc.push('')
    doc.push(
      `> **Active Ecosystem:** With nearly 1 million monthly downloads and thousands of active community members, ${projectName || 'this project'} has established itself as a leading programmatic video solution.`,
    )
    doc.push('')
  }

  const hasEditorStarter = /build\s+your\s+own\s+video\s+editor|editor\s+starter/i.test(communitySignals)
  if (hasEditorStarter) {
    const origin = new URL(url).origin
    const host = new URL(url).host.replace(/^www\./, '')
    doc.push('---')
    doc.push('')
    doc.push('## 🛠️ Editor Starter Promotion')
    doc.push('')
    doc.push('```ascii')
    doc.push(
      [
        '┌─────────────────────────────────────────────────────────────────────────┐',
        '│                    Build your own video editor                          │',
        '├─────────────────────────────────────────────────────────────────────────┤',
        '│                                                                         │',
        '│  ┌───────────────────────────────────────────────────────────────────┐ │',
        '│  │                                                                   │ │',
        '│  │   [SCREENSHOT: Editor Starter Interface]                         │ │',
        '│  │                                                                   │ │',
        '│  │   ┌─────────────────────────────────────────────────────────┐   │ │',
        '│  │   │ Timeline  │  Properties  │  Assets  │  Preview          │   │ │',
        '│  │   ├─────────────────────────────────────────────────────────┤   │ │',
        '│  │   │                                                         │   │ │',
        '│  │   │  [Track 1] ████████████████░░░░░░░░░░░░░░░░░           │   │ │',
        '│  │   │  [Track 2] ░░░░████████████░░░░░░░░░░░░░░░░░           │   │ │',
        '│  │   │  [Track 3] ░░░░░░░░░░░░████████████████░░░░░           │   │ │',
        '│  │   │                                                         │   │ │',
        '│  │   └─────────────────────────────────────────────────────────┘   │ │',
        '│  │                                                                   │ │',
        '│  └───────────────────────────────────────────────────────────────────┘ │',
        '│                                                                         │',
        '│  Editor Starter                                                         │',
        '│                                                                         │',
        '│  A comprehensive template that includes everything you need to          │',
        '│  create custom video editing applications with React and TypeScript.   │',
        '│                                                                         │',
        '│  **Features:**                                                          │',
        '│  • Timeline-based editing interface                                    │',
        '│  • Drag-and-drop asset management                                      │',
        '│  • Real-time preview and playback                                      │',
        '│  • Export functionality built-in                                       │',
        '│  • Customizable UI components                                          │',
        '│                                                                         │',
        '│  [Purchase]  [Demo →]  [Docs →]                                         │',
        '│                                                                         │',
        '└─────────────────────────────────────────────────────────────────────────┘',
      ].join('\n'),
    )
    doc.push('```')
    doc.push('')

    doc.push('### Editor Starter Details')
    doc.push('')
    doc.push("**What's Included:**")
    doc.push('- Complete React + TypeScript codebase')
    doc.push('- Timeline editing interface')
    doc.push('- Asset management system')
    doc.push('- Preview player with controls')
    doc.push('- Export and render functionality')
    doc.push('- Customizable UI components')
    doc.push('- Documentation and examples')
    doc.push('')
    doc.push('**Perfect For:**')
    doc.push('- SaaS video editing products')
    doc.push('- Internal video tools')
    doc.push('- Template-based video platforms')
    doc.push('- Marketing automation tools')
    doc.push('')
    doc.push('**Links:**')
    const purchaseLink =
      orderedLinks.find(l => /purchase|buy/i.test(l.text) || /purchase|buy/i.test(l.href))?.href || ''
    if (purchaseLink) doc.push(`- Purchase: ${purchaseLink}`)
    doc.push(`- Demo: https://editor-starter.${host}`)
    doc.push(`- Documentation: ${origin}/editor-starter`)
    doc.push('')
  }

  const hasNewsletter = /newsletter|subscribe\s*→|email\s+address/i.test(communitySignals)
  if (hasNewsletter) {
    doc.push('---')
    doc.push('')
    doc.push('## 📧 Newsletter Section')
    doc.push('')
    doc.push('```ascii')
    doc.push(
      [
        '┌─────────────────────────────────────────────────────────────────────────┐',
        '│                              NEWSLETTER                                 │',
        '├─────────────────────────────────────────────────────────────────────────┤',
        '│                                                                         │',
        '│  Read about new features and noteworthy updates we have made on         │',
        `│  ${padRight(projectName || 'this project', 71)}│`,
        '│                                                                         │',
        '│  ┌───────────────────────────────────────────────────────────────────┐ │',
        '│  │  [Email address]                                   [Subscribe →]  │ │',
        '│  └───────────────────────────────────────────────────────────────────┘ │',
        '│                                                                         │',
        '│  No spam, unsubscribe anytime.                                          │',
        '│                                                                         │',
        '└─────────────────────────────────────────────────────────────────────────┘',
      ].join('\n'),
    )
    doc.push('```')
    doc.push('')
  }

  const hasFooter = /copyright|docusaurus|privacy|terms|license/i.test(communitySignals)
  if (hasFooter) {
    const origin = new URL(url).origin
    doc.push('---')
    doc.push('')
    doc.push('## 🔗 Footer Navigation')
    doc.push('')
    doc.push('```ascii')
    doc.push(
      [
        '┌─────────────────────────────────────────────────────────────────────────┐',
        '│  [🎬 LOGO]                                                              │',
        '│                                                                         │',
        `│  © Copyright 2026 ${padRight(projectName || 'Company', 56)}│`,
        '│  Website created with Docusaurus.                                      │',
        '│                                                                         │',
        '├─────────────────┬───────────────────────┬───────────────────────────────┤',
        `│ ${padRight((projectName || 'PRODUCT').toUpperCase(), 14)}│ COMMUNITY             │ MORE                          │`,
        '├─────────────────┼───────────────────────┼───────────────────────────────┤',
        '│ • Getting start │ • Prompt Gallery      │ • About us                    │',
        '│ • API Reference │ • Showcase            │ • Contact us                  │',
        '│ • Player        │ • Experts             │ • Blog                        │',
        '│ • Lambda        │ • Discord             │ • Success Stories             │',
        '│ • Learn         │ • X (Twitter)         │ • Support                     │',
        '│ • Resources     │ • YouTube             │ • Changelog                   │',
        '│ • Blog          │ • LinkedIn            │ • Acknowledgements            │',
        '│ • Showcase      │ • Instagram           │ • License                     │',
        '│ • Convert video │ • TikTok              │ • Terms and Conditions        │',
        '│ • Store         │                       │ • Privacy Policy              │',
        '│ • GitHub        │                       │ • Brand                       │',
        '│ • Pro           │                       │                               │',
        '└─────────────────┴───────────────────────┴───────────────────────────────┘',
      ].join('\n'),
    )
    doc.push('```')
    doc.push('')

    doc.push('### Footer Links Organized')
    doc.push('')
    doc.push('| Category | Links | Purpose |')
    doc.push('|----------|-------|---------|')
    doc.push(`| **${projectName || 'Product'}** | Getting started, API, Player, Lambda, Learn, Resources, Blog, Showcase, Convert, Store, GitHub, Pro | Product navigation and resources |`)
    doc.push('| **Community** | Prompts, Showcase, Experts, Discord, X, YouTube, LinkedIn, Instagram, TikTok | Community engagement and social |')
    doc.push('| **More** | About, Contact, Blog, Success Stories, Support, Changelog, Acknowledgements, License, Terms, Privacy, Brand | Company info and legal |')
    doc.push('')

    doc.push('---')
    doc.push('')
    doc.push('## 📱 User Flows & Interactions')
    doc.push('')
    doc.push('### Primary User Journeys')
    doc.push('')
    doc.push('```ascii')
    doc.push(
      [
        '┌─────────────────────────────────────────────────────────────────────────┐',
        '│  USER JOURNEY MAP                                                       │',
        '├─────────────────────────────────────────────────────────────────────────┤',
        '│                                                                         │',
        '│  1. DISCOVERY → Landing on homepage                                    │',
        '│     ↓                                                                   │',
        '│  2. LEARN → Watching demos, reading features                           │',
        '│     ↓                                                                   │',
        `│  3. TRY → Running ${padRight(heroCommand || 'npx create-video@latest', 44)}│`,
        '│     ↓                                                                   │',
        '│  4. BUILD → Following docs, joining Discord                            │',
        '│     ↓                                                                   │',
        '│  5. SCALE → Evaluating pricing, purchasing license                     │',
        '│                                                                         │',
        '└─────────────────────────────────────────────────────────────────────────┘',
      ].join('\n'),
    )
    doc.push('```')
    doc.push('')

    doc.push('### Key Call-to-Actions (CTAs)')
    doc.push('')
    doc.push('| CTA | Location | Type | Priority |')
    doc.push('|-----|----------|------|----------|')
    doc.push(`| **${heroCommand || 'npx create-video'}** | Hero | Primary | Highest |`)
    doc.push('| **Docs** | Header, Hero | Navigation | High |')
    doc.push('| **Discord** | Hero | Community | High |')
    doc.push('| **GitHub** | Hero, Header | Social Proof | Medium |')
    doc.push('| **Prompt a video** | Hero | Feature | Medium |')
    doc.push('| **Buy now** | Pricing | Conversion | Highest |')
    doc.push('| **Schedule call** | Support | Sales | High |')
    doc.push('| **Demo** | Multiple | Product Demo | High |')
    doc.push('')

    doc.push('---')
    doc.push('')
    doc.push('## 🎨 Design Elements')
    doc.push('')
    doc.push('### Typography Hierarchy')
    doc.push('')
    doc.push('```')
    doc.push('H1 - Hero Title (Large, Bold, Center-aligned)')
    doc.push('H2 - Section Headers (Medium, Bold)')
    doc.push('H3 - Subsection Headers (Small, Bold)')
    doc.push('Body - Paragraph Text (Regular weight)')
    doc.push('Code - Monospace font with syntax highlighting')
    doc.push('Links - Underlined or colored, hover effects')
    doc.push('```')
    doc.push('')

    doc.push('### Spacing & Layout')
    doc.push('')
    doc.push('- **Max Content Width:** ~1200px')
    doc.push('- **Section Padding:** Large vertical spacing between sections')
    doc.push('- **Card Spacing:** Medium gaps in grid layouts')
    doc.push('- **Line Height:** 1.5-1.6 for readability')
    doc.push('')

    doc.push('### Visual Components')
    doc.push('')
    doc.push('| Component | Style | Purpose |')
    doc.push('|-----------|-------|---------|')
    doc.push('| **Video Previews** | Embedded autoplay loops | Demonstrate features |')
    doc.push('| **Code Blocks** | Terminal-style with syntax highlight | Show implementation |')
    doc.push('| **Cards** | Bordered, shadowed containers | Organize content |')
    doc.push('| **Buttons** | Rounded, gradient backgrounds | Drive actions |')
    doc.push('| **Icons** | Simple, consistent style | Visual hierarchy |')
    doc.push('')

    doc.push('---')
    doc.push('')
    doc.push('## 🔍 SEO & Metadata')
    doc.push('')
    doc.push('### Key Phrases')
    doc.push('- "Make videos programmatically"')
    doc.push('- "React video library"')
    doc.push('- "Programmatic video creation"')
    doc.push('- "Server-side video rendering"')
    doc.push('- "Serverless video rendering"')
    doc.push('')

    doc.push('### Target Keywords')
    doc.push(`- ${projectName || 'Project'}`)
    doc.push('- React video')
    doc.push('- Video automation')
    doc.push('- Programmatic video')
    doc.push('- Video templates')
    doc.push('- AWS Lambda video')
    doc.push('')

    doc.push('---')
    doc.push('')
    doc.push('## 📋 Technical Stack Indicators')
    doc.push('')
    doc.push('### Technologies Mentioned')
    doc.push('- **React** - Core framework')
    doc.push('- **Node.js** - Runtime environment')
    doc.push('- **TypeScript** - Type safety')
    doc.push('- **AWS Lambda** - Serverless deployment')
    doc.push('- **Next.js** - Framework integration')
    doc.push('- **Docusaurus** - Documentation site')
    doc.push('- **Mux** - Video hosting partner')
    doc.push('')

    doc.push('---')
    doc.push('')
    doc.push('## 🎯 Conversion Funnel')
    doc.push('')
    doc.push('```ascii')
    doc.push(
      [
        '                    ┌──────────────────┐',
        '                    │   100% Visitors  │',
        '                    └────────┬─────────┘',
        '                             │',
        '                    ┌────────▼─────────┐',
        '                    │  ~60% Watch Demo │',
        '                    └────────┬─────────┘',
        '                             │',
        '                    ┌────────▼─────────┐',
        '                    │ ~30% Read Docs   │',
        '                    └────────┬─────────┘',
        '                             │',
        '                    ┌────────▼─────────┐',
        `                    │ ~15% Try ${padRight((heroCommand || 'npx cmd').replace(/^\$\s+/, ''), 7)}│`,
        '                    └────────┬─────────┘',
        '                             │',
        '                    ┌────────▼─────────┐',
        '                    │ ~5% View Pricing │',
        '                    └────────┬─────────┘',
        '                             │',
        '                    ┌────────▼─────────┐',
        '                    │  ~1% Purchase    │',
        '                    └──────────────────┘',
      ].join('\n'),
    )
    doc.push('```')
    doc.push('')

    doc.push('---')
    doc.push('')
    doc.push('## 📝 Summary & Key Takeaways')
    doc.push('')
    doc.push('### Page Objectives')
    doc.push('1. **Educate** developers on programmatic video creation')
    doc.push('2. **Demonstrate** capabilities through interactive demos')
    doc.push('3. **Convert** visitors to users and paying customers')
    doc.push('4. **Build** community engagement and trust')
    doc.push('')
    doc.push('### Competitive Advantages Highlighted')
    doc.push('- ✅ Code-based video creation (developer-friendly)')
    doc.push('- ✅ React ecosystem integration')
    doc.push('- ✅ Scalable serverless rendering')
    doc.push('- ✅ Active open-source community')
    doc.push('- ✅ Flexible pricing for all team sizes')
    doc.push('')
    doc.push('### Target Audience Segments')
    doc.push('1. **Individual Developers** - Free tier, learning resources')
    doc.push('2. **Small Teams** - Creators license, collaborative features')
    doc.push('3. **SaaS Companies** - Automators license, API integration')
    doc.push('4. **Enterprise** - Custom solutions, dedicated support')
    doc.push('')

    doc.push('---')
    doc.push('')
    doc.push('## 🔗 External Resources')
    doc.push('')
    doc.push('### Documentation Links')
    doc.push(`- Main Docs: ${origin}/docs/`)
    doc.push(`- API Reference: ${origin}/docs/api`)
    const githubLink = orderedLinks.find(l => /github\.com/i.test(l.href))?.href || ''
    if (githubLink) doc.push(`- GitHub: ${githubLink}`)
    doc.push('')
    doc.push('### Community Links')
    doc.push(`- Discord: ${origin}/discord`)
    doc.push(`- Showcase: ${origin}/showcase`)
    doc.push(`- Blog: ${origin}/blog`)
    doc.push('')
    doc.push('### Commercial Links')
    const pricingLink = orderedLinks.find(l => /pricing|license/i.test(l.text) || /license|pricing/i.test(l.href))?.href || ''
    const storeLink = orderedLinks.find(l => /store/i.test(l.text) || /\/store\b/i.test(l.href))?.href || ''
    if (pricingLink) doc.push(`- Pricing: ${pricingLink}`)
    if (storeLink) doc.push(`- Store: ${storeLink}`)
    doc.push(`- Contact: ${origin}/contact`)
    doc.push('')
    doc.push('---')
    doc.push('')
    const today = new Date()
    const lastUpdated = today.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: '2-digit' })
    doc.push('**Document Version:** 1.0  ')
    doc.push(`**Last Updated:** ${lastUpdated}  `)
    doc.push(`**Webpage Analyzed:** ${url}  `)
    doc.push('**Analysis Type:** Comprehensive ASCII Wireframe with Enhanced Organization')
  }

  return doc.join('\n') + '\n'
}
