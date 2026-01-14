import React from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'
import { MonacoTextEditor, type MonacoTextEditorHandle } from '@/features/monaco/MonacoTextEditor'
import { useRootThemeMode } from '@/features/panels/views/preview-panel/ui/mermaidConfig'

import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'

type CodeEditorHandlers = {
  onChange: (value: string) => void
  onSelectionChange: (start: number, end: number) => void
  onDoubleClick: (start: number, end: number) => void
  onBlur: () => void
}

interface BottomPanelCodeTabProps {
  codeText: string
  codeError: string
  codeRef: React.RefObject<MonacoTextEditorHandle | null>
  handlers: CodeEditorHandlers
  readOnly?: boolean
  header?: React.ReactNode
  footer?: React.ReactNode
}

export default function BottomPanelCodeTab({
  codeText,
  codeError,
  codeRef,
  handlers,
  readOnly = false,
  header,
  footer,
}: BottomPanelCodeTabProps) {
  const uiPanelMonospaceTextClass = useGraphStore(
    s => s.uiPanelMonospaceTextClass || 'font-mono text-xs',
  )
  const uiPanelMicroLabelTextSizeClass = useGraphStore(
    s => s.uiPanelMicroLabelTextSizeClass || 'text-xs',
  )
  const rootThemeMode = useRootThemeMode()

  return (
    <section className="h-full min-h-0 flex flex-col">
      {header && (
        <header className="mb-2 shrink-0">
          {header}
        </header>
      )}
      {codeError && (
        <div className={`mt-2 ${uiPanelMicroLabelTextSizeClass} text-red-600 shrink-0`}>
          {codeError}
        </div>
      )}
      <div
        className={[
          'relative flex-1 min-h-0 border rounded overflow-hidden',
          UI_THEME_TOKENS.input.border,
          UI_THEME_TOKENS.input.bg,
          UI_THEME_TOKENS.input.text,
        ].join(' ')}
      >
        <MonacoTextEditor
          editorRef={codeRef}
          value={codeText}
          onChange={handlers.onChange}
          language="json"
          uri="inmemory://model/graph.json"
          themeMode={rootThemeMode}
          readOnly={readOnly}
          className={`w-full h-full ${uiPanelMonospaceTextClass}`}
          onSelectionChangeOffsets={({ startOffset, endOffset }) => handlers.onSelectionChange(startOffset, endOffset)}
          onDoubleClickSelectionOffsets={({ startOffset, endOffset }) => handlers.onDoubleClick(startOffset, endOffset)}
          onBlur={handlers.onBlur}
        />
      </div>
      {footer && (
        <div className="mt-2 shrink-0">
          {footer}
        </div>
      )}
    </section>
  )
}
