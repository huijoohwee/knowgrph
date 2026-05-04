import { hashStringToHex } from '@/lib/hash/stringHash'
import { toMetadataRecord } from '@/lib/graph/documentMetadata'
import { readNodeProperties } from '@/lib/graph/nodeProperties'
import type { GraphNode } from '@/lib/graph/types'

type LayoutDatasetGraph = {
  metadata?: unknown
  nodes?: Array<{ id?: unknown; type?: unknown; properties?: unknown; metadata?: unknown }>
  edges?: Array<{ source?: unknown; target?: unknown; label?: unknown; id?: unknown }>
} | null

export const computeLayoutDatasetKey = (args: { graphData: LayoutDatasetGraph; graphDataRevision: number }): string => {
  const rev = Number.isFinite(args.graphDataRevision) ? Math.floor(args.graphDataRevision) : 0
  const graphData = args.graphData
  const meta = toMetadataRecord(graphData?.metadata)

  const kind = typeof meta.kind === 'string' ? meta.kind.trim() : ''
  if (kind === 'keyword') {
    const baselineDatasetKey = typeof meta.baselineDatasetKey === 'string' ? meta.baselineDatasetKey.trim() : ''
    if (baselineDatasetKey) return baselineDatasetKey
    const baselineSourceLayerHash = typeof meta.baselineSourceLayerHash === 'string' ? meta.baselineSourceLayerHash.trim() : ''
    if (baselineSourceLayerHash) return `sourceLayer:${baselineSourceLayerHash}`
  }

  const sourceLayerHash = typeof meta.sourceLayerHash === 'string' ? meta.sourceLayerHash.trim() : ''
  if (sourceLayerHash) return `sourceLayer:${sourceLayerHash}`

  const graphId = typeof meta.graphId === 'string' ? meta.graphId.trim() : ''
  if (graphId) return `graphId:${graphId}`

  const source = typeof meta.source === 'string' ? meta.source.trim() : ''
  if (kind || source) return `meta:${kind}:${source}`

  const nodes = Array.isArray(graphData?.nodes) ? graphData!.nodes! : []
  for (let i = 0; i < nodes.length; i += 1) {
    const n = nodes[i]
    const t = typeof n?.type === 'string' ? n.type.trim() : ''
    if (t !== 'Document') continue
    const props = readNodeProperties(n as Pick<GraphNode, 'properties'> | null | undefined)
    const path = typeof props.path === 'string' ? props.path.trim() : ''
    if (path) return `path:${path}`
    const nMeta = toMetadataRecord(n?.metadata)
    const docPath = typeof nMeta.documentPath === 'string' ? nMeta.documentPath.trim() : ''
    if (docPath) return `doc:${docPath}`
    break
  }

  const edges = Array.isArray(graphData?.edges) ? graphData!.edges! : []
  const maxIds = 900
  const nodeIds: string[] = []
  const edgePairs: string[] = []

  for (let i = 0; i < nodes.length && nodeIds.length < maxIds; i += 1) {
    const raw = (nodes[i] as unknown as { id?: unknown })?.id
    const id = typeof raw === 'string' ? raw.trim() : typeof raw === 'number' && Number.isFinite(raw) ? String(raw) : ''
    if (id) nodeIds.push(id)
  }

  for (let i = 0; i < edges.length && edgePairs.length < maxIds; i += 1) {
    const e = edges[i] as unknown as { source?: unknown; target?: unknown }
    const s = typeof e?.source === 'string' ? e.source.trim() : typeof e?.source === 'number' && Number.isFinite(e.source) ? String(e.source) : ''
    const t = typeof e?.target === 'string' ? e.target.trim() : typeof e?.target === 'number' && Number.isFinite(e.target) ? String(e.target) : ''
    if (!s || !t) continue
    edgePairs.push(`${s}->${t}`)
  }

  if (nodeIds.length > 0 || edgePairs.length > 0) {
    const signature = [
      `n=${nodes.length}`,
      `e=${edges.length}`,
      `ns=${nodeIds.sort().join(',')}`,
      `es=${edgePairs.sort().join(',')}`,
    ].join('|')
    return `shape:${hashStringToHex(signature)}`
  }

  return `rev:${rev}`
}

export const buildLayoutViewKey = (args: {
  schemaLayoutEngineJson: string
  frontmatterModeEnabled: boolean
  documentSemanticMode: string
  graphMetaKey: string
  renderMediaAsNodes: boolean
  mediaPanelDensity: string
  collapsedGroupIdsKey: string
}): string => {
  return [
    String(args.schemaLayoutEngineJson),
    String(args.frontmatterModeEnabled ? 1 : 0),
    String(args.documentSemanticMode),
    String(args.graphMetaKey),
    String(args.renderMediaAsNodes ? 1 : 0),
    String(args.mediaPanelDensity),
    String(args.collapsedGroupIdsKey),
  ].join('|')
}

export const buildLayoutPositionCacheKey = (args: {
  datasetKey: string
  mode: string
  frontmatterMode: boolean
  semanticMode: string
  renderMode: '2d' | '3d'
  renderVariant?: string
  layoutVariant?: string
  viewKey?: string
}): string => {
  const datasetKey = String(args.datasetKey || '').trim() || 'dataset:unknown'
  const baseKey = `${datasetKey}:${String(args.semanticMode || 'document')}:${args.frontmatterMode ? 'frontmatter' : 'default'}:${args.mode}:${args.renderMode}`
  const parts = [baseKey]
  const vk = typeof args.viewKey === 'string' ? args.viewKey.trim() : ''
  const rv = typeof args.renderVariant === 'string' ? args.renderVariant.trim() : ''
  const lv = typeof args.layoutVariant === 'string' ? args.layoutVariant.trim() : ''
  if (vk) parts.push(`v=${hashStringToHex(vk)}`)
  if (rv) parts.push(rv)
  if (lv) parts.push(lv)
  return parts.join(':')
}
