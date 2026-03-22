import React from 'react'
import { Focus, Maximize, Pin, Scan } from 'lucide-react'
import IconButton from '@/components/IconButton'
import { DropdownPanel } from '@/lib/ui/overlay'
import { UI_COPY, UI_LABELS } from '@/lib/config'
import { useShallow } from 'zustand/react/shallow'
import { useGraphStore } from '@/hooks/useGraphStore'
import { uiPrimaryChipActiveClassName, uiPrimaryIconActiveClassName, uiPrimaryIconInactiveClassName } from '@/features/toolbar/ui/toolbarStyles'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { useFitToViewAction } from '@/features/toolbar/hooks/useFitToViewAction'

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

const MENU_WIDTH_CLASS = 'w-64'

export function ZoomModeSelect({ iconSizeClass, iconStrokeWidth, onZoomSelection }: ZoomModeSelectProps) {
  const {
    viewPinned,
    toggleViewPinned,
    fitToScreenMode,
    toggleFitToScreenMode,
    zoomToSelectionMode,
    setZoomToSelectionMode,
  } = useGraphStore(
    useShallow(s => ({
      viewPinned: s.viewPinned === true,
      toggleViewPinned: s.toggleViewPinned,
      fitToScreenMode: s.fitToScreenMode === true,
      toggleFitToScreenMode: s.toggleFitToScreenMode,
      zoomToSelectionMode: s.zoomToSelectionMode === true,
      setZoomToSelectionMode: s.setZoomToSelectionMode,
    })),
  )

  const { disabled: fitToViewDisabled, handleFitToView } = useFitToViewAction()

  const [open, setOpen] = React.useState(false)
  const buttonRef = React.useRef<HTMLButtonElement>(null)

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

  return (
    <>
      <IconButton
        ref={buttonRef}
        className={`App-toolbar__btn ${open || anyActive ? uiPrimaryIconActiveClassName : uiPrimaryIconInactiveClassName}`}
        title={UI_LABELS.zoomMenu}
        tooltipContent={UI_COPY.zoomMenuTooltip}
        onClick={() => setOpen(v => !v)}
        showTooltip
      >
        <div className="flex items-center gap-1">
          <Focus className={iconSizeClass} strokeWidth={iconStrokeWidth} />
          <span className="text-xs">{UI_LABELS.zoomMenu}</span>
        </div>
      </IconButton>

      {open && (
        <DropdownPanel anchorRef={buttonRef} open={open} onClose={() => setOpen(false)} align="bottom-center">
          <menu
            className={`p-1 flex flex-col gap-1 ${MENU_WIDTH_CLASS} list-none m-0 ${UI_THEME_TOKENS.panel.bg} border ${UI_THEME_TOKENS.panel.border} rounded shadow-md`}
            aria-label="Zoom modes"
          >
            {options.map(option => {
              const active = isOptionActive(option.key)
              const disabled = isOptionDisabled(option.key)
              return (
                <li key={option.key} className="list-none">
                  <button
                    type="button"
                    disabled={disabled}
                    className={`w-full flex items-center gap-2 rounded px-2 py-1 text-sm ${UI_THEME_TOKENS.text.primary} hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed ${
                      active ? uiPrimaryChipActiveClassName : ''
                    }`}
                    onClick={() => {
                      apply(option.key)
                      setOpen(false)
                    }}
                    title={option.tooltip}
                  >
                    <option.Icon className={iconSizeClass} strokeWidth={iconStrokeWidth} />
                    <span className="truncate">{option.label}</span>
                  </button>
                </li>
              )
            })}
          </menu>
        </DropdownPanel>
      )}
    </>
  )
}
