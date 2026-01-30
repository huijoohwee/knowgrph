import * as d3 from 'd3'
import type { GraphNode, GraphData, GraphEdge } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import { getNodeAabbHalfExtentsWithLabel } from '@/components/GraphCanvas/layout/overlap'
import { deriveGraphGroups } from '@/components/GraphCanvas/layout/graphGroups'
import type { GraphGroup } from '@/components/GraphCanvas/layout/graphGroupsTypes'
import { buildClosedPathD, computeConvexRing, type Point2d } from '@/lib/geometry/convexRing'
import { getMarkdownBodyFontSizePx, getMarkdownHeadingFontSizePx } from '@/features/markdown/ui/markdownTypography'
import type { HoverInfo } from '@/components/GraphHoverTooltip'
import { estimateLabelCharWidthPx, estimateMaxCharsForWidthPx, truncateTextWithEllipsis, truncateTextWithWordEllipsis } from '@/components/GraphCanvas/layout/utils'
import { isTooltipRelatedTarget } from '@/features/panels/ui/tooltipUtils'
import { isDisplayNode } from '@/components/GraphCanvas/displayFilter'
import { collapsedGroupNodeIdFor } from '@/components/GraphCanvas/viewDerivation'
import { buildChevronPathD } from '@/components/GraphCanvas/layers/svgChevron'
import { UI_THEME_COLORS_CSS } from '@/lib/ui/theme-tokens'
import { readLayoutMode } from '@/components/GraphCanvas/layout/fitConfig'

type GroupDatum = GraphGroup

export type GroupsLayer = {
  update: () => void
}

const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

