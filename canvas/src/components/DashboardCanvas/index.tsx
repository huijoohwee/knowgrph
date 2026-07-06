import React from 'react'
import * as d3 from 'd3'
import { useActiveGraphRenderData } from '@/hooks/useActiveGraphData'
import { useGraphStore } from '@/hooks/useGraphStore'
import { useContainerDims } from '@/hooks/useContainerDims'
import { buildKanbanCardDropIntentLabel } from '@/features/markdown/ui/kanban/kanbanDragIntent'
import { getKanbanCardDragVisualState } from '@/features/markdown/ui/kanban/kanbanDragVisualState'
import { KanbanCardDropPreview } from '@/features/markdown/ui/kanban/KanbanDropPreview'
import { isInteractiveEventTarget } from '@/features/markdown/ui/kanban/kanbanMenu'
import { areKanbanRowIdsEqual, moveKanbanRowIdBeforeTarget, reconcileKanbanRowIds } from '@/features/markdown/ui/kanban/kanbanOrderState'
import { reorderKanbanRowIds, type KanbanDropPosition } from '@/features/markdown/ui/kanban/kanbanReorder'
import {
  type KanbanCardDragProps,
  type KanbanCardDropProps,
  useKanbanDragAndDrop,
} from '@/features/markdown/ui/kanban/useKanbanDragAndDrop'
import { CardInlineTextEditor } from '@/lib/cards/CardInlineTextEditor'
import { buildInlineMediaCommandContextFromRecord } from '@/lib/command-menu/inlineMediaCommandContext'
import { CanvasGridOverlaySurface } from '@/components/CanvasGridOverlaySurface'
import { readCanvasGridRenderConfigFromSchema } from '@/lib/canvas/canvasGridConfig'
import { buildScopedGraphSemanticKey } from '@/lib/graph/semanticKey'
import {
  UI_RESPONSIVE_CARD_MULTILINE_EDITOR_CLASSNAME,
  UI_RESPONSIVE_CARD_TITLE_EDITOR_CLASSNAME,
} from '@/lib/ui/responsiveElementClasses'
import {
  UI_RESPONSIVE_VIEWPORT_FIT_CONTENT_CLASSNAME,
  UI_RESPONSIVE_VIEWPORT_FIT_GRID_CLASSNAME,
  buildResponsiveViewportFitContentStyle,
  buildResponsiveViewportFitGridStyle,
} from '@/lib/ui/responsiveViewportFitGrid'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import {
  buildDashboardCanvasModel,
  type DashboardCard,
  type DashboardMetric,
  type DashboardSeriesPoint,
  type DashboardTableRow,
  type DashboardTone,
} from './dashboardModel'

type DashboardCanvasProps = {
  active?: boolean
}

const CHART_WIDTH = 360
const CHART_HEIGHT = 178
const CHART_PADDING = { top: 18, right: 18, bottom: 28, left: 34 }
const CHART_TOOLTIP_WIDTH = 156
const CHART_TOOLTIP_HEIGHT = 54
const EMPTY_DASHBOARD_ROW: DashboardTableRow = { id: 'empty', label: 'No rows', value: '0' }
const DASHBOARD_METRICS_GROUP_KEY = 'dashboard-metrics'
const DASHBOARD_CONTENT_STYLE = buildResponsiveViewportFitContentStyle()
const DASHBOARD_METRICS_GRID_STYLE = buildResponsiveViewportFitGridStyle()

type DashboardChartTooltipState = {
  point: DashboardSeriesPoint
  x: number
  y: number
}

type DashboardMetricTextOverride = {
  label?: string
  detail?: string
}

type DashboardCardTextField = 'title' | 'subtitle' | 'footnote'

type DashboardCardTextOverride = Partial<Record<DashboardCardTextField, string>>

const TONE_COLORS: Record<DashboardTone, { stroke: string; fill: string; bar: string; chip: string }> = {
  blue: {
    stroke: '#2563eb',
    fill: 'rgba(37, 99, 235, 0.16)',
    bar: '#3b82f6',
    chip: 'border-blue-200 bg-blue-50 text-blue-800',
  },
  green: {
    stroke: '#047857',
    fill: 'rgba(4, 120, 87, 0.16)',
    bar: '#10b981',
    chip: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  },
  amber: {
    stroke: '#b45309',
    fill: 'rgba(180, 83, 9, 0.16)',
    bar: '#f59e0b',
    chip: 'border-amber-200 bg-amber-50 text-amber-800',
  },
  rose: {
    stroke: '#be123c',
    fill: 'rgba(190, 18, 60, 0.14)',
    bar: '#f43f5e',
    chip: 'border-rose-200 bg-rose-50 text-rose-800',
  },
  slate: {
    stroke: '#475569',
    fill: 'rgba(71, 85, 105, 0.12)',
    bar: '#64748b',
    chip: 'border-slate-200 bg-slate-50 text-slate-700',
  },
}

const formatNumber = (value: number): string => {
  if (!Number.isFinite(value)) return '0'
  if (Math.abs(value) >= 1000) return d3.format('~s')(value)
  if (Math.abs(value) >= 10) return d3.format(',.0f')(value)
  return d3.format(',.2~f')(value)
}

const clampLabel = (label: string): string => {
  if (label.length <= 14) return label
  return `${label.slice(0, 13)}…`
}

const clampTooltipText = (label: string, maxLength: number): string => {
  if (label.length <= maxLength) return label
  return `${label.slice(0, Math.max(0, maxLength - 1))}…`
}

