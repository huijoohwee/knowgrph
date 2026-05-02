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

function getStickyHeadingHeightByDepth(markdownPresentationMode: boolean): number[] {
  return markdownPresentationMode ? [0, 56, 48, 44, 40, 40, 40] : [0, 53, 45, 40, 36, 32, 28]
}

export function getStickyHeadingCascadeOffsets(args: {
  depth: number
  cascadeBaseDepth: number
  baseTopPx: number
  markdownPresentationMode: boolean
}): { topPx: number; zIndex: number; heightPx: number } {
  const safeDepth = Math.min(6, Math.max(1, args.depth || 1))
  const safeCascadeBaseDepth = Math.min(6, Math.max(1, args.cascadeBaseDepth || 1))

  const heightByDepth = getStickyHeadingHeightByDepth(args.markdownPresentationMode)
  const heightPx = heightByDepth[safeDepth] || 32

  let cascadeOffset = 0
  for (let i = safeCascadeBaseDepth; i < safeDepth; i++) {
    cascadeOffset += heightByDepth[i] || 30
  }

  return {
    topPx: Math.max(0, (Number.isFinite(args.baseTopPx) ? args.baseTopPx : 0) + cascadeOffset),
    zIndex: 30 - safeDepth,
    heightPx,
  }
}

export function computeStickyHeadingScrollPaddingTopPx(args: {
  tokens: TokenWithLines[]
  baseTopPx: number
  markdownPresentationMode: boolean
}): number {
  let minDepth = 7
  let maxDepth = 0
  for (const t of args.tokens) {
    if (t.type !== 'heading') continue
    const depth = Math.min(6, Math.max(1, t.depth || 1))
    minDepth = Math.min(minDepth, depth)
    maxDepth = Math.max(maxDepth, depth)
  }
  if (maxDepth <= 0 || minDepth === 7) return 0
  const { topPx, heightPx } = getStickyHeadingCascadeOffsets({
    depth: maxDepth,
    cascadeBaseDepth: minDepth,
    baseTopPx: args.baseTopPx,
    markdownPresentationMode: args.markdownPresentationMode,
  })
  return Math.max(0, topPx + heightPx + 8)
}

export function buildTocTree(tokens: TokenWithLines[]): TocItem[] {
  const headings: MarkdownHeadingInfo[] = []
  tokens.forEach((t, i) => {
    if (t.type !== 'heading') return
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

export type MarkdownTocMetadata = {
  parentById: Map<string, string | null>
  lineById: Map<string, number>
  headingNumberById: Map<string, string>
  baseDepth: number
}

export type MarkdownTocModel = {
  items: TocItem[]
  metadata: MarkdownTocMetadata
}

export function buildVisibleMarkdownTocModel(args: {
  tokens: TokenWithLines[]
  collapsed?: boolean
}): MarkdownTocModel {
  if (args.collapsed || args.tokens.length === 0) {
    return {
      items: [],
      metadata: buildMarkdownTocMetadata([]),
    }
  }
  const items = buildTocTree(args.tokens)
  return {
    items,
    metadata: buildMarkdownTocMetadata(items),
  }
}

export function filterVisibleMarkdownTokensByCollapsedHeadings(args: {
  tokens: TokenWithLines[]
  collapsedHeadingIds: ReadonlySet<string>
}): TokenWithLines[] {
  if (args.tokens.length === 0 || args.collapsedHeadingIds.size === 0) {
    return args.tokens
  }

  const result: TokenWithLines[] = []
  let skipUntilDepth: number | null = null

  for (const token of args.tokens) {
    if (token.type === 'heading') {
      const depth = token.depth || 1
      const id = token.id || slugify(token.text || '')

      if (skipUntilDepth !== null && depth <= skipUntilDepth) {
        skipUntilDepth = null
      }

      if (skipUntilDepth === null) {
        result.push(token)
        if (args.collapsedHeadingIds.has(id)) {
          skipUntilDepth = depth
        }
      }
      continue
    }

    if (skipUntilDepth === null) {
      result.push(token)
    }
  }

  return result
}

export function buildMarkdownTocMetadata(rootItems: TocItem[]): MarkdownTocMetadata {
  const parentById = new Map<string, string | null>()
  const lineById = new Map<string, number>()
  const headingNumberById = new Map<string, string>()
  let minDepth = Infinity

  const walk = (items: TocItem[], parentId: string | null, path: number[]) => {
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i]!
      const id = String(item.id || '').trim()
      const depth = typeof item.depth === 'number' && Number.isFinite(item.depth) ? item.depth : 1
      minDepth = Math.min(minDepth, Math.max(1, Math.min(6, depth)))
      const nextPath = path.concat([i + 1])
      if (id) {
        parentById.set(id, parentId)
        lineById.set(id, Math.max(1, Math.floor(item.startLine || 1)))
        headingNumberById.set(id, nextPath.join('.'))
      }
      if (item.children.length > 0) walk(item.children, id || parentId, nextPath)
    }
  }
  walk(rootItems, null, [])

  return {
    parentById,
    lineById,
    headingNumberById,
    baseDepth: Number.isFinite(minDepth) ? minDepth : 1,
  }
}

export function buildTocParentById(rootItems: TocItem[]): Map<string, string | null> {
  return buildMarkdownTocMetadata(rootItems).parentById
}

export function buildTocLineById(rootItems: TocItem[]): Map<string, number> {
  return buildMarkdownTocMetadata(rootItems).lineById
}

export function buildTocHeadingNumberById(rootItems: TocItem[]): Map<string, string> {
  return buildMarkdownTocMetadata(rootItems).headingNumberById
}

export function resolveTocBaseDepth(rootItems: TocItem[]): number {
  return buildMarkdownTocMetadata(rootItems).baseDepth
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
