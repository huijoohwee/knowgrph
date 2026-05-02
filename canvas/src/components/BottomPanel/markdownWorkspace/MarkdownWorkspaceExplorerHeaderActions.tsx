import React from 'react'
import { Plus, RefreshCcw } from 'lucide-react'
import { CollapsibleToolbar } from '@/components/ui/CollapsibleToolbar'
import { SelectionActionsMenu } from './SelectionActionsMenu'
import { ExplorerToolbarIconButton } from './ExplorerToolbarIconButton'
import { ExplorerSearchControl } from './ExplorerSearchControl'
import type { SelectionActionItem } from './selectionActionItems'

type MarkdownWorkspaceExplorerHeaderActionsProps = {
  textSizeClass: string
  panelTextClass: string
  activeEntryName: string
  selectionActionItems: SelectionActionItem[]
  onCreateNewFile: () => void
  onRefresh: () => void
  search: string
  setSearch: (next: string) => void
}

export function MarkdownWorkspaceExplorerHeaderActions(props: MarkdownWorkspaceExplorerHeaderActionsProps) {
  const { textSizeClass, panelTextClass, activeEntryName, selectionActionItems, onCreateNewFile, onRefresh, search, setSearch } = props
  const refreshSelectionAction = React.useMemo(
    () => selectionActionItems.find(item => item.key === 'refresh') || null,
    [selectionActionItems],
  )

  return (
    <CollapsibleToolbar ariaLabel="Explorer actions" className="kg-toolbar flex items-center justify-end">
      <ul className="flex items-center gap-1 list-none m-0 p-0" aria-label="Explorer actions list">
        <SelectionActionsMenu
          textSizeClass={textSizeClass}
          activeEntryName={activeEntryName}
          actionItems={selectionActionItems}
        />
        <li className="list-none">
          <ExplorerToolbarIconButton ariaLabel="New file" title="New file" onClick={onCreateNewFile}>
            <Plus className="w-4 h-4" />
          </ExplorerToolbarIconButton>
        </li>
        {refreshSelectionAction ? (
          <li className="list-none">
            <ExplorerToolbarIconButton
              ariaLabel={refreshSelectionAction.ariaLabel}
              title={refreshSelectionAction.label}
              onClick={refreshSelectionAction.onSelect}
            >
              <RefreshCcw className="w-4 h-4" />
            </ExplorerToolbarIconButton>
          </li>
        ) : null}
        <li className="list-none">
          <ExplorerToolbarIconButton ariaLabel="Refresh" title="Refresh" onClick={onRefresh}>
            <RefreshCcw className="w-4 h-4" />
          </ExplorerToolbarIconButton>
        </li>
        <li className="list-none">
          <ExplorerSearchControl search={search} setSearch={setSearch} panelTextClass={panelTextClass} />
        </li>
      </ul>
    </CollapsibleToolbar>
  )
}
