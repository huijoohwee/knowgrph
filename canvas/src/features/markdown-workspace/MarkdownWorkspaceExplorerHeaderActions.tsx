import React from 'react'
import { RefreshCcw } from 'lucide-react'
import { ExplorerToolbarIconButton } from './ExplorerToolbarIconButton'
import { ExplorerSearchControl } from './ExplorerSearchControl'
import { uiToolbarRowScrollJustifyEndClassName, uiToolbarRowScrollListClassName } from '@/features/toolbar/ui/toolbarStyles'

type MarkdownWorkspaceExplorerHeaderActionsProps = {
  panelTextClass: string
  onRefresh: () => void
  search: string
  setSearch: (next: string) => void
}

export function MarkdownWorkspaceExplorerHeaderActions(props: MarkdownWorkspaceExplorerHeaderActionsProps) {
  const { panelTextClass, onRefresh, search, setSearch } = props

  return (
    <nav className={`kg-toolbar ${uiToolbarRowScrollJustifyEndClassName} gap-1`} aria-label="Explorer actions">
      <ul className={`${uiToolbarRowScrollListClassName} gap-1`} aria-label="Explorer actions list">
        <li className="list-none">
          <ExplorerToolbarIconButton ariaLabel="Refresh" title="Refresh" onClick={onRefresh}>
            <RefreshCcw className="w-4 h-4" />
          </ExplorerToolbarIconButton>
        </li>
        <li className="list-none">
          <ExplorerSearchControl search={search} setSearch={setSearch} panelTextClass={panelTextClass} />
        </li>
      </ul>
    </nav>
  )
}
