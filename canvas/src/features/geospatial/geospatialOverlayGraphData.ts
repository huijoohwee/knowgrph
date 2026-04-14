import type { GraphData, GraphNode, GraphEdge } from '@/lib/graph/types'
import type { SourceFile } from '@/hooks/store/types'
import { extractEmbeddedGeoJsonGraphDataRequests } from '@/lib/markdown/embeddedGeoJson'
import { parseGeoJsonFeatureCollectionFromText } from '@/features/geospatial/geojsonParseCache'
import { buildGraphDataFromFeatureCollection } from '@/lib/graph/io/geojsonToGraphData'
import { hashText } from '@/features/parsers/hash'

const hasGeoCoordinates = (graphData: GraphData | null | undefined): boolean => {
  const nodes = Array.isArray(graphData?.nodes) ? (graphData!.nodes as GraphNode[]) : []
  for (let i = 0; i < nodes.length; i += 1) {
    const props = (nodes[i]?.properties || {}) as Record<string, unknown>
    const geo = props.geo as Record<string, unknown> | null
    if (!geo || typeof geo !== 'object') continue
    const lat = Number(geo.lat)
    const lng = Number(geo.lng)
    if (Number.isFinite(lat) && Number.isFinite(lng)) return true
  }
  return false
}

export type GeospatialOverlayGraphDebugInfo = {
  resolvedFrom: 'direct' | 'sourceFiles' | 'sourceFiles-graph' | 'none'
  sourceDocumentPath: string
  embeddedGeoBlockCount: number
  supplementedNodeCount: number
  sourceFilesCount: number
}

const isMarkdownLikeName = (value: string): boolean => /\.(md|markdown|mmd)$/i.test(String(value || '').trim())
const normalizeWorkspaceDocLike = (value: string): string => {
  const raw = String(value || '').trim()
  if (!raw) return ''
  const withoutWorkspace = raw.startsWith('workspace:') ? raw.slice('workspace:'.length) : raw
  return withoutWorkspace.replace(/^\/+/, '')
}
const basenameLike = (value: string): string => {
  const n = normalizeWorkspaceDocLike(value)
  const parts = n.split('/').filter(Boolean)
  return parts.length > 0 ? String(parts[parts.length - 1] || '') : ''
}

const mergeGraphDataUnique = (base: GraphData, extra: GraphData): GraphData => {
  const existingNodeIds = new Set<string>((Array.isArray(base.nodes) ? base.nodes : []).map(n => String((n as GraphNode)?.id || '')))
  const extraNodes: GraphNode[] = []
  for (const node of Array.isArray(extra.nodes) ? (extra.nodes as GraphNode[]) : []) {
    const id = String(node?.id || '')
    if (!id || existingNodeIds.has(id)) continue
    existingNodeIds.add(id)
    extraNodes.push(node)
  }
  const existingEdgeIds = new Set<string>((Array.isArray(base.edges) ? base.edges : []).map(e => String((e as GraphEdge)?.id || '')))
  const extraEdges: GraphEdge[] = []
  for (const edge of Array.isArray(extra.edges) ? (extra.edges as GraphEdge[]) : []) {
    const id = String(edge?.id || '')
    if (!id || existingEdgeIds.has(id)) continue
    existingEdgeIds.add(id)
    extraEdges.push(edge)
  }
  if (extraNodes.length === 0 && extraEdges.length === 0) return base
  return {
    ...base,
    nodes: [...(Array.isArray(base.nodes) ? base.nodes : []), ...extraNodes],
    edges: [...(Array.isArray(base.edges) ? base.edges : []), ...extraEdges],
  }
}

