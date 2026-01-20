import React from 'react'
import * as d3 from 'd3'
import type { GraphDataTableAggregateNumericSummary } from '@/features/graph-data-table/graphDataTable'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { buildClosedPathD, computeConvexRing } from '@/lib/geometry/convexRing'

interface AggregateRowVisualizationProps {
  numericSummaries: GraphDataTableAggregateNumericSummary[]
  width: number
  height: number
  isHighlighted: boolean
}

type AggregateNodeData = {
  name: string
  value?: number
  children?: AggregateNodeData[]
}

export function AggregateRowVisualization({
  numericSummaries,
  width,
  height,
  isHighlighted,
}: AggregateRowVisualizationProps) {
  const pathData = React.useMemo(() => {
    if (!numericSummaries || numericSummaries.length === 0) return null
    const values = numericSummaries
      .map(s => (Number.isFinite(s.avg) ? s.avg : 0))
      .filter(v => v > 0)
    if (values.length === 0) return null
    const maxValue = Math.max(...values)
    if (!Number.isFinite(maxValue) || maxValue <= 0) return null

    const root: AggregateNodeData = {
      name: 'root',
      children: numericSummaries.map(s => ({
        name: String(s.key),
        value: Number.isFinite(s.avg) && s.avg > 0 ? s.avg : 0,
      })),
    }

    const radius = Math.min(width, height) / 2
    const centerX = width / 2
    const centerY = height / 2

    const layout = d3.cluster<AggregateNodeData>().size([2 * Math.PI, radius])
    const hierarchyRoot = d3.hierarchy<AggregateNodeData>(root)
    layout(hierarchyRoot)

    const leaves = hierarchyRoot.leaves()
    if (leaves.length === 0) return null

    const points: [number, number][] = []
    for (const leaf of leaves) {
      const rawValue = leaf.data.value
      const normalized = rawValue > 0 ? rawValue / maxValue : 0
      const r = radius * (0.2 + 0.8 * Math.max(0, Math.min(1, normalized)))
      const angle = leaf.x
      const x = centerX + r * Math.cos(angle - Math.PI / 2)
      const y = centerY + r * Math.sin(angle - Math.PI / 2)
      points.push([x, y])
    }

    const ring = computeConvexRing(points.map(([x, y]) => ({ x, y })))
    return buildClosedPathD(ring)
  }, [numericSummaries, width, height])

  if (!pathData) return null

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
      className={isHighlighted ? UI_THEME_TOKENS.icon.active : UI_THEME_TOKENS.text.tertiary}
    >
      <path d={pathData} fill="none" stroke="currentColor" strokeWidth={isHighlighted ? 1.5 : 1} />
    </svg>
  )
}

export function AggregateRowBarVisualization({
  numericSummaries,
  width,
  height,
  isHighlighted,
}: AggregateRowVisualizationProps) {
  const bars = React.useMemo(() => {
    if (!numericSummaries || numericSummaries.length === 0) return null
    const values = numericSummaries
      .map(s => (Number.isFinite(s.avg) ? s.avg : 0))
      .filter(v => v > 0)
    if (values.length === 0) return null
    const maxValue = Math.max(...values)
    if (!Number.isFinite(maxValue) || maxValue <= 0) return null
    const maxBars = 12
    const count = Math.min(values.length, maxBars)
    const barWidth = width / (count * 1.5)
    const gap = barWidth / 2
    const barsData: { x: number; y: number; w: number; h: number }[] = []
    for (let i = 0; i < count; i += 1) {
      const value = values[i]
      const normalized = value > 0 ? value / maxValue : 0
      const h = Math.max(1, height * normalized)
      const x = i * (barWidth + gap)
      const y = height - h
      barsData.push({ x, y, w: barWidth, h })
    }
    return barsData
  }, [numericSummaries, width, height])

  if (!bars) return null

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
      className={isHighlighted ? UI_THEME_TOKENS.icon.active : UI_THEME_TOKENS.text.tertiary}
    >
      {bars.map((bar, index) => (
        <rect
          key={index}
          x={bar.x}
          y={bar.y}
          width={bar.w}
          height={bar.h}
          fill="currentColor"
        />
      ))}
    </svg>
  )
}

export function AggregateRowSparklineVisualization({
  numericSummaries,
  width,
  height,
  isHighlighted,
}: AggregateRowVisualizationProps) {
  const pathData = React.useMemo(() => {
    if (!numericSummaries || numericSummaries.length === 0) return null
    const values = numericSummaries
      .map(s => (Number.isFinite(s.avg) ? s.avg : 0))
      .filter(v => v > 0)
    if (values.length === 0) return null
    const maxValue = Math.max(...values)
    if (!Number.isFinite(maxValue) || maxValue <= 0) return null
    const count = values.length
    if (count === 0) return null
    const stepX = count === 1 ? 0 : width / (count - 1)
    const path = d3.path()
    for (let i = 0; i < count; i += 1) {
      const value = values[i]
      const normalized = value > 0 ? value / maxValue : 0
      const x = stepX * i
      const y = height - height * normalized
      if (i === 0) {
        path.moveTo(x, y)
      } else {
        path.lineTo(x, y)
      }
    }
    return path.toString()
  }, [numericSummaries, width, height])

  if (!pathData) return null

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
      className={isHighlighted ? UI_THEME_TOKENS.icon.active : UI_THEME_TOKENS.text.tertiary}
    >
      <path d={pathData} fill="none" stroke="currentColor" strokeWidth={isHighlighted ? 1.5 : 1} />
    </svg>
  )
}
