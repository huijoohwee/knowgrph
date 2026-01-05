import React from 'react'
import Tooltip from '@/features/panels/ui/Tooltip'
import { GRAPH_FIELDS_GRAPH_DATA_TABLE_MAPPING_TOOLTIP, UI_COPY, UI_LABELS } from '@/lib/config'
import { useGraphStore } from '@/hooks/useGraphStore'
import { getChipClass } from '@/lib/ui'
import { KeyTypeValueRow, RightAlignedValueCell } from '@/features/panels/ui/KeyTypeValueRow'

type MainPanelGraphFieldsHeaderProps = {
  agenticLegend: string[] | null
}

export default function MainPanelGraphFieldsHeader({
  agenticLegend,
}: MainPanelGraphFieldsHeaderProps) {
  const uiIconPillClass = useGraphStore(s => s.uiIconPillClass)
  const uiPanelKeyValueInputClass = useGraphStore(
    s =>
      s.uiPanelKeyValueInputClass ||
      'w-full h-6 px-2 text-sm border border-gray-300 rounded text-right',
  )
  const uiPanelKeyValueTextSizeClass = useGraphStore(
    s => s.uiPanelKeyValueTextSizeClass || 'text-xs',
  )
  const uiPanelTextFontClass = useGraphStore(
    s => s.uiPanelTextFontClass || 'font-sans',
  )
  const schema = useGraphStore(s => s.schema)
  const setSchema = useGraphStore(s => s.setSchema)
  return (
    <div
      className={[
        'mt-4 pt-3 border-t border-gray-200 mb-1 text-gray-500 space-y-1',
        uiPanelKeyValueTextSizeClass,
        uiPanelTextFontClass,
      ].join(' ')}
    >
      <KeyTypeValueRow
        layout="keyIconValue"
        density="compact"
        keyNode={(
          <span className="text-gray-700 break-words">
            {UI_LABELS.layerMode}
          </span>
        )}
        typeNode={null}
        valueNode={(
          <RightAlignedValueCell>
            <Tooltip content={UI_LABELS.layerMode} maxWidthPx={280} contentClassName="bg-gray-800/90">
              <select
                className={uiPanelKeyValueInputClass}
                value={schema.layers?.mode || 'property'}
                onChange={e => {
                  const raw = String(e.target.value || '')
                  const nextMode =
                    raw === 'semantic' || raw === 'document-structure'
                      ? raw
                      : 'property'
                  const layers = schema.layers || {}
                  setSchema({ ...schema, layers: { ...layers, mode: nextMode } })
                }}
              >
                <option value="property">property</option>
                <option value="document-structure">document-structure</option>
                <option value="semantic">semantic</option>
              </select>
            </Tooltip>
          </RightAlignedValueCell>
        )}
      />
      <div className="flex items-center justify-between gap-2">
        <Tooltip
          content={GRAPH_FIELDS_GRAPH_DATA_TABLE_MAPPING_TOOLTIP}
          maxWidthPx={280}
          contentClassName="bg-gray-800/90"
        >
          <div className="flex items-center gap-1">
            <span className="text-gray-600">{UI_COPY.graphFieldsIconLegendHeaderLabel}</span>
          </div>
        </Tooltip>
      </div>
      {agenticLegend && (
        <div className="flex flex-wrap items-center gap-1">
          <span
            className={getChipClass('default', {
              textSizeClass: 'text-[9px]',
              textColorClass: 'text-gray-700',
              extraClassName: 'font-medium bg-gray-50 border-gray-300',
            })}
          >
            {UI_COPY.graphFieldsAgenticLegendChipLabel}
          </span>
          {agenticLegend.map(label => (
            <span
              key={label}
              className={getChipClass('selected', {
                textSizeClass: 'text-[9px]',
                textColorClass: 'text-blue-700',
                extraClassName: uiIconPillClass,
              })}
            >
              {label}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
