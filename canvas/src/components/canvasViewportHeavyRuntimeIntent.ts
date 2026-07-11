export type CanvasViewportHeavyRuntimeSurface = '3d' | 'geo'

export function resolveCanvasViewportHeavyRuntimeIntentSurface(args: {
  isTouchViewport: boolean
  geospatialOverlayOwnsViewport: boolean
  canvasRenderMode: '2d' | '3d'
}): CanvasViewportHeavyRuntimeSurface | null {
  if (!args.isTouchViewport) return null
  if (args.geospatialOverlayOwnsViewport) return 'geo'
  if (args.canvasRenderMode === '3d') return '3d'
  return null
}
