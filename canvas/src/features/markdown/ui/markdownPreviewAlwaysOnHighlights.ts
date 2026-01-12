import type { TokenWithLines } from './markdownPreviewLex'
import type { GraphData, GraphNode, GraphEdge } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import { getThreeConfig } from '@/lib/graph/schema'
import {
  getDocumentLocationFromMetadata,
  getEdgeBaseColor,
  getNodeBaseColor,
} from '@/lib/graph/markdownMetadata'

export const ALWAYS_ON_HIGHLIGHT_COMPLEXITY_BUDGET = 500000

export type TokenHighlightSpec = {
  textColor: string | null
  underlineColor: string | null
  backgroundColor: string | null
}

type Range = { start: number; end: number; color: string }

type BuildAlwaysOnTokenHighlightsParams = {
  tokens: TokenWithLines[] | null
  alwaysOnHighlightMode: boolean
  activeDocumentPath: string
  graphData: GraphData | null
  schema: GraphSchema | null
  markdownAlwaysOnHighlightComplexityBudget: number | null | undefined
}

const toLayerRgbaWithAlpha = (color: string, alpha: number): string | null => {
  const raw = String(color || '').trim()
  if (!raw) return null
  if (raw.startsWith('#')) {
    if (raw.length === 4) {
      const r = raw[1]
      const g = raw[2]
      const b = raw[3]
      const rr = Number.parseInt(r + r, 16)
      const gg = Number.parseInt(g + g, 16)
      const bb = Number.parseInt(b + b, 16)
      if (Number.isFinite(rr) && Number.isFinite(gg) && Number.isFinite(bb)) {
        return `rgba(${rr}, ${gg}, ${bb}, ${Math.max(0, Math.min(1, alpha))})`
      }
    }
    if (raw.length === 7) {
      const rr = Number.parseInt(raw.slice(1, 3), 16)
      const gg = Number.parseInt(raw.slice(3, 5), 16)
      const bb = Number.parseInt(raw.slice(5, 7), 16)
      if (Number.isFinite(rr) && Number.isFinite(gg) && Number.isFinite(bb)) {
        return `rgba(${rr}, ${gg}, ${bb}, ${Math.max(0, Math.min(1, alpha))})`
      }
    }
  }
  return raw
}

const buildRanges = (
  graphData: GraphData | null,
  activeDocumentPath: string,
  schema: GraphSchema | null,
): { nodeRanges: Range[]; edgeRanges: Range[] } => {
  const data = graphData as GraphData | null
  if (!data) return { nodeRanges: [], edgeRanges: [] }
  const trimmedPath = (activeDocumentPath || '').trim()
  if (!trimmedPath) return { nodeRanges: [], edgeRanges: [] }
  const nodeRanges: Range[] = []
  const edgeRanges: Range[] = []
  const nodes = data.nodes || []
  const edges = data.edges || []
  for (const n of nodes) {
    const location = getDocumentLocationFromMetadata(n.metadata as unknown)
    if (!location) continue
    const docPath = (location.documentPath || '').trim()
    if (!docPath || docPath !== trimmedPath) continue
    const start = location.lineStart
    const end = location.lineEnd
    const color = getNodeBaseColor(n as GraphNode, schema)
    if (!color) continue
    nodeRanges.push({ start, end, color })
  }
  for (const e of edges) {
    const location = getDocumentLocationFromMetadata(e.metadata as unknown)
    if (!location) continue
    const docPath = (location.documentPath || '').trim()
    if (!docPath || docPath !== trimmedPath) continue
    const start = location.lineStart
    const end = location.lineEnd
    const color = getEdgeBaseColor(e as GraphEdge, schema)
    if (!color) continue
    edgeRanges.push({ start, end, color })
  }
  return { nodeRanges, edgeRanges }
}

const pickBestOverlapColor = (
  ranges: Range[],
  tokenStart: number,
  tokenEnd: number,
): string | null => {
  let bestColor: string | null = null
  let bestOverlap = 0
  let bestSpan = Number.POSITIVE_INFINITY
  for (const r of ranges) {
    const overlapStart = Math.max(tokenStart, r.start)
    const overlapEnd = Math.min(tokenEnd, r.end)
    const overlap = overlapEnd >= overlapStart ? overlapEnd - overlapStart + 1 : 0
    if (overlap <= 0) continue
    const span = r.end - r.start + 1
    if (overlap > bestOverlap || (overlap === bestOverlap && span < bestSpan)) {
      bestOverlap = overlap
      bestSpan = span
      bestColor = r.color
    }
  }
  return bestColor
}

const computeLayerBackground = (schema: GraphSchema | null): string | null => {
  if (!schema || !schema.layers || schema.layers.mode !== 'semantic') return null
  const three = getThreeConfig(schema)
  const rawBg = typeof three.backgroundColor === 'string' ? three.backgroundColor.trim() : ''
  if (!rawBg) return null
  const rawAlpha = three.markdownAlwaysOnAlpha
  const alpha =
    typeof rawAlpha === 'number' && Number.isFinite(rawAlpha)
      ? Math.max(0, Math.min(1, rawAlpha))
      : 0.08
  const softened = toLayerRgbaWithAlpha(rawBg, alpha)
  return softened || rawBg
}

export const buildAlwaysOnTokenHighlights = (
  params: BuildAlwaysOnTokenHighlightsParams,
): TokenHighlightSpec[] | null => {
  const {
    tokens,
    alwaysOnHighlightMode,
    activeDocumentPath,
    graphData,
    schema,
    markdownAlwaysOnHighlightComplexityBudget,
  } = params
  if (!alwaysOnHighlightMode) return null
  const data = graphData as GraphData | null
  if (!data) return null
  const tokenCount = tokens ? tokens.length : 0
  if (!tokenCount) return null
  const nodeCount = Array.isArray(data.nodes) ? data.nodes.length : 0
  const edgeCount = Array.isArray(data.edges) ? data.edges.length : 0
  const totalEntities = nodeCount + edgeCount
  if (!totalEntities) return null
  const complexityBudget =
    typeof markdownAlwaysOnHighlightComplexityBudget === 'number'
      ? markdownAlwaysOnHighlightComplexityBudget
      : ALWAYS_ON_HIGHLIGHT_COMPLEXITY_BUDGET
  if (tokenCount * totalEntities > complexityBudget) return null
  const trimmedPath = (activeDocumentPath || '').trim()
  if (!trimmedPath) return null
  const { nodeRanges, edgeRanges } = buildRanges(data, trimmedPath, schema)
  if (!nodeRanges.length && !edgeRanges.length) return null
  const layerBackground = computeLayerBackground(schema)
  const sourceTokens = tokens || []
  const specs: TokenHighlightSpec[] = sourceTokens.map(() => ({
    textColor: null,
    underlineColor: null,
    backgroundColor: null,
  }))
  for (let i = 0; i < sourceTokens.length; i += 1) {
    const t = sourceTokens[i]
    const tStart = t.startLine
    const tEnd = t.endLine || t.startLine
    const bestNodeColor = pickBestOverlapColor(nodeRanges, tStart, tEnd)
    const bestEdgeColor = pickBestOverlapColor(edgeRanges, tStart, tEnd)
    specs[i] = {
      textColor: bestNodeColor,
      underlineColor: bestEdgeColor,
      backgroundColor: bestNodeColor || bestEdgeColor ? layerBackground : null,
    }
  }
  return specs
}

