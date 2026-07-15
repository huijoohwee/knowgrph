import type { GraphNode } from '@/lib/graph/types'
import { getNodeMediaSpec } from '@/lib/canvas/graph-elements/mediaSpec'
import type { FlowConnectedValuesBySchemaPath } from '@/lib/storyboardWidget/flowDataflow'
import { FLOW_RICH_MEDIA_PANEL_NODE_LABEL } from '@/lib/storyboardWidget/richMediaPanelConfig'
import { normalizeRichMediaPanelInlineSrcDoc } from '@/lib/render/richMediaPanelSrcDoc'
import {
  resolveRichMediaPanelRenderNode,
  type RichMediaPanelOverlayState,
  type RichMediaPanelTab,
} from '@/lib/render/richMediaPanelState'
import { normalizeRuntimeStorageMediaAccessUrl } from '@/lib/storage/runtimeMediaUrl'
import type { ImageToThreeJsRenderMode } from '@/features/image-to-threejs/imageToThreeJsContract'
import { readNodeFieldString } from '@/lib/canvas/graph-elements/mediaSpecNodeFields'

type RichMediaDirectPreviewKind = 'image' | 'video' | 'audio' | 'model'

export type RichMediaPanelPreviewSpec =
  | {
      kind: RichMediaDirectPreviewKind
      url: string
      openUrl?: string
      srcDoc?: string
      interactive: boolean
      renderMode?: ImageToThreeJsRenderMode
    }
  | {
      kind: 'iframe'
      url: string
      openUrl?: string
      srcDoc?: string
      interactive: boolean
      renderMode?: ImageToThreeJsRenderMode
    }

export type ResolvedRichMediaPanelTab = Exclude<RichMediaPanelTab, 'auto'>

export function normalizeRichMediaPanelTab(value: unknown): RichMediaPanelTab {
  const raw = String(value || '').trim().toLowerCase()
  return raw === 'text' || raw === 'image' || raw === 'video' || raw === 'audio' || raw === 'model' || raw === 'poi' || raw === 'auto'
    ? raw as RichMediaPanelTab
    : 'auto'
}

export function resolveRichMediaPanelSelectedTab(args: {
  activeTab: unknown
  hasText?: unknown
  hasImage?: unknown
  hasVideo?: unknown
  hasAudio?: unknown
  hasModel?: unknown
  hasPoi?: unknown
  renderKind?: unknown
  hasRenderableUrl?: unknown
  hasInlineSrcDoc?: unknown
}): ResolvedRichMediaPanelTab | null {
  const activeTab = normalizeRichMediaPanelTab(args.activeTab)
  if (activeTab !== 'auto') return activeTab
  const hasText = args.hasText === true
  const hasImage = args.hasImage === true
  const hasVideo = args.hasVideo === true
  const hasAudio = args.hasAudio === true
  const hasModel = args.hasModel === true
  const hasPoi = args.hasPoi === true
  const renderKind = String(args.renderKind || '').trim().toLowerCase()
  const hasRenderableUrl = args.hasRenderableUrl === true
  const hasInlineSrcDoc = args.hasInlineSrcDoc === true
  if (renderKind === 'video') return 'video'
  if (renderKind === 'audio') return 'audio'
  if (renderKind === 'model') return 'model'
  if (renderKind === 'image' || renderKind === 'svg') return 'image'
  if (renderKind === 'iframe' && !hasRenderableUrl && hasPoi && hasInlineSrcDoc) return 'poi'
  if (renderKind === 'iframe' && !hasRenderableUrl) return 'text'
  if (hasVideo) return 'video'
  if (hasAudio) return 'audio'
  if (hasModel) return 'model'
  if (hasImage) return 'image'
  if (hasPoi) return 'poi'
  if (hasText) return 'text'
  return null
}

export function resolveRichMediaPlayableUrl(args: {
  fallbackSrcDocAvailable?: boolean
  url: unknown
}): string {
  const raw = typeof args.url === 'string' ? args.url.trim() : ''
  if (!raw || !raw.startsWith('blob:')) return raw
  if (typeof window === 'undefined') return raw
  const currentOrigin = typeof window.location?.origin === 'string' ? window.location.origin : ''
  if (!currentOrigin) return raw
  try {
    const blobOrigin = new URL(raw).origin
    return blobOrigin && blobOrigin !== 'null' && blobOrigin === currentOrigin ? raw : ''
  } catch {
    return ''
  }
}

function readRichMediaPanelGenericMediaUrl(node: GraphNode, props: Record<string, unknown>): {
  audioUrl: string
  imageUrl: string
  mediaUrl: string
  modelUrl: string
  videoUrl: string
} {
  const mediaUrl = normalizeRuntimeStorageMediaAccessUrl({
    url: readNodeFieldString(node, props, 'mediaUrl') || readNodeFieldString(node, props, 'media_url'),
  })
  const mediaKind = (
    readNodeFieldString(node, props, 'mediaKind') || readNodeFieldString(node, props, 'media_kind')
  ).toLowerCase()
  return {
    audioUrl: mediaKind === 'audio' ? mediaUrl : '',
    imageUrl: mediaKind === 'image' || mediaKind === 'svg' ? mediaUrl : '',
    mediaUrl,
    modelUrl: mediaKind === 'model' ? mediaUrl : '',
    videoUrl: mediaKind === 'video' ? mediaUrl : '',
  }
}

