import { hashStringToHex } from '@/lib/hash/stringHash'

type LayoutDatasetGraph = {
  metadata?: unknown
  nodes?: Array<{ type?: unknown; properties?: unknown; metadata?: unknown }>
} | null

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

export const computeLayoutDatasetKey = (args: { graphData: LayoutDatasetGraph; graphDataRevision: number }): string => {
  const rev = Number.isFinite(args.graphDataRevision) ? Math.floor(args.graphDataRevision) : 0
  const graphData = args.graphData
  const meta = isRecord(graphData?.metadata) ? (graphData!.metadata as Record<string, unknown>) : {}

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
    const props = isRecord(n?.properties) ? (n!.properties as Record<string, unknown>) : {}
    const path = typeof props.path === 'string' ? props.path.trim() : ''
    if (path) return `path:${path}`
    const nMeta = isRecord(n?.metadata) ? (n!.metadata as Record<string, unknown>) : {}
    const docPath = typeof nMeta.documentPath === 'string' ? nMeta.documentPath.trim() : ''
    if (docPath) return `doc:${docPath}`
    break
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

