import type { GraphData } from '@/lib/graph/types'
import { getDocumentLocationFromMetadata, normalizeLineRange } from '@/lib/graph/markdownMetadata'
import { matchesMarkdownDocumentPath, normalizeMarkdownDocumentPath } from 'grph-shared/markdown/documentPath'

export type MarkdownSelectionTarget = {
  kind: 'node' | 'edge'
  id: string
}

export const findSelectionTarget = (
  data: GraphData | null,
  documentPath: string,
  startLine: number,
  endLine: number,
): MarkdownSelectionTarget | null => {
  if (!data) return null
  const requestedPath = normalizeMarkdownDocumentPath(documentPath)
  const safeRange = normalizeLineRange(startLine, endLine)
  let bestKind: 'node' | 'edge' | null = null
  let bestId: string | null = null
  let bestOverlap = 0
  let bestSpan = Number.POSITIVE_INFINITY
  const consider = (kind: 'node' | 'edge', id: string, meta: unknown) => {
    const location = getDocumentLocationFromMetadata(meta)
    if (!location) return
    if (requestedPath && !matchesMarkdownDocumentPath(location.documentPath || '', requestedPath)) return
    const candStart = location.lineStart
    const candEnd = location.lineEnd
    const overlapStart = Math.max(safeRange.start, candStart)
    const overlapEnd = Math.min(safeRange.end, candEnd)
    const overlap = overlapEnd >= overlapStart ? overlapEnd - overlapStart + 1 : 0
    if (overlap <= 0) return
    const span = candEnd - candStart + 1
    if (overlap > bestOverlap || (overlap === bestOverlap && span < bestSpan)) {
      bestOverlap = overlap
      bestSpan = span
      bestKind = kind
      bestId = id
    }
  }
  const nodes = data.nodes || []
  const edges = data.edges || []
  for (const n of nodes) {
    consider('node', String(n.id || ''), n.metadata)
  }
  for (const e of edges) {
    consider('edge', String(e.id || ''), e.metadata)
  }
  if (!bestKind || !bestId) return null
  return { kind: bestKind, id: bestId }
}
