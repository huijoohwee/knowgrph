import { activateCanvasGraphSurfaceMode } from '@/lib/canvas/canvas3dMode'
import { useGraphStore } from '@/hooks/useGraphStore'
import {
  XR_MOTION_REFERENCE_GRAPH_METADATA_KEY,
  serializeXrMotionReferencePlan,
  xrMotionReferenceSceneKey,
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
  hydrateXrMotionReferenceRuntime,
  markXrMotionReferenceSaved,
  readXrMotionReferenceRuntime,
  removeXrMotionReferenceSubject,
  setXrMotionReferenceCastMotion,
  setXrMotionReferenceStage,
  setXrMotionReferenceSubjectLabel,
} from './xrMotionReferenceRuntime'
import {
  XR_SCENE_INVOCATION_COMMANDS,
  XR_SCENE_MCP_SCHEMA,
  XR_SCENE_WEB_MCP_TOOL_IDS,
  buildXrAnimateInvocation,
  buildXrPlaceInvocation,
  buildXrStageInvocation,
} from './xrSceneMcpContract.mjs'

export type XrSceneAnimation = 'travel' | 'hold'
export type XrSceneControlAction = 'stage' | 'place' | 'animate' | 'label' | 'remove'

export type XrSceneControlInput = Readonly<{
  invocation?: string
  action?: XrSceneControlAction
  stageId?: string
  assetId?: string
  subjectId?: string
  label?: string
  motion?: XrSceneAnimation
}>

type NormalizedXrSceneControl = Readonly<{
  action: XrSceneControlAction
  stageId: string
  assetId: string
  subjectId: string
  label: string
  motion: XrSceneAnimation
  invocation: string
}>

export type XrSceneControlResult = Readonly<{
  ok: boolean
  message: string
  action?: XrSceneControlAction
  subjectId?: string
  scene?: ReturnType<typeof inspectLocalXrSceneAssets>
}>

const asMotion = (value: unknown): XrSceneAnimation => String(value || '').trim().replace(/^#+/, '') === 'hold' ? 'hold' : 'travel'
const asTransition = (motion: XrSceneAnimation): XrMotionReferenceTransition => motion === 'hold' ? 'hold' : 'linear'
const cleanTarget = (value: unknown): string => String(value || '').trim().replace(/^@+/, '')

function parseXrSceneInvocation(invocationValue: unknown): Partial<NormalizedXrSceneControl> | null {
  const invocation = String(invocationValue || '').trim()
  if (!invocation) return null
  const tokens = invocation.split(/\s+/).filter(Boolean)
  const command = tokens[0]
  const target = cleanTarget(tokens.find(token => token.startsWith('@')) || '')
  const motion = asMotion(tokens.find(token => token === '#hold' || token === '#travel'))
  if (command === XR_SCENE_INVOCATION_COMMANDS.stage) return { action: 'stage', stageId: target, invocation, motion }
  if (command === XR_SCENE_INVOCATION_COMMANDS.place) return { action: 'place', assetId: target, invocation, motion }
  if (command === XR_SCENE_INVOCATION_COMMANDS.animate) return { action: 'animate', subjectId: target, invocation, motion }
  if (command === XR_SCENE_INVOCATION_COMMANDS.label) return { action: 'label', subjectId: target, invocation, motion }
  if (command === XR_SCENE_INVOCATION_COMMANDS.remove) return { action: 'remove', subjectId: target, invocation, motion }
  return null
}

function normalizeXrSceneControl(input: XrSceneControlInput): NormalizedXrSceneControl | null {
  const parsed = parseXrSceneInvocation(input.invocation)
  const action = (parsed?.action || input.action) as XrSceneControlAction | undefined
  if (!action || !['stage', 'place', 'animate', 'label', 'remove'].includes(action)) return null
  return {
    action,
    stageId: cleanTarget(parsed?.stageId || input.stageId),
    assetId: cleanTarget(parsed?.assetId || input.assetId),
    subjectId: cleanTarget(parsed?.subjectId || input.subjectId),
    label: String(input.label || '').trim().slice(0, 80),
    motion: asMotion(parsed?.motion || input.motion),
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
  const state = useGraphStore.getState()
  if (!sceneDocumentReady() || !state.graphData) return false
  hydrateXrMotionReferenceRuntime({
    sceneKey: xrMotionReferenceSceneKey(state.markdownDocumentName || 'Untitled', state.graphData),
    nodes: state.graphData.nodes,
    persistedValue: state.graphData.metadata?.[XR_MOTION_REFERENCE_GRAPH_METADATA_KEY],
  })
  return true
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
      place: `${XR_SCENE_INVOCATION_COMMANDS.place} @asset #travel|#hold`,
      animate: `${XR_SCENE_INVOCATION_COMMANDS.animate} @subject #travel|#hold`,
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
      invocation: buildXrPlaceInvocation(asset.id, asset.mobile ? 'travel' : 'hold'),
    })),
    runtime: {
      stageId: runtime.plan.stageId,
      durationSeconds: runtime.plan.durationSeconds,
      fps: runtime.plan.fps,
      subjects: runtime.plan.subjects.map(subject => {
        const track = runtime.plan.cast.find(candidate => candidate.actorId === subject.id)
        const motion: XrSceneAnimation | 'static' = track ? (track.marks[0]?.transition === 'hold' ? 'hold' : 'travel') : 'static'
        return {
          id: subject.id,
          assetId: subject.assetId,
          label: subject.label,
          category: subject.category,
          position: [...subject.position],
          motion,
          invocation: track ? buildXrAnimateInvocation(subject.id, motion) : '',
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
  if (!control) return { ok: false, message: 'Use a supported XR action or invocation such as /xr.place @person-adult #travel.' }
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
    if (asset.mobile && subjectId) setXrMotionReferenceCastMotion(subjectId, asTransition(control.motion))
    message = `${next.plan.subjects.at(-1)?.label || asset.label} placed with ${asset.mobile ? control.motion : 'static'} motion.`
  } else if (control.action === 'animate') {
    subjectId = control.subjectId
    if (!readXrMotionReferenceRuntime().plan.cast.some(track => track.actorId === subjectId)) {
      return { ok: false, message: `XR subject ${subjectId || '(empty)'} is not a markable cast track.` }
    }
    setXrMotionReferenceCastMotion(subjectId, asTransition(control.motion))
    message = `XR subject animation set to ${control.motion}.`
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

