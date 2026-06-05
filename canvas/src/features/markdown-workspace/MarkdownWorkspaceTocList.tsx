import React from 'react'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import {
  UI_RESPONSIVE_MARKDOWN_WORKSPACE_EXPLORER_EMPTY_STATE_CLASSNAME,
  UI_RESPONSIVE_MARKDOWN_WORKSPACE_EXPLORER_LIST_CLASSNAME,
} from '@/lib/ui/responsiveElementClasses'
import type { TocItem } from '@/features/markdown/ui/markdownSectionUtils'

type MarkdownWorkspaceTocListProps = {
  items: TocItem[]
  panelTextClass: string
  onNavRefChange?: (element: HTMLElement | null) => void
  children?: React.ReactNode
}

export function MarkdownWorkspaceTocList(props: MarkdownWorkspaceTocListProps) {
  const { items, panelTextClass, onNavRefChange, children } = props

  if (items.length === 0) {
    return <p className={`${UI_RESPONSIVE_MARKDOWN_WORKSPACE_EXPLORER_EMPTY_STATE_CLASSNAME} px-2 py-1 ${panelTextClass} ${UI_THEME_TOKENS.text.secondary}`}>No headings.</p>
  }

  return (
    <nav
      ref={element => {
        onNavRefChange?.(element)
      }}
      className={UI_RESPONSIVE_MARKDOWN_WORKSPACE_EXPLORER_LIST_CLASSNAME}
      aria-label="Table of contents"
    >
      <ul className="list-none m-0 p-0">{children}</ul>
    </nav>
  )
}
