import React from 'react'

import { UI_LABELS } from '@/lib/config'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { cn } from '@/lib/utils'
import { PORT_HANDLE_STROKE_CLASS } from '@/components/FlowEditor/portHandleUi'
import { FieldTypeBadgeIcon, resolveFieldTypeIconKind } from '@/features/graph-fields/ui/graphFieldIcons'
import { useGraphStore } from '@/hooks/useGraphStore'
import { getIconSizeClass } from '@/lib/ui/icons'

export type NodeOverlayEditorKvRow = {
  rowKey: string
  labelId: string
  inPortNode?: React.ReactNode
  showInPortDot?: boolean
  onInPortClick?: () => void
  keyNode: React.ReactNode
  onKeyClick?: () => void
  typeNode: React.ReactNode
  onTypeClick?: () => void
  valueNode: React.ReactNode
  onValueClick?: () => void
  outPortNode?: React.ReactNode
  showOutPortDot?: boolean
  onOutPortClick?: () => void
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

  const safeDotSize = React.useMemo(() => {
    return Number.isFinite(dotSizePx) ? Math.max(6, Math.floor(dotSizePx)) : 10
  }, [dotSizePx])
  const safeHit = React.useMemo(() => {
    return Number.isFinite(dotHitPx) ? Math.max(safeDotSize, Math.floor(dotHitPx)) : 18
  }, [dotHitPx, safeDotSize])

  const dot = React.useCallback(
    (ariaLabel: string) => {
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
    [safeDotSize, safeHit],
  )

  return (
    <section className="-mx-3" aria-label={ariaLabel}>
      <table className="w-full border-collapse table-fixed" aria-label={ariaLabel}>
        <colgroup>
          <col style={{ width: `${safeHit}px` }} />
          <col style={{ width: '29%' }} />
          <col style={{ width: '10%' }} />
          <col style={{ width: '59%' }} />
          <col style={{ width: `${safeHit}px` }} />
        </colgroup>
        <caption className={cn('sr-only', microLabelClass)}>
          {UI_LABELS.flowWidgetKeyLabel} / {UI_LABELS.flowWidgetTypeLabel} / {UI_LABELS.flowWidgetValueLabel}
        </caption>

        {showHeader ? (
          <thead className={UI_THEME_TOKENS.table.headerBg}>
            <tr>
              <td />
              <td className={cn('px-2 py-2 text-left', microLabelClass, UI_THEME_TOKENS.text.secondary)}>
                {UI_LABELS.flowWidgetKeyLabel}
              </td>
              <td className={cn('px-2 py-2 text-left', microLabelClass, UI_THEME_TOKENS.text.secondary)}>
                {UI_LABELS.flowWidgetTypeLabel}
              </td>
              <td className={cn('px-2 py-2 text-left', microLabelClass, UI_THEME_TOKENS.text.secondary)}>
                {UI_LABELS.flowWidgetValueLabel}
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
              <td
                className={cn(
                  'py-2 align-middle',
                  UI_THEME_TOKENS.text.secondary,
                  row.onInPortClick ? 'cursor-pointer' : '',
                )}
                onClick={row.onInPortClick}
              >
                {row.inPortNode ?? (forcePortDots && row.showInPortDot !== false ? dot('Input port') : null)}
              </td>
              <td
                id={row.labelId}
                className={cn('px-3 py-2 align-top', UI_THEME_TOKENS.text.primary, row.onKeyClick ? 'cursor-pointer' : '')}
                onClick={row.onKeyClick}
              >
                {row.keyNode}
              </td>
              <td
                className={cn(
                  'px-3 py-2 align-top text-center',
                  UI_THEME_TOKENS.text.secondary,
                  row.onTypeClick ? 'cursor-pointer' : '',
                )}
                onClick={row.onTypeClick}
              >
                {row.typeNode}
              </td>
              <td
                className={cn(
                  'px-3 py-2 align-top overflow-hidden',
                  UI_THEME_TOKENS.text.secondary,
                  row.onValueClick ? 'cursor-pointer' : '',
                )}
                onClick={row.onValueClick}
              >
                <section className="w-full min-w-0">{row.valueNode}</section>
              </td>
              <td
                className={cn(
                  'py-2 align-middle',
                  UI_THEME_TOKENS.text.secondary,
                  row.onOutPortClick ? 'cursor-pointer' : '',
                )}
                onClick={row.onOutPortClick}
              >
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
  const uiIconScale = useGraphStore(s => s.uiIconScale)
  const uiIconStrokeWidth = useGraphStore(s => s.uiIconStrokeWidth)
  const iconSizeClass = getIconSizeClass(uiIconScale)
  const strokeWidth = typeof uiIconStrokeWidth === 'number' && Number.isFinite(uiIconStrokeWidth)
    ? Math.max(0.75, Math.min(3, uiIconStrokeWidth))
    : 1.75
  const kind = resolveFieldTypeIconKind(text)
  return (
    <span className={cn('w-full h-6 inline-flex items-center justify-center px-1 leading-none', UI_THEME_TOKENS.text.secondary)} aria-label="Type icon">
      <FieldTypeBadgeIcon
        kind={kind}
        className={iconSizeClass}
        strokeWidth={strokeWidth}
      />
    </span>
  )
})
