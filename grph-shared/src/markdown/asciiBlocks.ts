const BOX_DRAWING_RE = /[┌┐└┘┬┴┼│─╔╗╚╝╦╩╬║═]/

const isFenceLine = (line: string): boolean => /^\s*```/.test(line)

const looksLikeBoxDrawingStart = (line: string): boolean => /^\s*[┌╔]/.test(line) && BOX_DRAWING_RE.test(line)

const looksLikeBoxDrawingLine = (line: string): boolean => BOX_DRAWING_RE.test(line)

const looksLikeAsciiBodyLine = (line: string): boolean => {
  const t = String(line || '').trim()
  if (!t) return false
  if (/^#{1,6}\s+\S/.test(t)) return true
  if (/^\[\s*[xX ]\s*\]\s+\S/.test(t)) return true
  if (/^[-*+]\s+\S/.test(t)) return true
  if (/^\d+\.\s+\S/.test(t)) return true
  if (looksLikePipeLayoutLine(line)) return true
  return false
}

const looksLikePipeLayoutLine = (line: string): boolean => {
  const s = String(line || '')
  if (!/\|/.test(s)) return false
  const t = s.trim()
  const pipeCount = (t.match(/\|/g) || []).length
  if (t.startsWith('|') && t.endsWith('|')) return false
  if (pipeCount >= 3) return false
  if (/^\s*(?:\.\.\.|…)\s*\|\s*/.test(s)) return true
  if (/\s\|\s*#{1,6}\s+\S/.test(s)) return true
  if (/^\s*\S.{0,40}\|\s*$/.test(s)) return true
  return false
}

const isEllipsisPipeLayoutLine = (line: string): boolean => /^\s*(?:\.\.\.|…)\s*\|\s*/.test(String(line || ''))

const normalizeInline = (raw: string): string => String(raw || '').replace(/\s+/g, ' ').trim()

const truncate = (raw: string, max: number): string => {
  const s = normalizeInline(raw)
  if (s.length <= max) return s
  if (max <= 1) return '…'
  return `${s.slice(0, Math.max(0, max - 1)).trimEnd()}…`
}

const stripMarkdownPrefix = (raw: string): string => {
  const s = normalizeInline(raw)
  if (!s) return ''
  return s.replace(/^#{1,6}\s+/, '').replace(/^\[\s*[xX ]\s*\]\s+/, '').replace(/^[-*+]\s+/, '').trim()
}

const splitPipeLayoutCells = (line: string): string[] => {
  const raw = String(line || '')
  const withStrippedEnds = raw.trim().replace(/^\|/, '').replace(/\|$/, '')
  if (!withStrippedEnds.includes('|')) return [stripMarkdownPrefix(withStrippedEnds)]
  const parts = withStrippedEnds.split('|').map(s => stripMarkdownPrefix(s))
  return parts.map(s => s.trim()).filter(s => s !== '')
}

const renderPipeLayoutAsBoxTable = (blockLines: string[]): string[] => {
  const rows = blockLines
    .map(l => splitPipeLayoutCells(l))
    .filter(r => r.length > 0)
    .map(r => (r.length > 4 ? r.slice(0, 4) : r))

  if (rows.length < 2) return blockLines
  const colCount = rows.reduce((m, r) => Math.max(m, r.length), 0)
  const padded = rows.map(r => {
    const next = r.slice()
    while (next.length < colCount) next.push('')
    return next
  })

  const maxColWidth = 44
  const widths = new Array(colCount).fill(0).map((_, c) => {
    const w = padded.reduce((m, r) => Math.max(m, normalizeInline(r[c] || '').length), 0)
    return Math.max(3, Math.min(maxColWidth, w))
  })

  const top = `┌${widths.map(w => '─'.repeat(w)).join('┬')}┐`
  const mid = `├${widths.map(w => '─'.repeat(w)).join('┼')}┤`
  const bot = `└${widths.map(w => '─'.repeat(w)).join('┴')}┘`
  const row = (cells: string[]) =>
    `│${cells.map((c, i) => truncate(c, widths[i]).padEnd(widths[i], ' ')).join('│')}│`

  const out: string[] = [top]
  for (let i = 0; i < padded.length; i += 1) {
    out.push(row(padded[i] || []))
  }
  out.push(bot)
  if (out.length >= 6) out.splice(2, 0, mid)
  return out
}

export function normalizeMarkdownAsciiBlocks(markdown: string): string {
  const lines = String(markdown || '').split(/\r?\n/)
  const out: string[] = []

  let i = 0
  let inFence = false
  let fenceOpenLine = ''
  let fenceInfo = ''
  let fenceLines: string[] = []
  let fenceAsciiFound = false

  const flushFence = () => {
    if (!fenceLines.length) return
    if (fenceLines.length >= 3) {
      const open = fenceLines[0] || ''
      const close = fenceLines[fenceLines.length - 1] || ''
      const body = fenceLines.slice(1, fenceLines.length - 1)
      const nonEmpty = body.filter(l => String(l || '').trim() !== '')
      const pipeCount = nonEmpty.filter(looksLikePipeLayoutLine).length
      const ellipsisPipeCount = nonEmpty.filter(isEllipsisPipeLayoutLine).length
      const hasBox = nonEmpty.some(looksLikeBoxDrawingLine)
      if (!hasBox && pipeCount >= 2 && pipeCount === nonEmpty.length && ellipsisPipeCount !== nonEmpty.length) {
        const rendered = renderPipeLayoutAsBoxTable(nonEmpty)
        fenceLines = [open, ...rendered, close]
      }
    }
    if (!fenceInfo && fenceAsciiFound) {
      const m = fenceOpenLine.match(/^(\s*```)\s*$/)
      if (m) fenceLines[0] = `${m[1]}ascii`
    }
    out.push(...fenceLines)
    fenceLines = []
    fenceOpenLine = ''
    fenceInfo = ''
    fenceAsciiFound = false
  }

  const ensureBlankLineBefore = () => {
    if (out.length === 0) return
    if (String(out[out.length - 1] || '').trim() === '') return
    out.push('')
  }

  const ensureBlankLineAfter = (nextNonEmptyIsFenceOrEof: boolean) => {
    if (nextNonEmptyIsFenceOrEof) return
    if (out.length === 0) return
    if (String(out[out.length - 1] || '').trim() === '') return
    out.push('')
  }

  const wrapBlockAsAsciiFence = (blockLines: string[], nextLineIdx: number) => {
    ensureBlankLineBefore()
    out.push('```ascii', ...blockLines, '```')
    const nextNonEmpty = (() => {
      for (let k = nextLineIdx; k < lines.length; k += 1) {
        const t = String(lines[k] || '').trim()
        if (!t) continue
        return t
      }
      return ''
    })()
    ensureBlankLineAfter(!nextNonEmpty || nextNonEmpty.startsWith('```'))
  }

  while (i < lines.length) {
    const line = String(lines[i] || '')

    if (inFence) {
      fenceLines.push(line)
      if (looksLikeBoxDrawingLine(line) || looksLikePipeLayoutLine(line)) fenceAsciiFound = true
      if (isFenceLine(line)) {
        inFence = false
        flushFence()
      }
      i += 1
      continue
    }

    if (isFenceLine(line)) {
      inFence = true
      fenceOpenLine = line
      const info = String(line.replace(/^\s*```/, '')).trim()
      fenceInfo = info
      fenceLines = [line]
      fenceAsciiFound = false
      i += 1
      continue
    }

    if (looksLikeBoxDrawingStart(line)) {
      const block: string[] = [line]
      let j = i + 1
      while (j < lines.length) {
        const l = String(lines[j] || '')
        if (!l.trim()) break
        if (isFenceLine(l)) break
        if (block.length >= 80) break
        block.push(l)
        j += 1
      }
      const hasBoxDrawingBody = block.slice(1).some(looksLikeBoxDrawingLine)
      const hasAsciiBodyMarkers = block.slice(1, Math.min(block.length, 12)).some(looksLikeAsciiBodyLine)
      if (block.length >= 3 || hasBoxDrawingBody || hasAsciiBodyMarkers) {
        wrapBlockAsAsciiFence(block, j)
        i = j
        continue
      }
    }

    if (looksLikePipeLayoutLine(line)) {
      const block: string[] = [line]
      let j = i + 1
      let count = 1
      while (j < lines.length) {
        const l = String(lines[j] || '')
        if (!l.trim()) break
        if (!looksLikePipeLayoutLine(l)) break
        block.push(l)
        count += 1
        j += 1
      }
      if (count >= 2) {
        wrapBlockAsAsciiFence(renderPipeLayoutAsBoxTable(block), j)
        i = j
        continue
      }
    }

    out.push(line)
    i += 1
  }

  if (inFence) flushFence()
  return out.join('\n')
}
