import type { GraphNode } from '@/lib/graph/types'
import type { FlowConnectedValuesBySchemaPath } from '@/lib/flowEditor/flowDataflow'
import { applyConnectedValuesToNodeForRender, hasConnectedValuesBySchemaPath } from '@/lib/render/effectiveMediaNode'
import { FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID } from '@/lib/config.flow-editor'

export type RichMediaPanelTab = 'auto' | 'text' | 'image' | 'video' | 'audio' | 'poi'

export type RichMediaPanelOverlayState = {
  activeTab: RichMediaPanelTab
  freezeConnectedOutput: boolean
  hasText: boolean
  hasImage: boolean
  hasVideo: boolean
  hasAudio: boolean
  hasPoi: boolean
  text: string
  connectedText: string
  isLoading: boolean
  loadingLabel: string
}

const RICH_MEDIA_CONNECTED_RENDER_PATHS = [
  'properties.output',
  'properties.outputSrcDoc',
  'properties.imageUrl',
  'properties.videoUrl',
  'properties.audioUrl',
] as const

function readLoadingStateFromNode(node: GraphNode | null | undefined): { loading: boolean; kind: 'text' | 'image' | 'video' | 'audio' | '' } {
  if (!node) return { loading: false, kind: '' }
  const props = (node.properties || {}) as Record<string, unknown>
  const loading = Boolean(props.outputLoading)
  if (!loading) return { loading: false, kind: '' }
  const runSignal = typeof props.lastRunAt === 'string' ? props.lastRunAt.trim() : ''
  if (!runSignal) return { loading: false, kind: '' }
  const kindRaw = String(props.outputLoadingKind || '').trim().toLowerCase()
  const kind = kindRaw === 'text' || kindRaw === 'image' || kindRaw === 'video' || kindRaw === 'audio' ? kindRaw : ''
  return { loading: true, kind }
}

function loadingLabelFromKind(kind: 'text' | 'image' | 'video' | 'audio' | ''): string {
  if (kind === 'text') return 'Generating text...'
  if (kind === 'image') return 'Generating image...'
  if (kind === 'video') return 'Generating video...'
  if (kind === 'audio') return 'Generating audio...'
  return 'Generating output...'
}

export function normalizeConnectedTextValue(value: unknown): string {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) {
    const parts = value
      .map(item => (typeof item === 'string' ? item.trim() : ''))
      .filter(Boolean)
    return parts.join('\n').trim()
  }
  return ''
}

export function buildStaticRichMediaPanelOverlayState(args: {
  renderKind?: unknown
  activeTab?: unknown
  text?: unknown
  connectedText?: unknown
  isLoading?: unknown
  loadingLabel?: unknown
}): RichMediaPanelOverlayState {
  const renderKind = String(args.renderKind || '').trim().toLowerCase()
  const requestedTab = String(args.activeTab || '').trim().toLowerCase()
  const activeTab: RichMediaPanelOverlayState['activeTab'] =
    requestedTab === 'text' || requestedTab === 'image' || requestedTab === 'video' || requestedTab === 'audio' || requestedTab === 'poi' || requestedTab === 'auto'
      ? (requestedTab as RichMediaPanelOverlayState['activeTab'])
      : renderKind === 'image' || renderKind === 'svg'
        ? 'image'
        : renderKind === 'video'
          ? 'video'
          : renderKind === 'audio'
            ? 'audio'
            : 'auto'
  const text = normalizeConnectedTextValue(args.text)
  const connectedText = normalizeConnectedTextValue(args.connectedText)
  const loadingLabel = typeof args.loadingLabel === 'string' ? args.loadingLabel.trim() : ''
  return {
    activeTab,
    freezeConnectedOutput: false,
    hasText: Boolean(text || connectedText),
    hasImage: renderKind === 'image' || renderKind === 'svg',
    hasVideo: renderKind === 'video',
    hasAudio: renderKind === 'audio',
    hasPoi: activeTab === 'poi',
    text,
    connectedText,
    isLoading: args.isLoading === true,
    loadingLabel,
  }
}

function deriveRichMediaPanelLoadingSourceLabels(args: {
  connectedValuesBySchemaPath?: FlowConnectedValuesBySchemaPath
  nodeById?: ReadonlyMap<string, GraphNode>
}): { loading: boolean; kind: 'text' | 'image' | 'video' | 'audio' | ''; sourceLabels: string[] } {
  const connectedValuesBySchemaPath = args.connectedValuesBySchemaPath
  const nodeById = args.nodeById
  if (!connectedValuesBySchemaPath || !nodeById) return { loading: false, kind: '', sourceLabels: [] }
  const seenSourceIds = new Set<string>()
  const sourceLabels: string[] = []
  let kind: 'text' | 'image' | 'video' | 'audio' | '' = ''
  let loading = false
  for (let idx = 0; idx < RICH_MEDIA_CONNECTED_RENDER_PATHS.length; idx += 1) {
    const path = RICH_MEDIA_CONNECTED_RENDER_PATHS[idx]
    const rec = connectedValuesBySchemaPath[path]
    const sources = Array.isArray(rec?.sources) ? rec.sources : []
    for (let i = 0; i < sources.length; i += 1) {
      const sourceId = String(sources[i]?.nodeId || '').trim()
      if (!sourceId || seenSourceIds.has(sourceId)) continue
      seenSourceIds.add(sourceId)
      const sourceNode = nodeById.get(sourceId) || null
      const next = readLoadingStateFromNode(sourceNode)
      if (!next.loading) continue
      loading = true
      if (!kind && next.kind) kind = next.kind
      const label = String(sourceNode?.label || sourceNode?.id || '').trim()
      if (label) sourceLabels.push(label)
    }
  }
  return { loading, kind, sourceLabels }
}

