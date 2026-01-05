import React from 'react'
import { EXPORT_UI_LABELS } from '@/lib/config'

interface ToolbarSettingsAreaProps {
  onExportSettingsJsonLd: () => void
  isExportMenuOpen: boolean
  setIsExportMenuOpen: React.Dispatch<React.SetStateAction<boolean>>
}

export function ToolbarSettingsArea({
  onExportSettingsJsonLd,
  isExportMenuOpen,
  setIsExportMenuOpen,
}: ToolbarSettingsAreaProps) {
  if (!isExportMenuOpen) {
    return null
  }

  return (
    <div className="flex flex-col gap-1 px-1">
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          className="App-toolbar__btn text-xs bg-gray-50 text-gray-700"
          onClick={() => {
            onExportSettingsJsonLd()
            setIsExportMenuOpen(false)
          }}
        >
          {EXPORT_UI_LABELS.exportSettingsJsonLd}
        </button>
      </div>
    </div>
  )
}
