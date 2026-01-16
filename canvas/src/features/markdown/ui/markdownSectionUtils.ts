import { slugify } from '@/features/parsers/markdownJsonLd'
import { splitMarkdownLines } from '@/lib/markdown'
import type { TokenWithLines } from './markdownPreviewLex'

export type TocItem = {
  id: string
  text: string
  depth: number
  index: number // Index in the original tokens array
  startLine: number
  children: TocItem[]
}

export function getMarkdownViewerWidthWrapperClassName(
  mode: 'standard' | 'wide' = 'wide',
): string {
  if (mode === 'standard') return 'w-full max-w-4xl mx-auto min-w-0'
  return 'w-full max-w-none min-w-0'
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
  const cascadeStepPx = args.markdownPresentationMode ? 60 : 52
  const effectiveDepthIndex = Math.max(0, safeDepth - safeCascadeBaseDepth)
  const cascadeTopPx = effectiveDepthIndex * cascadeStepPx
  return {
    topPx: Math.max(0, (Number.isFinite(args.baseTopPx) ? args.baseTopPx : 0) + cascadeTopPx),
    zIndex: 30 - safeDepth,
  }
}

export function buildTocTree(tokens: TokenWithLines[]): TocItem[] {
  const root: TocItem[] = []
  const stack: TocItem[] = []

  tokens.forEach((t, i) => {
    if (t.type === 'heading') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const h = t as any
      const text = h.text || ''
      const id = h.id || slugify(text)
      const depth = h.depth || 1
      const startLine = h.startLine || 0

      if (text) {
        const item: TocItem = {
          id,
          text,
          depth,
          index: i,
          startLine,
          children: [],
        }

        while (stack.length > 0 && stack[stack.length - 1].depth >= depth) {
          stack.pop()
        }

        if (stack.length === 0) {
          root.push(item)
        } else {
          stack[stack.length - 1].children.push(item)
        }
        stack.push(item)
      }
    }
  })
  return root
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

export function findParent(items: TocItem[], id: string): { parent: TocItem | null; siblings: TocItem[]; index: number } | null {
  for (let i = 0; i < items.length; i++) {
    if (items[i].id === id) {
      return { parent: null, siblings: items, index: i }
    }
    const found = findParent(items[i].children, id)
    if (found) {
      if (found.parent === null) {
        // Child of items[i]
        return { parent: items[i], siblings: items[i].children, index: found.index }
      }
      return found
    }
  }
  return null
}
