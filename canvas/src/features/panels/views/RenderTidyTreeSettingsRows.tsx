import React from 'react'
import type { GraphSchema } from '@/lib/graph/schema'
import { UI_COPY, UI_LABELS } from '@/lib/config'
import { KeyTypeValueRow, RightAlignedValueCell } from '@/features/panels/ui/KeyTypeValueRow'

type PerformanceLod = NonNullable<NonNullable<GraphSchema['performance']>['lod']>
export type TidyTreeLod = NonNullable<NonNullable<PerformanceLod['tidyTree']>>
export type TidyTreeConfig = NonNullable<NonNullable<GraphSchema['layout']>['tidyTree']>

export interface RenderTidyTreeSettingsRowsProps {
  tidyTreeCfg: Partial<TidyTreeConfig>
  tidyTreeLod: TidyTreeLod
  tidyEdgeLabelsText: string
  tidyEdgeLabelSuggestion: { label: string; count: number } | null
  updateTidyTree: (patch: Partial<TidyTreeConfig>) => void
  updateTidyTreeLod: (updater: (cur: TidyTreeLod) => TidyTreeLod | null) => void
  uiPanelKeyValueInputClass: string
  uiPanelMonospaceTextClass: string
  uiPanelKeyValueTextSizeClass: string
  uiPanelTextFontClass: string
}

