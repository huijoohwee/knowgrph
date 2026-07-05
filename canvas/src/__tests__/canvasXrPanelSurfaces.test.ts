import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  resolveXrPanelRuntimeStack,
  resolveXrPanelSourceProfile,
} from '@/features/three/xrPanelModel'

function readSource(...parts: string[]): string {
  return readFileSync(resolve(process.cwd(), 'src', ...parts), 'utf8')
}

export function testXrModeMountsSharedBottomAndFloatingPanels() {
  const xrPanel = readSource('features', 'three', 'XrPanelView.tsx')
  const xrPanelModel = readSource('features', 'three', 'xrPanelModel.ts')
  const bottomPanel = readSource('features', 'strybldr', 'StrybldrTimelineBottomPanel.tsx')
  const floatingPanel = readSource('lib', 'toolbar', 'ToolbarToolMenu.impl.tsx')
  const viewport = readSource('components', 'CanvasViewport.tsx')
  const floatingTypes = readSource('hooks', 'store', 'store-types', 'graph-state-chat-import.ts')
  const bottomTypes = readSource('hooks', 'store', 'store-types', 'core.ts')
  const uiInitialState = readSource('hooks', 'store', 'uiSliceInitialState.ts')
  const frontmatterPreset = readSource('features', 'parsers', 'canvasFrontmatterPreset.ts')
  const floatingBridge = readSource('features', 'canvas', 'utils.ts')
  const toolbarLauncher = readSource('features', 'toolbar', 'ToolbarMenuLauncher.tsx')
  const iconLibrary = readSource('features', 'panels', 'ui', 'mainPanelHelpIconLibrary.tsx')
  const minimap = readSource('features', 'minimap', 'Minimap.tsx')

  for (const marker of [
    'data-kg-xr-panel="1"',
    "data-kg-xr-panel-surface={surface}",
    "setCanvas3dMode('xr')",
    "setCanvasRenderMode('3d')",
    "setBottomSurfaceTab('xr')",
    "setFloatingPanelView('xr')",
    'readXrPhysicsPlaygroundControls',
    'subscribeXrPhysicsPlaygroundControls',
    'setXrPhysicsPlaygroundMode',
    'XR_PHYSICS_CONTROLLER_MODES.map',
    'data-kg-xr-panel-source-format',
    'data-kg-xr-panel-ingestion-cache',
    'data-kg-xr-panel-render-cache',
    'data-kg-xr-panel-graphics-stack="1"',
    'data-kg-xr-panel-capability={item.id}',
    'data-kg-xr-panel-spatial-tools="1"',
    'data-kg-xr-panel-center-controls="1"',
    'data-kg-xr-panel-axis-widget="1"',
    'data-kg-xr-panel-axis={axis}',
    'setSpatialCaptureAxis(axis)',
    'data-kg-xr-panel-primary-modes="1"',
    'data-kg-xr-panel-primary-mode-active={spatialPrimaryMode}',
    'data-kg-xr-panel-primary-mode={id}',
    'setSpatialCapturePrimaryMode(id)',
    'data-kg-xr-panel-center-action-active={spatialCenterAction}',
    'setSpatialCaptureCenterAction(action)',
    'data-kg-xr-panel-bottom-toolbar="1"',
    'data-kg-xr-panel-bottom-tool={id}',
    'SPATIAL_CAPTURE_RAIL_BUTTONS.map',
    'subscribeSpatialCaptureTool(setSpatialToolState)',
    'subscribeSpatialCapturePrimaryMode(setSpatialPrimaryModeState)',
    'subscribeSpatialCaptureAxis(setSpatialAxisState)',
    'subscribeSpatialCaptureCenterAction(setSpatialCenterActionState)',
    'setSpatialCaptureTool(id)',
  ]) {
    if (!xrPanel.includes(marker)) throw new Error(`expected shared XR panel to expose ${marker}`)
  }
  if (xrPanel.includes('data-kg-xr-panel-primary-mode={id}\n                disabled') || xrPanel.includes('data-kg-xr-panel-center-action={action}\n                  disabled')) {
    throw new Error('expected moved XR spatial icons and center actions to be functional instead of disabled placeholders')
  }
  for (const marker of [
    'resolveXrPanelSourceProfile',
    'resolveXrPanelRuntimeStack',
    'readBrowserXrGraphicsCapabilities',
    'kgSpatialCaptureFormat',
    'kgXrIngestionCacheKey',
    'kgXrRenderCacheKey',
    "id: 'webgl'",
    "id: 'webgpu'",
    "id: 'webxr'",
    "id: 'gltf'",
    "id: 'ply'",
  ]) {
    if (!xrPanelModel.includes(marker)) throw new Error(`expected shared XR panel model to expose ${marker}`)
  }

  if (!bottomTypes.includes("| 'xr'") || !floatingTypes.includes("| 'xr'") || !uiInitialState.includes("view === 'xr'")) {
    throw new Error('expected XR to be a first-class BottomSurfaceTab and FloatingPanelView store value')
  }
  if (!frontmatterPreset.includes("raw === 'xr'") || !floatingBridge.includes("| 'xr'")) {
    throw new Error('expected XR panel routing to be accepted by frontmatter presets and floating-panel open events')
  }
	  if (!viewport.includes("bottomSurfaceTab === 'xr'") || !viewport.includes("xrBottomPanelVisible")) {
	    throw new Error('expected CanvasViewport to mount the BottomPanel XR surface from shared bottomSurfaceTab state')
	  }
  for (const marker of ['minimapOverlayVisible', "activeSurface === '3d' && effectiveCanvas3dMode === '3d'", 'data-kg-minimap-overlay-surface={minimapOverlaySurface}', "data-kg-minimap-overlay-placement=\"bottom-left\"", 'data-kg-css-inspector-selectable="minimap-overlay"']) {
    if (!viewport.includes(marker)) throw new Error(`expected CanvasViewport to expose 3D minimap overlay marker ${marker}`)
  }
	  if (!bottomPanel.includes('XrPanelViewLazy') || !bottomPanel.includes('surface="bottomPanel"') || !bottomPanel.includes('data-kg-strybldr-bottom-timeline-xr-toggle="1"')) {
    throw new Error('expected BottomPanel XR to reuse the shared XR panel view and expose a stable toggle marker')
  }
  if (!floatingPanel.includes('XrPanelViewLazy') || !floatingPanel.includes('surface="floatingPanel"') || !floatingPanel.includes("{ view: 'xr'")) {
    throw new Error('expected FloatingPanel XR to reuse the shared XR panel view and toolbar registry')
  }
	  if (!toolbarLauncher.includes("tab === 'xr'") || !iconLibrary.includes("'floatingPanel.xr'")) {
	    throw new Error('expected the floating-panel bridge and icon registry to support XR without aliases')
	  }
  for (const marker of ['data-kg-minimap-root="1"', 'data-kg-minimap-surface="1"', 'data-kg-minimap-svg="1"', 'data-kg-css-inspector-selectable="minimap"', 'data-kg-css-inspector-selectable="minimap-surface"', 'relative isolate group kg-minimap-root', 'kg-minimap-surface', 'kg-minimap-svg']) {
    if (!minimap.includes(marker)) throw new Error(`expected minimap to expose CSS-inspector marker ${marker}`)
  }

	  const plyProfile = resolveXrPanelSourceProfile('---\nkgSpatialCaptureFormat: "ply"\nkgAssetFormat: "ply"\nkgXrIngestionCacheKey: "abc123"\nkgXrRenderCacheKey: "abc123"\n---')
  if (plyProfile.kind !== 'spatial-capture' || plyProfile.format !== 'ply' || !plyProfile.isSpatialCapture || plyProfile.renderCacheKey !== 'abc123') {
    throw new Error(`expected PLY spatial capture profile, got ${JSON.stringify(plyProfile)}`)
  }
  const stack = resolveXrPanelRuntimeStack({
    capabilities: { webgl: true, webgl2: true, webgpu: true, webxr: true },
    profile: plyProfile,
    xrActive: true,
  })
  const stackStates = Object.fromEntries(stack.map(item => [item.id, item.state]))
  if (stackStates.webgl !== 'available' || stackStates.webgpu !== 'available' || stackStates.webxr !== 'active' || stackStates.ply !== 'source-ready') {
    throw new Error(`expected native graphics stack to reflect active PLY XR state, got ${JSON.stringify(stackStates)}`)
  }

  const implementationText = [xrPanel, xrPanelModel, bottomPanel, floatingPanel, viewport].join('\n')
  const forbiddenReferenceTokens = [
    ['super', 'splat'].join(''),
    ['play', 'canvas'].join(''),
    ['pc', 'ui'].join(''),
    ['splat', 'Data'].join(''),
  ]
  for (const token of forbiddenReferenceTokens) {
    if (implementationText.toLowerCase().includes(token.toLowerCase())) {
      throw new Error(`expected XR panel implementation to avoid copied external runtime token ${token}`)
    }
  }
}
