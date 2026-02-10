import type { NativePdfAsset, TextFragment } from './types'

export function buildMarkdownForPage(args: {
  pageIndex: number
  fragments: TextFragment[]
  mediaBox: number[] | null
  includeImages: boolean
  imageAssets: NativePdfAsset[]
  assetUrlPrefix: string
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

  const lines = [...byKey.values()]
    .map(g => {
      const parts = g.parts.slice().sort((a, b) => a.x - b.x)
      let line = ''
      let prevX = 0
      let prevSize = 12
      for (const p of parts) {
        const expectedEnd = prevX + (line.length || 0) * (prevSize * 0.5)
        const gap = p.x - expectedEnd
        const needsSpace = line && gap > Math.max(2, p.fontSize * 0.2) && !line.endsWith('-') && !line.endsWith(' ')
        if (needsSpace) line += ' '
        line += p.text
        prevX = p.x
        prevSize = p.fontSize
      }
      line = line.replace(/\s+/g, ' ').trim()
      const maxFont = parts.reduce((m, p) => Math.max(m, p.fontSize || 0), 0)
      return { y: g.y, x: parts[0]?.x ?? 0, text: line, maxFont }
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

  const bodyLines = lines
    .filter(l => !headerFooterCandidates.has(l.text))
    .map(l => {
      const level = l.maxFont >= medianFont * 1.9 ? 3 : l.maxFont >= medianFont * 1.5 ? 4 : 0
      if (level > 0) return `${'#'.repeat(level)} ${l.text}`
      return l.text
    })

  const pageNum = args.pageIndex + 1
  const includeImage = args.includeImages || (bodyLines.length < 3 && args.imageAssets.length > 0)
  const linesOut: string[] = []
  linesOut.push(`## Page ${pageNum}`)
  linesOut.push('')
  if (includeImage && args.imageAssets.length > 0) {
    const first = args.imageAssets[0]
    if (args.assetUrlPrefix) {
      linesOut.push(`![Page ${pageNum}](${args.assetUrlPrefix}/${first.filename})`)
      linesOut.push('')
    }
  }
  linesOut.push(...bodyLines)
  linesOut.push('')
  return linesOut.join('\n')
}

