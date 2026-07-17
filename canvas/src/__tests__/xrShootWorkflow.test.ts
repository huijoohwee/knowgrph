import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { GraphData } from '@/lib/graph/types'
import {
  XR_MOTION_REFERENCE_GRAPH_METADATA_KEY,
  XR_MOTION_REFERENCE_MAX_CAMERA_MARKS,
  sampleXrMotionReferenceCameraRig,
  sampleXrMotionReferenceCameraSettings,
  serializeXrMotionReferencePlan,
} from '@/features/three/xrMotionReferenceModel'
import { buildXrMotionReferencePackage } from '@/features/three/xrMotionReferencePackage'
import { xrChoreographyCanDriveCamera, xrChoreographyOwnsCamera } from '@/features/three/xrCameraControlOwnership'
import { controlLocalCamera, inspectLocalCamera } from '@/features/strybldr/cameraMcpRuntime'
import {
  publishCameraFramingRuntime,
  readCameraFramingRuntime,
  readCameraFramingRuntimeDocumentKey,
} from '@/features/strybldr/cameraFramingRuntime'
import { shouldApplySharedCameraFramingRevision } from '@/features/three/cameraFramingControlsRuntime'
import { hydrateCanonicalXrMotionReferenceRuntime } from '@/features/three/XrMotionReferenceRuntimeBridge'
import {
  registerAgenticOsRemoteGrammarCatalogEntries,
  resetAgenticOsRemoteGrammarCatalogForTests,
} from '@/features/agentic-os/agenticOsRemoteGrammarClient'
import { resolveChatInvocationCatalogEntries } from '@/features/chat/chatInvocationRegistry'
import { useGraphStore } from '@/hooks/useGraphStore'
import {
  dropXrMotionReferenceCastMark,
  hydrateXrMotionReferenceRuntime,
  readXrMotionReferenceRuntime,
  retimeXrMotionReferenceCameraMark,
  retimeXrMotionReferenceCastMark,
  selectXrMotionReferenceActor,
  selectXrMotionReferenceCameraMark,
  selectXrMotionReferenceCastMark,
  setXrMotionReferenceCameraMark,
  setXrMotionReferenceCameraRig,
  setXrMotionReferenceCastMarkArmed,
  setXrMotionReferenceDuration,
  setXrMotionReferencePlayhead,
} from '@/features/three/xrMotionReferenceRuntime'

function readSource(...parts: string[]): string {
  return readFileSync(resolve(process.cwd(), 'src', ...parts), 'utf8')
}

function buildShootGraph(): GraphData {
  return {
    type: 'Graph',
    nodes: [{ id: 'actor-a', label: 'Lead', type: 'Person', properties: {} }],
    edges: [],
    metadata: {},
  }
}

const CAMERA_DICTIONARY_TOKENS = {
  command: ['/camera.frame', '/camera.animate', '/camera.play', '/camera.scrub'],
  semantic: ['#camera', '#camera-shot', '#camera-motion'],
  binding: ['@camera', '@selected-actor'],
} as const

function registerCanonicalCameraGrammar() {
  resetAgenticOsRemoteGrammarCatalogForTests()
  for (const [kind, tokens] of Object.entries(CAMERA_DICTIONARY_TOKENS)) {
    const fileName = kind === 'command'
      ? 'DICTIONARY-COMMAND.md'
      : kind === 'semantic'
        ? 'DICTIONARY-SEMANTIC.md'
        : 'DICTIONARY-BINDING.md'
    const sourcePath = resolve(process.cwd(), '..', '..', 'agentic-canvas-os', 'docs', fileName)
    const source = readFileSync(sourcePath, 'utf8')
    for (const token of tokens) {
      if (!source.includes(`  - "${token}"`) || !source.includes(`| \`${token}\` |`)) {
        throw new Error(`expected canonical ${fileName} to own ${token}`)
      }
    }
    registerAgenticOsRemoteGrammarCatalogEntries(tokens.map(token => ({
      token,
      kind,
      sourcePath: fileName,
    })))
  }
}

