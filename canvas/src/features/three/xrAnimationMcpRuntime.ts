import { activateCanvasGraphSurfaceMode } from '@/lib/canvas/canvas3dMode'
import { useGraphStore } from '@/hooks/useGraphStore'
import { findAgenticOsInvocationByToken } from '@/features/agentic-os/agenticOsDocInvocations'
import { getAgenticOsRemoteGrammarCatalogSnapshot } from '@/features/agentic-os/agenticOsRemoteGrammarClient'
import {
  XR_ANIMATION_PRESETS,
  isXrAnimationPresetId,
  resolveXrAnimationPreset,
  xrAnimationPresetCompatible,
  type XrAnimationPresetId,
  type XrAnimationTrackKind,
} from './xrAnimationCatalog'
import {
  XR_CHOREOGRAPHY_EASINGS,
  XR_CHOREOGRAPHY_GAITS,
  XR_MOTION_REFERENCE_GRAPH_METADATA_KEY,
  resolveXrMotionReferenceStage,
  serializeXrMotionReferencePlan,
  type XrChoreographyEasing,
  type XrChoreographyGait,
  type XrMotionReferencePackage,
  type XrMotionReferenceVector,
} from './xrMotionReferenceModel'
import {
  clearXrMotionReferenceCastAnimation,
  markXrMotionReferenceSaved,
  readXrMotionReferenceRuntime,
  restoreXrMotionReferenceRuntimeSnapshot,
  selectXrMotionReferenceCameraMark,
  selectXrMotionReferenceCastMark,
  setXrMotionReferenceCastAnimation,
  setXrMotionReferenceCameraMarkChoreography,
  setXrMotionReferenceCastMarkChoreography,
  setXrMotionReferencePlayhead,
} from './xrMotionReferenceRuntime'
import { readBoundXrSelectedActorId, selectBoundXrActor } from './xrSelectedActorBinding'
import { requestXrMotionReferenceCameraPlaybackReapply } from './xrCameraPlaybackControlsRuntime'
import { hydrateCanonicalXrMotionReferenceRuntime } from './XrMotionReferenceRuntimeBridge'
import { buildXrMotionReferencePackage } from './xrMotionReferencePackage'
import { xrMotionReferenceTimelineDocumentKey } from './xrMotionReferenceTimeline'
import { XR_ANIMATION_MCP_SCHEMA, XR_ANIMATION_WEB_MCP_TOOL_IDS } from './xrAnimationMcpContract.mjs'
import { resolveXrChoreographySpeedWarnings } from './xrChoreographyDiagnostics'
import {
  THREE_OBJECT_KEYBOARD_FINE_STEP_METERS,
  THREE_OBJECT_KEYBOARD_MAX_COMMAND_DISTANCE_METERS,
  THREE_OBJECT_KEYBOARD_STEP_METERS,
  readThreeKeyboardMovementKeys,
  resolveThreeObjectKeyboardMotionPosition,
  type ThreeKeyboardMovementKey,
} from './threeKeyboardChoreography'

const XR_ANIMATION_CONTROL_OPERATIONS = Object.freeze([
  'apply',
  'clear',
  'configure-mark',
  'move-object',
  'play',
  'pause',
  'scrub',
  'export',
] as const)

export type XrAnimationControlOperation = typeof XR_ANIMATION_CONTROL_OPERATIONS[number]

export type XrAnimationControlInput = Readonly<{
  invocation?: string
  operation?: XrAnimationControlOperation
  trackKind?: XrAnimationTrackKind
  presetId?: string
  targetId?: string
  timeSeconds?: number
  markKind?: 'cast' | 'camera'
  markId?: string
  easing?: XrChoreographyEasing
  gait?: XrChoreographyGait
  position?: XrMotionReferenceVector
  keys?: readonly string[]
  distanceMeters?: number
  fine?: boolean
}>

export type XrAnimationControlResult = Readonly<{
  ok: boolean
  message: string
  operation?: XrAnimationControlOperation
  targetId?: string
  package?: XrMotionReferencePackage
  scene?: ReturnType<typeof inspectLocalAnimation>
}>

