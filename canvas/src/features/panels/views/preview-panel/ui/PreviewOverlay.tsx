import React from 'react'
import { createPortal } from 'react-dom'

type PreviewOverlayProps = {
  open: boolean
  onClose: () => void
  children: React.ReactNode
  overlayClassName?: string
  panelClassName?: string
  scope?: 'viewport' | 'container'
  portalTarget?: HTMLElement | null
}

export default function PreviewOverlay({
  open,
  onClose,
  children,
  overlayClassName,
  panelClassName,
  scope = 'viewport',
  portalTarget,
}: PreviewOverlayProps) {
  React.useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose, open])

  if (!open) return null

  const node = (
    <div
      className={[
        scope === 'container' ? 'absolute inset-0 z-[99999]' : 'fixed inset-0 z-[99999]',
        'bg-black/60 flex items-center justify-center p-4',
        overlayClassName || '',
      ].filter(Boolean).join(' ')}
      onMouseDown={onClose}
    >
      <div
        className={[
          'bg-white rounded border border-gray-200 shadow-lg w-[95vw] h-[95vh] overflow-hidden',
          panelClassName || '',
        ].filter(Boolean).join(' ')}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )

  if (typeof document === 'undefined') return node
  const target = portalTarget ?? document.body
  if (scope === 'container' && !portalTarget) return node
  return createPortal(node, target)
}
