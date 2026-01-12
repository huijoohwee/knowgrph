import type { GraphNode, GraphEdge } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import { getNodeBaseFill, getEdgeBaseStroke } from '@/components/GraphCanvas/helpers'
import { getDocumentPathFromMetadata } from '@/features/graph-data-table/graphDataTable'

export type GraphMetadataRecord = Record<string, unknown>

export const toMetadataRecord = (meta: unknown): GraphMetadataRecord => {
  if (meta && typeof meta === 'object' && !Array.isArray(meta)) {
    return meta as GraphMetadataRecord
  }
  return {}
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
  if (documentPath == null) return null
  const range = getLineRangeFromMetadata(record)
  if (!range) return null
  return {
    documentPath,
    lineStart: range.start,
    lineEnd: range.end,
  }
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
  return getDocumentPathFromMetadata(record)
}

export const getDocumentPathForEdge = (edge: GraphEdge): string => {
  const record = toMetadataRecord(edge.metadata as unknown)
  return getDocumentPathFromMetadata(record)
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
