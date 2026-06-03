import React from 'react'

import IconButton from '@/components/IconButton'
import { UI_COPY, UI_LABELS } from '@/lib/config'
import { getIconSizeClass, getPinToggleButtonClassName } from '@/lib/ui'
import { UI_RESPONSIVE_PANEL_HEADER_ROW_CLASSNAME } from '@/lib/ui/responsiveElementClasses'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { cn } from '@/lib/utils'
import { CheckCircle, ChevronDown, ChevronUp, Maximize2, Minimize2, Pin, PinOff } from 'lucide-react'

export function FlowEditorPanelChromeHeader(props: {
  active: boolean
  title: React.ReactNode
  minimized?: boolean
  hideFields?: boolean
  showFieldToggle?: boolean
  showPinToggle?: boolean
  pinned?: boolean
  microLabelClass?: string
  uiIconScale?: 'compact' | 'default'
  uiIconStrokeWidth?: number
  richMediaHeader?: boolean
  dragHandle?: boolean
  onHeaderPointerDown?: (event: React.PointerEvent<HTMLElement>) => void
  onValidate?: () => void
  onToggleHideFields?: () => void
  onToggleMinimized?: () => void
  onTogglePinned?: (event: React.MouseEvent) => void
  onPinnedPointerDown?: (event: React.PointerEvent) => void
}) {
  const {
    active,
    title,
    minimized = false,
    hideFields = false,
    showFieldToggle = true,
    showPinToggle = true,
    pinned = false,
    microLabelClass = '',
    uiIconScale,
    uiIconStrokeWidth = 1.8,
    richMediaHeader = false,
    dragHandle = true,
    onHeaderPointerDown,
    onValidate,
    onToggleHideFields,
    onToggleMinimized,
    onTogglePinned,
    onPinnedPointerDown,
  } = props
  const iconSizeClass = getIconSizeClass(uiIconScale)
  const richMediaHeaderStyle: React.CSSProperties | undefined = richMediaHeader ? {
    height: 'var(--kg-media-panel-header-h, 28px)',
    minHeight: 'var(--kg-media-panel-header-h, 28px)',
    maxHeight: 'var(--kg-media-panel-header-h, 28px)',
    flex: '0 0 var(--kg-media-panel-header-h, 28px)',
    boxSizing: 'border-box',
    display: 'flex',
    alignItems: 'center',
    padding: '0 var(--kg-media-panel-padding, 6px)',
    background: 'var(--kg-media-panel-header-bg, var(--kg-media-panel-bg, var(--kg-panel-bg, rgba(255,255,255,0.96))))',
    overflow: 'hidden',
  } : undefined
  const richMediaHeaderInnerStyle: React.CSSProperties | undefined = richMediaHeader ? {
    width: '100%',
    minWidth: 0,
    height: '100%',
  } : undefined
  const richMediaTitleStyle: React.CSSProperties | undefined = richMediaHeader ? {
    fontSize: 'var(--kg-media-panel-title-size, 12px)',
    lineHeight: 1.2,
  } : undefined
  const richMediaNavStyle: React.CSSProperties | undefined = richMediaHeader ? {
    flex: '0 0 auto',
    gap: 'max(1px, calc(var(--kg-media-panel-padding, 6px) * 0.35))',
  } : undefined
  const richMediaActionStyle: React.CSSProperties | undefined = richMediaHeader ? {
    width: 'max(12px, calc(var(--kg-media-panel-header-h, 28px) - 4px))',
    minWidth: 'max(12px, calc(var(--kg-media-panel-header-h, 28px) - 4px))',
    height: 'max(12px, calc(var(--kg-media-panel-header-h, 28px) - 4px))',
    minHeight: 'max(12px, calc(var(--kg-media-panel-header-h, 28px) - 4px))',
    padding: 0,
    borderRadius: 'calc(var(--kg-media-panel-radius, 10px) * 0.42)',
  } : undefined
  const richMediaIconStyle: React.CSSProperties | undefined = richMediaHeader ? {
    width: 'max(8px, calc(var(--kg-media-panel-header-h, 28px) * 0.46))',
    height: 'max(8px, calc(var(--kg-media-panel-header-h, 28px) * 0.46))',
  } : undefined

  return (
    <header
      className={cn(
        'relative z-10 flex-none',
        'border-b',
        UI_THEME_TOKENS.panel.border,
        dragHandle ? 'cursor-move' : 'cursor-default',
        'select-none',
        minimized ? `px-2 py-0 ${UI_RESPONSIVE_PANEL_HEADER_ROW_CLASSNAME}` : 'px-3 py-2',
      )}
      style={richMediaHeaderStyle}
      data-kg-flow-node-drag-handle={dragHandle ? 'true' : undefined}
      data-kg-canvas-overlay-drag-handle={dragHandle ? 'true' : undefined}
      data-kg-rich-media-flow-editor-header={richMediaHeader ? '1' : undefined}
      onPointerDown={onHeaderPointerDown}
    >
      <section
        className={cn('flex items-center justify-between gap-2', minimized ? 'h-full' : '')}
        style={richMediaHeaderInnerStyle}
        aria-label="Node editor header"
      >
        <section className="min-w-0" aria-label="Node title">
          <h3
            className={cn(
              'font-semibold truncate',
              UI_THEME_TOKENS.text.primary,
              minimized ? microLabelClass : '',
            )}
            style={richMediaTitleStyle}
          >
            {title}
          </h3>
        </section>

        <nav className="flex items-center gap-1" style={richMediaNavStyle} aria-label={UI_LABELS.flowWidget}>
          <IconButton
            title={UI_LABELS.flowWidgetValidate}
            tooltipContent={UI_LABELS.flowWidgetValidate}
            showTooltip
            disabled={!active}
            onClick={onValidate}
            className="App-toolbar__btn"
            style={richMediaActionStyle}
          >
            <CheckCircle className={iconSizeClass} style={richMediaIconStyle} strokeWidth={uiIconStrokeWidth} aria-hidden={true} />
          </IconButton>

          {showFieldToggle ? (
            <IconButton
              title={hideFields ? UI_LABELS.showFields : UI_LABELS.hideFields}
              tooltipContent={hideFields ? UI_COPY.flowWidgetShowFields : UI_COPY.flowWidgetHideFields}
              showTooltip
              disabled={!active}
              onClick={onToggleHideFields}
              className={cn('App-toolbar__btn', hideFields ? UI_THEME_TOKENS.icon.active : '')}
              style={richMediaActionStyle}
            >
              {hideFields ? (
                <ChevronDown className={iconSizeClass} style={richMediaIconStyle} strokeWidth={uiIconStrokeWidth} aria-hidden={true} />
              ) : (
                <ChevronUp className={iconSizeClass} style={richMediaIconStyle} strokeWidth={uiIconStrokeWidth} aria-hidden={true} />
              )}
            </IconButton>
          ) : null}

          <IconButton
            title={minimized ? UI_LABELS.restorePanel : UI_LABELS.minimizePanel}
            tooltipContent={minimized ? UI_COPY.flowWidgetRestore : UI_COPY.flowWidgetMinimize}
            showTooltip
            disabled={!active}
            onClick={onToggleMinimized}
            className="App-toolbar__btn"
            style={richMediaActionStyle}
          >
            {minimized ? (
              <Maximize2 className={iconSizeClass} style={richMediaIconStyle} strokeWidth={uiIconStrokeWidth} aria-hidden={true} />
            ) : (
              <Minimize2 className={iconSizeClass} style={richMediaIconStyle} strokeWidth={uiIconStrokeWidth} aria-hidden={true} />
            )}
          </IconButton>

          {showPinToggle ? (
            <IconButton
              title={pinned ? UI_LABELS.unpinPanel : UI_LABELS.pinPanel}
              tooltipContent={pinned ? UI_COPY.flowWidgetUnpin : UI_COPY.flowWidgetPin}
              showTooltip
              disabled={!active}
              onPointerDown={onPinnedPointerDown}
              onClick={onTogglePinned}
              className={getPinToggleButtonClassName(pinned)}
              style={richMediaActionStyle}
            >
              {pinned ? (
                <Pin className={cn(iconSizeClass, UI_THEME_TOKENS.icon.active)} style={richMediaIconStyle} strokeWidth={uiIconStrokeWidth} aria-hidden={true} />
              ) : (
                <PinOff className={iconSizeClass} style={richMediaIconStyle} strokeWidth={uiIconStrokeWidth} aria-hidden={true} />
              )}
            </IconButton>
          ) : null}
        </nav>
      </section>
    </header>
  )
}
