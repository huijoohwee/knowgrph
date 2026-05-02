import React from 'react'
import { Link2 } from 'lucide-react'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import type { WorkspaceBacklink, WorkspacePath } from '@/features/workspace-fs/types'

type MarkdownWorkspaceBacklinkRowProps = {
  backlink: WorkspaceBacklink
  textSizeClass: string
  onOpenBacklink: (args: { path: WorkspacePath; line: number }) => void
}

export function MarkdownWorkspaceBacklinkRow(props: MarkdownWorkspaceBacklinkRowProps) {
  const { backlink, textSizeClass, onOpenBacklink } = props

  return (
    <button
      type="button"
      className={`w-full flex items-start gap-2 rounded px-2 py-1 ${textSizeClass} ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`}
      onClick={() => onOpenBacklink({ path: backlink.fromPath, line: backlink.line })}
      aria-label={`Backlink from ${backlink.fromPath}`}
    >
      <Link2 className="w-3 h-3 mt-[2px]" aria-hidden="true" />
      <span className="min-w-0">
        <span className="block truncate">{backlink.fromPath}</span>
        <span className={`block truncate ${UI_THEME_TOKENS.text.secondary}`}>
          L{backlink.line}: {backlink.lineText}
        </span>
      </span>
    </button>
  )
}