type CanonicalInvocationTokens = Readonly<{
  command: string
  characterMotion: string
  actionPath: string
  selectedActor: string
  canvas: string
}>

type NormalizedAnimationControl = Readonly<{
  operation: XrAnimationControlOperation
  trackKind?: XrAnimationTrackKind
  presetId: string
  targetId: string
  timeSeconds: number
  invocation: string
  markKind: 'cast' | 'camera'
  markId: string
  easing?: XrChoreographyEasing
  gait?: XrChoreographyGait
  position?: XrMotionReferenceVector
  keys: readonly ThreeKeyboardMovementKey[]
  distanceMeters: number
  fine: boolean
}>

function resolveCanonicalInvocationTokens(): CanonicalInvocationTokens | null {
  const command = findAgenticOsInvocationByToken('/animation.control')
  const characterMotion = findAgenticOsInvocationByToken('#character-motion')
  const actionPath = findAgenticOsInvocationByToken('#action-path')
  const selectedActor = findAgenticOsInvocationByToken('@selected-actor')
  const canvas = findAgenticOsInvocationByToken('@canvas')
  if (!command || command.kind !== 'command'
    || !characterMotion || characterMotion.kind !== 'semantic'
    || !actionPath || actionPath.kind !== 'semantic'
    || !selectedActor || selectedActor.kind !== 'binding'
    || !canvas || canvas.kind !== 'binding') return null
  return {
    command: command.token,
    characterMotion: characterMotion.token,
    actionPath: actionPath.token,
    selectedActor: selectedActor.token,
    canvas: canvas.token,
  }
}

export function buildXrAnimationInvocation(presetIdValue: XrAnimationPresetId): string {
  const tokens = resolveCanonicalInvocationTokens()
  if (!tokens) return ''
  const preset = resolveXrAnimationPreset(presetIdValue)
  const semantic = preset.kind === 'character-motion' ? tokens.characterMotion : tokens.actionPath
  return `${tokens.command} ${semantic} ${tokens.selectedActor} operation=apply preset=${preset.id}`
}

export function buildXrAnimationObjectMoveInvocation(input: Readonly<{
  keys: Iterable<string>
  distanceMeters?: number
  fine?: boolean
  markId?: string
}>): string {
  const tokens = resolveCanonicalInvocationTokens()
  const keys = readThreeKeyboardMovementKeys(input.keys)
  const markId = String(input.markId || '').trim()
  if (!tokens || !keys || (markId && !/^[a-zA-Z0-9:._-]+$/.test(markId))) return ''
  if (input.fine !== undefined && typeof input.fine !== 'boolean') return ''
  if (input.distanceMeters !== undefined
    && (!Number.isFinite(input.distanceMeters)
      || input.distanceMeters <= 0
      || input.distanceMeters > THREE_OBJECT_KEYBOARD_MAX_COMMAND_DISTANCE_METERS)) return ''
  const parameters = [
    `keys=${keys.join('+')}`,
    ...(input.distanceMeters === undefined ? [] : [`distance=${Number(input.distanceMeters.toFixed(3))}`]),
    ...(input.fine ? ['fine=true'] : []),
    ...(markId ? [`markId=${markId}`] : []),
  ]
  return `${tokens.command} ${tokens.actionPath} ${tokens.selectedActor} operation=move-object ${parameters.join(' ')}`
}

export function buildXrAnimationTransportInvocation(operation: 'play' | 'pause' | 'scrub' | 'export', timeSeconds?: number): string {
  const tokens = resolveCanonicalInvocationTokens()
  if (!tokens) return ''
  if (operation === 'scrub' && (!Number.isFinite(timeSeconds) || Number(timeSeconds) < 0)) return ''
  return `${tokens.command} ${tokens.canvas} operation=${operation}${operation === 'scrub' ? ` time=${Number(timeSeconds).toFixed(3)}` : ''}`
}

