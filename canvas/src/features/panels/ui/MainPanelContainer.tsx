import React from 'react'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'

export default function MainPanelContainer({ children, className }: { children: React.ReactNode; className?: string }) {
  const base = `MainPanelContainer h-full flex flex-col p-0 rounded-xl border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} shadow-lg shadow-gray-200/60 dark:shadow-black/60 overflow-hidden`
  return <div className={`${base} ${className || ''}`}>{children}</div>
}
