import React from 'react'

const isEditableTarget = (target: EventTarget | null): boolean => {
  const el = target as HTMLElement | null
  if (!el) return false
  const tag = String(el.tagName || '').toLowerCase()
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true
  const attr = el.getAttribute?.('contenteditable')
  if (attr && String(attr).toLowerCase() !== 'false') return true
  if (typeof el.closest !== 'function') return false
  return Boolean(el.closest('input,textarea,select,[contenteditable="true"],[contenteditable=""]'))
}

export function useHeldKey(args: { enabled: boolean; key: string }) {
  const { enabled, key } = args
  const [held, setHeld] = React.useState(false)

  React.useEffect(() => {
    if (!enabled) return

    const onDown = (ev: KeyboardEvent) => {
      if (ev.key !== key) return
      if (isEditableTarget(ev.target)) return
      ev.preventDefault()
      setHeld(true)
    }
    const onUp = (ev: KeyboardEvent) => {
      if (ev.key !== key) return
      setHeld(false)
    }
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
    }
  }, [enabled, key])

  return { held }
}
