import React from 'react'
import { useShallow } from 'zustand/react/shallow'

import { useGraphStore } from '@/hooks/useGraphStore'
import { UI_LABELS } from '@/lib/config'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { cn } from '@/lib/utils'
import { PORT_HANDLE_STROKE_CLASS } from '@/components/StoryboardWidget/portHandleUi'
import { FLOW_WIDGET_KV_KEY_COLUMN_STYLE, FLOW_WIDGET_KV_ROW_LAYOUT, FLOW_WIDGET_KV_VALUE_COLUMN_STYLE } from '@/components/StoryboardWidget/widgetEditorTableLayout'

export type WidgetEditorKvRow = {
  rowKey: string
  labelId: string
  inPortNode?: React.ReactNode
  showInPortDot?: boolean
  onInPortClick?: () => void
  keyNode: React.ReactNode
  onKeyClick?: () => void
  valueNode: React.ReactNode
  onValueClick?: () => void
  outPortNode?: React.ReactNode
  showOutPortDot?: boolean
  onOutPortClick?: () => void
}

type StoryboardWidgetPortRowKeyParts = {
  nodeId: string
  direction: 'in' | 'out'
  portKey: string
}

const parseStoryboardWidgetPortRowKey = (rowKey: string): StoryboardWidgetPortRowKeyParts | null => {
  const parts = String(rowKey || '').trim().split(':')
  if (parts.length < 3) return null
  const nodeId = String(parts[0] || '').trim()
  const directionToken = String(parts[1] || '').trim()
  const portKey = parts.slice(2).join(':').trim()
  const direction = directionToken === 'input' ? 'in' : directionToken === 'output' ? 'out' : null
  if (!nodeId || !direction || !portKey) return null
  return { nodeId, direction, portKey }
}

