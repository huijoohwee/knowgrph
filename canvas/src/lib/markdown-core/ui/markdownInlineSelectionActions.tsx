import React from 'react'
import type { SsotSurface } from 'grph-shared/ssot/types'

export type MarkdownInlineSelectionActions = {
  onShowOnCanvas: (startLine: number, endLine: number) => void
  onShowInViewer: (line: number) => void
  onShowInEditor: (line: number) => void
  onShowInPresentation: (line: number) => void
  onShowInSlidesGallery: (line: number) => void
  onShowInGraphDataTable: (line: number) => void
  currentView: SsotSurface
}

export const MarkdownInlineSelectionActionsContext = React.createContext<MarkdownInlineSelectionActions | null>(null)

export const useMarkdownInlineSelectionActions = (): MarkdownInlineSelectionActions | null =>
  React.useContext(MarkdownInlineSelectionActionsContext)

