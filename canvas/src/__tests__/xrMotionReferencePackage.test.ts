import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { GraphData } from '@/lib/graph/types'
import { applyCanvasViewSelection } from '@/components/toolbar/canvasViewActions'
import {
  XR_MOTION_REFERENCE_PACKAGE_SCHEMA,
  XR_MOTION_REFERENCE_SCHEMA,
  readXrMotionReferencePlan,
  sampleXrMotionReferenceMarks,
  serializeXrMotionReferencePlan,
} from '@/features/three/xrMotionReferenceModel'
import { buildXrMotionReferencePackage, xrMotionReferencePackageBlob, xrMotionReferencePackageFilename } from '@/features/three/xrMotionReferencePackage'
import {
  addXrMotionReferenceSubject,
  hydrateXrMotionReferenceRuntime,
  readXrMotionReferenceRuntime,
  removeXrMotionReferenceSubject,
  setXrMotionReferenceCameraMark,
  setXrMotionReferenceCastMark,
  setXrMotionReferenceDuration,
  setXrMotionReferenceFps,
  setXrMotionReferencePlayhead,
  setXrMotionReferenceStage,
  setXrMotionReferenceSubjectLabel,
} from '@/features/three/xrMotionReferenceRuntime'
import { XR_MOTION_REFERENCE_STAGE_PRESETS, XR_SCENE_LIBRARY_ASSETS } from '@/features/three/xrSceneLibrary'
import {
  XR_MOTION_STAGE_CAMERA_POSITION,
  XR_MOTION_STAGE_CAMERA_TARGET,
  xrMotionReferenceWorldPosition,
} from '@/features/three/xrMotionReferenceCoordinates'
import { buildXrMotionReferenceTimelineCode } from '@/features/three/xrMotionReferenceTimeline'
import { buildMermaidGanttTimelineModel } from '@/lib/mermaid/mermaidGanttBarInteraction'
import { resolveVideoSequenceTimelineLane } from '@/components/timeline/videoSequenceTimeline'

function readSource(...parts: string[]): string {
  return readFileSync(resolve(process.cwd(), 'src', ...parts), 'utf8')
}

function buildGraph(): GraphData {
  return {
    type: 'Graph',
    nodes: [
      { id: 'cast-a', label: 'Lead', type: 'Person', properties: {} },
      { id: 'cast-b', label: 'Partner', type: 'Person', properties: {} },
    ],
    edges: [
      { id: 'cue-a-b', source: 'cast-a', target: 'cast-b', label: 'cue', properties: {} },
    ],
    metadata: {},
  }
}

