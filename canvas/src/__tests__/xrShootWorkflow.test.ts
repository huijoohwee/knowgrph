import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { GraphData } from '@/lib/graph/types'
import {
  XR_MOTION_REFERENCE_GRAPH_METADATA_KEY,
  sampleXrMotionReferenceCameraRig,
  sampleXrMotionReferenceCameraSettings,
} from '@/features/three/xrMotionReferenceModel'
import { buildXrMotionReferencePackage } from '@/features/three/xrMotionReferencePackage'
import { controlLocalCamera } from '@/features/strybldr/cameraMcpRuntime'
import { publishCameraFramingRuntime, readCameraFramingRuntime } from '@/features/strybldr/cameraFramingRuntime'
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
  const shootCameraSource = readSource('features', 'strybldr', 'XrShootCameraSection.tsx')
  const cameraPanelSource = readSource('features', 'strybldr', 'StrybldrCameraFloatingPanelView.tsx')
  const sharedCameraSource = readSource('features', 'strybldr', 'StrybldrCameraFramingSection.tsx')
  const retimeSource = readSource('features', 'three', 'CameraMotionMarkRetime.tsx')
  const timelineSource = readSource('features', 'three', 'XrCameraMotionSection.tsx')
  const bottomTimelineSource = readSource('features', 'gitgraph', 'TimelineBottomPanelView.tsx')
  const cameraMcpContractSource = readSource('features', 'strybldr', 'cameraMcpContract.mjs')
  const cameraMcpRuntimeSource = readSource('features', 'strybldr', 'cameraMcpRuntime.ts')
  const cameraWebMcpSource = readSource('features', 'agent-ready', 'cameraWebMcpTools.ts')
  const stageSource = readSource('features', 'three', 'XrMotionReferenceStage.tsx')
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
  if (cameraPanelSource.includes('<XrCameraMotionSection')) throw new Error('expected FloatingPanel Camera to leave motion transport in BottomPanel Timeline')
  if (cameraPanelSource.indexOf('<StrybldrCameraFramingSection') > cameraPanelSource.indexOf('<XrShootCameraSection')) {
    throw new Error('expected the shared globe Camera utilities to remain first in every surface mode')
  }
  for (const marker of ['data-kg-xr-timeline-retime="1"', 'retimeXrMotionReferenceCastMark', 'retimeXrMotionReferenceCameraMark']) {
    if (!retimeSource.includes(marker)) throw new Error(`expected Camera animation retiming to expose ${marker}`)
  }
  for (const marker of ['<CameraMotionMarkRetime', 'data-kg-xr-timeline-transport="reused-gantt-player"', '<GanttTimelineTransportPanel']) {
    if (!timelineSource.includes(marker)) throw new Error(`expected BottomPanel Timeline to own consolidated XR motion through ${marker}`)
  }
  if (!bottomTimelineSource.includes('XrCameraMotionSection') || !bottomTimelineSource.includes('canvas3dMode')) {
    throw new Error('expected BottomPanel Timeline to restore its XR motion owner')
  }
  if (sharedCameraSource.includes('No storyboard card loaded.') || !sharedCameraSource.includes("data-kg-camera-framing-mode={selectedCard ? 'storyboard' : 'shared'}")) {
    throw new Error('expected globe-like shared Camera utilities to remain available without a storyboard card')
  }
  for (const marker of ['onFloorPoint={runtime.castMarkArmed ? placeCastMark : undefined}', 'dropXrMotionReferenceCastMark', 'MarkNumberSprite', 'markNumber: index + 1']) {
    if (!stageSource.includes(marker)) throw new Error(`expected direct numbered XR floor marking to expose ${marker}`)
  }
  if (!stageGeometrySource.includes('onFloorPoint([event.point.x, groundY, event.point.z])')) {
    throw new Error('expected the native stage floor to own the bounded Three pointer projection')
  }
  if (!controlsSource.includes('useXrMotionReferenceCameraPlayback({')
    || !playbackSource.includes('sampleXrMotionReferenceCameraPose')
    || !playbackSource.includes('resolveCameraVerticalFovDegrees')) {
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

  const implementation = [shootCameraSource, cameraPanelSource, sharedCameraSource, retimeSource, timelineSource, stageSource, stageGeometrySource, playbackSource, packageSource, cameraMcpContractSource, cameraMcpRuntimeSource].join('\n').toLowerCase()
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
  retimeXrMotionReferenceCastMark('actor-a', droppedMark.id, 2.25)
  if (!readXrMotionReferenceRuntime().plan.cast[0]?.marks.some(mark => mark.timeSeconds === 2.25)) {
    throw new Error('expected cast mark retiming to update the native plan')
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
  retimeXrMotionReferenceCameraMark(finalCameraMark.id, 5.5)
  const shootPlan = readXrMotionReferenceRuntime().plan
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
  if (!brief.includes('handheld rig, 35mm') || !brief.includes('drone rig, 85mm')) {
    throw new Error('expected the exported package to preserve camera rig and lens choreography')
  }

  const priorCamera = readCameraFramingRuntime()
  const priorGraphState = useGraphStore.getState()
  const cameraResult = controlLocalCamera({ invocation: '/camera.frame @camera #right-side #high-angle #close-up #85mm' })
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
    canvasRenderMode: '2d',
    canvas3dMode: '3d',
    bottomSurfaceTab: 'gitGraph',
    bottomSurfaceCollapsed: true,
  } as never)
  const animateResult = controlLocalCamera({ invocation: '/camera.animate @actor-a #crane #3.25s #medium #50mm' })
  const animatedState = useGraphStore.getState()
  const animatedRuntime = readXrMotionReferenceRuntime()
  if (!animateResult.ok
    || animateResult.action !== 'animate'
    || animatedRuntime.plan.camera.at(-1)?.timeSeconds !== 3.25
    || animatedRuntime.plan.camera.at(-1)?.rig !== 'crane'
    || animatedRuntime.plan.camera.at(-1)?.settings.focalLengthMm !== 50
    || animatedState.canvasRenderMode !== '3d'
    || animatedState.canvas3dMode !== 'xr'
    || animatedState.bottomSurfaceTab !== 'timeline'
    || animatedState.bottomSurfaceCollapsed !== false
    || !animatedState.graphData?.metadata?.[XR_MOTION_REFERENCE_GRAPH_METADATA_KEY]) {
    throw new Error(`expected /camera.animate to persist and reveal BottomPanel XR choreography, got ${JSON.stringify(animateResult)}`)
  }
  const scrubResult = controlLocalCamera({ invocation: '/camera.scrub @camera #1.5s' })
  const playResult = controlLocalCamera({ invocation: '/camera.play @camera #play' })
  const pauseResult = controlLocalCamera({ invocation: '/camera.play @camera #pause' })
  if (!scrubResult.ok
    || !playResult.ok
    || !pauseResult.ok
    || readXrMotionReferenceRuntime().playheadSeconds !== 1.5
    || useGraphStore.getState().timelineTransportPosition !== 1.5 / 60
    || useGraphStore.getState().timelineTransportPlaying !== false) {
    throw new Error(`expected Camera scrub/play/pause invocations to control the shared Timeline runtime, got ${JSON.stringify({ scrubResult, playResult, pauseResult })}`)
  }
  const cameraCatalogTokens = new Set(resolveChatInvocationCatalogEntries('all', 'camera').map(entry => entry.token))
  for (const token of ['/camera.frame', '/camera.animate', '/camera.play', '/camera.scrub', '@camera', '#camera']) {
    if (!cameraCatalogTokens.has(token)) throw new Error(`expected shared invocation catalog to expose ${token}`)
  }
  resetAgenticOsRemoteGrammarCatalogForTests()
  publishCameraFramingRuntime({ anchorId: priorCamera.anchorId, settings: priorCamera.settings, source: priorCamera.source })
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
}
