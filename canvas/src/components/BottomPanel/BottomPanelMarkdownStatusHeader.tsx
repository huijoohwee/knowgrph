import Tooltip from '@/features/panels/ui/Tooltip'
import StatusBadge from '@/features/panels/ui/StatusBadge'
import type { JsonToMarkdownMode } from '@/features/markdown/jsonToMarkdown'

type JsonMarkdownMode = JsonToMarkdownMode

type HeaderStatusRowProps = {
  uiPanelKeyValueTextSizeClass: string
  jsonBackedBadgeTooltip: string
  jsonBackedBadgeLabel: string
  isJsonBacked: boolean
  jsonModeEnabled: boolean
  jsonMarkdownMode: JsonMarkdownMode
  setJsonMarkdownMode: (mode: JsonMarkdownMode) => void
  jsonMarkdownSuggestedMode: JsonMarkdownMode
  status: { ok: boolean | null; msg: string; details?: string }
  applyStatus: { ok: boolean | null; msg: string } | null
  isMarkdownLargeSummary: boolean
  jsonModeLabel: string
  jsonModeAutoLabel: string
  jsonModeTableLabel: string
  jsonModeKeyValueLabel: string
  jsonModeHierarchicalLabel: string
  jsonModeSuggestedPrefix: string
  statusLabel: string
  largeSummaryHelperText: string
}

export function HeaderStatusRow(props: HeaderStatusRowProps) {
  const {
    uiPanelKeyValueTextSizeClass,
    jsonBackedBadgeTooltip,
    jsonBackedBadgeLabel,
    isJsonBacked,
    jsonModeEnabled,
    jsonMarkdownMode,
    setJsonMarkdownMode,
    jsonMarkdownSuggestedMode,
    status,
    applyStatus,
    isMarkdownLargeSummary,
    jsonModeLabel,
    jsonModeAutoLabel,
    jsonModeTableLabel,
    jsonModeKeyValueLabel,
    jsonModeHierarchicalLabel,
    jsonModeSuggestedPrefix,
    statusLabel,
    largeSummaryHelperText,
  } = props

  return (
    <div className="flex items-center gap-3 min-w-0">
      <div className="min-w-0 truncate flex items-center gap-2">
        {isJsonBacked && (
          <Tooltip
            content={jsonBackedBadgeTooltip}
            maxWidthPx={260}
            contentClassName="bg-gray-800/90"
          >
            <span className="inline-flex items-center rounded border border-gray-200 bg-gray-50 px-1 py-px text-[10px] text-gray-500">
              {jsonBackedBadgeLabel}
            </span>
          </Tooltip>
        )}
      </div>
      <div className="flex items-center gap-1">
        <span className="text-xs text-gray-400">
          {jsonModeLabel}
        </span>
        <select
          className={[
            'border border-gray-200 rounded px-1 py-0.5 text-xs bg-white text-gray-700',
            'focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500',
            jsonModeEnabled ? '' : 'opacity-50 cursor-not-allowed',
          ].join(' ')}
          disabled={!jsonModeEnabled}
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
          <option value="key-value">
            {jsonModeKeyValueLabel}
          </option>
          <option value="hierarchical">
            {jsonModeHierarchicalLabel}
          </option>
        </select>
        {jsonMarkdownSuggestedMode !== 'auto' && (
          <span className="text-[10px] text-gray-400 whitespace-nowrap">
            {jsonModeSuggestedPrefix}{' '}
            {jsonMarkdownSuggestedMode === 'table'
              ? jsonModeTableLabel
              : jsonMarkdownSuggestedMode === 'key-value'
              ? jsonModeKeyValueLabel
              : jsonModeHierarchicalLabel}
          </span>
        )}
      </div>
      <div className="flex flex-col items-end gap-0.5">
        <div className="flex items-center gap-2">
          <StatusBadge
            label={statusLabel}
            ok={status.ok}
            msg={status.msg}
            details={applyStatus && applyStatus.msg ? applyStatus.msg : status.details}
          />
        </div>
        {isMarkdownLargeSummary && (
          <div
            className={[
              uiPanelKeyValueTextSizeClass,
              'text-[10px] text-gray-400',
            ].join(' ')}
          >
            {largeSummaryHelperText}
          </div>
        )}
      </div>
    </div>
  )
}
