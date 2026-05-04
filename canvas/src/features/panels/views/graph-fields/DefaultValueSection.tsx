import React from 'react'
import { Eraser } from 'lucide-react'
import type { JSONValue } from '@/lib/graph/types'
import { isJsonValue } from '@/lib/graph/jsonValue'
import type { GraphFieldDateTimeFormat, GraphFieldSettingsResolved } from '@/features/graph-fields/graphFields'
import { useGraphStore } from '@/hooks/useGraphStore'
import { UI_COPY, UI_LABELS } from '@/lib/config'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import type { UpdateSettings } from '@/features/panels/views/graph-fields/FieldSettingsSections.types'
import { MonacoTextEditor } from '@/features/monaco/MonacoTextEditor'

export function DefaultValueSection({
  selectedSettings,
  setDefaultValue,
  updateSettings,
  onStatusChange,
}: {
  selectedSettings: GraphFieldSettingsResolved
  setDefaultValue: (defaultValue: JSONValue | null) => void
  updateSettings: UpdateSettings
  onStatusChange: (msg: string) => void
}) {
  const [jsonDefaultDraft, setJsonDefaultDraft] = React.useState('')
  const [longTextDefaultExpanded, setLongTextDefaultExpanded] = React.useState(false)
  const uiPanelKeyValueInputClass = useGraphStore(
    s =>
      s.uiPanelKeyValueInputClass ||
      `w-full h-6 px-2 text-sm border ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.input.bg} ${UI_THEME_TOKENS.input.text} rounded text-right ${UI_THEME_TOKENS.focus.primaryBorderRing}`,
  )
  const uiPanelMonospaceTextClass = useGraphStore(
    s => s.uiPanelMonospaceTextClass || 'font-mono text-xs',
  )
  const uiPanelKeyValueTextSizeClass = useGraphStore(
    s => s.uiPanelKeyValueTextSizeClass || 'text-xs',
  )
  const neutralToolbarButtonClassName = `App-toolbar__btn text-xs border ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.button.neutralSubtle} ${UI_THEME_TOKENS.button.hoverBg}`
  const selectedToolbarButtonClassName = `App-toolbar__btn text-xs border ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.button.primarySolid}`
  const panelClassName = `rounded border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} p-3`
  const inputClassName = `h-8 w-full rounded border ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.input.bg} px-2 text-xs ${UI_THEME_TOKENS.input.text} ${UI_THEME_TOKENS.focus.primaryBorderRing}`

  React.useEffect(() => {
    setLongTextDefaultExpanded(false)
    if (selectedSettings.fieldType !== 'JSON') {
      setJsonDefaultDraft('')
      return
    }
    try {
      setJsonDefaultDraft(
        selectedSettings.defaultValue === null
          ? ''
          : JSON.stringify(selectedSettings.defaultValue, null, 2),
      )
    } catch {
      setJsonDefaultDraft('')
    }
  }, [selectedSettings.defaultValue, selectedSettings.fieldType])

  const setDateTimeFormat = React.useCallback(
    (dateTimeFormat: GraphFieldDateTimeFormat) => updateSettings({ dateTimeFormat }),
    [updateSettings],
  )

  const applyJsonDraft = React.useCallback(() => {
    const raw = jsonDefaultDraft.trim()
    if (!raw) {
      setDefaultValue(null)
      onStatusChange(UI_COPY.graphFieldsJsonDefaultClearedStatus)
      return
    }
    try {
      const parsed = JSON.parse(raw) as unknown
      if (!isJsonValue(parsed)) {
        onStatusChange(UI_COPY.graphFieldsJsonDefaultInvalidStatus)
        return
      }
      setDefaultValue(parsed)
      onStatusChange(UI_COPY.graphFieldsJsonDefaultAppliedStatus)
    } catch {
      onStatusChange(UI_COPY.graphFieldsJsonDefaultInvalidStatus)
    }
  }, [jsonDefaultDraft, onStatusChange, setDefaultValue])

  const formatJsonDraft = React.useCallback(() => {
    const raw = jsonDefaultDraft.trim()
    if (!raw) return
    try {
      const parsed = JSON.parse(raw) as unknown
      if (!isJsonValue(parsed)) {
        onStatusChange(UI_COPY.graphFieldsJsonDefaultInvalidStatus)
        return
      }
      setJsonDefaultDraft(JSON.stringify(parsed, null, 2))
      setDefaultValue(parsed)
      onStatusChange(UI_COPY.graphFieldsJsonDefaultFormattedStatus)
    } catch {
      onStatusChange(UI_COPY.graphFieldsJsonDefaultInvalidStatus)
    }
  }, [jsonDefaultDraft, onStatusChange, setDefaultValue])

  if (selectedSettings.fieldType === 'Single-select' || selectedSettings.fieldType === 'Multi-select') {
    return null
  }

  return (
    <div className={panelClassName}>
      <div className="flex items-center justify-between">
        <span className={`${uiPanelKeyValueTextSizeClass} ${UI_THEME_TOKENS.text.primary}`}>{UI_LABELS.defaultValue}</span>
        <span className={`${uiPanelKeyValueTextSizeClass} ${UI_THEME_TOKENS.text.tertiary}`}>{selectedSettings.defaultValue === null ? '—' : 'Set'}</span>
      </div>
      <div className="mt-2">
        {selectedSettings.fieldType === 'Checkbox' ? (
          <div className="flex items-center gap-1">
            <button
              type="button"
              className={selectedSettings.defaultValue === null ? selectedToolbarButtonClassName : neutralToolbarButtonClassName}
              onClick={() => setDefaultValue(null)}
            >
              Unset
            </button>
            <button
              type="button"
              className={selectedSettings.defaultValue === true ? selectedToolbarButtonClassName : neutralToolbarButtonClassName}
              onClick={() => setDefaultValue(true)}
            >
              True
            </button>
            <button
              type="button"
              className={selectedSettings.defaultValue === false ? selectedToolbarButtonClassName : neutralToolbarButtonClassName}
              onClick={() => setDefaultValue(false)}
            >
              False
            </button>
          </div>
        ) : selectedSettings.fieldType === 'Number' || selectedSettings.fieldType === 'Decimal' || selectedSettings.fieldType === 'Currency' ? (
          <input
            type="number"
            value={typeof selectedSettings.defaultValue === 'number' ? String(selectedSettings.defaultValue) : ''}
            onChange={e => {
              const raw = e.target.value
              if (!raw) {
                setDefaultValue(null)
                return
              }
              const n = Number(raw)
              setDefaultValue(Number.isFinite(n) ? n : null)
            }}
            step={
              selectedSettings.fieldType === 'Decimal' || selectedSettings.fieldType === 'Currency'
                ? String(1 / Math.pow(10, Math.max(0, selectedSettings.decimalPlaces)))
                : '1'
            }
            className={uiPanelKeyValueInputClass}
          />
        ) : selectedSettings.fieldType === 'Long text' ? (
          <div className="space-y-2">
            <div className="flex items-center justify-end">
              <button
                type="button"
                className={neutralToolbarButtonClassName}
                onClick={() => setLongTextDefaultExpanded(v => !v)}
              >
                {longTextDefaultExpanded ? 'Collapse' : 'Expand'}
              </button>
            </div>
            <div
              className={[
                `w-full rounded border ${UI_THEME_TOKENS.input.border} overflow-hidden ${UI_THEME_TOKENS.input.bg}`,
                longTextDefaultExpanded ? 'h-[216px]' : 'h-[92px]',
              ].join(' ')}
            >
              <MonacoTextEditor
                value={typeof selectedSettings.defaultValue === 'string' ? selectedSettings.defaultValue : ''}
                onChange={(val) => setDefaultValue(val ? val : null)}
                language="text"
                uri="inmemory://graph-fields/default/long-text"
                themeMode="light"
                wordWrap
                className="w-full h-full"
              />
            </div>
          </div>
        ) : selectedSettings.fieldType === 'JSON' ? (
          <div className="space-y-2">
            <div className={`w-full rounded border ${UI_THEME_TOKENS.input.border} overflow-hidden ${UI_THEME_TOKENS.input.bg} h-[140px]`}>
              <MonacoTextEditor
                value={jsonDefaultDraft}
                onChange={setJsonDefaultDraft}
                language="json"
                uri="inmemory://graph-fields/default/json"
                themeMode="light"
                wordWrap={false}
                className={`w-full h-full ${uiPanelMonospaceTextClass}`}
              />
            </div>
            <div className="flex items-center gap-1">
              <button type="button" className={neutralToolbarButtonClassName} onClick={applyJsonDraft}>
                Apply
              </button>
              <button
                type="button"
                className={`${neutralToolbarButtonClassName} flex items-center justify-center gap-1`}
                onClick={() => {
                  setJsonDefaultDraft('')
                  setDefaultValue(null)
                }}
              >
                <Eraser className="w-3.5 h-3.5" />
                Clear
              </button>
              <button type="button" className={neutralToolbarButtonClassName} onClick={formatJsonDraft}>
                Format
              </button>
            </div>
          </div>
        ) : selectedSettings.fieldType === 'Date Time' ? (
          <div className="space-y-2">
            <input
              value={typeof selectedSettings.defaultValue === 'string' ? selectedSettings.defaultValue : ''}
              onChange={e => setDefaultValue(e.target.value ? e.target.value : null)}
              placeholder="2025-01-01T00:00"
              className={inputClassName}
            />
            <div className="flex items-center gap-1">
              <button
                type="button"
                className={selectedSettings.dateTimeFormat === 'ISO' ? selectedToolbarButtonClassName : neutralToolbarButtonClassName}
                onClick={() => setDateTimeFormat('ISO')}
              >
                ISO
              </button>
              <button
                type="button"
                className={selectedSettings.dateTimeFormat === 'Local' ? selectedToolbarButtonClassName : neutralToolbarButtonClassName}
                onClick={() => setDateTimeFormat('Local')}
              >
                Local
              </button>
              <button
                type="button"
                className={`${neutralToolbarButtonClassName} flex items-center justify-center gap-1`}
                onClick={() => setDefaultValue(null)}
              >
                <Eraser className="w-3.5 h-3.5" />
                Clear
              </button>
            </div>
          </div>
        ) : (
          <input
            value={typeof selectedSettings.defaultValue === 'string' ? selectedSettings.defaultValue : ''}
            onChange={e => setDefaultValue(e.target.value ? e.target.value : null)}
            placeholder={selectedSettings.fieldType === 'URL' ? 'https://example.com' : undefined}
            className={inputClassName}
          />
        )}
      </div>
    </div>
  )
}
