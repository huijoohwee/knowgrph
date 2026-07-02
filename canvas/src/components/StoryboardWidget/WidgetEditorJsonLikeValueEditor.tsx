import React from 'react'

import { StoryboardWidgetInlineValueEditor } from '@/components/StoryboardWidget/StoryboardWidgetInlineValueEditor'

export function formatConnectedValue(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

export function normalizeJsonLikeValueText(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'undefined') return ''
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

export const JsonLikeValueEditor = React.memo(function JsonLikeValueEditor(props: {
  id: string
  value: unknown
  active: boolean
  placeholder?: string
  className: string
  mode: 'json' | 'object'
  onCommit: (nextValue: unknown) => void
}) {
  const normalize = React.useCallback((v: unknown) => normalizeJsonLikeValueText(v), [])
  const lastNormalizedRef = React.useRef<string>(normalize(props.value))
  const [text, setText] = React.useState(() => lastNormalizedRef.current)

  React.useEffect(() => {
    const nextNormalized = normalize(props.value)
    if (text === lastNormalizedRef.current) {
      setText(nextNormalized)
    }
    lastNormalizedRef.current = nextNormalized
  }, [normalize, props.value, text])

  return (
    <StoryboardWidgetInlineValueEditor
      id={props.id}
      className={props.className}
      multiline
      value={text}
      placeholder={props.placeholder}
      active={props.active}
      onCommit={next => {
        setText(next)
        const raw = String(next || '')
        if (!raw.trim()) {
          props.onCommit(undefined)
          return
        }
        if (props.mode === 'json') {
          props.onCommit(raw)
          return
        }
        try {
          const parsed = JSON.parse(raw)
          if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            setText(lastNormalizedRef.current)
            return
          }
          props.onCommit(parsed)
        } catch {
          setText(lastNormalizedRef.current)
        }
      }}
    />
  )
})
