import React from 'react'
import type { GraphNode } from '@/lib/graph/types'
import type { FlowConnectedValuesBySchemaPath } from '@/lib/flowEditor/flowDataflow'
import {
  buildRichMediaPanelOverlayState,
  buildRichMediaPanelPreviewSpec,
  commitRichMediaPanelChange,
  coerceRichMediaPanelSizePx,
  resolveRichMediaPanelSelectedTab,
} from '@/lib/render/richMediaSsot'

const RICH_MEDIA_PANEL_MIN_WIDTH = 220
const RICH_MEDIA_PANEL_MIN_HEIGHT = 160

export function useRichMediaWidgetPreview(args: {
  enabled: boolean
  node: GraphNode
  onPatchProperties: (patch: Record<string, unknown>) => void
  connectedValuesBySchemaPath?: FlowConnectedValuesBySchemaPath
}) {
  const { enabled, node, onPatchProperties, connectedValuesBySchemaPath } = args
  const richMediaPanelStoredWidth =
    typeof node.properties?.['visual:width'] === 'number' && Number.isFinite(node.properties['visual:width'])
      ? Math.max(RICH_MEDIA_PANEL_MIN_WIDTH, Math.round(node.properties['visual:width'] as number))
      : 280
  const richMediaPanelStoredHeight =
    typeof node.properties?.['visual:height'] === 'number' && Number.isFinite(node.properties['visual:height'])
      ? Math.max(RICH_MEDIA_PANEL_MIN_HEIGHT, Math.round(node.properties['visual:height'] as number))
      : 180

  const richMediaPanelBaseSize = React.useMemo(() => {
    const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : null
    const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : null
    const coerced = coerceRichMediaPanelSizePx({
      width: richMediaPanelStoredWidth,
      height: richMediaPanelStoredHeight,
      viewportW: viewportWidth,
      viewportH: viewportHeight,
      minWidthPx: RICH_MEDIA_PANEL_MIN_WIDTH,
      minHeightPx: RICH_MEDIA_PANEL_MIN_HEIGHT,
    })
    return { width: coerced.width, height: coerced.height }
  }, [richMediaPanelStoredHeight, richMediaPanelStoredWidth])

  const [richMediaPanelViewSize, setRichMediaPanelViewSize] = React.useState(richMediaPanelBaseSize)
  const richMediaPanelResizeStartRef = React.useRef(richMediaPanelBaseSize)

  React.useEffect(() => {
    if (!enabled) return
    setRichMediaPanelViewSize(prev => (
      prev.width === richMediaPanelBaseSize.width && prev.height === richMediaPanelBaseSize.height
        ? prev
        : richMediaPanelBaseSize
    ))
  }, [enabled, richMediaPanelBaseSize])

  const richMediaPanelState = React.useMemo(() => {
    if (!enabled) return null
    return buildRichMediaPanelOverlayState({
      node,
      connectedValuesBySchemaPath,
    })
  }, [connectedValuesBySchemaPath, enabled, node])

  const richMediaPreview = React.useMemo(() => {
    if (!enabled) return null
    return buildRichMediaPanelPreviewSpec({
      node,
      connectedValuesBySchemaPath,
      panel: richMediaPanelState,
    })
  }, [connectedValuesBySchemaPath, enabled, node, richMediaPanelState])
  const richMediaSelectedTab = React.useMemo(() => {
    if (!enabled || !richMediaPanelState) return null
    return resolveRichMediaPanelSelectedTab({
      activeTab: richMediaPanelState.activeTab,
      hasText: richMediaPanelState.hasText,
      hasImage: richMediaPanelState.hasImage,
      hasVideo: richMediaPanelState.hasVideo,
      hasPoi: richMediaPanelState.hasPoi,
      renderKind: richMediaPreview?.kind,
      hasRenderableUrl: !!String(richMediaPreview?.url || '').trim(),
      hasInlineSrcDoc: !!String(richMediaPreview?.srcDoc || '').trim(),
    })
  }, [enabled, richMediaPanelState, richMediaPreview?.kind, richMediaPreview?.srcDoc, richMediaPreview?.url])
  const richMediaOpenUrl = React.useMemo(() => {
    if (!enabled) return ''
    return String(richMediaPreview?.openUrl || richMediaPreview?.url || '').trim()
  }, [enabled, richMediaPreview?.openUrl, richMediaPreview?.url])

  const handleRichMediaPanelChange = React.useCallback((next: {
    activeTab: 'auto' | 'text' | 'image' | 'video' | 'poi'
    freezeConnectedOutput: boolean
    text?: string
  }) => {
    if (!enabled) return
    const nodeId = String(node.id || '').trim()
    if (!nodeId) return
    commitRichMediaPanelChange({
      nodeId,
      next,
      updateNode: (_id, patch) => {
        onPatchProperties(patch.properties)
      },
    })
  }, [enabled, node.id, onPatchProperties])

  const handleRichMediaResizeStart = React.useCallback(() => {
    richMediaPanelResizeStartRef.current = richMediaPanelViewSize
  }, [richMediaPanelViewSize])

  const handleRichMediaResize = React.useCallback((args0: { dx: number; dy: number }) => {
    const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : null
    const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : null
    const coerced = coerceRichMediaPanelSizePx({
      width: Math.round(richMediaPanelResizeStartRef.current.width + args0.dx),
      height: Math.round(richMediaPanelResizeStartRef.current.height + args0.dy),
      viewportW: viewportWidth,
      viewportH: viewportHeight,
      minWidthPx: RICH_MEDIA_PANEL_MIN_WIDTH,
      minHeightPx: RICH_MEDIA_PANEL_MIN_HEIGHT,
    })
    setRichMediaPanelViewSize({ width: coerced.width, height: coerced.height })
  }, [])

  const handleRichMediaResizeEnd = React.useCallback(() => {
    const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : null
    const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : null
    const coerced = coerceRichMediaPanelSizePx({
      width: richMediaPanelViewSize.width,
      height: richMediaPanelViewSize.height,
      viewportW: viewportWidth,
      viewportH: viewportHeight,
      minWidthPx: RICH_MEDIA_PANEL_MIN_WIDTH,
      minHeightPx: RICH_MEDIA_PANEL_MIN_HEIGHT,
    })
    onPatchProperties({
      'visual:width': coerced.width,
      'visual:height': coerced.height,
    })
  }, [onPatchProperties, richMediaPanelViewSize.height, richMediaPanelViewSize.width])

  return {
    richMediaPanelState,
    richMediaPreview,
    richMediaSelectedTab,
    richMediaOpenUrl,
    richMediaPanelViewSize,
    handleRichMediaPanelChange,
    handleRichMediaResizeStart,
    handleRichMediaResize,
    handleRichMediaResizeEnd,
  }
}

export type RichMediaWidgetPreviewState = ReturnType<typeof useRichMediaWidgetPreview>
