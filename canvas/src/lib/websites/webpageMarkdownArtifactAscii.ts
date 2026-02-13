import { normalizeInline, stripTrailingPunctuation, truncate } from './webpageMarkdownArtifactAsciiPrivate'

export const renderAsciiFrame = (args: { title: string; width: number; lines: string[] }) => {
  const width = Math.max(60, Math.min(92, Math.floor(args.width)))
  const inner = width - 2
  const title = truncate(String(args.title || '').toUpperCase(), inner - 2)
  const top = `┌${'─'.repeat(inner)}┐`
  const titleLine = `│ ${title.padEnd(inner - 2, ' ')} │`
  const sep = `├${'─'.repeat(inner)}┤`
  const body = (args.lines || []).map(l => truncate(String(l || ''), inner - 2))
  const padded = body.length ? body : ['']
  const rows = padded.map(l => `│ ${l.padEnd(inner - 2, ' ')} │`)
  const bot = `└${'─'.repeat(inner)}┘`
  return [top, titleLine, sep, ...rows, bot].join('\n')
}

export const renderDoubleLineFrame = (args: { width: number; lines: string[] }) => {
  const width = Math.max(64, Math.min(92, Math.floor(args.width)))
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

export const centerLine = (raw: string, width: number) => {
  const s = String(raw || '')
  if (!s) return ''
  if (s.length >= width) return s.slice(0, width)
  const left = Math.floor((width - s.length) / 2)
  const right = width - s.length - left
  return `${' '.repeat(left)}${s}${' '.repeat(right)}`
}

const padCenter = (raw: string, width: number) => {
  const s = String(raw || '')
  if (s.length >= width) return s.slice(0, width)
  const left = Math.floor((width - s.length) / 2)
  const right = width - s.length - left
  return ' '.repeat(left) + s + ' '.repeat(right)
}

const splitWordsToTwoLines = (raw: string, widths: { a: number; b: number }) => {
  const s = normalizeInline(raw)
  if (!s) return { a: '', b: '' }
  if (s.length <= widths.a) return { a: s, b: '' }
  const tokens = s.split(' ')
  const aParts: string[] = []
  const bParts: string[] = []
  for (const t of tokens) {
    const aCandidate = normalizeInline([...aParts, t].join(' '))
    if (aCandidate.length <= widths.a && !bParts.length) {
      aParts.push(t)
      continue
    }
    bParts.push(t)
  }
  const a = truncate(normalizeInline(aParts.join(' ')), widths.a)
  const b = truncate(normalizeInline(bParts.join(' ')), widths.b)
  return { a, b }
}

export const renderTemplateGalleryGrid = (items: string[]) => {
  const picked = items.map(s => stripTrailingPunctuation(normalizeInline(s))).filter(Boolean)
  if (picked.length < 6) {
    return renderAsciiFrame({
      title: 'Quick Start Templates',
      width: 84,
      lines: [picked.length ? picked.map(t => `[${t}]`).join(' ') : '(templates not detected)'],
    })
  }

  const widths = [8, 8, 9, 14, 10, 16]
  const cols = picked.slice(0, 6)
  const cell = (idx: number) => {
    const w = widths[idx] || 8
    const labelRaw = cols[idx] || ''
    const label = /^find\s+a\s+template/i.test(labelRaw) ? 'Find a template →' : labelRaw
    if (/^blank$/i.test(label)) return { a: ' [Blank]', b: '' }
    if (/^find\s+a\s+template\s*→?$/i.test(label)) {
      return { a: '   Find a       ', b: '   template →   ' }
    }
    return splitWordsToTwoLines(label, { a: w, b: w })
  }

  const c = [0, 1, 2, 3, 4, 5].map(i => cell(i))

  const row = (cells: string[]) => `│${cells.map((t, i) => padCenter(t, widths[i] || 8)).join('│')}│`
  const isPrompt = (s: string) => /\bprompt\b/i.test(s)
  const isFinder = (s: string) => /\bfind\b/i.test(s)

  const iconsA = cols.map((t) => {
    if (isFinder(t)) return ''
    if (isPrompt(t)) return 'Graphics'
    return '[□]'
  })
  const iconsB = cols.map((t) => {
    if (isPrompt(t)) return '[□]'
    return ''
  })

  return [
    '┌─────────────────────────────────────────────────────────────────────────┐',
    '│  QUICK START TEMPLATES                                                  │',
    '├────────┬────────┬─────────┬──────────────┬──────────┬─────────────────┤',
    row(['', '', '', '', '', '']),
    row([c[0].a, c[1].a, c[2].a, c[3].a, c[4].a, c[5].a]),
    row([c[0].b, c[1].b, c[2].b, c[3].b, c[4].b, c[5].b]),
    row([iconsA[0] || '', iconsA[1] || '', iconsA[2] || '', iconsA[3] || '', iconsA[4] || '', iconsA[5] || '']),
    row([iconsB[0] || '', iconsB[1] || '', iconsB[2] || '', iconsB[3] || '', iconsB[4] || '', iconsB[5] || '']),
    '└────────┴────────┴─────────┴──────────────┴──────────┴─────────────────┘',
  ].join('\n')
}

export const renderTemplateGalleryGridTwoRows = (items: string[]) => {
  const picked = items.map(s => stripTrailingPunctuation(normalizeInline(s))).filter(Boolean)
  if (picked.length < 6) return renderTemplateGalleryGrid(picked)

  const cols = 6
  const widths = [8, 8, 9, 14, 10, 16]
  const row = (cells: string[]) => `│${cells.map((t, i) => padCenter(t, widths[i] || 8)).join('│')}│`
  const isPrompt = (s: string) => /\bprompt\b/i.test(s)
  const isFinder = (s: string) => /\bfind\b/i.test(s)
  const cell = (labelRaw: string, idx: number) => {
    const w = widths[idx] || 8
    const label = /^find\s+a\s+template/i.test(labelRaw) ? 'Find a template →' : labelRaw
    if (/^blank$/i.test(label)) return { a: ' [Blank]', b: '' }
    if (/^find\s+a\s+template\s*→?$/i.test(label)) {
      return { a: '   Find a       ', b: '   template →   ' }
    }
    return splitWordsToTwoLines(label, { a: w, b: w })
  }

  const buildRows = (slice: string[]) => {
    const out: string[] = []
    const c = Array.from({ length: cols }).map((_, i) => cell(slice[i] || '', i))
    const iconsA = slice.map((t) => {
      if (isFinder(t)) return ''
      if (isPrompt(t)) return 'Graphics'
      return '[□]'
    })
    const iconsB = slice.map((t) => {
      if (isPrompt(t)) return '[□]'
      return ''
    })
    while (iconsA.length < cols) iconsA.push('')
    while (iconsB.length < cols) iconsB.push('')
    out.push(row(['', '', '', '', '', '']))
    out.push(row([c[0].a, c[1].a, c[2].a, c[3].a, c[4].a, c[5].a]))
    out.push(row([c[0].b, c[1].b, c[2].b, c[3].b, c[4].b, c[5].b]))
    out.push(row([iconsA[0] || '', iconsA[1] || '', iconsA[2] || '', iconsA[3] || '', iconsA[4] || '', iconsA[5] || '']))
    out.push(row([iconsB[0] || '', iconsB[1] || '', iconsB[2] || '', iconsB[3] || '', iconsB[4] || '', iconsB[5] || '']))
    return out
  }

  const first = picked.slice(0, 6)
  const second = picked.slice(6, 12)
  const secondHas = second.some(Boolean)

  return [
    '┌─────────────────────────────────────────────────────────────────────────┐',
    '│  QUICK START TEMPLATES                                                  │',
    '├────────┬────────┬─────────┬──────────────┬──────────┬─────────────────┤',
    ...buildRows(first),
    ...(secondHas
      ? [
          '├────────┼────────┼─────────┼──────────────┼──────────┼─────────────────┤',
          ...buildRows(second),
        ]
      : []),
    '└────────┴────────┴─────────┴──────────────┴──────────┴─────────────────┘',
  ].join('\n')
}

export const buildLayoutStructureAscii = (args: { navLabels: string[]; ctaLabels: string[] }) => {
  const all = [...args.navLabels, ...args.ctaLabels]
    .map(t => stripTrailingPunctuation(normalizeInline(t)))
    .filter(Boolean)
  const dedup: string[] = []
  for (const t of all) {
    if (dedup.some(x => x.toLowerCase() === t.toLowerCase())) continue
    dedup.push(t)
    if (dedup.length >= 10) break
  }
  const navLine = dedup.length ? `[Logo] ${dedup.join(' | ')}` : '[Logo]'
  const blocks: string[] = []
  blocks.push(renderAsciiFrame({ title: 'GLOBAL NAVIGATION', width: 84, lines: ['', navLine, ''] }))
  blocks.push(renderAsciiFrame({ title: 'HERO SECTION', width: 84, lines: ['(headline + CTAs)'] }))
  blocks.push(renderAsciiFrame({ title: 'FEATURES', width: 84, lines: ['(sections + media)'] }))
  blocks.push(renderAsciiFrame({ title: 'PRICING TIERS', width: 84, lines: ['(plans + prices)'] }))
  blocks.push(renderAsciiFrame({ title: 'FOOTER', width: 84, lines: ['(support + community)'] }))
  return blocks.join('\n')
}
