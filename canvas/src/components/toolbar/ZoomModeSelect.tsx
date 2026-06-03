import React from 'react'
import { Focus, Maximize, Pin, Scan } from 'lucide-react'
import { UI_COPY, UI_LABELS } from '@/lib/config'
import { useShallow } from 'zustand/react/shallow'
import { useGraphStore } from '@/hooks/useGraphStore'
import { useFitToViewAction } from '@/features/toolbar/hooks/useFitToViewAction'
import { ToolbarDropdownSelect } from '@/components/toolbar/ToolbarDropdownSelect'
import { UI_RESPONSIVE_COMPACT_TOOLBAR_DROPDOWN_WIDTH_CLASSNAME } from '@/lib/ui/responsiveElementClasses'

type ZoomModeSelectProps = {
  iconSizeClass: string
  iconStrokeWidth: number
  onZoomSelection?: () => void
}

type ZoomOption = {
  key: 'pin' | 'fitToView' | 'fitToScreen' | 'zoomToSelection'
  label: string
  tooltip: string
  Icon: React.ComponentType<{ className?: string; strokeWidth?: number | string }>
}

export function ZoomModeSelect({ iconSizeClass, iconStrokeWidth, onZoomSelection }: ZoomModeSelectProps) {
  const {
    viewPinned,
    toggleViewPinned,
    fitToScreenMode,
    toggleFitToScreenMode,
    zoomToSelectionMode,
    setZoomToSelectionMode,
    pushUiToast,
  } = useGraphStore(
    useShallow(s => ({
      viewPinned: s.viewPinned === true,
      toggleViewPinned: s.toggleViewPinned,
      fitToScreenMode: s.fitToScreenMode === true,
      toggleFitToScreenMode: s.toggleFitToScreenMode,
      zoomToSelectionMode: s.zoomToSelectionMode === true,
      setZoomToSelectionMode: s.setZoomToSelectionMode,
      pushUiToast: s.pushUiToast,
    })),
  )

  const { disabled: fitToViewDisabled, handleFitToView } = useFitToViewAction()

  const options = React.useMemo(
    () =>
      [
        {
          key: 'pin' as const,
          label: UI_LABELS.pinToView,
          tooltip: UI_COPY.pinToViewTooltip,
          Icon: Pin,
        },
        {
          key: 'fitToView' as const,
          label: UI_LABELS.fitToView,
          tooltip: UI_COPY.fitToViewTooltip,
          Icon: Scan,
        },
        {
          key: 'fitToScreen' as const,
          label: UI_LABELS.fitToScreen,
          tooltip: UI_COPY.fitToScreenTooltip,
          Icon: Maximize,
        },
        {
          key: 'zoomToSelection' as const,
          label: UI_LABELS.zoomToSelection,
          tooltip: UI_COPY.zoomToSelectionTooltip,
          Icon: Focus,
        },
      ] satisfies ZoomOption[],
    [],
  )

  const anyActive = viewPinned || fitToScreenMode || zoomToSelectionMode

  const apply = React.useCallback(
    (key: ZoomOption['key']) => {
      if (key === 'pin') {
        toggleViewPinned()
        return
      }
      if (key === 'fitToView') {
        if (!fitToViewDisabled) handleFitToView()
        return
      }
      if (key === 'fitToScreen') {
        toggleFitToScreenMode()
        return
      }
      const next = !zoomToSelectionMode
      setZoomToSelectionMode(next)
      if (next && onZoomSelection) onZoomSelection()
    },
    [fitToViewDisabled, handleFitToView, onZoomSelection, setZoomToSelectionMode, toggleFitToScreenMode, toggleViewPinned, zoomToSelectionMode],
  )

  const isOptionActive = React.useCallback(
    (key: ZoomOption['key']) => {
      if (key === 'pin') return viewPinned
      if (key === 'fitToScreen') return fitToScreenMode
      if (key === 'zoomToSelection') return zoomToSelectionMode
      return false
    },
    [fitToScreenMode, viewPinned, zoomToSelectionMode],
  )

  const isOptionDisabled = React.useCallback(
    (key: ZoomOption['key']) => {
      if (key === 'fitToView') return fitToViewDisabled
      return false
    },
    [fitToViewDisabled],
  )
  const selectedOptionKey: ZoomOption['key'] =
    viewPinned ? 'pin' : fitToScreenMode ? 'fitToScreen' : zoomToSelectionMode ? 'zoomToSelection' : 'fitToView'

  const handleSelectComplete = React.useCallback(
    (key: ZoomOption['key']) => {
      const message =
        key === 'pin'
          ? `Zoom: ${viewPinned ? 'Pin to View off' : 'Pin to View on'}`
          : key === 'fitToView'
          ? 'Zoom: Fit to View'
          : key === 'fitToScreen'
          ? `Zoom: ${fitToScreenMode ? 'Fit to Screen off' : 'Fit to Screen on'}`
          : `Zoom: ${zoomToSelectionMode ? 'Zoom to Selection off' : 'Zoom to Selection on'}`
      pushUiToast({ id: 'toolbar-zoom-mode', kind: 'neutral', message, ttlMs: 1400 })
    },
    [fitToScreenMode, pushUiToast, viewPinned, zoomToSelectionMode],
  )

  return (
    <ToolbarDropdownSelect
      value={selectedOptionKey}
      options={options.map(option => ({
        id: option.key,
        title: option.label,
        tooltip: option.tooltip,
        Icon: option.Icon,
        disabled: isOptionDisabled(option.key),
        disabledReason: isOptionDisabled(option.key) ? 'Unavailable in current view mode' : undefined,
        enableHint: isOptionDisabled(option.key) ? 'Switch back to graph viewport state, then retry' : undefined,
      }))}
      title={UI_LABELS.zoomMenu}
      tooltipContent={UI_COPY.zoomMenuTooltip}
      isButtonActive={anyActive}
      onSelect={id => apply(id)}
      onSelectComplete={id => handleSelectComplete(id)}
      renderButtonContent={() => <Focus className={iconSizeClass} strokeWidth={iconStrokeWidth} />}
      renderOptionContent={option => (
        <>
          <option.Icon className={iconSizeClass} strokeWidth={iconStrokeWidth} />
          <span className="truncate">{option.title}</span>
          {isOptionActive(option.id) ? <span className="ml-auto text-[10px] opacity-80">On</span> : null}
        </>
      )}
      menuWidthClass={UI_RESPONSIVE_COMPACT_TOOLBAR_DROPDOWN_WIDTH_CLASSNAME}
    />
  )
}
