import React from 'react'
import { EXPORT_UI_LABELS } from '@/lib/config'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'

interface ToolbarHistoryAreaProps {
  onExportHistoryJsonLd: () => void
  isExportMenuOpen: boolean
  setIsExportMenuOpen: React.Dispatch<React.SetStateAction<boolean>>
}

export function ToolbarHistoryArea({
  onExportHistoryJsonLd,
  isExportMenuOpen,
  setIsExportMenuOpen,
}: ToolbarHistoryAreaProps) {
  if (!isExportMenuOpen) {
    return null
  }

  return (
    <div className="flex flex-col gap-1 px-1">
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          className={`App-toolbar__btn text-xs ${UI_THEME_TOKENS.button.neutralSubtle} ${UI_THEME_TOKENS.button.hoverBg}`}
          onClick={() => {
            onExportHistoryJsonLd()
            setIsExportMenuOpen(false)
          }}
        >
          {EXPORT_UI_LABELS.exportHistoryJsonLd}
        </button>
      </div>
    </div>
  )
}
