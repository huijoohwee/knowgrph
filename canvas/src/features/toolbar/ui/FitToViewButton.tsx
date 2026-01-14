import React, { useCallback } from 'react';
import { Maximize, Scan } from 'lucide-react';
import IconButton from '@/components/IconButton';
import { getIconSizeClass } from '@/lib/ui';
import { UI_LABELS } from '@/lib/config';
import { useToolbarState } from '@/features/toolbar/hooks/useToolbarState';
import { useGraphStore } from '@/hooks/useGraphStore';
import {
  uiPrimaryIconActiveClassName,
  uiPrimaryIconInactiveClassName,
} from '@/features/graph-data-table/ui/GraphDataTableToolbarStyles';

export const FitToViewButton = () => {
  const {
    uiIconScale,
    uiIconStrokeWidth,
  } = useToolbarState();
  const requestZoom = useGraphStore(s => s.requestZoom);

  const handleFitToView = useCallback(() => {
    // "Fit to View" triggers a one-time zoom-to-fit calculation
    // This uses the same logic as the initial load auto-fit (fitAllTransform)
    // but triggered explicitly by the user.
    requestZoom('fit');
  }, [requestZoom]);

  const iconSizeClass = getIconSizeClass(uiIconScale);

  return (
    <IconButton
      className="App-toolbar__btn"
      title="Fit to View"
      tooltipContent="Fit to View: automatically scale and center the graph to fill the viewport."
      onClick={handleFitToView}
      showTooltip
    >
      <Scan className={iconSizeClass} strokeWidth={uiIconStrokeWidth} />
    </IconButton>
  );
};
