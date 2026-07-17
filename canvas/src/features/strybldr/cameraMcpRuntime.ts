import { activateCanvasGraphSurfaceMode } from '@/lib/canvas/canvas3dMode'
import { useGraphStore } from '@/hooks/useGraphStore'
import {
  XR_MOTION_REFERENCE_CAMERA_RIGS,
  XR_MOTION_REFERENCE_GRAPH_METADATA_KEY,
  serializeXrMotionReferencePlan,
  xrMotionReferenceSceneKey,
  type XrMotionReferenceCameraRig,
} from '@/features/three/xrMotionReferenceModel'
import {
  hydrateXrMotionReferenceRuntime,
  markXrMotionReferenceSaved,
  readXrMotionReferenceRuntime,
  setXrMotionReferenceCameraMark,
  setXrMotionReferenceCameraRig,
  setXrMotionReferencePlayhead,
} from '@/features/three/xrMotionReferenceRuntime'
import { xrMotionReferenceTimelineDocumentKey } from '@/features/three/xrMotionReferenceTimeline'
import {
  CAMERA_INVOCATION_COMMANDS,
  CAMERA_MCP_SCHEMA,
  CAMERA_WEB_MCP_TOOL_IDS,
} from './cameraMcpContract.mjs'
import {
  STRYBLDR_CAMERA_ANGLES,
  STRYBLDR_CAMERA_LEVELS,
  STRYBLDR_CAMERA_SHOTS,
  readStrybldrCameraSettings,
  type StrybldrCameraAngle,
  type StrybldrCameraLevel,
  type StrybldrCameraShot,
} from './strybldrCamera'
import { publishCameraFramingRuntime, readCameraFramingRuntime } from './cameraFramingRuntime'

export type CameraControlAction = 'frame' | 'animate' | 'playback' | 'scrub'

export type CameraControlInput = Readonly<{
  invocation?: string
  action?: CameraControlAction
  targetId?: string
  angle?: StrybldrCameraAngle
  level?: StrybldrCameraLevel
  shot?: StrybldrCameraShot
  focalLengthMm?: number
  rig?: XrMotionReferenceCameraRig
  timeSeconds?: number
  playing?: boolean
}>

type NormalizedCameraControl = Readonly<{
  action: CameraControlAction
  targetId: string
  angle?: StrybldrCameraAngle
  level?: StrybldrCameraLevel
  shot?: StrybldrCameraShot
  focalLengthMm?: number
  rig?: XrMotionReferenceCameraRig
  timeSeconds?: number
  playing?: boolean
  invocation: string
}>

export type CameraControlResult = Readonly<{
  ok: boolean
  message: string
  action?: CameraControlAction
  camera?: ReturnType<typeof inspectLocalCamera>
}>

