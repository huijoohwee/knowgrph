import React from 'react'
import { UI_COPY } from '@/lib/config'
import { KeyTypeValueRow, RightAlignedValueCell } from '@/features/panels/ui/KeyTypeValueRow'
import type { RenderTidyTreeSettingsRowsProps, TidyTreeLod } from './RenderTidyTreeSettingsRowsTypes'

type Props = Pick<
  RenderTidyTreeSettingsRowsProps,
  | 'tidyTreeCfg'
  | 'updateTidyTree'
  | 'tidyTreeLod'
  | 'updateTidyTreeLod'
  | 'uiPanelKeyValueInputClass'
  | 'uiPanelMonospaceTextClass'
>

export const TidyTreeLabelSettings = React.memo(function TidyTreeLabelSettings({
  tidyTreeCfg,
  updateTidyTree,
  tidyTreeLod,
  updateTidyTreeLod,
  uiPanelKeyValueInputClass,
  uiPanelMonospaceTextClass,
}: Props) {
  return (
    <>
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
                if (!rawText.trim()) {
                  updateTidyTreeLod((cur) => {
                    const tidy = { ...cur }
                    delete (tidy as Partial<TidyTreeLod>).maxLabels
                    const hasAny = Object.keys(tidy).length > 0
                    return hasAny ? tidy : null
                  })
                  return
                }
                const raw = parseFloat(rawText)
                if (!Number.isFinite(raw)) return
                const next = Math.max(1, raw)
                updateTidyTreeLod((cur) => {
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
