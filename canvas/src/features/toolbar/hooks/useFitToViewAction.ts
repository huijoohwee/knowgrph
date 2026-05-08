import React from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useGraphStore } from '@/hooks/useGraphStore'
import { LS_KEYS } from '@/lib/config'
import { lsBool } from '@/lib/persistence'

export function useFitToViewAction() {
  const {
    requestZoom,
    requestThreeCamera,
    canvasRenderMode,
    canvas2dRenderer,
    selectedNodeId,
    selectedEdgeId,
    selectedGroupId,
    selectedNodeIds,
    selectedEdgeIds,
    selectedGroupIds,
  } = useGraphStore(
    useShallow(s => ({
      requestZoom: s.requestZoom,
      requestThreeCamera: s.requestThreeCamera,
      canvasRenderMode: s.canvasRenderMode,
      canvas2dRenderer: s.canvas2dRenderer,
      selectedNodeId: s.selectedNodeId,
      selectedEdgeId: s.selectedEdgeId,
      selectedGroupId: s.selectedGroupId,
      selectedNodeIds: s.selectedNodeIds,
      selectedEdgeIds: s.selectedEdgeIds,
      selectedGroupIds: s.selectedGroupIds,
    })),
  )

  const disabled = false

  const handleFitToView = React.useCallback(() => {
    const flowEditor2dActive = canvas2dRenderer === 'flowEditor'
    if (flowEditor2dActive) {
      requestZoom('fit', { intent: 'fitToView' })
      return
    }

    const geospatialEnabled = (() => {
      try {
        return lsBool(LS_KEYS.geospatialOverlayEnabled, true)
      } catch {
        return false
      }
    })()

    const allowGeospatialFit = geospatialEnabled && canvasRenderMode !== '2d'
    if (allowGeospatialFit) {
      const hasSelection =
        (Array.isArray(selectedNodeIds) && selectedNodeIds.length > 0) ||
        (Array.isArray(selectedEdgeIds) && selectedEdgeIds.length > 0) ||
        (Array.isArray(selectedGroupIds) && selectedGroupIds.length > 0) ||
        !!selectedNodeId ||
        !!selectedEdgeId ||
        !!selectedGroupId
      void import('gympgrph')
        .then(m => {
          if (hasSelection && typeof m.requestGeospatialFitToSelection === 'function') {
            m.requestGeospatialFitToSelection()
            return
          }
          if (typeof m.requestGeospatialFitToData === 'function') {
            m.requestGeospatialFitToData()
            return
          }
          requestZoom('fit', { intent: 'fitToView' })
        })
        .catch(() => {
          requestZoom('fit', { intent: 'fitToView' })
        })
      return
    }

    if (canvasRenderMode === '3d') {
      requestThreeCamera('fit')
      return
    }
    requestZoom('fit', { intent: 'fitToView' })
  }, [
    canvas2dRenderer,
    canvasRenderMode,
    requestThreeCamera,
    requestZoom,
    selectedEdgeId,
    selectedEdgeIds,
    selectedGroupId,
    selectedGroupIds,
    selectedNodeId,
    selectedNodeIds,
  ])

  return { disabled, handleFitToView }
}