const cleanTarget = (value: unknown): string => String(value || '').trim().replace(/^@+/, '')
const cleanHashToken = (value: unknown): string => String(value || '').trim().toLowerCase().replace(/^#+/, '')

function readEnumToken<T extends string>(tokens: readonly string[], options: readonly T[]): T | undefined {
  return options.find(option => tokens.includes(option))
}

function parseCameraInvocation(invocationValue: unknown): Partial<NormalizedCameraControl> | null {
  const invocation = String(invocationValue || '').trim()
  if (!invocation) return null
  const tokens = invocation.split(/\s+/).filter(Boolean)
  const command = tokens[0]
  const hashes = tokens.filter(token => token.startsWith('#')).map(cleanHashToken)
  const targetId = cleanTarget(tokens.find(token => token.startsWith('@')) || '')
  const lensToken = hashes.find(token => /^[0-9]+(?:\.[0-9]+)?mm$/.test(token))
  const timeToken = hashes.find(token => /^[0-9]+(?:\.[0-9]+)?s$/.test(token))
  const base = {
    targetId,
    angle: readEnumToken(hashes, STRYBLDR_CAMERA_ANGLES),
    level: readEnumToken(hashes, STRYBLDR_CAMERA_LEVELS),
    shot: readEnumToken(hashes, STRYBLDR_CAMERA_SHOTS),
    focalLengthMm: lensToken ? Number(lensToken.slice(0, -2)) : undefined,
    rig: readEnumToken(hashes, XR_MOTION_REFERENCE_CAMERA_RIGS),
    timeSeconds: timeToken ? Number(timeToken.slice(0, -1)) : undefined,
    invocation,
  }
  if (command === CAMERA_INVOCATION_COMMANDS.frame) return { ...base, action: 'frame' }
  if (command === CAMERA_INVOCATION_COMMANDS.animate) return { ...base, action: 'animate' }
  if (command === CAMERA_INVOCATION_COMMANDS.playback) return { ...base, action: 'playback', playing: !hashes.includes('pause') }
  if (command === CAMERA_INVOCATION_COMMANDS.scrub) return { ...base, action: 'scrub' }
  return null
}

function normalizeCameraControl(input: CameraControlInput): NormalizedCameraControl | null {
  const parsed = parseCameraInvocation(input.invocation)
  const action = parsed?.action || input.action
  if (!action || !['frame', 'animate', 'playback', 'scrub'].includes(action)) return null
  const angle = parsed?.angle || (STRYBLDR_CAMERA_ANGLES.includes(input.angle as StrybldrCameraAngle) ? input.angle : undefined)
  const level = parsed?.level || (STRYBLDR_CAMERA_LEVELS.includes(input.level as StrybldrCameraLevel) ? input.level : undefined)
  const shot = parsed?.shot || (STRYBLDR_CAMERA_SHOTS.includes(input.shot as StrybldrCameraShot) ? input.shot : undefined)
  const rig = parsed?.rig || (XR_MOTION_REFERENCE_CAMERA_RIGS.includes(input.rig as XrMotionReferenceCameraRig) ? input.rig : undefined)
  const focalLengthMm = Number.isFinite(parsed?.focalLengthMm) ? parsed?.focalLengthMm : Number.isFinite(input.focalLengthMm) ? Number(input.focalLengthMm) : undefined
  const timeSeconds = Number.isFinite(parsed?.timeSeconds) ? parsed?.timeSeconds : Number.isFinite(input.timeSeconds) ? Number(input.timeSeconds) : undefined
  return {
    action,
    targetId: cleanTarget(parsed?.targetId || input.targetId),
    angle,
    level,
    shot,
    focalLengthMm,
    rig,
    timeSeconds,
    playing: parsed?.playing ?? input.playing,
    invocation: String(parsed?.invocation || input.invocation || '').trim(),
  }
}

function openSharedCameraPanel(): void {
  const state = useGraphStore.getState()
  state.setFloatingPanelView('camera')
  state.setFloatingPanelOpen(true)
}

function openCameraAnimationTimeline(): void {
  const state = useGraphStore.getState()
  state.setBottomSurfaceTab('timeline')
  state.setBottomSurfaceCollapsed(false)
}

function resolveCameraAnchor(targetId: string): string {
  const state = useGraphStore.getState()
  const current = readCameraFramingRuntime()
  if (targetId && !['camera', 'selected', 'timeline'].includes(targetId)) return targetId
  return String(state.selectedNodeId || current.anchorId || 'canvas-camera').trim() || 'canvas-camera'
}

function publishCameraFrame(control: NormalizedCameraControl) {
  const current = readCameraFramingRuntime()
  const orbitChanged = Boolean(control.angle || control.level)
  const settings = readStrybldrCameraSettings({
    ...current.settings,
    ...(control.angle ? { angle: control.angle } : {}),
    ...(control.level ? { level: control.level } : {}),
    ...(control.shot ? { shot: control.shot } : {}),
    ...(Number.isFinite(control.focalLengthMm) ? { focalLengthMm: control.focalLengthMm } : {}),
    ...(orbitChanged ? { orbitX: undefined, orbitY: undefined } : {}),
  })
  return publishCameraFramingRuntime({
    anchorId: resolveCameraAnchor(control.targetId),
    settings,
    source: 'panel',
  })
}

function hydrateActiveMotionReference(): boolean {
  const state = useGraphStore.getState()
  if (!state.graphData || !String(state.markdownDocumentName || '').trim() || !String(state.markdownDocumentText || '').trim()) return false
  hydrateXrMotionReferenceRuntime({
    sceneKey: xrMotionReferenceSceneKey(state.markdownDocumentName || 'Untitled', state.graphData),
    nodes: state.graphData.nodes,
    persistedValue: state.graphData.metadata?.[XR_MOTION_REFERENCE_GRAPH_METADATA_KEY],
  })
  activateCanvasGraphSurfaceMode({
    mode: 'xr',
    setCanvas3dMode: state.setCanvas3dMode,
    setCanvasRenderMode: state.setCanvasRenderMode,
  })
  return true
}

function persistMotionReference(): boolean {
  const state = useGraphStore.getState()
  const serialized = serializeXrMotionReferencePlan(readXrMotionReferenceRuntime().plan)
  state.updateGraphMetadata({ [XR_MOTION_REFERENCE_GRAPH_METADATA_KEY]: serialized })
  const savedValue = useGraphStore.getState().graphData?.metadata?.[XR_MOTION_REFERENCE_GRAPH_METADATA_KEY]
  if (savedValue !== serialized) return false
  markXrMotionReferenceSaved(serialized)
  return true
}

function setCameraTimelineState(args: { timeSeconds: number; playing: boolean }): void {
  const state = useGraphStore.getState()
  const documentKey = xrMotionReferenceTimelineDocumentKey(state.markdownDocumentName)
  state.setTimelineTransportState({
    documentKey,
    position: args.timeSeconds / 60,
    playing: args.playing,
  })
}

export function inspectLocalCamera() {
  const state = useGraphStore.getState()
  const framing = readCameraFramingRuntime()
  const motion = readXrMotionReferenceRuntime()
  return {
    schema: CAMERA_MCP_SCHEMA,
    webMcpTools: {
      inspect: `knowgrph.${CAMERA_WEB_MCP_TOOL_IDS.inspect}`,
      control: `knowgrph.${CAMERA_WEB_MCP_TOOL_IDS.control}`,
    },
    invocationGrammar: {
      source: 'agentic-canvas-os/docs/DICTIONARY-{COMMAND,SEMANTIC,BINDING}.md',
      frame: `${CAMERA_INVOCATION_COMMANDS.frame} @camera|@selected-actor #front|#left-side|#right-side|#overhead #eye-level|#high-angle|#low-angle #wide|#medium|#close-up #85mm`,
      animate: `${CAMERA_INVOCATION_COMMANDS.animate} @camera|@selected-actor #dolly|#steadicam|#handheld|#crane|#drone|#car-mount #2.5s`,
      playback: `${CAMERA_INVOCATION_COMMANDS.playback} @camera #play|#pause`,
      scrub: `${CAMERA_INVOCATION_COMMANDS.scrub} @camera #2.5s`,
    },
    surface: {
      renderMode: state.canvasRenderMode,
      threeMode: state.canvas3dMode,
      cameraPanelOpen: state.floatingPanelOpen === true && state.floatingPanelView === 'camera',
      motionTimelineOpen: state.bottomSurfaceCollapsed === false && state.bottomSurfaceTab === 'timeline',
    },
    framing: {
      anchorId: framing.anchorId,
      settings: { ...framing.settings },
      source: framing.source,
      revision: framing.revision,
    },
    animation: {
      playheadSeconds: motion.playheadSeconds,
      durationSeconds: motion.plan.durationSeconds,
      fps: motion.plan.fps,
      selectedRig: motion.selectedCameraRig,
      cameraMarks: motion.plan.camera.length,
      playing: state.timelineTransportPlaying === true,
      transportDocumentKey: state.timelineTransportDocumentKey || '',
    },
  }
}

export function controlLocalCamera(input: CameraControlInput): CameraControlResult {
  const control = normalizeCameraControl(input)
  if (!control) return { ok: false, message: 'Use /camera.frame, /camera.animate, /camera.play, or /camera.scrub with @ and # tokens.' }
  openSharedCameraPanel()

  if (control.action === 'frame') {
    const framing = publishCameraFrame(control)
    return {
      ok: true,
      action: control.action,
      message: `Camera framed ${framing.settings.shot} at ${framing.settings.focalLengthMm}mm around ${framing.anchorId}.`,
      camera: inspectLocalCamera(),
    }
  }

  if (!hydrateActiveMotionReference()) {
    return { ok: false, action: control.action, message: 'Open or create a graph document before controlling Camera animation.' }
  }
  openCameraAnimationTimeline()
  const runtime = readXrMotionReferenceRuntime()
  const durationSeconds = runtime.plan.durationSeconds
  const requestedTime = Number.isFinite(control.timeSeconds) ? Number(control.timeSeconds) : runtime.playheadSeconds
  const timeSeconds = Math.max(0, Math.min(durationSeconds, requestedTime))

  if (control.action === 'animate') {
    const framing = publishCameraFrame(control)
    const rig = control.rig || runtime.selectedCameraRig
    setXrMotionReferencePlayhead(timeSeconds)
    setXrMotionReferenceCameraRig(rig)
    setXrMotionReferenceCameraMark({
      timeSeconds,
      anchorId: framing.anchorId,
      settings: { ...framing.settings },
      rig,
    })
    if (!persistMotionReference()) return { ok: false, action: control.action, message: 'Camera animation could not be written to graph metadata.' }
    setCameraTimelineState({ timeSeconds, playing: false })
    return {
      ok: true,
      action: control.action,
      message: `${rig} Camera animation mark dropped at ${timeSeconds.toFixed(2)}s.`,
      camera: inspectLocalCamera(),
    }
  }

  if (control.action === 'scrub') {
    setXrMotionReferencePlayhead(timeSeconds)
    setCameraTimelineState({ timeSeconds, playing: false })
    return {
      ok: true,
      action: control.action,
      message: `Camera animation scrubbed to ${timeSeconds.toFixed(2)}s.`,
      camera: inspectLocalCamera(),
    }
  }

  const playing = control.playing !== false
  const playbackTime = playing && timeSeconds >= durationSeconds ? 0 : timeSeconds
  setXrMotionReferencePlayhead(playbackTime)
  setCameraTimelineState({ timeSeconds: playbackTime, playing })
  return {
    ok: true,
    action: control.action,
    message: `Camera animation ${playing ? 'playing' : 'paused'} at ${playbackTime.toFixed(2)}s.`,
    camera: inspectLocalCamera(),
  }
}
