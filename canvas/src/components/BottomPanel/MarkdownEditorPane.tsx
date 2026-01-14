import React from 'react'
import { MonacoTextEditor, type MonacoTextEditorHandle } from '@/features/monaco/MonacoTextEditor'
import { MarkdownSelectionToolbar, type MarkdownSelectionToolbarState } from '@/features/markdown/ui/MarkdownSelectionToolbar'
import type * as Monaco from 'monaco-editor/esm/vs/editor/editor.api'

type MarkdownEditorPaneProps = {
  editorTextAreaRef: React.RefObject<MonacoTextEditorHandle | null>
  markdownText: string
  markdownDocumentName: string | null
  markdownWordWrap: boolean
  setMarkdownText: (next: string) => void
  setMarkdownDocument: (name: string | null, text: string) => void
  onShowOnCanvas: (startLine: number, endLine: number) => void
  onShowInViewer: (line: number) => void
  onShowInPresentation: () => void
  onShowInSlidesGallery: (line: number) => void
  onShowInGraphDataTable: (line: number) => void
  triggerJump: (line: number) => void
  flashLine?: number | null
}

export function MarkdownEditorPane(props: MarkdownEditorPaneProps) {
  const {
    editorTextAreaRef,
    markdownText,
    markdownDocumentName,
    markdownWordWrap,
    setMarkdownText,
    setMarkdownDocument,
    onShowOnCanvas,
    onShowInViewer,
    onShowInPresentation,
    onShowInSlidesGallery,
    onShowInGraphDataTable,
    triggerJump,
    flashLine,
  } = props

  const editorContainerRef = React.useRef<HTMLDivElement>(null)
  const [selectionToolbar, setSelectionToolbar] = React.useState<MarkdownSelectionToolbarState | null>(null)

  const closeSelectionToolbar = React.useCallback(() => {
    setSelectionToolbar(null)
  }, [])

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
        const y = clientY - rect.top + 20

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
    <div ref={editorContainerRef} className="flex flex-1 min-h-0 relative h-full">
      <div className="flex-1 h-full min-w-0">
        <MonacoTextEditor
          editorRef={editorTextAreaRef}
          value={markdownText}
          language="markdown"
          uri={`file:///${markdownDocumentName || 'readme.md'}`}
          themeMode="light"
          wordWrap={markdownWordWrap}
          className="w-full h-full"
          onChange={next => {
            setMarkdownText(next)
            setMarkdownDocument(markdownDocumentName, next)
          }}
          onContextMenuSelection={handleEditorSelection}
          onDoubleClickSelection={handleEditorSelection}
          onContextMenu={handleEditorContextMenu}
          flashLine={flashLine}
        />
      </div>
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
          currentView="editor"
        />
      )}
    </div>
  )
}
