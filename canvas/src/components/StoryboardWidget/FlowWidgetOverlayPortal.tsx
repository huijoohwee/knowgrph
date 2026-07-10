import React from 'react'
import { createPortal } from 'react-dom'
import { WidgetEditorView } from '@/components/StoryboardWidget/WidgetEditorView'

type FlowWidgetOverlayPortalProps = React.ComponentProps<typeof WidgetEditorView>

export const FlowWidgetOverlayPortal = React.memo(function FlowWidgetOverlayPortal(props: FlowWidgetOverlayPortalProps) {
  const overlayElement = <WidgetEditorView {...props} />
  return typeof document === 'undefined' ? overlayElement : createPortal(overlayElement, document.body)
})
