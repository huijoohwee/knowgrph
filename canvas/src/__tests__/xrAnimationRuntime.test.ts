import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { GraphData } from '@/lib/graph/types'
import {
  registerAgenticOsRemoteGrammarCatalogEntries,
  resetAgenticOsRemoteGrammarCatalogForTests,
} from '@/features/agentic-os/agenticOsRemoteGrammarClient'
import { useGraphStore } from '@/hooks/useGraphStore'
import {
  XR_ACTION_PATH_PRESET_IDS,
  XR_ANIMATION_PRESETS,
  XR_CHARACTER_MOTION_PRESET_IDS,
  buildXrAnimationActionPath,
  resolveXrAnimationPreset,
  sampleXrAnimationPose,
  xrAnimationPresetCompatible,
} from '@/features/three/xrAnimationCatalog'
import {
  buildXrAnimationInvocation,
  controlLocalAnimation,
  inspectLocalAnimation,
} from '@/features/three/xrAnimationMcpRuntime'
import {
  readXrMotionReferencePlan,
  resolveXrMotionReferenceStage,
  sampleXrMotionReferenceFacingY,
  serializeXrMotionReferencePlan,
} from '@/features/three/xrMotionReferenceModel'
import { buildXrMotionReferencePackage } from '@/features/three/xrMotionReferencePackage'
import {
  addXrMotionReferenceSubject,
  clearXrMotionReferenceCastAnimation,
  hydrateXrMotionReferenceRuntime,
  removeXrMotionReferenceCastMark,
  readXrMotionReferenceRuntime,
  retimeXrMotionReferenceCastMark,
  selectXrMotionReferenceActor,
  setXrMotionReferenceCastAnimation,
  setXrMotionReferenceCastMarkChoreography,
  setXrMotionReferenceCastMark,
  setXrMotionReferenceDuration,
  setXrMotionReferenceStage,
} from '@/features/three/xrMotionReferenceRuntime'
import { hydrateCanonicalXrMotionReferenceRuntime } from '@/features/three/XrMotionReferenceRuntimeBridge'
import { selectBoundXrActor } from '@/features/three/xrSelectedActorBinding'
import { buildXrMotionReferenceTimelineCode } from '@/features/three/xrMotionReferenceTimeline'

const ANIMATION_DICTIONARY_TOKENS = {
  command: ['/animation.control'],
  semantic: ['#character-motion', '#action-path'],
  binding: ['@selected-actor', '@canvas'],
} as const

function readSource(...parts: string[]): string {
  return readFileSync(resolve(process.cwd(), 'src', ...parts), 'utf8')
}

function buildAnimationGraph(): GraphData {
  return {
    type: 'Graph',
    nodes: [
      { id: 'actor-a', label: 'Lead', type: 'Person', properties: {} },
      { id: 'actor-b', label: 'Rival', type: 'Person', properties: {} },
    ],
    edges: [],
    metadata: {},
  }
}

function registerCanonicalAnimationGrammar(): void {
  resetAgenticOsRemoteGrammarCatalogForTests()
  for (const [kind, tokens] of Object.entries(ANIMATION_DICTIONARY_TOKENS)) {
    const fileName = kind === 'command'
      ? 'DICTIONARY-COMMAND.md'
      : kind === 'semantic'
        ? 'DICTIONARY-SEMANTIC.md'
        : 'DICTIONARY-BINDING.md'
    const source = readFileSync(resolve(process.cwd(), '..', '..', 'agentic-canvas-os', 'docs', fileName), 'utf8')
    for (const token of tokens) {
      if (!source.includes(`  - "${token}"`) || !source.includes(`| \`${token}\` |`)) {
        throw new Error(`expected upstream ${fileName} to own ${token}`)
      }
    }
    registerAgenticOsRemoteGrammarCatalogEntries(tokens.map(token => ({ token, kind, sourcePath: fileName })))
  }
}

