import React from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useGraphStore } from '@/hooks/useGraphStore'
import { resetCameraFramingRuntimeForDocument } from '@/features/strybldr/cameraFramingRuntime'
import {
  sampleXrMotionReferenceFacingY,
  sampleXrMotionReferenceMarks,
  xrMotionReferenceSceneKey,
} from './xrMotionReferenceModel'
import { hydrateXrMotionReferenceRuntime, readXrMotionReferenceRuntime } from './xrMotionReferenceRuntime'
import {
  XR_PHYSICS_GRAPH_METADATA_KEY,
} from './xrPhysicsModel'
import { hydrateXrPhysicsRuntime } from './xrPhysicsRuntime'
import { synchronizeBoundXrActorFromGraphSelection } from './xrSelectedActorBinding'
import { resolveXrMotionReferencePersistedValue } from './xrMotionReferencePersistedValue'
import { resolveXrSubjectFootprint } from './xrMotionReferenceSubjectPlacement'
import { resolveXrCanonicalSceneSpatialSource } from './xrCanonicalSceneSpatialSource'

const useIsomorphicLayoutEffect = typeof window === 'undefined' ? React.useEffect : React.useLayoutEffect

function physicsMotionSourceSignature(
  sceneKey: string,
  nodes: readonly Readonly<{ id?: unknown; label?: unknown }>[],
  plan: ReturnType<typeof readXrMotionReferenceRuntime>['plan'],
): string {
  return JSON.stringify({
    sceneKey,
    nodes: nodes.map(node => [node.id, node.label]),
    stageId: plan.stageId,
    durationSeconds: plan.durationSeconds,
    subjects: plan.subjects.map(subject => [
      subject.id,
      subject.assetId,
      subject.position,
      subject.rotationYDegrees,
      subject.scale,
    ]),
    cast: plan.cast.map(track => [
      track.actorId,
      track.marks.map(mark => [mark.timeSeconds, mark.position]),
    ]),
  })
}

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
    persistedValue: resolveXrMotionReferencePersistedValue(graphData?.metadata),
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
  const spatialSource = resolveXrCanonicalSceneSpatialSource({
    projection: 'authored',
    stageId: motion.plan.stageId,
  })
  const subjects = motion.plan.subjects.map(subject => {
    const track = motion.plan.cast.find(candidate => candidate.actorId === subject.id)
    const position = track ? sampleXrMotionReferenceMarks(track.marks, motion.playheadSeconds) : subject.position
    const facingYRadians = track ? sampleXrMotionReferenceFacingY(track.marks, motion.playheadSeconds) : 0
    return {
      subjectId: subject.id,
      position,
      sizeMeters: resolveXrSubjectFootprint(subject, facingYRadians).sizeMeters,
    }
  })
  hydrateXrPhysicsRuntime({
    sceneKey: motion.sceneKey,
    sourceSignature: physicsMotionSourceSignature(motion.sceneKey, state.graphData?.nodes || [], motion.plan),
    persistedValue: documentReady ? state.graphData?.metadata?.[XR_PHYSICS_GRAPH_METADATA_KEY] : null,
    subjects,
    staticColliders: spatialSource.staticColliders,
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
  const persistedValue = resolveXrMotionReferencePersistedValue(graphData?.metadata)
  const persistedPhysicsValue = graphData?.metadata?.[XR_PHYSICS_GRAPH_METADATA_KEY]

  useIsomorphicLayoutEffect(() => {
    const documentReady = hydrateCanonicalXrMotionReferenceRuntime()
    hydrateCanonicalXrPhysicsRuntime()
    if (documentReady) synchronizeBoundXrActorFromGraphSelection()
  }, [graphData?.nodes, markdownDocumentName, markdownDocumentText, persistedPhysicsValue, persistedValue, selectedNodeId])

  return null
}
