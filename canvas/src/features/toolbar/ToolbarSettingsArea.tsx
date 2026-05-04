import React from 'react'
import { EXPORT_UI_LABELS } from '@/lib/config'
import { useGraphStore } from '@/hooks/useGraphStore'
import { uiPrimaryIconActiveClassName } from '@/features/toolbar/ui/toolbarStyles'
import { RICH_MEDIA_DISPLAY_COPY } from '@/lib/render/richMediaSsot'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'

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
  const renderMediaAsNodes = useGraphStore(s => s.renderMediaAsNodes)
  const setRenderMediaAsNodes = useGraphStore(s => s.setRenderMediaAsNodes)

  if (!isExportMenuOpen) {
    return null
  }

  return (
    <div className="flex flex-col gap-1 px-1">
      <div className="flex items-center justify-end gap-2">
        <label className={`flex items-center gap-1 text-xs ${UI_THEME_TOKENS.text.primary} cursor-pointer select-none`}>
          <input
            type="checkbox"
            checked={renderMediaAsNodes}
            onChange={e => setRenderMediaAsNodes(e.target.checked)}
            className={`w-3 h-3 rounded ${UI_THEME_TOKENS.input.border} ${uiPrimaryIconActiveClassName} ${UI_THEME_TOKENS.input.selectionControl}`}
          />
          {RICH_MEDIA_DISPLAY_COPY.toggleTitle}
        </label>
        <span className={`text-[10px] ${UI_THEME_TOKENS.text.tertiary}`}>
          {RICH_MEDIA_DISPLAY_COPY.tooltip}
        </span>
        <button
          type="button"
          className={`App-toolbar__btn text-xs ${UI_THEME_TOKENS.button.neutralSubtle} ${UI_THEME_TOKENS.button.hoverBg}`}
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