function parsePairs(tokens: readonly string[]): Readonly<Record<string, string>> | null {
  const entries: Array<readonly [string, string]> = []
  const seen = new Set<string>()
  for (const token of tokens) {
    const separator = token.indexOf('=')
    if (separator <= 0 || separator === token.length - 1) return null
    const key = token.slice(0, separator)
    const value = token.slice(separator + 1)
    if (!['operation', 'preset', 'time', 'keys', 'distance', 'fine', 'markId'].includes(key) || seen.has(key)) return null
    seen.add(key)
    entries.push([key, value])
  }
  return Object.freeze(Object.fromEntries(entries))
}

function parseInvocation(value: unknown): Partial<NormalizedAnimationControl> | null {
  const invocation = String(value || '').trim()
  if (!invocation) return null
  const canonical = resolveCanonicalInvocationTokens()
  if (!canonical) return null
  const tokens = invocation.split(/\s+/).filter(Boolean)
  if (tokens[0] !== canonical.command) return null
  if (tokens.slice(1).some(token => token.startsWith('/'))) return null
  const semantics = tokens.filter(token => token.startsWith('#'))
  const bindings = tokens.filter(token => token.startsWith('@'))
  const pairs = parsePairs(tokens.slice(1).filter(token => !token.startsWith('#') && !token.startsWith('@')))
  if (!pairs) return null
  const operation = String(pairs.operation || '').trim() as XrAnimationControlOperation
  if (!XR_ANIMATION_CONTROL_OPERATIONS.includes(operation)) return null
  const actorOperation = operation === 'apply' || operation === 'clear' || operation === 'move-object'
  if (actorOperation) {
    if (bindings.length !== 1 || bindings[0] !== canonical.selectedActor) return null
    if (semantics.length !== 1
      || ![canonical.characterMotion, canonical.actionPath].includes(semantics[0]!)
      || (operation === 'move-object' && semantics[0] !== canonical.actionPath)) return null
  } else if (bindings.length !== 1 || bindings[0] !== canonical.canvas || semantics.length !== 0) {
    return null
  }
  const allowedPairKeys = actorOperation
    ? operation === 'apply'
      ? ['operation', 'preset']
      : operation === 'move-object'
        ? ['operation', 'keys', 'distance', 'fine', 'markId']
        : ['operation']
    : operation === 'scrub' ? ['operation', 'time'] : ['operation']
  if (Object.keys(pairs).some(key => !allowedPairKeys.includes(key))) return null
  if (operation === 'apply' && !pairs.preset) return null
  const movementKeys = operation === 'move-object'
    ? readThreeKeyboardMovementKeys(String(pairs.keys || '').split('+'))
    : Object.freeze([])
  if (operation === 'move-object' && !movementKeys) return null
  const movementDistance = pairs.distance === undefined ? undefined : Number(pairs.distance)
  if (movementDistance !== undefined
    && (!Number.isFinite(movementDistance)
      || movementDistance <= 0
      || movementDistance > THREE_OBJECT_KEYBOARD_MAX_COMMAND_DISTANCE_METERS)) return null
  const fine = pairs.fine === undefined ? false : pairs.fine === 'true'
  if (pairs.fine !== undefined && pairs.fine !== 'true' && pairs.fine !== 'false') return null
  if (pairs.markId !== undefined && !/^[a-zA-Z0-9:._-]+$/.test(pairs.markId)) return null
  if (operation === 'scrub' && (!Object.hasOwn(pairs, 'time') || !Number.isFinite(Number(pairs.time)) || Number(pairs.time) < 0)) return null
  const semantic = actorOperation ? semantics[0]! : ''
  const binding = bindings[0]!
  return {
    invocation,
    operation,
    presetId: String(pairs.preset || '').trim(),
    targetId: binding === canonical.selectedActor ? 'selected-actor' : binding === canonical.canvas ? 'canvas' : '',
    timeSeconds: Number(pairs.time || 0),
    keys: movementKeys || Object.freeze([]),
    distanceMeters: movementDistance ?? (fine ? THREE_OBJECT_KEYBOARD_FINE_STEP_METERS : THREE_OBJECT_KEYBOARD_STEP_METERS),
    fine,
    markId: String(pairs.markId || '').trim(),
    ...(semantic ? { trackKind: semantic === canonical.characterMotion ? 'character-motion' : 'action-path' } : {}),
  }
}

