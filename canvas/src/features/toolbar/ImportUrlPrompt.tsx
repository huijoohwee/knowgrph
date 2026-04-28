import React from 'react'

import { WORKSPACE_IMPORT_IMAGE_URL_TEST, WORKSPACE_IMPORT_URL_TEST } from '@/lib/config'
import { SOURCE_FILES_COPY } from '@/lib/config-copy/importExportCopy'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { cn } from '@/lib/utils'

export function ImportUrlPrompt(props: {
  urlDraft: string
  onChange: (next: string) => void
  onConfirm: (url: string) => void
  onCancel?: () => void
  confirmLabel?: string
  autoFocus?: boolean
  rightAddon?: React.ReactNode
}) {
  const inputRef = React.useRef<HTMLInputElement | null>(null)
  const urlDraft = props.urlDraft
  const onChange = props.onChange
  const onConfirm = props.onConfirm
  const onCancel = props.onCancel
  const confirmLabel = String(props.confirmLabel || '').trim() || 'Run'
  const autoFocus = props.autoFocus === true

  React.useEffect(() => {
    if (!autoFocus) return
    const id = requestAnimationFrame(() => {
      try {
        inputRef.current?.focus()
      } catch {
        void 0
      }
    })
    return () => cancelAnimationFrame(id)
  }, [autoFocus])

  const normalizedDraft = String(urlDraft || '')

  return (
    <section aria-label="URL import controls">
      {(WORKSPACE_IMPORT_URL_TEST || WORKSPACE_IMPORT_IMAGE_URL_TEST) ? (
        <section className="mb-1 flex items-center gap-1">
          {WORKSPACE_IMPORT_URL_TEST ? (
            <button
              type="button"
              className={cn(
                'h-6 px-2 inline-flex items-center justify-center rounded border text-xs',
                UI_THEME_TOKENS.input.border,
                UI_THEME_TOKENS.button.text,
                UI_THEME_TOKENS.button.hoverBg,
              )}
              onClick={() => onChange(WORKSPACE_IMPORT_URL_TEST)}
            >
              Test URL
            </button>
          ) : null}
          {WORKSPACE_IMPORT_IMAGE_URL_TEST ? (
            <button
              type="button"
              className={cn(
                'h-6 px-2 inline-flex items-center justify-center rounded border text-xs',
                UI_THEME_TOKENS.input.border,
                UI_THEME_TOKENS.button.text,
                UI_THEME_TOKENS.button.hoverBg,
              )}
              onClick={() => onChange(WORKSPACE_IMPORT_IMAGE_URL_TEST)}
            >
              Test image
            </button>
          ) : null}
        </section>
      ) : null}

      <section className="flex items-stretch gap-1">
        <input
          ref={inputRef}
          className={cn(
            'flex-1 min-w-0 h-[var(--kg-control-height,28px)] px-2 rounded border box-border text-xs',
            UI_THEME_TOKENS.input.border,
            UI_THEME_TOKENS.input.bg,
            UI_THEME_TOKENS.input.text,
          )}
          placeholder={SOURCE_FILES_COPY.urlPlaceholder}
          value={normalizedDraft}
          onChange={e => onChange(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Escape') {
              e.preventDefault()
              onCancel?.()
              return
            }
            if (e.key !== 'Enter') return
            e.preventDefault()
            const next = String(normalizedDraft || '').trim()
            if (!next) return
            onConfirm(next)
          }}
        />
        {props.rightAddon}
        <button
          type="button"
          className={cn(
            'h-[var(--kg-control-height,28px)] px-2 inline-flex items-center justify-center rounded border text-xs',
            UI_THEME_TOKENS.input.border,
            UI_THEME_TOKENS.button.text,
            UI_THEME_TOKENS.button.hoverBg,
          )}
          onClick={() => {
            const next = String(normalizedDraft || '').trim()
            if (!next) return
            onConfirm(next)
          }}
          disabled={!String(normalizedDraft || '').trim()}
        >
          {confirmLabel}
        </button>
      </section>
    </section>
  )
}