export const createGroupsLayer = (args: {
  g: d3.Selection<SVGGElement, unknown, null, undefined>
  graphData: GraphData
  edgesForDisplay: GraphEdge[]
  schema: GraphSchema
  simulation: d3.Simulation<GraphNode, GraphEdge> | null
  hoverEnabled?: boolean
  setHoverInfo?: (updater: (prev: HoverInfo | null) => HoverInfo | null) => void
  setSelectionSource: (src: 'menu' | 'canvas' | 'toolbar' | 'editor' | 'unknown') => void
  selectNode: (id: string | null) => void
  selectGroup: (id: string | null) => void
  selectGroupExpanded: (args: { id: string; nodeIds: string[]; edgeIds: string[] }) => void
  toggleGroupCollapsed: (id: string) => void
}): GroupsLayer => {
  const { g, graphData, edgesForDisplay, schema, simulation, hoverEnabled, setHoverInfo, setSelectionSource, selectNode, selectGroup, selectGroupExpanded, toggleGroupCollapsed } = args
  const cfg = schema.layout?.groups || {}
  const enabled = cfg.enabled !== false
  if (!enabled) return { update: () => {} }

  const groups = deriveGraphGroups(graphData)
  if (groups.length === 0) return { update: () => {} }

  const shape: 'rect' | 'geo' = cfg.shape === 'geo' ? 'geo' : 'rect'

  const nodeById = new Map<string, GraphNode>()
  const headingLevelByGroupId = new Map<string, number>()
  for (let i = 0; i < graphData.nodes.length; i += 1) {
    const n = graphData.nodes[i]
    const props = (n.properties || {}) as Record<string, unknown>
    const isHeadingSection = String(n.type || '') === 'Section' && typeof props.level === 'number'
    if (isHeadingSection) {
      headingLevelByGroupId.set(`md:${String(n.id)}`, Math.min(6, Math.max(1, Math.floor(props.level as number))))
      continue
    }
    if (!isDisplayNode(n)) continue
    nodeById.set(String(n.id), n)
  }

  const shapesLayer = g.append('g').attr('data-kg-layer', 'groups')
  const labelsLayer = g.append('g').attr('data-kg-layer', 'group-labels')

  const itemSel = shapesLayer
    .selectAll<SVGGElement, GroupDatum>('g')
    .data(groups, d => d.id)
    .join('g')
    .attr('data-kg-group-id', d => d.id)
    .style('pointer-events', 'none')

  const rectSel = itemSel
    .append('rect')
    .attr('data-kg-shape', 'group-rect')
    .attr('rx', typeof cfg.cornerRadius === 'number' && Number.isFinite(cfg.cornerRadius) ? cfg.cornerRadius : 12)
    .attr('ry', typeof cfg.cornerRadius === 'number' && Number.isFinite(cfg.cornerRadius) ? cfg.cornerRadius : 12)
    .style('display', shape === 'rect' ? null : 'none')

  const geoSel = itemSel
    .append('path')
    .attr('data-kg-shape', 'group-geo')
    .attr('stroke-linejoin', 'round')
    .attr('stroke-linecap', 'round')
    .style('display', shape === 'geo' ? null : 'none')

  const padding = typeof cfg.padding === 'number' && Number.isFinite(cfg.padding) ? Math.max(0, cfg.padding) : 24
  const labelPadding =
    typeof cfg.labelPadding === 'number' && Number.isFinite(cfg.labelPadding) ? Math.max(0, cfg.labelPadding) : 10
  const strokeWidth =
    typeof cfg.strokeWidth === 'number' && Number.isFinite(cfg.strokeWidth) ? Math.max(0, cfg.strokeWidth) : 1.5
  const fillOpacity =
    typeof cfg.fillOpacity === 'number' && Number.isFinite(cfg.fillOpacity) ? Math.max(0, Math.min(1, cfg.fillOpacity)) : 0.08
  const baseFontSize = schema.labelStyles?.fontSize ?? 12
  const themeEdgeStroke = UI_THEME_COLORS_CSS.edgeStroke

  rectSel
    .attr('stroke-width', strokeWidth)
    .attr('stroke', d => d.style.stroke ?? themeEdgeStroke)
    .attr('fill', d => d.style.fill ?? themeEdgeStroke)
    .attr('fill-opacity', fillOpacity)

  geoSel
    .attr('stroke-width', strokeWidth)
    .attr('stroke', d => d.style.stroke ?? themeEdgeStroke)
    .attr('fill', d => d.style.fill ?? themeEdgeStroke)
    .attr('fill-opacity', fillOpacity)

  const getGroupLabelFontSizePx = (d: GroupDatum): number => {
    const mdLevel = headingLevelByGroupId.get(String(d.id))
    if (mdLevel) return getMarkdownHeadingFontSizePx({ depth: mdLevel, presentation: false })
    const depth = typeof d.depth === 'number' && Number.isFinite(d.depth) ? Math.min(6, Math.max(1, Math.floor(d.depth))) : 1
    const derived = Math.min(6, 2 + depth)
    const derivedPx = getMarkdownHeadingFontSizePx({ depth: derived, presentation: false })
    const fallback = getMarkdownBodyFontSizePx({ presentation: false })
    const clamped = Math.max(12, Math.min(24, derivedPx))
    return Math.max(baseFontSize, Math.max(fallback, clamped))
  }

  const computeGroupLabelText = (d: GroupDatum) => {
    const full = String(d.label || '')
    const fontSize = getGroupLabelFontSizePx(d)
    const maxChars = Math.max(8, Math.min(120, estimateMaxCharsForWidthPx(260, fontSize)))
    const wordLimited = truncateTextWithWordEllipsis(full, 24)
    return { full, fontSize, visible: truncateTextWithEllipsis(wordLimited, maxChars) }
  }

  const labelSel = labelsLayer
    .selectAll<SVGTextElement, GroupDatum>('text')
    .data(groups, d => d.id)
    .join('text')
    .attr('data-kg-group-label', '1')
    .attr('data-kg-group-id', d => d.id)
    .each(function (d) {
      const el = this as unknown as SVGTextElement
      const t = computeGroupLabelText(d)
      el.setAttribute('data-label-full', t.full)
      el.textContent = t.visible
    })
    .style('user-select', 'none')
    .style('pointer-events', 'all')
    .style('cursor', 'pointer')
    .attr('text-anchor', 'start')
    .attr('dominant-baseline', 'hanging')
    .style('font-size', d => {
      return `${getGroupLabelFontSizePx(d)}px`
    })

  const collapsedSet = (() => {
    const meta = (graphData.metadata || {}) as Record<string, unknown>
    const view = (meta['kg:view'] || null) as Record<string, unknown> | null
    const ids = view && Array.isArray(view.collapsedGroupIds) ? (view.collapsedGroupIds as unknown[]) : []
    return new Set<string>(ids.map(x => String(x || '').trim()).filter(Boolean))
  })()
  const chevronSizePx = 12
  const chevronGapPx = 6
  const chevronSel = labelsLayer
    .selectAll<SVGPathElement, GroupDatum>('path[data-kg-group-chevron]')
    .data(groups, d => d.id)
    .join('path')
    .attr('data-kg-group-chevron', '1')
    .attr('data-kg-group-id', d => d.id)
    .attr('fill', 'none')
    .attr('stroke', schema.labelStyles?.color ?? UI_THEME_COLORS_CSS.labelFill)
    .attr('stroke-width', 1.75)
    .attr('stroke-linecap', 'round')
    .attr('stroke-linejoin', 'round')
    .style('pointer-events', 'all')
    .style('cursor', 'pointer')

  const clickTimerById = new Map<string, number>()
  const clearClickTimer = (id: string) => {
    const t = clickTimerById.get(id)
    if (t != null) clearTimeout(t)
    clickTimerById.delete(id)
  }

  const memberIdSetOf = (d: GroupDatum) => new Set<string>(d.memberNodeIds.map(x => String(x)))

  const edgeIdsWithinMembers = (memberSet: Set<string>) => {
    const out: string[] = []
    for (let i = 0; i < edgesForDisplay.length; i += 1) {
      const e = edgesForDisplay[i]
      const s = String((typeof e.source === 'object' ? (e.source as { id?: unknown }).id : e.source) || '')
      const t = String((typeof e.target === 'object' ? (e.target as { id?: unknown }).id : e.target) || '')
      if (!s || !t) continue
      if (!memberSet.has(s) || !memberSet.has(t)) continue
      out.push(String(e.id))
    }
    return out
  }

  labelSel
    .on('click', (event: MouseEvent, d: GroupDatum) => {
      event.stopPropagation()
      clearClickTimer(d.id)
      const handle = window.setTimeout(() => {
        setSelectionSource('canvas')
        selectGroup(d.id)
      }, 200)
      clickTimerById.set(d.id, handle)
    })
    .on('mouseover', (event: MouseEvent, d: GroupDatum) => {
      if (!hoverEnabled || typeof setHoverInfo !== 'function') return
      setHoverInfo(() => ({ kind: 'group', id: String(d.id), clientX: event.clientX, clientY: event.clientY }))
    })
    .on('mousemove', (event: MouseEvent, d: GroupDatum) => {
      if (!hoverEnabled || typeof setHoverInfo !== 'function') return
      setHoverInfo(() => ({ kind: 'group', id: String(d.id), clientX: event.clientX, clientY: event.clientY }))
    })
    .on('mouseout', (event: MouseEvent, d: GroupDatum) => {
      if (!hoverEnabled || typeof setHoverInfo !== 'function') return
      const rt = (event as unknown as { relatedTarget?: unknown }).relatedTarget
      if (isTooltipRelatedTarget(rt)) return
      const id = String(d.id)
      setHoverInfo(prev => (prev && prev.kind === 'group' && prev.id === id ? null : prev))
    })
    .on('dblclick', (event: MouseEvent, d: GroupDatum) => {
      event.stopPropagation()
      clearClickTimer(d.id)
      setSelectionSource('canvas')
      const isAlt = (event as unknown as { altKey?: unknown }).altKey === true
      if (isAlt) {
        const members = d.memberNodeIds.map(x => String(x)).filter(Boolean)
        const memberSet = memberIdSetOf(d)
        const edgeIds = edgeIdsWithinMembers(memberSet)
        selectGroupExpanded({ id: d.id, nodeIds: members, edgeIds })
        return
      }
      toggleGroupCollapsed(d.id)
      selectNode(collapsedGroupNodeIdFor(d.id))
    })

  chevronSel.on('click', (event: MouseEvent, d: GroupDatum) => {
    event.stopPropagation()
    clearClickTimer(d.id)
    setSelectionSource('canvas')
    toggleGroupCollapsed(d.id)
    selectNode(collapsedGroupNodeIdFor(d.id))
  })

  const allowDrag = schema.behavior?.allowNodeDrag !== false
  if (allowDrag) {
    let dragNodes: GraphNode[] = []
    const dragBehavior = d3
      .drag<SVGTextElement, GroupDatum>()
      .on('start', (event, d) => {
        const srcEv = (event as unknown as { sourceEvent?: { stopPropagation?: () => void } }).sourceEvent
        if (srcEv && typeof srcEv.stopPropagation === 'function') srcEv.stopPropagation()
        setSelectionSource('canvas')
        selectGroup(d.id)
        dragNodes = []
        for (let i = 0; i < d.memberNodeIds.length; i += 1) {
          const n = nodeById.get(String(d.memberNodeIds[i]))
          if (n) dragNodes.push(n)
        }
        const structured = readLayoutMode(schema) === 'radial'
        if (simulation && !structured && !event.active) {
          simulation.alphaTarget(0.3).restart()
        }
        for (let i = 0; i < dragNodes.length; i += 1) {
          const n = dragNodes[i]!
          n.fx = n.x ?? 0
          n.fy = n.y ?? 0
        }
      })
      .on('drag', (event) => {
        const dx = typeof event.dx === 'number' && Number.isFinite(event.dx) ? event.dx : 0
        const dy = typeof event.dy === 'number' && Number.isFinite(event.dy) ? event.dy : 0
        if (dx === 0 && dy === 0) return
        const structured = readLayoutMode(schema) === 'radial'
        for (let i = 0; i < dragNodes.length; i += 1) {
          const n = dragNodes[i]!
          const x = typeof n.x === 'number' && Number.isFinite(n.x) ? n.x : 0
          const y = typeof n.y === 'number' && Number.isFinite(n.y) ? n.y : 0
          const nx = x + dx
          const ny = y + dy
          n.fx = nx
          n.fy = ny
          if (structured) {
            n.x = nx
            n.y = ny
          }
        }
        if (structured && simulation) {
          const tickHandler = simulation.on('tick')
          if (typeof tickHandler === 'function') {
            ;(tickHandler as unknown as () => void)()
          }
        }
      })
      .on('end', (event) => {
        const structured = readLayoutMode(schema) === 'radial'
        if (simulation && !structured && !event.active) {
          simulation.alphaTarget(0)
        }
        for (let i = 0; i < dragNodes.length; i += 1) {
          const n = dragNodes[i]!
          if (!structured) {
            n.fx = null
            n.fy = null
          }
          n.vx = 0
          n.vy = 0
        }
        if (structured && simulation) simulation.stop()
        dragNodes = []
      })

    labelSel.call(dragBehavior as unknown as d3.DragBehavior<SVGTextElement, GroupDatum, unknown>)
  }

  const layoutCache = new Map<
    string,
    { x: number; y: number; w: number; h: number; labelX: number; labelY: number; chevronCx: number; chevronCy: number; d: string | null }
  >()
  const eps = 0.5

  const computeBoundsAndLabel = (d: GroupDatum) => {
    let minX = Infinity
    let maxX = -Infinity
    let minY = Infinity
    let maxY = -Infinity
    let valid = 0
    const geoPoints: Point2d[] = []
    for (let i = 0; i < d.memberNodeIds.length; i += 1) {
      const id = d.memberNodeIds[i]
      const n = nodeById.get(id)
      if (!n) continue
      if (!isFiniteNumber(n.x) || !isFiniteNumber(n.y)) continue
      const ext = getNodeAabbHalfExtentsWithLabel(n, schema)
      const halfW = ext.halfW
      const halfH = ext.halfH
      const x0 = n.x - halfW
      const x1 = n.x + halfW
      const y0 = n.y - halfH
      const y1 = n.y + halfH
      if (x0 < minX) minX = x0
      if (x1 > maxX) maxX = x1
      if (y0 < minY) minY = y0
      if (y1 > maxY) maxY = y1
      const px = halfW + padding
      const py = halfH + padding
      geoPoints.push({ x: n.x - px, y: n.y - py })
      geoPoints.push({ x: n.x + px, y: n.y - py })
      geoPoints.push({ x: n.x + px, y: n.y + py })
      geoPoints.push({ x: n.x - px, y: n.y + py })
      valid += 1
    }
    if (valid === 0 || minX === Infinity) {
      return { x: 0, y: 0, w: 0, h: 0, labelX: 0, labelY: 0, chevronCx: 0, chevronCy: 0, d: null }
    }
    const labelText = computeGroupLabelText(d)
    const fontSize = labelText.fontSize
    const topPad = padding + labelPadding + fontSize * 1.25
    const x = minX - padding
    const y = minY - topPad
    const w0 = Math.max(1, maxX - minX + padding * 2)
    const h = Math.max(1, maxY - minY + padding + topPad)
    const chevronCx = x + labelPadding + chevronSizePx * 0.5
    const chevronCy = y + labelPadding + fontSize * 0.55
    const labelX = x + labelPadding + chevronSizePx + chevronGapPx
    const labelY = y + labelPadding
    const labelWidth = Math.min(800, Math.max(0, labelText.visible.length) * estimateLabelCharWidthPx(fontSize))
    const w = Math.max(w0, labelX - x + labelWidth + labelPadding)

    if (shape === 'geo') {
      const ring = computeConvexRing(geoPoints)
      const dPath = buildClosedPathD(ring)
      return { x, y, w, h, labelX, labelY, chevronCx, chevronCy, d: dPath }
    }
    return { x, y, w, h, labelX, labelY, chevronCx, chevronCy, d: null }
  }

  const update = () => {
    itemSel.each(function (d) {
      const computed = computeBoundsAndLabel(d)
      const prev = layoutCache.get(d.id) || null
      if (
        prev &&
        Math.abs(prev.x - computed.x) < eps &&
        Math.abs(prev.y - computed.y) < eps &&
        Math.abs(prev.w - computed.w) < eps &&
        Math.abs(prev.h - computed.h) < eps &&
        Math.abs(prev.labelX - computed.labelX) < eps &&
        Math.abs(prev.labelY - computed.labelY) < eps &&
        Math.abs(prev.chevronCx - computed.chevronCx) < eps &&
        Math.abs(prev.chevronCy - computed.chevronCy) < eps &&
        prev.d === computed.d
      ) {
        return
      }
      layoutCache.set(d.id, computed)

      const item = d3.select(this)
      if (shape === 'rect') {
        item
          .select<SVGRectElement>('rect[data-kg-shape="group-rect"]')
          .attr('x', computed.x)
          .attr('y', computed.y)
          .attr('width', computed.w)
          .attr('height', computed.h)
      } else {
        item.select<SVGPathElement>('path[data-kg-shape="group-geo"]').attr('d', computed.d || '')
      }
      labelSel
        .filter(x => x.id === d.id)
        .attr('x', computed.labelX)
        .attr('y', computed.labelY)
      const dir = collapsedSet.has(String(d.id)) ? 'right' : 'down'
      chevronSel
        .filter(x => x.id === d.id)
        .attr('d', buildChevronPathD({ cx: computed.chevronCx, cy: computed.chevronCy, size: chevronSizePx, direction: dir }))
    })
  }

  update()
  return { update }
}
