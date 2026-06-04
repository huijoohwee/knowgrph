import React from 'react'
import type { GraphFieldSettingsResolved, GraphFieldUrlProtocol } from '@/features/graph-fields/graphFields'
import { useGraphStore } from '@/hooks/useGraphStore'
import { KTV_ROW_TEXT_SIZE_FALLBACK_CLASS_NAME } from '@/features/panels/ui/KeyTypeValueRow'
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
    s => s.uiPanelKeyValueTextSizeClass || KTV_ROW_TEXT_SIZE_FALLBACK_CLASS_NAME,
  )
  if (selectedSettings.fieldType !== 'URL') return null

  const setUrlProtocol = (urlProtocol: GraphFieldUrlProtocol) => updateSettings({ urlProtocol })

  return (
    <section className={`rounded border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} p-3`}>
      <section className="flex items-center justify-between">
        <span className={`${uiPanelKeyValueTextSizeClass} ${UI_THEME_TOKENS.text.primary}`}>Protocol</span>
        <span className={`${uiPanelKeyValueTextSizeClass} ${UI_THEME_TOKENS.text.tertiary}`}>{selectedSettings.urlProtocol}</span>
      </section>
      <section className="mt-2 flex items-center gap-1">
        <button
          type="button"
          className={`App-toolbar__btn ${uiPanelKeyValueTextSizeClass} border ${UI_THEME_TOKENS.input.border} ${selectedSettings.urlProtocol === 'any' ? UI_THEME_TOKENS.button.primarySolid : `${UI_THEME_TOKENS.button.neutralSubtle} ${UI_THEME_TOKENS.button.hoverBg}`}`}
          onClick={() => setUrlProtocol('any')}
        >
          Any
        </button>
        <button
          type="button"
          className={`App-toolbar__btn ${uiPanelKeyValueTextSizeClass} border ${UI_THEME_TOKENS.input.border} ${selectedSettings.urlProtocol === 'http' ? UI_THEME_TOKENS.button.primarySolid : `${UI_THEME_TOKENS.button.neutralSubtle} ${UI_THEME_TOKENS.button.hoverBg}`}`}
          onClick={() => setUrlProtocol('http')}
        >
          HTTP
        </button>
        <button
          type="button"
          className={`App-toolbar__btn ${uiPanelKeyValueTextSizeClass} border ${UI_THEME_TOKENS.input.border} ${selectedSettings.urlProtocol === 'https' ? UI_THEME_TOKENS.button.primarySolid : `${UI_THEME_TOKENS.button.neutralSubtle} ${UI_THEME_TOKENS.button.hoverBg}`}`}
          onClick={() => setUrlProtocol('https')}
        >
          HTTPS
        </button>
      </section>
    </section>
  )
}
