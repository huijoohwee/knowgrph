import { useEffect, useRef } from 'react'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'

export type CanvasCellEditorState = {
  rowId: string
  columnId: string
  value: string
  rect: { x: number; y: number; w: number; h: number }
}

export function CanvasCellEditor(props: {
  state: CanvasCellEditorState
  onChange: (value: string) => void
  onCommit: () => void
  onCancel: () => void
}) {
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    try {
      el.focus()
      el.select()
    } catch {
      void 0
    }
  }, [props.state.columnId, props.state.rowId])

  return (
    <section
      aria-label="Cell editor"
      className="absolute"
      style={{
        left: Math.round(props.state.rect.x),
        top: Math.round(props.state.rect.y),
        width: Math.round(props.state.rect.w),
        height: Math.round(props.state.rect.h),
      }}
    >
      <input
        ref={inputRef}
        value={props.state.value}
        onChange={e => props.onChange(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            e.preventDefault()
            props.onCommit()
          }
          if (e.key === 'Escape') {
            e.preventDefault()
            props.onCancel()
          }
        }}
        onBlur={() => props.onCommit()}
        className={`h-full w-full px-2 rounded border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.text.primary}`}
        aria-label={`Edit ${props.state.columnId}`}
      />
    </section>
  )
}

