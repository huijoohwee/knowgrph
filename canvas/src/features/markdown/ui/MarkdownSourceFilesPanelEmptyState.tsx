import React from 'react'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'

export function MarkdownSourceFilesPanelEmptyState(props: {
  uiPanelTextFontClass: string
  folderName: string | null
}) {
  const { uiPanelTextFontClass, folderName } = props
  return (
    <p className={[`px-2 py-2 ${UI_THEME_TOKENS.text.tertiary}`, uiPanelTextFontClass, 'text-xs'].join(' ')}>
      {folderName ? 'No Markdown files found in this folder.' : 'Open a folder to load Markdown files.'}
    </p>
  )
}
