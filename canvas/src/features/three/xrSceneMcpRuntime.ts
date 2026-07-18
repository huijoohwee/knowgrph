import { activateCanvasGraphSurfaceMode } from '@/lib/canvas/canvas3dMode'
import { useGraphStore } from '@/hooks/useGraphStore'
import type { JSONValue } from '@/lib/graph/types'
import {
  XR_MOTION_REFERENCE_GRAPH_METADATA_KEY,
  serializeXrMotionReferencePlan,
  type XrMotionReferenceTransition,
} from './xrMotionReferenceModel'
import {
  XR_MOTION_REFERENCE_STAGE_PRESETS,
  XR_SCENE_LIBRARY_ASSETS,
  isXrSceneLibraryAssetId,
  type XrMotionReferenceStageId,
} from './xrSceneLibrary'
import {
  addXrMotionReferenceSubject,
  markXrMotionReferenceSaved,
  readXrMotionReferenceRuntime,
  removeXrMotionReferenceSubject,
  restoreXrMotionReferenceRuntimeSnapshot,
  setXrMotionReferenceCastTransition,
  setXrMotionReferenceStage,
  setXrMotionReferenceSubjectLabel,
} from './xrMotionReferenceRuntime'
import {
  hydrateCanonicalXrMotionReferenceRuntime,
  hydrateCanonicalXrPhysicsRuntime,
} from './XrMotionReferenceRuntimeBridge'
import { XR_PHYSICS_GRAPH_METADATA_KEY } from './xrPhysicsModel'
import {
  applyXrPhysicsImpulse,
  attachXrPhysicsBody,
  configureXrPhysicsBody,
  configureXrPhysicsWorld,
  detachXrPhysicsBody,
  markXrPhysicsRuntimeSaved,
  pauseXrPhysicsRuntime,
  playXrPhysicsRuntime,
  readXrPhysicsRuntime,
  readXrPhysicsRuntimeFrame,
  resetXrPhysicsRuntime,
  restoreXrPhysicsRuntimeSnapshot,
  serializeXrPhysicsRuntimeWorld,
  stepXrPhysicsRuntimeTicks,
  stopXrPhysicsRuntime,
} from './xrPhysicsRuntime'
import {
  normalizeXrPhysicsControl,
  parseXrInteractiveInvocation,
  type XrPhysicsControlInput,
} from './xrSceneInteractiveInvocation'
import {
  commitXrArPlacement,
  readXrArPlacementRuntime,
} from './xrArPlacementRuntime'
import {
  XR_SCENE_INVOCATION_COMMANDS,
  XR_SCENE_INVOCATION_BINDINGS,
  XR_SCENE_INVOCATION_SEMANTICS,
  XR_SCENE_MCP_SCHEMA,
  XR_SCENE_WEB_MCP_TOOL_IDS,
  buildXrPlaceInvocation,
  buildXrStageInvocation,
} from './xrSceneMcpContract.mjs'

export type XrSceneTransition = XrMotionReferenceTransition
export type XrSceneControlAction = 'stage' | 'place' | 'transition' | 'label' | 'remove' | 'physics' | 'present'

export type XrSceneControlInput = Readonly<{
  invocation?: string
  action?: XrSceneControlAction
  stageId?: string
  assetId?: string
  subjectId?: string
  label?: string
  transition?: XrSceneTransition
  physics?: XrPhysicsControlInput
}>

type NormalizedXrSceneControl = Readonly<{
  action: XrSceneControlAction
  stageId: string
  assetId: string
  subjectId: string
  label: string
  transition: XrSceneTransition
  physics: XrPhysicsControlInput | null
  invocation: string
}>

export type XrSceneControlResult = Readonly<{
  ok: boolean
  message: string
  action?: XrSceneControlAction
  subjectId?: string
  scene?: ReturnType<typeof inspectLocalXrSceneAssets>
}>

const asTransition = (value: unknown): XrSceneTransition | null => {
  const normalized = String(value || '').trim()
  if (!normalized) return 'linear'
  return normalized === 'linear' || normalized === 'hold' ? normalized : null
}
const cleanTarget = (value: unknown): string => String(value || '').trim().replace(/^@+/, '')
const cleanLabel = (value: unknown): string => String(value || '').trim()
const textLength = (value: string): number => Array.from(value).length
const hasBoundedText = (value: unknown, maxLength?: number): value is string => {
  if (typeof value !== 'string' || !value.trim()) return false
  return maxLength === undefined || textLength(value) <= maxLength
}
const hasValidTransition = (value: unknown): boolean => (
  value === undefined || value === 'linear' || value === 'hold'
)