function normalizeControl(input: XrAnimationControlInput): NormalizedAnimationControl | null {
  const invocation = String(input.invocation || '').trim()
  const parsed = parseInvocation(invocation)
  if (invocation && !parsed) return null
  const operation = (parsed?.operation || input.operation) as XrAnimationControlOperation | undefined
  if (!operation || !XR_ANIMATION_CONTROL_OPERATIONS.includes(operation)) return null
  if (input.trackKind !== undefined && input.trackKind !== 'character-motion' && input.trackKind !== 'action-path') return null
  if (input.markKind !== undefined && input.markKind !== 'cast' && input.markKind !== 'camera') return null
  if (input.easing !== undefined && !XR_CHOREOGRAPHY_EASINGS.includes(input.easing)) return null
  if (input.gait !== undefined && !XR_CHOREOGRAPHY_GAITS.includes(input.gait)) return null
  if (input.position !== undefined && (input.position.length !== 3 || input.position.some(value => !Number.isFinite(value) || Math.abs(value) > 1000))) return null
  if (input.markKind === 'camera' && (input.gait !== undefined || input.position !== undefined)) return null
  if (input.fine !== undefined && typeof input.fine !== 'boolean') return null
  if (input.keys !== undefined && (!Array.isArray(input.keys) || input.keys.some(key => typeof key !== 'string'))) return null
  const movementKeys = parsed?.keys || (input.keys ? readThreeKeyboardMovementKeys(input.keys) : null)
  const movementDistanceInput = parsed ? parsed.distanceMeters : input.distanceMeters
  const fine = parsed?.fine ?? input.fine ?? false
  const hasMovementFields = input.keys !== undefined || input.distanceMeters !== undefined || input.fine !== undefined
  if (operation === 'move-object') {
    if (!movementKeys
      || input.markKind === 'camera'
      || (input.trackKind !== undefined && input.trackKind !== 'action-path')
      || input.presetId !== undefined
      || input.timeSeconds !== undefined
      || input.easing !== undefined
      || input.gait !== undefined
      || input.position !== undefined) return null
  } else if (hasMovementFields) return null
  if (movementDistanceInput !== undefined
    && (!Number.isFinite(movementDistanceInput)
      || Number(movementDistanceInput) <= 0
      || Number(movementDistanceInput) > THREE_OBJECT_KEYBOARD_MAX_COMMAND_DISTANCE_METERS)) return null
  const trackKind = parsed?.trackKind || input.trackKind
  const timeSeconds = parsed ? parsed.timeSeconds : input.timeSeconds
  if (operation === 'scrub' && (!Number.isFinite(timeSeconds) || Number(timeSeconds) < 0)) return null
  return {
    operation,
    ...(trackKind === 'character-motion' || trackKind === 'action-path' ? { trackKind } : {}),
    presetId: String(parsed?.presetId || input.presetId || '').trim(),
    targetId: String(parsed?.targetId || input.targetId || '').trim().replace(/^@+/, ''),
    timeSeconds: Number.isFinite(timeSeconds) ? Number(timeSeconds) : 0,
    invocation: String(parsed?.invocation || input.invocation || '').trim(),
    markKind: input.markKind === 'camera' ? 'camera' : 'cast',
    markId: String(parsed?.markId || input.markId || '').trim(),
    ...(input.easing ? { easing: input.easing } : {}),
    ...(input.gait ? { gait: input.gait } : {}),
    ...(input.position ? { position: [...input.position] as XrMotionReferenceVector } : {}),
    keys: movementKeys || Object.freeze([]),
    distanceMeters: movementDistanceInput === undefined
      ? fine ? THREE_OBJECT_KEYBOARD_FINE_STEP_METERS : THREE_OBJECT_KEYBOARD_STEP_METERS
      : Number(movementDistanceInput),
    fine,
  }
}

