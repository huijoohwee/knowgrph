import React from 'react'
import CollapsibleSection from '@/features/panels/ui/CollapsibleSection'
import { WorkspaceActionsPanel } from '@/features/workspace-actions/WorkspaceActionsPanel'
import { useWorkspaceActionsModel } from '@/features/workspace-actions/useWorkspaceActionsModel'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'

export default function WorkspaceActionsStep() {
  const [searchQuery, setSearchQuery] = React.useState('')
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
      actions={
        workspaceActions.pipelineStatus ? (
          <span className="text-[10px] font-normal text-gray-500 truncate max-w-[200px]">
            {workspaceActions.pipelineStatus}
          </span>
        ) : null
      }
    >
      <div className="mb-2">
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search"
          className={`h-7 w-full px-2 text-xs border ${UI_THEME_TOKENS.input.border} rounded-lg ${UI_THEME_TOKENS.input.bg} ${UI_THEME_TOKENS.input.text}`}
        />
      </div>
      <WorkspaceActionsPanel {...workspaceActions.panelProps} />
    </CollapsibleSection>
  )
}

