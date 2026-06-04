import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testFlowEditorMinimapIsEnabled() {
  const p = resolve(process.cwd(), 'src', 'components', 'CanvasViewport.tsx')
  const renderConfigPath = resolve(process.cwd(), 'src', 'lib', 'config.render.ts')
  const canvasViewMenuPath = resolve(process.cwd(), 'src', 'components', 'toolbar', 'canvasViewMenu.ts')
  const canvasViewActionsPath = resolve(process.cwd(), 'src', 'components', 'toolbar', 'canvasViewActions.ts')
  const canvasRendererSelectPath = resolve(process.cwd(), 'src', 'components', 'toolbar', 'Canvas2dRendererSelect.tsx')
  const minimapPath = resolve(process.cwd(), 'src', 'features', 'minimap', 'Minimap.tsx')
  const minimapOverlayProjectionPath = resolve(process.cwd(), 'src', 'features', 'minimap', 'flowEditorOverlayProjection.ts')
  const minimapVisibilityPath = resolve(process.cwd(), 'src', 'features', 'minimap', 'minimapVisibility.ts')
  const minimapMathPath = resolve(process.cwd(), 'src', 'features', 'minimap', 'math.ts')
  const minimapRendererPath = resolve(process.cwd(), 'src', 'features', 'minimap', 'renderer.ts')
  const text = readFileSync(p, 'utf8')
  const renderConfigText = readFileSync(renderConfigPath, 'utf8')
  const canvasViewMenuText = readFileSync(canvasViewMenuPath, 'utf8')
  const canvasViewActionsText = readFileSync(canvasViewActionsPath, 'utf8')
  const canvasRendererSelectText = readFileSync(canvasRendererSelectPath, 'utf8')
  const minimapText = readFileSync(minimapPath, 'utf8')
  const minimapOverlayProjectionText = readFileSync(minimapOverlayProjectionPath, 'utf8')
  const minimapVisibilityText = readFileSync(minimapVisibilityPath, 'utf8')
  const minimapMathText = readFileSync(minimapMathPath, 'utf8')
  const minimapRendererText = readFileSync(minimapRendererPath, 'utf8')
  if (!text.includes('<MinimapLazy')) {
    throw new Error('expected CanvasViewport to render Minimap overlay in workspace variant')
  }
  if (!text.includes('supportsCanvas2dMinimap(canvas2dRenderer)')) {
    throw new Error('expected CanvasViewport to use the shared minimap support helper')
  }
  if (
    !renderConfigText.includes("flowEditor: {") ||
    !renderConfigText.includes("surfaceId: 'flowEditor'") ||
    !renderConfigText.includes('getCanvas2dSurfaceId(id) !== null')
  ) {
    throw new Error('expected shared renderer surface helper to preserve Flow Editor as a minimap-capable surface')
  }
  if (!canvasViewMenuText.includes("id: 'control:minimap'") || !canvasViewMenuText.includes("title: 'Minimap'")) {
    throw new Error('expected Canvas View Mode Display Controls to expose the shared Minimap toggle')
  }
  if (!canvasViewMenuText.includes('supportsCanvas2dMinimap(state.canvas2dRenderer)')) {
    throw new Error('expected Minimap menu availability to reuse the same shared support helper as CanvasViewport')
  }
  if (!canvasViewActionsText.includes("if (id === 'control:minimap')") || !canvasViewActionsText.includes('setMinimapCollapsed?.(!minimapCollapsed)')) {
    throw new Error('expected Minimap toolbar action to toggle the shared minimap collapsed state')
  }
  if (!canvasRendererSelectText.includes('useMinimapCollapsed()') || !canvasRendererSelectText.includes('setMinimapCollapsed,')) {
    throw new Error('expected Canvas View Mode toolbar to bridge the shared minimap visibility owner')
  }
  if (!minimapText.includes('useMinimapCollapsed()') || minimapText.includes('usePersistedBoolean(LS_KEYS.minimapCollapsed')) {
    throw new Error('expected Minimap component to consume the shared minimap visibility owner')
  }
  if (!minimapVisibilityText.includes('LS_KEYS.minimapCollapsed') || !minimapVisibilityText.includes('useSyncExternalStore')) {
    throw new Error('expected shared minimap visibility owner to wrap the existing minimap storage key')
  }
  if (!minimapOverlayProjectionText.includes('width: wPx / k') || !minimapOverlayProjectionText.includes('height: hPx / k')) {
    throw new Error('expected Flow Editor minimap overlay nodes to export real panel extents')
  }
  if (minimapText.includes('const zoomStateByKey = useGraphStore(s => s.zoomStateByKey)') || !minimapText.includes('return s.zoomStateByKey?.[zoomViewKey] ?? null')) {
    throw new Error('expected minimap zoom rendering to subscribe to the active keyed transform instead of the whole zoom map')
  }
  if (!minimapText.includes('const flowEditorOverlayNodeById = React.useMemo') || !minimapText.includes('const baseGraphBounds = React.useMemo')) {
    throw new Error('expected Flow Editor minimap to keep static lookup and base bounds out of the zoom-dependent overlay projection path')
  }
  if (!minimapText.includes('unionMinimapBoundsWithRect(graphBounds, viewRectWorld)') || !minimapMathText.includes('readMinimapNodeExtent')) {
    throw new Error('expected Flow Editor minimap bounds and projection to reuse shared minimap math utilities')
  }
  if (!minimapRendererText.includes('hashSignatureParts') || !minimapRendererText.includes('buildMinimapNodeGeometrySignature')) {
    throw new Error('expected minimap renderer cache to include semantic geometry signatures')
  }
}
