import React from 'react'
import Tooltip from '@/features/panels/ui/Tooltip'
import type { JsonToMarkdownMode } from '@/features/markdown/jsonToMarkdown'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { BookOpen } from 'lucide-react'

type JsonMarkdownMode = JsonToMarkdownMode

type HeaderStatusRowProps = {
  uiPanelKeyValueTextSizeClass: string
  documentLabel?: string | null
  jsonBackedBadgeTooltip: string
  jsonBackedBadgeLabel: string
  isJsonBacked: boolean
  jsonModeEnabled: boolean
  jsonMarkdownMode: JsonMarkdownMode
  setJsonMarkdownMode: (mode: JsonMarkdownMode) => void
  jsonMarkdownSuggestedMode: JsonMarkdownMode
  jsonModeLabel: string
  jsonModeAutoLabel: string
  jsonModeTableLabel: string
  jsonModeKeyValueLabel: string
  jsonModeHierarchicalLabel: string
  jsonModeSuggestedPrefix: string
  hasFrontmatterMermaid?: boolean
  onClickFrontmatterHint?: () => void
}

export function HeaderStatusRow(props: HeaderStatusRowProps) {
  const {
    documentLabel,
    jsonBackedBadgeTooltip,
    jsonBackedBadgeLabel,
    isJsonBacked,
    jsonModeEnabled,
    jsonMarkdownMode,
    setJsonMarkdownMode,
    jsonMarkdownSuggestedMode,
    jsonModeLabel,
    jsonModeAutoLabel,
    jsonModeTableLabel,
    jsonModeKeyValueLabel,
    jsonModeHierarchicalLabel,
    jsonModeSuggestedPrefix,
    hasFrontmatterMermaid,
    onClickFrontmatterHint,
  } = props

  const showJsonMode = isJsonBacked && jsonModeEnabled

  return (
    <section className="flex items-center gap-3 min-w-0">
      <BookOpen className={`w-4 h-4 shrink-0 ${UI_THEME_TOKENS.text.tertiary}`} strokeWidth={1.5} />
      <div className="min-w-0 truncate flex items-center gap-2">
        {documentLabel ? (
          <span className={`min-w-0 truncate ${UI_THEME_TOKENS.text.secondary}`}>{documentLabel}</span>
        ) : null}
        {isJsonBacked && (
          <Tooltip
            content={jsonBackedBadgeTooltip}
            maxWidthPx={260}
            contentClassName={`${UI_THEME_TOKENS.tooltip.bg} ${UI_THEME_TOKENS.tooltip.text}`}
          >
            <span className={`inline-flex items-center rounded border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.headerBg} px-1 py-px text-[10px] ${UI_THEME_TOKENS.text.tertiary}`}>
              {jsonBackedBadgeLabel}
            </span>
          </Tooltip>
        )}
      </div>
      {showJsonMode ? (
        <div className="flex items-center gap-1">
          <span className={`text-xs ${UI_THEME_TOKENS.text.tertiary}`}>
            {jsonModeLabel}
          </span>
          <select
            className={[
              `border ${UI_THEME_TOKENS.input.border} rounded px-1 py-0.5 text-xs ${UI_THEME_TOKENS.input.bg} ${UI_THEME_TOKENS.input.text}`,
              'focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500',
            ].join(' ')}
            value={jsonMarkdownMode}
            onChange={e => {
              const next = e.target.value as JsonMarkdownMode
              const valid =
                next === 'table' ||
                next === 'key-value' ||
                next === 'hierarchical' ||
                next === 'auto'
              setJsonMarkdownMode(valid ? next : 'auto')
            }}
          >
            <option value="auto">{jsonModeAutoLabel}</option>
            <option value="table">{jsonModeTableLabel}</option>
            <option value="key-value">{jsonModeKeyValueLabel}</option>
            <option value="hierarchical">{jsonModeHierarchicalLabel}</option>
          </select>
          {jsonMarkdownSuggestedMode !== 'auto' && (
            <span className="text-[10px] text-gray-400 whitespace-nowrap truncate max-w-[180px]">
              {jsonModeSuggestedPrefix}{' '}
              {jsonMarkdownSuggestedMode === 'table'
                ? jsonModeTableLabel
                : jsonMarkdownSuggestedMode === 'key-value'
                ? jsonModeKeyValueLabel
                : jsonModeHierarchicalLabel}
            </span>
          )}
        </div>
      ) : null}
      {hasFrontmatterMermaid && onClickFrontmatterHint && (
        <button
          type="button"
          onClick={onClickFrontmatterHint}
          className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline px-1 py-0.5 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 border border-transparent hover:border-blue-200 dark:hover:border-blue-700 transition-colors"
          title="Frontmatter Mermaid diagram is available. Click to view."
        >
          Mermaid
        </button>
      )}
    </section>
  )
}