function parsePairs(tokens: readonly string[], allowedKeys: readonly string[]): Readonly<Record<string, string>> | null {
  const entries: Array<readonly [string, string]> = []
  const seen = new Set<string>()
  for (const token of tokens) {
    const separator = token.indexOf('=')
    if (separator <= 0 || separator === token.length - 1) return null
    const key = token.slice(0, separator)
    const value = token.slice(separator + 1)
    if (!allowedKeys.includes(key) || seen.has(key)) return null
    seen.add(key)
    entries.push([key, value])
  }
  return Object.freeze(Object.fromEntries(entries))
}

function parseXrSceneInvocation(invocationValue: unknown): Partial<NormalizedXrSceneControl> | null {
  const invocation = String(invocationValue || '').trim()
  if (!invocation) return null
  const interactive = parseXrInteractiveInvocation(invocation)
  if (interactive?.action === 'physics') {
    return { action: 'physics', physics: interactive.physics, invocation }
  }
  if (interactive?.action === 'present') return { action: 'present', invocation }
  const tokens = invocation.split(/\s+/).filter(Boolean)
  const command = tokens[0]
  const action = command === XR_SCENE_INVOCATION_COMMANDS.stage
    ? 'stage'
    : command === XR_SCENE_INVOCATION_COMMANDS.place
      ? 'place'
      : command === XR_SCENE_INVOCATION_COMMANDS.label
        ? 'label'
        : command === XR_SCENE_INVOCATION_COMMANDS.remove
          ? 'remove'
          : null
  if (!action || tokens.slice(1).some(token => token.startsWith('/') || token.startsWith('#'))) return null
  const bindings = tokens.slice(1).filter(token => token.startsWith('@'))
  if (bindings.length !== 1) return null
  const target = cleanTarget(bindings[0])
  if (!target) return null
  const allowedPairKeys = action === 'place' ? ['transition', 'label'] : action === 'label' ? ['label'] : []
  const pairs = parsePairs(tokens.slice(1).filter(token => !token.startsWith('@')), allowedPairKeys)
  if (!pairs) return null
  const transition = asTransition(pairs.transition)
  if (!transition || (action === 'label' && !String(pairs.label || '').trim())) return null
  const label = cleanLabel(pairs.label)
  if (textLength(label) > 80 || ((action === 'label' || action === 'remove') && textLength(target) > 160)) return null
  if (action === 'stage') return { action, stageId: target, invocation, transition }
  if (action === 'place') return { action, assetId: target, invocation, transition, label }
  return { action, subjectId: target, invocation, transition, label }
}

export function normalizeXrSceneControl(input: XrSceneControlInput): NormalizedXrSceneControl | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null
  const inputKeys = Object.keys(input)
  if (input.invocation !== undefined && typeof input.invocation !== 'string') return null
  const invocation = String(input.invocation || '').trim()
  const parsed = parseXrSceneInvocation(invocation)
  if (invocation && (inputKeys.length !== 1 || inputKeys[0] !== 'invocation' || !parsed)) return null
  const action = (parsed?.action || input.action) as XrSceneControlAction | undefined
  if (!action || !['stage', 'place', 'transition', 'label', 'remove', 'physics', 'present'].includes(action)) return null
  if (!invocation) {
    if (typeof input.action !== 'string') return null
    const shape = {
      stage: { allowed: ['action', 'stageId'], required: ['stageId'] },
      place: { allowed: ['action', 'assetId', 'label', 'transition'], required: ['assetId'] },
      transition: { allowed: ['action', 'subjectId', 'transition'], required: ['subjectId'] },
      label: { allowed: ['action', 'subjectId', 'label'], required: ['subjectId', 'label'] },
      remove: { allowed: ['action', 'subjectId'], required: ['subjectId'] },
      physics: { allowed: ['action', 'physics'], required: ['physics'] },
      present: { allowed: ['action'], required: [] },
    }[action]
    if (inputKeys.some(key => !shape.allowed.includes(key))
      || shape.required.some(key => !Object.hasOwn(input, key))) return null
    if (action === 'stage' && (!hasBoundedText(input.stageId) || !cleanTarget(input.stageId))) return null
    if (action === 'place' && (
      !hasBoundedText(input.assetId)
      || !cleanTarget(input.assetId)
      || (Object.hasOwn(input, 'label') && !hasBoundedText(input.label, 80))
      || !hasValidTransition(input.transition)
    )) return null
    if (action === 'transition' && (
      !hasBoundedText(input.subjectId, 160)
      || !cleanTarget(input.subjectId)
      || !hasValidTransition(input.transition)
    )) return null
    if (action === 'label' && (
      !hasBoundedText(input.subjectId, 160)
      || !cleanTarget(input.subjectId)
      || !hasBoundedText(input.label, 80)
    )) return null
    if (action === 'remove' && (
      !hasBoundedText(input.subjectId, 160) || !cleanTarget(input.subjectId)
    )) return null
  }
  const transition = asTransition(parsed?.transition ?? input.transition)
  if (!transition) return null
  const physics = action === 'physics'
    ? parsed?.physics || normalizeXrPhysicsControl(input.physics)
    : null
  if (action === 'physics' && !physics) return null
  return {
    action,
    stageId: cleanTarget(parsed?.stageId || input.stageId),
    assetId: cleanTarget(parsed?.assetId || input.assetId),
    subjectId: cleanTarget(parsed?.subjectId || input.subjectId),
    label: cleanLabel(parsed?.label || input.label),
    transition,
    physics,
    invocation: String(parsed?.invocation || input.invocation || '').trim(),
  }
}

