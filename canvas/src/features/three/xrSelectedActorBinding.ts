import { useGraphStore } from '@/hooks/useGraphStore'
import {
  readXrMotionReferenceRuntime,
  selectXrMotionReferenceActor,
  type XrMotionReferenceRuntimeSnapshot,
} from './xrMotionReferenceRuntime'

const cleanId = (value: unknown): string => String(value || '').trim()

export function readBoundXrSelectedActorId(): string {
  const runtime = readXrMotionReferenceRuntime()
  const selectedNodeId = cleanId(useGraphStore.getState().selectedNodeId)
  if (selectedNodeId && runtime.plan.cast.some(track => track.actorId === selectedNodeId)) return selectedNodeId
  return runtime.plan.cast.some(track => track.actorId === runtime.selectedActorId)
    ? runtime.selectedActorId
    : ''
}

export function selectBoundXrActor(actorIdValue: string): XrMotionReferenceRuntimeSnapshot {
  const actorId = cleanId(actorIdValue)
  const state = useGraphStore.getState()
  const runtime = selectXrMotionReferenceActor(actorId)
  if (!runtime.plan.cast.some(track => track.actorId === actorId)) return runtime
  const actorIsGraphNode = Boolean(state.graphData?.nodes?.some(node => cleanId(node.id) === actorId))
  if (actorIsGraphNode) {
    state.selectNode(actorId)
  } else if (cleanId(state.selectedNodeId)) {
    state.selectNode(null)
  }
  return runtime
}

export function synchronizeBoundXrActorFromGraphSelection(): XrMotionReferenceRuntimeSnapshot {
  const selectedNodeId = cleanId(useGraphStore.getState().selectedNodeId)
  const runtime = readXrMotionReferenceRuntime()
  return selectedNodeId && runtime.plan.cast.some(track => track.actorId === selectedNodeId)
    ? selectXrMotionReferenceActor(selectedNodeId)
    : runtime
}
