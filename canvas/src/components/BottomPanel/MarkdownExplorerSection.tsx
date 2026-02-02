import React from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'

export function MarkdownExplorerSection(props: {
  title: string
  collapsed: boolean
  setCollapsed: (next: boolean) => void
  right?: React.ReactNode
  children: React.ReactNode
}) {
  const { title, collapsed, setCollapsed, right, children } = props
  return (
    <section className={`border-b ${UI_THEME_TOKENS.panel.border}`} aria-label={title}>
      <button
        type="button"
        className={`w-full flex items-center justify-between px-2 py-1 text-[11px] tracking-wide font-semibold uppercase ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`}
        onClick={() => setCollapsed(!collapsed)}
        aria-expanded={!collapsed}
      >
        <span className="flex items-center gap-1">
          {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          {title}
        </span>
        <span className="flex items-center gap-1">{right}</span>
      </button>
      {!collapsed && <section className="px-1 pb-1">{children}</section>}
    </section>
  )
}