function DashboardChartTooltipOverlay(props: {
  tooltip: DashboardChartTooltipState | null
  tone: DashboardTone
}) {
  if (!props.tooltip) return null
  const colors = TONE_COLORS[props.tone]
  const x = Math.min(
    CHART_WIDTH - CHART_TOOLTIP_WIDTH - 4,
    Math.max(4, props.tooltip.x + 10),
  )
  const preferredY = props.tooltip.y - CHART_TOOLTIP_HEIGHT - 10
  const y = preferredY >= 4
    ? preferredY
    : Math.min(CHART_HEIGHT - CHART_TOOLTIP_HEIGHT - 4, props.tooltip.y + 12)
  const detail = String(props.tooltip.point.detail || '').trim()
  return (
    <g
      transform={`translate(${x},${y})`}
      data-kg-dashboard-chart-tooltip="1"
      pointerEvents="none"
      aria-hidden="true"
    >
      <rect
        width={CHART_TOOLTIP_WIDTH}
        height={CHART_TOOLTIP_HEIGHT}
        rx={6}
        fill="var(--kg-panel-bg)"
        stroke={colors.stroke}
        strokeOpacity={0.78}
        filter="drop-shadow(0 8px 18px rgba(15,23,42,0.16))"
      />
      <text x={9} y={17} fill="var(--kg-text-tertiary)" fontSize="10" fontWeight={600}>
        {clampTooltipText(props.tooltip.point.label, 24)}
      </text>
      <text x={9} y={34} fill="var(--kg-text-primary)" fontSize="14" fontWeight={700}>
        {formatNumber(props.tooltip.point.value)}
      </text>
      {detail ? (
        <text x={9} y={48} fill="var(--kg-text-secondary)" fontSize="9">
          {clampTooltipText(detail, 28)}
        </text>
      ) : null}
    </g>
  )
}

const orderDashboardCards = (cards: readonly DashboardCard[], order: readonly string[] | null | undefined): DashboardCard[] => {
  const cardById = new Map(cards.map(card => [card.id, card]))
  const reconciled = reconcileKanbanRowIds(order, cards.map(card => card.id))
  return reconciled.map(id => cardById.get(id)).filter(Boolean) as DashboardCard[]
}

const orderDashboardMetrics = (metrics: readonly DashboardMetric[], order: readonly string[] | null | undefined): DashboardMetric[] => {
  const metricById = new Map(metrics.map(metric => [metric.id, metric]))
  const reconciled = reconcileKanbanRowIds(order, metrics.map(metric => metric.id))
  return reconciled.map(id => metricById.get(id)).filter(Boolean) as DashboardMetric[]
}

const readDashboardCardTextField = (card: DashboardCard, field: DashboardCardTextField): string => {
  if (field === 'title') return card.title
  if (field === 'subtitle') return card.subtitle
  return card.footnote || ''
}

const hasDashboardCardTextOverride = (override: DashboardCardTextOverride | null | undefined): boolean => {
  return !!override && (!!override.title || !!override.subtitle || !!override.footnote)
}

const readYDomain = (series: readonly DashboardSeriesPoint[]): [number, number] => {
  const values = series.map(point => point.value).filter(Number.isFinite)
  const max = Math.max(1, d3.max(values) ?? 1)
  const min = Math.min(0, d3.min(values) ?? 0)
  return [min, max]
}

function ChartGridLines(props: {
  y: d3.ScaleLinear<number, number>
  gridEnabled: boolean
}) {
  if (!props.gridEnabled) return null
  const ticks = props.y.ticks(4)
  return (
    <g aria-hidden="true">
      {ticks.map(tick => (
        <line
          key={tick}
          x1={CHART_PADDING.left}
          x2={CHART_WIDTH - CHART_PADDING.right}
          y1={props.y(tick)}
          y2={props.y(tick)}
          stroke="var(--kg-border)"
          strokeOpacity={0.62}
          strokeWidth={0.8}
        />
      ))}
    </g>
  )
}

function DashboardLineAreaChart(props: {
  series: readonly DashboardSeriesPoint[]
  tone: DashboardTone
  gridEnabled: boolean
  area?: boolean
}) {
  const series = props.series.length ? props.series : [{ label: '0', value: 0 }]
  const [tooltip, setTooltip] = React.useState<DashboardChartTooltipState | null>(null)
  const x = d3
    .scaleLinear()
    .domain([0, Math.max(1, series.length - 1)])
    .range([CHART_PADDING.left, CHART_WIDTH - CHART_PADDING.right])
  const y = d3
    .scaleLinear()
    .domain(readYDomain(series))
    .nice()
    .range([CHART_HEIGHT - CHART_PADDING.bottom, CHART_PADDING.top])
  const linePath = d3
    .line<DashboardSeriesPoint>()
    .x((_, index) => x(index))
    .y(point => y(point.value))
    .curve(d3.curveMonotoneX)(series) || ''
  const areaPath = d3
    .area<DashboardSeriesPoint>()
    .x((_, index) => x(index))
    .y0(y(0))
    .y1(point => y(point.value))
    .curve(d3.curveMonotoneX)(series) || ''
  const colors = TONE_COLORS[props.tone]
  const hitStep = series.length > 1
    ? Math.abs(x(1) - x(0))
    : CHART_WIDTH - CHART_PADDING.left - CHART_PADDING.right
  const hitWidth = Math.max(22, hitStep)
  const readTooltip = (point: DashboardSeriesPoint, index: number): DashboardChartTooltipState => ({
    point,
    x: x(index),
    y: y(point.value),
  })
  const showTooltip = (point: DashboardSeriesPoint, index: number) => {
    setTooltip(current => current?.point === point ? current : readTooltip(point, index))
  }

  return (
    <svg
      className="h-full w-full overflow-visible"
      viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
      role="img"
      aria-label="Dashboard line chart"
      onMouseLeave={() => setTooltip(null)}
    >
      <ChartGridLines y={y} gridEnabled={props.gridEnabled} />
      {props.area ? <path d={areaPath} fill={colors.fill} /> : null}
      <path d={linePath} fill="none" stroke={colors.stroke} strokeWidth={2.4} strokeLinecap="round" />
      {tooltip ? (
        <line
          x1={tooltip.x}
          x2={tooltip.x}
          y1={CHART_PADDING.top}
          y2={CHART_HEIGHT - CHART_PADDING.bottom}
          stroke={colors.stroke}
          strokeOpacity={0.42}
          strokeDasharray="3 3"
          data-kg-dashboard-chart-hover-line="1"
          aria-hidden="true"
        />
      ) : null}
      {series.map((point, index) => (
        <circle
          key={`${point.label}:${index}`}
          cx={x(index)}
          cy={y(point.value)}
          r={tooltip?.point === point ? 4 : 2.8}
          fill={colors.stroke}
        >
          <title>{`${point.label}: ${formatNumber(point.value)}${point.detail ? ` · ${point.detail}` : ''}`}</title>
        </circle>
      ))}
      {series.map((point, index) => (
        <rect
          key={`hit:${point.label}:${index}`}
          x={Math.max(CHART_PADDING.left, x(index) - hitWidth / 2)}
          y={CHART_PADDING.top}
          width={Math.min(hitWidth, CHART_WIDTH - CHART_PADDING.right - Math.max(CHART_PADDING.left, x(index) - hitWidth / 2))}
          height={CHART_HEIGHT - CHART_PADDING.top - CHART_PADDING.bottom}
          fill="transparent"
          tabIndex={0}
          role="button"
          aria-label={`${point.label}: ${formatNumber(point.value)}${point.detail ? `, ${point.detail}` : ''}`}
          data-kg-dashboard-chart-hit="1"
          onMouseEnter={() => showTooltip(point, index)}
          onMouseMove={() => showTooltip(point, index)}
          onFocus={() => showTooltip(point, index)}
          onBlur={() => setTooltip(null)}
        />
      ))}
      {series.slice(0, 1).map(point => (
        <text key="start" x={CHART_PADDING.left} y={CHART_HEIGHT - 8} fill="var(--kg-text-tertiary)" fontSize="10">
          {clampLabel(point.label)}
        </text>
      ))}
      {series.slice(-1).map(point => (
        <text key="end" x={CHART_WIDTH - CHART_PADDING.right} y={CHART_HEIGHT - 8} textAnchor="end" fill="var(--kg-text-tertiary)" fontSize="10">
          {clampLabel(point.label)}
        </text>
      ))}
      <DashboardChartTooltipOverlay tooltip={tooltip} tone={props.tone} />
    </svg>
  )
}

