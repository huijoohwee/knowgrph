import React from 'react'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import type { SsotSurface } from 'grph-shared/ssot/types'

export type MarkdownSelectionToolbarState = {
  x: number
  y: number
  startLine: number
  endLine: number
  text: string
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

  if (!toolbar) return null

  const btnClass = `block w-full px-3 py-1 text-left ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg} disabled:opacity-50 disabled:cursor-not-allowed`

  return (
    <menu
      className={`absolute z-50 ${UI_THEME_TOKENS.panel.bg} border ${UI_THEME_TOKENS.panel.border} rounded shadow-md text-xs ${UI_THEME_TOKENS.text.primary} flex flex-col min-w-[160px] list-none m-0 p-0`}
      style={{ left: `${toolbar.x}px`, top: `${toolbar.y}px` }}
      onPointerDown={e => e.stopPropagation()}
      aria-label="Selection actions"
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
  )
}
