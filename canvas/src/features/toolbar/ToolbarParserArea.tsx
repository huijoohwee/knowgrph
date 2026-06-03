import React from 'react'
import StatusBadge from '@/features/panels/ui/StatusBadge'
import {
  uiToolbarAreaActionRowClassName,
  uiToolbarAreaCompactActionRowClassName,
  uiToolbarAreaStackClassName,
} from '@/features/toolbar/ui/toolbarStyles'
import { UI_COPY, UI_LABELS } from '@/lib/config'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { useParserUIState } from '@/features/parsers/uiState'
import { useGraphStore } from '@/hooks/useGraphStore'

interface ToolbarParserAreaProps {
  parserLoadOk: boolean | null
  parserLoadMsg: string
  parserPreferredLanguage: 'json' | 'text' | 'yaml'
  isExportMenuOpen: boolean
}

export function ToolbarParserArea({
  parserLoadOk,
  parserLoadMsg,
  parserPreferredLanguage,
  isExportMenuOpen,
}: ToolbarParserAreaProps) {
  const uiPanelKeyValueTextSizeClass = useGraphStore(
    s => s.uiPanelKeyValueTextSizeClass || 'text-xs',
  )
  return (
    <div className={uiToolbarAreaStackClassName}>
      {isExportMenuOpen && (
        <div className={uiToolbarAreaCompactActionRowClassName}>
          {(['json', 'yaml', 'text'] as const).map(lang => {
            const label =
              lang === 'json'
                ? UI_COPY.toolbarParserExportJsonButtonLabel
                : lang === 'yaml'
                  ? UI_COPY.toolbarParserExportYamlButtonLabel
                  : UI_COPY.toolbarParserExportPythonButtonLabel
            const isActive = parserPreferredLanguage === lang
            const className = `App-toolbar__btn ${uiPanelKeyValueTextSizeClass} px-2 ${
              isActive ? UI_THEME_TOKENS.button.primarySolid : `${UI_THEME_TOKENS.button.neutralSubtle} ${UI_THEME_TOKENS.button.hoverBg}`
            }`
            return (
              <button
                key={lang}
                type="button"
                className={className}
                onClick={() => {
                  try {
                    useParserUIState.getState().setPreferredLanguage(lang)
                  } catch {
                    void 0
                  }
                }}
              >
                {label}
              </button>
            )
          })}
        </div>
      )}
      <div className={uiToolbarAreaActionRowClassName}>
        <StatusBadge label={UI_LABELS.parser} ok={parserLoadOk} msg={parserLoadMsg} />
      </div>
    </div>
  )
}
