import React from 'react'
import type { GraphFieldSettingsResolved } from '@/features/graph-fields/graphFields'
import { useGraphStore } from '@/hooks/useGraphStore'
import type { UpdateSettings } from '@/features/panels/views/graph-fields/FieldSettingsSections.types'

export function DecimalPlacesSection({
  selectedSettings,
  updateSettings,
}: {
  selectedSettings: GraphFieldSettingsResolved
  updateSettings: UpdateSettings
}) {
  const uiPanelKeyValueTextSizeClass = useGraphStore(
    s => s.uiPanelKeyValueTextSizeClass || 'text-xs',
  )
  if (selectedSettings.fieldType !== 'Decimal' && selectedSettings.fieldType !== 'Currency') return null
  return (
    <div className="rounded border border-gray-200 bg-white p-3">
      <div className="flex items-center justify-between">
        <span className={`${uiPanelKeyValueTextSizeClass} text-gray-700`}>Decimal places</span>
        <select
          value={String(selectedSettings.decimalPlaces)}
          onChange={e => updateSettings({ decimalPlaces: Number(e.target.value) })}
          className="h-8 rounded border border-gray-300 bg-white px-2 text-xs text-gray-800"
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

