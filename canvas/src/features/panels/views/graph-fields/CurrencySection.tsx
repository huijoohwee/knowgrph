import React from 'react'
import type { GraphFieldSettingsResolved } from '@/features/graph-fields/graphFields'
import { useGraphStore } from '@/hooks/useGraphStore'
import { KTV_ROW_TEXT_SIZE_FALLBACK_CLASS_NAME } from 'grph-shared/ui/keyTypeValueRows'
import type { UpdateSettings } from '@/features/panels/views/graph-fields/FieldSettingsSections.types'
import { GraphFieldsShortTextInput } from '@/features/panels/views/graph-fields/GraphFieldsPanelControls'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'

export function CurrencySection({
  selectedSettings,
  updateSettings,
}: {
  selectedSettings: GraphFieldSettingsResolved
  updateSettings: UpdateSettings
}) {
  const uiPanelKeyValueTextSizeClass = useGraphStore(
    s => s.uiPanelKeyValueTextSizeClass || KTV_ROW_TEXT_SIZE_FALLBACK_CLASS_NAME,
  )
  if (selectedSettings.fieldType !== 'Currency') return null
  const panelClassName = `rounded border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} p-3`
  const labelClassName = `${uiPanelKeyValueTextSizeClass} ${UI_THEME_TOKENS.text.secondary}`
  return (
    <section className={panelClassName}>
      <section className="flex items-center justify-between">
        <span className={labelClassName}>Currency</span>
        <GraphFieldsShortTextInput
          value={selectedSettings.currencyCode}
          onChange={e => updateSettings({ currencyCode: e.target.value })}
          placeholder="USD"
          textSizeClassName={uiPanelKeyValueTextSizeClass}
        />
      </section>
    </section>
  )
}
