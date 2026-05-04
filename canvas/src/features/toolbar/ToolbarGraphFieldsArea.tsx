import React from 'react'
import StatusBadge from '@/features/panels/ui/StatusBadge'
import { EXPORT_UI_LABELS, UI_LABELS } from '@/lib/config'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'

interface ToolbarGraphFieldsAreaProps {
  graphFieldsOpOk: boolean | null
  graphFieldsOpMsg: string | null
  onExportGraphFieldSettingsJsonLd: () => void
  isExportMenuOpen: boolean
  setIsExportMenuOpen: React.Dispatch<React.SetStateAction<boolean>>
}

export function ToolbarGraphFieldsArea({
  graphFieldsOpOk,
  graphFieldsOpMsg,
  onExportGraphFieldSettingsJsonLd,
  isExportMenuOpen,
  setIsExportMenuOpen,
}: ToolbarGraphFieldsAreaProps) {
  return (
    <div className="flex flex-col gap-1">
      {isExportMenuOpen && (
        <div className="flex items-center justify-end gap-1 px-1">
          <button
            type="button"
            className={`App-toolbar__btn text-xs ${UI_THEME_TOKENS.button.neutralSubtle} ${UI_THEME_TOKENS.button.hoverBg}`}
            onClick={() => {
              onExportGraphFieldSettingsJsonLd()
              setIsExportMenuOpen(false)
            }}
          >
            {EXPORT_UI_LABELS.exportGraphFieldSettingsJsonLd}
          </button>
        </div>
      )}
      <div className="flex items-center justify-end gap-2">
        <StatusBadge label={UI_LABELS.graphFields} ok={graphFieldsOpOk} msg={graphFieldsOpMsg || undefined} />
      </div>
    </div>
  )
}
