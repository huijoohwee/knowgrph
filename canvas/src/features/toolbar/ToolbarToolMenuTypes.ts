import React from 'react'

export interface ToolbarToolMenuProps {
  pipelineStatus: string | null
  exportStatus: string | null
  toolMenuCardRef: React.RefObject<HTMLDivElement>
  toolMenuCardStyle: React.CSSProperties
  onHeaderPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void
  requestedFloatingPanelView?: 'propsPanel' | 'renderer' | 'graphTraversal'
  requestedFloatingPanelViewSeq?: number
  onClose: () => void
}
