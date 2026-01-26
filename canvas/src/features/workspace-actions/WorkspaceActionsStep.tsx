import React from 'react'
import { WorkspaceActionsPanel } from '@/features/workspace-actions/WorkspaceActionsPanel'
import { useWorkspaceActionsModel } from '@/features/workspace-actions/useWorkspaceActionsModel'

type WorkspaceActionsStepProps = {
  searchQuery?: string
}

export default function WorkspaceActionsStep({ searchQuery }: WorkspaceActionsStepProps) {
  const workspaceActions = useWorkspaceActionsModel({ searchQuery })

  return (
    <WorkspaceActionsPanel {...workspaceActions.panelProps} />
  )
}
