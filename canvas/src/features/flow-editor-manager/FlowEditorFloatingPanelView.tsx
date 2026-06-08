import React from 'react'
import { ArrowDownToDot, ArrowUpFromDot } from 'lucide-react'
import { HorizontalResizeSeparatorHr } from '@/components/ui/VerticalResizeSeparatorHr'
import { KeyTypeValueHeader, KeyTypeValueRow, KeyTypeValueSectionStack, KTV_STATUS_TEXT_CLASS_NAME } from '@/features/panels/ui/KeyTypeValueRow'
import { useActiveGraphRenderData } from '@/hooks/useActiveGraphData'
import { useGraphStore } from '@/hooks/useGraphStore'
import {
  readFlowEditorFloatingPanelSplitHeightsPx,
  resolveFlowEditorFloatingPanelSplitResize,
  type FlowEditorFloatingPanelSplitHeightsPx,
} from '@/lib/flowEditor/flowEditorFloatingPanelSplit'
import { buildFlowEditorPortRows, type FlowEditorPortRow } from '@/lib/flowEditor/flowEditorPortRows'
import { bindResizeSeparatorDragRuntime } from '@/lib/ui/resizeSeparatorDrag'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { UI_RESPONSIVE_FLOATING_PANEL_SCROLL_CLASSNAME } from '@/lib/ui/responsiveElementClasses'
import { cn } from '@/lib/utils'

const FLOW_EDITOR_ROW_DIRECTION_LABEL: Record<FlowEditorPortRow['direction'], string> = {
  input: 'Input',
  output: 'Output',
}

const FLOW_EDITOR_ROW_DIRECTION_ICON: Record<FlowEditorPortRow['direction'], React.ComponentType<React.SVGProps<SVGSVGElement>>> = {
  input: ArrowDownToDot,
  output: ArrowUpFromDot,
}

const FLOW_EDITOR_ROW_DIRECTION_CLASS: Record<FlowEditorPortRow['direction'], string> = {
  input: 'border-sky-300/70 bg-sky-50 text-sky-700 dark:border-sky-700/70 dark:bg-sky-950/30 dark:text-sky-300',
  output: 'border-emerald-300/70 bg-emerald-50 text-emerald-700 dark:border-emerald-700/70 dark:bg-emerald-950/30 dark:text-emerald-300',
}

function DirectionChip({ direction }: { direction: FlowEditorPortRow['direction'] }) {
  const Icon = FLOW_EDITOR_ROW_DIRECTION_ICON[direction]
  return (
    <span
      className={cn(
        'inline-flex min-w-0 max-w-full items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] font-semibold leading-4',
        FLOW_EDITOR_ROW_DIRECTION_CLASS[direction],
      )}
    >
      <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
      <span className="truncate">{FLOW_EDITOR_ROW_DIRECTION_LABEL[direction]}</span>
    </span>
  )
}

function FlowEditorPortRowView({
  row,
  selected,
  selectionActive,
  onSelect,
}: {
  row: FlowEditorPortRow
  selected: boolean
  selectionActive: boolean
  onSelect: (rowKey: string) => void
}) {
  return (
    <section
      className={cn(selectionActive && !selected && 'opacity-45 transition-opacity hover:opacity-90')}
      data-kg-flow-editor-port-row="1"
      data-kg-flow-editor-port-direction={row.direction}
      data-kg-flow-editor-port-key={row.portKey}
      data-kg-flow-editor-node-id={row.nodeId}
      data-kg-flow-editor-port-row-key={row.key}
      data-kg-flow-editor-port-selected={selected ? 'true' : 'false'}
      data-kg-flow-editor-port-dimmed={selectionActive && !selected ? 'true' : 'false'}
    >
      <KeyTypeValueRow
        density="compact"
        align="start"
        isActive={selected}
        onClick={() => onSelect(row.key)}
        keyNode={(
          <span className="flex min-w-0 flex-col leading-4">
            <span className="truncate font-semibold">{row.nodeLabel}</span>
            <span className={cn('truncate text-[11px] font-normal', UI_THEME_TOKENS.text.tertiary)}>{row.nodeType}</span>
          </span>
        )}
        typeNode={(
          <span className="flex min-w-0 max-w-full items-center justify-start gap-1 overflow-hidden sm:justify-end">
            <DirectionChip direction={row.direction} />
            <span className={cn('min-w-0 truncate text-[11px]', UI_THEME_TOKENS.text.secondary)}>{row.socketType}</span>
          </span>
        )}
        valueNode={(
          <span className="flex min-w-0 max-w-full items-center gap-1 overflow-hidden">
            <span className="min-w-0 truncate font-mono text-[11px]">{row.portKey}</span>
            <span className={cn('shrink-0 rounded border px-1 py-0.5 text-[11px] leading-4', UI_THEME_TOKENS.panel.border, UI_THEME_TOKENS.text.tertiary)}>
              {row.connectedEdgeCount}
            </span>
          </span>
        )}
      />
    </section>
  )
}

