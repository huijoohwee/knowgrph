import type { Canvas3dModeId } from '@/lib/config.render'

export type ThreeCanvasSurfaceMountInput = Readonly<{
  sourceFilesBootstrapReady: boolean
  geospatialOverlayOwnsViewport: boolean
  liveCanvasHeroVisible: boolean
  canvasRenderMode: '2d' | '3d'
  heavyRuntimeIntentBlocked: boolean
}>

export type ThreeRendererMountInput = Readonly<{
  mode: Canvas3dModeId
  hasRenderableScene: boolean
  webglSupported: boolean | null
}>

export type ThreeCanvasSurfaceLifecycleInput = ThreeCanvasSurfaceMountInput & Readonly<{
  activeSurface: '2d' | '3d' | 'geo'
  documentSwitchOwnsViewport: boolean
}>

export function shouldMountThreeCanvasSurface(input: ThreeCanvasSurfaceMountInput): boolean {
  return input.sourceFilesBootstrapReady
    && !input.geospatialOverlayOwnsViewport
    && !input.liveCanvasHeroVisible
    && input.canvasRenderMode === '3d'
    && !input.heavyRuntimeIntentBlocked
}

export function shouldActivateThreeCanvasSurface(input: Readonly<{
  surfaceMounted: boolean
  activeSurface: '2d' | '3d' | 'geo'
  documentSwitchOwnsViewport: boolean
}>): boolean {
  return input.surfaceMounted
    && input.activeSurface === '3d'
    && !input.documentSwitchOwnsViewport
}

export function resolveThreeCanvasSurfaceLifecycle(input: ThreeCanvasSurfaceLifecycleInput): Readonly<{
  mounted: boolean
  active: boolean
}> {
  const mounted = shouldMountThreeCanvasSurface(input)
  return {
    mounted,
    active: shouldActivateThreeCanvasSurface({
      surfaceMounted: mounted,
      activeSurface: input.activeSurface,
      documentSwitchOwnsViewport: input.documentSwitchOwnsViewport,
    }),
  }
}

export function shouldMountThreeRenderer(input: ThreeRendererMountInput): boolean {
  if (input.webglSupported === false) return false
  return input.mode === 'xr' || input.hasRenderableScene
}

export function resolveThreeRendererLifecycleKey(mode: Canvas3dModeId): string {
  return `scene-canvas-${mode}`
}
