import React, { useCallback } from 'react';
import { Maximize } from 'lucide-react';
import IconButton from '@/components/IconButton';
import { getIconSizeClass } from '@/lib/ui';
import { UI_LABELS } from '@/lib/config';
import { useToolbarState } from '@/features/toolbar/hooks/useToolbarState';
import {
  uiPrimaryIconActiveClassName,
  uiPrimaryIconInactiveClassName,
} from '@/features/graph-data-table/ui/GraphDataTableToolbarStyles';

export const FitToScreenButton = () => {
  const {
    fitToScreenMode,
    toggleFitToScreenMode,
    setZoomToSelectionMode,
    setViewPinned,
    uiIconScale,
    uiIconStrokeWidth,
  } = useToolbarState();

  const handleToggleFitToScreen = useCallback(() => {
    const next = !fitToScreenMode;
    toggleFitToScreenMode();
    // When enabling Fit to Screen, we must disable Zoom to Selection to avoid conflict
    if (next) {
      setZoomToSelectionMode(false);
      setViewPinned(false);
    }
  }, [fitToScreenMode, toggleFitToScreenMode, setZoomToSelectionMode, setViewPinned]);

  const iconSizeClass = getIconSizeClass(uiIconScale);

  return (
    <IconButton
      className={`App-toolbar__btn ${
        fitToScreenMode ? uiPrimaryIconActiveClassName : uiPrimaryIconInactiveClassName
      }`}
      title={UI_LABELS.fitToScreen}
      tooltipContent="Fit to Screen mode: toggle to center the viewport on the full graph and clear Zoom to Selection until you turn it off."
      onClick={handleToggleFitToScreen}
      showTooltip
    >
      <Maximize className={iconSizeClass} strokeWidth={uiIconStrokeWidth} />
    </IconButton>
  );
};
