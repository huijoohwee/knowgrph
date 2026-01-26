import React from 'react'
import StatusBadge from '@/features/panels/ui/StatusBadge'
import { UI_COPY, UI_LABELS } from '@/lib/config'
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
    <div className="flex flex-col gap-1">
      {isExportMenuOpen && (
        <div className="flex items-center justify-end gap-1">
          {(['json', 'yaml', 'text'] as const).map(lang => {
            const label =
              lang === 'json'
                ? UI_COPY.toolbarParserExportJsonButtonLabel
                : lang === 'yaml'
                  ? UI_COPY.toolbarParserExportYamlButtonLabel
                  : UI_COPY.toolbarParserExportPythonButtonLabel
            const isActive = parserPreferredLanguage === lang
            const className = `App-toolbar__btn ${uiPanelKeyValueTextSizeClass} px-2 ${
              isActive ? 'bg-blue-600 text-white' : 'bg-gray-50 text-gray-700'
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
      <div className="flex items-center justify-end gap-2">
        <StatusBadge label={UI_LABELS.parser} ok={parserLoadOk} msg={parserLoadMsg} />
      </div>
    </div>
  )
}