function DashboardBarChart(props: {
  series: readonly DashboardSeriesPoint[]
  tone: DashboardTone
  gridEnabled: boolean
}) {
  const series = props.series.length ? props.series : [{ label: '0', value: 0 }]
  const [tooltip, setTooltip] = React.useState<DashboardChartTooltipState | null>(null)
  const x = d3
    .scaleBand<string>()
    .domain(series.map(point => point.label))
    .range([CHART_PADDING.left, CHART_WIDTH - CHART_PADDING.right])
    .padding(0.24)
  const y = d3
    .scaleLinear()
    .domain(readYDomain(series))
    .nice()
    .range([CHART_HEIGHT - CHART_PADDING.bottom, CHART_PADDING.top])
  const colors = TONE_COLORS[props.tone]
  const zeroY = y(0)

  return (
    <svg
      className="h-full w-full overflow-visible"
      viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
      role="img"
      aria-label="Dashboard bar chart"
      onMouseLeave={() => setTooltip(null)}
    >
      <ChartGridLines y={y} gridEnabled={props.gridEnabled} />
      {series.map(point => {
        const xPos = x(point.label) ?? CHART_PADDING.left
        const yValue = y(point.value)
        const yPos = y(Math.max(0, point.value))
        const height = Math.max(2, Math.abs(zeroY - yPos))
        const tooltipState = {
          point,
          x: xPos + x.bandwidth() / 2,
          y: Math.min(zeroY, yValue),
        } satisfies DashboardChartTooltipState
        const showTooltip = () => {
          setTooltip(current => current?.point === point ? current : tooltipState)
        }
        return (
          <g
            key={point.label}
            tabIndex={0}
            role="button"
            aria-label={`${point.label}: ${formatNumber(point.value)}${point.detail ? `, ${point.detail}` : ''}`}
            data-kg-dashboard-chart-hit="1"
            onMouseEnter={showTooltip}
            onMouseMove={showTooltip}
            onFocus={showTooltip}
            onBlur={() => setTooltip(null)}
          >
            <rect x={xPos} y={Math.min(zeroY, yPos)} width={x.bandwidth()} height={height} rx={4} fill={colors.bar}>
              <title>{`${point.label}: ${formatNumber(point.value)}${point.detail ? ` · ${point.detail}` : ''}`}</title>
            </rect>
            <rect
              x={xPos}
              y={CHART_PADDING.top}
              width={x.bandwidth()}
              height={CHART_HEIGHT - CHART_PADDING.top - CHART_PADDING.bottom}
              fill="transparent"
              aria-hidden="true"
            />
            <text x={xPos + x.bandwidth() / 2} y={CHART_HEIGHT - 8} textAnchor="middle" fill="var(--kg-text-tertiary)" fontSize="9">
              {clampLabel(point.label)}
            </text>
          </g>
        )
      })}
      <DashboardChartTooltipOverlay tooltip={tooltip} tone={props.tone} />
    </svg>
  )
}

