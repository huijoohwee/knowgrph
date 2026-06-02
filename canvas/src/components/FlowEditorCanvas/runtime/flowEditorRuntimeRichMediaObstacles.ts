import {
  collectCanonicalFlowEditorOverlayRectEntries,
  findFlowEditorOverlaySurfaceRoot,
  isTransientOffscreenRichMediaOverlayRoot,
  queryFlowEditorOverlayRootsForSurface,
  RICH_MEDIA_OVERLAY_ROOT_SELECTOR,
} from '@/lib/canvas/flow-editor-overlay-proxy'

export type FlowEditorWorldObstacle = {
  id: string
  left: number
  top: number
  width: number
  height: number
}

export function collectActiveRichMediaWorldObstacles(args: {
  flowEditorSurfaceId: string | null | undefined
  skipAll?: boolean
  isFrontmatterFlow?: boolean
  effectiveOrFallbackOpenIdSet: ReadonlySet<string>
  resolveActiveSurfaceOverlayWidgetId: (id: string) => string
  zoomX: number
  zoomY: number
  zoomK: number
}): FlowEditorWorldObstacle[] {
  if (typeof document === 'undefined' || args.skipAll) return []
  const surfaceRoot = findFlowEditorOverlaySurfaceRoot(args.flowEditorSurfaceId)
  const surfaceRect = surfaceRoot?.getBoundingClientRect() || null
  const surfaceOffsetLeft = surfaceRect && Number.isFinite(surfaceRect.left) ? Number(surfaceRect.left) : 0
  const surfaceOffsetTop = surfaceRect && Number.isFinite(surfaceRect.top) ? Number(surfaceRect.top) : 0
  const entries = collectCanonicalFlowEditorOverlayRectEntries(queryFlowEditorOverlayRootsForSurface({
    surfaceId: args.flowEditorSurfaceId,
    selector: RICH_MEDIA_OVERLAY_ROOT_SELECTOR,
  }))
  const obstacles: FlowEditorWorldObstacle[] = []
  const safeZoomK = Math.max(0.001, args.zoomK)
  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i]!
    const entryWidgetId = args.resolveActiveSurfaceOverlayWidgetId(entry.id)
    if (args.isFrontmatterFlow && entryWidgetId && args.effectiveOrFallbackOpenIdSet.has(entryWidgetId)) continue
    const rect = entry.rect
    if (!rect || isTransientOffscreenRichMediaOverlayRoot(entry.el, rect)) continue
    const screenLeft = Number(rect.left) - surfaceOffsetLeft
    const screenTop = Number(rect.top) - surfaceOffsetTop
    const screenRight = Number(rect.right) - surfaceOffsetLeft
    const screenBottom = Number(rect.bottom) - surfaceOffsetTop
    if (!Number.isFinite(screenLeft) || !Number.isFinite(screenTop) || !Number.isFinite(screenRight) || !Number.isFinite(screenBottom)) continue
    const left = (screenLeft - args.zoomX) / safeZoomK
    const top = (screenTop - args.zoomY) / safeZoomK
    const right = (screenRight - args.zoomX) / safeZoomK
    const bottom = (screenBottom - args.zoomY) / safeZoomK
    const width = right - left
    const height = bottom - top
    if (!(width > 0) || !(height > 0)) continue
    obstacles.push({ id: `rich-media:${entry.id}`, left, top, width, height })
  }
  return obstacles
}
