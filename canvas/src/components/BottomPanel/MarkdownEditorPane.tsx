import React from 'react'
import { MonacoTextEditor, type MonacoTextEditorHandle } from '@/features/monaco/MonacoTextEditor'
import { MarkdownSelectionToolbar, type MarkdownSelectionToolbarState } from '@/features/markdown/ui/MarkdownSelectionToolbar'
import type * as Monaco from 'monaco-editor/esm/vs/editor/editor.api'

type MarkdownEditorPaneProps = {
  editorTextAreaRef: React.RefObject<MonacoTextEditorHandle | null>
  markdownText: string
  markdownDocumentName: string | null
  markdownWordWrap: boolean
  editorPaddingTopPx?: number
  setMarkdownText: (next: string) => void
  onShowOnCanvas: (startLine: number, endLine: number) => void
  onShowInViewer: (line: number) => void
  onScrollViewerToLine?: (line: number) => void
  onShowInPresentation: (line: number) => void
  onShowInSlidesGallery: (line: number) => void
  onShowInGraphDataTable: (line: number) => void
  triggerJump: (line: number) => void
  flashLine?: number | null
  themeMode: 'light' | 'dark'
}

export function MarkdownEditorPane(props: MarkdownEditorPaneProps) {
  const {
    editorTextAreaRef,
    markdownText,
    markdownDocumentName,
    markdownWordWrap,
    editorPaddingTopPx,
    setMarkdownText,
    onShowOnCanvas,
    onShowInViewer,
    onScrollViewerToLine,
    onShowInPresentation,
    onShowInSlidesGallery,
    onShowInGraphDataTable,
    triggerJump,
    flashLine,
    themeMode,
  } = props

  const editorContainerRef = React.useRef<HTMLElement | null>(null)
  const [selectionToolbar, setSelectionToolbar] = React.useState<MarkdownSelectionToolbarState | null>(null)

  const closeSelectionToolbar = React.useCallback(() => {
    setSelectionToolbar(null)
  }, [])

  const offsetToLine = React.useCallback((text: string, offset: number) => {
    const safeOffset = Math.max(0, Math.floor(offset || 0))
    const prefix = text.slice(0, safeOffset)
    let line = 1
    for (let i = 0; i < prefix.length; i += 1) {
      if (prefix.charCodeAt(i) === 10) line += 1
    }
    return line
  }, [])

  const handleEditorDoubleClickLine = React.useCallback(
    (line: number) => {
      if (line <= 0) return
      const lines = String(markdownText || '').split('\n')
      let idx = Math.min(Math.max(line - 1, 0), Math.max(lines.length - 1, 0))
      while (idx > 0 && String(lines[idx - 1] || '').trim() !== '') idx -= 1
      const blockStartLine = idx + 1
      if (onScrollViewerToLine) {
        onScrollViewerToLine(blockStartLine)
        return
      }
      onShowInViewer(blockStartLine)
    },
    [markdownText, onScrollViewerToLine, onShowInViewer],
  )

  React.useEffect(() => {
    if (!selectionToolbar) return
    const handler = () => closeSelectionToolbar()
    window.addEventListener('mousedown', handler)
    return () => window.removeEventListener('mousedown', handler)
  }, [selectionToolbar, closeSelectionToolbar])

  const handleEditorSelection = React.useCallback(
    (args: { startLine: number; endLine: number; text: string; event: Monaco.editor.IEditorMouseEvent }) => {
      const { startLine, endLine, text, event } = args
      const rect = editorContainerRef.current?.getBoundingClientRect()
      if (!rect) return

      if (text && text.trim().length > 0) {
        const clientX = event.event.posx
        const clientY = event.event.posy
        const x = clientX - rect.left
        const y = clientY - rect.top

        setSelectionToolbar({
          x,
          y,
          startLine,
          endLine,
          text,
        })
      }
    },
    [],
  )

  const handleEditorContextMenu = React.useCallback(
    (args: { startLine: number; endLine: number; text?: string; event: Monaco.editor.IEditorMouseEvent }) => {
      const { startLine, endLine, text, event } = args
      const rect = editorContainerRef.current?.getBoundingClientRect()
      if (!rect) return

      const clientX = event.event.posx
      const clientY = event.event.posy
      const x = clientX - rect.left
      const y = clientY - rect.top

      setSelectionToolbar({
        x,
        y,
        startLine,
        endLine,
        text: text || '',
      })
    },
    [],
  )

  return (
    <article ref={editorContainerRef} className="flex flex-1 min-h-0 relative h-full w-full max-w-none">
      <MonacoTextEditor
        editorRef={editorTextAreaRef}
        value={markdownText}
        language="markdown"
        uri={`file:///${markdownDocumentName || 'readme.md'}`}
        themeMode={themeMode}
        wordWrap={markdownWordWrap}
        paddingTopPx={editorPaddingTopPx}
        className="flex-1 h-full min-w-0"
        onChange={next => {
          setMarkdownText(next)
        }}
        onContextMenuSelection={handleEditorSelection}
        onContextMenu={handleEditorContextMenu}
        onDoubleClickLine={handleEditorDoubleClickLine}
        flashLine={flashLine}
      />
      {selectionToolbar && (
        <MarkdownSelectionToolbar
          toolbar={selectionToolbar}
          onClose={closeSelectionToolbar}
          onShowOnCanvas={onShowOnCanvas}
          onShowInViewer={onShowInViewer}
          onShowInEditor={(line) => {
            triggerJump(line)
          }}
          onShowInPresentation={onShowInPresentation}
          onShowInSlidesGallery={onShowInSlidesGallery}
          onShowInGraphDataTable={onShowInGraphDataTable}
          currentView="markdown.editor"
        />
      )}
    </article>
  )
}
