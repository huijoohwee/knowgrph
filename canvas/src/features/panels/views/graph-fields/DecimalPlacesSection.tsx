import React from 'react'
import type { GraphFieldSettingsResolved } from '@/features/graph-fields/graphFields'
import { useGraphStore } from '@/hooks/useGraphStore'
import { KTV_ROW_TEXT_SIZE_FALLBACK_CLASS_NAME } from '@/features/panels/ui/KeyTypeValueRow'
import type { UpdateSettings } from '@/features/panels/views/graph-fields/FieldSettingsSections.types'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'

export function DecimalPlacesSection({
  selectedSettings,
  updateSettings,
}: {
  selectedSettings: GraphFieldSettingsResolved
  updateSettings: UpdateSettings
}) {
  const uiPanelKeyValueTextSizeClass = useGraphStore(
    s => s.uiPanelKeyValueTextSizeClass || KTV_ROW_TEXT_SIZE_FALLBACK_CLASS_NAME,
  )
  if (selectedSettings.fieldType !== 'Decimal' && selectedSettings.fieldType !== 'Currency') return null
  const panelClassName = `rounded border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} p-3`
  const labelClassName = `${uiPanelKeyValueTextSizeClass} ${UI_THEME_TOKENS.text.secondary}`
  const selectClassName = `h-8 rounded border ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.input.bg} px-2 ${uiPanelKeyValueTextSizeClass} ${UI_THEME_TOKENS.input.text} ${UI_THEME_TOKENS.focus.primaryBorderRing}`
  return (
    <div className={panelClassName}>
      <div className="flex items-center justify-between">
        <span className={labelClassName}>Decimal places</span>
        <select
          value={String(selectedSettings.decimalPlaces)}
          onChange={e => updateSettings({ decimalPlaces: Number(e.target.value) })}
          className={selectClassName}
        >
          {Array.from({ length: 7 }).map((_, i) => (
            <option key={i} value={i}>
              {i}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
