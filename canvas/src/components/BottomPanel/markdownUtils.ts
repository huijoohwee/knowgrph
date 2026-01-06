import type { GraphData } from '@/lib/graph/types'
import { getDocumentPathFromMetadata } from '@/features/graph-data-table/graphDataTable'

export type MarkdownSelectionInfo = {
  id: string
  kind: 'node' | 'edge'
  documentPath: string
  lineStart: number | null
  lineEnd: number | null
}

export function parseLineNumber(raw: unknown): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null
  if (typeof raw === 'string') {
    const parsed = Number.parseInt(raw, 10)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

export function getSelectionInfo(
  graphData: GraphData | null,
  selectedNodeId: string | null,
  selectedEdgeId: string | null,
): MarkdownSelectionInfo | null {
  if (!graphData) return null
  const id = selectedNodeId || selectedEdgeId
  if (!id) return null
  const node = graphData.nodes.find(n => n.id === id)
  if (node) {
    const meta = node.metadata as unknown
    return {
      id,
      kind: 'node',
      documentPath: getDocumentPathFromMetadata(meta),
      lineStart: parseLineNumber((meta as Record<string, unknown> | null)?.lineStart),
      lineEnd: parseLineNumber((meta as Record<string, unknown> | null)?.lineEnd),
    }
  }
  const edge = graphData.edges.find(e => e.id === id)
  if (edge) {
    const meta = edge.metadata as unknown
    return {
      id,
      kind: 'edge',
      documentPath: getDocumentPathFromMetadata(meta),
      lineStart: parseLineNumber((meta as Record<string, unknown> | null)?.lineStart),
      lineEnd: parseLineNumber((meta as Record<string, unknown> | null)?.lineEnd),
    }
  }
  return null
}

export function getDefaultDocumentPath(graphData: GraphData | null): string {
  if (!graphData) return ''
  for (const node of graphData.nodes) {
    const path = getDocumentPathFromMetadata(node.metadata as unknown)
    if (path) return path
  }
  for (const edge of graphData.edges) {
    const path = getDocumentPathFromMetadata(edge.metadata as unknown)
    if (path) return path
  }
  return ''
}

export function computeHighlightedLineRange(
  editorLineCount: number,
  selectionInfo: MarkdownSelectionInfo | null,
): { start: number; end: number } | null {
  const start = selectionInfo?.lineStart ?? null
  const end = selectionInfo?.lineEnd ?? selectionInfo?.lineStart ?? null
  if (start == null || end == null) return null
  const safeStart = Math.max(1, Math.min(editorLineCount, start))
  const safeEnd = Math.max(1, Math.min(editorLineCount, end))
  return safeStart <= safeEnd ? { start: safeStart, end: safeEnd } : { start: safeEnd, end: safeStart }
}

export function computeVisibleLineRange(args: {
  scrollTop: number
  viewportHeight: number
  lineCount: number
  lineHeight: number
}): { startLine: number; endLine: number } {
  const { scrollTop, viewportHeight, lineCount, lineHeight } = args
  const safeLineHeight = Math.max(1, lineHeight || 16)
  const safeLineCount = Math.max(1, lineCount || 1)
  const firstVisibleRaw = Math.max(1, Math.floor(scrollTop / safeLineHeight) + 1)
  const firstVisible = Math.min(safeLineCount, firstVisibleRaw)
  const visibleRows = Math.max(1, Math.ceil(viewportHeight / safeLineHeight))
  const startLine = Math.max(1, Math.min(safeLineCount, firstVisible - 8))
  const endLine = Math.max(startLine, Math.min(safeLineCount, firstVisible + visibleRows + 16))
  return { startLine, endLine }
}
