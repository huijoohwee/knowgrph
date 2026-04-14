import IconButton from '@/components/IconButton'
import { Search as SearchIcon, X as CloseIcon, Save as SaveIcon, RotateCcw as ResetIcon, Minimize2, Maximize2, Pin, PinOff } from 'lucide-react'
import { UI_COPY, UI_LABELS } from '@/lib/config'
import { useGraphStore } from '@/hooks/useGraphStore'
import { getIconSizeClass, getPinToggleButtonClassName } from '@/lib/ui'

interface HeaderActionsProps {
  onSearchToggle?: () => void
  onApply?: () => void
  onReset?: () => void
  onMinimize?: () => void
  onRestore?: () => void
  onPinToggle?: () => void
  pinned?: boolean
  onClose?: () => void
  applyDisabled?: boolean
  resetDisabled?: boolean
}

export default function HeaderActions({
  onSearchToggle,
  onApply,
  onReset,
  onMinimize,
  onRestore,
  onPinToggle,
  pinned,
  onClose,
  applyDisabled,
  resetDisabled,
}: HeaderActionsProps) {
  const uiIconScale = useGraphStore(s => s.uiIconScale)
  const uiIconStrokeWidth = useGraphStore(s => s.uiIconStrokeWidth)
  const iconSizeClass = getIconSizeClass(uiIconScale)

  const applyButtonDisabled = !onApply || !!applyDisabled
  const resetButtonDisabled = !onReset || !!resetDisabled
  const searchButtonDisabled = !onSearchToggle
  const minimizeOrRestoreAction = onRestore ?? onMinimize
  const minimizeOrRestoreTitle = onRestore
    ? UI_COPY.floatingPanelRestore
    : onMinimize
      ? UI_COPY.floatingPanelMinimize
      : undefined

  return (
    <div className="flex max-w-full flex-wrap items-center justify-end gap-1">
      <IconButton
        className="App-toolbar__btn"
        title={UI_LABELS.search}
        onClick={onSearchToggle}
        disabled={searchButtonDisabled}
        showTooltip
      >
        <SearchIcon className={iconSizeClass} strokeWidth={uiIconStrokeWidth} aria-hidden={true} />
      </IconButton>
      {onPinToggle && (
        <IconButton
          className={getPinToggleButtonClassName(pinned)}
          title={pinned ? UI_COPY.floatingPanelUnpin : UI_COPY.floatingPanelPin}
          onClick={onPinToggle}
          showTooltip
          aria-pressed={!!pinned}
        >
          {pinned ? (
            <Pin className={iconSizeClass} strokeWidth={uiIconStrokeWidth} aria-hidden={true} />
          ) : (
            <PinOff className={iconSizeClass} strokeWidth={uiIconStrokeWidth} aria-hidden={true} />
          )}
        </IconButton>
      )}
      <IconButton
        className="App-toolbar__btn"
        title={UI_LABELS.apply}
        onClick={onApply}
        disabled={applyButtonDisabled}
        showTooltip
      >
        <SaveIcon className={iconSizeClass} strokeWidth={uiIconStrokeWidth} aria-hidden={true} />
      </IconButton>
      <IconButton
        className="App-toolbar__btn"
        title={UI_LABELS.reset}
        onClick={onReset}
        disabled={resetButtonDisabled}
        showTooltip
      >
        <ResetIcon className={iconSizeClass} strokeWidth={uiIconStrokeWidth} aria-hidden={true} />
      </IconButton>
      {minimizeOrRestoreAction && minimizeOrRestoreTitle && (
        <IconButton
          className="App-toolbar__btn"
          title={minimizeOrRestoreTitle}
          onClick={minimizeOrRestoreAction}
          showTooltip
        >
          {onRestore ? (
            <Maximize2 className={iconSizeClass} strokeWidth={uiIconStrokeWidth} aria-hidden={true} />
          ) : (
            <Minimize2 className={iconSizeClass} strokeWidth={uiIconStrokeWidth} aria-hidden={true} />
          )}
        </IconButton>
      )}

      <IconButton className="App-toolbar__btn" title={UI_LABELS.close} onClick={onClose} showTooltip>
        <CloseIcon className={iconSizeClass} strokeWidth={uiIconStrokeWidth} aria-hidden={true} />
      </IconButton>
    </div>
  )
}
