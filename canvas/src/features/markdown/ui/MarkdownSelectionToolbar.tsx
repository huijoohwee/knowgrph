import React from 'react'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'

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
  currentView: 'viewer' | 'editor' | 'presentation' | 'slides' | 'table'
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

  const btnClass = "block w-full px-3 py-1 text-left hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"

  return (
    <div
      className={`absolute z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-md text-xs ${UI_THEME_TOKENS.text.primary} flex flex-col min-w-[160px]`}
      style={{ left: `${toolbar.x}px`, top: `${toolbar.y}px` }}
      onMouseDown={(e) => e.stopPropagation()}
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
        disabled={currentView === 'viewer'}
        onClick={() => { onShowInViewer(toolbar.startLine); onClose() }}
      >
        Show in Viewer
      </button>
      <button
        type="button"
        className={btnClass}
        disabled={currentView === 'editor'}
        onClick={() => { onShowInEditor(toolbar.startLine); onClose() }}
      >
        Show in Editor
      </button>
      <button
        type="button"
        className={btnClass}
        disabled={currentView === 'presentation'}
        onClick={() => { onShowInPresentation(toolbar.startLine); onClose() }}
      >
        Show in Presentation
      </button>
       <button
        type="button"
        className={btnClass}
        disabled={currentView === 'slides'}
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
    </div>
  )
}