function DashboardMetricTile(props: {
  metric: DashboardMetric
  canEdit: boolean
  cardDragProps: KanbanCardDragProps
  cardDropProps: KanbanCardDropProps
  draggingMetricId: string | null
  dragOverMetricId: string | null
  dragOverPosition: KanbanDropPosition
  commitFlashMetricId: string | null
  registerMetricElement: (metricId: string, element: HTMLElement | null) => void
  onCommitMetricLabel: (metricId: string, nextValue: string) => void
  onCommitMetricDetail: (metricId: string, nextValue: string) => void
}) {
  const { cardDragProps, cardDropProps, dragOverMetricId, dragOverPosition, draggingMetricId, metric } = props
  const colors = TONE_COLORS[metric.tone]
  const dragging = draggingMetricId === metric.id
  const dropTarget = dragOverMetricId === metric.id
  const metricDragVisualState = getKanbanCardDragVisualState({
    hasActiveDrag: draggingMetricId !== null,
    isDragging: dragging,
    isDropTarget: dropTarget,
    isCommitFlash: props.commitFlashMetricId === metric.id,
  })
  return (
    <section
      className={[
        'relative min-h-[78px] min-w-0 rounded-md border px-3 py-2 shadow-sm transition-transform duration-150',
        colors.chip,
        metricDragVisualState.className,
        dragging ? '' : 'hover:-translate-y-[1px]',
      ].join(' ')}
      style={metricDragVisualState.style}
      data-kg-dashboard-metric={metric.id}
      data-kg-dashboard-metric-draggable="1"
      ref={element => props.registerMetricElement(metric.id, element)}
      role="group"
      tabIndex={0}
      aria-label={`Dashboard metric ${metric.label}`}
      aria-grabbed={cardDragProps.draggable ? dragging : undefined}
      {...cardDropProps}
      draggable={cardDragProps.draggable}
      onDragStart={cardDragProps.onDragStart}
      onDragEnd={cardDragProps.onDragEnd}
    >
      {dropTarget ? (
        <KanbanCardDropPreview
          position={dragOverPosition}
          label={buildKanbanCardDropIntentLabel({
            position: dragOverPosition,
            targetCardLabel: metric.label,
            targetLaneLabel: 'Dashboard metrics',
          })}
        />
      ) : null}
      <section className="flex h-full min-h-0 flex-col overflow-y-auto pr-1" data-kg-dashboard-metric-scrollable="1">
        <section className="min-w-0 cursor-grab select-none active:cursor-grabbing" data-kg-dashboard-metric-drag-region="1">
          <CardInlineTextEditor
            value={metric.label}
            ariaLabel={`Dashboard metric label for ${metric.id}`}
            placeholder="Add metric label"
            canEdit={props.canEdit}
            onCommit={nextValue => props.onCommitMetricLabel(metric.id, nextValue)}
            displayClassName="m-0 truncate text-[11px] font-medium"
            editorClassName={`${UI_RESPONSIVE_CARD_TITLE_EDITOR_CLASSNAME} text-[11px] font-medium leading-5`}
          />
        </section>
        <p className="m-0 mt-1 truncate text-xl font-semibold leading-tight">{metric.value}</p>
        <CardInlineTextEditor
          value={metric.detail}
          ariaLabel={`Dashboard metric detail for ${metric.id}`}
          placeholder="Add metric detail"
          canEdit={props.canEdit}
          onCommit={nextValue => props.onCommitMetricDetail(metric.id, nextValue)}
          displayClassName="m-0 mt-1 truncate text-[11px] opacity-80"
          editorClassName={`${UI_RESPONSIVE_CARD_TITLE_EDITOR_CLASSNAME} mt-1 text-[11px] leading-5`}
        />
      </section>
    </section>
  )
}

function DashboardTableRows(props: {
  card: DashboardCard
  selectedNodeId: string
  canEditRows: boolean
  onSelectRow?: (rowId: string) => void
  onCommitRowLabel?: (rowId: string, nextValue: string) => void
}) {
  const baseRows = props.card.rows.length ? props.card.rows : [EMPTY_DASHBOARD_ROW]
  const rowIds = React.useMemo(() => baseRows.map(row => row.id), [baseRows])
  const rowIdsKey = rowIds.join('\u0000')
  const [rowOrder, setRowOrder] = React.useState<string[]>(() => reconcileKanbanRowIds([], rowIds))
  const [draggingRowId, setDraggingRowId] = React.useState<string | null>(null)

  React.useEffect(() => {
    setRowOrder(current => {
      const next = reconcileKanbanRowIds(current, rowIds)
      return areKanbanRowIdsEqual(current, next) ? current : next
    })
  }, [rowIdsKey, rowIds])

  const rowById = React.useMemo(() => new Map(baseRows.map(row => [row.id, row])), [baseRows])
  const rows = React.useMemo(
    () => reconcileKanbanRowIds(rowOrder, rowIds).map(id => rowById.get(id)).filter(Boolean) as DashboardTableRow[],
    [rowById, rowIds, rowOrder],
  )

  return (
    <section className="flex h-full min-h-0 flex-col overflow-y-auto pr-1" data-kg-dashboard-card-scrollable="1">
      {rows.map(row => {
        const rowMovable = row.id !== EMPTY_DASHBOARD_ROW.id
        const selected = props.selectedNodeId === row.id
        const dragging = draggingRowId === row.id
        return (
        <section
          key={row.id}
          className={[
            'grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-[var(--kg-border)] py-2 last:border-b-0',
            rowMovable ? 'cursor-grab select-none active:cursor-grabbing' : '',
            selected ? 'rounded border-b-transparent bg-blue-50/80 px-2 ring-1 ring-blue-300' : '',
            dragging ? 'opacity-45' : '',
          ].join(' ')}
          data-kg-dashboard-table-row={row.id}
          data-kg-dashboard-table-row-draggable={rowMovable ? '1' : undefined}
          draggable={rowMovable}
          aria-grabbed={rowMovable ? dragging : undefined}
          onClick={event => {
            if (!rowMovable || isInteractiveEventTarget(event.target)) return
            props.onSelectRow?.(row.id)
          }}
          onDragStart={event => {
            if (!rowMovable) return
            event.stopPropagation()
            event.dataTransfer.effectAllowed = 'move'
            event.dataTransfer.setData('text/plain', row.id)
            setDraggingRowId(row.id)
          }}
          onDragOver={event => {
            if (!draggingRowId || draggingRowId === row.id) return
            event.preventDefault()
            event.stopPropagation()
            event.dataTransfer.dropEffect = 'move'
          }}
          onDrop={event => {
            if (!draggingRowId || draggingRowId === row.id) return
            event.preventDefault()
            event.stopPropagation()
            setRowOrder(current => {
              const currentOrder = reconcileKanbanRowIds(current, rowIds)
              const next = moveKanbanRowIdBeforeTarget(currentOrder, draggingRowId, row.id)
              return areKanbanRowIdsEqual(currentOrder, next) ? current : next
            })
            setDraggingRowId(null)
          }}
          onDragEnd={event => {
            event.stopPropagation()
            setDraggingRowId(null)
          }}
        >
          <section className="min-w-0">
            <CardInlineTextEditor
              value={row.label}
              ariaLabel={`Dashboard row label for ${row.id}`}
              placeholder="Add label"
              canEdit={props.canEditRows && rowMovable}
              onCommit={nextValue => props.onCommitRowLabel?.(row.id, nextValue)}
              displayClassName="m-0 truncate text-xs font-medium text-[var(--kg-text-primary)]"
              editorClassName={`${UI_RESPONSIVE_CARD_TITLE_EDITOR_CLASSNAME} text-xs font-medium leading-5`}
            />
            {row.detail ? <p className="m-0 mt-0.5 truncate text-[11px] text-[var(--kg-text-tertiary)]" title={row.detail}>{row.detail}</p> : null}
          </section>
          <span className="shrink-0 text-sm font-semibold text-[var(--kg-text-primary)]">{row.value}</span>
        </section>
        )
      })}
    </section>
  )
}

