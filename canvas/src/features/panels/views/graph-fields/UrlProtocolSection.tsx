import React from 'react'
import type { GraphFieldSettingsResolved, GraphFieldUrlProtocol } from '@/features/graph-fields/graphFields'
import { useGraphStore } from '@/hooks/useGraphStore'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import type { UpdateSettings } from '@/features/panels/views/graph-fields/FieldSettingsSections.types'

export function UrlProtocolSection({
  selectedSettings,
  updateSettings,
}: {
  selectedSettings: GraphFieldSettingsResolved
  updateSettings: UpdateSettings
}) {
  const uiPanelKeyValueTextSizeClass = useGraphStore(
    s => s.uiPanelKeyValueTextSizeClass || 'text-xs',
  )
  if (selectedSettings.fieldType !== 'URL') return null

  const setUrlProtocol = (urlProtocol: GraphFieldUrlProtocol) => updateSettings({ urlProtocol })

  return (
    <div className={`rounded border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} p-3`}>
      <div className="flex items-center justify-between">
        <span className={`${uiPanelKeyValueTextSizeClass} ${UI_THEME_TOKENS.text.primary}`}>Protocol</span>
        <span className={`${uiPanelKeyValueTextSizeClass} ${UI_THEME_TOKENS.text.tertiary}`}>{selectedSettings.urlProtocol}</span>
      </div>
      <div className="mt-2 flex items-center gap-1">
        <button
          type="button"
          className={`App-toolbar__btn text-xs border ${UI_THEME_TOKENS.input.border} ${selectedSettings.urlProtocol === 'any' ? UI_THEME_TOKENS.button.primarySolid : `${UI_THEME_TOKENS.button.neutralSubtle} ${UI_THEME_TOKENS.button.hoverBg}`}`}
          onClick={() => setUrlProtocol('any')}
        >
          Any
        </button>
        <button
          type="button"
          className={`App-toolbar__btn text-xs border ${UI_THEME_TOKENS.input.border} ${selectedSettings.urlProtocol === 'http' ? UI_THEME_TOKENS.button.primarySolid : `${UI_THEME_TOKENS.button.neutralSubtle} ${UI_THEME_TOKENS.button.hoverBg}`}`}
          onClick={() => setUrlProtocol('http')}
        >
          HTTP
        </button>
        <button
          type="button"
          className={`App-toolbar__btn text-xs border ${UI_THEME_TOKENS.input.border} ${selectedSettings.urlProtocol === 'https' ? UI_THEME_TOKENS.button.primarySolid : `${UI_THEME_TOKENS.button.neutralSubtle} ${UI_THEME_TOKENS.button.hoverBg}`}`}
          onClick={() => setUrlProtocol('https')}
        >
          HTTPS
        </button>
      </div>
    </div>
  )
}