const resolveBestSourceFile = (args: {
  graphData: GraphData
  markdownText?: string | null
  sourceDocumentPath?: string | null
  sourceFiles?: SourceFile[] | null
}): SourceFile | null => {
  const directPathNormalized = normalizeWorkspaceDocLike(String(args.sourceDocumentPath || ''))
  const meta = (args.graphData.metadata || {}) as Record<string, unknown>
  const graphId = String(meta.graphId || '').trim()
  const graphIdHint = normalizeWorkspaceDocLike(graphId)
  const files = Array.isArray(args.sourceFiles) ? args.sourceFiles : []
  let best: SourceFile | null = null
  let bestScore = -1
  for (const file of files) {
    const text = String(file?.text || '')
    const path = normalizeWorkspaceDocLike(String(file?.source?.path || ''))
    const name = normalizeWorkspaceDocLike(String(file?.name || ''))
    const id = normalizeWorkspaceDocLike(String(file?.id || ''))
    const haystack = [path, name, id].join(' | ')
    let score = 0
    if (isMarkdownLikeName(path) || isMarkdownLikeName(name)) score += 2
    if (directPathNormalized) {
      if (path === directPathNormalized || name === directPathNormalized || id === directPathNormalized) score += 12
      else if (basenameLike(path) === basenameLike(directPathNormalized) || basenameLike(name) === basenameLike(directPathNormalized)) score += 4
    }
    if (graphIdHint) {
      if (path === graphIdHint || name === graphIdHint || id === graphIdHint) score += 10
      else if (haystack.includes(graphIdHint)) score += 5
      else if (basenameLike(path) === basenameLike(graphIdHint) || basenameLike(name) === basenameLike(graphIdHint)) score += 3
    }
    if (text.includes('"FeatureCollection"') || text.includes('```geojson') || text.includes('```json')) score += 2
    if (score > bestScore) {
      best = file
      bestScore = score
    }
  }
  return bestScore >= 0 ? best : null
}

const resolveMarkdownContext = (args: {
  graphData: GraphData
  markdownText?: string | null
  sourceDocumentPath?: string | null
  sourceFiles?: SourceFile[] | null
}): { markdownText: string; sourceDocumentPath: string } | null => {
  const directText = String(args.markdownText || '')
  const directPath = String(args.sourceDocumentPath || '').trim()
  if (directText.trim() && directPath) return { markdownText: directText, sourceDocumentPath: directPath }

  const best = resolveBestSourceFile(args)
  if (!best) return null
  const fallbackPath = normalizeWorkspaceDocLike(String(best.source?.path || best.name || best.id || directPath || '').trim())
  const fallbackText = String(best.text || '')
  if (!fallbackPath || !fallbackText.trim()) return null
  return { markdownText: fallbackText, sourceDocumentPath: fallbackPath }
}

const attachOverlayDebugInfo = (graphData: GraphData, info: GeospatialOverlayGraphDebugInfo): GraphData => ({
  ...graphData,
  metadata: {
    ...(graphData.metadata && typeof graphData.metadata === 'object' ? graphData.metadata : {}),
    kgGeospatialOverlayDebug: info,
  } as GraphData['metadata'],
})

