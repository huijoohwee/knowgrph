import React from 'react'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import type { SsotSurface } from 'grph-shared/ssot/types'
import { MoreHorizontal } from 'lucide-react'

export type MarkdownSelectionToolbarState = {
  x: number
  y: number
  startLine: number
  endLine: number
  text: string
  menuOpen?: boolean
}

export type MarkdownSelectionToolbarProps = {
  toolbar: MarkdownSelectionToolbarState | null
  onClose: () => void
  onShowOnCanvas: (startLine: number, endLine: number) => void
  onShowInViewer: (line: number) => void
  onShowInEditor: (line: number) => void
  onShowInPresentation: (line: number) => void
  onShowInSlidesGallery: (line: number) => void
  onShowInGraphDataTable: (line: number) => void
  currentView: SsotSurface
}

export function MarkdownSelectionToolbar(props: MarkdownSelectionToolbarProps) {
  const {
    toolbar,
    onClose,
    onShowOnCanvas,
    onShowInViewer,
    onShowInEditor,
    onShowInPresentation,
    onShowInSlidesGallery,
    onShowInGraphDataTable,
    currentView
  } = props

  const [menuOpen, setMenuOpen] = React.useState<boolean>(!!toolbar?.menuOpen)
  React.useEffect(() => {
    if (!toolbar) {
      setMenuOpen(false)
      return
    }
    setMenuOpen(!!toolbar.menuOpen)
  }, [toolbar?.endLine, toolbar?.menuOpen, toolbar?.startLine, toolbar?.text, toolbar?.x, toolbar?.y])
  if (!toolbar) return null
  const btnClass = `block w-full px-3 py-1 text-left ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg} disabled:opacity-50 disabled:cursor-not-allowed`
  const bubbleButtonClass = `inline-flex items-center justify-center rounded border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg} h-7 w-7`

  return (
    <section
      className="absolute z-50"
      style={{ left: `${toolbar.x}px`, top: `${toolbar.y}px` }}
      onPointerDown={e => e.stopPropagation()}
      onMouseDown={e => e.stopPropagation()}
      aria-label="Selection actions"
    >
      <button
        type="button"
        aria-label="Selection actions"
        className={bubbleButtonClass}
        onClick={() => setMenuOpen(prev => !prev)}
      >
        <MoreHorizontal className="w-3.5 h-3.5" />
      </button>
      {menuOpen ? (
        <menu
          className={`absolute left-0 mt-1 z-50 ${UI_THEME_TOKENS.panel.bg} border ${UI_THEME_TOKENS.panel.border} rounded shadow-md text-xs ${UI_THEME_TOKENS.text.primary} flex flex-col min-w-[180px] list-none m-0 p-0`}
          role="menu"
        >
          <button
            type="button"
            className={btnClass}
            onClick={() => { onShowOnCanvas(toolbar.startLine, toolbar.endLine); onClose() }}
          >
            Show on Canvas
          </button>
          <button
            type="button"
            className={btnClass}
            disabled={currentView === 'markdown.viewer'}
            onClick={() => { onShowInViewer(toolbar.startLine); onClose() }}
          >
            Show in Viewer
          </button>
          <button
            type="button"
            className={btnClass}
            disabled={currentView === 'markdown.editor'}
            onClick={() => { onShowInEditor(toolbar.startLine); onClose() }}
          >
            Show in Editor
          </button>
          <button
            type="button"
            className={btnClass}
            disabled={currentView === 'markdown.presentation'}
            onClick={() => { onShowInPresentation(toolbar.startLine); onClose() }}
          >
            Show in Presentation
          </button>
          <button
            type="button"
            className={btnClass}
            disabled={currentView === 'markdown.slides'}
            onClick={() => { onShowInSlidesGallery(toolbar.startLine); onClose() }}
          >
            Show in Slides Gallery
          </button>
          <button
            type="button"
            className={btnClass}
            disabled={currentView === 'table'}
            onClick={() => { onShowInGraphDataTable(toolbar.startLine); onClose() }}
          >
            Show in Graph Data Table
          </button>
        </menu>
      ) : null}
    </section>
  )
}