function DashboardCardView(props: {
  sectionLabel: string
  card: DashboardCard
  gridEnabled: boolean
  selectedNodeId: string
  canEditRows: boolean
  canEditCardText: boolean
  cardDragProps: KanbanCardDragProps
  cardDropProps: KanbanCardDropProps
  draggingCardId: string | null
  dragOverCardId: string | null
  dragOverPosition: KanbanDropPosition
  commitFlashCardId: string | null
  registerCardElement: (cardId: string, element: HTMLElement | null) => void
  onSelectRow?: (rowId: string) => void
  onCommitRowLabel?: (rowId: string, nextValue: string) => void
  onCommitCardText?: (cardId: string, field: DashboardCardTextField, nextValue: string) => void
}) {
  const { card, cardDragProps, cardDropProps, dragOverCardId, dragOverPosition, draggingCardId, gridEnabled } = props
  const dragging = draggingCardId === card.id
  const dropTarget = dragOverCardId === card.id
  const cardInlineMediaCommandContext = React.useMemo(() => buildInlineMediaCommandContextFromRecord(card), [card])
  const cardDragVisualState = getKanbanCardDragVisualState({
    hasActiveDrag: draggingCardId !== null,
    isDragging: dragging,
    isDropTarget: dropTarget,
    isCommitFlash: props.commitFlashCardId === card.id,
  })
  return (
    <article
      className={[
        `relative min-w-0 rounded-md border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} p-4 shadow-sm`,
        'transition-transform duration-150',
        cardDragVisualState.className,
        dragging ? '' : 'hover:-translate-y-[1px]',
      ].join(' ')}
      style={cardDragVisualState.style}
      ref={element => props.registerCardElement(card.id, element)}
      data-kg-dashboard-card={card.id}
      data-kg-dashboard-card-draggable="1"
      tabIndex={0}
      role="group"
      aria-label={`Dashboard card ${card.title}`}
      aria-grabbed={cardDragProps.draggable ? dragging : undefined}
      {...cardDropProps}
      draggable={cardDragProps.draggable}
      onDragStart={cardDragProps.onDragStart}
      onDragEnd={cardDragProps.onDragEnd}
    >
      {dropTarget ? (
        <KanbanCardDropPreview
          position={dragOverPosition}
          label={buildKanbanCardDropIntentLabel({
            position: dragOverPosition,
            targetCardLabel: card.title,
            targetLaneLabel: props.sectionLabel,
          })}
        />
      ) : null}
      <header className="mb-3 min-w-0 cursor-grab select-none active:cursor-grabbing" data-kg-dashboard-card-drag-region="1">
        <section className="min-w-0" data-kg-dashboard-card-inline-edit="title">
          <CardInlineTextEditor
            value={card.title}
            ariaLabel={`Dashboard card title for ${card.id}`}
            placeholder="Add card title"
            canEdit={props.canEditCardText}
            onCommit={nextValue => props.onCommitCardText?.(card.id, 'title', nextValue)}
            displayClassName={`m-0 truncate text-sm font-semibold ${UI_THEME_TOKENS.text.primary}`}
            editorClassName={`${UI_RESPONSIVE_CARD_TITLE_EDITOR_CLASSNAME} text-sm font-semibold leading-5`}
          />
        </section>
        <section className="min-w-0" data-kg-dashboard-card-inline-edit="subtitle">
          <CardInlineTextEditor
            value={card.subtitle}
            ariaLabel={`Dashboard card subtitle for ${card.id}`}
            placeholder="Add card subtitle"
            canEdit={props.canEditCardText}
            onCommit={nextValue => props.onCommitCardText?.(card.id, 'subtitle', nextValue)}
            displayClassName={`m-0 mt-1 truncate text-[11px] ${UI_THEME_TOKENS.text.tertiary}`}
            editorClassName={`${UI_RESPONSIVE_CARD_TITLE_EDITOR_CLASSNAME} mt-1 text-[11px] leading-5`}
          />
        </section>
      </header>
      <section className="h-[178px] min-w-0 overflow-hidden">
        {card.kind === 'table' ? (
          <DashboardTableRows
            card={card}
            selectedNodeId={props.selectedNodeId}
            canEditRows={props.canEditRows}
            onSelectRow={props.onSelectRow}
            onCommitRowLabel={props.onCommitRowLabel}
          />
        ) : card.kind === 'bar' ? (
          <DashboardBarChart series={card.series} tone={card.tone} gridEnabled={gridEnabled} />
        ) : (
          <DashboardLineAreaChart series={card.series} tone={card.tone} gridEnabled={gridEnabled} area={card.kind === 'area'} />
        )}
      </section>
      {card.footnote || props.canEditCardText ? (
        <section
          className="mt-3 border-t border-[var(--kg-border)] pt-3"
          data-kg-dashboard-card-inline-edit="footnote"
        >
          <CardInlineTextEditor
            value={card.footnote || ''}
            ariaLabel={`Dashboard card footnote for ${card.id}`}
            placeholder="Add card note"
            canEdit={props.canEditCardText}
            multiline
            markdownPreview="auto"
            markdownCommandContextText={cardInlineMediaCommandContext}
            rows={3}
            onCommit={nextValue => props.onCommitCardText?.(card.id, 'footnote', nextValue)}
            displayClassName={`m-0 text-[11px] leading-5 ${UI_THEME_TOKENS.text.secondary}`}
            editorClassName={`${UI_RESPONSIVE_CARD_MULTILINE_EDITOR_CLASSNAME} text-[11px] leading-5`}
          />
        </section>
      ) : null}
    </article>
  )
}

