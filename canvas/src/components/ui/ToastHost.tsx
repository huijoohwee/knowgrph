import React from 'react'
import { createPortal } from 'react-dom'
import { AlertCircle, CheckCircle, Info, X, AlertTriangle } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useGraphStore } from '@/hooks/useGraphStore'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { sanitizeMessageText } from '@/lib/ui'
import { cn } from '@/lib/utils'
import type { UiToast, UiToastKind } from '@/hooks/store/types'

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

function ToastCard({ toast, onDismiss }: { toast: UiToast; onDismiss: (id: string) => void }) {
  const uiIconStrokeWidth = useGraphStore(s => s.uiIconStrokeWidth)
  const Icon = getKindIcon(toast.kind)
  const message = sanitizeMessageText(toast.message, { maxLines: 4 })
  if (!message) return null
  return (
    <div
      className={cn(
        'pointer-events-auto flex-none w-[520px] max-w-[calc(100vw-24px)]',
        'rounded border shadow-sm',
        'bg-[rgba(var(--panel-bg-rgb),var(--panel-opacity))]',
        UI_THEME_TOKENS.panel.border,
        getKindClasses(toast.kind),
      )}
    >
      <div className="flex items-start gap-2 px-3 py-2">
        <Icon className="w-4 h-4 mt-[1px] flex-shrink-0" strokeWidth={uiIconStrokeWidth} aria-hidden="true" />
        <div className="min-w-0 flex-1 whitespace-pre-wrap break-words text-xs">{message}</div>
        {toast.dismissible ? (
          <button
            type="button"
            className={cn(
              'App-toolbar__btn',
              UI_THEME_TOKENS.button.hoverBg,
              UI_THEME_TOKENS.button.padding,
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
  )
}

export function ToastHost() {
  const { toasts, dismissUiToast, pruneUiToasts } = useGraphStore(
    useShallow(s => ({
      toasts: s.uiToasts,
      dismissUiToast: s.dismissUiToast,
      pruneUiToasts: s.pruneUiToasts,
    })),
  )

  const orderedToasts = Array.isArray(toasts) ? toasts : []

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
    <div
      className="fixed z-[2500] pointer-events-none"
      style={{
        top: TOAST_TOP_PX,
        right: 12,
      }}
      aria-live="polite"
      aria-relevant="additions removals"
    >
      <div className="flex flex-col gap-2 items-end" style={{ width: 520, maxWidth: 'calc(100vw - 24px)' }}>
        {orderedToasts.map(t => (
          <ToastCard key={t.id} toast={t} onDismiss={dismissUiToast} />
        ))}
      </div>
    </div>,
    document.body,
  )
}

export default ToastHost
