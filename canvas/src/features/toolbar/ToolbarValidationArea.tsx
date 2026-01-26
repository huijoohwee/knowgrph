import React from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'
import { EXPORT_UI_LABELS } from '@/lib/config'

interface ToolbarValidationAreaProps {
  isExportMenuOpen: boolean
  setIsExportMenuOpen: React.Dispatch<React.SetStateAction<boolean>>
  hasSelection: boolean
  onExportValidationJson: () => void
  onExportValidationMarkdown: () => void
  onExportSelectionValidationJson?: () => void
  onExportSelectionValidationMarkdown?: () => void
}

export function ToolbarValidationArea({
  isExportMenuOpen,
  setIsExportMenuOpen,
  hasSelection,
  onExportValidationJson,
  onExportValidationMarkdown,
  onExportSelectionValidationJson,
  onExportSelectionValidationMarkdown,
}: ToolbarValidationAreaProps) {
  const uiPanelKeyValueTextSizeClass = useGraphStore(
    s => s.uiPanelKeyValueTextSizeClass || 'text-xs',
  )

  if (!isExportMenuOpen) {
    return null
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center justify-end gap-1">
        <button
          type="button"
          className={`App-toolbar__btn ${uiPanelKeyValueTextSizeClass} bg-gray-50 text-gray-700`}
          onClick={() => {
            onExportValidationJson()
            setIsExportMenuOpen(false)
          }}
        >
          {EXPORT_UI_LABELS.exportValidationJson}
        </button>
        <button
          type="button"
          className={`App-toolbar__btn ${uiPanelKeyValueTextSizeClass} bg-gray-50 text-gray-700`}
          onClick={() => {
            onExportValidationMarkdown()
            setIsExportMenuOpen(false)
          }}
        >
          {EXPORT_UI_LABELS.exportValidationMarkdown}
        </button>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-1">
        <button
          type="button"
          className={`App-toolbar__btn ${uiPanelKeyValueTextSizeClass} bg-gray-50 text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed`}
          onClick={() => {
            if (onExportSelectionValidationJson) {
              onExportSelectionValidationJson()
            }
            setIsExportMenuOpen(false)
          }}
          disabled={!hasSelection || !onExportSelectionValidationJson}
        >
          {EXPORT_UI_LABELS.exportSelectionValidationJson}
        </button>
        <button
          type="button"
          className={`App-toolbar__btn ${uiPanelKeyValueTextSizeClass} bg-gray-50 text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed`}
          onClick={() => {
            if (onExportSelectionValidationMarkdown) {
              onExportSelectionValidationMarkdown()
            }
            setIsExportMenuOpen(false)
          }}
          disabled={!hasSelection || !onExportSelectionValidationMarkdown}
        >
          {EXPORT_UI_LABELS.exportSelectionValidationMarkdown}
        </button>
      </div>
    </div>
  )
}
