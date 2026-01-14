import React from 'react'
import { UI_COPY } from '@/lib/config'
import { KeyTypeValueRow, RightAlignedValueCell } from '@/features/panels/ui/KeyTypeValueRow'
import type { RenderTreeSettingsRowsProps } from './RenderTreeSettingsRowsTypes'

type Props = Pick<
  RenderTreeSettingsRowsProps,
  'treeCfg' | 'updateTree' | 'uiPanelKeyValueInputClass' | 'uiPanelMonospaceTextClass'
>

export const TreeNodeSettings = React.memo(function TreeNodeSettings({
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
        keyNode={<span className={uiPanelMonospaceTextClass}>graph.layout.tree.nodeSize.x</span>}
        valueNode={(
          <RightAlignedValueCell>
            <input
              type="number"
              step={1}
              min={1}
              className={uiPanelKeyValueInputClass}
              value={treeCfg.nodeSize?.x ?? ''}
              placeholder={UI_COPY.autoPlaceholder}
              onChange={e => {
                const rawText = String(e.target.value || '')
                if (!rawText.trim()) {
                  const next = { ...(treeCfg.nodeSize || {}) } as { x?: number; y?: number }
                  delete next.x
                  const hasAny = typeof next.x === 'number' || typeof next.y === 'number'
                  updateTree({ nodeSize: hasAny ? next : undefined })
                  return
                }
                const raw = parseFloat(rawText)
                const next = Number.isFinite(raw) ? Math.max(1, raw) : undefined
                if (next == null) return
                updateTree({ nodeSize: { ...(treeCfg.nodeSize || {}), x: next } })
              }}
            />
          </RightAlignedValueCell>
        )}
      />
      <KeyTypeValueRow
        layout="keyValue"
        density="compact"
        keyNode={<span className={uiPanelMonospaceTextClass}>graph.layout.tree.nodeSize.y</span>}
        valueNode={(
          <RightAlignedValueCell>
            <input
              type="number"
              step={1}
              min={1}
              className={uiPanelKeyValueInputClass}
              value={treeCfg.nodeSize?.y ?? ''}
              placeholder={UI_COPY.autoPlaceholder}
              onChange={e => {
                const rawText = String(e.target.value || '')
                if (!rawText.trim()) {
                  const next = { ...(treeCfg.nodeSize || {}) } as { x?: number; y?: number }
                  delete next.y
                  const hasAny = typeof next.x === 'number' || typeof next.y === 'number'
                  updateTree({ nodeSize: hasAny ? next : undefined })
                  return
                }
                const raw = parseFloat(rawText)
                const next = Number.isFinite(raw) ? Math.max(1, raw) : undefined
                if (next == null) return
                updateTree({ nodeSize: { ...(treeCfg.nodeSize || {}), y: next } })
              }}
            />
          </RightAlignedValueCell>
        )}
      />
      <KeyTypeValueRow
        layout="keyValue"
        density="compact"
        keyNode={<span className={uiPanelMonospaceTextClass}>graph.layout.tree.nodeRadius</span>}
        valueNode={(
          <RightAlignedValueCell>
            <input
              type="number"
              step={0.1}
              min={0.1}
              className={uiPanelKeyValueInputClass}
              value={typeof treeCfg.nodeRadius === 'number' ? treeCfg.nodeRadius : ''}
              placeholder="2.5"
              onChange={e => {
                const rawText = String(e.target.value || '')
                if (!rawText.trim()) {
                  updateTree({ nodeRadius: undefined })
                  return
                }
                const raw = parseFloat(rawText)
                if (!Number.isFinite(raw)) return
                updateTree({ nodeRadius: Math.max(0.1, raw) })
              }}
            />
          </RightAlignedValueCell>
        )}
      />
      <KeyTypeValueRow
        layout="keyValue"
        density="compact"
        keyNode={<span className={uiPanelMonospaceTextClass}>graph.layout.tree.internalFill</span>}
        valueNode={(
          <RightAlignedValueCell>
            <input
              type="text"
              className={`${uiPanelKeyValueInputClass} text-left ${uiPanelMonospaceTextClass}`}
              value={typeof treeCfg.internalFill === 'string' ? treeCfg.internalFill : ''}
              placeholder={UI_COPY.autoPlaceholder}
              onChange={e => {
                const raw = String(e.target.value || '')
                updateTree({ internalFill: raw.trim() ? raw : undefined })
              }}
            />
          </RightAlignedValueCell>
        )}
      />
      <KeyTypeValueRow
        layout="keyValue"
        density="compact"
        keyNode={<span className={uiPanelMonospaceTextClass}>graph.layout.tree.leafFill</span>}
        valueNode={(
          <RightAlignedValueCell>
            <input
              type="text"
              className={`${uiPanelKeyValueInputClass} text-left ${uiPanelMonospaceTextClass}`}
              value={typeof treeCfg.leafFill === 'string' ? treeCfg.leafFill : ''}
              placeholder={UI_COPY.autoPlaceholder}
              onChange={e => {
                const raw = String(e.target.value || '')
                updateTree({ leafFill: raw.trim() ? raw : undefined })
              }}
            />
          </RightAlignedValueCell>
        )}
      />
    </>
  )
})
