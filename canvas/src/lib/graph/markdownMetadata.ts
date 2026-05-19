import type { GraphNode, GraphEdge } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import { getDocumentPathFromMetadata, toMetadataRecord } from '@/lib/graph/documentMetadata'
import { getEdgeBaseStroke, getNodeBaseFill } from '@/lib/graph/visualStyles'

type MarkdownNavigationGraphLookup = {
  nodeById?: ReadonlyMap<string, GraphNode> | null
  incidentEdgesByNodeId?: ReadonlyMap<string, GraphEdge[]> | null
}

export const parseLineNumber = (raw: unknown): number | null => {
  if (typeof raw === 'number') return Number.isFinite(raw) ? Math.floor(raw) : null
  if (typeof raw === 'string') {
    const parsed = Number.parseInt(raw, 10)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

export const normalizeLineRange = (start: number, end: number): { start: number; end: number } => {
  const s = Math.max(1, Math.min(start, end))
  const e = Math.max(s, Math.max(start, end))
  return { start: s, end: e }
}

const parseLineRangeFragment = (raw: unknown): { start: number; end: number } | null => {
  if (typeof raw !== 'string') return null
  const text = raw.trim()
  if (!text) return null
  const hashIndex = text.indexOf('#')
  if (hashIndex < 0) return null
  const frag = text.slice(hashIndex + 1).trim()
  const m = frag.match(/^L(\d+)(?:-(\d+))?$/i)
  if (!m) return null
  const startNum = Number.parseInt(m[1] || '', 10)
  const endNum = m[2] ? Number.parseInt(m[2] || '', 10) : startNum
  if (!Number.isFinite(startNum) || !Number.isFinite(endNum)) return null
  if (startNum <= 0 || endNum <= 0) return null
  return normalizeLineRange(startNum, endNum)
}

export const getLineRangeFromMetadata = (
  meta: unknown,
): { start: number; end: number } | null => {
  const record = toMetadataRecord(meta)
  const rawStart = record.lineStart
  const rawEnd = record.lineEnd
  const start = parseLineNumber(rawStart)
  const endRaw = parseLineNumber(rawEnd)
  if (start != null) {
    const end = endRaw != null ? endRaw : start
    return normalizeLineRange(start, end)
  }
  const fromDocumentPath = parseLineRangeFragment(record.documentPath)
  if (fromDocumentPath) return fromDocumentPath
  const fromCodebaseRelPath = parseLineRangeFragment(record.codebaseRelPath)
  if (fromCodebaseRelPath) return fromCodebaseRelPath
  const fromCodebasePath = parseLineRangeFragment(record.codebasePath)
  if (fromCodebasePath) return fromCodebasePath
  return null
}

export type DocumentLocationWithRange = {
  documentPath: string
  lineStart: number
  lineEnd: number
}

export type DocumentLocation = DocumentLocationWithRange

export const getDocumentLocationFromMetadata = (
  meta: unknown,
): DocumentLocationWithRange | null => {
  const record = toMetadataRecord(meta)
  const documentPath = getDocumentPathFromMetadata(record)
  if (!documentPath) return null
  const range = getLineRangeFromMetadata(record)
  if (!range) return null
  return {
    documentPath,
    lineStart: range.start,
    lineEnd: range.end,
  }
}

export const resolveMarkdownNavigationMetadata = (
  args: {
    node: GraphNode | null
    edge: GraphEdge | null
    graphLookup?: MarkdownNavigationGraphLookup | null
  },
): Record<string, unknown> | null => {
  const { node, edge, graphLookup } = args
  if (!node && edge) return (edge.metadata as Record<string, unknown>) || null
  if (!node) return null

  const base = (node.metadata as Record<string, unknown>) || null
  const type = String(node.type || '')
  if (type !== 'MermaidNode' && type !== 'InternalLink' && type !== 'Keyword') return base

  const nodeId = String(node.id || '').trim()
  if (!nodeId) return base

  const nodeById = graphLookup?.nodeById || null
  const incidentEdgesByNodeId = graphLookup?.incidentEdgesByNodeId || null
  if (!nodeById || !incidentEdgesByNodeId) return base

  if (type === 'Keyword') {
    const incidentEdges = incidentEdgesByNodeId.get(nodeId) || []
    const candidates: Array<{ meta: Record<string, unknown>; score: number }> = []
    for (let i = 0; i < incidentEdges.length; i += 1) {
      const e = incidentEdges[i]
      if (!e) continue
      const props = (e.properties && typeof e.properties === 'object' && !Array.isArray(e.properties))
        ? (e.properties as Record<string, unknown>)
        : {}
      const label = String(e.label || '').trim()
      const kind = String(props['keyword:kind'] || '').trim()
      if (label !== 'mentions' && kind !== 'sourceMention') continue
      const sourceId = String(e.source || '').trim()
      const targetId = String(e.target || '').trim()
      const sourceNodeId = targetId === nodeId ? sourceId : sourceId === nodeId ? targetId : ''
      if (!sourceNodeId) continue
      const sourceNode = nodeById.get(sourceNodeId)
      if (!sourceNode) continue
      const sourceMeta = (sourceNode.metadata as Record<string, unknown>) || null
      if (!getDocumentLocationFromMetadata(sourceMeta)) continue
      const countRaw = props.count
      const count = typeof countRaw === 'number' && Number.isFinite(countRaw)
        ? countRaw
        : typeof countRaw === 'string'
          ? Number(countRaw)
          : 0
      candidates.push({ meta: sourceMeta, score: Number.isFinite(count) ? count : 0 })
    }
    candidates.sort((a, b) => b.score - a.score)
    if (candidates[0]?.meta) return candidates[0].meta
    return base
  }

  const resolvePointsToTargets = (sourceNodeId: string): GraphNode[] => {
    const incidentEdges = incidentEdgesByNodeId.get(sourceNodeId) || []
    const targets: GraphNode[] = []
    for (let i = 0; i < incidentEdges.length; i += 1) {
      const edge = incidentEdges[i]
      if (!edge) continue
      if (String(edge.label || '') !== 'pointsTo') continue
      if (String(edge.source || '').trim() !== sourceNodeId) continue
      const targetId = String(edge.target || '').trim()
      if (!targetId) continue
      const target = nodeById.get(targetId)
      if (target) targets.push(target)
    }
    return targets
  }

  const pointsToTargets = resolvePointsToTargets(nodeId)
  if (pointsToTargets.length === 0) return base

  const pickTargetMeta = (target: GraphNode | null): Record<string, unknown> | null => {
    if (!target) return null
    return (target.metadata as Record<string, unknown>) || null
  }

  for (let i = 0; i < pointsToTargets.length; i += 1) {
    const target = pointsToTargets[i]
    if (String(target.type || '') !== 'Anchor') continue
    const meta = pickTargetMeta(target)
    if (meta) return meta
  }

  for (let i = 0; i < pointsToTargets.length; i += 1) {
    const target = pointsToTargets[i]
    if (String(target.type || '') !== 'InternalLink') continue
    const targetId = String(target.id || '').trim()
    if (!targetId) continue
    const secondHopTargets = resolvePointsToTargets(targetId)
    for (let j = 0; j < secondHopTargets.length; j += 1) {
      const secondHopTarget = secondHopTargets[j]
      if (String(secondHopTarget.type || '') !== 'Anchor') continue
      const meta = pickTargetMeta(secondHopTarget)
      if (meta) return meta
    }
  }

  for (let i = 0; i < pointsToTargets.length; i += 1) {
    const target = pointsToTargets[i]
    if (String(target.type || '') !== 'Section') continue
    const meta = pickTargetMeta(target)
    if (meta) return meta
  }

  return base
}

export const computeHighlightedRangeFromLines = (
  editorLineCount: number,
  lineStart: number | null,
  lineEnd: number | null,
): { start: number; end: number } | null => {
  const start = lineStart
  const end = lineEnd ?? lineStart
  if (start == null || end == null) return null
  const safeStart = Math.max(1, Math.min(editorLineCount, start))
  const safeEnd = Math.max(1, Math.min(editorLineCount, end))
  return safeStart <= safeEnd
    ? { start: safeStart, end: safeEnd }
    : { start: safeEnd, end: safeStart }
}

export const getDocumentPathForNode = (node: GraphNode): string => {
  const record = toMetadataRecord(node.metadata as unknown)
  return getDocumentPathFromMetadata(record) || ''
}

export const getDocumentPathForEdge = (edge: GraphEdge): string => {
  const record = toMetadataRecord(edge.metadata as unknown)
  return getDocumentPathFromMetadata(record) || ''
}

export const getNodeBaseColor = (node: GraphNode, schema: GraphSchema | null): string => {
  if (!schema) return ''
  const base = getNodeBaseFill(node as GraphNode, schema)
  return typeof base === 'string' ? base.trim() : ''
}

export const getEdgeBaseColor = (edge: GraphEdge, schema: GraphSchema | null): string => {
  if (!schema) return ''
  const base = getEdgeBaseStroke(edge as GraphEdge, schema)
  return typeof base === 'string' ? base.trim() : ''
}
