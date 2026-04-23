import type { GraphNode } from '@/lib/graph/types'
import { getNodeMediaSpec } from '@/components/GraphCanvas/helpers'
import { coerceMarkdownParenUrl } from '@/features/parsers/markdownJsonLdUtils'
import { fixBrokenMarkdownImageSyntax } from '@/lib/markdown/sanitizeImportedMarkdown'
import type { FlowConnectedValuesBySchemaPath } from '@/lib/flowEditor/flowDataflow'
import {
  FLOW_IMAGE_GENERATION_NODE_LABEL,
  FLOW_IMAGE_GENERATION_NODE_TYPE_ID,
  FLOW_RICH_MEDIA_PANEL_NODE_LABEL,
  FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID,
  FLOW_TEXT_GENERATION_NODE_LABEL,
  FLOW_TEXT_GENERATION_NODE_TYPE_ID,
  FLOW_VIDEO_GENERATION_NODE_LABEL,
  FLOW_VIDEO_GENERATION_NODE_TYPE_ID,
  getFlowEditorSmartWidgetLabel,
} from '@/lib/config.flow-editor'
import { getTextGenerationWidgetLabel } from '@/features/flow-editor-manager/registryTemplates'
import { applyConnectedValuesToNodeForRender } from '@/lib/render/effectiveMediaNode'

export type MediaOverlayKind = 'iframe' | 'image' | 'svg' | 'video'

export type RichMediaPanelOverlayState = {
  activeTab: 'auto' | 'text' | 'image' | 'video'
  freezeConnectedOutput: boolean
  hasText: boolean
  hasImage: boolean
  hasVideo: boolean
  text: string
  connectedText: string
}

export type MediaOverlayNode = {
  id: string
  title: string
  url: string
  srcDoc?: string
  openUrl: string
  interactive: boolean
  kind: MediaOverlayKind
  panel?: RichMediaPanelOverlayState
}

type RankedMediaNode = {
  id: string
  title: string
  url: string
  srcDoc?: string
  openUrl: string
  interactive: boolean
  kind: MediaOverlayKind
  rank: number
  idx: number
}

type Candidate = {
  id: string
  title: string
  url: string
  srcDoc?: string
  openUrl: string
  interactive: boolean
  kind: MediaOverlayKind
  rank: number
  idx: number
  preferred: boolean
}

const RICH_MEDIA_CONNECTED_RENDER_PATHS = [
  'properties.output',
  'properties.outputSrcDoc',
  'properties.imageUrl',
  'properties.videoUrl',
] as const

function decodeRemoteFetchProxyUrl(raw: string): string {
  const trimmed = String(raw || '').trim()
  if (!trimmed) return ''
  const fromPrefixedPath = (() => {
    const prefix = '/__fetch_remote?url='
    if (!trimmed.startsWith(prefix)) return ''
    try {
      return decodeURIComponent(trimmed.slice(prefix.length))
    } catch {
      return trimmed.slice(prefix.length)
    }
  })()
  if (fromPrefixedPath) return fromPrefixedPath
  try {
    const parsed = new URL(trimmed, 'http://localhost')
    if (parsed.pathname !== '/__fetch_remote') return ''
    const encoded = parsed.searchParams.get('url') || ''
    if (!encoded) return ''
    try {
      return decodeURIComponent(encoded)
    } catch {
      return encoded
    }
  } catch {
    return ''
  }
}

function canonicalMediaDedupUrl(raw: string): string {
  let current = String(raw || '').trim()
  if (!current) return ''
  for (let i = 0; i < 3; i += 1) {
    const unwrapped = decodeRemoteFetchProxyUrl(current)
    if (!unwrapped || unwrapped === current) break
    current = unwrapped
  }
  return current
}

function extractStandaloneMarkdownLinkUrlFromText(rawText: unknown): string {
  if (typeof rawText !== 'string') return ''
  const normalized = fixBrokenMarkdownImageSyntax(rawText).text
  const m = normalized.match(/^\s*\[[^\]]+\]\(([^)]+)\)\s*$/)
  if (!m || !m[1]) return ''
  return coerceMarkdownParenUrl(String(m[1]))
}

