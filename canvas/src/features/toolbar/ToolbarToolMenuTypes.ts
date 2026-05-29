import React from 'react'

export interface ToolbarToolMenuProps {
  pipelineStatus: string | null
  exportStatus: string | null
  toolMenuCardRef: React.RefObject<HTMLElement>
  toolMenuCardStyle: React.CSSProperties
  onHeaderPointerDown: (event: React.PointerEvent<HTMLElement>) => void
  requestedFloatingPanelView?: 'propsPanel' | 'view' | 'interaction' | 'design' | 'chat' | 'geo' | 'renderer' | 'storybldr' | 'graphTraversal'
  requestedFloatingPanelViewSeq?: number
  onClose: () => void
}
