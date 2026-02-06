import React from 'react'

import { Trash2 } from 'lucide-react'

import { useGraphStore } from '@/hooks/useGraphStore'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { getIconSizeClass } from '@/lib/ui'

import type { FlowEditorMappingRow, FlowMappingRowDirection, FlowMappingRowType } from '@/features/flow-editor-manager/mappingRows'

const TYPE_OPTIONS: Array<{ value: FlowMappingRowType; label: string }> = [
  { value: 'text', label: 'text' },
  { value: 'textarea', label: 'textarea' },
  { value: 'select', label: 'select' },
  { value: 'number', label: 'number' },
  { value: 'boolean', label: 'boolean' },
  { value: 'json', label: 'json' },
  { value: 'port', label: 'port' },
]

const DIRECTION_OPTIONS: Array<{ value: FlowMappingRowDirection; label: string }> = [
  { value: 'none', label: 'none' },
  { value: 'input', label: 'input' },
  { value: 'output', label: 'output' },
]

export default function FlowMappingRowsTable({
  rows,
  onChange,
  onDelete,
}: {
  rows: FlowEditorMappingRow[]
  onChange: (id: string, patch: Partial<FlowEditorMappingRow>) => void
  onDelete: (id: string) => void
}) {
  const uiIconScale = useGraphStore(s => s.uiIconScale)
  const uiIconStrokeWidth = useGraphStore(s => s.uiIconStrokeWidth)
  const uiPanelKeyValueInputClass = useGraphStore(s => s.uiPanelKeyValueInputClass)
  const uiPanelTextFontClass = useGraphStore(s => s.uiPanelTextFontClass)
  const uiPanelKeyValueTextSizeClass = useGraphStore(s => s.uiPanelKeyValueTextSizeClass)
  const iconSizeClass = getIconSizeClass(uiIconScale)

  return (
    <table className={`w-full border-separate border-spacing-0 ${uiPanelTextFontClass} ${uiPanelKeyValueTextSizeClass}`}>
      <thead>
        <tr>
          <th className={`text-left px-2 py-2 text-xs font-semibold ${UI_THEME_TOKENS.text.secondary}`}>Key</th>
          <th className={`text-left px-2 py-2 text-xs font-semibold ${UI_THEME_TOKENS.text.secondary}`}>Type</th>
          <th className={`text-left px-2 py-2 text-xs font-semibold ${UI_THEME_TOKENS.text.secondary}`}>Value</th>
          <th className={`text-left px-2 py-2 text-xs font-semibold ${UI_THEME_TOKENS.text.secondary}`}>Required</th>
          <th className={`text-left px-2 py-2 text-xs font-semibold ${UI_THEME_TOKENS.text.secondary}`}>Direction</th>
          <th className={`text-right px-2 py-2 text-xs font-semibold ${UI_THEME_TOKENS.text.secondary}`}>Actions</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const keyId = `flow-map-key-${r.id}`
          const typeId = `flow-map-type-${r.id}`
          const valueId = `flow-map-value-${r.id}`
          const reqId = `flow-map-required-${r.id}`
          const dirId = `flow-map-direction-${r.id}`
          const isPort = r.type === 'port'
          return (
            <tr key={r.id} className={UI_THEME_TOKENS.table.rowHoverAmber}>
              <td className={`px-2 py-1 align-top border-t ${UI_THEME_TOKENS.panel.border}`}>
                <label className="sr-only" htmlFor={keyId}>Key</label>
                <input
                  id={keyId}
                  className={`w-full h-7 px-2 rounded ${UI_THEME_TOKENS.input.bg} ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.input.text} ${uiPanelKeyValueInputClass}`}
                  value={r.key}
                  onChange={e => onChange(r.id, { key: e.target.value })}
                  placeholder="key"
                />
              </td>
              <td className={`px-2 py-1 align-top border-t ${UI_THEME_TOKENS.panel.border}`}>
                <label className="sr-only" htmlFor={typeId}>Type</label>
                <select
                  id={typeId}
                  className={`w-full h-7 px-2 rounded ${UI_THEME_TOKENS.input.bg} ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.input.text} ${uiPanelKeyValueInputClass}`}
                  value={r.type}
                  onChange={e => {
                    const nextType = e.target.value as FlowMappingRowType
                    const nextDirection: FlowMappingRowDirection = nextType === 'port' ? (r.direction === 'none' ? 'output' : r.direction) : 'none'
                    onChange(r.id, { type: nextType, direction: nextDirection })
                  }}
                >
                  {TYPE_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </td>
              <td className={`px-2 py-1 align-top border-t ${UI_THEME_TOKENS.panel.border}`}>
                <label className="sr-only" htmlFor={valueId}>Value</label>
                <input
                  id={valueId}
                  className={`w-full h-7 px-2 rounded ${UI_THEME_TOKENS.input.bg} ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.input.text} ${uiPanelKeyValueInputClass}`}
                  value={r.value}
                  onChange={e => onChange(r.id, { value: e.target.value })}
                  placeholder="schemaPath"
                />
              </td>
              <td className={`px-2 py-1 align-top border-t ${UI_THEME_TOKENS.panel.border}`}>
                <label className="sr-only" htmlFor={reqId}>Required</label>
                <input
                  id={reqId}
                  type="checkbox"
                  checked={!!r.required}
                  onChange={e => onChange(r.id, { required: e.target.checked })}
                  disabled={isPort}
                />
              </td>
              <td className={`px-2 py-1 align-top border-t ${UI_THEME_TOKENS.panel.border}`}>
                <label className="sr-only" htmlFor={dirId}>Direction</label>
                <select
                  id={dirId}
                  className={`w-full h-7 px-2 rounded ${UI_THEME_TOKENS.input.bg} ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.input.text} ${uiPanelKeyValueInputClass}`}
                  value={r.direction}
                  onChange={e => onChange(r.id, { direction: e.target.value as FlowMappingRowDirection, type: e.target.value === 'none' ? r.type : 'port' })}
                  disabled={!isPort && r.direction === 'none'}
                >
                  {DIRECTION_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </td>
              <td className={`px-2 py-1 align-top text-right border-t ${UI_THEME_TOKENS.panel.border}`}>
                <button
                  type="button"
                  className={`App-toolbar__btn ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`}
                  onClick={() => onDelete(r.id)}
                  aria-label="Delete row"
                  title="Delete row"
                >
                  <Trash2 className={`${iconSizeClass}`} strokeWidth={uiIconStrokeWidth} />
                </button>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