function sceneReady(): boolean {
  const state = useGraphStore.getState()
  return Boolean(state.graphData && String(state.markdownDocumentName || '').trim() && String(state.markdownDocumentText || '').trim())
}

function resolvedTargetId(control: NormalizedAnimationControl): string {
  if (!control.targetId || control.targetId === 'selected-actor') return readBoundXrSelectedActorId()
  return control.targetId === 'canvas' ? '' : control.targetId
}

function persistPlan(): boolean {
  const state = useGraphStore.getState()
  const serialized = serializeXrMotionReferencePlan(readXrMotionReferenceRuntime().plan)
  state.updateGraphMetadata({ [XR_MOTION_REFERENCE_GRAPH_METADATA_KEY]: serialized })
  const saved = useGraphStore.getState().graphData?.metadata?.[XR_MOTION_REFERENCE_GRAPH_METADATA_KEY]
  if (saved !== serialized) return false
  markXrMotionReferenceSaved(serialized)
  return true
}

function activateAnimationSurface(): void {
  const state = useGraphStore.getState()
  activateCanvasGraphSurfaceMode({ mode: 'xr', setCanvas3dMode: state.setCanvas3dMode, setCanvasRenderMode: state.setCanvasRenderMode })
  state.setFloatingPanelView('animation')
  state.setFloatingPanelOpen(true)
  state.setBottomSurfaceTab('timeline')
  state.setBottomSurfaceCollapsed(false)
}

function updateTransport(operation: 'play' | 'pause' | 'scrub', timeSeconds: number): void {
  const state = useGraphStore.getState()
  const documentKey = xrMotionReferenceTimelineDocumentKey(state.markdownDocumentName)
  if (operation === 'scrub') {
    const duration = readXrMotionReferenceRuntime().plan.durationSeconds
    const bounded = Math.min(duration, Math.max(0, Number(timeSeconds) || 0))
    setXrMotionReferencePlayhead(bounded)
    state.setTimelineTransportState({ documentKey, position: bounded / 60 })
    requestXrMotionReferenceCameraPlaybackReapply()
    return
  }
  state.setTimelineTransportState({ documentKey, playing: operation === 'play' })
  if (operation === 'play') requestXrMotionReferenceCameraPlaybackReapply()
}

export function inspectLocalAnimation() {
  const runtime = readXrMotionReferenceRuntime()
  const speedWarnings = resolveXrChoreographySpeedWarnings(runtime.plan)
  const catalog = getAgenticOsRemoteGrammarCatalogSnapshot()
  const canonical = resolveCanonicalInvocationTokens()
  return {
    schema: XR_ANIMATION_MCP_SCHEMA,
    webMcpTools: {
      inspect: `knowgrph.${XR_ANIMATION_WEB_MCP_TOOL_IDS.inspect}`,
      control: `knowgrph.${XR_ANIMATION_WEB_MCP_TOOL_IDS.control}`,
    },
    sceneReady: sceneReady(),
    catalog: {
      revision: catalog.sourceRevision,
      hydration: catalog.hydration,
      canonical: Boolean(canonical),
    },
    invocationGrammar: canonical ? {
      applyCharacterMotion: `${canonical.command} ${canonical.characterMotion} ${canonical.selectedActor} operation=apply preset=<typed-id>`,
      applyActionPath: `${canonical.command} ${canonical.actionPath} ${canonical.selectedActor} operation=apply preset=<typed-id>`,
      moveObject: `${canonical.command} ${canonical.actionPath} ${canonical.selectedActor} operation=move-object keys=<w+a+s+d|arrows> distance=<meters> fine=<true|false> markId=<typed-id>`,
      configureCastMark: `${canonical.command} ${canonical.actionPath} ${canonical.selectedActor} operation=configure-mark markKind=cast markId=<typed-id> easing=<typed-easing> gait=<typed-gait> position=<x,y,z>`,
      configureCameraMark: `${canonical.command} ${canonical.canvas} operation=configure-mark markKind=camera markId=<typed-id> easing=<typed-easing>`,
      transport: `${canonical.command} ${canonical.canvas} operation=play|pause|scrub|export`,
    } : null,
    presets: XR_ANIMATION_PRESETS.map(preset => ({
      ...preset,
      invocation: buildXrAnimationInvocation(preset.id),
    })),
    runtime: {
      stageId: runtime.plan.stageId,
      durationSeconds: runtime.plan.durationSeconds,
      fps: runtime.plan.fps,
      selectedActorId: readBoundXrSelectedActorId(),
      playheadSeconds: runtime.playheadSeconds,
      cast: runtime.plan.cast.map(track => ({ actorId: track.actorId, label: track.label, animation: track.animation, marks: track.marks })),
      cameraMarks: runtime.plan.camera,
      speedWarnings,
      dirty: runtime.dirty,
      revision: runtime.revision,
    },
  }
}