export async function testXrMotionReferencePackageIsNativeDeterministicAndGraphBacked() {
  const graphData = buildGraph()
  const worldPosition = xrMotionReferenceWorldPosition([2, 3, -4], 10, 5)
  if (JSON.stringify(worldPosition) !== JSON.stringify([20, 35, -40])) {
    throw new Error(`expected meter-based XR XYZ to map directly into a Y-up Three world, got ${JSON.stringify(worldPosition)}`)
  }
  if (XR_MOTION_STAGE_CAMERA_POSITION[1] <= XR_MOTION_STAGE_CAMERA_TARGET[1]
    || XR_MOTION_STAGE_CAMERA_POSITION[2] === XR_MOTION_STAGE_CAMERA_TARGET[2]) {
    throw new Error('expected XR entry framing to start above and in front of the horizontal stage')
  }
  let sharedPanelOpenRequests = 0
  const surfaceCalls: string[] = []
  applyCanvasViewSelection({
    id: 'surface:xr',
    ensureBaselineUnlocked: () => true,
    geospatialEnabled: false,
    onOpenGeospatialMode: () => { throw new Error('XR activation must not open geospatial mode') },
    onOpenShared3dPanel: mode => {
      if (mode !== 'xr') throw new Error(`XR activation must identify the canonical XR panel, got ${mode}`)
      sharedPanelOpenRequests += 1
    },
    canvas2dRenderer: 'd3',
    canvas3dMode: '3d',
    canvasRenderMode: '2d',
    documentSemanticMode: 'document',
    frontmatterModeEnabled: false,
    multiDimTableModeEnabled: false,
    renderMediaAsNodes: false,
    timelineEnabled: false,
    bottomSurfaceCollapsed: true,
    bottomSurfaceTab: 'stats',
    schema: {
      layout: { mode: 'block' },
      behavior: { allowEdgeCreation: true, allowNodeDrag: true },
      nodeStyles: {},
      edgeStyles: {},
      rules: [],
    },
    setCanvas2dRenderer: () => {},
    setCanvasRenderMode: mode => { surfaceCalls.push(`render:${mode}`) },
    setCanvas3dMode: mode => { surfaceCalls.push(`3d:${mode}`) },
    setSchema: () => {},
    setRenderMediaAsNodes: () => {},
    setTimelineEnabled: () => {},
    setBottomSurfaceCollapsed: () => {},
    setBottomSurfaceTab: () => {},
    setDocumentSemanticMode: () => {},
    setFrontmatterModeEnabled: () => {},
    setMultiDimTableModeEnabled: () => {},
  })
  if (sharedPanelOpenRequests !== 1 || surfaceCalls.join('|') !== '3d:xr|render:3d') {
    throw new Error(`expected XR surface activation to open its shared camera panel once, got ${JSON.stringify({ sharedPanelOpenRequests, surfaceCalls })}`)
  }
  hydrateXrMotionReferenceRuntime({
    sceneKey: 'test-scene',
    nodes: graphData.nodes,
    persistedValue: null,
  })
  let runtime = readXrMotionReferenceRuntime()
  if (runtime.plan.schema !== XR_MOTION_REFERENCE_SCHEMA || runtime.plan.cast.length !== 2) {
    throw new Error(`expected graph nodes to hydrate native cast tracks, got ${JSON.stringify(runtime.plan)}`)
  }
  if (runtime.plan.cast.some(track => track.marks.length !== 1 || track.marks[0]?.timeSeconds !== 0)) {
    throw new Error('expected each graph-derived cast member to receive one bounded starting mark')
  }

  setXrMotionReferenceStage('loading-bay')
  setXrMotionReferenceDuration(5)
  setXrMotionReferenceFps(10)
  setXrMotionReferenceCastMark({
    actorId: 'cast-a',
    timeSeconds: 2.5,
    position: [4, 0, -3],
    transition: 'linear',
  })
  setXrMotionReferenceCameraMark({
    timeSeconds: 0,
    anchorId: 'cast-a',
    settings: { angle: 'front', level: 'eye-level', shot: 'wide', note: 'Opening', orbitX: 0, orbitY: 0 },
  })
  setXrMotionReferenceCameraMark({
    timeSeconds: 5,
    anchorId: 'cast-a',
    settings: { angle: 'right-side', level: 'high-angle', shot: 'close-up', note: 'Arrival', orbitX: 0.4, orbitY: -0.35 },
  })
  setXrMotionReferencePlayhead(2.5)
  runtime = readXrMotionReferenceRuntime()
  if (runtime.plan.stageId !== 'loading-bay' || runtime.plan.durationSeconds !== 5 || runtime.plan.fps !== 10 || !runtime.dirty) {
    throw new Error(`expected runtime edits to update one dirty plan, got ${JSON.stringify(runtime)}`)
  }
  const lead = runtime.plan.cast.find(track => track.actorId === 'cast-a')!
  const sampled = sampleXrMotionReferenceMarks(lead.marks, 2.5)
  if (sampled.join('|') !== '4|0|-3') {
    throw new Error(`expected cast sampling to land on authored mark, got ${sampled.join('|')}`)
  }
  const holdMarks = [
    { id: 'hold:0', timeSeconds: 0, position: [0, 0, 0] as const, transition: 'hold' as const },
    { id: 'hold:2', timeSeconds: 2, position: [2, 0, 0] as const, transition: 'linear' as const },
  ]
  if (sampleXrMotionReferenceMarks(holdMarks, 1).join('|') !== '0|0|0' || sampleXrMotionReferenceMarks(holdMarks, 2).join('|') !== '2|0|0') {
    throw new Error('expected hold motion to jump onto the exact destination keyframe')
  }

  const saturatedPlan = readXrMotionReferencePlan({
    durationSeconds: 30,
    cast: [{
      actorId: 'cast-a',
      marks: [
        ...Array.from({ length: 32 }, (_item, index) => ({ timeSeconds: index / 2, position: [index, 0, 0], transition: 'linear' })),
        { timeSeconds: 7.5, position: [49, 0, 0], transition: 'hold' },
      ],
    }],
  }, graphData.nodes)
  const saturatedLead = saturatedPlan.cast.find(track => track.actorId === 'cast-a')!
  if (saturatedLead.marks.length !== 32 || saturatedLead.marks.find(mark => mark.timeSeconds === 7.5)?.position[0] !== 49) {
    throw new Error('expected latest duplicate-time cast mark to replace in place at the bounded capacity')
  }
  const saturatedCameraPlan = readXrMotionReferencePlan({
    durationSeconds: 30,
    camera: [
      ...Array.from({ length: 32 }, (_item, index) => ({ timeSeconds: index / 2, anchorId: 'cast-a', settings: null })),
      { timeSeconds: 7.5, anchorId: 'cast-a', settings: { shot: 'close-up' } },
    ],
  }, graphData.nodes)
  if (saturatedCameraPlan.camera.length !== 32 || saturatedCameraPlan.camera.find(mark => mark.timeSeconds === 7.5)?.settings.shot !== 'close-up') {
    throw new Error('expected latest duplicate-time camera mark to replace in place at the bounded capacity')
  }

  const serialized = serializeXrMotionReferencePlan(runtime.plan)
  const roundTrip = readXrMotionReferencePlan(serialized, graphData.nodes)
  if (JSON.stringify(serializeXrMotionReferencePlan(roundTrip)) !== JSON.stringify(serialized)) {
    throw new Error('expected XR motion-reference graph metadata to round-trip deterministically')
  }
  if (roundTrip.camera[0]?.pose.target.join('|') !== '-3.6|0|-1.4' || roundTrip.camera[1]?.pose.target.join('|') !== '4|0|-3') {
    throw new Error(`expected camera marks to resolve around their timed graph-cast anchor positions, got ${JSON.stringify(roundTrip.camera.map(mark => mark.pose.target))}`)
  }
  const timelineCode = buildXrMotionReferenceTimelineCode(roundTrip)
  const timelineModel = buildMermaidGanttTimelineModel(timelineCode)
  const timelineLanes = new Set(timelineModel.taskSpans.map(resolveVideoSequenceTimelineLane))
  if (!timelineCode.includes('title Video Sequence')
    || !timelineCode.includes('XR runtime effect')
    || !timelineCode.includes('Camera mark 1 effect')
    || Math.abs(timelineModel.durationMinutes - roundTrip.durationSeconds / 60) > 0.0001
    || !timelineLanes.has('scene')
    || !timelineLanes.has('effect')) {
    throw new Error(`expected the XR plan to project into the existing Timeline player Scene/Effect lanes, got ${JSON.stringify({ timelineCode, durationMinutes: timelineModel.durationMinutes, lanes: [...timelineLanes] })}`)
  }

  const first = buildXrMotionReferencePackage({ plan: roundTrip, graphData, documentName: 'Scene Alpha.md' })
  const second = buildXrMotionReferencePackage({ plan: roundTrip, graphData, documentName: 'Scene Alpha.md' })
  if (JSON.stringify(first) !== JSON.stringify(second)) {
    throw new Error('expected motion-reference package bytes to be deterministic for the same graph and plan')
  }
  if (first.schema !== XR_MOTION_REFERENCE_PACKAGE_SCHEMA || first.timeline.frameCount !== 51 || first.stage.id !== 'loading-bay') {
    throw new Error(`expected normalized package identity and exact frame count, got ${JSON.stringify(first.timeline)}`)
  }
  if (first.referenceBoundary.runtimeDependency !== false || first.referenceBoundary.implementation !== 'native-knowgrph') {
    throw new Error(`expected exported package to declare its clean native boundary, got ${JSON.stringify(first.referenceBoundary)}`)
  }
  const paths = first.files.map(file => file.path)
  for (const expected of [
    'reference/manifest.json',
    'reference/cast-tracks.json',
    'reference/camera-track.json',
    'reference/frame-samples.json',
    'reference/stage-map.svg',
    'handoff/video-generator-brief.txt',
    'README.txt',
  ]) {
    if (!paths.includes(expected)) throw new Error(`expected package virtual file ${expected}`)
  }
  const manifestFile = first.files.find(file => file.path === 'reference/manifest.json')!
  const manifest = JSON.parse(manifestFile.text) as { cameraSemanticMapping?: { baselineMeters?: number; anchorFallback?: string } }
  if (manifest.cameraSemanticMapping?.baselineMeters !== 8 || manifest.cameraSemanticMapping.anchorFallback !== 'stage-origin') {
    throw new Error(`expected explicit semantic camera meter mapping, got ${JSON.stringify(manifest.cameraSemanticMapping)}`)
  }
  const missingAnchorPlan = readXrMotionReferencePlan({
    ...serialized as Record<string, unknown>,
    camera: [{ timeSeconds: 1, anchorId: 'missing-cast', settings: null }],
  }, graphData.nodes)
  if (missingAnchorPlan.camera[0]?.pose.target.join('|') !== '0|0|0') {
    throw new Error('expected a missing semantic camera anchor to fall back to stage origin')
  }
  const samplesFile = first.files.find(file => file.path === 'reference/frame-samples.json')!
  const samples = JSON.parse(samplesFile.text) as Array<{ cast?: unknown[]; camera?: unknown }>
  if (samples.length !== 51 || !Array.isArray(samples[25]?.cast) || !samples[25]?.camera) {
    throw new Error('expected deterministic per-frame camera and cast samples')
  }
  const blob = xrMotionReferencePackageBlob(first)
  if (blob.type !== 'application/json;charset=utf-8' || !(await blob.text()).endsWith('\n')) {
    throw new Error('expected single native JSON bundle blob with stable trailing newline')
  }
  if (first.source.graphFingerprint !== '941a32b2' || first.packageId !== `kg-xr-${first.source.motionFingerprint}`) {
    throw new Error(`expected separate stable graph and motion package identities, got ${JSON.stringify(first.source)}`)
  }
  if (xrMotionReferencePackageFilename(first) !== `scene-alpha.xr-motion-reference.${first.source.motionFingerprint}.json`) {
    throw new Error(`expected stable filename, got ${xrMotionReferencePackageFilename(first)}`)
  }

  const changedPlan = readXrMotionReferencePlan({ ...serialized as Record<string, unknown>, stageId: 'street-grid' }, graphData.nodes)
  const changed = buildXrMotionReferencePackage({ plan: changedPlan, graphData, documentName: 'Scene Alpha.md' })
  if (changed.source.graphFingerprint !== first.source.graphFingerprint || changed.source.motionFingerprint === first.source.motionFingerprint) {
    throw new Error('expected motion identity to change with choreography while graph identity remains stable')
  }

  const requiredEnvironmentIds = ['downtown', 'residential-street', 'supermarket', 'movie-theater', 'train-car', 'backyard-pool', 'aerial-sky']
  if (!requiredEnvironmentIds.every(id => XR_MOTION_REFERENCE_STAGE_PRESETS.some(stage => stage.id === id))) {
    throw new Error('expected the native XR library to include every requested environment kit')
  }
  const categories = new Set(XR_SCENE_LIBRARY_ASSETS.map(asset => asset.category))
  if (!['people', 'animals', 'vehicles', 'furniture', 'props'].every(category => categories.has(category as never))) {
    throw new Error(`expected a complete native XR subject library, got ${[...categories].join(',')}`)
  }
  hydrateXrMotionReferenceRuntime({ sceneKey: 'library-scene', nodes: [], persistedValue: null })
  setXrMotionReferenceStage('downtown')
  addXrMotionReferenceSubject({ assetId: 'person-adult', label: 'THIEF' })
  addXrMotionReferenceSubject({ assetId: 'furniture-chair', label: 'GETAWAY CHAIR' })
  let libraryPlan = readXrMotionReferenceRuntime().plan
  const mobileSubject = libraryPlan.subjects.find(subject => subject.label === 'THIEF')
  const staticSubject = libraryPlan.subjects.find(subject => subject.label === 'GETAWAY CHAIR')
  if (libraryPlan.stageId !== 'downtown' || !mobileSubject || !staticSubject || !libraryPlan.cast.some(track => track.actorId === mobileSubject.id) || libraryPlan.cast.some(track => track.actorId === staticSubject.id)) {
    throw new Error(`expected mobile library subjects to become markable cast while furniture stays static, got ${JSON.stringify(libraryPlan)}`)
  }
  setXrMotionReferenceSubjectLabel(mobileSubject.id, 'RUNNER')
  libraryPlan = readXrMotionReferenceRuntime().plan
  if (libraryPlan.subjects.find(subject => subject.id === mobileSubject.id)?.label !== 'RUNNER' || libraryPlan.cast.find(track => track.actorId === mobileSubject.id)?.label !== 'RUNNER') {
    throw new Error('expected subject labels and cast labels to remain synchronized')
  }
  const libraryBundle = buildXrMotionReferencePackage({ plan: libraryPlan, graphData: { ...graphData, nodes: [] }, documentName: 'Downtown chase.md' })
  const subjectFile = libraryBundle.files.find(file => file.path === 'reference/subjects.json')
  const libraryManifest = JSON.parse(libraryBundle.files.find(file => file.path === 'reference/manifest.json')!.text) as { placedSubjects?: number }
  if (!subjectFile || libraryManifest.placedSubjects !== 2 || !libraryBundle.files.find(file => file.path === 'reference/frame-samples.json')?.text.includes('RUNNER')) {
    throw new Error('expected placed and labeled XR subjects in the deterministic export package')
  }
  removeXrMotionReferenceSubject(staticSubject.id)
  if (readXrMotionReferenceRuntime().plan.subjects.length !== 1) throw new Error('expected placed static subjects to be removable')

  const stageSource = readSource('features', 'three', 'XrMotionReferenceStage.tsx')
  const emptyWorldSource = readSource('features', 'three', 'XrEmptyWorldStage.tsx')
  const emptyWorldHudSource = readSource('features', 'three', 'XrEmptyWorldHud.tsx')
  const modelSource = readSource('features', 'three', 'xrMotionReferenceModel.ts')
  const packageSource = readSource('features', 'three', 'xrMotionReferencePackage.ts')
  const runtimeSource = readSource('features', 'three', 'xrMotionReferenceRuntime.ts')
  const sceneLibrarySource = readSource('features', 'three', 'xrSceneLibrary.ts')
  const sceneSubjectSource = readSource('features', 'three', 'XrSceneLibrarySubject.tsx')
  const mediaCatalogViewSource = readSource('features', 'command-menu', 'MediaCatalogPanelView.tsx')
  const xrMediaLibrarySource = readSource('features', 'command-menu', 'XrMediaLibraryPanel.tsx')
  const xrPanelSource = readSource('features', 'three', 'XrPanelView.tsx')
  const timelineBottomPanelSource = readSource('features', 'gitgraph', 'TimelineBottomPanelView.tsx')
  const xrTimelineLaneSource = readSource('features', 'three', 'XrTimelineSceneLane.tsx')
  const xrTimelineProjectionSource = readSource('features', 'three', 'xrMotionReferenceTimeline.ts')
  const ganttTransportPanelSource = readSource('features', 'gitgraph', 'GanttTimelineTransportPanel.tsx')
  const ganttTransportSurfaceSource = readSource('features', 'gitgraph', 'useGanttTimelineTransportSurfaceModel.ts')
  const ganttTransportRulerSource = readSource('features', 'gitgraph', 'GanttTimelineTransportRuler.tsx')
  const videoSequenceRulerSource = readSource('components', 'timeline', 'VideoSequenceTimelineRuler.tsx')
  const ganttPlaybackControlsSource = readSource('features', 'gitgraph', 'useGanttTimelinePlaybackControls.ts')
  const ganttPlaybackRuntimeSource = readSource('features', 'gitgraph', 'GanttTimelineTransportPlaybackRuntime.tsx')
  const ganttHeaderToolsSource = readSource('features', 'gitgraph', 'GanttTimelineTransportHeaderTools.tsx')
  const xrGraphStageSource = readSource('features', 'three', 'XrGraphStage.tsx')
  const xrEntrySource = readSource('lib', 'three', 'ThreeGraphXr.tsx')
  const threeGraphSource = readSource('lib', 'three', 'ThreeGraph.impl.tsx')
  const controlsSource = readSource('features', 'three', 'Controls.tsx')
  const canvasViewSelectSource = readSource('components', 'toolbar', 'Canvas2dRendererSelect.tsx')
  const saveSource = readSource('lib', 'graph', 'save.ts')
  for (const marker of [
    'data-kg-xr-timeline-player="1"',
    'data-kg-xr-timeline-transport="reused-gantt-player"',
    'data-kg-xr-motion-stage-select="1"',
    'data-kg-xr-motion-add-cast-mark="1"',
    'data-kg-xr-motion-add-camera-mark="1"',
    'data-kg-xr-motion-save="1"',
    'data-kg-xr-motion-export="1"',
    "documentLoaded ? `${runtime.plan.cast.length} cast · ${edges} links` : 'World ready'",
    'updateGraphMetadata',
    'readCameraFramingRuntime',
    'downloadBlob',
  ]) {
    if (!xrTimelineLaneSource.includes(marker)) throw new Error(`expected XR Timeline player controls to expose ${marker}`)
  }
  for (const marker of ['data-kg-media-xr-3d-toggle="1"', '<XrMediaLibraryPanel', '3D for XR']) {
    if (!mediaCatalogViewSource.includes(marker)) throw new Error(`expected FloatingPanel Media to expose ${marker}`)
  }
  for (const marker of ['data-kg-media-xr-environments="1"', 'data-kg-media-xr-subject-library="1"', 'data-kg-media-xr-next-label="1"', 'addXrMotionReferenceSubject', 'setXrMotionReferenceSubjectLabel']) {
    if (!xrMediaLibrarySource.includes(marker)) throw new Error(`expected the native XR Media library to expose ${marker}`)
  }
  if (!sceneLibrarySource.includes("id: 'downtown'") || !sceneLibrarySource.includes("id: 'backyard-pool'") || !sceneSubjectSource.includes('kg_xr_scene_subject_') || !packageSource.includes("reference/subjects.json")) {
    throw new Error('expected environment, procedural subject, and package owners to remain source-backed')
  }
  for (const marker of [
    'kg_xr_motion_reference_stage',
    'kg_xr_motion_stage_floor',
    'kg_xr_motion_world_grid',
    'kg_xr_motion_world_origin',
    'kg_xr_motion_default_camera',
    'kg_xr_motion_cast_tracks',
    'kg_xr_motion_camera_track',
  ]) {
    if (!stageSource.includes(marker)) throw new Error(`expected native grey-box stage to expose ${marker}`)
  }
  for (const marker of [
    'xrMotionReferenceWorldPosition',
    'position={[0, groundY - floorThickness / 2, 0]}',
    '<boxGeometry args={[floorWidth, floorThickness, floorHeight]}',
    'position={[position[0], position[1] + 0.35, position[2]]}',
    'rotation={[-Math.PI / 2, 0, 0]}',
  ]) {
    if (!stageSource.includes(marker)) throw new Error(`expected Y-up XR stage orientation to expose ${marker}`)
  }
  if (!sceneSubjectSource.includes('rotation={[0, THREE.MathUtils.degToRad(subject.rotationYDegrees), 0]}')
    || !sceneSubjectSource.includes('<group rotation={[-Math.PI / 2, 0, 0]}>')) {
    throw new Error('expected Z-up procedural library geometry to be adapted once beneath a Y-up subject transform')
  }
  if (!timelineBottomPanelSource.includes('<XrTimelineSceneLane')
    || !xrTimelineLaneSource.includes('<GanttTimelineTransportPanel')
    || !xrTimelineLaneSource.includes('clockActive')
    || !xrTimelineLaneSource.includes('editable={false}')
    || !xrTimelineLaneSource.includes('publishPlaybackRequest={false}')
    || !xrTimelineLaneSource.includes('runtimeDocumentKey={xrTransportDocumentKey}')
    || !xrTimelineLaneSource.includes('runtimeDurationSeconds={runtime.plan.durationSeconds}')
    || !xrTimelineProjectionSource.includes('buildXrMotionReferenceTimelineCode')
    || !ganttTransportPanelSource.includes('runtimeDurationSeconds')
    || !xrGraphStageSource.includes('<XrMotionReferenceStage')) {
    throw new Error('expected BottomPanel XR to reuse the canonical Timeline player and ThreeGraph motion-reference stage')
  }
  if (!ganttTransportSurfaceSource.includes('runtimeOnly: true')
    || !ganttHeaderToolsSource.includes('!args.model.runtimeOnly')
    || !ganttTransportRulerSource.includes('editable={args.model.editable}')
    || !videoSequenceRulerSource.includes("data-kg-timeline-clip-compact={compactTimelineBar ? '1' : undefined}")
    || !videoSequenceRulerSource.includes("data-kg-timeline-clip-select-surface={compactTimelineBar && !thumbnailSamples.length ? '1' : undefined}")
    || !videoSequenceRulerSource.includes("const compactTimelineBar = workflowProjection || compactSourceMedia || !editable")
    || !videoSequenceRulerSource.includes("{editable ? <button type=\"button\" className=\"timeline-transport-track-handle")
    || !ganttPlaybackControlsSource.includes('args.publishPlaybackRequest === false')
    || !ganttPlaybackRuntimeSource.includes('xrTimelineOwnsClock')) {
    throw new Error('expected the reused XR player to retain one clock and the canonical compact read-only bars while isolating media playback requests')
  }
  if (!ganttTransportSurfaceSource.includes('const selectedPreviewEmpty = !!transportSession.selectedSpan && !transportSession.previewPlan')) {
    throw new Error('expected stale cross-document Timeline selection keys to preserve source thumbnail fallback')
  }
  if (existsSync(resolve(process.cwd(), 'src', 'features', 'three', 'XrMotionReferenceSection.tsx'))) {
    throw new Error('expected the standalone XR motion-reference form component to be removed')
  }
  if (xrPanelSource.includes('<XrMotionReferenceSection') || xrPanelSource.includes('data-kg-xr-panel-scene="1"') || xrPanelSource.includes('data-kg-xr-panel-runtime="1"')) {
    throw new Error('expected FloatingPanel XR to delegate motion, Scene, and Runtime projections to BottomPanel Timeline')
  }
  const staleCanvasMarkers = [
    'physics_playground',
    'physics control mode',
    'data-kg-canvas-xr-physics-mode-option',
    'data-kg-xr-panel-physics',
    'XR unavailable',
  ]
  const cleanedXrSurfaces = `${xrGraphStageSource}\n${xrEntrySource}\n${xrPanelSource}`
  for (const marker of staleCanvasMarkers) {
    if (cleanedXrSurfaces.includes(marker)) throw new Error(`expected XR canvas cleanup to remove stale ${marker}`)
  }
  if (!xrEntrySource.includes("if (status === 'checking' || status === 'unsupported') return spatialChrome")) {
    throw new Error('expected unsupported WebXR entry actions to stay absent while preserving spatial-capture orientation chrome')
  }
  if (!controlsSource.includes('controls.autoRotate = isSharedCameraFramingSurfaceMode(mode)')
    || !controlsSource.includes('camera.position.set(...XR_MOTION_STAGE_CAMERA_POSITION)')
    || !controlsSource.includes('controls.target.set(...XR_MOTION_STAGE_CAMERA_TARGET)')
    || !controlsSource.includes('xrEmptyWorld,')) {
    throw new Error('expected 3D/XR canvas camera ownership to stop stale auto-rotation and preserve deterministic XR entry framing')
  }
  if (!controlsSource.includes('enteredEmptyXrWorld')
    || !controlsSource.includes('camera.position.set(360, -460, 520)')
    || !controlsSource.includes('controls.target.set(0, 0, -72)')
    || !threeGraphSource.includes('xrEmptyWorld={hasXrEmptyWorld}')) {
    throw new Error('expected no-file XR world entry to reset a deterministic oblique world camera')
  }
  if (!threeGraphSource.includes("const xrDocumentLoaded = mode !== 'xr' || Boolean(")
    || !threeGraphSource.includes('if (!xrDocumentLoaded) {')
    || !threeGraphSource.includes('data-kg-xr-document-loaded=')) {
    throw new Error('expected XR stage rendering to reject retained graph data when no document is loaded')
  }
  if (!threeGraphSource.includes("const hasXrEmptyWorld = mode === 'xr' && !xrDocumentLoaded")
    || !threeGraphSource.includes('data-kg-xr-empty-world=')
    || !threeGraphSource.includes('<XrEmptyWorldStage')) {
    throw new Error('expected no-file XR Mode to initialize a neutral world, grid, origin, and camera without retained graph data')
  }
  for (const marker of [
    'kg_xr_empty_world_stage',
    'kg_xr_empty_world_floor',
    'kg_xr_empty_world_grid',
    'kg_xr_empty_world_center_target',
    'kg_xr_empty_world_vertical_axis',
    'kg_xr_empty_world_axes',
    'kg_xr_empty_world_camera',
    "schema: 'knowgrph-xr-empty-world/v1'",
  ]) {
    if (!emptyWorldSource.includes(marker)) throw new Error(`expected source-free XR world to expose ${marker}`)
  }
  if (!threeGraphSource.includes("key={hasXrEmptyWorld ? 'xr-empty-world-canvas' : 'scene-canvas'}")
    || !threeGraphSource.includes("gl.setClearColor(hasXrEmptyWorld ? '#0b2f4a' : '#000000'")) {
    throw new Error('expected the empty XR world to remount with an opaque navy camera environment')
  }
  for (const marker of ['data-kg-xr-empty-world-hud="1"', 'Centers Mode', 'XR world axes X Y Z']) {
    if (!emptyWorldHudSource.includes(marker)) throw new Error(`expected source-free XR orientation HUD to expose ${marker}`)
  }
  if (!threeGraphSource.includes('<XrEmptyWorldHud')) {
    throw new Error('expected the empty XR world to mount its center and XYZ orientation projection')
  }
  if (!xrTimelineLaneSource.includes('const graphData = documentLoaded ? activeGraphData || rawGraphData : null')
    || !xrTimelineLaneSource.includes('data-kg-xr-timeline-document-loaded=')) {
    throw new Error('expected the XR Timeline player to reject retained graph data when no document is loaded')
  }
  if (!threeGraphSource.includes("active: active && mode !== 'xr'")
    || !threeGraphSource.includes("sceneGraph: mode === 'xr' ? null : sceneGraphForRender")
    || !threeGraphSource.includes("{mode !== 'xr' ? overlayLayer : null}")
    || !threeGraphSource.includes('data-kg-xr-exclusive-stage=')) {
    throw new Error('expected XR graph staging to exclude the standard rich-media overlay projection')
  }
  const sceneSource = readSource('lib', 'three', 'Scene.impl.tsx')
  if (!sceneSource.includes("{mode !== 'xr' ? <group ref={sceneGroupRef}>")
    || !sceneSource.includes("{mode === '3d' && starfieldEnabled")
    || !sceneSource.includes("{mode !== 'xr' && fogColorEffective")) {
    throw new Error('expected XR motion reference to own the graph scene without nodes, edges, starfield, or graph fog interference')
  }
  for (const marker of ['onOpenShared3dPanel', "mode === '3d' ? 'camera' : 'xr'", 'setFloatingPanelOpen(true)', "setBottomSurfaceTab('timeline')", 'setBottomSurfaceCollapsed(false)']) {
    if (!canvasViewSelectSource.includes(marker)) throw new Error(`expected 3D/XR Surface Mode to open its canonical panel via ${marker}`)
  }
  if (!stageSource.includes('hydrateXrMotionReferenceRuntime') || !stageSource.includes('xrMotionReferenceSceneKey')) {
    throw new Error('expected ThreeGraph XR stage to hydrate choreography independently of floating-panel visibility')
  }
  if (!stageSource.includes('Math.hypot(dx, dy, dz)') || !stageSource.includes('setFromUnitVectors')) {
    throw new Error('expected cast and camera paths to preserve vertical Y-up movement in their 3D segment transform')
  }
  if (!stageSource.includes('xrMotionReferenceWorldPosition(mark.pose.target') || !packageSource.includes('point(mark.pose.target)')) {
    throw new Error('expected 3D and SVG camera previews to orient markers toward each captured target')
  }
  if (!xrTimelineLaneSource.includes('readCameraFramingRuntime') || !xrTimelineLaneSource.includes('Capture camera')) {
    throw new Error('expected XR Timeline camera capture to read the sole FloatingPanel Camera owner')
  }
  if (!xrTimelineLaneSource.includes('disabled={!graphData || !runtime.dirty}')) {
    throw new Error('expected XR plan persistence to fail closed when no graph is available')
  }
  if (!xrTimelineLaneSource.includes('savedValue !== serialized') || !xrTimelineLaneSource.includes('save-error')) {
    throw new Error('expected XR plan persistence to verify the canonical graph write before clearing dirty state')
  }
  if (!saveSource.includes('export function downloadBlob')) {
    throw new Error('expected package export to retain the shared blob-download owner')
  }

  const implementation = [xrTimelineLaneSource, xrTimelineProjectionSource, stageSource, emptyWorldSource, emptyWorldHudSource, modelSource, packageSource, runtimeSource, sceneLibrarySource, sceneSubjectSource, xrMediaLibrarySource].join('\n').toLowerCase()
  for (const forbidden of ['wassermanproductions', 'blockout', 'ffmpeg', 'electron-vite']) {
    if (implementation.includes(forbidden)) {
      throw new Error(`expected clean-room XR implementation to avoid external runtime token ${forbidden}`)
    }
  }
  const rootPackage = readFileSync(resolve(process.cwd(), '..', 'package.json'), 'utf8').toLowerCase()
  const canvasPackage = readFileSync(resolve(process.cwd(), 'package.json'), 'utf8').toLowerCase()
  if (`${rootPackage}\n${canvasPackage}`.includes('wassermanproductions/blockout')) {
    throw new Error('expected package manifests to forbid external repository dependency')
  }

  hydrateXrMotionReferenceRuntime({ sceneKey: 'test-scene', nodes: graphData.nodes, persistedValue: serialized })
  setXrMotionReferenceStage('street-grid')
  hydrateXrMotionReferenceRuntime({
    sceneKey: 'test-scene',
    nodes: [{ ...graphData.nodes[1]!, label: 'Partner renamed' }],
    persistedValue: null,
  })
  const filteredDraft = readXrMotionReferenceRuntime()
  if (!filteredDraft.dirty || filteredDraft.plan.cast.some(track => track.actorId === 'cast-a')) {
    throw new Error('expected same-scene filtering to retain dirty state while temporarily omitting hidden cast')
  }
  hydrateXrMotionReferenceRuntime({
    sceneKey: 'test-scene',
    nodes: [
      { ...graphData.nodes[1]!, label: 'Partner renamed' },
      { ...graphData.nodes[0]!, label: 'Lead renamed' },
    ],
    persistedValue: null,
  })
  const reconciled = readXrMotionReferenceRuntime()
  const reconciledLead = reconciled.plan.cast.find(track => track.actorId === 'cast-a')
  if (!reconciled.dirty || reconciled.plan.cast[0]?.actorId !== 'cast-b' || reconciledLead?.label !== 'Lead renamed' || reconciledLead.marks.length !== 2) {
    throw new Error('expected a dirty draft to survive graph label/order refresh while reconciling cast identity')
  }
}
