import type { NativePdfAsset, TextFragment } from './types'

type PdfLine = {
  y: number
  x: number
  text: string
  maxFont: number
  parts: TextFragment[]
  hasBold: boolean
}

type PdfCell = { x: number; text: string }

function escapeMarkdownTableCell(text: string): string {
  const raw = String(text || '')
  return raw.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ').trim()
}

function buildCellsFromFragments(args: { parts: TextFragment[]; medianFont: number }): PdfCell[] {
  const parts = args.parts.slice().sort((a, b) => a.x - b.x)
  if (parts.length === 0) return []

  const gapThreshold = Math.max(28, args.medianFont * 2.8)
  const cells: { x: number; parts: TextFragment[] }[] = []
  let current: { x: number; parts: TextFragment[] } | null = null
  let lastX = 0
  let lastFont = args.medianFont || 12

  for (const p of parts) {
    const gap = p.x - lastX
    const newCell = !current || (current.parts.length > 0 && gap > gapThreshold)
    if (newCell) {
      current = { x: p.x, parts: [p] }
      cells.push(current)
    } else {
      current.parts.push(p)
    }
    lastX = p.x + Math.max(0, p.text.length) * (Math.max(6, lastFont) * 0.5)
    lastFont = p.fontSize || lastFont
  }

  return cells
    .map(c => {
      const fragments = c.parts.slice().sort((a, b) => a.x - b.x)
      let text = ''
      let prevX = 0
      let prevSize = args.medianFont || 12
      for (const f of fragments) {
        const expectedEnd = prevX + (text.length || 0) * (prevSize * 0.5)
        const gap = f.x - expectedEnd
        const needsSpace = text && gap > Math.max(2, f.fontSize * 0.2) && !text.endsWith('-') && !text.endsWith(' ')
        if (needsSpace) text += ' '
        text += f.text
        prevX = f.x
        prevSize = f.fontSize
      }
      return { x: c.x, text: text.replace(/\s+/g, ' ').trim() }
    })
    .filter(c => c.text)
}

function clusterColumnXs(xs: number[], tolPx: number): number[] {
  const sorted = xs.filter(n => Number.isFinite(n)).slice().sort((a, b) => a - b)
  if (sorted.length === 0) return []
  const clusters: number[] = []
  let current = sorted[0]
  let count = 1
  for (let i = 1; i < sorted.length; i += 1) {
    const v = sorted[i]
    if (Math.abs(v - current) <= tolPx) {
      current = (current * count + v) / (count + 1)
      count += 1
    } else {
      clusters.push(current)
      current = v
      count = 1
    }
  }
  clusters.push(current)
  return clusters
}

function assignCellsToColumns(cells: PdfCell[], cols: number[], tolPx: number): string[] {
  const out = Array.from({ length: cols.length }).map(() => '')
  for (const cell of cells) {
    let bestIdx = -1
    let bestDist = Infinity
    for (let i = 0; i < cols.length; i += 1) {
      const d = Math.abs(cell.x - cols[i])
      if (d < bestDist) {
        bestDist = d
        bestIdx = i
      }
    }
    if (bestIdx < 0 || bestDist > tolPx * 2) continue
    out[bestIdx] = out[bestIdx] ? `${out[bestIdx]} ${cell.text}`.trim() : cell.text
  }
  return out
}

function maybeExtractMarkdownTable(args: {
  lines: PdfLine[]
  startIndex: number
  medianFont: number
  minCols: number
  minRows: number
  maxRows: number
}): { consumed: number; markdown: string } | null {
  const tolPx = Math.max(10, args.medianFont * 0.6)
  const cellsByRow: PdfCell[][] = []
  const rowYs: number[] = []

  for (let i = args.startIndex; i < args.lines.length; i += 1) {
    if (cellsByRow.length >= args.maxRows) break
    const l = args.lines[i]
    const cells = buildCellsFromFragments({ parts: l.parts, medianFont: args.medianFont })
    if (cells.length < args.minCols) break
    if (rowYs.length > 0) {
      const prevY = rowYs[rowYs.length - 1]
      const gapY = Math.abs(prevY - l.y)
      if (gapY > Math.max(18, args.medianFont * 2.8)) break
    }
    cellsByRow.push(cells)
    rowYs.push(l.y)
  }

  if (cellsByRow.length < args.minRows) return null

  const allXs = cellsByRow.flat().map(c => c.x)
  const cols = clusterColumnXs(allXs, tolPx)
  if (cols.length < args.minCols) return null

  const rowsAssigned = cellsByRow.map(row => assignCellsToColumns(row, cols, tolPx))
  const denseRatio = (() => {
    let filled = 0
    let total = 0
    for (const r of rowsAssigned) {
      for (const c of r) {
        total += 1
        if (String(c || '').trim()) filled += 1
      }
    }
    return total > 0 ? filled / total : 0
  })()
  if (denseRatio < 0.55) return null

  const header = rowsAssigned[0].map(escapeMarkdownTableCell)
  const body = rowsAssigned.slice(1).map(r => r.map(escapeMarkdownTableCell))
  const sep = cols.map(() => '---')
  const linesOut: string[] = []
  linesOut.push(`| ${header.join(' | ')} |`)
  linesOut.push(`| ${sep.join(' | ')} |`)
  for (const r of body) {
    linesOut.push(`| ${r.join(' | ')} |`)
  }
  linesOut.push('')
  return { consumed: cellsByRow.length, markdown: linesOut.join('\n') }
}