function sceneDocumentReady(): boolean {
  const state = useGraphStore.getState()
  return Boolean(
    state.graphData
    && String(state.markdownDocumentName || '').trim()
    && String(state.markdownDocumentText || '').trim(),
  )
}

function hydrateActiveXrScene(): boolean {
  if (!sceneDocumentReady() || !hydrateCanonicalXrMotionReferenceRuntime()) return false
  hydrateCanonicalXrPhysicsRuntime()
  return true
}

function activateXrSceneWorkspace(): void {
  const nextState = useGraphStore.getState()
  activateCanvasGraphSurfaceMode({
    mode: 'xr',
    setCanvas3dMode: nextState.setCanvas3dMode,
    setCanvasRenderMode: nextState.setCanvasRenderMode,
  })
  if (!nextState.floatingPanelOpen) {
    nextState.setFloatingPanelView('media')
    nextState.setFloatingPanelOpen(true)
  }
  nextState.setBottomSurfaceTab('timeline')
  nextState.setBottomSurfaceCollapsed(false)
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

function persistAndActivateXrScene(includePhysics = false): boolean {
  const state = useGraphStore.getState()
  const serializedMotion = serializeXrMotionReferencePlan(readXrMotionReferenceRuntime().plan)
  const serializedPhysics = serializeXrPhysicsRuntimeWorld() as unknown as JSONValue
  state.updateGraphMetadata({
    [XR_MOTION_REFERENCE_GRAPH_METADATA_KEY]: serializedMotion,
    ...(includePhysics ? { [XR_PHYSICS_GRAPH_METADATA_KEY]: serializedPhysics } : {}),
  })
  const metadata = useGraphStore.getState().graphData?.metadata
  if (metadata?.[XR_MOTION_REFERENCE_GRAPH_METADATA_KEY] !== serializedMotion) return false
  if (includePhysics && !sameJson(metadata?.[XR_PHYSICS_GRAPH_METADATA_KEY], serializedPhysics)) return false
  markXrMotionReferenceSaved(serializedMotion)
  if (includePhysics) markXrPhysicsRuntimeSaved(metadata?.[XR_PHYSICS_GRAPH_METADATA_KEY])
  activateXrSceneWorkspace()
  return true
}

function persistXrPhysicsConfig(): boolean {
  const state = useGraphStore.getState()
  const serialized = serializeXrPhysicsRuntimeWorld() as unknown as JSONValue
  state.updateGraphMetadata({ [XR_PHYSICS_GRAPH_METADATA_KEY]: serialized })
  const savedValue = useGraphStore.getState().graphData?.metadata?.[XR_PHYSICS_GRAPH_METADATA_KEY]
  if (!sameJson(savedValue, serialized)) return false
  markXrPhysicsRuntimeSaved(savedValue)
  activateXrSceneWorkspace()
  return true
}

export function inspectLocalXrSceneAssets() {
  const runtime = readXrMotionReferenceRuntime()
  const physics = readXrPhysicsRuntime()
  const physicsFrame = readXrPhysicsRuntimeFrame()
  const arPlacement = readXrArPlacementRuntime()
  return {
    schema: XR_SCENE_MCP_SCHEMA,
    webMcpTools: {
      inspect: `knowgrph.${XR_SCENE_WEB_MCP_TOOL_IDS.inspect}`,
      control: `knowgrph.${XR_SCENE_WEB_MCP_TOOL_IDS.control}`,
    },
    sceneReady: sceneDocumentReady(),
    invocationGrammar: {
      stage: `${XR_SCENE_INVOCATION_COMMANDS.stage} @environment`,
      place: `${XR_SCENE_INVOCATION_COMMANDS.place} @asset transition=linear|hold label=<optional-id>`,
      label: `${XR_SCENE_INVOCATION_COMMANDS.label} @subject label=<required-id>`,
      remove: `${XR_SCENE_INVOCATION_COMMANDS.remove} @subject`,
      physicsWorld: `${XR_SCENE_INVOCATION_COMMANDS.physics} ${XR_SCENE_INVOCATION_BINDINGS.canvas} ${XR_SCENE_INVOCATION_SEMANTICS.world} operation=play|pause|stop|reset|step|configure`,
      physicsBody: `${XR_SCENE_INVOCATION_COMMANDS.physics} ${XR_SCENE_INVOCATION_BINDINGS.canvas} ${XR_SCENE_INVOCATION_SEMANTICS.body} operation=attach|configure|detach subject=<id>`,
      physicsImpulse: `${XR_SCENE_INVOCATION_COMMANDS.physics} ${XR_SCENE_INVOCATION_BINDINGS.canvas} ${XR_SCENE_INVOCATION_SEMANTICS.impulse} operation=impulse subject=<id> vector=x,y,z`,
      present: `${XR_SCENE_INVOCATION_COMMANDS.present} ${XR_SCENE_INVOCATION_BINDINGS.scene} ${XR_SCENE_INVOCATION_SEMANTICS.reticle}`,
    },
    environments: XR_MOTION_REFERENCE_STAGE_PRESETS.map(stage => ({
      id: stage.id,
      label: stage.label,
      description: stage.description,
      sizeMeters: [...stage.sizeMeters],
      invocation: buildXrStageInvocation(stage.id),
    })),
    assets: XR_SCENE_LIBRARY_ASSETS.map(asset => ({
      id: asset.id,
      label: asset.label,
      category: asset.category,
      description: asset.description,
      dimensionsMeters: [...asset.dimensionsMeters],
      mobile: asset.mobile,
      invocation: buildXrPlaceInvocation(asset.id, asset.mobile ? 'linear' : 'hold'),
    })),
    runtime: {
      stageId: runtime.plan.stageId,
      durationSeconds: runtime.plan.durationSeconds,
      fps: runtime.plan.fps,
      subjects: runtime.plan.subjects.map(subject => {
        const track = runtime.plan.cast.find(candidate => candidate.actorId === subject.id)
        const transition: XrSceneTransition | 'static' = track ? track.marks[0]?.transition === 'hold' ? 'hold' : 'linear' : 'static'
        return {
          id: subject.id,
          assetId: subject.assetId,
          label: subject.label,
          category: subject.category,
          position: [...subject.position],
          transition,
        }
      }),
      cameraMarks: runtime.plan.camera.length,
      dirty: runtime.dirty,
      revision: runtime.revision,
    },
    physics: {
      schema: physics.world.schema,
      phase: physics.phase,
      world: serializeXrPhysicsRuntimeWorld(),
      staticColliderCount: physics.staticColliderCount,
      dirty: physics.dirty,
      revision: physics.revision,
      frame: physicsFrame,
    },
    immersivePlacement: {
      ...arPlacement,
      hitMatrix: arPlacement.hitMatrix ? [...arPlacement.hitMatrix] : null,
      placementMatrix: arPlacement.placementMatrix ? [...arPlacement.placementMatrix] : null,
    },
  }
}

type XrPhysicsControlResult = Readonly<{
  ok: boolean
  message: string
  subjectId?: string
}>

function runXrPhysicsControl(physics: XrPhysicsControlInput): XrPhysicsControlResult {
  const before = readXrPhysicsRuntime()
  const subjectId = String(physics.subjectId || '').trim()
  if (physics.scope === 'world') {
    if (physics.operation === 'play') {
      if (before.world.bodies.length === 0) return { ok: false, message: 'Attach at least one XR body before entering Play mode.' }
      playXrPhysicsRuntime()
      activateXrSceneWorkspace()
      return { ok: true, message: 'XR dynamics Play mode started.' }
    }
    if (physics.operation === 'pause') {
      if (before.phase !== 'playing') return { ok: false, message: 'XR dynamics can pause only while playing.' }
      pauseXrPhysicsRuntime()
      activateXrSceneWorkspace()
      return { ok: true, message: 'XR dynamics paused.' }
    }
    if (physics.operation === 'stop') {
      stopXrPhysicsRuntime()
      activateXrSceneWorkspace()
      return { ok: true, message: 'XR dynamics stopped and authored transforms restored.' }
    }
    if (physics.operation === 'reset') {
      resetXrPhysicsRuntime()
      activateXrSceneWorkspace()
      return { ok: true, message: 'XR dynamics reset to authored spawn transforms.' }
    }
    if (physics.operation === 'step') {
      if (before.phase === 'stopped') return { ok: false, message: 'Start or pause Play mode before stepping XR dynamics.' }
      const ticks = physics.ticks || 1
      const result = stepXrPhysicsRuntimeTicks(ticks)
      if (result.subSteps !== ticks) return { ok: false, message: 'XR dynamics could not advance the requested fixed steps.' }
      activateXrSceneWorkspace()
      return { ok: true, message: `XR dynamics advanced ${ticks} fixed ${ticks === 1 ? 'step' : 'steps'}.` }
    }
    if (before.phase !== 'stopped') return { ok: false, message: 'Stop XR dynamics before editing world settings.' }
    configureXrPhysicsWorld({
      ...(physics.gravity ? { gravity: physics.gravity } : {}),
      ...(physics.fixedStepSeconds !== undefined ? { fixedStepSeconds: physics.fixedStepSeconds } : {}),
      ...(physics.maxSubsteps !== undefined ? { maxSubSteps: physics.maxSubsteps } : {}),
    })
    if (readXrPhysicsRuntime().revision === before.revision) return { ok: false, message: 'XR world settings were unchanged or invalid.' }
    if (!persistXrPhysicsConfig()) {
      restoreXrPhysicsRuntimeSnapshot(before)
      return { ok: false, message: 'XR world settings could not be written to graph metadata.' }
    }
    return { ok: true, message: 'XR world settings persisted.' }
  }

  const subject = readXrMotionReferenceRuntime().plan.subjects.find(candidate => candidate.id === subjectId)
  if (!subject) return { ok: false, message: `Unknown XR subject: ${subjectId || '(empty)'}.` }
  if (physics.scope === 'impulse') {
    if (!physics.impulse || !applyXrPhysicsImpulse(subjectId, physics.impulse)) {
      return { ok: false, message: 'Impulses require a dynamic body in playing or paused XR dynamics.' }
    }
    activateXrSceneWorkspace()
    return { ok: true, message: `Impulse applied to ${subject.label}.`, subjectId }
  }
  if (before.phase !== 'stopped') return { ok: false, message: 'Stop XR dynamics before editing body components.' }
  const patch = {
    ...(physics.bodyMode ? { mode: physics.bodyMode } : {}),
    ...(physics.massKg !== undefined ? { mass: physics.massKg } : {}),
    ...(physics.friction !== undefined ? { friction: physics.friction } : {}),
    ...(physics.restitution !== undefined ? { restitution: physics.restitution } : {}),
    ...(physics.linearDamping !== undefined ? { linearDamping: physics.linearDamping } : {}),
    ...(physics.collisionGroup !== undefined ? { collisionGroup: physics.collisionGroup } : {}),
    ...(physics.collisionMask !== undefined ? { collisionMask: physics.collisionMask } : {}),
  }
  if (physics.operation === 'attach') attachXrPhysicsBody({ subjectId, patch })
  else if (physics.operation === 'configure') {
    if (Object.keys(patch).length === 0) return { ok: false, message: 'Configure at least one XR body property.' }
    configureXrPhysicsBody(subjectId, patch)
  } else detachXrPhysicsBody(subjectId)
  if (readXrPhysicsRuntime().revision === before.revision) {
    return { ok: false, message: `XR body ${physics.operation} was unchanged or invalid for ${subject.label}.` }
  }
  if (!persistXrPhysicsConfig()) {
    restoreXrPhysicsRuntimeSnapshot(before)
    return { ok: false, message: 'The XR body component could not be written to graph metadata.' }
  }
  return { ok: true, message: `XR body ${physics.operation} persisted for ${subject.label}.`, subjectId }
}

export function controlLocalXrScene(input: XrSceneControlInput): XrSceneControlResult {
  const control = normalizeXrSceneControl(input)
  if (!control) return { ok: false, message: 'Use a supported XR action or an invocation such as /xr.place @person-adult transition=linear.' }
  if (!hydrateActiveXrScene()) return { ok: false, message: 'Open or create a graph document before controlling the XR scene.' }

  if (control.action === 'physics' && control.physics) {
    const result = runXrPhysicsControl(control.physics)
    return { ...result, action: control.action, scene: inspectLocalXrSceneAssets() }
  }
  if (control.action === 'present') {
    if (!commitXrArPlacement()) {
      return { ok: false, message: 'Enter an immersive AR session and acquire a current reticle hit before placing the scene.' }
    }
    activateXrSceneWorkspace()
    return { ok: true, message: 'XR scene placed at the current real-world reticle.', action: control.action, scene: inspectLocalXrSceneAssets() }
  }

  if (readXrPhysicsRuntime().phase !== 'stopped') {
    return { ok: false, message: 'Stop XR dynamics before editing the staged scene.' }
  }
  const previousMotion = readXrMotionReferenceRuntime()
  const previousPhysics = readXrPhysicsRuntime()
  let message = ''
  let subjectId = ''
  let physicsChanged = false
  if (control.action === 'stage') {
    const stage = XR_MOTION_REFERENCE_STAGE_PRESETS.find(candidate => candidate.id === control.stageId)
    if (!stage) return { ok: false, message: `Unknown XR environment: ${control.stageId || '(empty)'}.` }
    setXrMotionReferenceStage(stage.id as XrMotionReferenceStageId)
    message = `${stage.label} staged in XR Mode.`
  } else if (control.action === 'place') {
    if (!isXrSceneLibraryAssetId(control.assetId)) return { ok: false, message: `Unknown XR asset: ${control.assetId || '(empty)'}.` }
    const asset = XR_SCENE_LIBRARY_ASSETS.find(candidate => candidate.id === control.assetId)!
    const before = readXrMotionReferenceRuntime().plan.subjects.length
    const next = addXrMotionReferenceSubject({ assetId: asset.id, label: control.label })
    if (next.plan.subjects.length === before) return { ok: false, message: 'The bounded XR scene subject capacity has been reached.' }
    subjectId = next.plan.subjects.at(-1)?.id || ''
    if (asset.mobile && subjectId) setXrMotionReferenceCastTransition(subjectId, control.transition)
    message = `${next.plan.subjects.at(-1)?.label || asset.label} placed with ${asset.mobile ? control.transition : 'static'} path interpolation.`
  } else if (control.action === 'transition') {
    subjectId = control.subjectId
    if (!readXrMotionReferenceRuntime().plan.cast.some(track => track.actorId === subjectId)) {
      return { ok: false, message: `XR subject ${subjectId || '(empty)'} is not a markable cast track.` }
    }
    setXrMotionReferenceCastTransition(subjectId, control.transition)
    message = `XR subject path interpolation set to ${control.transition}.`
  } else if (control.action === 'label') {
    subjectId = control.subjectId
    if (!control.label) return { ok: false, message: 'XR subject labels must not be empty.' }
    if (!readXrMotionReferenceRuntime().plan.subjects.some(subject => subject.id === subjectId)) {
      return { ok: false, message: `Unknown XR subject: ${subjectId || '(empty)'}.` }
    }
    setXrMotionReferenceSubjectLabel(subjectId, control.label)
    message = `XR subject relabeled ${control.label}.`
  } else if (control.action === 'remove') {
    subjectId = control.subjectId
    const subject = readXrMotionReferenceRuntime().plan.subjects.find(candidate => candidate.id === subjectId)
    if (!subject) return { ok: false, message: `Unknown XR subject: ${subjectId || '(empty)'}.` }
    if (readXrPhysicsRuntime().world.bodies.some(body => body.subjectId === subjectId)) {
      detachXrPhysicsBody(subjectId)
      physicsChanged = true
    }
    removeXrMotionReferenceSubject(subjectId)
    message = `${subject.label} removed from the XR stage.`
  }

  if (!persistAndActivateXrScene(physicsChanged)) {
    restoreXrMotionReferenceRuntimeSnapshot(previousMotion)
    restoreXrPhysicsRuntimeSnapshot(previousPhysics)
    return { ok: false, message: 'The XR scene could not be written to graph metadata.' }
  }
  hydrateCanonicalXrPhysicsRuntime()
  return { ok: true, message, action: control.action, ...(subjectId ? { subjectId } : {}), scene: inspectLocalXrSceneAssets() }
}
