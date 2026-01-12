import React from 'react'
import { KeyTypeValueRow, RightAlignedValueCell } from '@/features/panels/ui/KeyTypeValueRow'
import type { RenderTidyTreeSettingsRowsProps } from './RenderTidyTreeSettingsRowsTypes'

type Props = Pick<
  RenderTidyTreeSettingsRowsProps,
  'tidyTreeCfg' | 'updateTidyTree' | 'uiPanelKeyValueInputClass' | 'uiPanelMonospaceTextClass'
>

export const TidyTreeLayoutSettings = React.memo(function TidyTreeLayoutSettings({
  tidyTreeCfg,
  updateTidyTree,
  uiPanelKeyValueInputClass,
  uiPanelMonospaceTextClass,
}: Props) {
  return (
    <>
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
    </>
  )
})
