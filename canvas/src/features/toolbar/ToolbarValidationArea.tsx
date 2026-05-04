import React from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'
import { EXPORT_UI_LABELS } from '@/lib/config'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'

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
  const neutralToolbarButtonClassName = `App-toolbar__btn ${uiPanelKeyValueTextSizeClass} ${UI_THEME_TOKENS.button.neutralSubtle} ${UI_THEME_TOKENS.button.hoverBg}`

  if (!isExportMenuOpen) {
    return null
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center justify-end gap-1">
        <button
          type="button"
          className={neutralToolbarButtonClassName}
          onClick={() => {
            onExportValidationJson()
            setIsExportMenuOpen(false)
          }}
        >
          {EXPORT_UI_LABELS.exportValidationJson}
        </button>
        <button
          type="button"
          className={neutralToolbarButtonClassName}
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
          className={`${neutralToolbarButtonClassName} disabled:opacity-40 disabled:cursor-not-allowed`}
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
          className={`${neutralToolbarButtonClassName} disabled:opacity-40 disabled:cursor-not-allowed`}
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