const RenderTidyTreeSettingsRows = React.memo(function RenderTidyTreeSettingsRows({
  tidyTreeCfg,
  tidyTreeLod,
  tidyEdgeLabelsText,
  tidyEdgeLabelSuggestion,
  updateTidyTree,
  updateTidyTreeLod,
  uiPanelKeyValueInputClass,
  uiPanelMonospaceTextClass,
  uiPanelKeyValueTextSizeClass,
  uiPanelTextFontClass,
}: RenderTidyTreeSettingsRowsProps) {
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
        keyNode={<span className={uiPanelMonospaceTextClass}>graph.layout.tidyTree.direction</span>}
        valueNode={(
          <RightAlignedValueCell>
            <select
              className={uiPanelKeyValueInputClass}
              value={
                tidyTreeCfg.direction === 'target-source' || tidyTreeCfg.direction === 'source-target'
                  ? tidyTreeCfg.direction
                  : 'auto'
              }
              onChange={e => {
                const raw = e.target.value
                const next = raw === 'source-target' || raw === 'target-source' ? raw : 'auto'
                updateTidyTree({ direction: next })
              }}
            >
              <option value="auto">auto (infer parent→child)</option>
              <option value="source-target">source→target</option>
              <option value="target-source">target→source</option>
            </select>
          </RightAlignedValueCell>
        )}
      />
      <KeyTypeValueRow
        layout="keyValue"
        density="compact"
        keyNode={<span className={uiPanelMonospaceTextClass}>graph.layout.tidyTree.orientation</span>}
        valueNode={(
          <RightAlignedValueCell>
            <select
              className={uiPanelKeyValueInputClass}
              value={tidyTreeCfg.orientation === 'vertical' ? 'vertical' : 'horizontal'}
              onChange={e => {
                const raw = e.target.value
                updateTidyTree({ orientation: raw === 'horizontal' ? 'horizontal' : 'vertical' })
              }}
            >
              <option value="horizontal">left-to-right</option>
              <option value="vertical">top-to-bottom</option>
            </select>
          </RightAlignedValueCell>
        )}
      />
      <KeyTypeValueRow
        layout="keyValue"
        density="compact"
        keyNode={<span className={uiPanelMonospaceTextClass}>graph.layout.tidyTree.nodeSize.x</span>}
        valueNode={(
          <RightAlignedValueCell>
            <input
              type="number"
              step={1}
              min={1}
              className={uiPanelKeyValueInputClass}
              value={tidyTreeCfg.nodeSize?.x ?? ''}
              placeholder={UI_COPY.autoPlaceholder}
              onChange={e => {
                const rawText = String(e.target.value || '')
                if (!rawText.trim()) {
                  const next = { ...(tidyTreeCfg.nodeSize || {}) } as { x?: number; y?: number }
                  delete next.x
                  const hasAny = typeof next.x === 'number' || typeof next.y === 'number'
                  updateTidyTree({ nodeSize: hasAny ? next : undefined })
                  return
                }
                const raw = parseFloat(rawText)
                const next = Number.isFinite(raw) ? Math.max(1, raw) : undefined
                if (next == null) return
                updateTidyTree({ nodeSize: { ...(tidyTreeCfg.nodeSize || {}), x: next } })
              }}
            />
          </RightAlignedValueCell>
        )}
      />
      <KeyTypeValueRow
        layout="keyValue"
        density="compact"
        keyNode={<span className={uiPanelMonospaceTextClass}>graph.layout.tidyTree.nodeSize.y</span>}
        valueNode={(
          <RightAlignedValueCell>
            <input
              type="number"
              step={1}
              min={1}
              className={uiPanelKeyValueInputClass}
              value={tidyTreeCfg.nodeSize?.y ?? ''}
              placeholder={UI_COPY.autoPlaceholder}
              onChange={e => {
                const rawText = String(e.target.value || '')
                if (!rawText.trim()) {
                  const next = { ...(tidyTreeCfg.nodeSize || {}) } as { x?: number; y?: number }
                  delete next.y
                  const hasAny = typeof next.x === 'number' || typeof next.y === 'number'
                  updateTidyTree({ nodeSize: hasAny ? next : undefined })
                  return
                }
                const raw = parseFloat(rawText)
                const next = Number.isFinite(raw) ? Math.max(1, raw) : undefined
                if (next == null) return
                updateTidyTree({ nodeSize: { ...(tidyTreeCfg.nodeSize || {}), y: next } })
              }}
            />
          </RightAlignedValueCell>
        )}
      />
      <KeyTypeValueRow
        layout="keyValue"
        density="compact"
        keyNode={<span className={uiPanelMonospaceTextClass}>graph.layout.tidyTree.separation</span>}
        valueNode={(
          <RightAlignedValueCell>
            <input
              type="number"
              step={0.1}
              min={0.25}
              className={uiPanelKeyValueInputClass}
              value={tidyTreeCfg.separation ?? 1}
              onChange={e => {
                const raw = parseFloat(e.target.value || '1')
                const next = Number.isFinite(raw) ? Math.max(0.25, raw) : 1
                updateTidyTree({ separation: next })
              }}
            />
          </RightAlignedValueCell>
        )}
      />
      <KeyTypeValueRow
        layout="keyValue"
        density="compact"
        keyNode={<span className={uiPanelMonospaceTextClass}>graph.layout.tidyTree.sortBy</span>}
        valueNode={(
          <RightAlignedValueCell>
            <select
              className={uiPanelKeyValueInputClass}
              value={
                tidyTreeCfg.sortBy === 'none' || tidyTreeCfg.sortBy === 'id' || tidyTreeCfg.sortBy === 'type'
                  ? tidyTreeCfg.sortBy
                  : 'label'
              }
              onChange={e => {
                const raw = e.target.value
                const next = raw === 'none' || raw === 'id' || raw === 'type' || raw === 'label' ? raw : 'label'
                updateTidyTree({ sortBy: next })
              }}
            >
              <option value="label">label</option>
              <option value="type">type</option>
              <option value="id">id</option>
              <option value="none">none</option>
            </select>
          </RightAlignedValueCell>
        )}
      />
      <KeyTypeValueRow
        layout="keyValue"
        density="compact"
        keyNode={<span className={uiPanelMonospaceTextClass}>graph.layout.tidyTree.curve</span>}
        valueNode={(
          <RightAlignedValueCell>
            <select
              className={uiPanelKeyValueInputClass}
              value={
                tidyTreeCfg.curve === 'linear' || tidyTreeCfg.curve === 'step' ? tidyTreeCfg.curve : 'bump'
              }
              onChange={e => {
                const raw = e.target.value
                const next = raw === 'linear' || raw === 'step' || raw === 'bump' ? raw : 'bump'
                updateTidyTree({ curve: next })
              }}
            >
              <option value="bump">bump (curved)</option>
              <option value="linear">linear</option>
              <option value="step">step</option>
            </select>
          </RightAlignedValueCell>
        )}
      />
      <KeyTypeValueRow
        layout="keyValue"
        density="compact"
        keyNode={<span className={uiPanelMonospaceTextClass}>graph.layout.tidyTree.colorMode</span>}
        valueNode={(
          <RightAlignedValueCell>
            <select
              className={uiPanelKeyValueInputClass}
              value={tidyTreeCfg.colorMode === 'schema' ? 'schema' : 'observable'}
              onChange={e => {
                const raw = e.target.value
                updateTidyTree({ colorMode: raw === 'schema' ? 'schema' : 'observable' })
              }}
            >
              <option value="observable">observable</option>
              <option value="schema">schema</option>
            </select>
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
      <KeyTypeValueRow
        layout="keyValue"
        density="compact"
        keyNode={<span className={uiPanelMonospaceTextClass}>graph.layout.tidyTree.nodeRadius</span>}
        valueNode={(
          <RightAlignedValueCell>
            <input
              type="number"
              step={0.1}
              min={0.1}
              className={uiPanelKeyValueInputClass}
              value={typeof tidyTreeCfg.nodeRadius === 'number' ? tidyTreeCfg.nodeRadius : ''}
              placeholder="2.5"
              onChange={e => {
                const rawText = String(e.target.value || '')
                if (!rawText.trim()) {
                  updateTidyTree({ nodeRadius: undefined })
                  return
                }
                const raw = parseFloat(rawText)
                if (!Number.isFinite(raw)) return
                updateTidyTree({ nodeRadius: Math.max(0.1, raw) })
              }}
            />
          </RightAlignedValueCell>
        )}
      />
      <KeyTypeValueRow
        layout="keyValue"
        density="compact"
        keyNode={<span className={uiPanelMonospaceTextClass}>graph.layout.tidyTree.internalFill</span>}
        valueNode={(
          <RightAlignedValueCell>
            <input
              type="text"
              className={`${uiPanelKeyValueInputClass} text-left ${uiPanelMonospaceTextClass}`}
              value={typeof tidyTreeCfg.internalFill === 'string' ? tidyTreeCfg.internalFill : ''}
              placeholder={UI_COPY.autoPlaceholder}
              onChange={e => {
                const raw = String(e.target.value || '')
                updateTidyTree({ internalFill: raw.trim() ? raw : undefined })
              }}
            />
          </RightAlignedValueCell>
        )}
      />
      <KeyTypeValueRow
        layout="keyValue"
        density="compact"
        keyNode={<span className={uiPanelMonospaceTextClass}>graph.layout.tidyTree.leafFill</span>}
        valueNode={(
          <RightAlignedValueCell>
            <input
              type="text"
              className={`${uiPanelKeyValueInputClass} text-left ${uiPanelMonospaceTextClass}`}
              value={typeof tidyTreeCfg.leafFill === 'string' ? tidyTreeCfg.leafFill : ''}
              placeholder={UI_COPY.autoPlaceholder}
              onChange={e => {
                const raw = String(e.target.value || '')
                updateTidyTree({ leafFill: raw.trim() ? raw : undefined })
              }}
            />
          </RightAlignedValueCell>
        )}
      />
      <KeyTypeValueRow
        layout="keyValue"
        density="compact"
        keyNode={<span className={uiPanelMonospaceTextClass}>graph.layout.tidyTree.labelFontSize</span>}
        valueNode={(
          <RightAlignedValueCell>
            <input
              type="number"
              step={1}
              min={1}
              className={uiPanelKeyValueInputClass}
              value={typeof tidyTreeCfg.labelFontSize === 'number' ? tidyTreeCfg.labelFontSize : ''}
              placeholder="10"
              onChange={e => {
                const rawText = String(e.target.value || '')
                if (!rawText.trim()) {
                  updateTidyTree({ labelFontSize: undefined })
                  return
                }
                const raw = parseFloat(rawText)
                if (!Number.isFinite(raw)) return
                updateTidyTree({ labelFontSize: Math.max(1, raw) })
              }}
            />
          </RightAlignedValueCell>
        )}
      />
      <KeyTypeValueRow
        layout="keyValue"
        density="compact"
        keyNode={<span className={uiPanelMonospaceTextClass}>graph.layout.tidyTree.labelFontFamily</span>}
        valueNode={(
          <RightAlignedValueCell>
            <input
              type="text"
              className={`${uiPanelKeyValueInputClass} text-left ${uiPanelMonospaceTextClass}`}
              value={typeof tidyTreeCfg.labelFontFamily === 'string' ? tidyTreeCfg.labelFontFamily : ''}
              placeholder="sans-serif"
              onChange={e => {
                const raw = String(e.target.value || '')
                updateTidyTree({ labelFontFamily: raw.trim() ? raw : undefined })
              }}
            />
          </RightAlignedValueCell>
        )}
      />
      <KeyTypeValueRow
        layout="keyValue"
        density="compact"
        keyNode={<span className={uiPanelMonospaceTextClass}>graph.performance.lod.tidyTree.labelMode</span>}
        valueNode={(
          <RightAlignedValueCell>
            <select
              className={uiPanelKeyValueInputClass}
              value={
                tidyTreeLod.labelMode === 'all' || tidyTreeLod.labelMode === 'internal' || tidyTreeLod.labelMode === 'none'
                  ? tidyTreeLod.labelMode
                  : 'auto'
              }
              onChange={e => {
                const raw = e.target.value
                const next = raw === 'all' || raw === 'internal' || raw === 'none' ? raw : 'auto'
                updateTidyTreeLod((cur) => {
                  const tidy = { ...cur }
                  if (next === 'auto') {
                    delete (tidy as Partial<TidyTreeLod>).labelMode
                  } else {
                    tidy.labelMode = next
                  }
                  const hasAny = Object.keys(tidy).length > 0
                  return hasAny ? tidy : null
                })
              }}
            >
              <option value="auto">auto</option>
              <option value="internal">internal only</option>
              <option value="all">all</option>
              <option value="none">none</option>
            </select>
          </RightAlignedValueCell>
        )}
      />
      <KeyTypeValueRow
        layout="keyValue"
        density="compact"
        keyNode={<span className={uiPanelMonospaceTextClass}>graph.performance.lod.tidyTree.maxLabels</span>}
        valueNode={(
          <RightAlignedValueCell>
            <input
              type="number"
              step={1}
              min={1}
              className={uiPanelKeyValueInputClass}
              value={typeof tidyTreeLod.maxLabels === 'number' ? tidyTreeLod.maxLabels : ''}
              placeholder={UI_COPY.autoPlaceholder}
              onChange={e => {
                const rawText = String(e.target.value || '')
                updateTidyTreeLod((cur) => {
                  const tidy = { ...cur }
                  if (!rawText.trim()) {
                    delete (tidy as Partial<TidyTreeLod>).maxLabels
                  } else {
                    const raw = parseFloat(rawText)
                    if (Number.isFinite(raw)) tidy.maxLabels = Math.max(1, Math.floor(raw))
                  }
                  const hasAny = Object.keys(tidy).length > 0
                  return hasAny ? tidy : null
                })
              }}
            />
          </RightAlignedValueCell>
        )}
      />
      <KeyTypeValueRow
        layout="keyValue"
        density="compact"
        keyNode={<span className={uiPanelMonospaceTextClass}>graph.performance.lod.tidyTree.maxLeafLabels</span>}
        valueNode={(
          <RightAlignedValueCell>
            <input
              type="number"
              step={1}
              min={0}
              className={uiPanelKeyValueInputClass}
              value={typeof tidyTreeLod.maxLeafLabels === 'number' ? tidyTreeLod.maxLeafLabels : ''}
              placeholder={UI_COPY.autoPlaceholder}
              onChange={e => {
                const rawText = String(e.target.value || '')
                updateTidyTreeLod((cur) => {
                  const tidy = { ...cur }
                  if (!rawText.trim()) {
                    delete (tidy as Partial<TidyTreeLod>).maxLeafLabels
                  } else {
                    const raw = parseFloat(rawText)
                    if (Number.isFinite(raw)) tidy.maxLeafLabels = Math.max(0, Math.floor(raw))
                  }
                  const hasAny = Object.keys(tidy).length > 0
                  return hasAny ? tidy : null
                })
              }}
            />
          </RightAlignedValueCell>
        )}
      />
      <KeyTypeValueRow
        layout="keyValue"
        density="compact"
        keyNode={<span className={uiPanelMonospaceTextClass}>graph.performance.lod.tidyTree.collapseMode</span>}
        valueNode={(
          <RightAlignedValueCell>
            <select
              className={uiPanelKeyValueInputClass}
              value={tidyTreeLod.collapseMode === 'depth' ? 'depth' : 'none'}
              onChange={e => {
                const raw = e.target.value
                const next = raw === 'depth' ? 'depth' : 'none'
                updateTidyTreeLod((cur) => {
                  const tidy = { ...cur }
                  tidy.collapseMode = next
                  const hasAny = Object.keys(tidy).length > 0
                  return hasAny ? tidy : null
                })
              }}
            >
              <option value="none">none</option>
              <option value="depth">collapse by depth</option>
            </select>
          </RightAlignedValueCell>
        )}
      />
      <KeyTypeValueRow
        layout="keyValue"
        density="compact"
        keyNode={<span className={uiPanelMonospaceTextClass}>graph.performance.lod.tidyTree.maxDepth</span>}
        valueNode={(
          <RightAlignedValueCell>
            <input
              type="number"
              step={1}
              min={1}
              className={uiPanelKeyValueInputClass}
              value={typeof tidyTreeLod.maxDepth === 'number' ? tidyTreeLod.maxDepth : ''}
              placeholder={UI_COPY.autoPlaceholder}
              onChange={e => {
                const rawText = String(e.target.value || '')
                updateTidyTreeLod((cur) => {
                  const tidy = { ...cur }
                  if (!rawText.trim()) {
                    delete (tidy as Partial<TidyTreeLod>).maxDepth
                  } else {
                    const raw = parseFloat(rawText)
                    if (Number.isFinite(raw)) tidy.maxDepth = Math.max(1, Math.floor(raw))
                  }
                  const hasAny = Object.keys(tidy).length > 0
                  return hasAny ? tidy : null
                })
              }}
            />
          </RightAlignedValueCell>
        )}
      />
    </>
  )
})

export default RenderTidyTreeSettingsRows