export function buildRichMediaPanelPreviewSpec(args: {
  node: GraphNode
  connectedValuesBySchemaPath?: FlowConnectedValuesBySchemaPath
  panel?: RichMediaPanelOverlayState | null
}): RichMediaPanelPreviewSpec | null {
  const panel = args.panel
  if (!panel) return null
  const renderNode = resolveRichMediaPanelRenderNode({
    node: args.node,
    connectedValuesBySchemaPath: args.connectedValuesBySchemaPath,
  })
  const props = (renderNode.properties || {}) as Record<string, unknown>
  const genericMedia = readRichMediaPanelGenericMediaUrl(renderNode, props)
  const rawImageUrl = normalizeRuntimeStorageMediaAccessUrl({
    url: readNodeFieldString(renderNode, props, 'imageUrl') || genericMedia.imageUrl,
  })
  const rawVideoUrl = normalizeRuntimeStorageMediaAccessUrl({
    url: readNodeFieldString(renderNode, props, 'videoUrl') || genericMedia.videoUrl,
  })
  const rawAudioUrl = normalizeRuntimeStorageMediaAccessUrl({
    url: readNodeFieldString(renderNode, props, 'audioUrl') || genericMedia.audioUrl,
  })
  const rawModelUrl = normalizeRuntimeStorageMediaAccessUrl({
    url: readNodeFieldString(renderNode, props, 'modelUrl')
      || readNodeFieldString(renderNode, props, 'model')
      || readNodeFieldString(renderNode, props, 'glbUrl')
      || readNodeFieldString(renderNode, props, 'glb')
      || genericMedia.modelUrl,
  })
  const rawMediaUrl = genericMedia.mediaUrl
  const rawOpenUrl = rawModelUrl || rawImageUrl || rawVideoUrl || rawAudioUrl || rawMediaUrl
  const rawOutputSrcDoc = readNodeFieldString(renderNode, props, 'outputSrcDoc')
  const outputSrcDoc = normalizeRichMediaPanelInlineSrcDoc({
    srcDoc: rawOutputSrcDoc,
    title: String(args.node.label || args.node.id || '').trim() || FLOW_RICH_MEDIA_PANEL_NODE_LABEL,
  })
  const renderSpec = getNodeMediaSpec(renderNode)
  const fallbackSrcDoc = String(renderSpec?.srcDoc || outputSrcDoc || '')
  const playableVideoUrl = resolveRichMediaPlayableUrl({
    fallbackSrcDocAvailable: !!fallbackSrcDoc.trim(),
    url: rawVideoUrl || (renderSpec?.kind === 'video'
      ? normalizeRuntimeStorageMediaAccessUrl({ url: renderSpec.url })
      : ''),
  })
  const selectedTab = resolveRichMediaPanelSelectedTab({
    activeTab: panel.activeTab,
    hasText: panel.hasText,
    hasImage: panel.hasImage,
    hasVideo: panel.hasVideo,
    hasAudio: panel.hasAudio,
    hasModel: panel.hasModel,
    hasPoi: panel.hasPoi,
    renderKind: renderSpec?.kind,
    hasRenderableUrl: !!String(renderSpec?.url || '').trim(),
    hasInlineSrcDoc: !!String(renderSpec?.srcDoc || rawOutputSrcDoc || '').trim(),
  }) || 'text'
  const selectedText = String(panel.connectedText || panel.text || '').trim()
  if (selectedTab === 'video' || selectedTab === 'image' || selectedTab === 'model') {
    const selectedUrl = selectedTab === 'video' ? playableVideoUrl : selectedTab === 'model' ? rawModelUrl : rawImageUrl
    if (selectedTab === 'video' && !selectedUrl && fallbackSrcDoc.trim()) {
      return {
        kind: 'iframe',
        url: '',
        openUrl: rawImageUrl || rawAudioUrl || rawMediaUrl || '',
        srcDoc: fallbackSrcDoc,
        interactive: renderSpec?.interactive !== false,
      }
    }
    return {
      kind: selectedTab,
      url: selectedTab === 'video'
        ? selectedUrl
        : selectedUrl || normalizeRuntimeStorageMediaAccessUrl({ url: renderSpec?.url }),
      openUrl: selectedUrl || rawOpenUrl || normalizeRuntimeStorageMediaAccessUrl({ url: renderSpec?.url }),
      srcDoc: selectedTab === 'video' ? fallbackSrcDoc || undefined : undefined,
      interactive: selectedTab === 'video' ? renderSpec?.interactive !== false : renderSpec?.interactive === true,
      ...(selectedTab === 'image' && renderSpec?.renderMode ? { renderMode: renderSpec.renderMode } : {}),
    }
  }
  if (selectedTab === 'audio' || renderSpec?.kind === 'audio') {
    const url = normalizeRuntimeStorageMediaAccessUrl({
      url: rawAudioUrl || renderSpec?.url || rawMediaUrl || '',
    })
    return { kind: 'audio', url, openUrl: rawAudioUrl || rawOpenUrl || url, interactive: renderSpec?.interactive !== false }
  }
  if (selectedTab === 'text' && selectedText) {
    const runtimeUrl = normalizeRuntimeStorageMediaAccessUrl({ url: rawOpenUrl || String(renderSpec?.url || '') })
    return {
      kind: 'iframe',
      url: runtimeUrl,
      openUrl: runtimeUrl,
      interactive: false,
    }
  }
  const runtimeUrl = normalizeRuntimeStorageMediaAccessUrl({ url: rawOpenUrl || String(renderSpec?.url || '') })
  return {
    kind: 'iframe',
    url: runtimeUrl,
    openUrl: runtimeUrl,
    srcDoc: String(renderSpec?.srcDoc || outputSrcDoc || '') || undefined,
    interactive: renderSpec?.interactive !== false,
  }
}