export function buildGeospatialOverlayGraphData(args: {
  graphData: GraphData
  markdownText?: string | null
  sourceDocumentPath?: string | null
  sourceFiles?: SourceFile[] | null
}): GraphData {
  const graphData = args.graphData
  if (hasGeoCoordinates(graphData)) {
    return attachOverlayDebugInfo(graphData, {
      resolvedFrom: 'none',
      sourceDocumentPath: '',
      embeddedGeoBlockCount: 0,
      supplementedNodeCount: 0,
      sourceFilesCount: Array.isArray(args.sourceFiles) ? args.sourceFiles.length : 0,
    })
  }
  const bestSourceFile = resolveBestSourceFile(args)
  const sourceGraph = bestSourceFile?.parsedGraphData || null
  if (sourceGraph && hasGeoCoordinates(sourceGraph)) {
    const merged = mergeGraphDataUnique(graphData, sourceGraph)
    return attachOverlayDebugInfo(merged, {
      resolvedFrom: 'sourceFiles-graph',
      sourceDocumentPath: normalizeWorkspaceDocLike(String(bestSourceFile?.source?.path || bestSourceFile?.name || '')),
      embeddedGeoBlockCount: 0,
      supplementedNodeCount: Math.max(0, (Array.isArray(merged.nodes) ? merged.nodes.length : 0) - (Array.isArray(graphData.nodes) ? graphData.nodes.length : 0)),
      sourceFilesCount: Array.isArray(args.sourceFiles) ? args.sourceFiles.length : 0,
    })
  }
  const markdownContext = resolveMarkdownContext(args)
  if (!markdownContext) {
    return attachOverlayDebugInfo(graphData, {
      resolvedFrom: 'none',
      sourceDocumentPath: '',
      embeddedGeoBlockCount: 0,
      supplementedNodeCount: 0,
      sourceFilesCount: Array.isArray(args.sourceFiles) ? args.sourceFiles.length : 0,
    })
  }
  const { markdownText, sourceDocumentPath } = markdownContext
  const resolvedFrom: GeospatialOverlayGraphDebugInfo['resolvedFrom'] =
    String(args.markdownText || '').trim() && String(args.sourceDocumentPath || '').trim() ? 'direct' : 'sourceFiles'

  const reqs = extractEmbeddedGeoJsonGraphDataRequests({
    markdownText,
    sourceDocumentPath,
    limit: 8,
  })
  if (reqs.length === 0) {
    return attachOverlayDebugInfo(graphData, {
      resolvedFrom,
      sourceDocumentPath,
      embeddedGeoBlockCount: 0,
      supplementedNodeCount: 0,
      sourceFilesCount: Array.isArray(args.sourceFiles) ? args.sourceFiles.length : 0,
    })
  }

  const existingNodeIds = new Set<string>((Array.isArray(graphData.nodes) ? graphData.nodes : []).map(n => String((n as GraphNode)?.id || '')))
  const extraNodes: GraphNode[] = []
  const extraEdges: GraphEdge[] = []

  for (const req of reqs) {
    const fc = parseGeoJsonFeatureCollectionFromText(String(req.codeBlock.text || ''))
    if (!fc) continue
    const built = buildGraphDataFromFeatureCollection({
      featureCollection: fc,
      sourcePath: `${sourceDocumentPath}#overlay`,
      sourceHash: hashText(String(req.codeBlock.text || '')),
    })
    if (!built) continue
    const builtNodes = Array.isArray(built.nodes) ? (built.nodes as GraphNode[]) : []
    const builtEdges = Array.isArray(built.edges) ? (built.edges as GraphEdge[]) : []
    for (const node of builtNodes) {
      const id = String(node?.id || '')
      if (!id || existingNodeIds.has(id)) continue
      existingNodeIds.add(id)
      extraNodes.push(node)
    }
    if (builtEdges.length > 0) extraEdges.push(...builtEdges)
  }

  if (extraNodes.length === 0 && extraEdges.length === 0) {
    return attachOverlayDebugInfo(graphData, {
      resolvedFrom,
      sourceDocumentPath,
      embeddedGeoBlockCount: reqs.length,
      supplementedNodeCount: 0,
      sourceFilesCount: Array.isArray(args.sourceFiles) ? args.sourceFiles.length : 0,
    })
  }
  return attachOverlayDebugInfo({
    ...graphData,
    nodes: [...(Array.isArray(graphData.nodes) ? graphData.nodes : []), ...extraNodes],
    edges: [...(Array.isArray(graphData.edges) ? graphData.edges : []), ...extraEdges],
  }, {
    resolvedFrom,
    sourceDocumentPath,
    embeddedGeoBlockCount: reqs.length,
    supplementedNodeCount: extraNodes.length,
    sourceFilesCount: Array.isArray(args.sourceFiles) ? args.sourceFiles.length : 0,
  })
}