function chooseOpenUrl(node: GraphNode, specUrl: string): string {
  const props = (node.properties || {}) as Record<string, unknown>
  const fromUrl = typeof props.url === 'string' ? String(props.url || '').trim() : ''
  if (fromUrl) return fromUrl

  const fromText = extractStandaloneMarkdownLinkUrlFromText(props.text)
  if (fromText) return fromText

  const fromMarkdown = extractStandaloneMarkdownLinkUrlFromText(props.markdown)
  if (fromMarkdown) return fromMarkdown

  return String(specUrl || '').trim()
}

function deriveOverlayNodeLabel(node: GraphNode): string {
  const properties = (node.properties || {}) as Record<string, unknown>
  const nodeTypeId = String(node.type || '').trim()
  if (nodeTypeId === FLOW_TEXT_GENERATION_NODE_TYPE_ID) {
    return getTextGenerationWidgetLabel({
      provider: properties.chatProvider,
      widgetTypeId: properties['flow:widgetTypeId'],
      formId: properties['flow:widgetFormId'],
    })
  }
  if (nodeTypeId === FLOW_IMAGE_GENERATION_NODE_TYPE_ID) {
    return getFlowEditorSmartWidgetLabel({
      mode: 'image',
      model: properties.model,
    })
  }
  if (nodeTypeId === FLOW_VIDEO_GENERATION_NODE_TYPE_ID) {
    return getFlowEditorSmartWidgetLabel({
      mode: 'video',
      model: properties.model,
    })
  }
  if (nodeTypeId === FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID) {
    return FLOW_RICH_MEDIA_PANEL_NODE_LABEL
  }
  return String(node.label || node.id || '').trim() || nodeTypeId || 'Media node'
}

function deriveRichMediaPanelSourceLabels(args: {
  node: GraphNode
  nodeById: ReadonlyMap<string, GraphNode>
  connectedValuesBySchemaPath?: FlowConnectedValuesBySchemaPath
}): string[] {
  if (String(args.node.type || '').trim() !== FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID) return []
  const connectedValuesBySchemaPath = args.connectedValuesBySchemaPath
  if (!connectedValuesBySchemaPath) return []

  const labels: string[] = []
  const seenNodeIds = new Set<string>()
  const seenLabels = new Set<string>()
  const selfId = String(args.node.id || '').trim()

  for (let i = 0; i < RICH_MEDIA_CONNECTED_RENDER_PATHS.length; i += 1) {
    const path = RICH_MEDIA_CONNECTED_RENDER_PATHS[i]
    const connected = connectedValuesBySchemaPath[path]
    const sources = Array.isArray(connected?.sources) ? connected.sources : []
    for (let j = 0; j < sources.length; j += 1) {
      const sourceId = String(sources[j]?.nodeId || '').trim()
      if (!sourceId || sourceId === selfId || seenNodeIds.has(sourceId)) continue
      seenNodeIds.add(sourceId)
      const sourceNode = args.nodeById.get(sourceId)
      if (!sourceNode) continue
      const label = deriveOverlayNodeLabel(sourceNode)
      if (!label || seenLabels.has(label)) continue
      seenLabels.add(label)
      labels.push(label)
    }
  }

  return labels
}

function buildOverlayTitle(args: {
  node: GraphNode
  nodeById: ReadonlyMap<string, GraphNode>
  connectedValuesBySchemaPath?: FlowConnectedValuesBySchemaPath
}): string {
  const sourceLabels = deriveRichMediaPanelSourceLabels(args)
  const base = deriveOverlayNodeLabel(args.node)
  if (String(args.node.type || '').trim() === FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID && sourceLabels.length > 0) {
    return `${base} for ${sourceLabels.join(', ')}`
  }
  return base || 'Media node'
}

