import React from 'react'
import * as d3 from 'd3'
import type { GraphData } from '@/lib/graph/types'

export interface DatasetMiniVizProps {
  graph: GraphData | null
}

function clampNumber(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min
  if (value < min) return min
  if (value > max) return max
  return value
}

export type MiniBarChartDatum = {
  key: string
  value: number
  label?: string
  color?: string
  onPointerEnter?: () => void
  onPointerLeave?: () => void
  onClick?: () => void
  active?: boolean
}

export function MiniBarChart({
  data,
  width = '100%',
  height = 40,
  className = 'text-gray-400',
  defaultBarColor,
  logicalWidth = 140,
}: {
  data: MiniBarChartDatum[]
  width?: number | string
  height?: number
  className?: string
  defaultBarColor?: string
  logicalWidth?: number
}) {
  const safe = Array.isArray(data) ? data.filter(d => d && typeof d.key === 'string') : []
  if (!safe.length) return null

  const maxValue = safe.reduce((acc, d) => (d.value > acc ? d.value : acc), 0)
  if (!Number.isFinite(maxValue) || maxValue <= 0) return null

  const count = safe.length
  const barWidth = logicalWidth / (count * 1.5)
  const gap = barWidth / 2

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${logicalWidth} ${height}`}
      aria-hidden="true"
      className={[className, 'block'].filter(Boolean).join(' ')}
    >
      {safe.map((d, index) => {
        const normalized = clampNumber(d.value / maxValue, 0, 1)
        const h = Math.max(1, height * normalized)
        const x = index * (barWidth + gap)
        const y = height - h
        const fill = d.color ? d.color : defaultBarColor ? defaultBarColor : 'currentColor'
        const opacity = d.active ? 1 : 0.8
        return (
          <rect
            key={d.key}
            x={x}
            y={y}
            width={barWidth}
            height={h}
            fill={fill}
            opacity={opacity}
            rx={1.5}
            onPointerEnter={d.onPointerEnter}
            onPointerLeave={d.onPointerLeave}
            onClick={d.onClick}
            style={d.onClick ? { cursor: 'pointer' } : undefined}
          >
            {d.label ? <title>{d.label}</title> : null}
          </rect>
        )
      })}
    </svg>
  )
}

export function AutoHeightMiniBarChart({
  data,
  width = '100%',
  className = 'text-gray-400',
  defaultBarColor,
  logicalWidth = 140,
  minHeight = 40,
  containerClassName,
  scrollToKey,
}: {
  data: MiniBarChartDatum[]
  width?: number | string
  className?: string
  defaultBarColor?: string
  logicalWidth?: number
  minHeight?: number
  containerClassName?: string
  scrollToKey?: string | null
}) {
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const [height, setHeight] = React.useState(() => Math.max(1, Math.floor(minHeight)))

  React.useLayoutEffect(() => {
    const el = containerRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const min = Math.max(1, Math.floor(minHeight))
    let raf = 0
    const measure = () => {
      const measured = el.clientHeight || el.getBoundingClientRect().height || 0
      const next = Math.max(min, Math.floor(measured))
      setHeight(prev => (prev === next ? prev : next))
    }
    measure()
    const ro = new ResizeObserver(() => {
      if (raf) cancelAnimationFrame(raf)
      raf = requestAnimationFrame(measure)
    })
    ro.observe(el)
    return () => {
      if (raf) cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [minHeight])

  React.useLayoutEffect(() => {
    if (!scrollToKey) return
    const el = containerRef.current
    if (!el) return
    if (typeof width !== 'number') return
    const safe = Array.isArray(data) ? data.filter(d => d && typeof d.key === 'string') : []
    if (safe.length === 0) return
    const index = safe.findIndex(d => d.key === scrollToKey)
    if (index < 0) return
    const count = safe.length
    if (count <= 0) return
    const clientWidth = el.clientWidth || 0
    if (clientWidth <= 0) return
    const totalWidth = width
    if (!Number.isFinite(totalWidth) || totalWidth <= clientWidth) return
    const centerX = (totalWidth * (index + 1 / 3)) / count
    const padding = 24
    const leftBound = el.scrollLeft + padding
    const rightBound = el.scrollLeft + clientWidth - padding
    if (centerX >= leftBound && centerX <= rightBound) return
    const next = Math.max(0, Math.min(totalWidth - clientWidth, Math.round(centerX - clientWidth / 2)))
    el.scrollLeft = next
  }, [data, scrollToKey, width])

  return (
    <div
      ref={containerRef}
      className={containerClassName}
      style={{ minHeight: Math.max(1, Math.floor(minHeight)) }}
    >
      <MiniBarChart
        data={data}
        width={width}
        height={height}
        className={className}
        defaultBarColor={defaultBarColor}
        logicalWidth={logicalWidth}
      />
    </div>
  )
}

export function DatasetDistributionViz({ graph }: DatasetMiniVizProps) {
  const data = React.useMemo(() => {
    const g = graph
    if (!g || !Array.isArray(g.nodes) || g.nodes.length === 0) return []
    const counts = new Map<string, number>()
    for (let i = 0; i < g.nodes.length; i += 1) {
      const node = g.nodes[i]
      const key = node && typeof node.type === 'string' && node.type.trim() ? node.type.trim() : 'node'
      counts.set(key, (counts.get(key) || 0) + 1)
    }
    const entries = Array.from(counts.entries())
    entries.sort((a, b) => b[1] - a[1])
    return entries.slice(0, 8)
  }, [graph])

  if (!data.length) return null

  const width = 140
  const height = 40
  const maxValue = data.reduce((acc, [, v]) => (v > acc ? v : acc), 0)
  if (!Number.isFinite(maxValue) || maxValue <= 0) return null

  const count = data.length
  const barWidth = width / (count * 1.5)
  const gap = barWidth / 2

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
      className="text-gray-400"
    >
      {data.map(([, value], index) => {
        const normalized = clampNumber(value / maxValue, 0, 1)
        const h = Math.max(1, height * normalized)
        const x = index * (barWidth + gap)
        const y = height - h
        return (
          <rect
            key={index}
            x={x}
            y={y}
            width={barWidth}
            height={h}
            fill="currentColor"
          />
        )
      })}
    </svg>
  )
}

export function DatasetHierarchyViz({ graph }: DatasetMiniVizProps) {
  const layout = React.useMemo(() => {
    const g = graph
    if (!g || !Array.isArray(g.nodes) || (!Array.isArray(g.edges) && !g.nodes.length)) return null
    const nodeTypes = new Map<string, number>()
    const edgeLabels = new Map<string, number>()

    if (Array.isArray(g.nodes)) {
      for (let i = 0; i < g.nodes.length; i += 1) {
        const node = g.nodes[i]
        const key = node && typeof node.type === 'string' && node.type.trim() ? node.type.trim() : 'node'
        nodeTypes.set(key, (nodeTypes.get(key) || 0) + 1)
      }
    }

    if (Array.isArray(g.edges)) {
      for (let i = 0; i < g.edges.length; i += 1) {
        const edge = g.edges[i]
        const key = edge && typeof edge.label === 'string' && edge.label.trim() ? edge.label.trim() : 'edge'
        edgeLabels.set(key, (edgeLabels.get(key) || 0) + 1)
      }
    }

    const nodeTypeEntries = Array.from(nodeTypes.entries())
    nodeTypeEntries.sort((a, b) => b[1] - a[1])
    const edgeLabelEntries = Array.from(edgeLabels.entries())
    edgeLabelEntries.sort((a, b) => b[1] - a[1])

    const rootData: {
      name: string
      children: { name: string; children?: { name: string; value: number }[] }[]
    } = {
      name: 'root',
      children: [],
    }

    if (nodeTypeEntries.length > 0) {
      rootData.children.push({
        name: 'nodes',
        children: nodeTypeEntries.slice(0, 6).map(([name, value]) => ({ name, value })),
      })
    }

    if (edgeLabelEntries.length > 0) {
      rootData.children.push({
        name: 'edges',
        children: edgeLabelEntries.slice(0, 6).map(([name, value]) => ({ name, value })),
      })
    }

    if (rootData.children.length === 0) return null

    const radius = 32
    const root = d3.hierarchy(rootData)
    const cluster = d3.cluster<typeof rootData>().size([2 * Math.PI, radius])
    cluster(root)

    const links: { x1: number; y1: number; x2: number; y2: number }[] = []
    root.links().forEach(link => {
      const angle1 = link.source.x
      const r1 = link.source.y
      const angle2 = link.target.x
      const r2 = link.target.y
      if (typeof angle1 !== 'number' || typeof r1 !== 'number' || typeof angle2 !== 'number' || typeof r2 !== 'number') return
      const x1 = radius + r1 * Math.cos(angle1 - Math.PI / 2)
      const y1 = radius + r1 * Math.sin(angle1 - Math.PI / 2)
      const x2 = radius + r2 * Math.cos(angle2 - Math.PI / 2)
      const y2 = radius + r2 * Math.sin(angle2 - Math.PI / 2)
      links.push({ x1, y1, x2, y2 })
    })

    return { radius, links }
  }, [graph])

  if (!layout) return null

  const size = layout.radius * 2

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden="true"
      className="text-gray-400"
    >
      {layout.links.map((link, index) => (
        <line
          key={index}
          x1={link.x1}
          y1={link.y1}
          x2={link.x2}
          y2={link.y2}
          stroke="currentColor"
          strokeWidth={0.8}
          strokeOpacity={0.9}
        />
      ))}
    </svg>
  )
}

export function DatasetPolygonViz({ graph }: DatasetMiniVizProps) {
  const pathData = React.useMemo(() => {
    const g = graph
    if (!g || !Array.isArray(g.nodes) || !Array.isArray(g.edges) || g.nodes.length === 0) return null

    const degreeById = new Map<string, number>()
    for (let i = 0; i < g.edges.length; i += 1) {
      const edge = g.edges[i]
      const s = String(edge.source)
      const t = String(edge.target)
      degreeById.set(s, (degreeById.get(s) || 0) + 1)
      degreeById.set(t, (degreeById.get(t) || 0) + 1)
    }

    const points: [number, number][] = []
    const width = 140
    const height = 40
    const cx = width / 2
    const cy = height / 2

    const degrees: number[] = []
    degreeById.forEach(value => {
      if (value > 0 && Number.isFinite(value)) degrees.push(value)
    })
    if (!degrees.length) return null

    const minDegree = degrees.reduce((acc, v) => (v < acc ? v : acc), degrees[0])
    const maxDegree = degrees.reduce((acc, v) => (v > acc ? v : acc), degrees[0])
    const span = maxDegree - minDegree || 1

    const sampleCount = Math.min(24, degrees.length)
    const sorted = degrees.slice().sort((a, b) => a - b)

    for (let i = 0; i < sampleCount; i += 1) {
      const value = sorted[Math.floor((i / sampleCount) * sorted.length)]
      const normalized = clampNumber((value - minDegree) / span, 0, 1)
      const angle = (2 * Math.PI * i) / sampleCount
      const r = 6 + normalized * 14
      const x = cx + r * Math.cos(angle)
      const y = cy + r * Math.sin(angle)
      points.push([x, y])
    }

    if (!points.length) return null

    const hull = d3.polygonHull(points) ?? points
    if (!hull.length) return null

    const path = d3.path()
    path.moveTo(hull[0][0], hull[0][1])
    for (let i = 1; i < hull.length; i += 1) {
      path.lineTo(hull[i][0], hull[i][1])
    }
    path.closePath()
    return path.toString()
  }, [graph])

  if (!pathData) return null

  return (
    <svg
      width={140}
      height={40}
      viewBox="0 0 140 40"
      aria-hidden="true"
      className="text-gray-400"
    >
      <path d={pathData} fill="none" stroke="currentColor" strokeWidth={1} />
    </svg>
  )
}

export function DatasetPathViz({ graph }: DatasetMiniVizProps) {
  const pathData = React.useMemo(() => {
    const g = graph
    if (!g || !Array.isArray(g.edges) || g.edges.length === 0) return null

    const countsByLength = new Map<number, number>()
    for (let i = 0; i < g.edges.length; i += 1) {
      const edge = g.edges[i]
      const source = String(edge.source)
      const target = String(edge.target)
      const length = clampNumber(Math.abs(source.length - target.length), 0, 24)
      countsByLength.set(length, (countsByLength.get(length) || 0) + 1)
    }

    const entries = Array.from(countsByLength.entries())
    if (!entries.length) return null
    entries.sort((a, b) => a[0] - b[0])

    const maxCount = entries.reduce((acc, [, v]) => (v > acc ? v : acc), 0)
    if (!Number.isFinite(maxCount) || maxCount <= 0) return null

    const width = 140
    const height = 40
    const path = d3.path()

    for (let i = 0; i < entries.length; i += 1) {
      const [, count] = entries[i]
      const x = (width * i) / Math.max(1, entries.length - 1)
      const normalized = clampNumber(count / maxCount, 0, 1)
      const y = height - height * normalized
      if (i === 0) {
        path.moveTo(x, y)
      } else {
        path.lineTo(x, y)
      }
    }

    return path.toString()
  }, [graph])

  if (!pathData) return null

  return (
    <svg
      width={140}
      height={40}
      viewBox="0 0 140 40"
      aria-hidden="true"
      className="text-gray-400"
    >
      <path d={pathData} fill="none" stroke="currentColor" strokeWidth={1} />
    </svg>
  )
}
