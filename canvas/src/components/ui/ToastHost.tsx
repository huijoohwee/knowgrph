import React from 'react'
import { createPortal } from 'react-dom'
import { AlertCircle, CheckCircle, Info, X, AlertTriangle, Pin, PinOff } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useGraphStore } from '@/hooks/useGraphStore'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { sanitizeMessageText } from '@/lib/ui'
import { cn } from '@/lib/utils'
import type { UiToast, UiToastKind } from '@/hooks/store/types'
import { Z_INDEX_TOAST } from '@/lib/ui/zIndex'

const TOAST_TOP_PX = 56

const getKindClasses = (kind: UiToastKind): string => {
  if (kind === 'success') return UI_THEME_TOKENS.status.success
  if (kind === 'warning') return UI_THEME_TOKENS.status.warning
  if (kind === 'error') return UI_THEME_TOKENS.status.error
  return UI_THEME_TOKENS.status.neutral
}

const getKindIcon = (kind: UiToastKind) => {
  if (kind === 'success') return CheckCircle
  if (kind === 'warning') return AlertTriangle
  if (kind === 'error') return AlertCircle
  return Info
}

function ToastCard({
  toast,
  onDismiss,
  onTogglePinned,
}: {
  toast: UiToast
  onDismiss: (id: string) => void
  onTogglePinned: (toast: UiToast) => void
}) {
  const uiIconStrokeWidth = useGraphStore(s => s.uiIconStrokeWidth)
  const Icon = getKindIcon(toast.kind)
  const message = sanitizeMessageText(toast.message, { maxLines: 4 })
  const pinned = toast.expiresAtMs == null
  const PinIcon = pinned ? PinOff : Pin
  if (!message) return null
  return (
    <aside
      className={cn(
        'pointer-events-auto flex-none w-[520px] max-w-[calc(100vw-24px)]',
        'rounded border shadow-sm',
        'bg-[rgba(var(--panel-bg-rgb),var(--panel-opacity))]',
        UI_THEME_TOKENS.panel.border,
        getKindClasses(toast.kind),
      )}
      role={toast.kind === 'error' ? 'alert' : 'status'}
    >
      <div className="grid grid-cols-[16px_minmax(0,1fr)_auto] items-start gap-x-2 px-3 py-2">
        <Icon className="w-4 h-4 mt-0.5" strokeWidth={uiIconStrokeWidth} aria-hidden="true" />
        <div className="min-w-0 whitespace-pre-wrap break-words text-xs leading-5">{message}</div>
        <div className="mt-0.5 flex items-center gap-1 pointer-events-auto">
          <button
            type="button"
            className={cn(
              'h-5 w-5 rounded inline-flex items-center justify-center relative z-[1] pointer-events-auto',
              UI_THEME_TOKENS.button.hoverBg,
              UI_THEME_TOKENS.button.text,
            )}
            onClick={() => onTogglePinned(toast)}
            aria-label={pinned ? 'Unpin' : 'Pin'}
            title={pinned ? 'Unpin toast' : 'Pin toast'}
          >
            <PinIcon className="w-3.5 h-3.5" strokeWidth={uiIconStrokeWidth} aria-hidden="true" />
          </button>
          {toast.dismissible ? (
            <button
              type="button"
              className={cn(
                'h-5 w-5 rounded inline-flex items-center justify-center relative z-[1] pointer-events-auto',
                UI_THEME_TOKENS.button.hoverBg,
                UI_THEME_TOKENS.button.text,
              )}
              onClick={() => onDismiss(toast.id)}
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" strokeWidth={uiIconStrokeWidth} aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </div>
    </aside>
  )
}

export function ToastHost() {
  const { toasts, dismissUiToast, pruneUiToasts, pushUiToast } = useGraphStore(
    useShallow(s => ({
      toasts: s.uiToasts,
      dismissUiToast: s.dismissUiToast,
      pruneUiToasts: s.pruneUiToasts,
      pushUiToast: s.pushUiToast,
    })),
  )

  const orderedToasts = Array.isArray(toasts) ? toasts : []

  const togglePinned = React.useCallback(
    (toast: UiToast) => {
      const pinned = toast.expiresAtMs == null
      pushUiToast({
        id: toast.id,
        kind: toast.kind,
        message: toast.message,
        ttlMs: pinned ? 10_000 : null,
        dismissible: toast.dismissible,
        log: false,
      })
    },
    [pushUiToast],
  )

  React.useEffect(() => {
    if (typeof window === 'undefined') return
    const id = window.setInterval(() => {
      pruneUiToasts(Date.now())
    }, 500)
    return () => {
      try {
        window.clearInterval(id)
      } catch {
        void 0
      }
    }
  }, [pruneUiToasts])

  if (typeof document === 'undefined') return null
  if (!orderedToasts || orderedToasts.length === 0) return null

  return createPortal(
    <section
      className="fixed pointer-events-none"
      style={{
        top: TOAST_TOP_PX,
        right: 12,
        zIndex: Z_INDEX_TOAST,
      }}
      aria-label="Notifications"
      aria-live="polite"
      aria-relevant="additions removals"
    >
      <ol className="flex flex-col gap-2 items-end" style={{ width: 520, maxWidth: 'calc(100vw - 24px)' }} aria-label="Toast list">
        {orderedToasts.map(t => (
          <li key={t.id} className="list-none pointer-events-auto">
            <ToastCard toast={t} onDismiss={dismissUiToast} onTogglePinned={togglePinned} />
          </li>
        ))}
      </ol>
    </section>,
    document.body,
  )
}

export default ToastHost
