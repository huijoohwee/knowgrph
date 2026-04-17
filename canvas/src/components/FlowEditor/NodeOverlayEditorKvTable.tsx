import React from 'react'

import { UI_LABELS } from '@/lib/config'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { cn } from '@/lib/utils'
import { PORT_HANDLE_STROKE_CLASS } from '@/components/FlowEditor/portHandleUi'

export type NodeOverlayEditorKvRow = {
  rowKey: string
  labelId: string
  inPortNode?: React.ReactNode
  showInPortDot?: boolean
  keyNode: React.ReactNode
  typeNode: React.ReactNode
  valueNode: React.ReactNode
  outPortNode?: React.ReactNode
  showOutPortDot?: boolean
}

export const NodeOverlayEditorKvTable = React.memo(function NodeOverlayEditorKvTable(props: {
  ariaLabel: string
  microLabelClass: string
  rows: ReadonlyArray<NodeOverlayEditorKvRow>
  showHeader?: boolean
  dotSizePx?: number
  dotHitPx?: number
  forcePortDots?: boolean
}) {
  const { ariaLabel, microLabelClass, rows, showHeader = false, dotSizePx = 10, dotHitPx = 18, forcePortDots } = props

  const dot = React.useCallback(
    (ariaLabel: string) => {
      const safeDotSize = Number.isFinite(dotSizePx) ? Math.max(6, Math.floor(dotSizePx)) : 10
      const safeHit = Number.isFinite(dotHitPx) ? Math.max(safeDotSize, Math.floor(dotHitPx)) : 18
      return (
        <button
          type="button"
          aria-label={ariaLabel}
          title={ariaLabel}
          disabled
          tabIndex={-1}
          className={cn('relative block', UI_THEME_TOKENS.button.text, 'opacity-50')}
          style={{ width: `${safeHit}px`, height: `${safeHit}px` }}
        >
          <span
            aria-hidden={true}
            className={cn('absolute top-1/2 left-1/2 rounded-full border', UI_THEME_TOKENS.panel.bg, PORT_HANDLE_STROKE_CLASS)}
            style={{ width: `${safeDotSize}px`, height: `${safeDotSize}px`, transform: 'translate(-50%, -50%)' }}
          />
        </button>
      )
    },
    [dotHitPx, dotSizePx],
  )

  return (
    <section className="-mx-3" aria-label={ariaLabel}>
      <table className="w-full border-collapse" aria-label={ariaLabel}>
        <colgroup>
          <col style={{ width: '1%' }} />
          <col style={{ width: '29%' }} />
          <col style={{ width: '10%' }} />
          <col style={{ width: '59%' }} />
          <col style={{ width: '1%' }} />
        </colgroup>
        <caption className={cn('sr-only', microLabelClass)}>
          {UI_LABELS.flowNodeQuickEditorKeyLabel} / {UI_LABELS.flowNodeQuickEditorTypeLabel} / {UI_LABELS.flowNodeQuickEditorValueLabel}
        </caption>

        {showHeader ? (
          <thead className={UI_THEME_TOKENS.table.headerBg}>
            <tr>
              <td />
              <td className={cn('px-2 py-2 text-left', microLabelClass, UI_THEME_TOKENS.text.secondary)}>
                {UI_LABELS.flowNodeQuickEditorKeyLabel}
              </td>
              <td className={cn('px-2 py-2 text-left', microLabelClass, UI_THEME_TOKENS.text.secondary)}>
                {UI_LABELS.flowNodeQuickEditorTypeLabel}
              </td>
              <td className={cn('px-2 py-2 text-left', microLabelClass, UI_THEME_TOKENS.text.secondary)}>
                {UI_LABELS.flowNodeQuickEditorValueLabel}
              </td>
              <td />
            </tr>
          </thead>
        ) : null}
        <tbody>
          {(rows || []).map(row => (
            <tr
              key={row.rowKey}
              aria-labelledby={row.labelId}
              className={cn('border-t', UI_THEME_TOKENS.table.cellBorder, UI_THEME_TOKENS.table.rowHover)}
            >
              <td className={cn('py-2 align-middle', UI_THEME_TOKENS.text.secondary)}>
                {row.inPortNode ?? (forcePortDots && row.showInPortDot !== false ? dot('Input port') : null)}
              </td>
              <td id={row.labelId} className={cn('px-3 py-2 align-top', UI_THEME_TOKENS.text.primary)}>
                {row.keyNode}
              </td>
              <td className={cn('px-3 py-2 align-top', UI_THEME_TOKENS.text.secondary)}>{row.typeNode}</td>
              <td className={cn('px-3 py-2 align-top', UI_THEME_TOKENS.text.secondary)}>
                <section className="w-full">{row.valueNode}</section>
              </td>
              <td className={cn('py-2 align-middle', UI_THEME_TOKENS.text.secondary)}>
                {row.outPortNode ?? (forcePortDots && row.showOutPortDot !== false ? dot('Output port') : null)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
})

export const NodeOverlayEditorTypePill = React.memo(function NodeOverlayEditorTypePill(props: {
  text: string
}) {
  const text = String(props.text || '').trim()
  if (!text) return null
  return <span className={cn(UI_THEME_TOKENS.badge.chip, UI_THEME_TOKENS.badge.text)}>{text}</span>
})