function FlowEditorPortDetailRows({ row }: { row: FlowEditorPortRow | null }) {
  if (!row) {
    return (
      <section className={cn('px-1 py-2', KTV_STATUS_TEXT_CLASS_NAME)} data-kg-flow-editor-port-detail-empty="1">
        Select an input or output row.
      </section>
    )
  }
  const connectedText = row.connectedEdgeIds.length > 0 ? row.connectedEdgeIds.join(', ') : 'None'
  return (
    <section
      className="min-h-0"
      data-kg-flow-editor-port-detail-selected-row-key={row.key}
      data-kg-flow-editor-port-detail-node-id={row.nodeId}
      data-kg-flow-editor-port-detail-port-key={row.portKey}
    >
      <KeyTypeValueHeader keyLabel="Property" typeLabel="Type" valueLabel="Value" stickyOffsetClassName="top-0" />
      <KeyTypeValueSectionStack>
        <KeyTypeValueRow
          density="compact"
          keyNode="Node"
          typeNode={row.nodeType}
          valueNode={<span className="min-w-0 truncate">{row.nodeLabel}</span>}
        />
        <KeyTypeValueRow
          density="compact"
          keyNode="Node ID"
          typeNode="id"
          valueNode={<span className="min-w-0 truncate font-mono text-[11px]">{row.nodeId}</span>}
        />
        <KeyTypeValueRow
          density="compact"
          keyNode="Port"
          typeNode={<DirectionChip direction={row.direction} />}
          valueNode={<span className="min-w-0 truncate font-mono text-[11px]">{row.portKey}</span>}
        />
        <KeyTypeValueRow
          density="compact"
          keyNode="Socket"
          typeNode="type"
          valueNode={<span className="min-w-0 truncate">{row.socketType}</span>}
        />
        <KeyTypeValueRow
          density="compact"
          align="start"
          keyNode="Edges"
          typeNode={`${row.connectedEdgeCount}`}
          valueNode={<span className="min-w-0 truncate font-mono text-[11px]" title={connectedText}>{connectedText}</span>}
        />
      </KeyTypeValueSectionStack>
    </section>
  )
}

