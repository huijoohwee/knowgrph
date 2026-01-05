import React from 'react'
import { ChevronDown } from 'lucide-react'
import IconButton from '@/components/IconButton'
import { useGraphStore } from '@/hooks/useGraphStore'
import { getIconSizeClass } from '@/lib/ui'

type BottomPanelSchemaToolbarProps = {
  schemaUiEditorOpen: boolean
  toggleButtonClassName: (isActive: boolean) => string
  setSchemaUiEditorOpen: (next: boolean) => void
  allSchemaSectionsCollapsed: boolean
  handleSchemaUiCollapseAll: () => void
  handleSchemaUiExpandAll: () => void
}

export default function BottomPanelSchemaToolbar({
  schemaUiEditorOpen,
  toggleButtonClassName,
  setSchemaUiEditorOpen,
  allSchemaSectionsCollapsed,
  handleSchemaUiCollapseAll,
  handleSchemaUiExpandAll,
}: BottomPanelSchemaToolbarProps) {
  const uiIconScale = useGraphStore(s => s.uiIconScale)
  const uiIconStrokeWidth = useGraphStore(s => s.uiIconStrokeWidth)
  const iconSizeClass = getIconSizeClass(uiIconScale)
  return (
    <div className="px-3 py-2 border-t border-gray-200">
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={toggleButtonClassName(schemaUiEditorOpen)}
            onClick={() => setSchemaUiEditorOpen(true)}
          >
            UI Editor
          </button>
          <button
            type="button"
            className={toggleButtonClassName(!schemaUiEditorOpen)}
            onClick={() => setSchemaUiEditorOpen(false)}
          >
            Text Editor
          </button>
        </div>
        {schemaUiEditorOpen && (
          <IconButton
            className="App-toolbar__btn flex items-center justify-center"
            title={allSchemaSectionsCollapsed ? 'Expand All' : 'Collapse All'}
            onClick={allSchemaSectionsCollapsed ? handleSchemaUiExpandAll : handleSchemaUiCollapseAll}
            showTooltip
          >
            <ChevronDown
              className={`${iconSizeClass} text-gray-700 transition-transform ${
                allSchemaSectionsCollapsed ? '' : 'rotate-180'
              }`}
              strokeWidth={uiIconStrokeWidth}
              aria-hidden="true"
            />
          </IconButton>
        )}
      </div>
    </div>
  )
}
