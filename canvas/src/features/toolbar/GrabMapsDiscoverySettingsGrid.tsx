import React from 'react'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { UI_RESPONSIVE_COMPACT_PANEL_FIELD_INPUT_CLASSNAME } from '@/lib/ui/responsiveElementClasses'
import {
  GRABMAPS_DISCOVERY_FIELD_META,
  GRABMAPS_DISCOVERY_SETTING_SPECS,
} from '@/features/integrations/grabMapsSsot'
import {
  writeGrabMapsDiscoverySettingsValues,
  type GrabMapsDiscoverySettingsValues,
} from '@/features/flow-editor-manager/grabMapsDiscoveryWidget'

function getDiscoverySettingTypeLabel(settingKey: string): string {
  const spec = GRABMAPS_DISCOVERY_SETTING_SPECS[settingKey as keyof typeof GRABMAPS_DISCOVERY_SETTING_SPECS]
  if (!spec) return 'string'
  if (spec.options && spec.options.length > 0) return 'enum'
  return spec.valueType === 'number' ? 'number' : 'string'
}

export function GrabMapsDiscoverySettingsGrid(props: {
  settingsValues: GrabMapsDiscoverySettingsValues
  setSettingsValues: React.Dispatch<React.SetStateAction<GrabMapsDiscoverySettingsValues>>
  setQueryText: React.Dispatch<React.SetStateAction<string>>
  selectedNodeActive: boolean
  uiPanelMicroLabelTextSizeClass: string
}) {
  return (
    <section className={`rounded border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} p-3 space-y-2`}>
      <div className={`grid grid-cols-[1.6fr_0.8fr_1.6fr] gap-2 ${props.uiPanelMicroLabelTextSizeClass} ${UI_THEME_TOKENS.text.tertiary}`}>
        <span>Key</span>
        <span>Type</span>
        <span>Value</span>
      </div>
      <div className="space-y-2">
        {GRABMAPS_DISCOVERY_FIELD_META.map(field => {
          const settingKey = field.settingKey
          const spec = GRABMAPS_DISCOVERY_SETTING_SPECS[settingKey]
          const currentValue = props.settingsValues[settingKey]
          const typeLabel = getDiscoverySettingTypeLabel(settingKey)
          const valueText = typeof currentValue === 'undefined' ? String(spec?.defaultValue ?? '') : String(currentValue)
          const patch = (nextValue: unknown) => {
            const patched = { ...props.settingsValues, [settingKey]: nextValue } as GrabMapsDiscoverySettingsValues
            props.setSettingsValues(patched)
            writeGrabMapsDiscoverySettingsValues(patched)
          }
          return (
            <div key={field.propertyKey} className="grid grid-cols-[1.6fr_0.8fr_1.6fr] gap-2 items-center">
              <span className={`${props.uiPanelMicroLabelTextSizeClass} ${UI_THEME_TOKENS.text.secondary} truncate`} title={settingKey}>
                {settingKey}
              </span>
              <span className={`${props.uiPanelMicroLabelTextSizeClass} ${UI_THEME_TOKENS.text.tertiary}`}>{typeLabel}</span>
              {field.fieldType === 'select' && spec?.options?.length ? (
                <select
                  value={valueText}
                  onChange={event => patch(String(event.target.value || '').trim())}
                  className={`${UI_RESPONSIVE_COMPACT_PANEL_FIELD_INPUT_CLASSNAME} rounded border ${props.uiPanelMicroLabelTextSizeClass} ${UI_THEME_TOKENS.input.bg} ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.text.primary}`}
                >
                  {spec.options.map(option => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              ) : field.fieldType === 'number' ? (
                <input
                  type="number"
                  value={valueText}
                  onChange={event => {
                    const parsed = Number(String(event.target.value || '').trim())
                    patch(Number.isFinite(parsed) ? parsed : spec?.defaultValue)
                  }}
                  className={`${UI_RESPONSIVE_COMPACT_PANEL_FIELD_INPUT_CLASSNAME} rounded border ${props.uiPanelMicroLabelTextSizeClass} ${UI_THEME_TOKENS.input.bg} ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.text.primary}`}
                />
              ) : (
                <input
                  value={valueText}
                  onChange={event => {
                    const next = String(event.target.value || '')
                    patch(next)
                    if (settingKey === 'maps.grabmaps.mcp.searchPlaces.query') props.setQueryText(next)
                  }}
                  placeholder={field.placeholder}
                  className={`${UI_RESPONSIVE_COMPACT_PANEL_FIELD_INPUT_CLASSNAME} rounded border ${props.uiPanelMicroLabelTextSizeClass} ${UI_THEME_TOKENS.input.bg} ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.text.primary}`}
                />
              )}
            </div>
          )
        })}
      </div>
      {props.selectedNodeActive ? (
        <p className={`${props.uiPanelMicroLabelTextSizeClass} ${UI_THEME_TOKENS.text.secondary}`}>
          Selected widget local values override global discovery defaults at run time.
        </p>
      ) : null}
    </section>
  )
}
