import type React from 'react'
import { StoryboardWidgetPanelChromeHeader } from '@/components/StoryboardWidget/StoryboardWidgetPanelChrome'
import { RichMediaPanelResizeHandle } from './RichMediaPanelResizeHandle'
import type { RichMediaPanelProps } from './RichMediaPanel.types'
import type { RichMediaPanelModel } from './useRichMediaPanelModel'

export function RichMediaPanelShell(args: {
  children: React.ReactNode
  model: RichMediaPanelModel
  props: RichMediaPanelProps
}) {
  const { children, model, props } = args
  return (
    <section
      ref={model.rootRef}
      className={model.rootClassName}
      style={{
        ...model.rootStyle,
        ...(model.showStoryboardWidgetChrome
          ? { display: 'flex', flexDirection: 'column' }
          : model.bodySurfaceStyle),
      }}
      onPointerDownCapture={model.handleRootPointerDownCapture}
      onMouseDownCapture={model.handleRootMouseDownCapture}
      onPointerUpCapture={props.onPointerUpCapture}
      onWheelCapture={props.onWheelCapture}
      onClickCapture={props.onClickCapture}
      onDoubleClickCapture={props.onDoubleClickCapture}
      onContextMenuCapture={props.onContextMenuCapture}
      {...model.rootAttributes}
    >
      {model.showStoryboardWidgetChrome ? (
        <>
          <StoryboardWidgetPanelChromeHeader
            active={model.headerControlsActive}
            title={model.title}
            minimized={props.headerMinimized === true}
            showFieldToggle={false}
            showPinToggle={typeof props.onHeaderTogglePinned === 'function'}
            showValidate={typeof props.onHeaderValidate === 'function'}
            showMinimizeToggle={typeof props.onHeaderToggleMinimized === 'function'}
            pinned={props.headerPinned === true}
            richMediaHeader={true}
            dragHandle={Boolean(props.onHeaderDragStart || props.onHeaderDrag || props.onHeaderDragEnd)}
            onHeaderPointerDown={model.handleRootPointerDownCapture}
            onHeaderMouseDown={model.handleRootMouseDownCapture}
            onValidate={props.onHeaderValidate}
            onTogglePinned={props.onHeaderTogglePinned}
            onPinnedPointerDown={props.onHeaderPinnedPointerDown}
            onToggleMinimized={props.onHeaderToggleMinimized}
          />
          <section
            className="kg-mediaCardBody relative min-h-0 overflow-hidden"
            data-kg-widget-body="1"
            data-kg-rich-media-storyboard-widget-body="1"
            style={model.chromeBodySurfaceStyle}
          >
            {children}
          </section>
        </>
      ) : children}
      {model.installResize && model.resizeHandlePlacement === 'root' ? (
        <RichMediaPanelResizeHandle placement="root" onPointerDown={model.onResizePointerDown} />
      ) : null}
    </section>
  )
}