export function testXrAnimationRuntimeIsNativeInvocableAndExportable() {
  const expectedCharacterMotions = ['fight', 'dance', 'sit', 'drink', 'jump', 'play-cards', 'squirt-gun']
  const expectedActionPaths = ['plane-landing', 'helicopter-orbit', 'car-chase', 'collapsing-debris']
  if (XR_CHARACTER_MOTION_PRESET_IDS.join('|') !== expectedCharacterMotions.join('|')) {
    throw new Error(`expected all requested native character motions, got ${XR_CHARACTER_MOTION_PRESET_IDS.join(', ')}`)
  }
  if (XR_ACTION_PATH_PRESET_IDS.join('|') !== expectedActionPaths.join('|') || XR_ANIMATION_PRESETS.length !== 11) {
    throw new Error(`expected all requested native action paths, got ${XR_ACTION_PATH_PRESET_IDS.join(', ')}`)
  }

  const fight = resolveXrAnimationPreset('fight')
  const landing = resolveXrAnimationPreset('plane-landing')
  if (!xrAnimationPresetCompatible({ preset: fight, graphActor: true })
    || xrAnimationPresetCompatible({ preset: landing, graphActor: true })
    || !xrAnimationPresetCompatible({ preset: landing, assetId: 'vehicle-airplane', category: 'vehicles' })) {
    throw new Error('expected typed animation compatibility to separate character motions from asset-specific action paths')
  }
  const drinkAssignment = { kind: 'character-motion', presetId: 'drink', startTimeSeconds: 0, loop: true } as const
  const firstDrinkPose = sampleXrAnimationPose(drinkAssignment, 1)
  const secondDrinkPose = sampleXrAnimationPose(drinkAssignment, 1)
  const jumpPose = sampleXrAnimationPose({ kind: 'character-motion', presetId: 'jump', startTimeSeconds: 0, loop: true }, 0.9)
  if (JSON.stringify(firstDrinkPose) !== JSON.stringify(secondDrinkPose)
    || firstDrinkPose.propCue !== 'cup'
    || jumpPose.rootOffsetMeters[1] <= 1) {
    throw new Error('expected deterministic procedural performance poses with visible prop and jump cues')
  }

  const pathCounts = new Map([
    ['plane-landing', 5],
    ['helicopter-orbit', 9],
    ['car-chase', 6],
    ['collapsing-debris', 5],
  ])
  for (const presetId of XR_ACTION_PATH_PRESET_IDS) {
    const marks = buildXrAnimationActionPath({ presetId, durationSeconds: 8, origin: [0, 0, 0], stageSizeMeters: [20, 16] })
    if (marks.length !== pathCounts.get(presetId)
      || marks[0]?.timeSeconds !== 0
      || marks.at(-1)?.timeSeconds !== 8
      || marks.some(mark => Math.abs(mark.position[0]) > 9.6 || Math.abs(mark.position[2]) > 7.68 || mark.position[1] < 0 || mark.position[1] > 30)) {
      throw new Error(`expected ${presetId} to produce a complete bounded deterministic action path`)
    }
    const trackMarks = marks.map((mark, index) => ({ ...mark, id: `${presetId}:${index}` }))
    const beforeEnd = sampleXrMotionReferenceFacingY(trackMarks, 7.999)
    const atEnd = sampleXrMotionReferenceFacingY(trackMarks, 8)
    const afterEnd = sampleXrMotionReferenceFacingY(trackMarks, 10)
    const angularDistance = (left: number, right: number) => Math.abs(Math.atan2(Math.sin(left - right), Math.cos(left - right)))
    if (angularDistance(beforeEnd, atEnd) > 0.0001 || angularDistance(atEnd, afterEnd) > 0.0001) {
      throw new Error(`expected ${presetId} to preserve its final travel heading at and after the last mark`)
    }
  }

  const incompatibleGraphPlan = readXrMotionReferencePlan({
    cast: [{ actorId: 'actor-a', animation: { kind: 'action-path', presetId: 'plane-landing' } }],
  }, buildAnimationGraph().nodes)
  const compatibleGraphPlan = readXrMotionReferencePlan({
    cast: [{ actorId: 'actor-a', animation: { kind: 'action-path', presetId: 'dance' } }],
  }, buildAnimationGraph().nodes)
  const airplanePlan = readXrMotionReferencePlan({
    stageId: 'neutral-volume',
    durationSeconds: 8,
    subjects: [{ id: 'plane-a', assetId: 'vehicle-airplane', label: 'Plane' }],
    cast: [{
      actorId: 'plane-a',
      animation: { kind: 'character-motion', presetId: 'plane-landing' },
      marks: [{ timeSeconds: 0, position: [4, 2, 3], transition: 'hold' }],
    }],
  })
  const incompatibleAirplanePlan = readXrMotionReferencePlan({
    subjects: [{ id: 'plane-a', assetId: 'vehicle-airplane', label: 'Plane' }],
    cast: [{ actorId: 'plane-a', animation: { kind: 'action-path', presetId: 'car-chase' } }],
  })
  if (incompatibleGraphPlan.cast[0]?.animation !== null
    || compatibleGraphPlan.cast[0]?.animation?.presetId !== 'dance'
    || incompatibleAirplanePlan.cast[0]?.animation !== null
    || airplanePlan.cast[0]?.animation?.kind !== 'action-path'
    || airplanePlan.cast[0]?.marks.length !== 5
    || airplanePlan.cast[0]?.marks.at(-1)?.timeSeconds !== 8) {
    throw new Error('expected persisted animation hydration to reject incompatible assignments and rebuild valid action paths canonically')
  }

  const graphData = buildAnimationGraph()
  hydrateXrMotionReferenceRuntime({ sceneKey: 'animation-model-test', nodes: graphData.nodes, persistedValue: null })
  setXrMotionReferenceCastAnimation('actor-a', 'dance')
  let plan = readXrMotionReferenceRuntime().plan
  if (plan.cast[0]?.animation?.presetId !== 'dance') {
    throw new Error('expected character motion assignment to persist on the selected cast track')
  }
  const roundTrip = serializeXrMotionReferencePlan(plan) as { cast?: Array<{ animation?: { presetId?: string } }> }
  if (roundTrip.cast?.[0]?.animation?.presetId !== 'dance' || !buildXrMotionReferenceTimelineCode(plan).includes('dance character-motion effect')) {
    throw new Error('expected animation assignments to serialize and project into the canonical BottomPanel Timeline')
  }
  clearXrMotionReferenceCastAnimation('actor-a')
  if (readXrMotionReferenceRuntime().plan.cast[0]?.animation !== null) {
    throw new Error('expected native cast animation to clear without deleting cast marks')
  }

  addXrMotionReferenceSubject({ assetId: 'vehicle-airplane', label: 'Picture plane' })
  const airplane = readXrMotionReferenceRuntime().plan.subjects.find(subject => subject.assetId === 'vehicle-airplane')
  if (!airplane) throw new Error('expected the native scene library to place a procedural airplane')
  setXrMotionReferenceCastAnimation(airplane.id, 'plane-landing')
  plan = readXrMotionReferenceRuntime().plan
  const airplaneTrack = plan.cast.find(track => track.actorId === airplane.id)
  if (airplaneTrack?.animation?.presetId !== 'plane-landing' || airplaneTrack.marks.length !== 5 || airplaneTrack.marks.at(-1)?.transition !== 'hold') {
    throw new Error(`expected plane landing to replace the cast path with deterministic arrival marks, got ${JSON.stringify(airplaneTrack)}`)
  }
  const bundle = buildXrMotionReferencePackage({ plan, graphData, documentName: 'Animation reference.md' })
  const manifest = JSON.parse(bundle.files.find(file => file.path === 'reference/manifest.json')?.text || '{}') as { animationTracks?: number; interpolation?: string; speedWarnings?: number }
  const samplesText = bundle.files.find(file => file.path === 'reference/frame-samples.json')?.text || ''
  const brief = bundle.files.find(file => file.path === 'handoff/video-generator-brief.txt')?.text || ''
  if (manifest.animationTracks !== 1
    || manifest.interpolation !== 'per-mark-easing-with-gait-profiles'
    || typeof manifest.speedWarnings !== 'number'
    || !bundle.files.some(file => file.path === 'reference/choreography-diagnostics.json')
    || !samplesText.includes('plane-landing')
    || !samplesText.includes('rootRotationDegrees')
    || !brief.includes('Plane landing [action-path]')
    || !brief.includes('easing=')
    || !brief.includes('gait=flight')) {
    throw new Error('expected the motion-reference package to carry animation assignments, poses, paths, and generator briefing')
  }
  setXrMotionReferenceDuration(20)
  setXrMotionReferenceStage('backyard-pool')
  const resizedStage = resolveXrMotionReferenceStage('backyard-pool')
  const rebuiltPath = readXrMotionReferenceRuntime().plan.cast.find(track => track.actorId === airplane.id)
  if (rebuiltPath?.marks.at(-1)?.timeSeconds !== 20
    || rebuiltPath.marks.some(mark => Math.abs(mark.position[0]) > resizedStage.sizeMeters[0] * 0.48 || Math.abs(mark.position[2]) > resizedStage.sizeMeters[1] * 0.48)) {
    throw new Error('expected duration and stage changes to rebuild assigned action paths inside current bounds')
  }
  clearXrMotionReferenceCastAnimation(airplane.id)
  const clearedPath = readXrMotionReferenceRuntime().plan.cast.find(track => track.actorId === airplane.id)
  if (clearedPath?.animation !== null || clearedPath.marks.length !== 1 || clearedPath.marks[0]?.transition !== 'hold') {
    throw new Error('expected clearing an action path to stop its baked motion marks')
  }
  setXrMotionReferenceCastAnimation(airplane.id, 'plane-landing')
  const assignedPath = readXrMotionReferenceRuntime().plan.cast.find(track => track.actorId === airplane.id)
  if (!assignedPath) throw new Error('expected an assigned airplane action path')
  removeXrMotionReferenceCastMark(airplane.id, 'missing-mark')
  if (readXrMotionReferenceRuntime().plan.cast.find(track => track.actorId === airplane.id)?.animation?.presetId !== 'plane-landing') {
    throw new Error('expected an invalid manual mark removal to leave the assigned action path unchanged')
  }
  retimeXrMotionReferenceCastMark(airplane.id, assignedPath.marks[1]!.id, 1.75)
  if (readXrMotionReferenceRuntime().plan.cast.find(track => track.actorId === airplane.id)?.animation !== null) {
    throw new Error('expected manual mark retiming to clear a stale action-path assignment')
  }
  setXrMotionReferenceCastAnimation(airplane.id, 'plane-landing')
  const removablePath = readXrMotionReferenceRuntime().plan.cast.find(track => track.actorId === airplane.id)
  removeXrMotionReferenceCastMark(airplane.id, removablePath!.marks[1]!.id)
  if (readXrMotionReferenceRuntime().plan.cast.find(track => track.actorId === airplane.id)?.animation !== null) {
    throw new Error('expected manual mark removal to clear a stale action-path assignment')
  }
  setXrMotionReferenceCastAnimation(airplane.id, 'plane-landing')
  setXrMotionReferenceCastMark({ actorId: airplane.id, timeSeconds: 0.123, position: [0, 1, 0] })
  if (readXrMotionReferenceRuntime().plan.cast.find(track => track.actorId === airplane.id)?.animation !== null) {
    throw new Error('expected manual mark placement to clear a stale action-path assignment')
  }
  setXrMotionReferenceCastAnimation(airplane.id, 'plane-landing')
  const editablePath = readXrMotionReferenceRuntime().plan.cast.find(track => track.actorId === airplane.id)
  setXrMotionReferenceCastMarkChoreography({ actorId: airplane.id, markId: editablePath!.marks[0]!.id, easing: 'ease-in-out', gait: 'flight' })
  if (readXrMotionReferenceRuntime().plan.cast.find(track => track.actorId === airplane.id)?.animation !== null) {
    throw new Error('expected manual per-mark choreography edits to clear a stale action-path assignment')
  }

  const panelSource = readSource('features', 'three', 'XrAnimationFloatingPanelView.tsx')
  const inspectorSource = readSource('features', 'three', 'XrChoreographyInspector.tsx')
  const choreographyControlsSource = readSource('features', 'three', 'XrChoreographyMarkControls.tsx')
  const animationMcpSource = readSource('features', 'three', 'xrAnimationMcpRuntime.ts')
  const agentReadyContractSource = readSource('features', 'agent-ready', 'knowgrphAgentReadyToolContract.mjs')
  const toolbarSource = readSource('lib', 'toolbar', 'ToolbarToolMenu.impl.tsx')
  const bridgeSource = readSource('features', 'three', 'XrMotionReferenceRuntimeBridge.tsx')
  const appSource = readSource('App.tsx')
  const stageSource = readSource('features', 'three', 'XrMotionReferenceStage.tsx')
  const priorHydrationOwners = [
    readSource('features', 'three', 'XrCameraMotionSection.tsx'),
    readSource('features', 'command-menu', 'XrMediaLibraryPanel.tsx'),
    readSource('features', 'strybldr', 'cameraMcpRuntime.ts'),
    readSource('features', 'three', 'xrSceneMcpRuntime.ts'),
    stageSource,
  ]
  for (const marker of ['FloatingPanelCatalogHeader', 'floatingPanelCatalogThreeRowClassName', 'floatingPanelCatalogThreeRowThumbnailFrameClassName', 'ExpandCollapseAllButton', 'useCollapsibleSectionGroup', 'data-kg-animation-card-toggle', 'data-kg-animation-clear="selected-actor"', 'data-kg-animation-mcp="knowgrph.control_local_animation"', 'AnimationInvocationChips', 'splitInvocationTokenSegments(invocation)', "segment.kind === 'token'", "surface === 'action' ? compactInvocation : displayInvocation", 'UI_INLINE_CHIP_GROUP_CLASSNAME', 'data-kg-animation-invocation-chips={surface}', 'data-kg-animation-invocation-chip-renderer="shared-markdown-sigil"', '<AnimationInvocationChips invocation={invocation} surface="action" />', '<AnimationInvocationChips active={active} invocation={invocation} surface="details" />']) {
    if (!panelSource.includes(marker)) throw new Error(`expected first-class Animation cards to reuse shared disclosure/catalog UI through ${marker}`)
  }
  for (const marker of ['XrChoreographyInspector', 'inspectLocalAnimation', 'Shared cast and camera choreography, playback, and export']) {
    if (!panelSource.includes(marker)) throw new Error(`expected FloatingPanel Animation to project the shared choreography runtime through ${marker}`)
  }
  for (const forbidden of ["operation: 'configure-mark'", 'position: update.position', 'onChange={configureMark}']) {
    if (panelSource.includes(forbidden)) throw new Error(`expected FloatingPanel Animation to defer mark parameter editing to Timeline, found ${forbidden}`)
  }
  for (const marker of ['data-kg-xr-choreography-inspector="shared-runtime"', 'One mark model for cast and camera · Timeline owns time', 'resolveXrChoreographySpeedWarnings', 'floatingPanelCatalogThreeRowClassName', 'floatingPanelCatalogThreeRowThumbnailFrameClassName', 'data-kg-xr-choreography-card={target}', 'data-kg-xr-choreography-card-layout={FLOATING_PANEL_CATALOG_THREE_ROW_LAYOUT}', 'data-kg-xr-choreography-card-row="controls"', 'data-kg-xr-choreography-card-row="invocation"', 'data-kg-xr-choreography-invocation={target}', 'projectedCastInvocation', 'projectedCameraInvocation', 'data-kg-xr-choreography-runtime-ready', 'MCP · / @ # ready', 'renderMarkdownSigilInlineText', 'UI_INLINE_CHIP_GROUP_CLASSNAME', 'renderMarkdownSigilInlineText(invocation)', 'BottomPanel Timeline', 'data-kg-xr-mark-parameter-chips={target}', 'data-kg-xr-mark-parameter-chip-renderer="shared-markdown-sigil"', 'data-kg-xr-choreography-selection-owner="timeline-cast"', 'data-kg-xr-choreography-selection-owner="timeline-camera"', 'Select marks in the']) {
    if (!inspectorSource.includes(marker)) throw new Error(`expected Animation choreography inspection to expose ${marker}`)
  }
  for (const forbidden of ['<XrChoreographyMarkControls', 'MarkParameterChips', 'data-kg-xr-mark-parameter-sigil', 'selectXrMotionReferenceCastMark', 'selectXrMotionReferenceCameraMark', 'aria-label={`Select ${track.label} mark']) {
    if (inspectorSource.includes(forbidden)) throw new Error(`expected FloatingPanel choreography cards to avoid bespoke, duplicate mark controls or selectors, found ${forbidden}`)
  }
  for (const marker of ['data-kg-xr-mark-easing', 'data-kg-xr-mark-gait', 'data-kg-xr-mark-position', 'data-kg-xr-mark-position-axis', 'Mark position · meters', 'XR_CHOREOGRAPHY_EASINGS', 'XR_CHOREOGRAPHY_GAITS', 'showPosition', 'data-kg-xr-mark-position-layout="compact-timeline"', 'XYZ m']) {
    if (!choreographyControlsSource.includes(marker)) throw new Error(`expected Timeline mark controls to expose ${marker}`)
  }
  for (const marker of ["'configure-mark'", 'setXrMotionReferenceCastMarkChoreography', 'setXrMotionReferenceCameraMarkEasing', 'position: control.position', 'resolveXrChoreographySpeedWarnings', 'configureCastMark', 'configureCameraMark']) {
    if (!animationMcpSource.includes(marker)) throw new Error(`expected Animation MCP to control and inspect choreography through ${marker}`)
  }
  for (const marker of ["'configure-mark'", "enum: ['linear', 'ease-in', 'ease-out', 'ease-in-out', 'hold']", "enum: ['hold', 'walk', 'jog', 'run', 'wheeled', 'flight', 'drop']", "Cast mark [x, y, z] position in stage meters"]) {
    if (!agentReadyContractSource.includes(marker)) throw new Error(`expected Web MCP schema to expose typed choreography fields through ${marker}`)
  }
  const mediaIndex = toolbarSource.indexOf("{ view: 'media'")
  const animationIndex = toolbarSource.indexOf("{ view: 'animation'")
  const cameraIndex = toolbarSource.indexOf("{ view: 'camera'")
  if (!(mediaIndex >= 0 && mediaIndex < animationIndex && animationIndex < cameraIndex)
    || !toolbarSource.includes('XrAnimationFloatingPanelViewLazy')
    || !toolbarSource.includes("floatingPanelView === 'animation'")) {
    throw new Error('expected first-class FloatingPanel Animation immediately to the right of Media and before Camera')
  }
  if (!bridgeSource.includes('hydrateXrMotionReferenceRuntime({')
    || !bridgeSource.includes('useIsomorphicLayoutEffect')
    || !bridgeSource.includes('resetCameraFramingRuntimeForDocument(sceneKey)')
    || !appSource.includes('<XrMotionReferenceRuntimeBridge />')
    || priorHydrationOwners.some(source => source.includes('hydrateXrMotionReferenceRuntime('))) {
    throw new Error('expected one app-root XR motion hydration owner independent of panel or stage visibility')
  }
  if (!panelSource.includes('readBoundXrSelectedActorId') || !panelSource.includes("targetId: 'selected-actor'")) {
    throw new Error('expected Animation cards and controls to resolve the graph-bound actor at invocation time')
  }
  if (stageSource.includes('kg_xr_motion_default_camera') || !stageSource.includes('<GraphCastPropCue')) {
    throw new Error('expected the XR stage to remove its fake Camera and render native cast prop cues')
  }
  const implementation = `${panelSource}\n${stageSource}\n${readSource('features', 'three', 'xrAnimationCatalog.ts')}\n${readSource('features', 'three', 'xrAnimationMcpRuntime.ts')}`.toLowerCase()
  for (const forbidden of ['wassermanproductions', 'blockout', 'electron-vite', 'ffmpeg']) {
    if (implementation.includes(forbidden)) throw new Error(`expected clean-room native Animation implementation to avoid ${forbidden}`)
  }

  const priorState = useGraphStore.getState()
  registerCanonicalAnimationGrammar()
  try {
    useGraphStore.setState({
      markdownDocumentName: 'Animation invocation.md',
      markdownDocumentText: '# Animation invocation',
      graphData,
      canvasRenderMode: '2d',
      canvas3dMode: '3d',
      floatingPanelOpen: false,
      floatingPanelView: 'media',
      selectedNodeId: 'actor-a',
      bottomSurfaceTab: 'stats',
      bottomSurfaceCollapsed: true,
    } as never)
    const invocation = buildXrAnimationInvocation('dance')
    const applied = controlLocalAnimation({ invocation })
    const activeState = useGraphStore.getState()
    if (invocation !== '/animation.control #character-motion @selected-actor operation=apply preset=dance'
      || !applied.ok
      || readXrMotionReferenceRuntime().plan.cast[0]?.animation?.presetId !== 'dance'
      || activeState.canvasRenderMode !== '3d'
      || activeState.canvas3dMode !== 'xr'
      || activeState.floatingPanelView !== 'animation'
      || activeState.floatingPanelOpen !== true
      || activeState.bottomSurfaceTab !== 'timeline'
      || activeState.bottomSurfaceCollapsed !== false) {
      throw new Error(`expected upstream / @ # animation invocation to persist and reveal the canonical runtime, got ${JSON.stringify(applied)}`)
    }
    const configuredMarkId = readXrMotionReferenceRuntime().plan.cast.find(track => track.actorId === 'actor-a')!.marks[0]!.id
    const configured = controlLocalAnimation({ operation: 'configure-mark', markKind: 'cast', markId: configuredMarkId, targetId: 'actor-a', easing: 'ease-in-out', gait: 'run', position: [2, 0, -1] })
    const configuredMark = readXrMotionReferenceRuntime().plan.cast.find(track => track.actorId === 'actor-a')!.marks.find(mark => mark.id === configuredMarkId)
    if (!configured.ok || configuredMark?.transition !== 'ease-in-out' || configuredMark.gait !== 'run' || configuredMark.position.join('|') !== '2|0|-1' || readXrMotionReferenceRuntime().dirty) {
      throw new Error(`expected structured MCP to persist per-mark cast choreography atomically, got ${JSON.stringify(configured)}`)
    }
    const invalidMarkConfig = controlLocalAnimation({ operation: 'configure-mark', markKind: 'cast', markId: 'missing-mark', targetId: 'actor-a', easing: 'ease-in' })
    if (invalidMarkConfig.ok) throw new Error('expected structured MCP to reject an unknown choreography mark')
    const invalidPositionConfig = controlLocalAnimation({ operation: 'configure-mark', markKind: 'cast', markId: configuredMarkId, targetId: 'actor-a', position: [1, 2] as never })
    if (invalidPositionConfig.ok) throw new Error('expected structured MCP to reject a malformed cast mark position')
    const unboundedPositionConfig = controlLocalAnimation({ operation: 'configure-mark', markKind: 'cast', markId: configuredMarkId, targetId: 'actor-a', position: [1001, 0, 0] })
    if (unboundedPositionConfig.ok) throw new Error('expected structured MCP to reject an out-of-bounds cast mark position')
    const scrubbed = controlLocalAnimation({ invocation: '/animation.control @canvas operation=scrub time=1.250' })
    const exported = controlLocalAnimation({ operation: 'export' })
    const inspection = inspectLocalAnimation()
    const invalidInvocation = controlLocalAnimation({ invocation: '/animation.control #character-motion #camera-motion @selected-actor operation=apply preset=dance' })
    const unknownPairInvocation = controlLocalAnimation({ invocation: '/animation.control #character-motion @selected-actor operation=apply preset=dance foo=bar' })
    const invalidTimeInvocation = controlLocalAnimation({ invocation: '/animation.control @canvas operation=scrub time=banana' })
    const missingTimeInvocation = controlLocalAnimation({ invocation: '/animation.control @canvas operation=scrub' })
    const extraCommandInvocation = controlLocalAnimation({ invocation: '/animation.control /camera.play @canvas operation=play' })
    const wrongBindingInvocation = controlLocalAnimation({ invocation: '/animation.control #character-motion @canvas operation=apply preset=dance' })
    const missingSemanticInvocation = controlLocalAnimation({ invocation: '/animation.control @selected-actor operation=apply preset=dance' })
    if (!scrubbed.ok
      || readXrMotionReferenceRuntime().playheadSeconds !== 1.25
      || !exported.ok
      || !exported.package?.files.some(file => file.path === 'reference/frame-samples.json')
      || inspection.schema !== 'knowgrph-xr-animation-mcp/v1'
      || !inspection.catalog.canonical
      || inspection.presets.length !== 11
      || inspection.runtime.cast.find(track => track.actorId === 'actor-a')?.marks[0]?.transition !== 'ease-in-out'
      || inspection.runtime.cast.find(track => track.actorId === 'actor-a')?.marks[0]?.position.join('|') !== '2|0|-1'
      || !Array.isArray(inspection.runtime.speedWarnings)) {
      throw new Error('expected Animation MCP inspect/control to share invocation, scrub, and export runtime state')
    }
    if (invalidInvocation.ok || unknownPairInvocation.ok || invalidTimeInvocation.ok || missingTimeInvocation.ok || extraCommandInvocation.ok || wrongBindingInvocation.ok || missingSemanticInvocation.ok) {
      throw new Error('expected Animation invocation parsing to reject noncanonical commands, semantics, bindings, fields, and scrub values')
    }
    useGraphStore.getState().selectNode('actor-b')
    if (readXrMotionReferenceRuntime().selectedActorId !== 'actor-a' || inspectLocalAnimation().runtime.selectedActorId !== 'actor-b') {
      throw new Error('expected immediate Animation inspection and control targeting to resolve the graph-bound selected actor')
    }
    selectBoundXrActor('actor-b')
    const planBeforeInvalidApply = JSON.stringify(serializeXrMotionReferencePlan(readXrMotionReferenceRuntime().plan))
    const invalidPresetApply = controlLocalAnimation({ operation: 'apply', trackKind: 'character-motion', presetId: 'missing-preset', targetId: 'actor-a' })
    if (invalidPresetApply.ok
      || useGraphStore.getState().selectedNodeId !== 'actor-b'
      || readXrMotionReferenceRuntime().selectedActorId !== 'actor-b'
      || JSON.stringify(serializeXrMotionReferencePlan(readXrMotionReferenceRuntime().plan)) !== planBeforeInvalidApply) {
      throw new Error('expected an invalid Animation control to fail without changing selection or choreography')
    }
    const originalUpdateGraphMetadata = useGraphStore.getState().updateGraphMetadata
    const planBeforeFailedWrite = JSON.stringify(serializeXrMotionReferencePlan(readXrMotionReferenceRuntime().plan))
    const selectionBeforeFailedWrite = useGraphStore.getState().selectedNodeId
    let failedWriteResult: ReturnType<typeof controlLocalAnimation>
    useGraphStore.setState({ updateGraphMetadata: () => undefined } as never)
    try {
      failedWriteResult = controlLocalAnimation({ operation: 'apply', trackKind: 'character-motion', presetId: 'fight', targetId: 'actor-b' })
    } finally {
      useGraphStore.setState({ updateGraphMetadata: originalUpdateGraphMetadata } as never)
    }
    if (failedWriteResult!.ok
      || JSON.stringify(serializeXrMotionReferencePlan(readXrMotionReferenceRuntime().plan)) !== planBeforeFailedWrite
      || useGraphStore.getState().selectedNodeId !== selectionBeforeFailedWrite) {
      throw new Error('expected a failed Animation metadata write to roll back runtime and selection atomically')
    }
    selectXrMotionReferenceActor('actor-a')
    useGraphStore.setState({ markdownDocumentText: '' } as never)
    if (hydrateCanonicalXrMotionReferenceRuntime()
      || readXrMotionReferenceRuntime().plan.cast.length !== 0
      || readXrMotionReferenceRuntime().selectedActorId) {
      throw new Error('expected the canonical bridge to clear dirty choreography behind the no-document readiness sentinel')
    }
  } finally {
    resetAgenticOsRemoteGrammarCatalogForTests()
    useGraphStore.setState({
      markdownDocumentName: priorState.markdownDocumentName,
      markdownDocumentText: priorState.markdownDocumentText,
      graphData: priorState.graphData,
      canvasRenderMode: priorState.canvasRenderMode,
      canvas3dMode: priorState.canvas3dMode,
      floatingPanelOpen: priorState.floatingPanelOpen,
      floatingPanelView: priorState.floatingPanelView,
      selectedNodeId: priorState.selectedNodeId,
      bottomSurfaceTab: priorState.bottomSurfaceTab,
      bottomSurfaceCollapsed: priorState.bottomSurfaceCollapsed,
      timelineTransportDocumentKey: priorState.timelineTransportDocumentKey,
      timelineTransportPosition: priorState.timelineTransportPosition,
      timelineTransportPlaying: priorState.timelineTransportPlaying,
    } as never)
    hydrateCanonicalXrMotionReferenceRuntime()
  }
}