function computeMediaRank(node: GraphNode, spec: { kind: string; url: string }): number {
  const props = (node.properties || {}) as Record<string, unknown>
  let score = 0

  const hasExplicit =
    typeof props.media_url === 'string' ||
    typeof props.mediaUrl === 'string' ||
    typeof props.iframe_url === 'string' ||
    typeof props.iframeUrl === 'string' ||
    typeof props.image === 'string' ||
    typeof props.imageUrl === 'string' ||
    typeof props.video === 'string' ||
    typeof props.videoUrl === 'string' ||
    typeof props.media === 'string'
  if (hasExplicit) score += 100

  const hasLegacy = typeof props.image_url === 'string' || typeof props.video_url === 'string'
  if (hasLegacy) score += 50

  const typeRaw = String(node.type || '').toLowerCase()
  // Keep Rich Media Panel as canonical renderer when media URLs collide with source widgets.
  if (typeRaw === 'richmediapanel' || typeRaw === 'rich media panel') {
    score += 160
  }
  if (typeRaw === 'image' || typeRaw === 'video' || typeRaw === 'iframe' || typeRaw === 'webpageelement' || typeRaw === 'link') {
    score += 20
  }

  const domTag = typeof props['dom:tag'] === 'string' ? String(props['dom:tag']).trim().toUpperCase() : ''
  if (domTag === 'IMG' || domTag === 'VIDEO' || domTag === 'IFRAME' || domTag === 'SVG') score += 20

  const url = String(spec.url || '').toLowerCase()
  if (url.includes('mmbiz.qpic.cn') || url.includes('wx_fmt=')) score += 220

  const kind = String(spec.kind || '').toLowerCase()
  if (kind === 'image' || kind === 'svg') score += 10
  else if (kind === 'video') score += 8
  else if (kind === 'iframe') score += 6

  return score
}

function pushTopRanked(list: RankedMediaNode[], item: RankedMediaNode, limit: number) {
  if (limit <= 0) return
  if (list.length < limit) {
    list.push(item)
  } else {
    const worst = list[list.length - 1]!
    if (item.rank < worst.rank) return
    if (item.rank === worst.rank && item.idx >= worst.idx) return
    list[list.length - 1] = item
  }
  for (let i = list.length - 1; i > 0; i -= 1) {
    const a = list[i - 1]!
    const b = list[i]!
    if (a.rank > b.rank) break
    if (a.rank === b.rank && a.idx <= b.idx) break
    list[i - 1] = b
    list[i] = a
  }
}

