import type { GraphNode } from '@/lib/graph/types'
import { canonicalNodeIdSetHas } from '@/lib/graph/canonicalNodeIds'
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
import { applyConnectedValuesToNodeForRender, hasConnectedValuesBySchemaPath } from '@/lib/render/effectiveMediaNode'
import { buildRichMediaPanelOverlayState, type RichMediaPanelOverlayState } from '@/lib/render/richMediaPanelState'

export type MediaOverlayKind = 'iframe' | 'image' | 'svg' | 'video' | 'audio'

export type { RichMediaPanelOverlayState } from '@/lib/render/richMediaPanelState'

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

const EMPTY_NODE_BY_ID = new Map<string, GraphNode>()

type Candidate = {
  id: string
  title: string
  url: string
  srcDoc?: string
  openUrl: string
  interactive: boolean
  kind: MediaOverlayKind
  panel?: RichMediaPanelOverlayState
  rank: number
  idx: number
  preferred: boolean
}

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
  const fromOutputSourceUrl = typeof props.outputSourceUrl === 'string' ? String(props.outputSourceUrl || '').trim() : ''
  if (fromOutputSourceUrl) return fromOutputSourceUrl
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

function buildOverlayTitle(args: {
  node: GraphNode
  nodeById: ReadonlyMap<string, GraphNode>
  connectedValuesBySchemaPath?: FlowConnectedValuesBySchemaPath
}): string {
  const base = deriveOverlayNodeLabel(args.node)
  if (String(args.node.type || '').trim() === FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID) {
    return base || FLOW_RICH_MEDIA_PANEL_NODE_LABEL
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
    typeof props.image === 'string' ||
    typeof props.imageUrl === 'string' ||
    typeof props.video === 'string' ||
    typeof props.videoUrl === 'string' ||
    typeof props.audio === 'string' ||
    typeof props.audioUrl === 'string' ||
    typeof props.audio_url === 'string' ||
    typeof props.media === 'string'
  if (hasExplicit) score += 100

  const typeRaw = String(node.type || '').toLowerCase()
  // Keep Rich Media Panel as canonical renderer when media URLs collide with source widgets.
  if (typeRaw === 'richmediapanel' || typeRaw === 'rich media panel') {
    score += 160
  }
  if (typeRaw === 'image' || typeRaw === 'video' || typeRaw === 'audio' || typeRaw === 'iframe' || typeRaw === 'webpageelement' || typeRaw === 'link') {
    score += 20
  }

  const domTag = typeof props['dom:tag'] === 'string' ? String(props['dom:tag']).trim().toUpperCase() : ''
  if (domTag === 'IMG' || domTag === 'VIDEO' || domTag === 'AUDIO' || domTag === 'IFRAME' || domTag === 'SVG') score += 20

  const url = String(spec.url || '').toLowerCase()
  if (url.includes('mmbiz.qpic.cn') || url.includes('wx_fmt=')) score += 220

  const kind = String(spec.kind || '').toLowerCase()
  if (kind === 'image' || kind === 'svg') score += 10
  else if (kind === 'video') score += 8
  else if (kind === 'audio') score += 7
  else if (kind === 'iframe') score += 6

  return score
}

function hasMeaningfulRichMediaPanelOverlayContent(candidate: Candidate): boolean {
  if (!candidate.panel) return false
  if (String(candidate.url || '').trim()) return true
  if (String(candidate.openUrl || '').trim()) return true
  if (String(candidate.srcDoc || '').trim()) return true
  if (candidate.panel.activeTab !== 'auto') return true
  if (candidate.panel.hasImage || candidate.panel.hasVideo || candidate.panel.hasAudio || candidate.panel.hasText) return true
  if (candidate.panel.isLoading) return true
  return false
}

function getRichMediaPanelTextDedupKey(candidate: Candidate): string {
  if (!candidate.panel) return ''
  const connected = String(candidate.panel.connectedText || '').trim()
  if (connected) return connected
  const local = String(candidate.panel.text || '').trim()
  if (local) return local
  const srcDoc = String(candidate.srcDoc || '').trim()
  if (srcDoc) return srcDoc
  return ''
}

function computeRichMediaPanelOverlayRankBonus(candidate: Candidate): number {
  if (!candidate.panel) return 0
  let score = 0
  if (candidate.panel.activeTab === 'video') score += 160
  else if (candidate.panel.activeTab === 'audio') score += 150
  else if (candidate.panel.activeTab === 'image') score += 140
  else if (candidate.panel.activeTab === 'text') score += 120
  else if (candidate.panel.activeTab === 'poi') score += 80
  if (candidate.panel.hasVideo) score += 140
  if (candidate.panel.hasAudio) score += 130
  if (candidate.panel.hasImage) score += 120
  if (candidate.panel.hasText) score += 100
  if (candidate.panel.isLoading) score += 80
  if (String(candidate.srcDoc || '').trim()) score += 40
  if (String(candidate.title || '').includes(' for ')) score += 20
  return score
}

function buildRichMediaPanelFallbackSpec(panel: RichMediaPanelOverlayState | undefined): {
  kind: MediaOverlayKind
  url: string
  interactive: boolean
} | null {
  if (!panel) return null
  if (panel.activeTab === 'image') return { kind: 'image', url: '', interactive: false }
  if (panel.activeTab === 'video') return { kind: 'video', url: '', interactive: false }
  if (panel.activeTab === 'audio') return { kind: 'audio', url: '', interactive: false }
  if (panel.activeTab === 'text' || panel.activeTab === 'poi') return { kind: 'iframe', url: '', interactive: false }
  return null
}

export function listMediaOverlayNodes(args: {
  enabled: boolean
  nodes: GraphNode[]
  poolMax: number
  kinds?: readonly MediaOverlayKind[]
  preferredNodeIds?: readonly string[]
  excludeNodeIdSet?: Set<string>
  connectedValuesByNodeId?: ReadonlyMap<string, FlowConnectedValuesBySchemaPath>
  nodeById?: ReadonlyMap<string, GraphNode>
}): MediaOverlayNode[] {
  if (!args.enabled) return []
  const nodes = Array.isArray(args.nodes) ? args.nodes : []
  const poolMax = Number.isFinite(args.poolMax) ? Math.max(0, Math.floor(args.poolMax)) : 0
  const kinds = new Set<MediaOverlayKind>((args.kinds || ['iframe', 'image', 'svg', 'video', 'audio']) as MediaOverlayKind[])
  if (poolMax <= 0) return []
  const preferred = (args.preferredNodeIds || []).map(v => String(v || '').trim()).filter(Boolean)
  const preferredSet = preferred.length ? new Set(preferred) : null
  const exclude = args.excludeNodeIdSet || null
  const connectedValuesByNodeId = args.connectedValuesByNodeId || null
  const externalNodeById = args.nodeById || null
  let nodeById: Map<string, GraphNode> | null = null
  const getNodeById = (): ReadonlyMap<string, GraphNode> => {
    if (externalNodeById) return externalNodeById
    if (nodeById) return nodeById
    nodeById = new Map<string, GraphNode>()
    for (let i = 0; i < nodes.length; i += 1) {
      const node = nodes[i]
      const id = String(node?.id || '').trim()
      if (!id) continue
      nodeById.set(id, node)
    }
    return nodeById
  }

  const candidates: Candidate[] = []
  for (let i = 0; i < nodes.length; i += 1) {
    const n0 = nodes[i]
    const id = String(n0?.id || '').trim()
    if (!id) continue
    if (canonicalNodeIdSetHas(exclude, id)) continue

    const connectedValuesBySchemaPath = connectedValuesByNodeId?.get(id)
    const isRichMediaPanel = String(n0.type || '').trim() === FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID
    const panelNodeById = isRichMediaPanel ? getNodeById() : undefined
    const panel = buildRichMediaPanelOverlayState({
      node: n0,
      connectedValuesBySchemaPath,
      nodeById: panelNodeById,
    })
    const baseSpec = getNodeMediaSpec(n0) || buildRichMediaPanelFallbackSpec(panel)
    const nodeForSpec = (() => {
      if (!hasConnectedValuesBySchemaPath(connectedValuesBySchemaPath)) return n0
      if (!isRichMediaPanel && baseSpec) return n0
      const connectedNode = applyConnectedValuesToNodeForRender({ node: n0, connectedValuesBySchemaPath })
      const connectedPanel = isRichMediaPanel
        ? buildRichMediaPanelOverlayState({
            node: n0,
            connectedValuesBySchemaPath,
            nodeById: panelNodeById,
            renderNode: connectedNode,
          })
        : undefined
      const connectedSpec = getNodeMediaSpec(connectedNode) || buildRichMediaPanelFallbackSpec(connectedPanel)
      if (connectedSpec) return connectedNode
      return n0
    })()
    const resolvedPanel = isRichMediaPanel
      ? buildRichMediaPanelOverlayState({
          node: n0,
          connectedValuesBySchemaPath,
          nodeById: panelNodeById,
          renderNode: nodeForSpec,
        })
      : panel
    const spec = nodeForSpec === n0
      ? baseSpec
      : (getNodeMediaSpec(nodeForSpec) || buildRichMediaPanelFallbackSpec(resolvedPanel))
    if (!spec) continue
    const kind = spec.kind as MediaOverlayKind
    if (!kinds.has(kind)) continue
    const title = buildOverlayTitle({
      node: n0,
      nodeById: panelNodeById || EMPTY_NODE_BY_ID,
      connectedValuesBySchemaPath,
    })
    const openUrl = chooseOpenUrl(nodeForSpec, spec.url)
    const preferredHit = preferredSet?.has(id) === true
    const rankBase = computeMediaRank(nodeForSpec, spec)
    const panelRankBonus = resolvedPanel
      ? computeRichMediaPanelOverlayRankBonus({
          id,
          title,
          url: spec.url,
          ...(typeof (spec as { srcDoc?: unknown }).srcDoc === 'string' && String((spec as { srcDoc?: string }).srcDoc || '').trim()
            ? { srcDoc: String((spec as { srcDoc?: string }).srcDoc || '') }
            : {}),
          openUrl,
          interactive: spec.interactive,
          kind,
          panel: resolvedPanel,
          rank: 0,
          idx: i,
          preferred: preferredHit,
        })
      : 0
    const rank = preferredHit ? rankBase + panelRankBonus + 1000 : rankBase + panelRankBonus
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
      ...(resolvedPanel ? { panel: resolvedPanel } : {}),
      rank,
      idx: i,
      preferred: preferredHit,
    })
  }

  const bestByKey = new Map<string, Candidate>()
  const richMediaCandidates = candidates.filter(candidate => !!candidate.panel)
  const hasMeaningfulRichMediaPanel = richMediaCandidates.some(hasMeaningfulRichMediaPanelOverlayContent)
  for (let i = 0; i < candidates.length; i += 1) {
    const c = candidates[i]!
    if (c.panel && hasMeaningfulRichMediaPanel && !hasMeaningfulRichMediaPanelOverlayContent(c)) {
      continue
    }
    const keyUrl = canonicalMediaDedupUrl(c.url || c.openUrl)
    const key = (() => {
      if (!c.panel) return `${c.kind}\n${keyUrl || c.id}`
      if (keyUrl) return `${c.kind}\n${keyUrl}`
      const textKey = getRichMediaPanelTextDedupKey(c)
      if (textKey) return `${c.kind}\nrich-media-text\n${textKey}`
      if (hasMeaningfulRichMediaPanelOverlayContent(c)) return `${c.kind}\nrich-media-panel\n${c.id}`
      return `${c.kind}\nrich-media-empty-shell`
    })()
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