export function FlowEditorFloatingPanelView() {
  const graphData = useActiveGraphRenderData(true)
  const summary = React.useMemo(() => buildFlowEditorPortRows(graphData), [graphData])
  const selectedRowKey = useGraphStore(s => s.flowEditorSelectedPortRowKey || '')
  const setSelectedRowKey = useGraphStore(s => s.setFlowEditorSelectedPortRowKey)
  const listRef = React.useRef<HTMLElement | null>(null)
  const rowsPaneRef = React.useRef<HTMLElement | null>(null)
  const detailsPaneRef = React.useRef<HTMLElement | null>(null)
  const resizeHandleRef = React.useRef<HTMLHRElement | null>(null)
  const [splitHeightsPx, setSplitHeightsPx] = React.useState<FlowEditorFloatingPanelSplitHeightsPx | null>(null)
  const splitHeightsPxRef = React.useRef<FlowEditorFloatingPanelSplitHeightsPx | null>(splitHeightsPx)
  splitHeightsPxRef.current = splitHeightsPx
  const totalCount = summary.rows.length
  const rowKeys = React.useMemo(() => new Set(summary.rows.map(row => row.key)), [summary.rows])
  const selectedRow = React.useMemo(
    () => summary.rows.find(row => row.key === selectedRowKey) || null,
    [selectedRowKey, summary.rows],
  )
  const handleSelectRow = React.useCallback((rowKey: string) => {
    const key = String(rowKey || '').trim()
    setSelectedRowKey(selectedRowKey === key ? null : key)
  }, [selectedRowKey, setSelectedRowKey])

  React.useEffect(() => {
    if (!selectedRowKey) return
    if (rowKeys.has(selectedRowKey)) return
    setSelectedRowKey(null)
  }, [rowKeys, selectedRowKey, setSelectedRowKey])

  React.useLayoutEffect(() => {
    if (!selectedRowKey) return
    const root = listRef.current
    if (!root) return
    const selector = `[data-kg-flow-editor-port-row-key="${selectedRowKey.replace(/["\\]/g, '\\$&')}"]`
    const row = root.querySelector<HTMLElement>(selector)
    row?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [selectedRowKey])

  const readCurrentSplitHeightsPx = React.useCallback(() => {
    return splitHeightsPxRef.current || readFlowEditorFloatingPanelSplitHeightsPx({
      rowsElement: rowsPaneRef.current,
      detailsElement: detailsPaneRef.current,
    })
  }, [])

  React.useEffect(() => {
    const el = resizeHandleRef.current
    if (!el) return
    return bindResizeSeparatorDragRuntime<FlowEditorFloatingPanelSplitHeightsPx>({
      resizeHandleEl: el,
      cursor: 'row-resize',
      readCurrentValue: readCurrentSplitHeightsPx,
      setPreviewValue: setSplitHeightsPx,
      commitValue: setSplitHeightsPx,
      resolveNextValueFromPointerDrag: input => resolveFlowEditorFloatingPanelSplitResize({
        startHeightsPx: input.startValue,
        deltaY: input.deltaY,
      }),
    })
  }, [readCurrentSplitHeightsPx])

  const rowsPaneStyle = splitHeightsPx
    ? { flex: `0 0 ${splitHeightsPx.rows}px` }
    : { flex: '1 1 62%' }
  const detailsPaneStyle = splitHeightsPx
    ? { flex: `1 1 ${splitHeightsPx.details}px` }
    : { flex: '0 1 38%' }

  return (
    <section
      className="flex h-full min-h-0 flex-col gap-2"
      aria-label="Flow Editor inputs and outputs"
      data-kg-flow-editor-floating-panel="1"
      data-kg-flow-editor-port-count={totalCount}
      data-kg-flow-editor-input-count={summary.inputCount}
      data-kg-flow-editor-output-count={summary.outputCount}
    >
      <header className="flex items-center justify-between gap-2 px-1">
        <section className="min-w-0">
          <section className={cn('truncate text-xs font-semibold', UI_THEME_TOKENS.text.primary)}>Flow Editor</section>
          <section className={cn('truncate text-[11px]', UI_THEME_TOKENS.text.secondary)} data-kg-flow-editor-port-summary="1">
            {summary.inputCount} inputs, {summary.outputCount} outputs, {summary.connectedCount} connected
          </section>
        </section>
      </header>
      <section className="flex min-h-0 flex-1 flex-col" data-kg-flow-editor-port-split="1">
        <section
          ref={rowsPaneRef}
          className="min-h-0 overflow-hidden"
          style={rowsPaneStyle}
          data-kg-flow-editor-port-list-pane="1"
        >
          <section ref={listRef} className={cn(UI_RESPONSIVE_FLOATING_PANEL_SCROLL_CLASSNAME, 'h-full min-h-0 px-1 pb-2')} data-kg-flow-editor-port-list="1">
            <KeyTypeValueHeader keyLabel="Node" typeLabel="Port" valueLabel="Key / edges" />
            {totalCount > 0 ? (
              <KeyTypeValueSectionStack>
                {summary.rows.map(row => (
                  <FlowEditorPortRowView
                    key={row.key}
                    row={row}
                    selected={selectedRowKey === row.key}
                    selectionActive={!!selectedRowKey}
                    onSelect={handleSelectRow}
                  />
                ))}
              </KeyTypeValueSectionStack>
            ) : (
              <section className={cn('px-1 py-2', KTV_STATUS_TEXT_CLASS_NAME)}>
                No Flow Editor inputs or outputs.
              </section>
            )}
          </section>
        </section>
        <HorizontalResizeSeparatorHr
          ref={resizeHandleRef}
          ariaLabel="Resize Flow Editor rows and details"
          className="kg-flow-editor-floating-panel-split-resize"
          data-kg-flow-editor-port-split-resize="1"
          tabIndex={0}
        />
        <section
          ref={detailsPaneRef}
          className={cn(UI_RESPONSIVE_FLOATING_PANEL_SCROLL_CLASSNAME, 'min-h-0 px-1 pb-2 pt-1')}
          style={detailsPaneStyle}
          data-kg-flow-editor-port-detail-panel="1"
        >
          <header className="flex items-center justify-between gap-2 px-1 pb-1">
            <section className={cn('min-w-0 truncate text-xs font-semibold', UI_THEME_TOKENS.text.primary)}>Details</section>
            {selectedRow ? (
              <section className={cn('min-w-0 truncate text-[11px]', UI_THEME_TOKENS.text.secondary)}>
                {selectedRow.connectedEdgeCount} edges
              </section>
            ) : null}
          </header>
          <FlowEditorPortDetailRows row={selectedRow} />
        </section>
      </section>
    </section>
  )
}
