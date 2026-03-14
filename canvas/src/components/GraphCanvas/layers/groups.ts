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
import { computeGroupDepthStyle } from '@/lib/graph/groupDepthStyle'
import { readLayoutMode } from '@/components/GraphCanvas/layout/fitConfig'
import { DEFAULT_GROUP_NESTED_PADDING_STEP } from '@/lib/graph/layoutDefaults'
import { readLabelPresentation2d } from '@/lib/canvas/labelPresentation2d'
import { compareGroupsForZOrder } from '@/lib/canvas/groupZOrder'

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
  documentSemanticMode?: 'document' | 'keyword'
  groupsOverride?: GraphGroup[]
  simulation: d3.Simulation<GraphNode, GraphEdge> | null
  updateNode?: (id: string, updates: Partial<GraphNode>) => void
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

  const isMermaidLayout = (() => {
    const gd = graphData as unknown as { context?: unknown; metadata?: unknown } | null
    if (!gd) return false
    if (String(gd.context || '') === 'frontmatter-mermaid') return true
    const meta = gd.metadata
    if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return false
    return String((meta as Record<string, unknown>).layoutEngine || '') === 'mermaid'
  })()

  const groups =
    args.groupsOverride ||
    deriveGraphGroups(graphData, { forceDocumentStructure: args.documentSemanticMode === 'document' })
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

  const visibleGroups = groups
    .filter(d => d.memberNodeIds.some(id => nodeById.has(String(id))))
    .slice()
    .sort(compareGroupsForZOrder)
  if (visibleGroups.length === 0) return { update: () => {} }

  const shapesLayer = g.append('g').attr('data-kg-layer', 'groups')
  const labelsLayer = g.append('g').attr('data-kg-layer', 'group-labels')

  const itemSel = shapesLayer
    .selectAll<SVGGElement, GroupDatum>('g')
    .data(visibleGroups, d => d.id)
    .join('g')
    .attr('data-kg-group-id', d => d.id)
    .style('pointer-events', 'all')
    .style('cursor', 'grab')

  const resizeHandleSel = (() => {
    if (shape !== 'rect') return null
    return itemSel
      .append('circle')
      .attr('data-kg-group-resize', 'br')
      .attr('r', 6)
      .attr('fill', 'transparent')
      .attr('stroke', UI_THEME_COLORS_CSS.textSecondary)
      .attr('stroke-width', 1.25)
      .style('pointer-events', 'all')
      .style('cursor', 'nwse-resize') as unknown as d3.Selection<SVGCircleElement, GroupDatum, SVGGElement, unknown>
  })()

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
  const nestedPaddingStep = typeof cfg.nestedPaddingStep === 'number' && Number.isFinite(cfg.nestedPaddingStep)
    ? Math.max(0, cfg.nestedPaddingStep)
    : DEFAULT_GROUP_NESTED_PADDING_STEP
  const labelPadding =
    typeof cfg.labelPadding === 'number' && Number.isFinite(cfg.labelPadding) ? Math.max(0, cfg.labelPadding) : 10
  const strokeWidth =
    typeof cfg.strokeWidth === 'number' && Number.isFinite(cfg.strokeWidth) ? Math.max(0, cfg.strokeWidth) : 1.5
  const fillOpacity =
    typeof cfg.fillOpacity === 'number' && Number.isFinite(cfg.fillOpacity) ? Math.max(0, Math.min(1, cfg.fillOpacity)) : 0.08
  const labelPresentation = readLabelPresentation2d({ schema, documentSemanticMode: args.documentSemanticMode })
  const baseFontSize = labelPresentation.groupFontSizePx
  const themeEdgeStroke = UI_THEME_COLORS_CSS.edgeStroke

  let maxDepth = 0
  for (let i = 0; i < groups.length; i += 1) {
    const d = groups[i]
    const depth = typeof d.depth === 'number' && Number.isFinite(d.depth) ? Math.max(0, Math.floor(d.depth)) : 0
    maxDepth = Math.max(maxDepth, depth)
  }
  const depthCfg = cfg.depthStyle || null

  rectSel
    .attr('stroke-width', d => {
      const depth = typeof d.depth === 'number' && Number.isFinite(d.depth) ? Math.max(0, Math.floor(d.depth)) : 0
      const derived = computeGroupDepthStyle({ depth, maxDepth, baseStrokeWidthPx: strokeWidth, baseFillOpacity: fillOpacity, config: depthCfg })
      return d.style.strokeWidth ?? derived.strokeWidthPx
    })
    .attr('stroke', d => d.style.stroke ?? themeEdgeStroke)
    .attr('fill', d => d.style.fill ?? themeEdgeStroke)
    .attr('fill-opacity', d => {
      const depth = typeof d.depth === 'number' && Number.isFinite(d.depth) ? Math.max(0, Math.floor(d.depth)) : 0
      const derived = computeGroupDepthStyle({ depth, maxDepth, baseStrokeWidthPx: strokeWidth, baseFillOpacity: fillOpacity, config: depthCfg })
      return derived.fillOpacity
    })

  geoSel
    .attr('stroke-width', d => {
      const depth = typeof d.depth === 'number' && Number.isFinite(d.depth) ? Math.max(0, Math.floor(d.depth)) : 0
      const derived = computeGroupDepthStyle({ depth, maxDepth, baseStrokeWidthPx: strokeWidth, baseFillOpacity: fillOpacity, config: depthCfg })
      return d.style.strokeWidth ?? derived.strokeWidthPx
    })
    .attr('stroke', d => d.style.stroke ?? themeEdgeStroke)
    .attr('fill', d => d.style.fill ?? themeEdgeStroke)
    .attr('fill-opacity', d => {
      const depth = typeof d.depth === 'number' && Number.isFinite(d.depth) ? Math.max(0, Math.floor(d.depth)) : 0
      const derived = computeGroupDepthStyle({ depth, maxDepth, baseStrokeWidthPx: strokeWidth, baseFillOpacity: fillOpacity, config: depthCfg })
      return derived.fillOpacity
    })

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
    .data(visibleGroups, d => d.id)
    .join('text')
    .attr('data-kg-group-label', '1')
    .attr('data-kg-group-id', d => d.id)
    .each(function (d) {
      const el = this as unknown as SVGTextElement
      const t = computeGroupLabelText(d)
      el.setAttribute('data-label-full', t.full.length > 600 ? `${t.full.slice(0, 599)}…` : t.full)
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
    .data(visibleGroups, d => d.id)
    .join('path')
    .attr('data-kg-group-chevron', '1')
    .attr('data-kg-group-id', d => d.id)
    .attr('fill', 'none')
    .attr('stroke', labelPresentation.color || UI_THEME_COLORS_CSS.labelFill)
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
  const updateGroupHover = (event: MouseEvent, d: GroupDatum) => {
    if (!hoverEnabled || typeof setHoverInfo !== 'function') return
    setHoverInfo(() => ({ kind: 'group', id: String(d.id), clientX: event.clientX, clientY: event.clientY }))
  }
  const clearGroupHover = (event: MouseEvent, d: GroupDatum) => {
    if (!hoverEnabled || typeof setHoverInfo !== 'function') return
    const rt = (event as unknown as { relatedTarget?: unknown }).relatedTarget
    if (isTooltipRelatedTarget(rt)) return
    const id = String(d.id)
    setHoverInfo(prev => (prev && prev.kind === 'group' && prev.id === id ? null : prev))
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
    .on('mouseover', updateGroupHover)
    .on('mousemove', updateGroupHover)
    .on('mouseout', clearGroupHover)
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

  itemSel
    .on('mouseover', updateGroupHover)
    .on('mousemove', updateGroupHover)
    .on('mouseout', clearGroupHover)
    .on('click', (event: MouseEvent, d: GroupDatum) => {
      if ((event as unknown as { defaultPrevented?: unknown }).defaultPrevented) return
      event.stopPropagation()
      clearClickTimer(d.id)
      const handle = window.setTimeout(() => {
        setSelectionSource('canvas')
        selectGroup(d.id)
      }, 200)
      clickTimerById.set(d.id, handle)
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

  const allowDrag = (() => {
    const behavior = schema.behavior as unknown as { allowGroupDrag?: unknown }
    if (behavior && behavior.allowGroupDrag === false) return false
    const cfgDrag = cfg as unknown as { draggable?: unknown }
    if (cfgDrag && cfgDrag.draggable === false) return false
    return true
  })()
  if (allowDrag) {
    let dragNodes: GraphNode[] = []
    let frozen = false
    let dragBoundsOnly = false
    let dragBoundsRef: { x: number; y: number; width: number; height: number; labelX?: number; labelY?: number } | null = null
    let dragZoomK = 1
    const dragBehavior = d3
      .drag<SVGTextElement, GroupDatum>()
      .on('start', (event, d) => {
        const srcEv = (event as unknown as { sourceEvent?: { stopPropagation?: () => void } }).sourceEvent
        if (srcEv && typeof srcEv.stopPropagation === 'function') srcEv.stopPropagation()
        setSelectionSource('canvas')
        selectGroup(d.id)

        const svgEl = (event?.sourceEvent?.target as SVGElement | null)?.ownerSVGElement
        frozen = svgEl?.getAttribute('data-kg-layout-frozen') === '1'
        try {
          const k = d3.zoomTransform(svgEl as unknown as SVGSVGElement).k
          dragZoomK = typeof k === 'number' && Number.isFinite(k) && k > 0 ? k : 1
        } catch {
          dragZoomK = 1
        }

        dragBoundsOnly = false
        dragBoundsRef = null

        const se = event?.sourceEvent as unknown as { altKey?: unknown; shiftKey?: unknown } | undefined
        const altDown = !!(se && (se as any).altKey)
        const shiftDown = !!(se && (se as any).shiftKey)
        if (altDown && typeof args.updateNode === 'function') {
          const id = String(d.id || '').trim()
          const depth = typeof d.depth === 'number' && Number.isFinite(d.depth) ? Math.max(0, Math.floor(d.depth)) : 0
          const zRaw = (d as unknown as { zIndex?: unknown }).zIndex
          const curZ = typeof zRaw === 'number' && Number.isFinite(zRaw) ? Math.floor(zRaw) : 0
          let minZ = curZ
          let maxZ = curZ
          for (let i = 0; i < visibleGroups.length; i += 1) {
            const gg = visibleGroups[i]!
            const dd = typeof gg.depth === 'number' && Number.isFinite(gg.depth) ? Math.max(0, Math.floor(gg.depth)) : 0
            if (dd !== depth) continue
            const zr = (gg as unknown as { zIndex?: unknown }).zIndex
            const z = typeof zr === 'number' && Number.isFinite(zr) ? Math.floor(zr) : 0
            minZ = Math.min(minZ, z)
            maxZ = Math.max(maxZ, z)
          }
          const nextZ = shiftDown ? minZ - 1 : maxZ + 1
          const subgraphNode = (graphData.nodes || []).find(n => String(n.id) === id) || null
          if (subgraphNode) {
            const props = ((subgraphNode as unknown as { properties?: unknown })?.properties || {}) as Record<string, unknown>
            const nextProps = { ...props, 'visual:zIndexOverride': nextZ }
            try {
              args.updateNode(id, { properties: nextProps as never })
            } catch {
              void 0
            }
          }
          return
        }

        const explicit = (d as unknown as { bounds?: unknown }).bounds
        if (isMermaidLayout && explicit && typeof explicit === 'object' && !Array.isArray(explicit)) {
          const bx = typeof (explicit as any).x === 'number' ? (explicit as any).x : Number.NaN
          const by = typeof (explicit as any).y === 'number' ? (explicit as any).y : Number.NaN
          const bw = typeof (explicit as any).width === 'number' ? (explicit as any).width : Number.NaN
          const bh = typeof (explicit as any).height === 'number' ? (explicit as any).height : Number.NaN
          if (Number.isFinite(bx) && Number.isFinite(by) && Number.isFinite(bw) && Number.isFinite(bh) && bw > 0 && bh > 0) {
            dragBoundsOnly = true
            dragBoundsRef = { ...(explicit as any) }
            ;(d as unknown as { bounds?: unknown }).bounds = dragBoundsRef as any
            return
          }
        }

        dragNodes = []
        for (let i = 0; i < d.memberNodeIds.length; i += 1) {
          const n = nodeById.get(String(d.memberNodeIds[i]))
          if (n) dragNodes.push(n)
        }
        const structured = readLayoutMode(schema) === 'radial'
        if (simulation && !structured && !frozen && !event.active) {
          simulation.alphaTarget(0.08).restart()
        }
        for (let i = 0; i < dragNodes.length; i += 1) {
          const n = dragNodes[i]!
          n.fx = n.x ?? 0
          n.fy = n.y ?? 0
        }
      })
      .on('drag', (event) => {
        const dx0 = typeof event.dx === 'number' && Number.isFinite(event.dx) ? event.dx : 0
        const dy0 = typeof event.dy === 'number' && Number.isFinite(event.dy) ? event.dy : 0
        const k = typeof dragZoomK === 'number' && Number.isFinite(dragZoomK) && dragZoomK > 0 ? dragZoomK : 1
        const dx = dx0 / k
        const dy = dy0 / k
        if (dx === 0 && dy === 0) return
        if (dragBoundsOnly && dragBoundsRef) {
          dragBoundsRef.x += dx
          dragBoundsRef.y += dy
          if (typeof dragBoundsRef.labelX === 'number' && Number.isFinite(dragBoundsRef.labelX)) dragBoundsRef.labelX += dx
          if (typeof dragBoundsRef.labelY === 'number' && Number.isFinite(dragBoundsRef.labelY)) dragBoundsRef.labelY += dy
          const d = event.subject as unknown as GroupDatum
          const computed = computeBoundsAndLabel(d)
          applyComputedToGroup(d, computed)
          return
        }
        const structured = readLayoutMode(schema) === 'radial'
        for (let i = 0; i < dragNodes.length; i += 1) {
          const n = dragNodes[i]!
          const x = typeof n.x === 'number' && Number.isFinite(n.x) ? n.x : 0
          const y = typeof n.y === 'number' && Number.isFinite(n.y) ? n.y : 0
          const nx = x + dx
          const ny = y + dy
          n.fx = nx
          n.fy = ny
          if (structured || frozen) {
            n.x = nx
            n.y = ny
          }
        }
        if ((structured || frozen) && simulation) {
          const tickHandler = simulation.on('tick')
          if (typeof tickHandler === 'function') {
            ;(tickHandler as unknown as () => void)()
          }
        }
      })
      .on('end', (event) => {
        if (dragBoundsOnly && dragBoundsRef && typeof args.updateNode === 'function') {
          const d = event.subject as unknown as GroupDatum
          const id = String(d.id || '').trim()
          if (id) {
            const subgraphNode = (graphData.nodes || []).find(n => String(n.id) === id) || null
            if (subgraphNode) {
              const props = ((subgraphNode as unknown as { properties?: unknown })?.properties || {}) as Record<string, unknown>
              const nextProps = { ...props, 'visual:boundsOverride': { ...dragBoundsRef } }
              try {
                args.updateNode(id, { properties: nextProps as never })
              } catch {
                void 0
              }
            }
          }
          dragBoundsOnly = false
          dragBoundsRef = null
          dragNodes = []
          frozen = false
          return
        }
        const structured = readLayoutMode(schema) === 'radial'
        if (simulation && !structured && !frozen && !event.active) {
          simulation.alphaTarget(0)
        }
        for (let i = 0; i < dragNodes.length; i += 1) {
          const n = dragNodes[i]!
          if (!structured && !frozen) {
            n.fx = null
            n.fy = null
          }
          n.vx = 0
          n.vy = 0
        }
        if (structured && simulation) simulation.stop()
        dragNodes = []
        frozen = false
      })
    
    labelSel.call(dragBehavior as unknown as d3.DragBehavior<SVGTextElement, GroupDatum, unknown>)
    itemSel.call(dragBehavior as unknown as d3.DragBehavior<SVGGElement, GroupDatum, unknown>)
  }

  const layoutCache = new Map<
    string,
    { x: number; y: number; w: number; h: number; labelX: number; labelY: number; chevronCx: number; chevronCy: number; d: string | null }
  >()
  const eps = 0.5

  const computeBoundsAndLabel = (d: GroupDatum) => {
    const explicit = (d as unknown as { bounds?: unknown }).bounds
    if (explicit && typeof explicit === 'object' && !Array.isArray(explicit)) {
      const bx = typeof (explicit as any).x === 'number' ? (explicit as any).x : Number.NaN
      const by = typeof (explicit as any).y === 'number' ? (explicit as any).y : Number.NaN
      const bw = typeof (explicit as any).width === 'number' ? (explicit as any).width : Number.NaN
      const bh = typeof (explicit as any).height === 'number' ? (explicit as any).height : Number.NaN
      if (Number.isFinite(bx) && Number.isFinite(by) && Number.isFinite(bw) && Number.isFinite(bh) && bw > 0 && bh > 0) {
        const labelText = computeGroupLabelText(d)
        const fontSize = labelText.fontSize
        const labelXRaw = typeof (explicit as any).labelX === 'number' ? (explicit as any).labelX : Number.NaN
        const labelYRaw = typeof (explicit as any).labelY === 'number' ? (explicit as any).labelY : Number.NaN
        const labelY = Number.isFinite(labelYRaw) ? labelYRaw : by + labelPadding
        const labelX = Number.isFinite(labelXRaw) ? labelXRaw : bx + labelPadding + chevronSizePx + chevronGapPx
        const chevronCx = labelX - chevronGapPx - chevronSizePx * 0.5
        const chevronCy = labelY + fontSize * 0.55
        return { x: bx, y: by, w: bw, h: bh, labelX, labelY, chevronCx, chevronCy, d: null }
      }
    }

    const depth = typeof d.depth === 'number' && Number.isFinite(d.depth) ? Math.max(0, Math.floor(d.depth)) : 0
    const extraPad = nestedPaddingStep > 0 ? nestedPaddingStep * Math.max(0, maxDepth - depth) : 0
    const effectivePadding = padding + extraPad
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
      const px = halfW + effectivePadding
      const py = halfH + effectivePadding
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
    const topPad = effectivePadding + labelPadding + fontSize * 1.25
    const x = minX - effectivePadding
    const y = minY - topPad
    const w0 = Math.max(1, maxX - minX + effectivePadding * 2)
    const h = Math.max(1, maxY - minY + effectivePadding + topPad)
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

  const applyComputedToGroup = (d: GroupDatum, computed: { x: number; y: number; w: number; h: number; labelX: number; labelY: number; chevronCx: number; chevronCy: number; d: string | null }) => {
    layoutCache.set(d.id, computed)
    const item = itemSel.filter(x => x.id === d.id)
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

    if (resizeHandleSel) {
      const canResize = isMermaidLayout && !!(d as unknown as { bounds?: unknown }).bounds
      resizeHandleSel
        .filter(x => x.id === d.id)
        .attr('cx', computed.x + computed.w)
        .attr('cy', computed.y + computed.h)
        .style('display', canResize ? null : 'none')
    }
  }

  if (resizeHandleSel && typeof args.updateNode === 'function') {
    let active: GroupDatum | null = null
    let start: { x: number; y: number; w: number; h: number; labelX?: number; labelY?: number } | null = null
    let zoomK = 1
    const dragResize = d3
      .drag<SVGCircleElement, GroupDatum>()
      .on('start', (event, d) => {
        const explicit = (d as unknown as { bounds?: unknown }).bounds
        if (!isMermaidLayout || !explicit || typeof explicit !== 'object' || Array.isArray(explicit)) {
          active = null
          start = null
          return
        }
        const bx = typeof (explicit as any).x === 'number' ? (explicit as any).x : Number.NaN
        const by = typeof (explicit as any).y === 'number' ? (explicit as any).y : Number.NaN
        const bw = typeof (explicit as any).width === 'number' ? (explicit as any).width : Number.NaN
        const bh = typeof (explicit as any).height === 'number' ? (explicit as any).height : Number.NaN
        if (!Number.isFinite(bx) || !Number.isFinite(by) || !Number.isFinite(bw) || !Number.isFinite(bh)) {
          active = null
          start = null
          return
        }
        const svgEl = (event?.sourceEvent?.target as SVGElement | null)?.ownerSVGElement
        try {
          const k = d3.zoomTransform(svgEl as unknown as SVGSVGElement).k
          zoomK = typeof k === 'number' && Number.isFinite(k) && k > 0 ? k : 1
        } catch {
          zoomK = 1
        }
        active = d
        start = { x: bx, y: by, w: bw, h: bh, labelX: (explicit as any).labelX, labelY: (explicit as any).labelY }
        ;(d as unknown as { bounds?: unknown }).bounds = { ...(explicit as any) } as any
      })
      .on('drag', (event) => {
        if (!active || !start) return
        const explicit = (active as unknown as { bounds?: unknown }).bounds
        if (!explicit || typeof explicit !== 'object' || Array.isArray(explicit)) return
        const dx0 = typeof event.dx === 'number' && Number.isFinite(event.dx) ? event.dx : 0
        const dy0 = typeof event.dy === 'number' && Number.isFinite(event.dy) ? event.dy : 0
        const k = typeof zoomK === 'number' && Number.isFinite(zoomK) && zoomK > 0 ? zoomK : 1
        const dx = dx0 / k
        const dy = dy0 / k
        if (!dx && !dy) return
        ;(explicit as any).width = Math.max(24, start.w + dx)
        ;(explicit as any).height = Math.max(24, start.h + dy)
        const computed = computeBoundsAndLabel(active)
        applyComputedToGroup(active, computed)
      })
      .on('end', () => {
        if (!active) return
        const id = String(active.id || '').trim()
        const subgraphNode = (graphData.nodes || []).find(n => String(n.id) === id) || null
        if (subgraphNode) {
          const props = ((subgraphNode as unknown as { properties?: unknown })?.properties || {}) as Record<string, unknown>
          const explicit = (active as unknown as { bounds?: unknown }).bounds
          if (explicit && typeof explicit === 'object' && !Array.isArray(explicit)) {
            const nextProps = { ...props, 'visual:boundsOverride': { ...(explicit as any) } }
            try {
              args.updateNode(id, { properties: nextProps as never })
            } catch {
              void 0
            }
          }
        }
        active = null
        start = null
      })

    resizeHandleSel.call(dragResize as unknown as d3.DragBehavior<SVGCircleElement, GroupDatum, unknown>)
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

      if (resizeHandleSel) {
        const canResize = isMermaidLayout && !!(d as unknown as { bounds?: unknown }).bounds
        resizeHandleSel
          .filter(x => x.id === d.id)
          .attr('cx', computed.x + computed.w)
          .attr('cy', computed.y + computed.h)
          .style('display', canResize ? null : 'none')
      }
    })
  }

  update()
  return { update }
}
