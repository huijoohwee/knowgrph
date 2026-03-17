import { slugify } from 'grph-shared/markdown/slugify'
import { splitMarkdownLines } from '@/lib/markdown'
import type { TokenWithLines } from './markdownPreviewLex'
import {
  buildMarkdownTocTree,
  findMarkdownTocParent,
  type MarkdownHeadingInfo,
  type MarkdownTocItem,
} from 'grph-shared/markdown/toc'

export type TocItem = MarkdownTocItem

export function getMarkdownViewerWidthWrapperClassName(
  mode: 'standard' | 'wide' = 'wide',
): string {
  if (mode === 'standard') return 'w-[var(--kg-viewer-article-width,80%)] max-w-none mx-auto min-w-0 px-8 box-border'
  return 'w-[var(--kg-viewer-article-width,80%)] max-w-none mx-auto min-w-0 px-8 box-border'
}

export function getDefaultStickyHeadingTopPx(providedTopPx: number | undefined): number {
  if (typeof providedTopPx === 'number' && Number.isFinite(providedTopPx)) {
    return Math.max(0, providedTopPx)
  }
  return 0
}

export function getStickyHeadingCascadeOffsets(args: {
  depth: number
  cascadeBaseDepth: number
  baseTopPx: number
  markdownPresentationMode: boolean
}): { topPx: number; zIndex: number } {
  const safeDepth = Math.min(6, Math.max(1, args.depth || 1))
  const safeCascadeBaseDepth = Math.min(6, Math.max(1, args.cascadeBaseDepth || 1))
  
  // Measured heights for headings including padding/border (approximate)
  // H1: ~56px (text-5xl + py-1), H2: ~48px (text-4xl + py-1), H3: ~44px (text-3xl + py-1), H4: ~40px (text-2xl + py-1)
  const heightByDepth = args.markdownPresentationMode
    ? [0, 56, 48, 44, 40, 40, 40] // Presentation mode tends to have larger headers
    : [0, 53, 45, 40, 36, 32, 28] // Viewer mode

  let cascadeOffset = 0
  for (let i = safeCascadeBaseDepth; i < safeDepth; i++) {
    cascadeOffset += heightByDepth[i] || 30
  }

  return {
    topPx: Math.max(0, (Number.isFinite(args.baseTopPx) ? args.baseTopPx : 0) + cascadeOffset),
    zIndex: 30 - safeDepth,
  }
}

export function buildTocTree(tokens: TokenWithLines[]): TocItem[] {
  const headings: MarkdownHeadingInfo[] = []
  tokens.forEach((t, i) => {
    if (t.type !== 'heading') return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const h = t as any
    const text = h.text || ''
    if (!text) return
    const id = h.id || slugify(text)
    if (!id) return
    headings.push({
      id,
      text,
      depth: h.depth || 1,
      index: i,
      startLine: h.startLine || 0,
    })
  })
  return buildMarkdownTocTree(headings)
}

export function reorderMarkdownHeadings(
  markdownText: string,
  tokens: TokenWithLines[],
  parentId: string | null,
  fromIndex: number,
  toIndex: number,
): string {
  if (fromIndex === toIndex) return markdownText

  const rootItems = buildTocTree(tokens)
  
  let siblings: TocItem[] = rootItems

  if (parentId) {
    const parentInfo = findParent(rootItems, parentId)
    const parent = parentInfo ? parentInfo.siblings[parentInfo.index] : null
    if (!parent) return markdownText
    siblings = parent.children
  }

  if (fromIndex < 0 || fromIndex >= siblings.length || toIndex < 0 || toIndex >= siblings.length) {
    return markdownText
  }

  const lines = splitMarkdownLines(markdownText)
  
  const ranges: { start: number; end: number; lines: string[] }[] = []
  
  const getEndLine = (item: TocItem): number => {
    for (let i = item.index + 1; i < tokens.length; i++) {
      const t = tokens[i]
      if (t.type === 'heading') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const h = t as any
        if (h.depth <= item.depth) {
          return h.startLine - 1
        }
      }
    }
    return lines.length
  }

  for (let i = 0; i < siblings.length; i++) {
    const item = siblings[i]
    const startLineNum = item.startLine
    
    let endLineNum: number
    if (i < siblings.length - 1) {
      endLineNum = siblings[i + 1].startLine - 1
    } else {
      endLineNum = getEndLine(item)
    }
    
    const chunkLines = lines.slice(startLineNum - 1, endLineNum)
    ranges.push({
      start: startLineNum,
      end: endLineNum,
      lines: chunkLines,
    })
  }
  
  const firstSiblingStartLine = ranges[0].start
  const lastSiblingEndLine = ranges[ranges.length - 1].end
  
  const prefix = lines.slice(0, firstSiblingStartLine - 1)
  const suffix = lines.slice(lastSiblingEndLine)
  
  const reorderedRanges = [...ranges]
  const [moved] = reorderedRanges.splice(fromIndex, 1)
  reorderedRanges.splice(toIndex, 0, moved)
  
  const newBody = reorderedRanges.flatMap(r => r.lines)
  
  return [...prefix, ...newBody, ...suffix].join('\n')
}

export const findParent = findMarkdownTocParent
