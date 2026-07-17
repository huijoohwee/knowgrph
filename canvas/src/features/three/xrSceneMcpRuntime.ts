import { activateCanvasGraphSurfaceMode } from '@/lib/canvas/canvas3dMode'
import { useGraphStore } from '@/hooks/useGraphStore'
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
  setXrMotionReferenceCastTransition,
  setXrMotionReferenceStage,
  setXrMotionReferenceSubjectLabel,
} from './xrMotionReferenceRuntime'
import { hydrateCanonicalXrMotionReferenceRuntime } from './XrMotionReferenceRuntimeBridge'
import {
  XR_SCENE_INVOCATION_COMMANDS,
  XR_SCENE_MCP_SCHEMA,
  XR_SCENE_WEB_MCP_TOOL_IDS,
  buildXrPlaceInvocation,
  buildXrStageInvocation,
} from './xrSceneMcpContract.mjs'

export type XrSceneTransition = XrMotionReferenceTransition
export type XrSceneControlAction = 'stage' | 'place' | 'transition' | 'label' | 'remove'

export type XrSceneControlInput = Readonly<{
  invocation?: string
  action?: XrSceneControlAction
  stageId?: string
  assetId?: string
  subjectId?: string
  label?: string
  transition?: XrSceneTransition
}>

type NormalizedXrSceneControl = Readonly<{
  action: XrSceneControlAction
  stageId: string
  assetId: string
  subjectId: string
  label: string
  transition: XrSceneTransition
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
  const label = String(pairs.label || '').trim().slice(0, 80)
  if (action === 'stage') return { action, stageId: target, invocation, transition }
  if (action === 'place') return { action, assetId: target, invocation, transition, label }
  return { action, subjectId: target, invocation, transition, label }
}

function normalizeXrSceneControl(input: XrSceneControlInput): NormalizedXrSceneControl | null {
  const invocation = String(input.invocation || '').trim()
  const parsed = parseXrSceneInvocation(invocation)
  if (invocation && !parsed) return null
  const action = (parsed?.action || input.action) as XrSceneControlAction | undefined
  if (!action || !['stage', 'place', 'transition', 'label', 'remove'].includes(action)) return null
  const transition = asTransition(parsed?.transition ?? input.transition)
  if (!transition) return null
  return {
    action,
    stageId: cleanTarget(parsed?.stageId || input.stageId),
    assetId: cleanTarget(parsed?.assetId || input.assetId),
    subjectId: cleanTarget(parsed?.subjectId || input.subjectId),
    label: String(parsed?.label || input.label || '').trim().slice(0, 80),
    transition,
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
  return sceneDocumentReady() && hydrateCanonicalXrMotionReferenceRuntime()
}

function persistAndActivateXrScene(): boolean {
  const state = useGraphStore.getState()
  const serialized = serializeXrMotionReferencePlan(readXrMotionReferenceRuntime().plan)
  state.updateGraphMetadata({ [XR_MOTION_REFERENCE_GRAPH_METADATA_KEY]: serialized })
  const savedValue = useGraphStore.getState().graphData?.metadata?.[XR_MOTION_REFERENCE_GRAPH_METADATA_KEY]
  if (savedValue !== serialized) return false
  markXrMotionReferenceSaved(serialized)
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
  return true
}

export function inspectLocalXrSceneAssets() {
  const runtime = readXrMotionReferenceRuntime()
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
        const transition: XrSceneTransition | 'static' = track ? track.marks[0]?.transition || 'linear' : 'static'
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
  }
}

export function controlLocalXrScene(input: XrSceneControlInput): XrSceneControlResult {
  const control = normalizeXrSceneControl(input)
  if (!control) return { ok: false, message: 'Use a supported XR action or an invocation such as /xr.place @person-adult transition=linear.' }
  if (!hydrateActiveXrScene()) return { ok: false, message: 'Open or create a graph document before controlling the XR scene.' }

  let message = ''
  let subjectId = ''
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
  } else {
    subjectId = control.subjectId
    const subject = readXrMotionReferenceRuntime().plan.subjects.find(candidate => candidate.id === subjectId)
    if (!subject) return { ok: false, message: `Unknown XR subject: ${subjectId || '(empty)'}.` }
    removeXrMotionReferenceSubject(subjectId)
    message = `${subject.label} removed from the XR stage.`
  }

  if (!persistAndActivateXrScene()) return { ok: false, message: 'The XR scene could not be written to graph metadata.' }
  return { ok: true, message, action: control.action, ...(subjectId ? { subjectId } : {}), scene: inspectLocalXrSceneAssets() }
}
