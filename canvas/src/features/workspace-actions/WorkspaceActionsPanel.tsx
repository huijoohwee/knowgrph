import React from 'react'
import { ToolbarToolMenuAreas } from '@/features/toolbar/ToolbarToolMenuAreas'
import type { ToolbarToolMenuAreasProps } from '@/features/toolbar/ToolbarToolMenuAreas.registry'

export function WorkspaceActionsPanel(props: ToolbarToolMenuAreasProps) {
  return <ToolbarToolMenuAreas {...props} />
}
