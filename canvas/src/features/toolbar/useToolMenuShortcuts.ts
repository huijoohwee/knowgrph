import { useEffect } from 'react'
import type { ToolMenuAction, ToolMenuArea } from '@/features/toolbar/toolMenu'

export function useToolMenuShortcuts(handleAction: (area: ToolMenuArea, action: ToolMenuAction) => void) {
  useEffect(() => {
    if (typeof window === 'undefined') return
    const handler = (ev: KeyboardEvent) => {
      const target = ev.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return
      }
      const key = ev.key.toLowerCase()
      const metaOrCtrl = ev.metaKey || ev.ctrlKey
      const alt = ev.altKey
      if (!metaOrCtrl || !alt) return
      if (key === 'n') {
        ev.preventDefault()
        handleAction('sourceFiles', 'new')
      }
    }
    window.addEventListener('keydown', handler)
    return () => {
      window.removeEventListener('keydown', handler)
    }
  }, [handleAction])
}
