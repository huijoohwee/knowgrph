import React from 'react'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { useGraphStore } from '@/hooks/useGraphStore'

export default function MainPanelContainer({ children, className, style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  const uiHeaderRowHeightClass = useGraphStore(s => s.uiHeaderRowHeightClass || 'min-h-[36px]')
  const headerBarHeightPx = React.useMemo(() => {
    const raw = String(uiHeaderRowHeightClass || '').trim()
    const match = /min-h-\[(\d+)px\]/.exec(raw)
    if (match && match[1]) {
      const n = Number.parseInt(match[1], 10)
      if (Number.isFinite(n) && n > 0) return n
    }
    return 36
  }, [uiHeaderRowHeightClass])
  const base = `MainPanelContainer h-full flex flex-col p-0 rounded-xl border ${UI_THEME_TOKENS.panel.border} shadow-lg shadow-gray-200/60 dark:shadow-black/60 overflow-hidden`
  return (
    <div
      className={`${base} ${className || ''}`}
      style={{
        backgroundColor: 'var(--panel-bg)',
        ['--kg-header-bar-height' as unknown as string]: `${headerBarHeightPx}px`,
        ...style,
      }}
    >
      {children}
    </div>
  )
}
