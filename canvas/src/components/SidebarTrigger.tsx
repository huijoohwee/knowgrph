import React from 'react';
import { useGraphStore } from '@/hooks/useGraphStore';
import { useShallow } from 'zustand/react/shallow';
import { UI_LABELS } from '@/lib/config';
import IconButton from '@/components/IconButton';
import { getIconSizeClass } from '@/lib/ui';

interface SidebarTriggerProps {
  className?: string;
}

const SidebarTrigger = React.forwardRef<HTMLButtonElement, SidebarTriggerProps>(({ className = '' }, ref) => {
  const { toggleSidebar, uiIconScale, uiIconStrokeWidth } = useGraphStore(
    useShallow(s => ({
      toggleSidebar: s.toggleSidebar,
      uiIconScale: s.uiIconScale,
      uiIconStrokeWidth: s.uiIconStrokeWidth,
    })),
  );
  const iconSizeClass = getIconSizeClass(uiIconScale);

  return (
    <IconButton
      ref={ref}
      title={UI_LABELS.sidebar}
      onClick={toggleSidebar}
      className={`App-toolbar__btn ${className}`}
      showTooltip
    >
      <svg
        aria-hidden="true"
        focusable="false"
        role="img"
        viewBox="0 0 24 24"
        className={iconSizeClass}
        fill="none"
        strokeWidth={uiIconStrokeWidth}
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
        <path d="M4 4m0 2a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2z"></path>
        <path d="M15 4l0 16"></path>
      </svg>
    </IconButton>
  );
});

export default SidebarTrigger;