export function resolveRichMediaPanelRenderNode(args: {
  node: GraphNode
  connectedValuesBySchemaPath?: FlowConnectedValuesBySchemaPath
}): GraphNode {
  const baseNode = args.node
  const connectedValuesBySchemaPath = args.connectedValuesBySchemaPath
  if (!hasConnectedValuesBySchemaPath(connectedValuesBySchemaPath)) return baseNode
  return applyConnectedValuesToNodeForRender({ node: baseNode, connectedValuesBySchemaPath })
}

export function buildRichMediaPanelOverlayState(args: {
  node: GraphNode
  connectedValuesBySchemaPath?: FlowConnectedValuesBySchemaPath
  nodeById?: ReadonlyMap<string, GraphNode>
  renderNode?: GraphNode
}): RichMediaPanelOverlayState | undefined {
  const baseNode = args.node
  if (String(baseNode.type || '').trim() !== FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID) return undefined
  const connectedValuesBySchemaPath = args.connectedValuesBySchemaPath
  const nodeForState = args.renderNode || resolveRichMediaPanelRenderNode({ node: baseNode, connectedValuesBySchemaPath })
  const props = (nodeForState.properties || {}) as Record<string, unknown>
  const output = typeof props.output === 'string' ? props.output : ''
  const outputSrcDoc = typeof props.outputSrcDoc === 'string' ? props.outputSrcDoc : ''
  const text = outputSrcDoc.trim() ? '' : output
  const imageUrl = typeof props.imageUrl === 'string' ? props.imageUrl : ''
  const videoUrl = typeof props.videoUrl === 'string' ? props.videoUrl : ''
  const audioUrl = typeof props.audioUrl === 'string' ? props.audioUrl : ''
  const genericMediaUrl = typeof props.mediaUrl === 'string'
    ? props.mediaUrl
    : typeof props.media_url === 'string'
      ? props.media_url
      : ''
  const genericMediaKind = typeof props.mediaKind === 'string'
    ? props.mediaKind.trim().toLowerCase()
    : typeof props.media_kind === 'string'
      ? props.media_kind.trim().toLowerCase()
      : ''
  const hasGenericImage = Boolean(genericMediaUrl.trim()) && (genericMediaKind === 'image' || genericMediaKind === 'svg')
  const hasGenericVideo = Boolean(genericMediaUrl.trim()) && genericMediaKind === 'video'
  const hasGenericAudio = Boolean(genericMediaUrl.trim()) && genericMediaKind === 'audio'
  const poiLabel = typeof props.richMediaPoiLabel === 'string' ? props.richMediaPoiLabel : ''
  const poiAddress = typeof props.richMediaPoiAddress === 'string' ? props.richMediaPoiAddress : ''
  const poiCategory = typeof props.richMediaPoiCategory === 'string' ? props.richMediaPoiCategory : ''
  const poiCoordinates = typeof props.richMediaPoiCoordinates === 'string' ? props.richMediaPoiCoordinates : ''
  const rawTab = String(props.richMediaActiveTab || '').trim().toLowerCase()
  const activeTab: RichMediaPanelOverlayState['activeTab'] =
    rawTab === 'text' || rawTab === 'image' || rawTab === 'video' || rawTab === 'audio' || rawTab === 'poi' || rawTab === 'auto'
      ? (rawTab as RichMediaPanelOverlayState['activeTab'])
      : 'auto'
  const freezeConnectedOutput = Boolean(props.freezeConnectedOutput)
  const connectedText = normalizeConnectedTextValue(connectedValuesBySchemaPath?.['properties.output']?.value)
  const localLoading = readLoadingStateFromNode(nodeForState)
  const connectedLoading = deriveRichMediaPanelLoadingSourceLabels({
    connectedValuesBySchemaPath,
    nodeById: args.nodeById,
  })
  const isLoading = localLoading.loading || connectedLoading.loading
  const loadingKind = localLoading.kind || connectedLoading.kind
  const loadingLabel = connectedLoading.sourceLabels.length > 0
    ? `${loadingLabelFromKind(loadingKind)} (${connectedLoading.sourceLabels.join(', ')})`
    : loadingLabelFromKind(loadingKind)
  return {
    activeTab,
    freezeConnectedOutput,
    hasText: Boolean(text.trim() || outputSrcDoc.trim() || connectedText.trim()),
    hasImage: Boolean(imageUrl.trim()) || hasGenericImage,
    hasVideo: Boolean(videoUrl.trim()) || hasGenericVideo,
    hasAudio: Boolean(audioUrl.trim()) || hasGenericAudio,
    hasPoi: Boolean(
      poiLabel.trim()
      || poiAddress.trim()
      || poiCategory.trim()
      || poiCoordinates.trim()
      || (activeTab === 'poi' && outputSrcDoc.trim()),
    ),
    text,
    connectedText,
    isLoading,
    loadingLabel,
  }
}
