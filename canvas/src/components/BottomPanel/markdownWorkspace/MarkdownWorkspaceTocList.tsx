import React from 'react'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
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
    return <p className={`px-2 py-1 ${panelTextClass} ${UI_THEME_TOKENS.text.secondary}`}>No headings.</p>
  }

  return (
    <nav
      ref={element => {
        onNavRefChange?.(element)
      }}
      className="min-h-0 overflow-auto"
      aria-label="Table of contents"
    >
      <ul className="list-none m-0 p-0">{children}</ul>
    </nav>
  )
}
