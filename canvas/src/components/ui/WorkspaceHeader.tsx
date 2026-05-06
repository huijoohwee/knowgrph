import React from 'react'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'

export type WorkspaceHeaderBorder = 'border' | 'divider'

export function WorkspaceHeader(props: {
  ariaLabel: string
  border?: WorkspaceHeaderBorder
  className?: string
  children: React.ReactNode
}) {
  const borderClass = props.border === 'border' ? UI_THEME_TOKENS.panel.border : UI_THEME_TOKENS.panel.divider
  return (
    <header className={['shrink-0 border-b', borderClass, UI_THEME_TOKENS.panel.bg, props.className || ''].join(' ').trim()} aria-label={props.ariaLabel}>
      {props.children}
    </header>
  )
}

export function WorkspaceHeaderRow(props: { ariaLabel?: string; className?: string; children: React.ReactNode }) {
  return (
    <section className={['kg-workspace-header-row flex items-center justify-between', props.className || ''].join(' ').trim()} aria-label={props.ariaLabel}>
      {props.children}
    </section>
  )
}
