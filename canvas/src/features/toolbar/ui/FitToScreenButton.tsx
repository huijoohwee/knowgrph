import React, { useCallback } from 'react';
import { Maximize } from 'lucide-react';
import IconButton from '@/components/IconButton';
import { getIconSizeClass } from '@/lib/ui';
import { UI_COPY, UI_LABELS } from '@/lib/config';
import { useToolbarState } from '@/features/toolbar/hooks/useToolbarState';
import {
  uiPrimaryIconActiveClassName,
  uiPrimaryIconInactiveClassName,
} from '@/features/graph-data-table/ui/GraphDataTableToolbarStyles';

export const FitToScreenButton = () => {
  const {
    fitToScreenMode,
    toggleFitToScreenMode,
    uiIconScale,
    uiIconStrokeWidth,
  } = useToolbarState();

  const handleToggleFitToScreen = useCallback(() => {
    toggleFitToScreenMode();
  }, [toggleFitToScreenMode]);

  const iconSizeClass = getIconSizeClass(uiIconScale);

  return (
    <IconButton
      className={`App-toolbar__btn ${
        fitToScreenMode ? uiPrimaryIconActiveClassName : uiPrimaryIconInactiveClassName
      }`}
      title={UI_LABELS.fitToScreen}
      tooltipContent={UI_COPY.fitToScreenTooltip}
      onClick={handleToggleFitToScreen}
      showTooltip
    >
      <Maximize className={iconSizeClass} strokeWidth={uiIconStrokeWidth} />
    </IconButton>
  );
};
