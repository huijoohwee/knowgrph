import React from 'react'
import { UI_COPY } from '@/lib/config'
import { KeyTypeValueRow, RightAlignedValueCell } from '@/features/panels/ui/KeyTypeValueRow'
import type { RenderTidyTreeSettingsRowsProps } from './RenderTidyTreeSettingsRowsTypes'

type Props = Pick<
  RenderTidyTreeSettingsRowsProps,
  'tidyTreeCfg' | 'updateTidyTree' | 'uiPanelKeyValueInputClass' | 'uiPanelMonospaceTextClass'
>

export const TidyTreeNodeSettings = React.memo(function TidyTreeNodeSettings({
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
    </>
  )
})