export default function DashboardCanvas(props: DashboardCanvasProps) {
  const active = props.active !== false
  const containerRef = React.useRef<HTMLElement | null>(null)
  const graphData = useActiveGraphRenderData(active)
  const schema = useGraphStore(state => state.schema)
  const resolvedThemeMode = useGraphStore(state => state.resolvedThemeMode || 'light')
  const selectedNodeId = useGraphStore(state => String(state.selectedNodeId || '').trim())
  const selectNode = useGraphStore(state => state.selectNode)
  const updateNode = useGraphStore(state => state.updateNode)
  const dims = useContainerDims(containerRef)
  const [cardOrderBySection, setCardOrderBySection] = React.useState<Record<string, string[]>>({})
  const [metricOrder, setMetricOrder] = React.useState<string[]>([])
  const [metricTextOverrides, setMetricTextOverrides] = React.useState<Record<string, DashboardMetricTextOverride>>({})
  const [cardTextOverrides, setCardTextOverrides] = React.useState<Record<string, DashboardCardTextOverride>>({})
  const graphSemanticKey = React.useMemo(
    () => buildScopedGraphSemanticKey('dashboard-canvas', { graphData }),
    [graphData],
  )
  const model = React.useMemo(
    () => buildDashboardCanvasModel(graphData, schema),
    [graphData, schema],
  )
  const canvasGrid = React.useMemo(() => readCanvasGridRenderConfigFromSchema(schema), [schema])
  const getDashboardGridTransform = React.useCallback(() => ({ k: 1, x: 0, y: 0 }), [])
  const getDashboardGridEventTarget = React.useCallback(() => containerRef.current, [])
  const sectionOrderKey = React.useMemo(
    () => model.sections.map(section => `${section.id}:${section.cards.map(card => card.id).join(',')}`).join('|'),
    [model.sections],
  )
  const metricOrderKey = React.useMemo(
    () => model.metrics.map(metric => metric.id).join('|'),
    [model.metrics],
  )

  React.useEffect(() => {
    setCardOrderBySection(current => {
      let changed = false
      const next: Record<string, string[]> = {}
      for (const section of model.sections) {
        const ids = section.cards.map(card => card.id)
        const reconciled = reconcileKanbanRowIds(current[section.id], ids)
        next[section.id] = reconciled
        if (!areKanbanRowIdsEqual(current[section.id] || [], reconciled)) changed = true
      }
      for (const sectionId of Object.keys(current)) {
        if (!Object.prototype.hasOwnProperty.call(next, sectionId)) changed = true
      }
      return changed ? next : current
    })
    setCardTextOverrides(current => {
      const validCardIds = new Set(model.sections.flatMap(section => section.cards.map(card => card.id)))
      let changed = false
      const next: Record<string, DashboardCardTextOverride> = {}
      for (const [cardId, override] of Object.entries(current)) {
        if (!validCardIds.has(cardId)) {
          changed = true
          continue
        }
        next[cardId] = override
      }
      return changed ? next : current
    })
  }, [model.sections, sectionOrderKey])

  React.useEffect(() => {
    const metricIds = model.metrics.map(metric => metric.id)
    setMetricOrder(current => {
      const next = reconcileKanbanRowIds(current, metricIds)
      return areKanbanRowIdsEqual(current, next) ? current : next
    })
    setMetricTextOverrides(current => {
      const valid = new Set(metricIds)
      let changed = false
      const next: Record<string, DashboardMetricTextOverride> = {}
      for (const [metricId, override] of Object.entries(current)) {
        if (!valid.has(metricId)) {
          changed = true
          continue
        }
        next[metricId] = override
      }
      return changed ? next : current
    })
  }, [metricOrderKey, model.metrics])

  const displayMetrics = React.useMemo(
    () => model.metrics.map(metric => {
      const override = metricTextOverrides[metric.id]
      if (!override) return metric
      return {
        ...metric,
        label: override.label || metric.label,
        detail: override.detail || metric.detail,
      }
    }),
    [metricTextOverrides, model.metrics],
  )

  const displaySections = React.useMemo(
    () => model.sections.map(section => ({
      ...section,
      cards: section.cards.map(card => {
        const override = cardTextOverrides[card.id]
        if (!hasDashboardCardTextOverride(override)) return card
        return {
          ...card,
          title: override.title || card.title,
          subtitle: override.subtitle || card.subtitle,
          footnote: override.footnote || card.footnote,
        }
      }),
    })),
    [cardTextOverrides, model.sections],
  )

  const dashboardDrag = useKanbanDragAndDrop({
    enabled: active,
    isNoOpMove: move => {
      if (move.sourceGroupKey === DASHBOARD_METRICS_GROUP_KEY && move.targetGroupKey === DASHBOARD_METRICS_GROUP_KEY) {
        const availableMetricIds = model.metrics.map(metric => metric.id)
        if (!availableMetricIds.includes(move.rowId)) return true
        const currentOrder = reconcileKanbanRowIds(metricOrder, availableMetricIds)
        const rowIdToGroupKey = new Map(currentOrder.map(metricId => [metricId, DASHBOARD_METRICS_GROUP_KEY]))
        const nextOrder = reorderKanbanRowIds({
          orderedRowIds: currentOrder,
          availableRowIds: currentOrder,
          rowIdToGroupKey,
          draggedRowId: move.rowId,
          targetGroupKey: move.targetGroupKey,
          targetRowId: move.targetRowId,
          position: move.position,
        })
        return areKanbanRowIdsEqual(currentOrder, nextOrder)
      }
      if (move.sourceGroupKey !== move.targetGroupKey) return true
      const section = model.sections.find(item => item.id === move.targetGroupKey)
      if (!section) return true
      const availableCardIds = section.cards.map(card => card.id)
      if (!availableCardIds.includes(move.rowId)) return true
      const currentOrder = reconcileKanbanRowIds(cardOrderBySection[section.id], availableCardIds)
      const rowIdToGroupKey = new Map(currentOrder.map(cardId => [cardId, section.id]))
      const nextOrder = reorderKanbanRowIds({
        orderedRowIds: currentOrder,
        availableRowIds: currentOrder,
        rowIdToGroupKey,
        draggedRowId: move.rowId,
        targetGroupKey: move.targetGroupKey,
        targetRowId: move.targetRowId,
        position: move.position,
      })
      return areKanbanRowIdsEqual(currentOrder, nextOrder)
    },
    onCommitMove: move => {
      if (move.sourceGroupKey === DASHBOARD_METRICS_GROUP_KEY && move.targetGroupKey === DASHBOARD_METRICS_GROUP_KEY) {
        setMetricOrder(current => {
          const availableMetricIds = model.metrics.map(metric => metric.id)
          if (!availableMetricIds.includes(move.rowId)) return current
          const currentOrder = reconcileKanbanRowIds(current, availableMetricIds)
          const rowIdToGroupKey = new Map(currentOrder.map(metricId => [metricId, DASHBOARD_METRICS_GROUP_KEY]))
          const nextOrder = reorderKanbanRowIds({
            orderedRowIds: currentOrder,
            availableRowIds: currentOrder,
            rowIdToGroupKey,
            draggedRowId: move.rowId,
            targetGroupKey: move.targetGroupKey,
            targetRowId: move.targetRowId,
            position: move.position,
          })
          return areKanbanRowIdsEqual(currentOrder, nextOrder) ? current : nextOrder
        })
        return
      }
      if (move.sourceGroupKey !== move.targetGroupKey) return
      setCardOrderBySection(current => {
        const section = model.sections.find(item => item.id === move.targetGroupKey)
        if (!section) return current
        const availableCardIds = section.cards.map(card => card.id)
        if (!availableCardIds.includes(move.rowId)) return current
        const currentOrder = reconcileKanbanRowIds(current[section.id], availableCardIds)
        const rowIdToGroupKey = new Map(currentOrder.map(cardId => [cardId, section.id]))
        const nextOrder = reorderKanbanRowIds({
          orderedRowIds: currentOrder,
          availableRowIds: currentOrder,
          rowIdToGroupKey,
          draggedRowId: move.rowId,
          targetGroupKey: move.targetGroupKey,
          targetRowId: move.targetRowId,
          position: move.position,
        })
        return areKanbanRowIdsEqual(currentOrder, nextOrder) ? current : { ...current, [section.id]: nextOrder }
      })
    },
  })

  const handleCommitRowLabel = React.useCallback((rowId: string, nextValue: string) => {
    const nodeId = String(rowId || '').trim()
    if (!nodeId) return
    updateNode(nodeId, {
      label: String(nextValue || '').trim(),
    })
  }, [updateNode])

  const commitMetricTextOverride = React.useCallback((metricId: string, field: keyof DashboardMetricTextOverride, nextValue: string) => {
    const id = String(metricId || '').trim()
    if (!id) return
    const metric = model.metrics.find(item => item.id === id)
    if (!metric) return
    const baseValue = field === 'label' ? metric.label : metric.detail
    const normalized = String(nextValue || '').trim()
    setMetricTextOverrides(current => {
      const currentEntry = current[id] || {}
      const nextEntry: DashboardMetricTextOverride = { ...currentEntry }
      if (!normalized || normalized === baseValue) {
        delete nextEntry[field]
      } else {
        nextEntry[field] = normalized
      }
      const hasEntry = !!nextEntry.label || !!nextEntry.detail
      if (!hasEntry && !current[id]) return current
      const next = { ...current }
      if (hasEntry) next[id] = nextEntry
      else delete next[id]
      return next
    })
  }, [model.metrics])

  const commitCardTextOverride = React.useCallback((cardId: string, field: DashboardCardTextField, nextValue: string) => {
    const id = String(cardId || '').trim()
    if (!id) return
    const card = model.sections.flatMap(section => section.cards).find(item => item.id === id)
    if (!card) return
    const baseValue = readDashboardCardTextField(card, field)
    const normalized = String(nextValue || '').trim()
    setCardTextOverrides(current => {
      const currentEntry = current[id] || {}
      const nextEntry: DashboardCardTextOverride = { ...currentEntry }
      if (!normalized || normalized === baseValue) {
        delete nextEntry[field]
      } else {
        nextEntry[field] = normalized
      }
      if (!hasDashboardCardTextOverride(nextEntry) && !current[id]) return current
      const next = { ...current }
      if (hasDashboardCardTextOverride(nextEntry)) next[id] = nextEntry
      else delete next[id]
      return next
    })
  }, [model.sections])

  if (!active) return null

  return (
    <section
      ref={containerRef}
      className={`absolute inset-0 overflow-hidden bg-[var(--kg-canvas-bg)] ${UI_THEME_TOKENS.text.primary}`}
      aria-label="Dashboard canvas"
      data-kg-dashboard-canvas="1"
      data-kg-dashboard-semantic-key={graphSemanticKey || 'empty'}
      data-kg-dashboard-grid-enabled={model.grid.enabled ? '1' : '0'}
      data-kg-dashboard-grid-variant={model.grid.variant}
    >
      <CanvasGridOverlaySurface
        canvasGrid={canvasGrid}
        width={dims.width}
        height={dims.height}
        dpr={dims.dpr}
        getTransform={getDashboardGridTransform}
        getEventTarget={getDashboardGridEventTarget}
        themeSignal={String(resolvedThemeMode)}
        surfaceId="dashboard"
      />
      <section className="absolute inset-0 overflow-auto z-[1]" data-kg-dashboard-scroll-surface="1">
        <section
          className={UI_RESPONSIVE_VIEWPORT_FIT_CONTENT_CLASSNAME}
          style={DASHBOARD_CONTENT_STYLE}
          data-kg-dashboard-responsive-width="1"
        >
          <header className="grid min-w-0 grid-cols-1 gap-4 border-b border-[var(--kg-border)] pb-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,42%)]">
            <section className="min-w-0">
              <p className={`m-0 text-xs font-medium ${UI_THEME_TOKENS.text.tertiary}`}>Dashboard</p>
              <h2 className="m-0 mt-1 truncate text-2xl font-semibold leading-tight" title={model.title}>{model.title}</h2>
              <p className={`m-0 mt-2 truncate text-sm ${UI_THEME_TOKENS.text.secondary}`} title={model.subtitle}>{model.subtitle}</p>
            </section>
            <section className="h-[180px] min-w-0">
              <DashboardLineAreaChart series={model.heroSeries} tone="blue" gridEnabled={model.grid.enabled} area />
            </section>
          </header>

          <section className="min-w-0" aria-label="Dashboard metrics" data-kg-dashboard-metrics-board="1">
            <section
              className={UI_RESPONSIVE_VIEWPORT_FIT_GRID_CLASSNAME}
              style={DASHBOARD_METRICS_GRID_STYLE}
              data-kg-dashboard-metrics-cards="1"
              {...dashboardDrag.createLaneDropProps(DASHBOARD_METRICS_GROUP_KEY)}
            >
              {orderDashboardMetrics(displayMetrics, metricOrder).map(metric => {
                const metricDragProps = dashboardDrag.createCardDragProps({ rowId: metric.id, groupKey: DASHBOARD_METRICS_GROUP_KEY })
                const metricDropProps = dashboardDrag.createCardDropProps({ rowId: metric.id, groupKey: DASHBOARD_METRICS_GROUP_KEY })
                return (
                  <DashboardMetricTile
                    key={metric.id}
                    metric={metric}
                    canEdit
                    cardDragProps={metricDragProps}
                    cardDropProps={metricDropProps}
                    draggingMetricId={dashboardDrag.draggingRowId}
                    dragOverMetricId={dashboardDrag.dragOverRowId}
                    dragOverPosition={dashboardDrag.dragOverPosition}
                    commitFlashMetricId={dashboardDrag.commitFlashRowId}
                    registerMetricElement={(metricId, element) => {
                      dashboardDrag.registerFocusableRowElement({ rowId: metricId, element })
                    }}
                    onCommitMetricLabel={(metricId, nextValue) => commitMetricTextOverride(metricId, 'label', nextValue)}
                    onCommitMetricDetail={(metricId, nextValue) => commitMetricTextOverride(metricId, 'detail', nextValue)}
                  />
                )
              })}
            </section>
          </section>

          <section className="min-w-0" data-kg-dashboard-sections-board="1">
            <section className="grid min-w-0 grid-cols-1 gap-5">
              {displaySections.map(section => (
                <section key={section.id} className="min-w-0" data-kg-dashboard-section={section.id}>
                  <header className="mb-3 flex min-w-0 items-center gap-3">
                    <h3 className="m-0 shrink-0 text-base font-semibold">{section.title}</h3>
                    <div className="h-px min-w-0 flex-1 bg-[var(--kg-border)]" aria-hidden="true" />
                    <span className={`shrink-0 text-xs ${UI_THEME_TOKENS.text.tertiary}`}>{section.cadence}</span>
                  </header>
                  <section
                    className="grid min-w-0 grid-cols-1 gap-3 lg:grid-cols-3"
                    data-kg-dashboard-section-cards="1"
                    {...dashboardDrag.createLaneDropProps(section.id)}
                  >
                    {orderDashboardCards(section.cards, cardOrderBySection[section.id]).map(card => {
                      const cardDragProps = dashboardDrag.createCardDragProps({ rowId: card.id, groupKey: section.id })
                      const cardDropProps = dashboardDrag.createCardDropProps({ rowId: card.id, groupKey: section.id })
                      return (
                        <DashboardCardView
                          key={card.id}
                          sectionLabel={section.title}
                          card={card}
                          gridEnabled={model.grid.enabled}
                          selectedNodeId={selectedNodeId}
                          canEditRows={typeof updateNode === 'function'}
                          canEditCardText
                          cardDragProps={cardDragProps}
                          cardDropProps={cardDropProps}
                          draggingCardId={dashboardDrag.draggingRowId}
                          dragOverCardId={dashboardDrag.dragOverRowId}
                          dragOverPosition={dashboardDrag.dragOverPosition}
                          commitFlashCardId={dashboardDrag.commitFlashRowId}
                          registerCardElement={(cardId, element) => {
                            dashboardDrag.registerFocusableRowElement({ rowId: cardId, element })
                          }}
                          onSelectRow={selectNode}
                          onCommitRowLabel={handleCommitRowLabel}
                          onCommitCardText={commitCardTextOverride}
                        />
                      )
                    })}
                  </section>
                </section>
              ))}
            </section>
          </section>
        </section>
      </section>
    </section>
  )
}
