import React from 'react'
import { KeyTypeValueRow, RightAlignedValueCell } from '@/features/panels/ui/KeyTypeValueRow'
import type { RenderTreeSettingsRowsProps } from './RenderTreeSettingsRowsTypes'

type Props = Pick<
  RenderTreeSettingsRowsProps,
  'treeCfg' | 'updateTree' | 'uiPanelKeyValueInputClass' | 'uiPanelMonospaceTextClass'
>

export const TreeLayoutSettings = React.memo(function TreeLayoutSettings({
  treeCfg,
  updateTree,
  uiPanelKeyValueInputClass,
  uiPanelMonospaceTextClass,
}: Props) {
  return (
    <>
      <KeyTypeValueRow
        layout="keyValue"
        density="compact"
        keyNode={<span className={uiPanelMonospaceTextClass}>graph.layout.tree.direction</span>}
        valueNode={(
          <RightAlignedValueCell>
            <select
              className={uiPanelKeyValueInputClass}
              value={
                treeCfg.direction === 'target-source' || treeCfg.direction === 'source-target'
                  ? treeCfg.direction
                  : 'auto'
              }
              onChange={e => {
                const raw = e.target.value
                const next = raw === 'source-target' || raw === 'target-source' ? raw : 'auto'
                updateTree({ direction: next })
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
        keyNode={<span className={uiPanelMonospaceTextClass}>graph.layout.tree.orientation</span>}
        valueNode={(
          <RightAlignedValueCell>
            <select
              className={uiPanelKeyValueInputClass}
              value={treeCfg.orientation === 'vertical' ? 'vertical' : 'horizontal'}
              onChange={e => {
                const raw = e.target.value
                updateTree({ orientation: raw === 'horizontal' ? 'horizontal' : 'vertical' })
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
        keyNode={<span className={uiPanelMonospaceTextClass}>graph.layout.tree.separation</span>}
        valueNode={(
          <RightAlignedValueCell>
            <input
              type="number"
              step={0.1}
              min={0.25}
              className={uiPanelKeyValueInputClass}
              value={treeCfg.separation ?? 1}
              onChange={e => {
                const raw = parseFloat(e.target.value || '1')
                const next = Number.isFinite(raw) ? Math.max(0.25, raw) : 1
                updateTree({ separation: next })
              }}
            />
          </RightAlignedValueCell>
        )}
      />
      <KeyTypeValueRow
        layout="keyValue"
        density="compact"
        keyNode={<span className={uiPanelMonospaceTextClass}>graph.layout.tree.sortBy</span>}
        valueNode={(
          <RightAlignedValueCell>
            <select
              className={uiPanelKeyValueInputClass}
              value={
                treeCfg.sortBy === 'none' || treeCfg.sortBy === 'id' || treeCfg.sortBy === 'type'
                  ? treeCfg.sortBy
                  : 'label'
              }
              onChange={e => {
                const raw = e.target.value
                const next = raw === 'none' || raw === 'id' || raw === 'type' || raw === 'label' ? raw : 'label'
                updateTree({ sortBy: next })
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
        keyNode={<span className={uiPanelMonospaceTextClass}>graph.layout.tree.curve</span>}
        valueNode={(
          <RightAlignedValueCell>
            <select
              className={uiPanelKeyValueInputClass}
              value={
                treeCfg.curve === 'linear' || treeCfg.curve === 'step' ? treeCfg.curve : 'bump'
              }
              onChange={e => {
                const raw = e.target.value
                const next = raw === 'linear' || raw === 'step' || raw === 'bump' ? raw : 'bump'
                updateTree({ curve: next })
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
        keyNode={<span className={uiPanelMonospaceTextClass}>graph.layout.tree.colorMode</span>}
        valueNode={(
          <RightAlignedValueCell>
            <select
              className={uiPanelKeyValueInputClass}
              value={treeCfg.colorMode === 'schema' ? 'schema' : 'observable'}
              onChange={e => {
                const raw = e.target.value
                updateTree({ colorMode: raw === 'schema' ? 'schema' : 'observable' })
              }}
            >
              <option value="observable">observable</option>
              <option value="schema">schema</option>
            </select>
          </RightAlignedValueCell>
        )}
      />
    </>
  )
})