export function testXrShootWorkflowMarksRigsRetimeAndExports() {
  registerCanonicalCameraGrammar()
  const ownershipArgs = { mode: 'xr', xrEmptyWorld: false, cameraMarkCount: 1 } as const
  if (!xrChoreographyCanDriveCamera(ownershipArgs)
    || xrChoreographyOwnsCamera({ ...ownershipArgs, timelinePlaying: false })
    || !xrChoreographyOwnsCamera({ ...ownershipArgs, timelinePlaying: true })) {
    throw new Error('expected Camera choreography to drive scrub previews while reserving exclusive ownership for active playback')
  }
  if (shouldApplySharedCameraFramingRevision({ appliedRevision: 4, appliedContextKey: 'xr:graph', revision: 4, contextKey: 'xr:graph', forcedReapply: false })
    || !shouldApplySharedCameraFramingRevision({ appliedRevision: 4, appliedContextKey: 'xr:graph', revision: 5, contextKey: 'xr:graph', forcedReapply: false })
    || !shouldApplySharedCameraFramingRevision({ appliedRevision: 4, appliedContextKey: 'xr:graph', revision: 4, contextKey: 'xr:graph', forcedReapply: true })) {
    throw new Error('expected pausing at the same playhead to preserve its track pose until a new frame or forced reapply arrives')
  }
  const shootCameraSource = readSource('features', 'strybldr', 'XrShootCameraSection.tsx')
  const cameraPanelSource = readSource('features', 'strybldr', 'StrybldrCameraFloatingPanelView.tsx')
  const sharedCameraSource = readSource('features', 'strybldr', 'StrybldrCameraFramingSection.tsx')
  const retimeSource = readSource('features', 'three', 'CameraMotionMarkRetime.tsx')
  const timelineSource = readSource('features', 'three', 'XrCameraMotionSection.tsx')
  const timelineChromeSource = readSource('components', 'timeline', 'TimelineTransportControls.tsx')
  const timelineChromeGanttCssSource = readSource('components', 'timeline', 'TimelineTransportControlsMermaidGantt.css')
  const timelineRulerSource = readSource('components', 'timeline', 'VideoSequenceTimelineRuler.tsx')
  const timelineRulerCssSource = readSource('components', 'timeline', 'VideoSequenceTimelineRuler.css')
  const timelineTimeAxisControlsSource = readSource('components', 'timeline', 'VideoSequenceTimeAxisControls.tsx')
  const ganttTransportSource = readSource('features', 'gitgraph', 'GanttTimelineTransportPanel.tsx')
  const bottomTimelineSource = readSource('features', 'gitgraph', 'TimelineBottomPanelView.tsx')
  const cameraMcpContractSource = readSource('features', 'strybldr', 'cameraMcpContract.mjs')
  const cameraMcpRuntimeSource = readSource('features', 'strybldr', 'cameraMcpRuntime.ts')
  const cameraMcpInvocationSource = readSource('features', 'strybldr', 'CameraMcpInvocationSection.tsx')
  const cameraWebMcpSource = readSource('features', 'agent-ready', 'cameraWebMcpTools.ts')
  const floatingPanelCatalogLayoutSource = readSource('lib', 'ui', 'floatingPanelCatalogLayout.tsx')
  const mediaCatalogSharedSource = readSource('features', 'command-menu', 'mediaCatalogShared.tsx')
  const stageSource = readSource('features', 'three', 'XrMotionReferenceStage.tsx')
  const subjectSource = readSource('features', 'three', 'XrSceneLibrarySubject.tsx')
  const retimeCssSource = readSource('features', 'three', 'CameraMotionMarkRetime.css')
  const choreographyControlsSource = readSource('features', 'three', 'XrChoreographyMarkControls.tsx')
  const runtimeSource = readSource('features', 'three', 'xrMotionReferenceRuntime.ts')
  const stageGeometrySource = readSource('features', 'three', 'XrStagePresetGeometry.tsx')
  const controlsSource = readSource('features', 'three', 'Controls.tsx')
  const playbackSource = readSource('features', 'three', 'xrCameraPlaybackControlsRuntime.ts')
  const packageSource = readSource('features', 'three', 'xrMotionReferencePackage.ts')

  for (const marker of [
    'data-kg-xr-shoot-panel="1"',
    'data-kg-xr-shoot-cast-mark="1"',
    'data-kg-xr-shoot-medium-shot="1"',
    'data-kg-xr-shoot-camera-mark="1"',
    'XR_MOTION_REFERENCE_CAMERA_RIGS',
    "event.key.toLowerCase() === 'm'",
  ]) {
    if (!shootCameraSource.includes(marker)) throw new Error(`expected FloatingPanel Camera SHOOT to expose ${marker}`)
  }
  for (const marker of ['<StrybldrCameraFramingSection', '<XrShootCameraSection']) {
    if (!cameraPanelSource.includes(marker)) throw new Error(`expected canonical FloatingPanel Camera ownership through ${marker}`)
  }
  for (const marker of ['<CollapsibleSection', '<ExpandCollapseAllButton', '<CameraMcpInvocationSection', 'useCollapsibleSectionGroup', 'Expand All Camera sections', 'Collapse All Camera sections']) {
    if (!cameraPanelSource.includes(marker)) throw new Error(`expected Camera to reuse the 3D-for-XR disclosure owner through ${marker}`)
  }
  for (const marker of ['useAgenticOsRemoteGrammarCatalog', 'inspectLocalCamera', 'data-kg-camera-webmcp-tool', 'data-kg-camera-invocation-token', 'floatingPanelCatalogThreeRowClassName', 'floatingPanelCatalogThreeRowThumbnailFrameClassName']) {
    if (!cameraMcpInvocationSource.includes(marker)) throw new Error(`expected Camera MCP cards to project the shared catalog through ${marker}`)
  }
  if (!floatingPanelCatalogLayoutSource.includes('FLOATING_PANEL_CATALOG_THREE_ROW_LAYOUT')) {
    throw new Error('expected the shared floating-panel catalog owner to name the three-row layout')
  }
  for (const marker of ['floatingPanelCatalogThreeRowClassName', 'floatingPanelCatalogThreeRowThumbnailFrameClassName']) {
    if (!floatingPanelCatalogLayoutSource.includes(marker) || !mediaCatalogSharedSource.includes(marker)) {
      throw new Error(`expected Camera and Media 3D to share the three-row catalog layout through ${marker}`)
    }
  }
  if (cameraPanelSource.includes('<XrCameraMotionSection')) throw new Error('expected FloatingPanel Camera to leave motion transport in BottomPanel Timeline')
  if (cameraPanelSource.indexOf('<StrybldrCameraFramingSection') > cameraPanelSource.indexOf('<XrShootCameraSection')) {
    throw new Error('expected the shared globe Camera utilities to remain first in every surface mode')
  }
  for (const marker of ['data-kg-xr-timeline-retime="1"', 'retimeXrMotionReferenceCastMark', 'retimeXrMotionReferenceCameraMark', '<TimelineTransportTimeAxisMark', 'laneStyle="video"', 'laneStyle="audio"', 'data-kg-xr-lane-cast-mark', 'data-kg-xr-lane-camera-mark', 'selectXrMotionReferenceCastMark', 'aria-pressed={selected}', 'data-kg-xr-stage-highlight-target']) {
    if (!retimeSource.includes(marker)) throw new Error(`expected Camera choreography retiming to expose ${marker}`)
  }
  for (const marker of ["laneTarget?.kind === 'cast'", "laneTarget?.kind === 'camera'", 'data-kg-xr-choreography-cast-lane', 'data-kg-xr-choreography-camera-lane', 'data-kg-xr-choreography-lane-axis', 'beginRulerMarkDrag', 'resolveVideoSequenceRulerInsetPixelMetrics', 'XrChoreographyMarkControls', 'setXrMotionReferenceCastMarkChoreography', 'setXrMotionReferenceCameraMarkEasing', 'data-kg-xr-ruler-mark-editor', 'data-kg-xr-speed-warning-count']) {
    if (!retimeSource.includes(marker)) throw new Error(`expected each cast and Camera track to expose the shared per-mark choreography model through ${marker}`)
  }
  for (const marker of ['XR_CHOREOGRAPHY_EASINGS', 'XR_CHOREOGRAPHY_GAITS', 'data-kg-xr-mark-easing', 'data-kg-xr-mark-gait', 'data-kg-xr-speed-warning']) {
    if (!choreographyControlsSource.includes(marker)) throw new Error(`expected shared choreography controls to expose ${marker}`)
  }
  for (const marker of ['xr-camera-motion-retime-lane-label', 'xr-camera-motion-retime-lane-mark', 'position: absolute', 'inset: 0', 'top: 50%', 'transform: translate(-50%, -50%)', 'cursor: ew-resize', 'xr-camera-motion-mark-selection-controls', '[aria-pressed="true"]']) {
    if (!retimeCssSource.includes(marker)) throw new Error(`expected cast and Camera marks to use dedicated shared-scale lanes through ${marker}`)
  }
  for (const marker of ['<CameraMotionMarkRetime', 'layout="lane"', 'layout="controls"', 'laneTarget={{ kind:', 'timelineInsertedLanes={[', "insertAfterLaneId: 'scene'", 'includeChoreographyCues: false', '<TimelineTransportInlineClip', '<TimelineTransportTimeAxisClip', 'data-kg-xr-choreography-shared-axis-rail', 'data-kg-xr-timeline-consolidated-lane="stage-output-ruler"', 'data-kg-xr-choreography-cast-lane-label', 'data-kg-xr-choreography-camera-lane-label', 'data-kg-xr-timeline-control-bar="stage-output"', 'data-kg-xr-timeline-seconds-control="time-axis"', 'aria-label="XR timeline seconds"', 'data-kg-xr-timeline-fps-control="time-axis"', 'aria-label="XR timeline FPS"', 'runtimeDurationSeconds={runtime.plan.durationSeconds}', 'runtimeFrameRate={runtime.plan.fps}', 'data-kg-xr-timeline-transport="reused-gantt-player"', '<GanttTimelineTransportPanel', 'supplementalLanes={', 'timeAxisControls={']) {
    if (!timelineSource.includes(marker)) throw new Error(`expected BottomPanel Timeline to own consolidated XR motion through ${marker}`)
  }
  for (const forbidden of ['layout="ruler"', 'layout="time-axis"', 'data-kg-xr-timeline-control-bar="marks"', 'timeRulerOverlay={<CameraMotionMarkRetime', '--kg-xr-timeline-marks-height', '>Marks</span>']) {
    if (timelineSource.includes(forbidden)) throw new Error(`expected BottomPanel Timeline to remove the duplicate marks lane, found ${forbidden}`)
  }
  if (timelineSource.indexOf('<CameraMotionMarkRetime') < timelineSource.indexOf('<GanttTimelineTransportPanel')) {
    throw new Error('expected XR Stage/Output and mark retiming to live inside the Gantt transport lane')
  }
  for (const marker of ['timeline-transport-supplemental-lanes', 'TimelineTransportInlineClip', 'TimelineTransportTimeAxisClip', 'TimelineTransportTimeAxisMark', 'timeline-transport-track-clip--lane-${laneStyle}', 'timeline-transport-track-clip-label', 'timeline-transport-time-axis-clip', 'timeline-transport-time-axis-mark']) {
    if (!timelineChromeSource.includes(marker)) throw new Error(`expected shared Gantt clip UI reuse through ${marker}`)
  }
  if (!ganttTransportSource.includes('supplementalLanes') || !ganttTransportSource.includes('timeAxisControls') || !ganttTransportSource.includes('timeRulerOverlay') || !ganttTransportSource.includes('timelineInsertedLanes')) {
    throw new Error('expected the shared Gantt transport to own supplemental-lane, time-axis, ruler-overlay, and inserted-lane slots')
  }
  for (const marker of ['timeAxisControls?: React.ReactNode', 'timeRulerOverlay?: React.ReactNode', 'timelineInsertedLanes?: readonly VideoSequenceTimelineInsertedLane[]', '<VideoSequenceTimeAxisControls>{timeAxisControls}</VideoSequenceTimeAxisControls>', '{timeRulerOverlay}', 'visibleLanes.flatMap(lane', 'data-kg-video-sequence-inserted-lane-content']) {
    if (!timelineRulerSource.includes(marker)) throw new Error(`expected the shared time ruler to expose ${marker}`)
  }
  for (const marker of [':not(.timeline-transport-time-axis-clip)', ':not(.timeline-transport-time-axis-mark)']) {
    if (!timelineRulerCssSource.includes(marker)) throw new Error(`expected nested shared time-axis primitives to opt out of full clip chrome through ${marker}`)
  }
  for (const marker of ['aria-label="Timeline time-axis controls"', 'data-kg-video-sequence-time-axis-controls="1"']) {
    if (!timelineTimeAxisControlsSource.includes(marker)) throw new Error(`expected the shared time-axis control owner to expose ${marker}`)
  }
  if (!timelineChromeGanttCssSource.includes(':has(.timeline-video-sequence-time-axis-controls)') || !timelineChromeGanttCssSource.includes('--kg-video-sequence-lane-sidebar-width: 184px')) {
    throw new Error('expected time-axis controls and supplemental lanes to share one widened sidebar column')
  }
  for (const marker of ['resolveVideoSequenceRulerInsetLeft', 'resolveVideoSequenceRulerInsetPixelMetrics', 'resolveVideoSequenceTimelineScaleDurationSeconds', 'data-kg-xr-timeline-retime-scale-seconds']) {
    if (!retimeSource.includes(marker)) throw new Error(`expected mark retiming to share ruler geometry through ${marker}`)
  }
  const stageOutputBarStart = timelineSource.indexOf('data-kg-xr-timeline-control-bar="stage-output"')
  const stageOutputBarSource = timelineSource.slice(stageOutputBarStart, timelineSource.indexOf('</TimelineTransportInlineClip>', stageOutputBarStart))
  if (stageOutputBarSource.includes('>FPS</span>') || stageOutputBarSource.includes('>Seconds</span>')) {
    throw new Error('expected Seconds and FPS to leave the Stage/Output bar and align with the shared time axis')
  }
  if (!bottomTimelineSource.includes('XrCameraMotionSection') || !bottomTimelineSource.includes('canvas3dMode')) {
    throw new Error('expected BottomPanel Timeline to restore its XR motion owner')
  }
  if (sharedCameraSource.includes('No storyboard card loaded.') || !sharedCameraSource.includes("data-kg-camera-framing-mode={selectedCard ? 'storyboard' : 'shared'}")) {
    throw new Error('expected globe-like shared Camera utilities to remain available without a storyboard card')
  }
  for (const marker of ['onFloorPoint={runtime.castMarkArmed ? placeCastMark : undefined}', 'dropXrMotionReferenceCastMark', 'MarkNumberSprite', 'markNumber: index + 1', 'kg_xr_motion_cast_mark_highlight_', 'runtime.selectedMark?.kind === \'cast\'', 'XR_MOTION_REFERENCE_SELECTION_COLOR']) {
    if (!stageSource.includes(marker)) throw new Error(`expected direct numbered XR floor marking to expose ${marker}`)
  }
  for (const marker of ['<XrSceneLibrarySubject', 'selected={runtime.selectedActorId === subject.id}', 'selectBoundXrActor(subject.id)']) {
    if (!stageSource.includes(marker)) throw new Error(`expected timeline and stage asset selection to share actor state through ${marker}`)
  }
  for (const marker of ['kg_xr_scene_subject_selected_', 'onSelect?.()', 'event.stopPropagation()', 'XR_MOTION_REFERENCE_SELECTION_COLOR']) {
    if (!subjectSource.includes(marker)) throw new Error(`expected selectable XR assets to expose a visible stage highlight through ${marker}`)
  }
  for (const marker of ['selectedMark: XrMotionReferenceMarkSelection', 'selectXrMotionReferenceCastMark', 'selectXrMotionReferenceCameraMark', 'resolveExistingXrMotionReferenceMarkSelection']) {
    if (!runtimeSource.includes(marker)) throw new Error(`expected XR mark highlight selection runtime to expose ${marker}`)
  }
  if (!stageGeometrySource.includes('onFloorPoint([event.point.x, groundY, event.point.z])')) {
    throw new Error('expected the native stage floor to own the bounded Three pointer projection')
  }
  if (!controlsSource.includes('useXrMotionReferenceCameraPlayback({')
    || !playbackSource.includes('sampleXrMotionReferenceCameraPose')
    || !playbackSource.includes('resolveCameraVerticalFovDegrees')
    || !playbackSource.includes('requestXrMotionReferenceCameraPlaybackReapply')
    || !controlsSource.includes('pendingCameraSceneResetRef')
    || !controlsSource.includes("if (mode === 'xr')")) {
    throw new Error('expected scrub/play camera choreography to use the XR camera playback owner')
  }
  if (!packageSource.includes('cameraRig:') || !packageSource.includes('cameraLensMm:')) {
    throw new Error('expected deterministic frame samples to carry rig and lens data')
  }

  for (const marker of ['/camera.frame', '/camera.animate', '/camera.play', '/camera.scrub']) {
    if (!cameraMcpContractSource.includes(marker)) throw new Error(`expected Camera / @ # invocation contract to expose ${marker}`)
  }
  if (cameraMcpContractSource.includes('CAMERA_INVOCATION_CATALOG')) {
    throw new Error('expected Camera invocation metadata to resolve only from the Agentic Canvas OS dictionaries')
  }
  for (const marker of ['inspectLocalCamera', 'controlLocalCamera', 'publishCameraFramingRuntime', 'setXrMotionReferenceCameraMark', 'setTimelineTransportState']) {
    if (!cameraMcpRuntimeSource.includes(marker) && !cameraWebMcpSource.includes(marker)) throw new Error(`expected Camera MCP runtime to expose ${marker}`)
  }

  const implementation = [shootCameraSource, cameraPanelSource, sharedCameraSource, retimeSource, timelineSource, stageSource, stageGeometrySource, playbackSource, packageSource, cameraMcpContractSource, cameraMcpRuntimeSource, cameraMcpInvocationSource].join('\n').toLowerCase()
  for (const forbidden of ['wassermanproductions', 'blockout', 'ffmpeg', 'electron-vite']) {
    if (implementation.includes(forbidden)) throw new Error(`expected the native SHOOT implementation to avoid external runtime token ${forbidden}`)
  }

  const graphData = buildShootGraph()
  hydrateXrMotionReferenceRuntime({ sceneKey: 'shoot-scene', nodes: graphData.nodes, persistedValue: null })
  selectXrMotionReferenceActor('actor-a')
  setXrMotionReferenceDuration(6)
  setXrMotionReferencePlayhead(1)
  setXrMotionReferenceCastMarkArmed(true)
  dropXrMotionReferenceCastMark([2, 0, -1])
  const droppedMark = readXrMotionReferenceRuntime().plan.cast[0]?.marks.find(mark => mark.timeSeconds === 1)
  if (!droppedMark || !readXrMotionReferenceRuntime().castMarkArmed) {
    throw new Error('expected M-armed floor placement to create a cast mark at the shared playhead')
  }
  selectXrMotionReferenceCastMark('actor-a', droppedMark.id)
  const selectedCastMark = readXrMotionReferenceRuntime().selectedMark
  if (selectedCastMark?.kind !== 'cast' || selectedCastMark.actorId !== 'actor-a' || selectedCastMark.markId !== droppedMark.id) {
    throw new Error('expected a timeline cast mark selection to target its matching XR stage mark')
  }
  retimeXrMotionReferenceCastMark('actor-a', droppedMark.id, 2.25)
  const retimedCastRuntime = readXrMotionReferenceRuntime()
  const retimedCastMark = retimedCastRuntime.plan.cast[0]?.marks.find(mark => mark.timeSeconds === 2.25)
  if (!retimedCastMark) {
    throw new Error('expected cast mark retiming to update the native plan')
  }
  if (retimedCastRuntime.selectedMark?.kind !== 'cast' || retimedCastRuntime.selectedMark.markId !== retimedCastMark.id) {
    throw new Error('expected retiming to preserve the selected mark across deterministic ID regeneration')
  }

  setXrMotionReferenceCameraRig('handheld')
  setXrMotionReferenceCameraMark({
    timeSeconds: 0,
    anchorId: 'actor-a',
    settings: { angle: 'front', level: 'eye-level', shot: 'medium', note: '', orbitX: 0, orbitY: 0, focalLengthMm: 35 },
  })
  setXrMotionReferenceCameraMark({
    timeSeconds: 6,
    anchorId: 'actor-a',
    rig: 'drone',
    settings: { angle: 'right-side', level: 'high-angle', shot: 'medium', note: '', orbitX: 0.3, orbitY: -0.25, focalLengthMm: 85 },
  })
  const finalCameraMark = readXrMotionReferenceRuntime().plan.camera.find(mark => mark.timeSeconds === 6)
  if (!finalCameraMark) throw new Error('expected SHOOT to drop a second camera mark')
  selectXrMotionReferenceCameraMark(finalCameraMark.id)
  retimeXrMotionReferenceCameraMark(finalCameraMark.id, 5.5)
  const shootPlan = readXrMotionReferenceRuntime().plan
  const retimedCameraMark = shootPlan.camera.find(mark => mark.timeSeconds === 5.5)
  if (!retimedCameraMark) throw new Error('expected a retimed camera mark for stage selection')
  const selectedCameraMark = readXrMotionReferenceRuntime().selectedMark
  if (selectedCameraMark?.kind !== 'camera' || selectedCameraMark.markId !== retimedCameraMark.id) {
    throw new Error('expected a timeline camera mark selection to target its matching XR stage camera')
  }
  const sampledLens = sampleXrMotionReferenceCameraSettings(shootPlan.camera, 2.75)?.focalLengthMm
  if (shootPlan.camera[0]?.rig !== 'handheld'
    || shootPlan.camera[1]?.rig !== 'drone'
    || shootPlan.camera[1]?.timeSeconds !== 5.5
    || sampleXrMotionReferenceCameraRig(shootPlan.camera, 2.75) !== 'handheld'
    || !(Number(sampledLens) > 35 && Number(sampledLens) < 85)) {
    throw new Error(`expected rig-aware camera retiming and lens interpolation, got ${JSON.stringify(shootPlan.camera)}`)
  }
  const bundle = buildXrMotionReferencePackage({ plan: shootPlan, graphData, documentName: 'Shoot scene.md' })
  const brief = bundle.files.find(file => file.path === 'handoff/video-generator-brief.txt')?.text || ''
  if (!brief.includes('handheld rig, linear easing, 35mm') || !brief.includes('drone rig, ease-in-out easing, 85mm')) {
    throw new Error('expected the exported package to preserve camera rig, easing, and lens choreography')
  }

  const priorCamera = readCameraFramingRuntime()
  const priorGraphState = useGraphStore.getState()
  useGraphStore.setState({ floatingPanelOpen: false, floatingPanelView: 'animation' } as never)
  const cameraResult = controlLocalCamera({ invocation: '/camera.frame @camera #camera-shot angle=right-side level=high-angle shot=close-up lens=85' })
  const controlledCamera = readCameraFramingRuntime()
  if (!cameraResult.ok
    || controlledCamera.settings.angle !== 'right-side'
    || controlledCamera.settings.level !== 'high-angle'
    || controlledCamera.settings.shot !== 'close-up'
    || controlledCamera.settings.focalLengthMm !== 85
    || useGraphStore.getState().floatingPanelView !== 'camera') {
    throw new Error(`expected Camera MCP invocation to control the shared runtime, got ${JSON.stringify(cameraResult)}`)
  }
  useGraphStore.setState({
    markdownDocumentName: 'Shoot scene.md',
    markdownDocumentText: '# Shoot scene',
    graphData,
    selectedNodeId: 'actor-a',
    canvasRenderMode: '2d',
    canvas3dMode: '3d',
    bottomSurfaceTab: 'gitGraph',
    bottomSurfaceCollapsed: true,
  } as never)
  const animateResult = controlLocalCamera({ invocation: '/camera.animate @selected-actor #camera-motion rig=crane time=3.25 shot=medium lens=50' })
  const animatedState = useGraphStore.getState()
  const animatedRuntime = readXrMotionReferenceRuntime()
  if (!animateResult.ok
    || animateResult.action !== 'animate'
    || animatedRuntime.plan.camera.at(-1)?.timeSeconds !== 3.25
    || animatedRuntime.plan.camera.at(-1)?.anchorId !== 'actor-a'
    || animatedRuntime.plan.camera.at(-1)?.rig !== 'crane'
    || animatedRuntime.plan.camera.at(-1)?.settings.focalLengthMm !== 50
    || animatedState.canvasRenderMode !== '3d'
    || animatedState.canvas3dMode !== 'xr'
    || animatedState.bottomSurfaceTab !== 'timeline'
    || animatedState.bottomSurfaceCollapsed !== false
    || !animatedState.graphData?.metadata?.[XR_MOTION_REFERENCE_GRAPH_METADATA_KEY]) {
    throw new Error(`expected /camera.animate to persist and reveal BottomPanel XR choreography, got ${JSON.stringify(animateResult)}`)
  }
  const scrubResult = controlLocalCamera({ invocation: '/camera.scrub @camera #camera-motion time=1.5' })
  const playResult = controlLocalCamera({ invocation: '/camera.play @camera #camera-motion state=play' })
  const playbackFramingRevision = readCameraFramingRuntime().revision
  const frameDuringPlaybackResult = controlLocalCamera({ action: 'frame', targetId: 'actor-a', shot: 'wide' })
  const pauseResult = controlLocalCamera({ invocation: '/camera.play @camera #camera-motion state=pause' })
  const legacyCameraResult = controlLocalCamera({ invocation: '/camera.frame @camera #right-side #high-angle #close-up #85mm' })
  const wrongSemanticResult = controlLocalCamera({ invocation: '/camera.animate @selected-actor #camera-shot rig=crane time=1' })
  const unknownPairResult = controlLocalCamera({ invocation: '/camera.frame @camera #camera-shot angle=front foo=bar' })
  const invalidAngleResult = controlLocalCamera({ invocation: '/camera.frame @camera #camera-shot angle=garbage' })
  const invalidPlaybackResult = controlLocalCamera({ invocation: '/camera.play @camera #camera-motion state=banana' })
  const invalidScrubResult = controlLocalCamera({ invocation: '/camera.scrub @camera #camera-motion time=banana' })
  const invalidStructuredAngle = controlLocalCamera({ action: 'frame', targetId: 'camera', angle: 'garbage' as never })
  const invalidStructuredLens = controlLocalCamera({ action: 'frame', targetId: 'camera', focalLengthMm: 999 })
  const missingStructuredTarget = controlLocalCamera({ action: 'frame', targetId: 'missing-cast' })
  const missingStructuredScrubTime = controlLocalCamera({ action: 'scrub', targetId: 'camera' })
  if (!scrubResult.ok
    || !playResult.ok
    || !pauseResult.ok
    || frameDuringPlaybackResult.ok
    || readCameraFramingRuntime().revision !== playbackFramingRevision
    || legacyCameraResult.ok
    || wrongSemanticResult.ok
    || unknownPairResult.ok
    || invalidAngleResult.ok
    || invalidPlaybackResult.ok
    || invalidScrubResult.ok
    || invalidStructuredAngle.ok
    || invalidStructuredLens.ok
    || missingStructuredTarget.ok
    || missingStructuredScrubTime.ok
    || readXrMotionReferenceRuntime().playheadSeconds !== 1.5
    || useGraphStore.getState().timelineTransportPosition !== 1.5 / 60
    || useGraphStore.getState().timelineTransportPlaying !== false) {
    throw new Error(`expected Camera scrub/play/pause invocations to control the shared Timeline runtime, got ${JSON.stringify({ scrubResult, playResult, pauseResult })}`)
  }
  if (!inspectLocalCamera().invocationGrammar) throw new Error('expected Camera inspection to expose grammar while the upstream catalog is hydrated')
  const originalUpdateGraphMetadata = useGraphStore.getState().updateGraphMetadata
  const planBeforeFailedWrite = JSON.stringify(serializeXrMotionReferencePlan(readXrMotionReferenceRuntime().plan))
  const framingBeforeFailedWrite = readCameraFramingRuntime()
  let failedWriteResult: ReturnType<typeof controlLocalCamera>
  useGraphStore.setState({ updateGraphMetadata: () => undefined } as never)
  try {
    failedWriteResult = controlLocalCamera({ action: 'animate', targetId: 'actor-a', rig: 'dolly', timeSeconds: 4.75, shot: 'wide' })
  } finally {
    useGraphStore.setState({ updateGraphMetadata: originalUpdateGraphMetadata } as never)
  }
  if (failedWriteResult!.ok
    || JSON.stringify(serializeXrMotionReferencePlan(readXrMotionReferenceRuntime().plan)) !== planBeforeFailedWrite
    || readCameraFramingRuntime().revision !== framingBeforeFailedWrite.revision) {
    throw new Error('expected a failed Camera metadata write to roll back choreography without publishing framing')
  }
  let fillIndex = 0
  while (readXrMotionReferenceRuntime().plan.camera.length < XR_MOTION_REFERENCE_MAX_CAMERA_MARKS && fillIndex < 100) {
    setXrMotionReferenceCameraMark({
      timeSeconds: Number((0.017 + fillIndex * 0.173).toFixed(3)),
      anchorId: 'actor-a',
      rig: 'dolly',
      settings: readCameraFramingRuntime().settings,
    })
    fillIndex += 1
  }
  const capacityPlan = readXrMotionReferenceRuntime().plan
  const capacityFraming = readCameraFramingRuntime()
  const capacityResult = controlLocalCamera({ invocation: '/camera.animate @selected-actor #camera-motion rig=crane time=5.99 shot=wide lens=24' })
  if (capacityResult.ok
    || capacityPlan.camera.length !== XR_MOTION_REFERENCE_MAX_CAMERA_MARKS
    || readXrMotionReferenceRuntime().plan.camera.length !== XR_MOTION_REFERENCE_MAX_CAMERA_MARKS
    || readXrMotionReferenceRuntime().plan.camera.some(mark => Math.abs(mark.timeSeconds - 5.99) < 0.0005)
    || readCameraFramingRuntime().revision !== capacityFraming.revision) {
    throw new Error('expected a full Camera track to fail closed without a false-success mark or framing mutation')
  }
  publishCameraFramingRuntime({ anchorId: 'actor-a', settings: { ...readCameraFramingRuntime().settings, shot: 'wide' }, source: 'panel' })
  const previousFramingDocumentKey = readCameraFramingRuntimeDocumentKey()
  useGraphStore.setState({
    markdownDocumentName: 'Second scene.md',
    markdownDocumentText: '# Second scene',
    graphData: { type: 'Graph', nodes: [{ id: 'actor-b', label: 'Second lead', type: 'Person', properties: {} }], edges: [], metadata: {} },
    selectedNodeId: 'actor-b',
  } as never)
  hydrateCanonicalXrMotionReferenceRuntime()
  if (readCameraFramingRuntimeDocumentKey() === previousFramingDocumentKey
    || readCameraFramingRuntime().anchorId !== 'canvas-camera'
    || readCameraFramingRuntime().source !== 'document'
    || readXrMotionReferenceRuntime().plan.camera.length !== 0) {
    throw new Error('expected an app-root document switch to clear stale Camera framing and choreography before a closed panel can reapply it')
  }
  const cameraCatalogTokens = new Set(resolveChatInvocationCatalogEntries('all', 'camera').map(entry => entry.token))
  for (const token of ['/camera.frame', '/camera.animate', '/camera.play', '/camera.scrub', '@camera', '#camera']) {
    if (!cameraCatalogTokens.has(token)) throw new Error(`expected shared invocation catalog to expose ${token}`)
  }
  resetAgenticOsRemoteGrammarCatalogForTests()
  if (inspectLocalCamera().invocationGrammar !== null) throw new Error('expected Camera inspection to fail closed when the upstream invocation catalog is absent')
  useGraphStore.setState({
    markdownDocumentName: priorGraphState.markdownDocumentName,
    markdownDocumentText: priorGraphState.markdownDocumentText,
    graphData: priorGraphState.graphData,
    canvasRenderMode: priorGraphState.canvasRenderMode,
    canvas3dMode: priorGraphState.canvas3dMode,
    floatingPanelOpen: priorGraphState.floatingPanelOpen,
    floatingPanelView: priorGraphState.floatingPanelView,
    bottomSurfaceTab: priorGraphState.bottomSurfaceTab,
    bottomSurfaceCollapsed: priorGraphState.bottomSurfaceCollapsed,
    timelineTransportDocumentKey: priorGraphState.timelineTransportDocumentKey,
    timelineTransportPosition: priorGraphState.timelineTransportPosition,
    timelineTransportPlaying: priorGraphState.timelineTransportPlaying,
  } as never)
  hydrateCanonicalXrMotionReferenceRuntime()
  publishCameraFramingRuntime({ anchorId: priorCamera.anchorId, settings: priorCamera.settings, source: priorCamera.source })
}
