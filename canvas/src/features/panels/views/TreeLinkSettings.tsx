import React from 'react'
import { UI_COPY, UI_LABELS } from '@/lib/config'
import { KeyTypeValueRow, RightAlignedValueCell } from '@/features/panels/ui/KeyTypeValueRow'
import type { RenderTreeSettingsRowsProps } from './RenderTreeSettingsRowsTypes'

type Props = Pick<
  RenderTreeSettingsRowsProps,
  | 'treeCfg'
  | 'updateTree'
  | 'treeEdgeLabelsText'
  | 'treeEdgeLabelSuggestion'
  | 'uiPanelKeyValueInputClass'
  | 'uiPanelMonospaceTextClass'
  | 'uiPanelKeyValueTextSizeClass'
  | 'uiPanelTextFontClass'
>

export const TreeLinkSettings = React.memo(function TreeLinkSettings({
  treeCfg,
  updateTree,
  treeEdgeLabelsText,
  treeEdgeLabelSuggestion,
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
        keyNode={<span className={uiPanelMonospaceTextClass}>graph.layout.tree.edgeLabels</span>}
        valueNode={(
          <RightAlignedValueCell>
            <div className="w-full flex flex-col gap-1 items-end">
              <input
                type="text"
                className={`${uiPanelKeyValueInputClass} text-left ${uiPanelMonospaceTextClass}`}
                defaultValue={treeEdgeLabelsText}
                placeholder={UI_COPY.autoPlaceholder}
                onBlur={e => {
                  const raw = String(e.target.value || '')
                  const parts = raw
                    .split(/[,;\n]+/g)
                    .map(x => x.trim())
                    .filter(Boolean)
                  const unique = Array.from(new Set(parts))
                  updateTree({ edgeLabels: unique.length > 0 ? unique : [] })
                }}
              />
              {(treeCfg.edgeLabels || []).length === 0 && treeEdgeLabelSuggestion ? (
                <div
                  className={[
                    'w-full flex items-center justify-between gap-2 text-gray-500',
                    uiPanelKeyValueTextSizeClass,
                    uiPanelTextFontClass,
                  ].join(' ')}
                >
                  <span className="truncate">
                    suggested: <span className={uiPanelMonospaceTextClass}>{treeEdgeLabelSuggestion.label}</span>{' '}
                    ({treeEdgeLabelSuggestion.count})
                  </span>
                  <button
                    type="button"
                    className="App-toolbar__btn bg-gray-100 text-gray-700"
                    onClick={() => updateTree({ edgeLabels: [treeEdgeLabelSuggestion.label] })}
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
        keyNode={<span className={uiPanelMonospaceTextClass}>graph.layout.tree.linkStroke</span>}
        valueNode={(
          <RightAlignedValueCell>
            <input
              type="text"
              className={`${uiPanelKeyValueInputClass} text-left ${uiPanelMonospaceTextClass}`}
              value={typeof treeCfg.linkStroke === 'string' ? treeCfg.linkStroke : ''}
              placeholder={UI_COPY.autoPlaceholder}
              onChange={e => {
                const raw = String(e.target.value || '')
                updateTree({ linkStroke: raw.trim() ? raw : undefined })
              }}
            />
          </RightAlignedValueCell>
        )}
      />
      <KeyTypeValueRow
        layout="keyValue"
        density="compact"
        keyNode={<span className={uiPanelMonospaceTextClass}>graph.layout.tree.linkOpacity</span>}
        valueNode={(
          <RightAlignedValueCell>
            <input
              type="number"
              step={0.05}
              min={0}
              max={1}
              className={uiPanelKeyValueInputClass}
              value={typeof treeCfg.linkOpacity === 'number' ? treeCfg.linkOpacity : ''}
              placeholder="0.4"
              onChange={e => {
                const rawText = String(e.target.value || '')
                if (!rawText.trim()) {
                  updateTree({ linkOpacity: undefined })
                  return
                }
                const raw = parseFloat(rawText)
                if (!Number.isFinite(raw)) return
                const next = Math.max(0, Math.min(1, raw))
                updateTree({ linkOpacity: next })
              }}
            />
          </RightAlignedValueCell>
        )}
      />
      <KeyTypeValueRow
        layout="keyValue"
        density="compact"
        keyNode={<span className={uiPanelMonospaceTextClass}>graph.layout.tree.linkWidth</span>}
        valueNode={(
          <RightAlignedValueCell>
            <input
              type="number"
              step={0.1}
              min={0.1}
              className={uiPanelKeyValueInputClass}
              value={typeof treeCfg.linkWidth === 'number' ? treeCfg.linkWidth : ''}
              placeholder="1.5"
              onChange={e => {
                const rawText = String(e.target.value || '')
                if (!rawText.trim()) {
                  updateTree({ linkWidth: undefined })
                  return
                }
                const raw = parseFloat(rawText)
                if (!Number.isFinite(raw)) return
                updateTree({ linkWidth: Math.max(0.1, raw) })
              }}
            />
          </RightAlignedValueCell>
        )}
      />
    </>
  )
})
