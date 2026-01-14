import React from 'react'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'

export default function MainPanelContainer({ children, className, style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  const base = `MainPanelContainer h-full flex flex-col p-0 rounded-xl border ${UI_THEME_TOKENS.panel.border} shadow-lg shadow-gray-200/60 dark:shadow-black/60 overflow-hidden`
  return <div className={`${base} ${className || ''}`} style={{ backgroundColor: 'var(--panel-bg)', ...style }}>{children}</div>
}
