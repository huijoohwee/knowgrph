import { resolveFlowEditorVisibleViewport } from '@/components/FlowCanvas/applyZoomRequestNative'
import { coerceRichMediaPanelSizePx } from '@/lib/render/richMediaSsot'
import { MEDIA_PANEL_LAYOUT_FRAME_16X9 } from '@/lib/render/mediaPanelSpec'
import type { MediaOverlayLayoutViewport } from '@/lib/render/mediaOverlayLayoutLoop2d'

type FlowCanvasMediaLayoutViewportArgs = {
  canvas2dRenderer: string
  flowEditorSurfaceId?: string | null
  viewportW: number
  viewportH: number
}

export function resolveFlowCanvasMediaLayoutViewport(args: FlowCanvasMediaLayoutViewportArgs): Required<MediaOverlayLayoutViewport> {
  if (args.canvas2dRenderer === 'flowEditor') {
    const visibleViewport = resolveFlowEditorVisibleViewport({
      flowEditorSurfaceId: args.flowEditorSurfaceId || undefined,
      viewportW: args.viewportW,
      viewportH: args.viewportH,
    })
    return { left: visibleViewport.left, top: visibleViewport.top, width: visibleViewport.width, height: visibleViewport.height }
  }
  return { left: 0, top: 0, width: Math.max(1, Number(args.viewportW) || 1), height: Math.max(1, Number(args.viewportH) || 1) }
}

export function clampMediaLayoutViewportToFrame16x9(viewport: Pick<MediaOverlayLayoutViewport, 'width' | 'height'>): { width: number; height: number } {
  return {
    width: Math.max(1, Math.min(Number(viewport.width) || 1, MEDIA_PANEL_LAYOUT_FRAME_16X9.width)),
    height: Math.max(1, Math.min(Number(viewport.height) || 1, MEDIA_PANEL_LAYOUT_FRAME_16X9.height)),
  }
}

export function coerceRichMediaPanelSizeForLayoutViewport(args: {
  readLayoutViewport: () => MediaOverlayLayoutViewport
  width: number
  height: number
  minWidthPx: number
  minHeightPx: number
}): { width: number; height: number } {
  const viewport = args.readLayoutViewport()
  return coerceRichMediaPanelSizePx({ width: args.width, height: args.height, viewportW: viewport.width, viewportH: viewport.height, minWidthPx: args.minWidthPx, minHeightPx: args.minHeightPx })
}
