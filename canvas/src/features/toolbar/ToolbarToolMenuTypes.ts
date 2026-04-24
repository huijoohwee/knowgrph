import React from 'react'

export interface ToolbarToolMenuProps {
  pipelineStatus: string | null
  exportStatus: string | null
  toolMenuCardRef: React.RefObject<HTMLElement>
  toolMenuCardStyle: React.CSSProperties
  onHeaderPointerDown: (event: React.PointerEvent<HTMLElement>) => void
  requestedFloatingPanelView?: 'propsPanel' | 'interaction' | 'domTree' | 'domInspect' | 'chat' | 'geo' | 'discovery' | 'renderer' | 'graphTraversal'
  requestedFloatingPanelViewSeq?: number
  onClose: () => void
}
