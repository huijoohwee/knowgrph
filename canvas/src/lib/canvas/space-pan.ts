type KeyEventLike = Pick<KeyboardEvent, 'code' | 'key' | 'metaKey' | 'ctrlKey' | 'altKey' | 'shiftKey' | 'repeat' | 'target'>

const isEditableTarget = (t: unknown): boolean => {
  if (!t || typeof t !== 'object') return false
  const el = t as Element
  const withEditable = el as unknown as { isContentEditable?: boolean }
  if (withEditable.isContentEditable === true) return true
  const withTag = el as unknown as { tagName?: string }
  const tag = typeof withTag.tagName === 'string' ? withTag.tagName : ''
  const upper = tag.toUpperCase()
  return upper === 'INPUT' || upper === 'TEXTAREA' || upper === 'SELECT'
}

const shouldClearSpaceHeldFromFocusTarget = (t: unknown): boolean => {
  if (isEditableTarget(t)) return true
  if (!t || typeof t !== 'object') return false
  const el = t as Element
  const withTag = el as unknown as { tagName?: string }
  const tag = typeof withTag.tagName === 'string' ? withTag.tagName : ''
  const upper = tag.toUpperCase()
  if (upper === 'IFRAME') return true
  try {
    if (typeof (el as unknown as { closest?: unknown }).closest === 'function') {
      if ((el as unknown as { closest: (s: string) => Element | null }).closest('[contenteditable="true"]')) return true
    }
  } catch {
    void 0
  }
  return false
}

const isSpaceKeyEvent = (e: KeyEventLike): boolean => {
  const code = typeof e.code === 'string' ? e.code : ''
  if (code === 'Space') return true
  const key = typeof e.key === 'string' ? e.key : ''
  return key === ' '
}

let installed = false
let spaceHeld = false

export function isSpacePanHeld(): boolean {
  return spaceHeld === true
}

export function resetSpacePanHeldForTests(): void {
  spaceHeld = false
  installed = false
}

export function ensureSpacePanKeyListenerInstalled(): void {
  if (installed) return
  installed = true
  if (typeof window === 'undefined') return
  if (typeof window.addEventListener !== 'function') return

  const onKeyDown = (e: KeyboardEvent) => {
    if (!isSpaceKeyEvent(e)) return
    if (e.metaKey || e.ctrlKey || e.altKey) return
    if (isEditableTarget(e.target)) return
    if (e.repeat) {
      spaceHeld = true
      return
    }
    spaceHeld = true
    try {
      e.preventDefault()
    } catch {
      void 0
    }
  }

  const onKeyUp = (e: KeyboardEvent) => {
    if (!isSpaceKeyEvent(e)) return
    spaceHeld = false
  }

  const onFocusIn = (e: Event) => {
    const t = (e as unknown as { target?: unknown }).target
    if (!shouldClearSpaceHeldFromFocusTarget(t)) return
    spaceHeld = false
  }

  const onVisibility = () => {
    try {
      if (typeof document === 'undefined') return
      if (document.visibilityState !== 'hidden') return
    } catch {
      void 0
    }
    spaceHeld = false
  }

  window.addEventListener('keydown', onKeyDown, { passive: false })
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('blur', () => {
    spaceHeld = false
  })
  window.addEventListener('focusin', onFocusIn, true)
  try {
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisibility)
  } catch {
    void 0
  }
}
