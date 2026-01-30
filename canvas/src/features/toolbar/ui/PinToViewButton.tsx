import React, { useCallback } from 'react';
import { Pin } from 'lucide-react';
import IconButton from '@/components/IconButton';
import { getIconSizeClass } from '@/lib/ui';
import { UI_COPY, UI_LABELS } from '@/lib/config';
import { useToolbarState } from '@/features/toolbar/hooks/useToolbarState';
import {
  uiPrimaryIconActiveClassName,
  uiPrimaryIconInactiveClassName,
} from '@/features/graph-data-table/ui/GraphDataTableToolbarStyles';

export const PinToViewButton = () => {
  const {
    viewPinned,
    setViewPinned,
    uiIconScale,
    uiIconStrokeWidth,
  } = useToolbarState();

  const handleTogglePinned = useCallback(() => {
    setViewPinned(!viewPinned);
  }, [viewPinned, setViewPinned]);

  const iconSizeClass = getIconSizeClass(uiIconScale);

  return (
    <IconButton
      className={`App-toolbar__btn ${viewPinned ? uiPrimaryIconActiveClassName : uiPrimaryIconInactiveClassName}`}
      title={UI_LABELS.pinToView}
      tooltipContent={UI_COPY.pinToViewTooltip}
      onClick={handleTogglePinned}
      showTooltip
    >
      <Pin className={iconSizeClass} strokeWidth={uiIconStrokeWidth} />
    </IconButton>
  );
};
