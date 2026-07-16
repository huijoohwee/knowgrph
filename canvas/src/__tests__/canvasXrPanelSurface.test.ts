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
  const xrCameraFramingPath = resolve(process.cwd(), 'src', 'features', 'three', 'XrCameraFramingSection.tsx')
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
  const timelineBottomPanel = readSource('features', 'gitgraph', 'TimelineBottomPanelView.tsx')
  const xrTimelineLane = readSource('features', 'three', 'XrTimelineSceneLane.tsx')
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
    'data-kg-xr-panel-open-timeline="1"',
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
  for (const staleMarker of ['XrPhysicsPlayground', 'data-kg-xr-panel-physics', 'XR_PHYSICS_CONTROLLER_MODES', 'XrCameraFramingSection', 'StrybldrCameraFramingSection', 'data-kg-xr-camera-framing', 'data-kg-xr-panel-camera-surface-active', 'XrMotionReferenceSection', 'data-kg-xr-panel-scene="1"', 'data-kg-xr-panel-runtime="1"']) {
    if (xrPanel.includes(staleMarker)) throw new Error(`expected canonical FloatingPanel XR to remove stale ${staleMarker}`)
  }
  for (const marker of ['XrTimelineSceneLane', "state.floatingPanelView === 'xr'", "state.canvas3dMode === 'xr'"]) {
    if (!timelineBottomPanel.includes(marker)) throw new Error(`expected BottomPanel Timeline to route XR context through ${marker}`)
  }
  for (const marker of ['data-kg-xr-timeline-player="1"', 'data-kg-xr-timeline-lane="scene"', '<GanttTimelineTransportPanel', 'data-kg-xr-timeline-scene="player"', 'data-kg-xr-timeline-runtime=', 'data-kg-xr-timeline-transport="reused-gantt-player"']) {
    if (!xrTimelineLane.includes(marker)) throw new Error(`expected XR to project into the canonical Timeline player through ${marker}`)
  }
  if (existsSync(xrCameraFramingPath)) {
    throw new Error('expected the duplicate FloatingPanel XR Camera projection to be deleted')
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
    if (!sharedCameraFraming.includes(marker)) throw new Error(`expected the canonical FloatingPanel Camera framing owner to expose ${marker}`)
  }
  if (!cameraFloatingProjection.includes('StrybldrCameraFramingSection') || !cameraFloatingProjection.includes('aria-label="Camera panel"')) {
    throw new Error('expected FloatingPanel Camera to remain a thin shell over the shared camera framing owner')
  }
  const thinCameraProjectionSources = [cameraFloatingProjection, xrPanel]
  for (const forbiddenOwnerToken of ['buildStoryboardBoardModel', 'updateNode', 'STRYBLDR_CAMERA_PROPERTY_KEY', 'serializeStrybldrCameraSettings']) {
    if (thinCameraProjectionSources.some(source => source.includes(forbiddenOwnerToken))) {
      throw new Error(`expected panel projections to avoid duplicate ${forbiddenOwnerToken} ownership`)
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
    'isSharedCameraFramingSurfaceMode',
  ]) {
    if (!cameraFramingControls.includes(marker)) throw new Error(`expected the live Three camera bridge to expose ${marker}`)
  }
  if (
    !threeControls.includes('useCameraFramingControlsRuntime({')
    || !threeControls.includes('requestCameraFramingControlsReapply()')
    || !threeControls.includes('isSharedCameraFramingSurfaceMode(mode)')
    || !threeControls.includes("} else if (mode !== 'xr') {")
    || !threeControls.includes('resolveCameraControlsOrbitProfile({ mode, modelAssetMode })')
  ) {
    throw new Error('expected Controls to route 3D/XR camera pose application and reset requests through the shared owner')
  }
  if (!cameraControlsProfile.includes("if (mode === '3d' || mode === 'xr') return SHARED_CAMERA_FRAMING_ORBIT_PROFILE") || !cameraControlsProfile.includes('minPolar: 0') || !cameraControlsProfile.includes('maxPolar: Math.PI')) {
    throw new Error('expected the shared 3D/XR controls profile to preserve exact vertical framing poses')
  }
  for (const staleGate of ["mode !== 'xr' || paused", "paused || mode !== 'xr'", "mode === 'xr' && (axisRequest"]) {
    if (cameraFramingControls.includes(staleGate)) throw new Error(`expected the shared 3D/XR camera bridge to remove XR-only gate ${staleGate}`)
  }
  if (threeControls.includes('globeCameraEllipse') || threeControls.includes('cameraPathEnabled')) {
    throw new Error('expected Controls to remove the competing legacy ellipse camera writer')
  }
  if (cameraFramingControls.includes("framing.source === 'axis' || framing.source === 'canvas'")) {
    throw new Error('expected canvas-origin framing to reapply after 3D/XR mode or model context changes')
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
    throw new Error('expected FloatingPanel Camera to preserve the storyboard metadata editor and property contract')
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
    "id: 'threejs'",
    "id: 'webgl'",
    "id: 'webgpu'",
    "id: 'webxr'",
    "id: 'gltf'",
    "id: 'glb'",
    "id: 'ply'",
    "id: 'spz'",
  ]) {
    if (!xrPanelModel.includes(marker)) throw new Error(`expected shared XR panel model to expose ${marker}`)
  }

  if (bottomTypes.includes("| 'xr'") || bottomPanel.includes('XrPanelViewLazy') || bottomPanel.includes("view === 'xr'") || viewport.includes('xrBottomPanelVisible')) {
    throw new Error('expected legacy BottomPanel XR types, toggle, mount, and viewport routing to be removed')
  }
  if (!floatingTypes.includes("| 'camera'") || !floatingTypes.includes("| 'xr'") || !uiInitialState.includes("view === 'camera'") || !uiInitialState.includes("view === 'xr'")) {
    throw new Error('expected Camera and XR to remain distinct first-class FloatingPanel panels')
  }
  if (
    !floatingPanel.includes('StrybldrCameraFloatingPanelViewLazy') ||
    !floatingPanel.includes("floatingPanelView === 'camera'") ||
    !floatingPanel.includes("{ view: 'camera'") ||
    !floatingPanel.includes('XrPanelViewLazy') ||
    !floatingPanel.includes('<XrPanelViewLazy />') ||
    !floatingPanel.includes("{ view: 'xr'")
  ) {
    throw new Error('expected FloatingPanel Camera and XR to mount their distinct canonical panels')
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
  if (stackStates.threejs !== 'active' || stackStates.webgl !== 'active' || stackStates.webgpu !== 'available' || stackStates.webxr !== 'available' || stackStates.ply !== 'active' || stackStates.spz !== 'unsupported') {
    throw new Error(`expected native graphics stack to reflect active PLY XR state, got ${JSON.stringify(stackStates)}`)
  }
  const webgpuItem = stack.find(item => item.id === 'webgpu')
  if (!webgpuItem?.value.includes('not active') || webgpuItem.state === 'active') {
    throw new Error(`expected WebGPU to be reported as experimental browser availability, never the active renderer: ${JSON.stringify(webgpuItem)}`)
  }
  const gltfProfile = resolveXrPanelSourceProfile('---\nkgAssetFormat: "gltf"\n---')
  const gltfStack = Object.fromEntries(resolveXrPanelRuntimeStack({ capabilities: { webgl: true, webgl2: false, webgpu: false, webxr: false }, profile: gltfProfile, xrActive: false }).map(item => [item.id, item.state]))
  if (gltfStack.gltf !== 'source-ready' || gltfStack.glb !== 'available' || gltfStack.webgl !== 'active' || gltfStack.webgpu !== 'unavailable') {
    throw new Error(`expected distinct glTF/GLB and truthful WebGL/WebGPU states, got ${JSON.stringify(gltfStack)}`)
  }
  const glbProfile = resolveXrPanelSourceProfile('---\nkgAssetFormat: "glb"\n---')
  const glbStack = Object.fromEntries(resolveXrPanelRuntimeStack({ capabilities: { webgl: true, webgl2: true, webgpu: false, webxr: false }, profile: glbProfile, xrActive: false }).map(item => [item.id, item.state]))
  if (glbStack.glb !== 'source-ready' || glbStack.gltf !== 'available') {
    throw new Error(`expected GLB to remain distinct from glTF, got ${JSON.stringify(glbStack)}`)
  }
  const spzProfile = resolveXrPanelSourceProfile('---\nkgSpatialCaptureFormat: "spz"\n---')
  const spzItem = resolveXrPanelRuntimeStack({ capabilities: { webgl: true, webgl2: true, webgpu: true, webxr: true }, profile: spzProfile, xrActive: false }).find(item => item.id === 'spz')
  if (spzProfile.format !== 'spz' || spzItem?.state !== 'unsupported' || !spzItem.value.includes('Recognized source')) {
    throw new Error(`expected SPZ to be recognized without claiming runtime support, got ${JSON.stringify({ spzProfile, spzItem })}`)
  }

  const implementationText = [xrPanel, sharedCameraFraming, cameraFramingRuntime, cameraFramingPose, cameraFramingControls, xrPanelModel, cameraPanel, cameraModel, floatingPanel].join('\n')
  for (const token of [['super', 'splat'].join(''), ['play', 'canvas'].join(''), ['pc', 'ui'].join(''), ['splat', 'Data'].join('')]) {
    if (implementationText.toLowerCase().includes(token.toLowerCase())) {
      throw new Error(`expected XR panel implementation to avoid copied external runtime token ${token}`)
    }
  }
}
