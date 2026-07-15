import { classifyLinkLabel, summarizeCategorizedSignalsFromMarkdown } from './signalTokens'
import { buildLayoutStructureAscii, centerLine, renderAsciiFrame, renderDoubleLineFrame, renderTemplateGalleryGrid } from './webpageMarkdownArtifactAscii'
import {
  countMatches,
  countSectionParagraphs,
  countUniqueMarkdownLinkTexts,
  extractBlockUnderH2,
  extractHSections,
  extractHeadings,
  extractMarkdownLinks,
  extractMarkdownLinkTexts,
  extractMarkdownTableUnderH2,
  extractTemplates,
  findFirstInlineCommand,
  inferPageOverviewSentence,
  normalizeInline,
  parseExtractedNavMenus,
  stripFrontmatter,
  stripTrailingPunctuation,
  stripWww,
  truncate,
} from './webpageMarkdownArtifactUtils'
import { serializeMarkdownPipeTable } from '@/features/markdown/ui/markdownDataViewSerialize'

export function buildWebpageMarkdownArtifactFromMarkdown(args: {
  markdown: string
  url: string
  title?: string
  fidelityMaxLevel?: number
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
  const markdownMain = markdown
  const headings = extractHeadings(markdownMain, 24)
  const firstH1 = headings.find(h => h.level === 1)?.title || ''
  const firstH2 = headings.find(h => h.level === 2)?.title || ''

  const pageTitleRaw = normalizeInline(args.title || '') || firstH1 || firstH2 || host || 'Untitled'
  const pageTitle = truncate(stripTrailingPunctuation(pageTitleRaw), 84)
  const overview = (() => {
    const raw = String(inferPageOverviewSentence(markdownMain, 240) || '').trim()
    if (!raw) return ''
    if (raw.length < 12) return ''
    if (/^(?:[\s().,:;–—-]|\[|\])+$/.test(raw)) return ''
    return raw
  })()

  const stats = (() => {
    const body = stripFrontmatter(markdownMain)
    const paragraphs = countSectionParagraphs(body)
    const listItems = countMatches(/^\s{0,3}([-*+]|\d+\.)\s+/gm, body)
    const links = countUniqueMarkdownLinkTexts(body)
    const mediaFiles = countMatches(/\b[\w-]+\.(?:webm|mp4|mov)\b/gi, body)
    const interactiveUi = (() => {
      const lower = body.toLowerCase()
      let n = 0
      if (lower.includes('drag') && lower.includes('drop')) n += 1
      if (lower.includes('dark mode') || lower.includes('theme') || lower.includes('toggle')) n += 1
      if (lower.includes('export')) n += 1
      return n
    })()
    const timecodes = countMatches(/\b\d{1,2}:\d{2}\b/g, body)
    const pricingTokens = countMatches(/\$\s?\d{1,3}(?:,\d{3})*(?:\.\d+)?/g, body)
    return { paragraphs, listItems, links, mediaFiles, interactiveUi, timecodes, pricingTokens }
  })()

  const signals = summarizeCategorizedSignalsFromMarkdown(markdownMain, { maxLines: 8000, maxPerKind: 12 })
  const navLabels = signals.nav.map(x => x.label.replace(/^\[NAV\]\s*/i, '')).filter(Boolean)
  const ctaLabels = signals.cta.map(x => x.label.replace(/^\[CTA\]\s*/i, '')).filter(Boolean)
  const layoutAscii = buildLayoutStructureAscii({ navLabels, ctaLabels })

  const navMenus = parseExtractedNavMenus(markdownMain)
  const heroCommand = findFirstInlineCommand(markdownMain)
  const heroRegion = (() => {
    const lines = stripFrontmatter(markdownMain).split(/\r?\n/)
    const firstH2Idx = lines.findIndex(l => /^##\s+/.test(String(l || '')))
    const end = firstH2Idx > 0 ? firstH2Idx : Math.min(lines.length, 120)
    return lines.slice(0, end).join('\n')
  })()
  const heroLinks = extractMarkdownLinkTexts(heroRegion, 16)
  const heroCtas = (() => {
    const dedup: string[] = []
    for (const t of heroLinks) {
      if (!t) continue
      if (dedup.some(x => x.toLowerCase() === t.toLowerCase())) continue
      dedup.push(t)
    }
    const rank = (t: string): number => {
      const k = classifyLinkLabel(t)
      return k === 'cta' ? 0 : k === 'nav' ? 1 : 2
    }
    const ranked = dedup
      .map((t, idx) => ({ t, idx, r: rank(t) }))
      .sort((a, b) => a.r - b.r || a.idx - b.idx)
      .map(x => x.t)
    return ranked.slice(0, 4)
  })()

  const templates = extractTemplates(markdownMain)
  const pricingComparisonTable = extractMarkdownTableUnderH2(markdownMain, 'Pricing Comparison (Extracted)')
  const pricingDetailsTable = extractMarkdownTableUnderH2(markdownMain, 'Pricing Details (Extracted)')
  const companyOptionsBlock = extractBlockUnderH2(markdownMain, 'Company License Options (Extracted)', 140)
  const renderingOptionsTable = extractMarkdownTableUnderH2(markdownMain, 'Rendering Options (Extracted)')
  const pricingBlockRaw = extractBlockUnderH2(markdownMain, 'Pricing', 240)

  const blocks = extractHSections(markdownMain, 120)
  const featureBlocks = (() => {
    const candidates = blocks
      .filter(b => b.level === 2)
      .filter(b => !/templates/i.test(b.title))
      .filter(b => !/pricing/i.test(b.title))
      .filter(b => !/trusted by/i.test(b.title))
      .filter(b => !/use cases?/i.test(b.title))
      .map(b => {
        const body = String(b.body || '')
        const score = Math.min(4000, body.length) + countUniqueMarkdownLinkTexts(body) * 24 + countSectionParagraphs(body) * 18
        return { b, score }
      })
    candidates.sort((a, b) => b.score - a.score || a.b.title.localeCompare(b.b.title))
    return candidates.slice(0, 3).map(x => x.b)
  })()

  const inferPlatform = () => {
    if (Object.keys(navMenus).length > 0) return 'Web application'
    if (stats.interactiveUi > 0) return 'Web application'
    if (stats.links > 30 && stats.listItems > 20) return 'Website'
    return 'Webpage'
  }

  const inferFidelityLevel = () => {
    let level = 1
    const h2Count = headings.filter(h => h.level === 2).length
    if (h2Count >= 6 || stats.links >= 20) level = Math.max(level, 2)
    if (navLabels.length >= 4 || ctaLabels.length >= 2 || !!overview) level = Math.max(level, 3)
    if (Object.keys(navMenus).length > 0 || templates.length >= 6 || stats.pricingTokens > 0) level = Math.max(level, 4)
    return level
  }

  const fidelityMaxLevel = (() => {
    const n = Number.isFinite(args.fidelityMaxLevel) ? Math.floor(Number(args.fidelityMaxLevel)) : 4
    return n < 1 ? 1 : n > 4 ? 4 : n
  })()
  const fidelityLevel = Math.min(inferFidelityLevel(), fidelityMaxLevel)
  const fidelityLabel = (() => {
    switch (fidelityLevel) {
      case 4:
        return 'Complete UI layouts with box-drawing characters'
      case 3:
        return 'Structured sections with layout frames'
      case 2:
        return 'Section outline with key links'
      default:
        return 'Minimal outline'
    }
  })()
  const fidelityPercent = fidelityLevel === 4 ? 100 : fidelityLevel === 3 ? 75 : fidelityLevel === 2 ? 50 : 25

  const scrapedDate = (() => {
    const d = new Date()
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000)
    return local.toISOString().slice(0, 10)
  })()
  const platform = (() => {
    const p = inferPlatform()
    if (p === 'Web application') return 'Custom Web Application'
    return p
  })()

  const skipLink = (() => {
    const body = stripFrontmatter(markdownMain)

    const toHashHref = (href: string) => {
      const h = String(href || '').trim()
      if (!h) return ''
      if (h.startsWith('#')) return h
      try {
        const u = new URL(h, url)
        const base = new URL(url)
        if (u.host !== base.host) return ''
        return u.hash || ''
      } catch {
        return ''
      }
    }

    for (const m of body.matchAll(/\[\s*([\s\S]{0,160}?)\s*\]\(([^)]+)\)/g)) {
      const idx = m.index ?? -1
      if (idx > 0 && body.charCodeAt(idx - 1) === 33) continue
      const text = String(m[1] || '').replace(/\s+/g, ' ').trim()
      const href = String(m[2] || '').trim()
      if (!/\bskip\b/i.test(text)) continue
      const hashHref = toHashHref(href)
      if (!hashHref) continue
      return { text, href: hashHref }
    }

    const links = extractMarkdownLinks(body, 200)
    for (const l of links) {
      const text = l.text.toLowerCase()
      const hashHref = toHashHref(String(l.href || ''))
      if (!hashHref) continue
      if (!/\bskip\b/.test(text)) continue
      return { text: l.text, href: hashHref }
    }

    return null
  })()

  const assets = (() => {
    const body = stripFrontmatter(markdownMain)
    const images: string[] = []
    const imageRe = /!\[[^\]]*\]\(([^)]+)\)/g
    let m: RegExpExecArray | null
    while ((m = imageRe.exec(body))) {
      const href = normalizeInline(m[1] || '')
      if (!href) continue
      if (images.includes(href)) continue
      images.push(href)
      if (images.length >= 40) break
    }

    const videos: string[] = []
    for (const match of body.matchAll(/\b[\w-]+\.(?:webm|mp4|mov)\b/gi)) {
      const t = String(match[0] || '')
      if (!t) continue
      if (videos.includes(t)) continue
      videos.push(t)
      if (videos.length >= 40) break
    }

    const hrefs = extractMarkdownLinks(body, 800)
    const externalDomains: string[] = []
    const sampleLinks: Array<{ text: string; href: string }> = []
    for (const l of hrefs) {
      const href = String(l.href || '')
      const text = l.text
      if (!href) continue
      if (href.startsWith('#')) continue
      if (href.startsWith('mailto:') || href.startsWith('tel:')) continue
      sampleLinks.push({ text, href })
      if (sampleLinks.length >= 24) break
    }
    for (const l of hrefs) {
      const href = String(l.href || '')
      if (!/^https?:\/\//i.test(href)) continue
      try {
        const h = new URL(href).host
        const d = stripWww(h)
        if (!d) continue
        if (externalDomains.some(x => x.toLowerCase() === d.toLowerCase())) continue
        externalDomains.push(d)
        if (externalDomains.length >= 18) break
      } catch {
        void 0
      }
    }

    return { images, videos, externalDomains, sampleLinks }
  })()

  const toc: Array<{ title: string; anchor: string }> = []
  toc.push({ title: 'Page Structure Overview', anchor: 'page-structure-overview' })
  toc.push({ title: 'Document Structure', anchor: 'document-structure' })
  if (skipLink) toc.push({ title: 'Accessibility Features', anchor: 'accessibility-features' })
  toc.push({ title: 'Navigation Header', anchor: 'navigation-header' })
  toc.push({ title: 'Hero Section', anchor: 'hero-section' })
  if (templates.length) toc.push({ title: 'Template Gallery', anchor: 'templates' })
  if (stats.pricingTokens > 0 || pricingComparisonTable || pricingDetailsTable) toc.push({ title: 'Pricing', anchor: 'pricing' })
  toc.push({ title: 'Asset Catalog', anchor: 'asset-catalog' })

  type PricingTier = { title: string; audience: string; lines: string[] }

  const extractPricingTiers = (block: string): PricingTier[] => {
    const raw = String(block || '').trimEnd()
    if (!raw) return []
    const lines = raw.split(/\r?\n/).map(l => String(l || '').trim()).filter(Boolean)
    const tiers: PricingTier[] = []
    let pendingAudience = ''
    let current: PricingTier | null = null

    const flush = () => {
      if (!current) return
      const seen = new Set<string>()
      const cleaned = current.lines
        .map(s => normalizeInline(s))
        .filter(Boolean)
        .filter(s => {
          const k = s.toLowerCase()
          if (seen.has(k)) return false
          seen.add(k)
          return true
        })
      tiers.push({
        title: stripTrailingPunctuation(normalizeInline(current.title)),
        audience: stripTrailingPunctuation(normalizeInline(current.audience)),
        lines: cleaned,
      })
      current = null
    }

    const isTierTitle = (s: string): boolean => {
      if (/^(free|company|enterprise)\s+license$/i.test(s)) return true
      if (/^remotion\s+for\s+(creators|automators)$/i.test(s)) return true
      if (/^enterprise\s+license$/i.test(s)) return true
      return false
    }

    for (const l of lines) {
      if (/^for\s+\S/i.test(l) && !current) {
        pendingAudience = normalizeInline(l)
        continue
      }
      if (isTierTitle(l)) {
        flush()
        current = { title: normalizeInline(l), audience: pendingAudience, lines: [] }
        pendingAudience = ''
        continue
      }
      if (!current) continue
      if (/^for\s+\S/i.test(l) && !current.audience) {
        current.audience = normalizeInline(l)
        continue
      }
      const bullet = l.match(/^\s*[-*+]\s+(.+?)\s*$/)
      if (bullet) {
        current.lines.push(`- ${bullet[1] || ''}`)
        continue
      }
      if (/^\[\s*[xX ]\s*\]\s+/.test(l)) {
        current.lines.push(l)
        continue
      }
      if (/\$\s?\d/.test(l) || /per\s+(seat|render|month)/i.test(l)) {
        current.lines.push(l)
        continue
      }
      if (current.lines.length < 8) current.lines.push(l)
    }
    flush()
    return tiers
  }

  const renderPricingTiersMarkdownTable = (tiers: PricingTier[]): string => {
    const wanted = ['free license', 'company license', 'enterprise license']
    const picked = tiers
      .filter(t => wanted.includes(t.title.toLowerCase()))
      .sort((a, b) => wanted.indexOf(a.title.toLowerCase()) - wanted.indexOf(b.title.toLowerCase()))
      .slice(0, 3)

    if (picked.length < 2) return ''
    const cols = 3
    while (picked.length < cols) picked.push({ title: '', audience: '', lines: [] })
    const columns = picked.map(t => t.title || 'Plan')
    const cells = picked.map(t => [t.audience, ...t.lines.slice(0, 7)].filter(Boolean).join(' · '))
    return serializeMarkdownPipeTable({ columns, rows: [cells] }).join('\n')
  }

  const buildPageStructureOverviewAscii = () => {
    const width = 84
    const out: string[] = []
    const navItems = navLabels.length ? navLabels.slice(0, 7) : []
    const navLine = navItems.length ? `  [Logo] ${navItems.map(x => `[${x}]`).join(' ')}` : '  [Logo]'
    out.push(renderAsciiFrame({ title: 'NAVIGATION HEADER', width, lines: [navLine] }))

    const heroLines: string[] = []
    heroLines.push(centerLine(truncate(stripTrailingPunctuation(pageTitle), 72), width - 2))
    if (overview) heroLines.push(centerLine(truncate(overview, 72), width - 2))
    if (heroCtas.length) heroLines.push(centerLine(heroCtas.map(x => `[${x}]`).join(' '), width - 2))
    out.push(renderAsciiFrame({ title: 'HERO SECTION', width, lines: heroLines.filter(Boolean) }))

    if (blocks.some(b => b.level === 2 && /trusted by/i.test(normalizeInline(b.title)))) {
      out.push(renderAsciiFrame({ title: 'TRUSTED BY', width, lines: ['(logos / brand list)'] }))
    }
    out.push(renderAsciiFrame({ title: 'FEATURES', width, lines: ['(sections + cards + tables)'] }))
    if (templates.length) out.push(renderAsciiFrame({ title: 'GALLERY', width, lines: [`(${Math.min(templates.length, 12)} items detected)`] }))
    if (stats.pricingTokens > 0 || pricingComparisonTable || pricingDetailsTable) {
      const prices = signals.price
        .slice(0, 6)
        .map(p => p.label.replace(/^\[PRICE\]\s*/i, ''))
        .filter(Boolean)
      out.push(renderAsciiFrame({ title: 'PRICING', width, lines: [prices.length ? prices.join(' | ') : '(pricing tokens detected)'] }))
    }
    out.push(renderAsciiFrame({ title: 'FOOTER', width, lines: ['(links + metadata)'] }))
    return out.join('\n')
  }

  const doc: string[] = []
  const layoutStructureAscii = layoutAscii.trimEnd()
  const pageStructureOverviewAscii = buildPageStructureOverviewAscii().trimEnd()
  doc.push('')
  doc.push(`# ${pageTitle}`)
  doc.push('')
  doc.push(`**URL:** ${url || host || ''}  `)
  doc.push(`**Scraped:** ${scrapedDate}  `)
  doc.push(`**Platform:** ${platform}  `)
  doc.push(`**Fidelity Level:** ${fidelityLevel} (${fidelityPercent}% - ${fidelityLabel})`)
  doc.push('')
  doc.push('---')
  doc.push('')

  doc.push('## Table of Contents')
  doc.push('')
  doc.push('```ascii')
  doc.push(layoutStructureAscii)
  doc.push('```')
  doc.push('')
  for (let i = 0; i < toc.length; i += 1) {
    const it = toc[i]
    doc.push(`${i + 1}. [${it.title}](#${it.anchor})`)
  }
  doc.push('')
  doc.push('---')
  doc.push('')

  doc.push('<a id="page-structure-overview"></a>')
  doc.push('## Page Structure Overview')
  doc.push('')
  doc.push('```ascii')
  doc.push(pageStructureOverviewAscii)
  doc.push('```')
  doc.push('')
  doc.push('---')
  doc.push('')

  doc.push('<a id="layout-structure"></a>')
  doc.push('## Layout Structure')
  doc.push('')
  doc.push('```ascii')
  doc.push(layoutStructureAscii)
  doc.push('```')
  doc.push('')
  doc.push('---')
  doc.push('')

  doc.push('<a id="document-structure"></a>')
  doc.push('## Document Structure')
  doc.push('')
  doc.push(...serializeMarkdownPipeTable({
    columns: ['Heading', 'Level', 'Notes'],
    rows: headings.slice(0, 18).map(h => [
      truncate(h.title, 72),
      h.level,
      h.level === 1 ? 'Page title' : h.level === 2 ? 'Section' : '',
    ]),
  }))
  doc.push('')
  doc.push('---')
  doc.push('')

  if (skipLink) {
    doc.push('<a id="accessibility-features"></a>')
    doc.push('## Accessibility Features')
    doc.push('')
    doc.push('```ascii')
    doc.push(renderAsciiFrame({ title: 'SKIP NAVIGATION', width: 60, lines: [`[${skipLink.text}] → ${skipLink.href}`] }))
    doc.push('```')
    doc.push('')
    doc.push(`**Purpose:** Keyboard navigation accessibility  `)
    doc.push(`**Target:** \`${skipLink.href}\`  `)
    doc.push(`**Link Text:** ${skipLink.text}`)
    doc.push('')
    doc.push('---')
    doc.push('')
  }

  doc.push('<a id="navigation-header"></a>')
  doc.push('## Navigation Header')
  doc.push('')
  doc.push('```ascii')
  const headerItems = navLabels.length ? navLabels.slice(0, 7) : ['Home', 'About', 'Contact']
  doc.push(renderAsciiFrame({ title: 'PRIMARY NAV', width: 84, lines: [`  [Logo] ${headerItems.map(x => `[${x}]`).join(' ')}`] }))
  doc.push('```')
  doc.push('')
  doc.push(...serializeMarkdownPipeTable({
    columns: ['Token', 'Count', 'Sample'],
    alignments: [null, 'right', null],
    rows: [
      ['[NAV]', signals.nav.length, signals.nav.slice(0, 5).map(x => x.label.replace(/^\[NAV\]\s*/i, '')).join(', ') || '(not detected)'],
      ['[CTA]', signals.cta.length, signals.cta.slice(0, 5).map(x => x.label.replace(/^\[CTA\]\s*/i, '')).join(', ') || '(not detected)'],
    ],
  }))
  doc.push('')

  doc.push('### Navigation Menu Structure')
  doc.push('')
  const menus = Object.keys(navMenus)
  const menuRows = menus.length
    ? menus.map(m => [`**${m}**`, (navMenus[m] || []).slice(0, 10).join(', ') || '(not detected)', 'Dropdown'])
    : headerItems.slice(0, 6).map(h => [`**${h}**`, '(not detected)', 'Direct navigation'])
  doc.push(...serializeMarkdownPipeTable({ columns: ['Menu', 'Items', 'Type'], rows: menuRows }))
  doc.push('')
  doc.push('---')
  doc.push('')

  doc.push('<a id="hero-section"></a>')
  doc.push('## Hero Section')
  doc.push('')
  doc.push('```ascii')
  doc.push(
    renderDoubleLineFrame({
      width: 83,
      lines: [
        centerLine(truncate(stripTrailingPunctuation(pageTitle), 72), 81),
        overview ? centerLine(truncate(overview, 76), 81) : '',
        heroCommand ? centerLine(truncate(heroCommand, 48), 81) : '',
        heroCtas.length ? centerLine(heroCtas.map(x => `[${x}]`).join('  '), 81) : '',
      ].filter(Boolean),
    }),
  )
  doc.push('```')
  doc.push('')
  doc.push(...serializeMarkdownPipeTable({
    columns: ['Element', 'Value'],
    rows: [
      ['Title', stripTrailingPunctuation(pageTitle)],
      ['Summary', overview || '(not detected)'],
      ['Primary CTAs', heroCtas.length ? heroCtas.map(x => `**${x}**`).join(', ') : '(not detected)'],
    ],
  }))
  doc.push('')
  doc.push('---')
  doc.push('')

  doc.push('## Page Statistics')
  doc.push('')
  doc.push(...serializeMarkdownPipeTable({
    columns: ['Metric', 'Count'],
    alignments: [null, 'right'],
    rows: [
      ['Paragraphs', stats.paragraphs],
      ['List items', stats.listItems],
      ['Unique links (by text)', stats.links],
      ['Media files (video)', Math.max(0, stats.mediaFiles)],
      ['Interactive cues', stats.interactiveUi],
      ['Time tokens', stats.timecodes],
      ['Price tokens', stats.pricingTokens],
    ],
  }))
  doc.push('')

  if (featureBlocks.length && fidelityLevel >= 3) {
    let idx = 1
    for (const b of featureBlocks) {
      doc.push('---')
      doc.push('')
      doc.push(`## Section ${idx}: ${truncate(normalizeInline(b.title), 72)}`)
      doc.push('')
      doc.push('```ascii')
      doc.push(
        renderAsciiFrame({
          title: 'SECTION SUMMARY',
          width: 84,
          lines: [truncate(inferPageOverviewSentence(b.body, 92) || '(summary not detected)', 92)],
        }),
      )
      doc.push('```')
      doc.push('')
      const body = String(b.body || '')
      const paras = countSectionParagraphs(body)
      const linkCount = countUniqueMarkdownLinkTexts(body)
      const media = countMatches(/\b[\w-]+\.(?:webm|mp4|mov)\b/gi, body)
      doc.push(`- **Paragraphs:** ${paras}`)
      doc.push(`- **Links:** ${linkCount}`)
      doc.push(`- **Media:** ${Math.max(0, media)} video${Math.max(0, media) === 1 ? '' : 's'}`)
      doc.push('')
      idx += 1
    }
  }

  if (templates.length && fidelityLevel >= 3) {
    const templateGridAscii = renderTemplateGalleryGrid(templates)
    doc.push('---')
    doc.push('')
    doc.push('<a id="templates"></a>')
    doc.push('## Template Gallery')
    doc.push('')
    doc.push('```ascii')
    doc.push(templateGridAscii)
    doc.push('```')
    doc.push('')
    doc.push('### Available Templates')
    doc.push('')
    for (const t of templates.slice(0, 12)) doc.push(`- ${t}`)
    doc.push('')
  }

  if (stats.pricingTokens > 0 || pricingComparisonTable || pricingDetailsTable) {
    doc.push('---')
    doc.push('')
    doc.push('<a id="pricing"></a>')
  doc.push('## Pricing')
    doc.push('')
    const pricingTiers = fidelityLevel >= 4 ? extractPricingTiers(pricingBlockRaw) : []
    const pricingTiersTable = pricingTiers.length ? renderPricingTiersMarkdownTable(pricingTiers) : ''
    doc.push('```ascii')
    doc.push(
      renderDoubleLineFrame({
        width: 83,
        lines: [
          centerLine('PRICING', 81),
          '',
          `  ${signals.price.slice(0, 6).map(p => p.label.replace(/^\[PRICE\]\s*/i, '')).join(' | ') || '(pricing tokens detected)'}`,
        ].filter(Boolean),
      }),
    )
    doc.push('```')
    doc.push('')
    if (pricingTiersTable) {
      doc.push('### Pricing Tiers')
      doc.push('')
      doc.push(pricingTiersTable)
      doc.push('')
    }
    if (pricingComparisonTable) {
      doc.push('### Pricing Comparison (Extracted)')
      doc.push('')
      doc.push(pricingComparisonTable)
      doc.push('')
    }
    if (pricingDetailsTable) {
      doc.push('### Pricing Details (Extracted)')
      doc.push('')
      doc.push(pricingDetailsTable)
      doc.push('')
    }
    if (companyOptionsBlock) {
      doc.push('### Company License Options (Extracted)')
      doc.push('')
      doc.push(companyOptionsBlock)
      doc.push('')
    }
    if (renderingOptionsTable) {
      doc.push('### Rendering Options (Extracted)')
      doc.push('')
      doc.push(renderingOptionsTable)
      doc.push('')
    }
  }

  doc.push('---')
  doc.push('')
  doc.push('<a id="asset-catalog"></a>')
  doc.push('## Asset Catalog')
  doc.push('')
  doc.push(...serializeMarkdownPipeTable({
    columns: ['Kind', 'Count', 'Samples'],
    alignments: [null, 'right', null],
    rows: [
      ['Images', assets.images.length, assets.images.slice(0, 6).join(', ') || '(none detected)'],
      ['Videos', assets.videos.length, assets.videos.slice(0, 6).join(', ') || '(none detected)'],
      ['External domains', assets.externalDomains.length, assets.externalDomains.slice(0, 10).join(', ') || '(none detected)'],
    ],
  }))
  doc.push('')

  if (assets.sampleLinks.length) {
    doc.push('### Sample Links')
    doc.push('')
    doc.push(...serializeMarkdownPipeTable({
      columns: ['Text', 'URL'],
      rows: assets.sampleLinks.slice(0, 12).map(l => [truncate(l.text, 52), truncate(l.href, 90)]),
    }))
    doc.push('')
  }

  doc.push('---')
  doc.push('')
  const sourceBody = (() => {
    const raw = stripFrontmatter(markdownMain).trim()
    if (!raw) return ''
    const marker = '## RAW HTML → MARKDOWN (Full Page Text)'
    const markerIdx = raw.indexOf(marker)
    if (markerIdx >= 0) {
      const after = raw.slice(markerIdx + marker.length).replace(/^\s*\n/, '')
      const cutIdx = after.search(/\n---\n|^##\s+RAW HTML SNAPSHOT/m)
      const sliced = (cutIdx >= 0 ? after.slice(0, cutIdx) : after).trim()
      if (sliced) return sliced
    }
    const domMarker = '## RAW DOM TEXT SNAPSHOT'
    const domIdx = raw.indexOf(domMarker)
    if (domIdx >= 0) {
      const after = raw.slice(domIdx + domMarker.length).replace(/^\s*\n/, '')
      const cutIdx = after.search(/\n---\n|^##\s+/m)
      const sliced = (cutIdx >= 0 ? after.slice(0, cutIdx) : after).trim()
      if (sliced) return sliced
    }
    return raw
  })()
  if (sourceBody) {
    doc.push('## Source-Faithful Full Page Markdown')
    doc.push('')
    doc.push('**Fidelity Level:** 100% Source-Faithful (No Invented Content)')
    doc.push('')
    doc.push(sourceBody)
    doc.push('')
    doc.push('---')
    doc.push('')
  }
  return doc.join('\n').trimEnd() + '\n'
}