export function listMediaOverlayNodes(args: {
  enabled: boolean
  nodes: GraphNode[]
  poolMax: number
  kinds?: readonly MediaOverlayKind[]
  preferredNodeIds?: readonly string[]
  excludeNodeIdSet?: Set<string>
  connectedValuesByNodeId?: ReadonlyMap<string, FlowConnectedValuesBySchemaPath>
}): MediaOverlayNode[] {
  if (!args.enabled) return []
  const nodes = Array.isArray(args.nodes) ? args.nodes : []
  const poolMax = Number.isFinite(args.poolMax) ? Math.max(0, Math.floor(args.poolMax)) : 0
  const kinds = new Set<MediaOverlayKind>((args.kinds || ['iframe', 'image', 'svg', 'video']) as MediaOverlayKind[])
  if (poolMax <= 0) return []
  const preferred = (args.preferredNodeIds || []).map(v => String(v || '').trim()).filter(Boolean)
  const preferredSet = preferred.length ? new Set(preferred) : null
  const exclude = args.excludeNodeIdSet || null
  const connectedValuesByNodeId = args.connectedValuesByNodeId || null
  const nodeById = new Map<string, GraphNode>()
  for (let i = 0; i < nodes.length; i += 1) {
    const node = nodes[i]
    const id = String(node?.id || '').trim()
    if (!id) continue
    nodeById.set(id, node)
  }

  const candidates: Candidate[] = []
  for (let i = 0; i < nodes.length; i += 1) {
    const n0 = nodes[i]
    const id = String(n0?.id || '').trim()
    if (!id) continue
    if (exclude?.has(id)) continue

    const connectedValuesBySchemaPath = connectedValuesByNodeId?.get(id)
    const nodeForSpec = (() => {
      if (!connectedValuesBySchemaPath || Object.keys(connectedValuesBySchemaPath).length === 0) return n0
      const connectedNode = applyConnectedValuesToNodeForRender({ node: n0, connectedValuesBySchemaPath })
      const connectedSpec = getNodeMediaSpec(connectedNode)
      if (connectedSpec) return connectedNode
      return n0
    })()
    const spec = getNodeMediaSpec(nodeForSpec)
    if (!spec) continue
    const kind = spec.kind as MediaOverlayKind
    if (!kinds.has(kind)) continue
    const title = buildOverlayTitle({
      node: n0,
      nodeById,
      connectedValuesBySchemaPath,
    })
    const openUrl = chooseOpenUrl(nodeForSpec, spec.url)
    const panel = (() => {
      if (String(nodeForSpec.type || '').trim() !== FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID) return undefined
      const props = (nodeForSpec.properties || {}) as Record<string, unknown>
      const output = typeof props.output === 'string' ? props.output : ''
      const outputSrcDoc = typeof props.outputSrcDoc === 'string' ? props.outputSrcDoc : ''
      const imageUrl = typeof props.imageUrl === 'string' ? props.imageUrl : ''
      const videoUrl = typeof props.videoUrl === 'string' ? props.videoUrl : ''
      const rawTab = String(props.richMediaActiveTab || '').trim().toLowerCase()
      const activeTab: RichMediaPanelOverlayState['activeTab'] =
        rawTab === 'text' || rawTab === 'image' || rawTab === 'video' || rawTab === 'auto'
          ? (rawTab as RichMediaPanelOverlayState['activeTab'])
          : 'auto'
      const freezeConnectedOutput = Boolean(props.freezeConnectedOutput)
      const connectedText = (() => {
        const v = connectedValuesBySchemaPath?.['properties.output']?.value
        return typeof v === 'string' ? v : ''
      })()
      return {
        activeTab,
        freezeConnectedOutput,
        hasText: Boolean(output.trim() || outputSrcDoc.trim()),
        hasImage: Boolean(imageUrl.trim()),
        hasVideo: Boolean(videoUrl.trim()),
        text: output,
        connectedText,
      }
    })()
    const preferredHit = preferredSet?.has(id) === true
    const rankBase = computeMediaRank(nodeForSpec, spec)
    const rank = preferredHit ? rankBase + 1000 : rankBase
    candidates.push({
      id,
      title,
      url: spec.url,
      ...(typeof (spec as { srcDoc?: unknown }).srcDoc === 'string' && String((spec as { srcDoc?: string }).srcDoc || '').trim()
        ? { srcDoc: String((spec as { srcDoc?: string }).srcDoc || '') }
        : {}),
      openUrl,
      interactive: spec.interactive,
      kind,
      ...(panel ? { panel } : {}),
      rank,
      idx: i,
      preferred: preferredHit,
    })
  }

  const bestByKey = new Map<string, Candidate>()
  for (let i = 0; i < candidates.length; i += 1) {
    const c = candidates[i]!
    const keyUrl = canonicalMediaDedupUrl(c.url || c.openUrl)
    const key = `${c.kind}\n${keyUrl || c.id}`
    const prev = bestByKey.get(key)
    if (!prev) {
      bestByKey.set(key, c)
      continue
    }
    if (c.rank > prev.rank) {
      bestByKey.set(key, c)
      continue
    }
    if (c.rank === prev.rank && c.idx < prev.idx) {
      bestByKey.set(key, c)
    }
  }

  const unique = Array.from(bestByKey.values())
  unique.sort((a, b) => {
    if (a.rank !== b.rank) return b.rank - a.rank
    return a.idx - b.idx
  })

  return unique.slice(0, poolMax).map(n => ({
    id: n.id,
    title: n.title,
    url: n.url,
    ...(n.srcDoc ? { srcDoc: n.srcDoc } : {}),
    openUrl: n.openUrl,
    interactive: n.interactive,
    kind: n.kind,
    ...(n.panel ? { panel: n.panel } : {}),
  }))
}
