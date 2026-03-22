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
    viewPinned,
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
      viewPinned: s.viewPinned === true,
      selectedNodeId: s.selectedNodeId,
      selectedEdgeId: s.selectedEdgeId,
      selectedGroupId: s.selectedGroupId,
      selectedNodeIds: s.selectedNodeIds,
      selectedEdgeIds: s.selectedEdgeIds,
      selectedGroupIds: s.selectedGroupIds,
    })),
  )

  const disabled = canvasRenderMode !== '3d' && viewPinned

  const handleFitToView = React.useCallback(() => {
    const hasSelection =
      (Array.isArray(selectedNodeIds) && selectedNodeIds.length > 0) ||
      (Array.isArray(selectedEdgeIds) && selectedEdgeIds.length > 0) ||
      (Array.isArray(selectedGroupIds) && selectedGroupIds.length > 0) ||
      !!selectedNodeId ||
      !!selectedEdgeId ||
      !!selectedGroupId

    const geospatialEnabled = (() => {
      try {
        return lsBool(LS_KEYS.geospatialOverlayEnabled, false)
      } catch {
        return false
      }
    })()

    if (geospatialEnabled) {
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
      requestThreeCamera(hasSelection ? 'selection' : 'fit')
      return
    }
    if (hasSelection) {
      requestZoom('selection')
      return
    }
    requestZoom('fit', { intent: 'fitToView' })
  }, [
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

