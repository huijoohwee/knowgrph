import React from 'react'
import { UI_COPY } from '@/lib/config'
import { KeyTypeValueRow, RightAlignedValueCell } from '@/features/panels/ui/KeyTypeValueRow'
import type { RenderTreeSettingsRowsProps, TreeLod } from './RenderTreeSettingsRowsTypes'

type Props = Pick<
  RenderTreeSettingsRowsProps,
  | 'treeCfg'
  | 'updateTree'
  | 'treeLod'
  | 'updateTreeLod'
  | 'uiPanelKeyValueInputClass'
  | 'uiPanelMonospaceTextClass'
>

export const TreeLabelSettings = React.memo(function TreeLabelSettings({
  treeCfg,
  updateTree,
  treeLod,
  updateTreeLod,
  uiPanelKeyValueInputClass,
  uiPanelMonospaceTextClass,
}: Props) {
  return (
    <>
      <KeyTypeValueRow
        layout="keyValue"
        density="compact"
        keyNode={<span className={uiPanelMonospaceTextClass}>graph.layout.tree.labelFontSize</span>}
        valueNode={(
          <RightAlignedValueCell>
            <input
              type="number"
              step={1}
              min={1}
              className={uiPanelKeyValueInputClass}
              value={typeof treeCfg.labelFontSize === 'number' ? treeCfg.labelFontSize : ''}
              placeholder="10"
              onChange={e => {
                const rawText = String(e.target.value || '')
                if (!rawText.trim()) {
                  updateTree({ labelFontSize: undefined })
                  return
                }
                const raw = parseFloat(rawText)
                if (!Number.isFinite(raw)) return
                updateTree({ labelFontSize: Math.max(1, raw) })
              }}
            />
          </RightAlignedValueCell>
        )}
      />
      <KeyTypeValueRow
        layout="keyValue"
        density="compact"
        keyNode={<span className={uiPanelMonospaceTextClass}>graph.layout.tree.labelFontFamily</span>}
        valueNode={(
          <RightAlignedValueCell>
            <input
              type="text"
              className={`${uiPanelKeyValueInputClass} text-left ${uiPanelMonospaceTextClass}`}
              value={typeof treeCfg.labelFontFamily === 'string' ? treeCfg.labelFontFamily : ''}
              placeholder="sans-serif"
              onChange={e => {
                const raw = String(e.target.value || '')
                updateTree({ labelFontFamily: raw.trim() ? raw : undefined })
              }}
            />
          </RightAlignedValueCell>
        )}
      />
      <KeyTypeValueRow
        layout="keyValue"
        density="compact"
        keyNode={<span className={uiPanelMonospaceTextClass}>graph.performance.lod.tree.labelMode</span>}
        valueNode={(
          <RightAlignedValueCell>
            <select
              className={uiPanelKeyValueInputClass}
              value={
                treeLod.labelMode === 'all' || treeLod.labelMode === 'internal' || treeLod.labelMode === 'none'
                  ? treeLod.labelMode
                  : 'auto'
              }
              onChange={e => {
                const raw = e.target.value
                const next = raw === 'all' || raw === 'internal' || raw === 'none' ? raw : 'auto'
                updateTreeLod((cur) => {
                  const tree = { ...cur }
                  if (next === 'auto') {
                    delete (tree as Partial<TreeLod>).labelMode
                  } else {
                    tree.labelMode = next
                  }
                  const hasAny = Object.keys(tree).length > 0
                  return hasAny ? tree : null
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
        keyNode={<span className={uiPanelMonospaceTextClass}>graph.performance.lod.tree.maxLabels</span>}
        valueNode={(
          <RightAlignedValueCell>
            <input
              type="number"
              step={1}
              min={1}
              className={uiPanelKeyValueInputClass}
              value={typeof treeLod.maxLabels === 'number' ? treeLod.maxLabels : ''}
              placeholder={UI_COPY.autoPlaceholder}
              onChange={e => {
                const rawText = String(e.target.value || '')
                if (!rawText.trim()) {
                  updateTreeLod((cur) => {
                    const tree = { ...cur }
                    delete (tree as Partial<TreeLod>).maxLabels
                    const hasAny = Object.keys(tree).length > 0
                    return hasAny ? tree : null
                  })
                  return
                }
                const raw = parseFloat(rawText)
                if (!Number.isFinite(raw)) return
                const next = Math.max(1, raw)
                updateTreeLod((cur) => {
                  return { ...cur, maxLabels: next }
                })
              }}
            />
          </RightAlignedValueCell>
        )}
      />
    </>
  )
})