export function buildMarkdownForPage(args: {
  pageIndex: number
  fragments: TextFragment[]
  mediaBox: number[] | null
  includeImages: boolean
  imageAssets: NativePdfAsset[]
  assetUrlPrefix: string
  maxImagesPerPage?: number
  ocrMarkdown?: string | null
  reconstructTables?: boolean
  tableMinColumns?: number
  tableMinRows?: number
  tableMaxRows?: number
}): string {
  const h = args.mediaBox && args.mediaBox.length >= 4 ? Math.abs(Number(args.mediaBox[3]) - Number(args.mediaBox[1])) : 0
  const yTol = (fontSize: number) => Math.max(2, Math.min(8, fontSize * 0.25))
  const byKey = new Map<number, { y: number; parts: TextFragment[] }>()
  for (const f of args.fragments) {
    const tol = yTol(f.fontSize)
    const key = Math.round(f.y / tol)
    const group = byKey.get(key) || { y: f.y, parts: [] }
    group.parts.push(f)
    group.y = Math.max(group.y, f.y)
    byKey.set(key, group)
  }

  const lines: PdfLine[] = [...byKey.values()]
    .map(g => {
      const parts = g.parts.slice().sort((a, b) => a.x - b.x)
      let line = ''
      let cursorEndX = 0
      for (const p of parts) {
        const charW = Math.max(1, p.fontSize * 0.5)
        if (!line) {
          line = p.text
          cursorEndX = p.x + p.text.length * charW
          continue
        }
        const gap = p.x - cursorEndX
        const needsSpace = gap > Math.max(2, p.fontSize * 0.2) && !line.endsWith('-') && !line.endsWith(' ')
        if (needsSpace) {
          line += ' '
          cursorEndX += charW
        }
        line += p.text
        cursorEndX = p.x + p.text.length * charW
      }
      line = line.replace(/\s+/g, ' ').trim()
      const maxFont = parts.reduce((m, p) => Math.max(m, p.fontSize || 0), 0)
      const hasBold = parts.some(p => p.bold)
      return { y: g.y, x: parts[0]?.x ?? 0, text: line, maxFont, parts, hasBold }
    })
    .filter(l => l.text)
    .sort((a, b) => (b.y - a.y) || (a.x - b.x))

  const medianFont = (() => {
    const all = lines.map(l => l.maxFont).filter(n => Number.isFinite(n) && n > 0).sort((a, b) => a - b)
    if (all.length === 0) return 12
    return all[Math.floor(all.length / 2)] || 12
  })()

  const headerFooterCandidates = (() => {
    if (!h || lines.length === 0) return new Set<string>()
    const topBottom = lines.filter(l => l.y > h * 0.9 || l.y < h * 0.1).map(l => l.text)
    const counts = new Map<string, number>()
    for (const t of topBottom) counts.set(t, (counts.get(t) || 0) + 1)
    return new Set([...counts.entries()].filter(([, c]) => c >= 2).map(([t]) => t))
  })()

  const filteredLines = lines.filter(l => !headerFooterCandidates.has(l.text))

  const reconstructed = (() => {
    const enabled = args.reconstructTables !== false
    if (!enabled) return filteredLines.map(l => l.text)

    const minCols = typeof args.tableMinColumns === 'number' && Number.isFinite(args.tableMinColumns)
      ? Math.max(2, Math.min(12, Math.floor(args.tableMinColumns)))
      : 2
    const minRows = typeof args.tableMinRows === 'number' && Number.isFinite(args.tableMinRows)
      ? Math.max(2, Math.min(20, Math.floor(args.tableMinRows)))
      : 3
    const maxRows = typeof args.tableMaxRows === 'number' && Number.isFinite(args.tableMaxRows)
      ? Math.max(5, Math.min(200, Math.floor(args.tableMaxRows)))
      : 60

    const typicalLineGap = (() => {
      if (filteredLines.length < 3) return medianFont * 1.4
      const gaps: number[] = []
      for (let i = 1; i < filteredLines.length; i += 1) {
        gaps.push(Math.abs(filteredLines[i - 1].y - filteredLines[i].y))
      }
      gaps.sort((a, b) => a - b)
      return gaps[Math.floor(gaps.length / 2)] || medianFont * 1.4
    })()
    const paragraphGapThreshold = typicalLineGap * 1.6

    const BULLET_CHARS = /^[•●◦▪▸►–—-]\s*/
    const isBulletLine = (text: string): boolean => BULLET_CHARS.test(text)

    const formatBoldInLine = (line: PdfLine): string => {
      if (!line.hasBold) return line.text
      const parts = line.parts.slice().sort((a, b) => a.x - b.x)
      let result = ''
      let cursorEndX = 0
      let inBold = false
      for (const p of parts) {
        const charW = Math.max(1, p.fontSize * 0.5)
        const isBold = !!p.bold
        if (!result) {
          if (isBold) result += '**'
          result += p.text
          cursorEndX = p.x + p.text.length * charW
          inBold = isBold
          continue
        }
        const gap = p.x - cursorEndX
        const needsSpace = gap > Math.max(2, p.fontSize * 0.2) && !result.endsWith('-') && !result.endsWith(' ')
        if (needsSpace) {
          result += ' '
          cursorEndX += charW
        }
        if (isBold !== inBold) {
          if (inBold) result += '**'
          else result += '**'
          inBold = isBold
        }
        result += p.text
        cursorEndX = p.x + p.text.length * charW
      }
      if (inBold) result += '**'
      return result.replace(/\s+/g, ' ').trim()
    }

    const out: string[] = []
    for (let i = 0; i < filteredLines.length; i += 1) {
      const l = filteredLines[i]
      const cellCount = buildCellsFromFragments({ parts: l.parts, medianFont }).length
      if (cellCount >= minCols) {
        const table = maybeExtractMarkdownTable({
          lines: filteredLines,
          startIndex: i,
          medianFont,
          minCols,
          minRows,
          maxRows,
        })
        if (table) {
          out.push(table.markdown)
          i += table.consumed - 1
          continue
        }
      }

      const prevLine = i > 0 ? filteredLines[i - 1] : null
      const yGap = prevLine ? Math.abs(prevLine.y - l.y) : 0
      const isParagraphBreak = yGap > paragraphGapThreshold && prevLine != null

      if (isParagraphBreak && out.length > 0 && out[out.length - 1] !== '') {
        out.push('')
      }

      const fontRatio = medianFont > 0 ? l.maxFont / medianFont : 1
      let level = 0
      if (fontRatio >= 2.2) level = 1
      else if (fontRatio >= 1.7) level = 2
      else if (fontRatio >= 1.4) level = 3
      else if (fontRatio >= 1.2) level = 4

      if (level > 0) {
        out.push(`${'#'.repeat(level)} ${l.text}`)
      } else if (isBulletLine(l.text)) {
        const cleaned = l.text.replace(BULLET_CHARS, '').trim()
        out.push(`- ${cleaned}`)
      } else if (l.hasBold) {
        out.push(formatBoldInLine(l))
      } else {
        out.push(l.text)
      }
    }
    return out
  })()

  const pageNum = args.pageIndex + 1
  const includeImage = args.includeImages || (reconstructed.length < 3 && args.imageAssets.length > 0)
  const maxImagesPerPage = (() => {
    const n = args.maxImagesPerPage
    if (typeof n !== 'number' || !Number.isFinite(n)) return 12
    return Math.max(0, Math.min(200, Math.floor(n)))
  })()
  const linesOut: string[] = []
  linesOut.push(`## Page ${pageNum}`)
  linesOut.push('')
  if (includeImage && args.assetUrlPrefix && maxImagesPerPage > 0) {
    const assets = args.imageAssets.slice(0, maxImagesPerPage)
    if (assets.length === 1) {
      const first = assets[0]
      linesOut.push(`![Page ${pageNum}](${args.assetUrlPrefix}/${first.filename})`)
      linesOut.push('')
    } else if (assets.length > 1) {
      linesOut.push('### Images')
      linesOut.push('')
      for (let i = 0; i < assets.length; i += 1) {
        const a = assets[i]
        linesOut.push(`![Page ${pageNum} Image ${i + 1}](${args.assetUrlPrefix}/${a.filename})`)
        linesOut.push('')
      }
    }
  }

  const ocr = String(args.ocrMarkdown || '').trim()
  if (ocr) {
    linesOut.push('### OCR')
    linesOut.push('')
    linesOut.push(ocr)
    linesOut.push('')
  }
  linesOut.push(...reconstructed)
  linesOut.push('')
  return linesOut.join('\n')
}
