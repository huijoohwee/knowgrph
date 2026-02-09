import React, { useCallback } from 'react';
import { Scan } from 'lucide-react';
import IconButton from '@/components/IconButton';
import { getIconSizeClass } from '@/lib/ui';
import { UI_COPY, UI_LABELS } from '@/lib/config';
import { useToolbarState } from '@/features/toolbar/hooks/useToolbarState';
import { useGraphStore } from '@/hooks/useGraphStore';
import { useShallow } from 'zustand/react/shallow'

export const FitToViewButton = () => {
  const {
    uiIconScale,
    uiIconStrokeWidth,
  } = useToolbarState();
  const { requestZoom, requestThreeCamera, canvasRenderMode, viewPinned } = useGraphStore(
    useShallow(s => ({
      requestZoom: s.requestZoom,
      requestThreeCamera: s.requestThreeCamera,
      canvasRenderMode: s.canvasRenderMode,
      viewPinned: s.viewPinned === true,
    })),
  )

  const handleFitToView = useCallback(() => {
    if (canvasRenderMode === '3d') {
      requestThreeCamera('fit')
      return
    }
    requestZoom('fit', { intent: 'fitToView' })
  }, [canvasRenderMode, requestThreeCamera, requestZoom]);

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
