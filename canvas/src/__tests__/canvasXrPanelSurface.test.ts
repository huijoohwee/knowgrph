import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  resolveXrPanelRuntimeStack,
  resolveXrPanelSourceProfile,
} from '@/features/three/xrPanelModel'

function readSource(...parts: string[]): string {
  return readFileSync(resolve(process.cwd(), 'src', ...parts), 'utf8')
}

export function testXrModeUsesCanonicalFloatingPanel() {
  const xrPanel = readSource('features', 'three', 'XrPanelView.tsx')
  const xrCameraFramingProjection = readSource('features', 'three', 'XrCameraFramingSection.tsx')
  const xrPanelModel = readSource('features', 'three', 'xrPanelModel.ts')
  const cameraFloatingProjection = readSource('features', 'strybldr', 'StrybldrCameraFloatingPanelView.tsx')
  const sharedCameraFraming = readSource('features', 'strybldr', 'StrybldrCameraFramingSection.tsx')
  const cameraPanel = readSource('features', 'strybldr', 'StrybldrCameraPanel.tsx')
  const cameraModel = readSource('features', 'strybldr', 'strybldrCamera.ts')
  const cameraFramingRuntime = readSource('features', 'strybldr', 'cameraFramingRuntime.ts')
  const cameraFramingPose = readSource('lib', 'camera', 'cameraFramingPose.ts')
  const cameraFramingControls = readSource('features', 'three', 'cameraFramingControlsRuntime.ts')
  const cameraControlsProfile = readSource('features', 'three', 'cameraControlsProfile.ts')
  const threeControls = readSource('features', 'three', 'Controls.tsx')
  const spatialCaptureStage = readSource('features', 'three', 'SpatialCaptureManifestStage.tsx')
  const spatialCaptureTools = readSource('features', 'three', 'xrSpatialCaptureTools.ts')
  const bottomPanel = readSource('features', 'strybldr', 'StrybldrTimelineBottomPanel.tsx')
  const floatingPanel = readSource('lib', 'toolbar', 'ToolbarToolMenu.impl.tsx')
  const viewport = readSource('components', 'CanvasViewport.tsx')
  const floatingTypes = readSource('hooks', 'store', 'store-types', 'graph-state-chat-import.ts')
  const bottomTypes = readSource('hooks', 'store', 'store-types', 'core.ts')
  const uiInitialState = readSource('hooks', 'store', 'uiSliceInitialState.ts')
  const canonicalFrontmatter = readSource('lib', 'markdown', 'frontmatter.ts')
  const appliedFrontmatter = readSource('features', 'parsers', 'canvasFrontmatterPreset.ts')
  const floatingBridge = readSource('features', 'canvas', 'utils.ts')
  const toolbarLauncher = readSource('features', 'toolbar', 'ToolbarMenuLauncher.tsx')
  const iconLibrary = readSource('features', 'panels', 'ui', 'mainPanelHelpIconLibrary.tsx')

  for (const marker of [
    'data-kg-xr-panel="1"',
    'data-kg-xr-panel-surface="floatingPanel"',
    'activateCanvasGraphSurfaceMode',
    '<XrCameraFramingSection',
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
    'setSpatialCaptureAxis(axis)',
    'data-kg-xr-panel-primary-modes="1"',
    'setSpatialCapturePrimaryMode(id)',
    'data-kg-xr-panel-bottom-toolbar="1"',
    'setSpatialCaptureTool(id)',
  ]) {
    if (!xrPanel.includes(marker)) throw new Error(`expected canonical FloatingPanel XR to expose ${marker}`)
  }
  for (const marker of [
    'data-kg-xr-camera-framing="1"',
    'StrybldrCameraFramingSection',
  ]) {
    if (!xrCameraFramingProjection.includes(marker)) throw new Error(`expected thin FloatingPanel XR Camera projection to expose ${marker}`)
  }
  for (const marker of [
    'aria-label="Camera card"',
    'buildStoryboardBoardModel',
    'StrybldrCameraPanel',
    'STRYBLDR_CAMERA_PROPERTY_KEY',
    'serializeStrybldrCameraSettings',
    'updateNode',
    'PanelSelect',
    'readCameraFramingRuntime',
    'publishCameraFramingRuntime',
    'subscribeCameraFramingRuntime',
  ]) {
    if (!sharedCameraFraming.includes(marker)) throw new Error(`expected the shared Camera/XR framing owner to expose ${marker}`)
  }
  if (!cameraFloatingProjection.includes('StrybldrCameraFramingSection') || !cameraFloatingProjection.includes('aria-label="Camera panel"')) {
    throw new Error('expected FloatingPanel Camera to remain a thin shell over the shared camera framing owner')
  }
  const thinCameraProjectionSources = [cameraFloatingProjection, xrCameraFramingProjection, xrPanel]
  for (const forbiddenOwnerToken of ['buildStoryboardBoardModel', 'updateNode', 'STRYBLDR_CAMERA_PROPERTY_KEY', 'serializeStrybldrCameraSettings']) {
    if (thinCameraProjectionSources.some(source => source.includes(forbiddenOwnerToken))) {
      throw new Error(`expected Camera and XR projections to avoid duplicate ${forbiddenOwnerToken} ownership`)
    }
  }
  for (const marker of ['readCameraFramingRuntime', 'publishCameraFramingRuntime', 'subscribeCameraFramingRuntime']) {
    if (!cameraFramingRuntime.includes(marker)) throw new Error(`expected shared camera framing runtime to expose ${marker}`)
  }
  for (const marker of [
    'CameraFramingPose',
    'resolveCameraFramingPose',
    'resolveCameraFramingSettingsFromPose',
    'resolveCameraFramingAxisSettings',
  ]) {
    if (!cameraFramingPose.includes(marker)) throw new Error(`expected shared camera pose adapter to expose ${marker}`)
  }
  for (const marker of [
    'useCameraFramingControlsRuntime',
    'publishCameraFramingRuntime',
    'resolveCameraFramingPose',
    'resolveCameraFramingSettingsFromPose',
    "source: 'axis'",
    "source: 'canvas'",
    "setSpatialCaptureAxis('free')",
    'createCameraFramingSettledInteraction',
    'readCameraFramingControlsReapplyRevision',
    'immediateCanvasPublishRef',
  ]) {
    if (!cameraFramingControls.includes(marker)) throw new Error(`expected the live Three camera bridge to expose ${marker}`)
  }
  if (
    !threeControls.includes('useCameraFramingControlsRuntime({')
    || !threeControls.includes('requestCameraFramingControlsReapply()')
    || !threeControls.includes("} else if (mode !== 'xr') {")
    || !threeControls.includes('resolveCameraControlsOrbitProfile({ mode, modelAssetMode })')
  ) {
    throw new Error('expected Controls to own live Camera/XR pose application and reset requests')
  }
  if (!cameraControlsProfile.includes("if (mode === 'xr') return XR_CAMERA_FRAMING_ORBIT_PROFILE") || !cameraControlsProfile.includes('minPolar: 0') || !cameraControlsProfile.includes('maxPolar: Math.PI')) {
    throw new Error('expected the shared XR controls profile to preserve exact vertical framing poses')
  }
  if (cameraFramingControls.includes("framing.source === 'axis' || framing.source === 'canvas'")) {
    throw new Error('expected canvas-origin framing to reapply after XR mode or model context changes')
  }
  const reframeOwner = sharedCameraFraming.slice(sharedCameraFraming.indexOf('const reframeSelectedCardCamera'), sharedCameraFraming.indexOf('if (!selectedCard)', sharedCameraFraming.indexOf('const reframeSelectedCardCamera')))
  if (reframeOwner.includes("source: 'panel'") || reframeOwner.indexOf('updateNode(selectedCard.id') > reframeOwner.indexOf("source: 'document'")) {
    throw new Error('expected Reframe to accept the persisted graph value as the document-owned runtime snapshot for undo sync')
  }
  if (spatialCaptureStage.includes('camera.position.set(') || spatialCaptureStage.includes('subscribeSpatialCaptureAxis')) {
    throw new Error('expected SpatialCaptureManifestStage to stop competing with Controls for camera pose ownership')
  }
  if (!spatialCaptureTools.includes("SpatialCaptureAxisId = SpatialCaptureViewAxisId | 'free'") || spatialCaptureTools.includes('if (activeSpatialCaptureAxis === axis) return')) {
    throw new Error('expected X/Y/Z commands to support free orbit and repeated same-axis recentering')
  }
  if (!cameraPanel.includes('data-kg-strybldr-camera-panel="1"') || !cameraModel.includes("STRYBLDR_CAMERA_PROPERTY_KEY = 'strybldrCamera'")) {
    throw new Error('expected XR camera framing to preserve the storyboard metadata editor and property contract')
  }
  if (xrPanel.includes('data-kg-xr-panel-open-bottom') || xrPanel.includes('data-kg-xr-panel-open-floating') || xrPanel.includes('XrPanelSurface')) {
    throw new Error('expected XR controls to have one FloatingPanel projection with no cross-shell route')
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

  if (bottomTypes.includes("| 'xr'") || bottomPanel.includes('XrPanelViewLazy') || bottomPanel.includes("view === 'xr'") || viewport.includes('xrBottomPanelVisible')) {
    throw new Error('expected legacy BottomPanel XR types, toggle, mount, and viewport routing to be removed')
  }
  if (!floatingTypes.includes("| 'camera'") || !floatingTypes.includes("| 'xr'") || !uiInitialState.includes("view === 'camera'") || !uiInitialState.includes("view === 'xr'")) {
    throw new Error('expected Camera and XR to remain distinct first-class FloatingPanel projections')
  }
  if (
    !floatingPanel.includes('StrybldrCameraFloatingPanelViewLazy') ||
    !floatingPanel.includes("floatingPanelView === 'camera'") ||
    !floatingPanel.includes("{ view: 'camera'") ||
    !floatingPanel.includes('XrPanelViewLazy') ||
    !floatingPanel.includes('<XrPanelViewLazy />') ||
    !floatingPanel.includes("{ view: 'xr'")
  ) {
    throw new Error('expected FloatingPanel Camera and XR to mount their distinct thin projections')
  }
  if (
    !floatingBridge.includes("| 'camera'") ||
    !floatingBridge.includes("| 'xr'") ||
    !toolbarLauncher.includes("tab === 'camera'") ||
    !toolbarLauncher.includes("tab === 'xr'") ||
    !iconLibrary.includes("'floatingPanel.camera'") ||
    !iconLibrary.includes("'floatingPanel.xr'")
  ) {
    throw new Error('expected the FloatingPanel bridge, launcher, and help registry to support Camera and XR without aliases')
  }
  if (!canonicalFrontmatter.includes("raw === 'camera'") || !canonicalFrontmatter.includes("raw === 'xr'") || !appliedFrontmatter.includes('readFloatingPanelViewPreset')) {
    throw new Error('expected Camera and XR FloatingPanel frontmatter routing to use the canonical shared reader')
  }

  if (existsSync(resolve(process.cwd(), 'src', 'components', 'toolbar', 'Canvas3dModeSelect.tsx'))) {
    throw new Error('expected Canvas View Surface Mode to remain the only mounted 3D/XR selector')
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

  const implementationText = [xrPanel, xrCameraFramingProjection, sharedCameraFraming, cameraFramingRuntime, cameraFramingPose, cameraFramingControls, xrPanelModel, cameraPanel, cameraModel, floatingPanel].join('\n')
  for (const token of [['super', 'splat'].join(''), ['play', 'canvas'].join(''), ['pc', 'ui'].join(''), ['splat', 'Data'].join('')]) {
    if (implementationText.toLowerCase().includes(token.toLowerCase())) {
      throw new Error(`expected XR panel implementation to avoid copied external runtime token ${token}`)
    }
  }
}
