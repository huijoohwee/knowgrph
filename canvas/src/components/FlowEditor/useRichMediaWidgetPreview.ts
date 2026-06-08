import React from 'react'
import type { GraphNode } from '@/lib/graph/types'
import type { FlowConnectedValuesBySchemaPath } from '@/lib/flowEditor/flowDataflow'
import {
  buildRichMediaPanelOverlayState,
  buildRichMediaPanelPreviewSpec,
  commitRichMediaPanelChange,
  computeRichMediaPanelAspectResizeSizePx,
  coerceRichMediaPanelChromeSizePx,
  coerceRichMediaPanelSizePx,
  resolveRichMediaPanelSelectedTab,
} from '@/lib/render/richMediaSsot'
import {
  RICH_MEDIA_ASPECT_MIN_HEIGHT,
  RICH_MEDIA_ASPECT_MIN_WIDTH,
  RICH_MEDIA_PANEL_DEFAULT_VIEW_SIZE,
} from '@/components/FlowEditor/flowWidgetOverlayShared'

type RichMediaPanelInlineContentSize = { width: number; height: number }

function readViewportSize(): { viewportWidth: number | null; viewportHeight: number | null } {
  return {
    viewportWidth: typeof window !== 'undefined' ? window.innerWidth : null,
    viewportHeight: typeof window !== 'undefined' ? window.innerHeight : null,
  }
}

export function useRichMediaWidgetPreview(args: {
  enabled: boolean
  node: GraphNode
  onPatchProperties: (patch: Record<string, unknown>) => void
  connectedValuesBySchemaPath?: FlowConnectedValuesBySchemaPath
}) {
  const { enabled, node, onPatchProperties, connectedValuesBySchemaPath } = args
  const rawStoredWidth = node.properties?.['visual:width']
  const rawStoredHeight = node.properties?.['visual:height']
  const richMediaPanelHasStoredWidth = typeof rawStoredWidth === 'number' && Number.isFinite(rawStoredWidth)
  const richMediaPanelHasStoredHeight = typeof rawStoredHeight === 'number' && Number.isFinite(rawStoredHeight)
  const richMediaPanelStoredWidth =
    richMediaPanelHasStoredWidth
      ? Math.max(RICH_MEDIA_ASPECT_MIN_WIDTH, Math.round(rawStoredWidth as number))
      : RICH_MEDIA_PANEL_DEFAULT_VIEW_SIZE.width
  const richMediaPanelStoredHeight =
    richMediaPanelHasStoredHeight
      ? Math.max(RICH_MEDIA_ASPECT_MIN_HEIGHT, Math.round(rawStoredHeight as number))
      : RICH_MEDIA_PANEL_DEFAULT_VIEW_SIZE.height

  const richMediaPanelBaseSize = React.useMemo(() => {
    const { viewportWidth, viewportHeight } = readViewportSize()
    const coerced = coerceRichMediaPanelSizePx({
      width: richMediaPanelStoredWidth,
      height: richMediaPanelStoredHeight,
      viewportW: viewportWidth,
      viewportH: viewportHeight,
      minWidthPx: RICH_MEDIA_ASPECT_MIN_WIDTH,
      minHeightPx: RICH_MEDIA_ASPECT_MIN_HEIGHT,
    })
    return { width: coerced.width, height: coerced.height }
  }, [richMediaPanelStoredHeight, richMediaPanelStoredWidth])

  const [richMediaPanelViewSize, setRichMediaPanelViewSize] = React.useState(richMediaPanelBaseSize)
  const richMediaPanelResizeStartRef = React.useRef(richMediaPanelBaseSize)
  const richMediaPanelManualResizeRef = React.useRef(richMediaPanelHasStoredWidth || richMediaPanelHasStoredHeight)

  React.useEffect(() => {
    if (!enabled) return
	    setRichMediaPanelViewSize(prev => (
	      prev.width === richMediaPanelBaseSize.width && prev.height === richMediaPanelBaseSize.height
	        ? prev
	        : richMediaPanelBaseSize
	    ))
  }, [enabled, richMediaPanelBaseSize])

  React.useEffect(() => {
    richMediaPanelManualResizeRef.current = richMediaPanelHasStoredWidth || richMediaPanelHasStoredHeight
  }, [node.id, richMediaPanelHasStoredHeight, richMediaPanelHasStoredWidth])

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
      hasAudio: richMediaPanelState.hasAudio,
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
    activeTab: 'auto' | 'text' | 'image' | 'video' | 'audio' | 'poi'
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
    richMediaPanelManualResizeRef.current = true
    richMediaPanelResizeStartRef.current = richMediaPanelViewSize
  }, [richMediaPanelViewSize])

  const handleRichMediaResize = React.useCallback((args0: { dx: number; dy: number }) => {
    const { viewportWidth, viewportHeight } = readViewportSize()
    const aspectResize = computeRichMediaPanelAspectResizeSizePx({
      startWidth: richMediaPanelResizeStartRef.current.width,
      startHeight: richMediaPanelResizeStartRef.current.height,
      dx: args0.dx,
      dy: args0.dy,
    })
    const coerced = coerceRichMediaPanelSizePx({
      width: aspectResize.width,
      height: aspectResize.height,
      viewportW: viewportWidth,
      viewportH: viewportHeight,
      minWidthPx: RICH_MEDIA_ASPECT_MIN_WIDTH,
      minHeightPx: RICH_MEDIA_ASPECT_MIN_HEIGHT,
    })
    setRichMediaPanelViewSize({ width: coerced.width, height: coerced.height })
  }, [])

  const handleRichMediaResizeEnd = React.useCallback(() => {
    const { viewportWidth, viewportHeight } = readViewportSize()
    const coerced = coerceRichMediaPanelSizePx({
      width: richMediaPanelViewSize.width,
      height: richMediaPanelViewSize.height,
      viewportW: viewportWidth,
      viewportH: viewportHeight,
      minWidthPx: RICH_MEDIA_ASPECT_MIN_WIDTH,
      minHeightPx: RICH_MEDIA_ASPECT_MIN_HEIGHT,
    })
    onPatchProperties({
      'visual:width': coerced.width,
      'visual:height': coerced.height,
    })
  }, [onPatchProperties, richMediaPanelViewSize.height, richMediaPanelViewSize.width])

  const handleRichMediaContentSize = React.useCallback((size: RichMediaPanelInlineContentSize) => {
    if (!enabled) return
    if (richMediaPanelHasStoredHeight || richMediaPanelManualResizeRef.current) return
    const contentHeight = Math.ceil(Number(size.height) || 0)
    if (!(contentHeight > 0)) return
    const { viewportWidth, viewportHeight } = readViewportSize()
    setRichMediaPanelViewSize(prev => {
      const nextHeight = Math.max(richMediaPanelBaseSize.height, contentHeight)
      const next = coerceRichMediaPanelChromeSizePx({
        width: richMediaPanelHasStoredWidth ? prev.width : richMediaPanelBaseSize.width,
        height: nextHeight,
        viewportW: viewportWidth,
        viewportH: viewportHeight,
        minWidthPx: RICH_MEDIA_ASPECT_MIN_WIDTH,
        minHeightPx: RICH_MEDIA_ASPECT_MIN_HEIGHT,
      })
      if (prev.width === next.width && prev.height === next.height) return prev
      return next
    })
  }, [enabled, richMediaPanelBaseSize.height, richMediaPanelBaseSize.width, richMediaPanelHasStoredHeight, richMediaPanelHasStoredWidth])

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
    handleRichMediaContentSize,
  }
}

export type RichMediaWidgetPreviewState = ReturnType<typeof useRichMediaWidgetPreview>