const cssAttrValue = (value: string): string => {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') return CSS.escape(value)
  return value.replace(/["\\]/g, '\\$&')
}

export const WidgetEditorKvTable = React.memo(function WidgetEditorKvTable(props: {
  ariaLabel: string
  microLabelClass: string
  rows: ReadonlyArray<WidgetEditorKvRow>
  showHeader?: boolean
  dotSizePx?: number
  dotHitPx?: number
  forcePortDots?: boolean
  extraPlaceholderCell?: boolean
}) {
  const { ariaLabel, microLabelClass, rows, showHeader = false, dotSizePx = 10, dotHitPx = 18, forcePortDots, extraPlaceholderCell = false } = props
  const rootRef = React.useRef<HTMLElement | null>(null)
  const selectedStoryboardWidgetPortRowKey = useGraphStore(
    useShallow(state => state.storyboardWidgetSelectedPortRowKey || ''),
  )
  const [selectedKvRowKey, setSelectedKvRowKey] = React.useState('')

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

  React.useLayoutEffect(() => {
    const parsed = parseStoryboardWidgetPortRowKey(selectedStoryboardWidgetPortRowKey)
    const root = rootRef.current
    if (!parsed || !root) {
      setSelectedKvRowKey(prev => (prev ? '' : prev))
      return
    }
    const widgetRoot = root.closest('[data-kg-widget]')
    const widgetNodeId = String(widgetRoot?.getAttribute('data-kg-widget') || '').trim()
    if (!widgetNodeId || widgetNodeId !== parsed.nodeId) {
      setSelectedKvRowKey(prev => (prev ? '' : prev))
      return
    }

    const rowEls = Array.from(root.querySelectorAll<HTMLElement>('[data-kg-flow-widget-kv-row-key]'))
    const nextSelectedRow = rowEls.find(rowEl => {
      const selector = [
        `[data-kg-port-dir="${cssAttrValue(parsed.direction)}"]`,
        `[data-kg-port-key="${cssAttrValue(parsed.portKey)}"]`,
      ].join('')
      return !!rowEl.querySelector(selector)
    })
    const nextRowKey = String(nextSelectedRow?.getAttribute('data-kg-flow-widget-kv-row-key') || '').trim()
    setSelectedKvRowKey(prev => (prev === nextRowKey ? prev : nextRowKey))
    if (nextSelectedRow) {
      nextSelectedRow.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    }
  }, [rows, selectedStoryboardWidgetPortRowKey])

  return (
    <section ref={rootRef} className="-mx-3" aria-label={ariaLabel}>
      <table className="w-full border-collapse table-fixed" aria-label={ariaLabel} data-kg-flow-widget-kv-row-layout={FLOW_WIDGET_KV_ROW_LAYOUT}>
        <colgroup>
          <col style={{ width: `${safeHit}px` }} />
          <col style={FLOW_WIDGET_KV_KEY_COLUMN_STYLE} />
          <col style={FLOW_WIDGET_KV_VALUE_COLUMN_STYLE} />
          {extraPlaceholderCell ? <col style={{ width: `${safeHit}px` }} /> : null}
          <col style={{ width: `${safeHit}px` }} />
        </colgroup>
        <caption className={cn('sr-only', microLabelClass)}>
          {UI_LABELS.flowWidgetKeyLabel} / {UI_LABELS.flowWidgetValueLabel}
        </caption>

        {showHeader ? (
          <thead className={UI_THEME_TOKENS.table.headerBg}>
            <tr>
              <td />
              <td className={cn('px-2 py-2 text-left', microLabelClass, UI_THEME_TOKENS.text.secondary)}>
                {UI_LABELS.flowWidgetKeyLabel}
              </td>
              <td className={cn('px-2 py-2 text-left', microLabelClass, UI_THEME_TOKENS.text.secondary)}>
                {UI_LABELS.flowWidgetValueLabel}
              </td>
              {extraPlaceholderCell ? (
                <td className={cn('px-2 py-2 text-left', microLabelClass, UI_THEME_TOKENS.text.secondary)}>
                  {UI_LABELS.flowWidgetTypeLabel}
                </td>
              ) : null}
              <td />
            </tr>
        </thead>
        ) : null}
        <tbody>
          {(rows || []).map(row => {
            const selected = !!selectedKvRowKey && selectedKvRowKey === row.rowKey
            return (
              <tr
                key={row.rowKey}
                aria-labelledby={row.labelId}
                aria-selected={selected}
                className={cn(
                  'border-t',
                  UI_THEME_TOKENS.table.cellBorder,
                  selected ? UI_THEME_TOKENS.table.rowSelected : UI_THEME_TOKENS.table.rowHover,
                )}
                data-kg-flow-widget-kv-row-key={row.rowKey}
                data-kg-flow-widget-kv-row-selected={selected ? '1' : undefined}
                data-kg-storyboard-widget-port-row-key={selected ? selectedStoryboardWidgetPortRowKey : undefined}
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
                  className={cn('px-3 py-2 align-top overflow-hidden', UI_THEME_TOKENS.text.primary, row.onKeyClick ? 'cursor-pointer' : '')}
                  onClick={row.onKeyClick}
                >
                  <section className="w-full min-w-0 truncate [&_label]:block [&_label]:min-w-0 [&_label]:overflow-hidden [&_label]:text-ellipsis [&_label]:whitespace-nowrap [&_span]:block [&_span]:min-w-0 [&_span]:max-w-full [&_span]:overflow-hidden [&_span]:text-ellipsis [&_span]:whitespace-nowrap">
                    {row.keyNode}
                  </section>
                </td>
                <td
                  className={cn('px-3 py-2 align-top overflow-hidden', UI_THEME_TOKENS.text.secondary, row.onValueClick ? 'cursor-pointer' : '')}
                  onClick={row.onValueClick}
                >
                  <section className="w-full min-w-0">{row.valueNode}</section>
                </td>
                {extraPlaceholderCell ? (
                  <td className={cn('py-2 align-middle', UI_THEME_TOKENS.text.secondary)}>
                    {forcePortDots ? dot('Placeholder port') : null}
                  </td>
                ) : null}
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
            )
          })}
        </tbody>
      </table>
    </section>
  )
})
