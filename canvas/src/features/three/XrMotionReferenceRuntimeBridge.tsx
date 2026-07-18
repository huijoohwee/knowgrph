import React from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useGraphStore } from '@/hooks/useGraphStore'
import { resetCameraFramingRuntimeForDocument } from '@/features/strybldr/cameraFramingRuntime'
import {
  XR_MOTION_REFERENCE_GRAPH_METADATA_KEY,
  resolveXrMotionReferenceStage,
  xrMotionReferenceSceneKey,
} from './xrMotionReferenceModel'
import { hydrateXrMotionReferenceRuntime, readXrMotionReferenceRuntime } from './xrMotionReferenceRuntime'
import { resolveXrSceneLibraryAsset } from './xrSceneLibrary'
import {
  XR_PHYSICS_GRAPH_METADATA_KEY,
  buildXrPhysicsStructureColliders,
} from './xrPhysicsModel'
import { hydrateXrPhysicsRuntime } from './xrPhysicsRuntime'
import { synchronizeBoundXrActorFromGraphSelection } from './xrSelectedActorBinding'

const useIsomorphicLayoutEffect = typeof window === 'undefined' ? React.useEffect : React.useLayoutEffect

export function hydrateCanonicalXrMotionReferenceRuntime(): boolean {
  const state = useGraphStore.getState()
  const documentReady = Boolean(
    state.graphData
    && String(state.markdownDocumentName || '').trim()
    && String(state.markdownDocumentText || '').trim(),
  )
  const graphData = documentReady ? state.graphData : null
  const sceneKey = documentReady
    ? xrMotionReferenceSceneKey(state.markdownDocumentName || 'Untitled', graphData)
    : '__knowgrph:no-document__'
  resetCameraFramingRuntimeForDocument(sceneKey)
  hydrateXrMotionReferenceRuntime({
    sceneKey,
    nodes: graphData?.nodes || [],
    persistedValue: graphData?.metadata?.[XR_MOTION_REFERENCE_GRAPH_METADATA_KEY],
  })
  return documentReady
}

export function hydrateCanonicalXrPhysicsRuntime(): boolean {
  const state = useGraphStore.getState()
  const documentReady = Boolean(
    state.graphData
    && String(state.markdownDocumentName || '').trim()
    && String(state.markdownDocumentText || '').trim(),
  )
  const motion = readXrMotionReferenceRuntime()
  const subjects = motion.plan.subjects.map(subject => {
    const asset = resolveXrSceneLibraryAsset(subject.assetId)
    const track = motion.plan.cast.find(candidate => candidate.actorId === subject.id)
    const position = track?.marks[0]?.position || subject.position
    return {
      subjectId: subject.id,
      position,
      sizeMeters: asset.dimensionsMeters.map(value => value * subject.scale) as [number, number, number],
    }
  })
  hydrateXrPhysicsRuntime({
    sceneKey: motion.sceneKey,
    persistedValue: documentReady ? state.graphData?.metadata?.[XR_PHYSICS_GRAPH_METADATA_KEY] : null,
    subjects,
    staticColliders: buildXrPhysicsStructureColliders(resolveXrMotionReferenceStage(motion.plan.stageId).structures),
  })
  return documentReady
}

export function XrMotionReferenceRuntimeBridge() {
  const { graphData, markdownDocumentName, markdownDocumentText, selectedNodeId } = useGraphStore(useShallow(state => ({
    graphData: state.graphData,
    markdownDocumentName: state.markdownDocumentName,
    markdownDocumentText: state.markdownDocumentText,
    selectedNodeId: state.selectedNodeId,
  })))
  const persistedValue = graphData?.metadata?.[XR_MOTION_REFERENCE_GRAPH_METADATA_KEY]
  const persistedPhysicsValue = graphData?.metadata?.[XR_PHYSICS_GRAPH_METADATA_KEY]

  useIsomorphicLayoutEffect(() => {
    const documentReady = hydrateCanonicalXrMotionReferenceRuntime()
    hydrateCanonicalXrPhysicsRuntime()
    if (documentReady) synchronizeBoundXrActorFromGraphSelection()
  }, [graphData?.nodes, markdownDocumentName, markdownDocumentText, persistedPhysicsValue, persistedValue, selectedNodeId])

  return null
}
