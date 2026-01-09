import type { GraphData, GraphNode, GraphEdge } from '@/lib/graph/types'
import { getDocumentPathFromMetadata } from '@/features/graph-data-table/graphDataTable'
import type { GraphSchema } from '@/lib/graph/schema'
import { getNodeBaseFill, getEdgeBaseStroke } from '@/components/GraphCanvas/helpers'

export type MarkdownSelectionInfo = {
  id: string
  kind: 'node' | 'edge'
  documentPath: string
  lineStart: number | null
  lineEnd: number | null
  highlightBackgroundColor: string | null
  highlightUnderlineColor: string | null
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
  schema: GraphSchema | null,
  selectedNodeId: string | null,
  selectedEdgeId: string | null,
): MarkdownSelectionInfo | null {
  if (!graphData) return null
  const id = selectedNodeId || selectedEdgeId
  if (!id) return null
  const node = graphData.nodes.find(n => n.id === id)
  if (node) {
    const meta = node.metadata as unknown
    const baseColor =
      schema && (node as GraphNode)
        ? getNodeBaseFill(node as GraphNode, schema)
        : ''
    const bg =
      typeof baseColor === 'string' && baseColor.trim()
        ? toRgbaWithAlpha(baseColor, 0.16)
        : null
    return {
      id,
      kind: 'node',
      documentPath: getDocumentPathFromMetadata(meta),
      lineStart: parseLineNumber((meta as Record<string, unknown> | null)?.lineStart),
      lineEnd: parseLineNumber((meta as Record<string, unknown> | null)?.lineEnd),
      highlightBackgroundColor: bg,
      highlightUnderlineColor:
        typeof baseColor === 'string' && baseColor.trim() ? baseColor : null,
    }
  }
  const edge = graphData.edges.find(e => e.id === id)
  if (edge) {
    const meta = edge.metadata as unknown
    const baseColor =
      schema && (edge as GraphEdge)
        ? getEdgeBaseStroke(edge as GraphEdge, schema)
        : ''
    const bg =
      typeof baseColor === 'string' && baseColor.trim()
        ? toRgbaWithAlpha(baseColor, 0.12)
        : null
    return {
      id,
      kind: 'edge',
      documentPath: getDocumentPathFromMetadata(meta),
      lineStart: parseLineNumber((meta as Record<string, unknown> | null)?.lineStart),
      lineEnd: parseLineNumber((meta as Record<string, unknown> | null)?.lineEnd),
      highlightBackgroundColor: bg,
      highlightUnderlineColor:
        typeof baseColor === 'string' && baseColor.trim() ? baseColor : null,
    }
  }
  return null
}

function toRgbaWithAlpha(color: string, alpha: number): string | null {
  const raw = String(color || '').trim()
  if (!raw) {
    return `rgba(251, 191, 36, ${Math.max(0, Math.min(1, alpha))})`
  }
  if (raw.startsWith('#')) {
    if (raw.length === 4) {
      const r = raw[1]
      const g = raw[2]
      const b = raw[3]
      const rr = parseInt(r + r, 16)
      const gg = parseInt(g + g, 16)
      const bb = parseInt(b + b, 16)
      if (Number.isFinite(rr) && Number.isFinite(gg) && Number.isFinite(bb)) {
        return `rgba(${rr}, ${gg}, ${bb}, ${Math.max(0, Math.min(1, alpha))})`
      }
    }
    if (raw.length === 7) {
      const r = parseInt(raw.slice(1, 3), 16)
      const g = parseInt(raw.slice(3, 5), 16)
      const b = parseInt(raw.slice(5, 7), 16)
      if (Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b)) {
        return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`
      }
    }
  }
  return `rgba(251, 191, 36, ${Math.max(0, Math.min(1, alpha))})`
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
