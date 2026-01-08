import { parseMarkdownFrontmatter, splitMarkdownLines, type MarkdownFrontmatter } from '@/lib/markdown'

export type Slide = {
  index: number
  startLine: number
  endLine: number
  meta: MarkdownFrontmatter
  text: string
  notes: string | null
}

const stripSlideNotes = (lines: string[]): { lines: string[]; notes: string | null } => {
  let end = lines.length
  while (end > 0 && !(lines[end - 1] || '').trim()) end -= 1
  if (end <= 0) return { lines: [], notes: null }
  const last = (lines[end - 1] || '').trim()
  if (!last.endsWith('-->')) return { lines: lines.slice(0, end), notes: null }
  let start = end - 1
  while (start >= 0 && !String(lines[start] || '').includes('<!--')) start -= 1
  if (start < 0) return { lines: lines.slice(0, end), notes: null }
  const first = String(lines[start] || '').trim()
  if (!first.startsWith('<!--')) return { lines: lines.slice(0, end), notes: null }
  const notesLines = lines.slice(start, end)
  const remaining = lines.slice(0, start)
  const notes = notesLines.join('\n').trim() || null
  return { lines: remaining, notes }
}

export const splitSlides = (markdownText: string): { headMeta: MarkdownFrontmatter; slides: Slide[] } => {
  const lines = splitMarkdownLines(markdownText || '')
  const { meta: headMeta, startIndex: headStartIndex } = parseMarkdownFrontmatter(lines)
  const contentLines = lines.slice(headStartIndex)

  const slideChunks: Array<{ rawLines: string[]; startLine: number }> = []
  let chunkStart = 0
  let inFence = false
  let fenceMarker = ''
  for (let i = 0; i <= contentLines.length; i += 1) {
    const line = contentLines[i] ?? null
    const trimmed = (line || '').trim()
    if (line != null) {
      const fenceMatch = trimmed.match(/^(```+|~~~+)(.*)$/)
      if (fenceMatch) {
        const marker = fenceMatch[1] || ''
        if (!inFence) {
          inFence = true
          fenceMarker = marker
        } else if (marker === fenceMarker) {
          inFence = false
          fenceMarker = ''
        }
      }
    }
    const isSeparator = !inFence && trimmed === '---'
    const isEnd = i === contentLines.length
    if (!isSeparator && !isEnd) continue
    const rawLines = contentLines.slice(chunkStart, i)
    const startLine = headStartIndex + chunkStart + 1
    slideChunks.push({ rawLines, startLine })
    chunkStart = i + 1
  }

  const slides: Slide[] = slideChunks.map((chunk, idx) => {
    const { meta, startIndex } = parseMarkdownFrontmatter(chunk.rawLines)
    const bodyLines = chunk.rawLines.slice(startIndex)
    const { lines: bodySansNotes, notes } = stripSlideNotes(bodyLines)
    const text = bodySansNotes.join('\n')
    const startLine = chunk.startLine
    const endLine = chunk.startLine + Math.max(0, chunk.rawLines.length - 1)
    return { index: idx, startLine, endLine, meta, text, notes }
  })

  return { headMeta, slides: slides.length ? slides : [{ index: 0, startLine: 1, endLine: lines.length || 1, meta: {}, text: markdownText || '', notes: null }] }
}
