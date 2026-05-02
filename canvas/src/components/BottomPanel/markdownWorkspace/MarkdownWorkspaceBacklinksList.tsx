import React from 'react'
import type { WorkspaceBacklink, WorkspacePath } from '@/features/workspace-fs/types'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
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
    return <p className={`px-2 py-1 ${panelTextClass} ${UI_THEME_TOKENS.text.secondary}`}>No backlinks.</p>
  }

  return (
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
  )
}
