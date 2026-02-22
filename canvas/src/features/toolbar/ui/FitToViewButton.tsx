import React, { useCallback } from 'react';
import { Scan } from 'lucide-react';
import IconButton from '@/components/IconButton';
import { getIconSizeClass } from '@/lib/ui';
import { LS_KEYS, UI_COPY, UI_LABELS } from '@/lib/config';
import { useToolbarState } from '@/features/toolbar/hooks/useToolbarState';
import { useGraphStore } from '@/hooks/useGraphStore';
import { useShallow } from 'zustand/react/shallow'
import { lsBool } from '@/lib/persistence'

export const FitToViewButton = () => {
  const {
    uiIconScale,
    uiIconStrokeWidth,
  } = useToolbarState();
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

  const handleFitToView = useCallback(() => {
    const hasSelection =
      (Array.isArray(selectedNodeIds) && selectedNodeIds.length > 0)
      || (Array.isArray(selectedEdgeIds) && selectedEdgeIds.length > 0)
      || (Array.isArray(selectedGroupIds) && selectedGroupIds.length > 0)
      || !!selectedNodeId
      || !!selectedEdgeId
      || !!selectedGroupId
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
  }, [canvasRenderMode, requestThreeCamera, requestZoom, selectedNodeId, selectedEdgeId, selectedGroupId, selectedNodeIds, selectedEdgeIds, selectedGroupIds]);

  const iconSizeClass = getIconSizeClass(uiIconScale);

  return (
    <IconButton
      className="App-toolbar__btn"
      title={UI_LABELS.fitToView}
      tooltipContent={UI_COPY.fitToViewTooltip}
      onClick={handleFitToView}
      showTooltip
      disabled={canvasRenderMode !== '3d' && viewPinned}
    >
      <Scan className={iconSizeClass} strokeWidth={uiIconStrokeWidth} />
    </IconButton>
  );
};
