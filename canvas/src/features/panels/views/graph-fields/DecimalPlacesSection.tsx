import React from 'react'
import type { GraphFieldSettingsResolved } from '@/features/graph-fields/graphFields'
import { useGraphStore } from '@/hooks/useGraphStore'
import { KTV_ROW_TEXT_SIZE_FALLBACK_CLASS_NAME } from 'grph-shared/ui/keyTypeValueRows'
import type { UpdateSettings } from '@/features/panels/views/graph-fields/FieldSettingsSections.types'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { UI_RESPONSIVE_GRAPH_FIELDS_FIELD_INPUT_CLASSNAME } from '@/lib/ui/responsiveElementClasses'

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
  const selectClassName = `${UI_RESPONSIVE_GRAPH_FIELDS_FIELD_INPUT_CLASSNAME} rounded border ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.input.bg} ${uiPanelKeyValueTextSizeClass} ${UI_THEME_TOKENS.input.text} ${UI_THEME_TOKENS.focus.primaryBorderRing}`
  return (
    <section className={panelClassName}>
      <section className="flex items-center justify-between">
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
      </section>
    </section>
  )
}
