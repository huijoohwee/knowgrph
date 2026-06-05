import React from 'react'
import type { WorkspaceBacklink, WorkspacePath } from '@/features/workspace-fs/types'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import {
  UI_RESPONSIVE_MARKDOWN_WORKSPACE_EXPLORER_EMPTY_STATE_CLASSNAME,
  UI_RESPONSIVE_MARKDOWN_WORKSPACE_EXPLORER_LIST_CLASSNAME,
} from '@/lib/ui/responsiveElementClasses'
import { MarkdownWorkspaceBacklinkRow } from './MarkdownWorkspaceBacklinkRow'

type MarkdownWorkspaceBacklinksListProps = {
  activePath: WorkspacePath | null
  backlinks: WorkspaceBacklink[]
  textSizeClass: string
  panelTextClass: string
  onOpenBacklink: (args: { path: WorkspacePath; line: number }) => void
}

export function MarkdownWorkspaceBacklinksList(props: MarkdownWorkspaceBacklinksListProps) {
  const { activePath, backlinks, textSizeClass, panelTextClass, onOpenBacklink } = props

  if (activePath && backlinks.length === 0) {
    return <p className={`${UI_RESPONSIVE_MARKDOWN_WORKSPACE_EXPLORER_EMPTY_STATE_CLASSNAME} px-2 py-1 ${panelTextClass} ${UI_THEME_TOKENS.text.secondary}`}>No backlinks.</p>
  }

  return (
    <nav className={UI_RESPONSIVE_MARKDOWN_WORKSPACE_EXPLORER_LIST_CLASSNAME} aria-label="Backlinks">
      <ul className="space-y-1 list-none m-0 p-0" aria-label="Backlinks list">
        {backlinks.slice(0, 50).map((backlink, idx) => (
          <li key={`${backlink.fromPath}:${backlink.line}:${idx}`} className="list-none">
            <MarkdownWorkspaceBacklinkRow
              backlink={backlink}
              textSizeClass={textSizeClass}
              onOpenBacklink={onOpenBacklink}
            />
          </li>
        ))}
      </ul>
    </nav>
  )
}
