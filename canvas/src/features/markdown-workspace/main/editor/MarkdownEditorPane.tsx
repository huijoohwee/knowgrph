import React from 'react'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import type { PanelTypography } from '@/lib/ui/panelTypography'
import { MonacoTextEditor, type MonacoTextEditorHandle } from '@/features/monaco/MonacoTextEditor'

export function MarkdownEditorPane(props: {
  value: string
  onChange: (next: string) => void
  wordWrap: boolean
  editorRef: React.MutableRefObject<MonacoTextEditorHandle | null>
  onCaretLine?: (line: number) => void
  panelTypography: PanelTypography
  readOnly?: boolean
  themeMode: 'light' | 'dark'
  language: string
  uri: string
  onEditorHandle?: (h: MonacoTextEditorHandle | null) => void
  ariaLabel?: string
  paneAriaLabel?: string
}) {
  const rafIdRef = React.useRef<number | null>(null)
  const lastSelectionStartRef = React.useRef<number | null>(null)
  const lineStartsRef = React.useRef<{ value: string; starts: number[] } | null>(null)
  const getLineStarts = React.useCallback(() => {
    const value = String(props.value || '')
    const cached = lineStartsRef.current
    if (cached && cached.value === value) return cached.starts
    const starts: number[] = [0]
    for (let i = 0; i < value.length; i += 1) {
      if (value.charCodeAt(i) === 10) starts.push(i + 1)
    }
    lineStartsRef.current = { value, starts }
    return starts
  }, [props.value])

  const scheduleEmitCaretLine = React.useCallback(
    (offsetRaw: number) => {
      const onCaretLine = props.onCaretLine
      if (!onCaretLine) return
      const offset = Math.max(0, Math.floor(offsetRaw || 0))
      if (lastSelectionStartRef.current === offset) return
      lastSelectionStartRef.current = offset
      if (rafIdRef.current !== null) return
      rafIdRef.current = requestAnimationFrame(() => {
        rafIdRef.current = null
        const lineStarts = getLineStarts()
        let lo = 0
        let hi = lineStarts.length - 1
        while (lo <= hi) {
          const mid = (lo + hi) >> 1
          const value = lineStarts[mid]
          if (value <= offset) lo = mid + 1
          else hi = mid - 1
        }
        const line = Math.max(1, Math.min(lineStarts.length, hi + 1))
        onCaretLine(line)
      })
    },
    [getLineStarts, props.onCaretLine],
  )

  React.useEffect(() => {
    return () => {
      const id = rafIdRef.current
      if (id === null) return
      rafIdRef.current = null
      try {
        cancelAnimationFrame(id)
      } catch {
        void 0
      }
    }
  }, [])

  return (
    <section className="kg-markdown-editor-pane flex-1 min-w-0 min-h-0 overflow-hidden flex flex-col" aria-label={props.paneAriaLabel || 'Markdown Editor'}>
      <MonacoTextEditor
        value={props.value}
        onChange={props.readOnly ? () => void 0 : props.onChange}
        language={props.language}
        uri={props.uri}
        themeMode={props.themeMode}
        wordWrap={props.wordWrap}
        readOnly={!!props.readOnly}
        forceLineNumberColumn={true}
        paddingTopPx={12}
        paddingBottomPx={12}
        className="kg-monaco-editor-shell flex-1 min-w-0 min-h-0 w-full overflow-hidden"
        textareaClassName={`kg-monaco-textarea-fallback flex-1 min-w-0 min-h-0 w-full resize-none box-border px-4 py-3 ${props.panelTypography.panelTextClass} leading-5 ${UI_THEME_TOKENS.input.bg} ${UI_THEME_TOKENS.text.primary} ${UI_THEME_TOKENS.input.border} border outline-none ${props.wordWrap ? 'whitespace-pre-wrap' : 'whitespace-pre'} overflow-auto`}
        ariaLabel={props.ariaLabel || 'Markdown Editor Text'}
        editorRef={props.editorRef}
        onHandle={props.onEditorHandle}
        onSelectionChangeOffsets={({ startOffset }) => scheduleEmitCaretLine(startOffset)}
      />
    </section>
  )
}
