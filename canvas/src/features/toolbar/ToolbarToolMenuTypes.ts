import React from 'react'
import type { FloatingPanelView } from '@/hooks/store/store-types/graph-state-chat-import'

export interface ToolbarToolMenuProps {
  pipelineStatus: string | null
  exportStatus: string | null
  toolMenuCardRef: React.RefObject<HTMLElement>
  toolMenuCardStyle: React.CSSProperties
  onHeaderPointerDown: (event: React.PointerEvent<HTMLElement>) => void
  requestedFloatingPanelView?: FloatingPanelView
  requestedFloatingPanelViewSeq?: number
  onClose: () => void
}
