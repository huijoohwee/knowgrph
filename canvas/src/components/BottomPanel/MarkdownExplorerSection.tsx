import React from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { usePanelTypography } from '@/lib/ui/panelTypography'
import { UI_TEXT_TRUNCATE } from '@/lib/ui/textLayout'

export function MarkdownExplorerSection(props: {
  title: string
  collapsed: boolean
  setCollapsed: (next: boolean) => void
  right?: React.ReactNode
  children: React.ReactNode
}) {
  const { title, collapsed, setCollapsed, right, children } = props
  const panelTypography = usePanelTypography()

  const onKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        setCollapsed(!collapsed)
      }
    },
    [collapsed, setCollapsed],
  )

  return (
    <section className={`border-b ${UI_THEME_TOKENS.panel.border}`} aria-label={title}>
      <header
        className={[
          'sticky top-0 z-20 w-full flex items-center justify-between px-2 py-1',
          panelTypography.microLabelClass,
          'tracking-wide font-semibold uppercase',
          UI_THEME_TOKENS.panel.bg,
          'backdrop-blur',
          UI_THEME_TOKENS.button.text,
          UI_THEME_TOKENS.button.hoverBg,
        ].join(' ')}
        aria-label={`${title} header`}
      >
        <button
          type="button"
          className="flex items-center gap-1 min-w-0 flex-1"
          onClick={() => setCollapsed(!collapsed)}
          onKeyDown={e => onKeyDown(e as unknown as React.KeyboardEvent<HTMLDivElement>)}
          aria-expanded={!collapsed}
        >
          {collapsed ? <ChevronRight className="w-3 h-3 shrink-0" /> : <ChevronDown className="w-3 h-3 shrink-0" />}
          <span className={UI_TEXT_TRUNCATE}>{title}</span>
        </button>

        <nav className="flex items-center gap-1 shrink-0" aria-label={`${title} actions`}>
          {right}
        </nav>
      </header>
      {!collapsed && <section className="px-1 pb-1">{children}</section>}
    </section>
  )
}
