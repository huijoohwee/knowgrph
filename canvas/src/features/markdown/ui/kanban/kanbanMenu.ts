import React from 'react'

export const isInteractiveEventTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof Element)) return false
  return !!target.closest('button,select,input,textarea,a,[role="menu"],[role="menuitem"],[data-kg-card-media-interactive="1"]')
}

export const useDismissableMenu = (args: {
  open: boolean
  onClose: () => void
  rootRef: React.RefObject<HTMLElement>
  triggerRef: React.RefObject<HTMLElement>
}) => {
  React.useEffect(() => {
    if (!args.open) return
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null
      if (!target) return
      if (args.rootRef.current?.contains(target)) return
      if (args.triggerRef.current?.contains(target)) return
      args.onClose()
    }
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      args.onClose()
      args.triggerRef.current?.focus()
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onEscape)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onEscape)
    }
  }, [args])
}
