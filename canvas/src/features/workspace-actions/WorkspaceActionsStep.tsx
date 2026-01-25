import React from 'react'
import CollapsibleSection from '@/features/panels/ui/CollapsibleSection'
import { WorkspaceActionsPanel } from '@/features/workspace-actions/WorkspaceActionsPanel'
import { useWorkspaceActionsModel } from '@/features/workspace-actions/useWorkspaceActionsModel'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'

type WorkspaceActionsStepProps = {
  searchQuery?: string
}

export default function WorkspaceActionsStep({ searchQuery }: WorkspaceActionsStepProps) {
  const workspaceActions = useWorkspaceActionsModel({ searchQuery })

  return (
    <CollapsibleSection
      title="Workspace Actions"
      defaultCollapsed={false}
      stickyHeader={false}
      className="mt-2 pt-0 border-t-0"
      headerClassName={[
        'px-2 rounded border',
        UI_THEME_TOKENS.panel.divider,
        UI_THEME_TOKENS.panel.bg,
      ].join(' ')}
    >
      <WorkspaceActionsPanel {...workspaceActions.panelProps} />
    </CollapsibleSection>
  )
}
