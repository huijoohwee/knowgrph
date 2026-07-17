import React from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useGraphStore } from '@/hooks/useGraphStore'
import { resetCameraFramingRuntimeForDocument } from '@/features/strybldr/cameraFramingRuntime'
import {
  XR_MOTION_REFERENCE_GRAPH_METADATA_KEY,
  xrMotionReferenceSceneKey,
} from './xrMotionReferenceModel'
import { hydrateXrMotionReferenceRuntime } from './xrMotionReferenceRuntime'
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

export function XrMotionReferenceRuntimeBridge() {
  const { graphData, markdownDocumentName, markdownDocumentText, selectedNodeId } = useGraphStore(useShallow(state => ({
    graphData: state.graphData,
    markdownDocumentName: state.markdownDocumentName,
    markdownDocumentText: state.markdownDocumentText,
    selectedNodeId: state.selectedNodeId,
  })))
  const persistedValue = graphData?.metadata?.[XR_MOTION_REFERENCE_GRAPH_METADATA_KEY]

  useIsomorphicLayoutEffect(() => {
    if (hydrateCanonicalXrMotionReferenceRuntime()) synchronizeBoundXrActorFromGraphSelection()
  }, [graphData?.nodes, markdownDocumentName, markdownDocumentText, persistedValue, selectedNodeId])

  return null
}
