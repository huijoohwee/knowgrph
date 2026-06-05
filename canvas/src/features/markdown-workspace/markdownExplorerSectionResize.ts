export type MarkdownExplorerSectionId = 'sourceFiles' | 'toc' | 'backlinks'

export type MarkdownExplorerSectionBoundary = 'sourceFiles-toc' | 'toc-backlinks'

export type MarkdownExplorerSectionHeightsPx = Record<MarkdownExplorerSectionId, number>

export const MARKDOWN_EXPLORER_SECTION_MIN_HEIGHT_PX = 56

const boundaryPairById: Record<MarkdownExplorerSectionBoundary, readonly [MarkdownExplorerSectionId, MarkdownExplorerSectionId]> = {
  'sourceFiles-toc': ['sourceFiles', 'toc'],
  'toc-backlinks': ['toc', 'backlinks'],
}

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value))

const readElementHeightPx = (element: HTMLElement | null): number | null => {
  if (!element || typeof element.getBoundingClientRect !== 'function') return null
  const height = Math.round(element.getBoundingClientRect().height)
  return Number.isFinite(height) && height > 0 ? height : null
}

export function readMarkdownExplorerSectionHeightsPx(args: {
  sourceFilesElement: HTMLElement | null
  tocElement: HTMLElement | null
  backlinksElement: HTMLElement | null
}): MarkdownExplorerSectionHeightsPx | null {
  const sourceFiles = readElementHeightPx(args.sourceFilesElement)
  const toc = readElementHeightPx(args.tocElement)
  const backlinks = readElementHeightPx(args.backlinksElement)
  if (sourceFiles == null || toc == null || backlinks == null) return null
  return { sourceFiles, toc, backlinks }
}

export function resolveMarkdownExplorerSectionResize(args: {
  boundary: MarkdownExplorerSectionBoundary
  startHeightsPx: MarkdownExplorerSectionHeightsPx
  deltaY: number
  minHeightPx?: number
}): MarkdownExplorerSectionHeightsPx {
  const minHeightPx = Math.max(1, Math.round(args.minHeightPx ?? MARKDOWN_EXPLORER_SECTION_MIN_HEIGHT_PX))
  const [beforeId, afterId] = boundaryPairById[args.boundary]
  const beforeStart = Math.max(minHeightPx, Math.round(args.startHeightsPx[beforeId] || minHeightPx))
  const afterStart = Math.max(minHeightPx, Math.round(args.startHeightsPx[afterId] || minHeightPx))
  const pairTotal = Math.max(minHeightPx * 2, beforeStart + afterStart)
  const beforeNext = clamp(Math.round(beforeStart + args.deltaY), minHeightPx, pairTotal - minHeightPx)
  return {
    ...args.startHeightsPx,
    [beforeId]: beforeNext,
    [afterId]: pairTotal - beforeNext,
  }
}
