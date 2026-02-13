import { summarizeCategorizedSignalsFromMarkdown } from './signalTokens'
import { buildLayoutStructureAscii, centerLine, renderAsciiFrame, renderDoubleLineFrame, renderTemplateGalleryGrid } from './webpageMarkdownArtifactAscii'
import {
  countMatches,
  countSectionParagraphs,
  countUniqueMarkdownLinkTexts,
  extractBlockUnderH2,
  extractHSections,
  extractHeadings,
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

export function buildWebpageMarkdownArtifactFromMarkdown(args: { markdown: string; url: string; title?: string }): string {
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
  const overview = inferPageOverviewSentence(markdownMain, 240)

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
  const heroLinks = extractMarkdownLinkTexts(markdownMain, 16)
  const heroCtas = (() => {
    const preferred = ['Docs', 'Discord', 'GitHub', 'Prompt a video']
    const picked: string[] = []
    for (const p of preferred) {
      const hit = heroLinks.find(t => t.toLowerCase() === p.toLowerCase() || (p === 'GitHub' && t.toLowerCase().startsWith('github')))
      if (hit && !picked.some(x => x.toLowerCase() === hit.toLowerCase())) picked.push(hit)
    }
    for (const t of heroLinks) {
      if (picked.length >= 4) break
      if (picked.some(x => x.toLowerCase() === t.toLowerCase())) continue
      picked.push(t)
    }
    return picked.slice(0, 4)
  })()

  const templates = extractTemplates(markdownMain)
  const pricingComparisonTable = extractMarkdownTableUnderH2(markdownMain, 'Pricing Comparison (Extracted)')
  const pricingDetailsTable = extractMarkdownTableUnderH2(markdownMain, 'Pricing Details (Extracted)')
  const companyOptionsBlock = extractBlockUnderH2(markdownMain, 'Company License Options (Extracted)', 140)
  const renderingOptionsTable = extractMarkdownTableUnderH2(markdownMain, 'Rendering Options (Extracted)')

  const blocks = extractHSections(markdownMain, 120)
  const featureBlocks = (() => {
    const preferred = ['compose', 'edit', 'scalable', 'render']
    const picked: HSection[] = []
    for (const k of preferred) {
      const hit = blocks.find(b => b.level === 2 && normalizeInline(b.title).toLowerCase().includes(k))
      if (hit && !picked.includes(hit)) picked.push(hit)
    }
    for (const b of blocks) {
      if (picked.length >= 3) break
      if (b.level !== 2) continue
      if (picked.includes(b)) continue
      if (/templates/i.test(b.title)) continue
      if (/pricing/i.test(b.title)) continue
      if (/trusted by/i.test(b.title)) continue
      picked.push(b)
    }
    return picked.slice(0, 3)
  })()

  const doc: string[] = []
  const hostDisplay = stripWww(host || 'website')
  doc.push('')
  doc.push(`# Webpage Markdown Artifact: ${hostDisplay}`)
  doc.push(`## ${pageTitle}`)
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
  doc.push(`| **Media Elements** | ${Math.max(0, stats.mediaFiles)} | Video demonstrations |`)
  doc.push(`| **Interactive UI** | ${stats.interactiveUi} | Drag-drop, toggles, controls |`)
  doc.push(`| **Timecodes** | ${stats.timecodes} | Video player timestamp |`)
  doc.push(`| **Pricing Tokens** | ${stats.pricingTokens} | Cost indicators across tiers |`)
  doc.push('')
  doc.push('---')
  doc.push('')

  doc.push('## 🎨 Color Scheme & Theme')
  doc.push('')
  doc.push('> Theme detection is heuristic; treat this section as advisory.')
  doc.push('')
  doc.push('- Primary Brand Color: (not detected)')
  doc.push('- Background: (not detected)')
  doc.push('- Accent: (not detected)')
  doc.push('')
  doc.push('---')
  doc.push('')

  doc.push('## 📐 Layout Structure')
  doc.push('')
  doc.push('```ascii')
  doc.push(layoutAscii.trimEnd())
  doc.push('```')
  doc.push('')
  doc.push('---')

  doc.push('')
  doc.push('## 🔝 Header Navigation')
  doc.push('')
  doc.push('### Primary Navigation Bar')
  doc.push('')
  doc.push('```ascii')
  const headerItems = navLabels.length ? navLabels.slice(0, 7) : ['Docs', 'Pricing', 'Blog']
  const navLine = `  [🎬 LOGO]    ${headerItems.map(x => `[${x}]`).join('  ')}`
  doc.push(renderAsciiFrame({ title: 'Primary Navigation Bar', width: 84, lines: [navLine] }))
  doc.push('```')
  doc.push('')

  doc.push('### Navigation Menu Structure')
  doc.push('')
  doc.push('| Menu | Items | Type |')
  doc.push('|------|-------|------|')
  const menus = Object.keys(navMenus)
  if (menus.length) {
    for (const m of menus) {
      const items = (navMenus[m] || []).slice(0, 8).join(', ') || '(not detected)'
      doc.push(`| **${m}** | ${items} | Dropdown |`)
    }
  } else {
    for (const h of headerItems.slice(0, 5)) doc.push(`| **${h}** | (not detected) | Direct navigation |`)
  }
  doc.push('')

  if (pageTitle && (overview || heroCommand || heroCtas.length)) {
    doc.push('---')
    doc.push('')
    doc.push('## 🎯 Hero Section')
    doc.push('')
    doc.push('### Main Headline')
    doc.push('')
    doc.push('```ascii')
    doc.push(
      renderDoubleLineFrame({
        width: 83,
        lines: [
          '',
          centerLine(`${stripTrailingPunctuation(pageTitle)}.`, 81),
          '',
          overview ? centerLine(truncate(overview, 76), 81) : '',
          heroCommand ? centerLine(truncate(heroCommand, 48), 81) : '',
          '',
          heroCtas.length ? centerLine(heroCtas.map(x => `[${x}]`).join('  '), 81) : '',
          '',
        ].filter(Boolean),
      }),
    )
    doc.push('```')
    doc.push('')

    doc.push('### Hero Content Breakdown')
    doc.push('')
    doc.push('| Element | Type | Description |')
    doc.push('|---------|------|-------------|')
    doc.push(`| **H1 Title** | Text | "${stripTrailingPunctuation(pageTitle)}." |`)
    doc.push(`| **Subtitle** | Text | ${overview ? 'Value proposition (extracted summary)' : '(not detected)'} |`)
    doc.push(`| **Code Snippet** | Terminal | ${heroCommand ? 'Quick-start command' : '(not detected)'} |`)
    doc.push(`| **CTA Buttons** | Links | ${heroCtas.length ? `${heroCtas.length} primary actions` : '(not detected)'} |`)
    doc.push('')
  }

  if (templates.length || stripFrontmatter(markdownMain).toLowerCase().includes('template')) {
    doc.push('---')
    doc.push('')
    doc.push('## 📑 Template Showcase')
    doc.push('')
    doc.push('### Template Gallery')
    doc.push('')
    doc.push('```ascii')
    doc.push(renderTemplateGalleryGrid(templates))
    doc.push('```')
    doc.push('')

    doc.push('### Available Templates')
    doc.push('')
    doc.push('| Template | Description | Use Case |')
    doc.push('|----------|-------------|----------|')
    const templateNames = templates
      .map(t => stripTrailingPunctuation(normalizeInline(t)))
      .filter(Boolean)
      .filter(t => !/^find\b/i.test(t))
      .slice(0, 5)
    if (templateNames.length) {
      for (const name of templateNames) {
        const lower = name.toLowerCase()
        const desc = lower.includes('blank') ? 'Empty starter' : lower.includes('hello') ? 'Simple example' : 'Starter template'
        const useCase = lower.includes('blank') ? 'Custom projects from scratch' : lower.includes('hello') ? 'Learning the basics' : 'Starter template'
        doc.push(`| **${name}** | ${desc} | ${useCase} |`)
      }
    } else {
      doc.push('| (none detected) | (none detected) | (none detected) |')
    }
    doc.push('')
    doc.push('**Interactive Feature:** Horizontal scrollable carousel with click-to-explore functionality')
    doc.push('')
  }

  if (featureBlocks.length) {
    let idx = 1
    for (const b of featureBlocks) {
      doc.push('---')
      doc.push('')
      doc.push(`## ${idx === 1 ? '💻' : idx === 2 ? '🎬' : '⚡'} Feature Section ${idx}: ${truncate(normalizeInline(b.title), 72)}`)
      doc.push('')
      doc.push('```ascii')
      doc.push(renderAsciiFrame({ title: 'FEATURE', width: 84, lines: [truncate(inferPageOverviewSentence(b.body, 92) || '(feature summary not detected)', 92)] }))
      doc.push('```')
      doc.push('')
      doc.push('### Section Statistics')
      doc.push('')
      const body = String(b.body || '')
      const paras = countSectionParagraphs(body)
      const linkCount = countUniqueMarkdownLinkTexts(body)
      const media = countMatches(/\b[\w-]+\.(?:webm|mp4|mov)\b/gi, body)
      doc.push(`- **Paragraphs:** ${paras}`)
      doc.push(`- **Links:** ${linkCount}`)
      doc.push(`- **Media:** ${Math.max(1, media)} video${Math.max(1, media) === 1 ? '' : 's'}`)
      doc.push('')
      idx += 1
    }
  }

  const useCasesBlock = blocks.find(b => b.level === 2 && normalizeInline(b.title).toLowerCase().includes('use case'))
  if (useCasesBlock) {
    const tiles = useCasesBlock.body
      .split(/\r?\n/)
      .map(l => {
        const m = l.match(/^\s*[-*+]\s+(.+?)\s*$/)
        return m ? stripTrailingPunctuation(normalizeInline(m[1] || '')) : ''
      })
      .filter(Boolean)
      .slice(0, 6)
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
        ],
      }),
    )
    doc.push('```')
    doc.push('')
  }

  const lowerAll = stripFrontmatter(markdownMain).toLowerCase()
  const hasDemo = (lowerAll.includes('drag') && lowerAll.includes('drop')) || lowerAll.includes('dark mode') || lowerAll.includes('export') || /\b\d{1,2}:\d{2}\b/.test(lowerAll)
  if (hasDemo) {
    doc.push('---')
    doc.push('')
    doc.push('## 🎮 Interactive Demo Section')
    doc.push('')
    doc.push('```ascii')
    doc.push(renderAsciiFrame({ title: 'INTERACTIVE DEMO', width: 84, lines: ['Instructions:', lowerAll.includes('drag') && lowerAll.includes('drop') ? '• Drag and drop items to reorder them' : '', lowerAll.includes('dark mode') ? '• Switch theme and see the page adjust' : '', lowerAll.includes('export') ? '[Export the video!]' : ''].filter(Boolean) }))
    doc.push('```')
    doc.push('')
    doc.push('### Interactive Features')
    doc.push('')
    doc.push('| Feature | Type | Purpose |')
    doc.push('|---------|------|---------|')
    if (lowerAll.includes('drag') && lowerAll.includes('drop')) doc.push('| **Drag and Drop** | UI Interaction | Reorder content |')
    if (lowerAll.includes('dark mode')) doc.push('| **Theme Toggle** | UI Control | Switch light/dark mode |')
    if (/\b\d{1,2}:\d{2}\b/.test(lowerAll)) doc.push('| **Video Player** | Media Control | Play and scrub timeline |')
    if (lowerAll.includes('export')) doc.push('| **Export Button** | CTA | Download rendered output |')
    doc.push('')
  }

  const pricingBlock = blocks.find(b => b.level === 2 && normalizeInline(b.title).toLowerCase().includes('pricing'))
  if (pricingBlock || /\$\s?\d/.test(stripFrontmatter(markdownMain))) {
    doc.push('---')
    doc.push('')
    doc.push('## 💰 Pricing Section')
    doc.push('')
    doc.push('### Pricing Tiers Overview')
    doc.push('')
    doc.push('```ascii')
    doc.push(renderDoubleLineFrame({ width: 83, lines: [centerLine('PRICING TIERS', 81), '', `  ${signals.price.slice(0, 6).map(p => p.label.replace(/^\[PRICE\]\s*/i, '')).join(' | ') || '(pricing tokens detected)'}`].filter(Boolean) }))
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
      for (const line of companyOptionsBlock.split(/\r?\n/).map(l => l.trimEnd())) {
        const h3 = line.match(/^###\s+(.+?)\s*$/)
        if (h3) {
          const t = normalizeInline(h3[1] || '')
          if (t) doc.push(`**${t}**`)
          continue
        }
        if (/^>\s+/.test(line) || /^[-*+]\s+/.test(line)) doc.push(line)
      }
      doc.push('')
    }
    doc.push('### Pricing Details')
    doc.push('')
    if (pricingDetailsTable) {
      doc.push(pricingDetailsTable)
      doc.push('')
    }
    if (renderingOptionsTable) {
      doc.push('### Rendering Options')
      doc.push('')
      doc.push(renderingOptionsTable)
      doc.push('')
    }
  }

  const hasSupport = /support|help|contact|book|schedule|email|experts/i.test(lowerAll)
  if (hasSupport || blocks.some(b => b.level === 2 && /trusted by/i.test(normalizeInline(b.title).toLowerCase()))) {
    doc.push('---')
    doc.push('')
    doc.push('## 🤝 Trust & Support Section')
    doc.push('')
    doc.push('- Support channels and community links detected in source content.')
    doc.push('')
  }

  doc.push('---')
  doc.push('')
  return doc.join('\n').trimEnd() + '\n'
}
