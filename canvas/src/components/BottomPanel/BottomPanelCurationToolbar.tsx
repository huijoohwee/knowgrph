import React from 'react'
import ActionsRow from '@/features/panels/ui/ActionsRow'
import type { CodeAction } from '@/features/code-editor/actions'
import type { BottomTab } from '@/features/bottom-panel/open'
import { useGraphStore } from '@/hooks/useGraphStore'
import { useShallow } from 'zustand/react/shallow'

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
  const { schema, setSchema } = useGraphStore(
    useShallow(s => ({
      schema: s.schema,
      setSchema: s.setSchema,
    })),
  )
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
            Text Editor
          </button>
          {isGraphJsonView && (
            <ActionsRow
              actions={codeActions.filter(a => a.label === 'Format' || a.label === 'Apply')}
              className="flex items-center gap-2 mb-0"
            />
          )}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 mb-0">
          <select
            className="h-6 px-2 text-xs border border-gray-300 rounded bg-white text-gray-700"
            value={schema.layers?.mode || 'property'}
            onChange={(e) => {
              const raw = String(e.target.value || '')
              const nextMode =
                raw === 'semantic' || raw === 'document-structure'
                  ? raw
                  : 'property'
              const layers = schema.layers || {}
              setSchema({ ...schema, layers: { ...layers, mode: nextMode } })
            }}
          >
            <option value="property">property</option>
            <option value="document-structure">document-structure</option>
            <option value="semantic">semantic</option>
          </select>
          <button
            type="button"
            className="App-toolbar__btn text-xs bg-gray-100 text-gray-700"
            onClick={onValidateGraph}
          >
            Validate Graph
          </button>
        </div>
      </div>
    </div>
  )
}
