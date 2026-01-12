import React from 'react'
import { UI_COPY, UI_LABELS } from '@/lib/config'
import { KeyTypeValueRow, RightAlignedValueCell } from '@/features/panels/ui/KeyTypeValueRow'
import type { RenderTidyTreeSettingsRowsProps } from './RenderTidyTreeSettingsRowsTypes'

type Props = Pick<
  RenderTidyTreeSettingsRowsProps,
  | 'tidyTreeCfg'
  | 'updateTidyTree'
  | 'tidyEdgeLabelsText'
  | 'tidyEdgeLabelSuggestion'
  | 'uiPanelKeyValueInputClass'
  | 'uiPanelMonospaceTextClass'
  | 'uiPanelKeyValueTextSizeClass'
  | 'uiPanelTextFontClass'
>

export const TidyTreeLinkSettings = React.memo(function TidyTreeLinkSettings({
  tidyTreeCfg,
  updateTidyTree,
  tidyEdgeLabelsText,
  tidyEdgeLabelSuggestion,
  uiPanelKeyValueInputClass,
  uiPanelMonospaceTextClass,
  uiPanelKeyValueTextSizeClass,
  uiPanelTextFontClass,
}: Props) {
  return (
    <>
      <KeyTypeValueRow
        layout="keyValue"
        density="compact"
        keyNode={<span className={uiPanelMonospaceTextClass}>graph.layout.tidyTree.edgeLabels</span>}
        valueNode={(
          <RightAlignedValueCell>
            <div className="w-full flex flex-col gap-1 items-end">
              <input
                type="text"
                className={`${uiPanelKeyValueInputClass} text-left ${uiPanelMonospaceTextClass}`}
                defaultValue={tidyEdgeLabelsText}
                placeholder={UI_COPY.autoPlaceholder}
                onBlur={e => {
                  const raw = String(e.target.value || '')
                  const parts = raw
                    .split(/[,;\n]+/g)
                    .map(x => x.trim())
                    .filter(Boolean)
                  const unique = Array.from(new Set(parts))
                  updateTidyTree({ edgeLabels: unique.length > 0 ? unique : [] })
                }}
              />
              {(tidyTreeCfg.edgeLabels || []).length === 0 && tidyEdgeLabelSuggestion ? (
                <div
                  className={[
                    'w-full flex items-center justify-between gap-2 text-gray-500',
                    uiPanelKeyValueTextSizeClass,
                    uiPanelTextFontClass,
                  ].join(' ')}
                >
                  <span className="truncate">
                    suggested: <span className={uiPanelMonospaceTextClass}>{tidyEdgeLabelSuggestion.label}</span>{' '}
                    ({tidyEdgeLabelSuggestion.count})
                  </span>
                  <button
                    type="button"
                    className="App-toolbar__btn bg-gray-100 text-gray-700"
                    onClick={() => updateTidyTree({ edgeLabels: [tidyEdgeLabelSuggestion.label] })}
                  >
                    {UI_LABELS.apply}
                  </button>
                </div>
              ) : null}
            </div>
          </RightAlignedValueCell>
        )}
      />
      <KeyTypeValueRow
        layout="keyValue"
        density="compact"
        keyNode={<span className={uiPanelMonospaceTextClass}>graph.layout.tidyTree.linkStroke</span>}
        valueNode={(
          <RightAlignedValueCell>
            <input
              type="text"
              className={`${uiPanelKeyValueInputClass} text-left ${uiPanelMonospaceTextClass}`}
              value={typeof tidyTreeCfg.linkStroke === 'string' ? tidyTreeCfg.linkStroke : ''}
              placeholder={UI_COPY.autoPlaceholder}
              onChange={e => {
                const raw = String(e.target.value || '')
                updateTidyTree({ linkStroke: raw.trim() ? raw : undefined })
              }}
            />
          </RightAlignedValueCell>
        )}
      />
      <KeyTypeValueRow
        layout="keyValue"
        density="compact"
        keyNode={<span className={uiPanelMonospaceTextClass}>graph.layout.tidyTree.linkOpacity</span>}
        valueNode={(
          <RightAlignedValueCell>
            <input
              type="number"
              step={0.05}
              min={0}
              max={1}
              className={uiPanelKeyValueInputClass}
              value={typeof tidyTreeCfg.linkOpacity === 'number' ? tidyTreeCfg.linkOpacity : ''}
              placeholder="0.4"
              onChange={e => {
                const rawText = String(e.target.value || '')
                if (!rawText.trim()) {
                  updateTidyTree({ linkOpacity: undefined })
                  return
                }
                const raw = parseFloat(rawText)
                if (!Number.isFinite(raw)) return
                const next = Math.max(0, Math.min(1, raw))
                updateTidyTree({ linkOpacity: next })
              }}
            />
          </RightAlignedValueCell>
        )}
      />
      <KeyTypeValueRow
        layout="keyValue"
        density="compact"
        keyNode={<span className={uiPanelMonospaceTextClass}>graph.layout.tidyTree.linkWidth</span>}
        valueNode={(
          <RightAlignedValueCell>
            <input
              type="number"
              step={0.1}
              min={0.1}
              className={uiPanelKeyValueInputClass}
              value={typeof tidyTreeCfg.linkWidth === 'number' ? tidyTreeCfg.linkWidth : ''}
              placeholder="1.5"
              onChange={e => {
                const rawText = String(e.target.value || '')
                if (!rawText.trim()) {
                  updateTidyTree({ linkWidth: undefined })
                  return
                }
                const raw = parseFloat(rawText)
                if (!Number.isFinite(raw)) return
                updateTidyTree({ linkWidth: Math.max(0.1, raw) })
              }}
            />
          </RightAlignedValueCell>
        )}
      />
    </>
  )
})
