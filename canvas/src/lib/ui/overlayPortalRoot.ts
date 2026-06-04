import { useLayoutEffect, useState } from 'react'

type BodyPortalRootOptions = {
  createBeforeOpen?: boolean
}

export const createBodyPortalRoot = (): HTMLElement | null => {
  if (typeof document === 'undefined') return null
  return document.createElement('section')
}

export const useBodyPortalRoot = (open: boolean, options: BodyPortalRootOptions = {}): HTMLElement | null => {
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(() =>
    options.createBeforeOpen ? createBodyPortalRoot() : null,
  )

  useLayoutEffect(() => {
    if (!open) return
    if (portalRoot) return
    setPortalRoot(createBodyPortalRoot())
  }, [open, portalRoot])

  useLayoutEffect(() => {
    if (!open) return
    if (!portalRoot) return
    if (typeof document === 'undefined') return
    if (!document.body) return
    try {
      if (!document.body.contains(portalRoot)) document.body.appendChild(portalRoot)
    } catch {
      void 0
    }
    return () => {
      try {
        if (portalRoot.parentNode) portalRoot.parentNode.removeChild(portalRoot)
      } catch {
        void 0
      }
    }
  }, [open, portalRoot])

  return open ? portalRoot : null
}
