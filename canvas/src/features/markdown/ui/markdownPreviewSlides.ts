import { parseMarkdownFrontmatter, splitMarkdownLines, type MarkdownFrontmatter } from '@/lib/markdown'
import { normalizeSlideOrder } from './markdownPreviewFragments'

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
  
  // Check for notes at the end
  const last = (lines[end - 1] || '').trim()
  if (last.endsWith('-->')) {
    let start = end - 1
    // Handle multi-line comment block
    while (start >= 0) {
      const line = (lines[start] || '').trim()
      if (line.includes('<!--')) {
        break
      }
      start -= 1
    }
    
    if (start >= 0) {
      const first = (lines[start] || '').trim()
      if (first.startsWith('<!--')) {
        const notesLines = lines.slice(start, end)
        const remaining = lines.slice(0, start)
        // Clean up notes: remove comment markers
        const notesRaw = notesLines.join('\n')
        const notes = notesRaw.replace(/^\s*<!--/g, '').replace(/-->\s*$/g, '').trim() || null
        return { lines: remaining, notes }
      }
    }
  }
  
  return { lines: lines.slice(0, end), notes: null }
}

const extractInlineHtmlCommentNotes = (lines: string[]): { lines: string[]; notes: string | null } => {
  const out = Array.isArray(lines) ? lines.slice() : []
  const noteBlocks: string[] = []
  let inFence = false
  let fenceMarker = ''
  for (let i = 0; i < out.length; i += 1) {
    const line = out[i] ?? ''
    const trimmed = line.trim()
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
      continue
    }
    if (inFence) continue

    if (!trimmed.startsWith('<!--')) continue

    let j = i
    const blockLines: string[] = []
    let foundEnd = false
    for (; j < out.length; j += 1) {
      const cur = out[j] ?? ''
      blockLines.push(cur)
      if (String(cur).includes('-->')) {
        foundEnd = true
        break
      }
    }
    if (!foundEnd) continue

    const noteText = blockLines.join('\n').trim()
    if (noteText) noteBlocks.push(noteText)
    for (let k = i; k <= j; k += 1) {
      out[k] = ''
    }
    i = j
  }

  const notes = noteBlocks.filter(Boolean).join('\n\n').trim() || null
  return { lines: out, notes }
}

const buildSlideChunks = (
  lines: string[],
  opts?: { headMeta?: MarkdownFrontmatter; headStartIndex?: number },
): {
  headMeta: MarkdownFrontmatter
  headStartIndex: number
  slideChunks: Array<{ rawLines: string[]; startLine: number; meta: MarkdownFrontmatter; startIndex: number }>
} => {
  const parsedHead =
    opts?.headMeta != null && typeof opts?.headStartIndex === 'number'
      ? null
      : parseMarkdownFrontmatter(lines)
  const headMeta = opts?.headMeta ?? parsedHead?.meta ?? {}
  const rawHeadStartIndex = (typeof opts?.headStartIndex === 'number'
    ? opts.headStartIndex
    : parsedHead?.startIndex) ?? 0
  const lineCount = lines.length

  let headStartIndex = rawHeadStartIndex
  while (headStartIndex < lineCount && !(lines[headStartIndex] || '').trim()) {
    headStartIndex += 1
  }

  const slideChunks: Array<{ rawLines: string[]; startLine: number; meta: MarkdownFrontmatter; startIndex: number }> = []

  const findNextSeparator = (startIndex: number): number => {
    let inFence = false
    let fenceMarker = ''
    for (let i = startIndex; i < lineCount; i += 1) {
      const line = lines[i] ?? ''
      const trimmed = line.trim()
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
      if (!inFence && trimmed === '---') return i
    }
    return -1
  }

  let offset = headStartIndex
  while (offset < lineCount) {
    const remaining = lines.slice(offset)
    const { meta: slideMeta, startIndex: slideFrontmatterStartIndex } = parseMarkdownFrontmatter(remaining)
    const afterFrontmatterIndex =
      slideFrontmatterStartIndex > 0 ? offset + slideFrontmatterStartIndex : offset
    const sepIndex = findNextSeparator(afterFrontmatterIndex)
    const endIndex = sepIndex >= 0 ? sepIndex : lineCount
    const rawLines = lines.slice(offset, endIndex)
    const startLine = offset + 1
    slideChunks.push({ rawLines, startLine, meta: slideMeta, startIndex: slideFrontmatterStartIndex })
    if (sepIndex < 0) break
    offset = sepIndex + 1
  }

  return { headMeta, headStartIndex, slideChunks }
}

export const splitSlides = (
  markdownText: string,
  opts?: { headMeta?: MarkdownFrontmatter; headStartIndex?: number },
): { headMeta: MarkdownFrontmatter; slides: Slide[] } => {
  const lines = splitMarkdownLines(markdownText || '')
  const { headMeta, slideChunks } = buildSlideChunks(lines, opts)

  const slides: Slide[] = slideChunks.map((chunk, idx) => {
    const bodyLines = chunk.rawLines.slice(chunk.startIndex)
    const { lines: bodySansTailNotes, notes: tailNotes } = stripSlideNotes(bodyLines)
    const { lines: bodySansNotes, notes: inlineNotes } = extractInlineHtmlCommentNotes(bodySansTailNotes)
    const combinedNotes = [inlineNotes, tailNotes].filter(Boolean).join('\n\n').trim() || null
    const text = bodySansNotes.join('\n')
    const startLine = chunk.startLine
    const endLine = chunk.startLine + Math.max(0, chunk.rawLines.length - 1)
    return { index: idx, startLine, endLine, meta: chunk.meta, text, notes: combinedNotes }
  })

  return {
    headMeta,
    slides: slides.length
      ? slides
      : [
          {
            index: 0,
            startLine: 1,
            endLine: lines.length || 1,
            meta: {},
            text: markdownText || '',
            notes: null,
          },
        ],
  }
}

export const reorderSlidesInMarkdown = (markdownText: string, slideOrder: number[]): string => {
  const lines = splitMarkdownLines(markdownText || '')
  const { headStartIndex, slideChunks } = buildSlideChunks(lines)
  const slideCount = slideChunks.length
  if (!slideCount) return markdownText

  const normalizedOrder = normalizeSlideOrder(slideOrder, slideCount)
  let isIdentity = normalizedOrder.length === slideCount
  for (let i = 0; i < slideCount && isIdentity; i += 1) {
    if (normalizedOrder[i] !== i) isIdentity = false
  }
  if (isIdentity) return markdownText

  const headLines = lines.slice(0, headStartIndex)
  const outLines: string[] = []
  for (let i = 0; i < headLines.length; i += 1) {
    outLines.push(headLines[i] ?? '')
  }

  for (let pos = 0; pos < normalizedOrder.length; pos += 1) {
    const idx = normalizedOrder[pos]
    if (idx < 0 || idx >= slideCount) continue
    const chunk = slideChunks[idx]
    if (pos > 0) {
      let trimEnd = outLines.length
      while (trimEnd > 0 && !(outLines[trimEnd - 1] || '').trim()) {
        trimEnd -= 1
      }
      outLines.length = trimEnd
      outLines.push('')
      outLines.push('---')
      outLines.push('')
    }
    let chunkStart = 0
    while (chunkStart < chunk.rawLines.length && !(chunk.rawLines[chunkStart] || '').trim()) {
      chunkStart += 1
    }
    for (let i = chunkStart; i < chunk.rawLines.length; i += 1) {
      outLines.push(chunk.rawLines[i] ?? '')
    }
  }

  return outLines.join('\n')
}
