import type React from 'react'
import { FlowEditorPanelChromeHeader } from '@/components/FlowEditor/FlowEditorPanelChrome'
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
        ...(model.showFlowEditorChrome
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
      {model.showFlowEditorChrome ? (
        <>
          <FlowEditorPanelChromeHeader
            active={model.headerControlsActive}
            title={model.title}
            minimized={props.headerMinimized === true}
            showFieldToggle={false}
            showPinToggle={true}
            pinned={props.headerPinned === true}
            richMediaHeader={true}
            dragHandle={Boolean(props.onHeaderDragStart || props.onHeaderDrag || props.onHeaderDragEnd)}
            onValidate={props.onHeaderValidate}
            onTogglePinned={props.onHeaderTogglePinned}
            onPinnedPointerDown={props.onHeaderPinnedPointerDown}
            onToggleMinimized={props.onHeaderToggleMinimized}
          />
          <section
            className="kg-mediaCardBody relative min-h-0 overflow-hidden"
            data-kg-widget-body="1"
            data-kg-rich-media-flow-editor-body="1"
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
