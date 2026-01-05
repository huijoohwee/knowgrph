import { useEffect } from 'react'

export function usePanelHotkeys(active: boolean, handlers: { save?: () => void; format?: () => void; undo?: () => void; redo?: () => void; apply?: () => void }) {
  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent) => {
      const isCmd = e.metaKey || e.ctrlKey
      if (!isCmd) return
      const k = e.key.toLowerCase()
      if (k === 's' && !e.shiftKey && handlers.save) { e.preventDefault(); handlers.save() }
      else if (k === 'f' && e.shiftKey && handlers.format) { e.preventDefault(); handlers.format() }
      else if (k === 'z' && !e.shiftKey && handlers.undo) { e.preventDefault(); handlers.undo() }
      else if (k === 'z' && e.shiftKey && handlers.redo) { e.preventDefault(); handlers.redo() }
      else if (k === 'enter' && handlers.apply) { e.preventDefault(); handlers.apply() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, handlers])
}

