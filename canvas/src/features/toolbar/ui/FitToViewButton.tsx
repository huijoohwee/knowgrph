import React from 'react';
import { Scan } from 'lucide-react';
import IconButton from '@/components/IconButton';
import { getIconSizeClass } from '@/lib/ui';
import { UI_COPY, UI_LABELS } from '@/lib/config';
import { useToolbarState } from '@/features/toolbar/hooks/useToolbarState';
import { useFitToViewAction } from '@/features/toolbar/hooks/useFitToViewAction'

export const FitToViewButton = () => {
  const {
    uiIconScale,
    uiIconStrokeWidth,
  } = useToolbarState();
  const { disabled, handleFitToView } = useFitToViewAction()

  const iconSizeClass = getIconSizeClass(uiIconScale);

  return (
    <IconButton
      className="App-toolbar__btn"
      title={UI_LABELS.fitToView}
      tooltipContent={UI_COPY.fitToViewTooltip}
      onClick={handleFitToView}
      showTooltip
      disabled={disabled}
    >
      <Scan className={iconSizeClass} strokeWidth={uiIconStrokeWidth} />
    </IconButton>
  );
};
