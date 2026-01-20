import React from 'react'
import ActionsRow from '@/features/panels/ui/ActionsRow'
import type { CodeAction } from '@/features/code-editor/actions'
import type { BottomTab } from '@/features/bottom-panel/open'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'

type BottomPanelCurationView = 'grid' | 'json' | 'markdown'

type BottomPanelCurationToolbarProps = {
  tab: BottomTab
  bottomPanelCurationView: BottomPanelCurationView
  isGraphJsonView: boolean
  codeActions: CodeAction[]
  toggleButtonClassName: (isActive: boolean) => string
  openPanelTab: (tab: BottomTab) => void
  setBottomPanelCurationView: (view: BottomPanelCurationView) => void
  onValidateGraph: () => void
}

export default function BottomPanelCurationToolbar({
  tab,
  bottomPanelCurationView,
  isGraphJsonView,
  codeActions,
  toggleButtonClassName,
  openPanelTab,
  setBottomPanelCurationView,
  onValidateGraph,
}: BottomPanelCurationToolbarProps) {
  const isTextEditorActive = isGraphJsonView
  const isMarkdownActive = tab === 'curation' && bottomPanelCurationView === 'markdown'

  return (
    <div className="px-3 py-2 border-t border-gray-200">
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={toggleButtonClassName(tab === 'curation' && bottomPanelCurationView === 'grid')}
            onClick={() => {
              setBottomPanelCurationView('grid')
              openPanelTab('curation')
            }}
          >
            UI Editor
          </button>
          <button
            type="button"
            className={toggleButtonClassName(isMarkdownActive)}
            onClick={() => {
              setBottomPanelCurationView('markdown')
              openPanelTab('curation')
            }}
          >
            Markdown Section
          </button>
          <button
            type="button"
            className={toggleButtonClassName(isTextEditorActive)}
            onClick={() => {
              setBottomPanelCurationView('json')
              openPanelTab('curation')
            }}
          >
            JSON Editor
          </button>
          {isGraphJsonView && (
            <ActionsRow
              actions={codeActions.filter(a => a.label === 'Format' || a.label === 'Apply')}
              className="flex items-center gap-2 mb-0"
            />
          )}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 mb-0">
          <button
            type="button"
            className={`App-toolbar__btn text-xs ${UI_THEME_TOKENS.panel.headerBg} ${UI_THEME_TOKENS.text.secondary}`}
            onClick={onValidateGraph}
          >
            Validate Graph
          </button>
        </div>
      </div>
    </div>
  )
}
