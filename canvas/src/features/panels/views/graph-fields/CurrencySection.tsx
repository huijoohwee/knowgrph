import React from 'react'
import type { GraphFieldSettingsResolved } from '@/features/graph-fields/graphFields'
import { useGraphStore } from '@/hooks/useGraphStore'
import type { UpdateSettings } from '@/features/panels/views/graph-fields/FieldSettingsSections.types'

export function CurrencySection({
  selectedSettings,
  updateSettings,
}: {
  selectedSettings: GraphFieldSettingsResolved
  updateSettings: UpdateSettings
}) {
  const uiPanelKeyValueTextSizeClass = useGraphStore(
    s => s.uiPanelKeyValueTextSizeClass || 'text-xs',
  )
  if (selectedSettings.fieldType !== 'Currency') return null
  return (
    <div className="rounded border border-gray-200 bg-white p-3">
      <div className="flex items-center justify-between">
        <span className={`${uiPanelKeyValueTextSizeClass} text-gray-700`}>Currency</span>
        <input
          value={selectedSettings.currencyCode}
          onChange={e => updateSettings({ currencyCode: e.target.value })}
          placeholder="USD"
          className="h-8 w-24 rounded border border-gray-300 bg-white px-2 text-xs text-gray-800"
        />
      </div>
    </div>
  )
}