export function controlLocalAnimation(input: XrAnimationControlInput): XrAnimationControlResult {
  const control = normalizeControl(input)
  if (!control) return { ok: false, message: 'Use a supported structured animation operation or a hydrated /animation.control invocation.' }
  if (!sceneReady() || !hydrateCanonicalXrMotionReferenceRuntime()) return { ok: false, message: 'Open or create a graph document before controlling XR animation.' }
  const targetId = resolvedTargetId(control)

  if (control.operation === 'move-object') {
    const previousRuntime = readXrMotionReferenceRuntime()
    const track = previousRuntime.plan.cast.find(candidate => candidate.actorId === targetId)
    const selectedMark = previousRuntime.selectedMark
    const markId = control.markId || (selectedMark?.kind === 'cast' && selectedMark.actorId === targetId ? selectedMark.markId : '')
    const mark = track?.marks.find(candidate => candidate.id === markId)
    if (!track || !mark) return { ok: false, message: 'Select a valid cast mark before moving a 3D object.' }
    const stage = resolveXrMotionReferenceStage(previousRuntime.plan.stageId)
    const nextPosition = resolveThreeObjectKeyboardMotionPosition({
      bounds: {
        halfDepth: stage.sizeMeters[1] / 2,
        halfWidth: stage.sizeMeters[0] / 2,
      },
      distanceMeters: control.distanceMeters,
      keys: control.keys,
      position: mark.position,
    })
    if (!nextPosition) return { ok: false, message: 'Use one or more supported WASD or arrow movement keys.' }
    const changed = nextPosition[0] !== mark.position[0] || nextPosition[2] !== mark.position[2]
    if (changed) {
      setXrMotionReferenceCastMarkChoreography({
        actorId: targetId,
        markId,
        position: nextPosition as XrMotionReferenceVector,
      })
      if (!persistPlan()) {
        restoreXrMotionReferenceRuntimeSnapshot(previousRuntime)
        return { ok: false, message: 'The 3D object movement could not be written to graph metadata.' }
      }
    }
    selectXrMotionReferenceCastMark(targetId, markId)
    selectBoundXrActor(targetId)
    activateAnimationSurface()
    return {
      ok: true,
      message: changed
        ? `Moved ${track.label} with ${control.keys.join('+')} by ${control.distanceMeters.toFixed(3)} m.`
        : `${track.label} is already at the stage boundary.`,
      operation: control.operation,
      targetId,
      scene: inspectLocalAnimation(),
    }
  }

  if (control.operation === 'configure-mark') {
    if (!control.markId || (!control.easing && !control.gait && !control.position)) return { ok: false, message: 'Configure-mark requires markId and easing, gait, or position.' }
    const previousRuntime = readXrMotionReferenceRuntime()
    if (control.markKind === 'camera') {
      if (!control.easing || !previousRuntime.plan.camera.some(mark => mark.id === control.markId)) return { ok: false, message: 'Select a valid camera mark and easing.' }
      setXrMotionReferenceCameraMarkChoreography({ markId: control.markId, easing: control.easing })
      selectXrMotionReferenceCameraMark(control.markId)
    } else {
      const track = previousRuntime.plan.cast.find(candidate => candidate.actorId === targetId)
      if (!track?.marks.some(mark => mark.id === control.markId)) return { ok: false, message: 'Select a valid cast mark before configuring choreography.' }
      setXrMotionReferenceCastMarkChoreography({ actorId: targetId, markId: control.markId, easing: control.easing, gait: control.gait, position: control.position })
      selectXrMotionReferenceCastMark(targetId, control.markId)
    }
    if (!persistPlan()) {
      restoreXrMotionReferenceRuntimeSnapshot(previousRuntime)
      return { ok: false, message: 'The choreography mark could not be written to graph metadata.' }
    }
    if (control.markKind === 'cast') selectBoundXrActor(targetId)
    activateAnimationSurface()
    const warnings = resolveXrChoreographySpeedWarnings(readXrMotionReferenceRuntime().plan)
    return { ok: true, message: `Updated ${control.markKind} mark choreography${warnings.length ? ` with ${warnings.length} speed warning${warnings.length === 1 ? '' : 's'}` : ''}.`, operation: control.operation, targetId: control.markKind === 'cast' ? targetId : 'camera', scene: inspectLocalAnimation() }
  }

  if (control.operation === 'export') {
    const state = useGraphStore.getState()
    if (!state.graphData) return { ok: false, message: 'No graph is available for animation export.' }
    const bundle = buildXrMotionReferencePackage({ plan: readXrMotionReferenceRuntime().plan, graphData: state.graphData, documentName: state.markdownDocumentName || 'Untitled' })
    return { ok: true, message: `Built ${bundle.timeline.frameCount} deterministic animation samples.`, operation: control.operation, package: bundle, scene: inspectLocalAnimation() }
  }

  if (control.operation === 'play' || control.operation === 'pause' || control.operation === 'scrub') {
    updateTransport(control.operation, control.timeSeconds)
    activateAnimationSurface()
    return { ok: true, message: control.operation === 'scrub' ? `Animation playhead moved to ${readXrMotionReferenceRuntime().playheadSeconds.toFixed(2)}s.` : `Animation playback ${control.operation === 'play' ? 'started' : 'paused'}.`, operation: control.operation, scene: inspectLocalAnimation() }
  }

  const track = readXrMotionReferenceRuntime().plan.cast.find(candidate => candidate.actorId === targetId)
  if (!track) return { ok: false, message: 'Select a cast actor before applying or clearing animation.' }
  const previousRuntime = readXrMotionReferenceRuntime()
  if (control.operation === 'clear') {
    if (control.trackKind && track.animation && track.animation.kind !== control.trackKind) {
      return { ok: false, message: `${track.label} has ${track.animation.kind}, not ${control.trackKind}.`, operation: control.operation, targetId }
    }
    clearXrMotionReferenceCastAnimation(targetId)
  } else {
    if (!isXrAnimationPresetId(control.presetId)) return { ok: false, message: `Unknown animation preset: ${control.presetId || '(empty)'}.` }
    const preset = resolveXrAnimationPreset(control.presetId)
    if (control.trackKind && control.trackKind !== preset.kind) return { ok: false, message: `${preset.id} is a ${preset.kind} preset, not ${control.trackKind}.` }
    const subject = readXrMotionReferenceRuntime().plan.subjects.find(candidate => candidate.id === targetId)
    if (!xrAnimationPresetCompatible({ preset, assetId: subject?.assetId, category: subject?.category, graphActor: !subject })) return { ok: false, message: `${preset.label} is not compatible with ${subject?.label || track.label}.` }
    setXrMotionReferenceCastAnimation(targetId, preset.id)
  }
  if (!persistPlan()) {
    restoreXrMotionReferenceRuntimeSnapshot(previousRuntime)
    return { ok: false, message: 'The animation plan could not be written to graph metadata.' }
  }
  selectBoundXrActor(targetId)
  activateAnimationSurface()
  const applied = readXrMotionReferenceRuntime().plan.cast.find(candidate => candidate.actorId === targetId)?.animation
  return { ok: true, message: applied ? `${resolveXrAnimationPreset(applied.presetId).label} applied to ${track.label}.` : `Animation cleared from ${track.label}.`, operation: control.operation, targetId, scene: inspectLocalAnimation() }
}
