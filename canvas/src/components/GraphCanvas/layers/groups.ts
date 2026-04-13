import * as d3 from 'd3'
import type { GraphNode, GraphData, GraphEdge } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import { getNodeAabbHalfExtentsWithLabel } from '@/components/GraphCanvas/layout/overlap'
import { deriveGraphGroups } from '@/components/GraphCanvas/layout/graphGroups'
import type { GraphGroup } from '@/components/GraphCanvas/layout/graphGroupsTypes'
import { getMarkdownBodyFontSizePx, getMarkdownHeadingFontSizePx } from '@/features/markdown/ui/markdownTypography'
import type { HoverInfo } from '@/components/GraphHoverTooltip'
import { estimateLabelCharWidthPx, estimateMaxCharsForWidthPx, truncateTextWithEllipsis, truncateTextWithWordEllipsis } from '@/components/GraphCanvas/layout/utils'
import { isTooltipRelatedTarget } from '@/features/panels/ui/tooltipUtils'
import { isDisplayNode } from '@/components/GraphCanvas/displayFilter'
import { collapsedGroupNodeIdFor } from '@/components/GraphCanvas/viewDerivation'
import { UI_THEME_COLORS_CSS } from '@/lib/ui/theme-tokens'
import { computeGroupDepthStyle } from '@/lib/graph/groupDepthStyle'
import { readLayoutMode } from '@/components/GraphCanvas/layout/fitConfig'
import { DEFAULT_DRAG_ALPHA_TARGET, DEFAULT_DRAG_ALPHA_TARGET_HARD_CAP } from '@/lib/graph/layoutDefaults'
import { beginDragForceTuning } from '@/components/GraphCanvas/dragForceTuning'
import { markGraphCanvasUserInteracted } from '@/components/GraphCanvas/userInteractionFlag'
import { useGraphStore } from '@/hooks/useGraphStore'
import { DEFAULT_GROUP_NESTED_PADDING_STEP } from '@/lib/graph/layoutDefaults'
import { readLabelPresentation2d } from '@/lib/canvas/labelPresentation2d'
import { compareGroupsForZOrder } from '@/lib/canvas/groupZOrder'
import { readSchemaGroupBoundsOverrides } from '../../../lib/canvas/groupBoundsOverrides'
import { commitGroupBoundsOverrideToStore } from '../../../lib/canvas/groupBoundsOverridesStore'
import { readAllowGroupResize } from '../../../lib/canvas/groupResizePolicy'
import { readGroupResizeHandleConfig } from '@/lib/canvas/groupResizeHandleConfig'
import { createGroupsLayoutEngine } from '@/components/GraphCanvas/layers/groupsLayout'
import { bindGroupsResizeHandle } from '@/components/GraphCanvas/layers/groupsResizeHandle'
import { readSnapGridConfigFromSchema } from '@/lib/canvas/gridSnap'
import { filterGroupsByCollapsedAncestors } from '@/lib/graph/groupVisibility'
import { readCanvasDragIntentThresholdPx } from '@/lib/canvas/dragIntent'
type GroupDatum = GraphGroup
export type GroupsLayer = {
  update: () => void
}
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

  const groups =
    args.groupsOverride ||
    deriveGraphGroups(graphData, { forceDocumentStructure: args.documentSemanticMode === 'document' })
  if (groups.length === 0) return { update: () => {} }

  const allowResize = readAllowGroupResize(schema)
  const boundsOverridesById = readSchemaGroupBoundsOverrides(schema)

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

  const nodeHalfExtentsById = new Map<string, { halfW: number; halfH: number }>()
  for (const [id, n] of nodeById.entries()) {
    const ext = getNodeAabbHalfExtentsWithLabel(n, schema)
    nodeHalfExtentsById.set(id, ext)
  }

  const collapsedSet = (() => {
    const meta = (graphData.metadata || {}) as Record<string, unknown>
    const view = (meta['kg:view'] || null) as Record<string, unknown> | null
    const ids = view && Array.isArray(view.collapsedGroupIds) ? (view.collapsedGroupIds as unknown[]) : []
    return new Set<string>(ids.map(x => String(x || '').trim()).filter(Boolean))
  })()

  const visibleGroups = filterGroupsByCollapsedAncestors({
    groups: groups
    .filter(d => d.memberNodeIds.some(id => nodeById.has(String(id))))
    .map(g => {
      const id = String(g.id || '').trim()
      if (!id) return g
      if (g.bounds) return g
      const b = boundsOverridesById[id]
      return b ? ({ ...g, bounds: b } as GraphGroup) : g
    })
    .slice()
    .sort(compareGroupsForZOrder),
    collapsedGroupIdSet: collapsedSet,
  })
  if (visibleGroups.length === 0) return { update: () => {} }

  const shapesLayer = g.append('g').attr('data-kg-layer', 'groups').style('pointer-events', 'none')
  const hitLayer = g.append('g').attr('data-kg-layer', 'groups-hit')
  const labelsLayer = g.append('g').attr('data-kg-layer', 'group-labels')
  const resizeHandlesLayer = g.append('g').attr('data-kg-layer', 'group-resize-handles')

  const itemSel = shapesLayer
    .selectAll<SVGGElement, GroupDatum>('g')
    .data(visibleGroups, d => d.id)
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

  const hitStrokeWidthPx = 18
  const hitRectSel = hitLayer
    .selectAll<SVGRectElement, GroupDatum>('rect[data-kg-group-hit-rect]')
    .data(visibleGroups, d => d.id)
    .join('rect')
    .attr('data-kg-group-hit-rect', '1')
    .attr('data-kg-group-id', d => d.id)
    .attr('rx', typeof cfg.cornerRadius === 'number' && Number.isFinite(cfg.cornerRadius) ? cfg.cornerRadius : 12)
    .attr('ry', typeof cfg.cornerRadius === 'number' && Number.isFinite(cfg.cornerRadius) ? cfg.cornerRadius : 12)
    .attr('fill', 'none')
    .attr('stroke', 'transparent')
    .attr('stroke-width', hitStrokeWidthPx)
    .style('display', shape === 'rect' ? null : 'none')
    .style('pointer-events', 'stroke')
    .style('cursor', 'grab')

  const hitGeoSel = hitLayer
    .selectAll<SVGPathElement, GroupDatum>('path[data-kg-group-hit-geo]')
    .data(visibleGroups, d => d.id)
    .join('path')
    .attr('data-kg-group-hit-geo', '1')
    .attr('data-kg-group-id', d => d.id)
    .attr('fill', 'none')
    .attr('stroke', 'transparent')
    .attr('stroke-width', hitStrokeWidthPx)
    .attr('stroke-linejoin', 'round')
    .attr('stroke-linecap', 'round')
    .style('display', shape === 'geo' ? null : 'none')
    .style('pointer-events', 'stroke')
    .style('cursor', 'grab')

  const resizeHandleGroupSel = (() => {
    if (shape !== 'rect') return null
    const sel = resizeHandlesLayer
      .selectAll<SVGGElement, GroupDatum>('g[data-kg-group-resize="br"]')
      .data(visibleGroups, d => d.id)
      .join('g')
      .attr('data-kg-group-resize', 'br')
      .attr('data-kg-group-id', d => d.id)
      .style('pointer-events', 'all')
      .style('cursor', 'nwse-resize') as unknown as d3.Selection<SVGGElement, GroupDatum, SVGGElement, unknown>

    const cfg = readGroupResizeHandleConfig(schema)
    sel
      .selectAll<SVGCircleElement, GroupDatum>('circle[data-kg-group-resize-hit]')
      .data(d => [d])
      .join('circle')
      .attr('data-kg-group-resize-hit', '1')
      .attr('r', cfg.hitRadiusPx)
      .attr('fill', 'transparent')
      .attr('stroke', 'transparent')
      .style('pointer-events', 'all')

    sel
      .selectAll<SVGCircleElement, GroupDatum>('circle[data-kg-group-resize-dot]')
      .data(d => [d])
      .join('circle')
      .attr('data-kg-group-resize-dot', '1')
      .attr('r', cfg.dotRadiusPx)
      .attr('fill', UI_THEME_COLORS_CSS.bg)
      .attr('fill-opacity', 0.72)
      .attr('stroke', UI_THEME_COLORS_CSS.textSecondary)
      .attr('stroke-width', cfg.strokeWidthPx)
      .style('pointer-events', 'none')

    return sel
  })()
  const resizeHandleCfg = readGroupResizeHandleConfig(schema)

  const resizeHandleHitSel = resizeHandleGroupSel
    ? (resizeHandleGroupSel.select<SVGCircleElement>('circle[data-kg-group-resize-hit="1"]') as unknown as d3.Selection<
        SVGCircleElement,
        GroupDatum,
        SVGGElement,
        unknown
      >)
    : null

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
  const isBipartiteGraph = (() => {
    const meta = graphData.metadata
    if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return false
    return String((meta as Record<string, unknown>).graphKind || '') === 'bipartite'
  })()
  const bipartiteFillOpacityFloor = isBipartiteGraph ? 0.22 : 0
  const bipartiteStrokeFloor = isBipartiteGraph ? 2.4 : 0
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
      return Math.max(d.style.strokeWidth ?? derived.strokeWidthPx, bipartiteStrokeFloor)
    })
    .attr('data-kg-base-stroke-width', d => {
      const depth = typeof d.depth === 'number' && Number.isFinite(d.depth) ? Math.max(0, Math.floor(d.depth)) : 0
      const derived = computeGroupDepthStyle({ depth, maxDepth, baseStrokeWidthPx: strokeWidth, baseFillOpacity: fillOpacity, config: depthCfg })
      return Math.max(d.style.strokeWidth ?? derived.strokeWidthPx, bipartiteStrokeFloor)
    })
    .attr('stroke', d => d.style.stroke ?? themeEdgeStroke)
    .attr('fill', d => d.style.fill ?? themeEdgeStroke)
    .attr('fill-opacity', d => {
      const depth = typeof d.depth === 'number' && Number.isFinite(d.depth) ? Math.max(0, Math.floor(d.depth)) : 0
      const derived = computeGroupDepthStyle({ depth, maxDepth, baseStrokeWidthPx: strokeWidth, baseFillOpacity: fillOpacity, config: depthCfg })
      return Math.max(derived.fillOpacity, bipartiteFillOpacityFloor)
    })
    .attr('data-kg-base-fill-opacity', d => {
      const depth = typeof d.depth === 'number' && Number.isFinite(d.depth) ? Math.max(0, Math.floor(d.depth)) : 0
      const derived = computeGroupDepthStyle({ depth, maxDepth, baseStrokeWidthPx: strokeWidth, baseFillOpacity: fillOpacity, config: depthCfg })
      return Math.max(derived.fillOpacity, bipartiteFillOpacityFloor)
    })

  geoSel
    .attr('stroke-width', d => {
      const depth = typeof d.depth === 'number' && Number.isFinite(d.depth) ? Math.max(0, Math.floor(d.depth)) : 0
      const derived = computeGroupDepthStyle({ depth, maxDepth, baseStrokeWidthPx: strokeWidth, baseFillOpacity: fillOpacity, config: depthCfg })
      return Math.max(d.style.strokeWidth ?? derived.strokeWidthPx, bipartiteStrokeFloor)
    })
    .attr('data-kg-base-stroke-width', d => {
      const depth = typeof d.depth === 'number' && Number.isFinite(d.depth) ? Math.max(0, Math.floor(d.depth)) : 0
      const derived = computeGroupDepthStyle({ depth, maxDepth, baseStrokeWidthPx: strokeWidth, baseFillOpacity: fillOpacity, config: depthCfg })
      return Math.max(d.style.strokeWidth ?? derived.strokeWidthPx, bipartiteStrokeFloor)
    })
    .attr('stroke', d => d.style.stroke ?? themeEdgeStroke)
    .attr('fill', d => d.style.fill ?? themeEdgeStroke)
    .attr('fill-opacity', d => {
      const depth = typeof d.depth === 'number' && Number.isFinite(d.depth) ? Math.max(0, Math.floor(d.depth)) : 0
      const derived = computeGroupDepthStyle({ depth, maxDepth, baseStrokeWidthPx: strokeWidth, baseFillOpacity: fillOpacity, config: depthCfg })
      return Math.max(derived.fillOpacity, bipartiteFillOpacityFloor)
    })
    .attr('data-kg-base-fill-opacity', d => {
      const depth = typeof d.depth === 'number' && Number.isFinite(d.depth) ? Math.max(0, Math.floor(d.depth)) : 0
      const derived = computeGroupDepthStyle({ depth, maxDepth, baseStrokeWidthPx: strokeWidth, baseFillOpacity: fillOpacity, config: depthCfg })
      return Math.max(derived.fillOpacity, bipartiteFillOpacityFloor)
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

  const groupLabelTextById = new Map<string, { full: string; fontSize: number; visible: string; labelWidthPx: number }>()
  const getGroupLabelText = (d: GroupDatum) => {
    const id = String(d.id || '').trim()
    const cached = id ? groupLabelTextById.get(id) : null
    if (cached) return cached
    const full = String(d.label || '')
    const fontSize = getGroupLabelFontSizePx(d)
    const maxChars = Math.max(8, Math.min(120, estimateMaxCharsForWidthPx(260, fontSize)))
    const wordLimited = truncateTextWithWordEllipsis(full, 24)
    const visible = truncateTextWithEllipsis(wordLimited, maxChars)
    const labelWidthPx = Math.min(800, Math.max(0, visible.length) * estimateLabelCharWidthPx(fontSize))
    const next = { full, fontSize, visible, labelWidthPx }
    if (id) groupLabelTextById.set(id, next)
    return next
  }

  const labelSel = labelsLayer
    .selectAll<SVGTextElement, GroupDatum>('text')
    .data(visibleGroups, d => d.id)
    .join('text')
    .attr('data-kg-group-label', '1')
    .attr('data-kg-group-id', d => d.id)
    .each(function (d) {
      const el = this as unknown as SVGTextElement
      const t = getGroupLabelText(d)
      el.setAttribute('data-label-full', t.full.length > 600 ? `${t.full.slice(0, 599)}…` : t.full)
      el.textContent = t.visible
    })
    .style('user-select', 'none')
    .style('pointer-events', 'all')
    .style('cursor', 'pointer')
    .attr('text-anchor', 'start')
    .attr('dominant-baseline', 'hanging')
    .style('font-size', d => {
      return `${getGroupLabelText(d).fontSize}px`
    })

  const chevronSizePx = 12
  const chevronHitRadiusPx = 14
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
  const chevronHitSel = labelsLayer
    .selectAll<SVGCircleElement, GroupDatum>('circle[data-kg-group-chevron-hit]')
    .data(visibleGroups, d => d.id)
    .join('circle')
    .attr('data-kg-group-chevron-hit', '1')
    .attr('data-kg-group-id', d => d.id)
    .attr('fill', 'transparent')
    .attr('stroke', 'none')
    .style('pointer-events', 'all')
    .style('cursor', 'pointer')

  const clickTimerById = new Map<string, number>()
  const clearClickTimer = (id: string) => {
    const t = clickTimerById.get(id)
    if (t != null) clearTimeout(t)
    clickTimerById.delete(id)
  }
  const toggleOrExpandGroup = (event: MouseEvent, d: GroupDatum) => {
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
  }
  const queueGroupSelectOrToggle = (event: MouseEvent, d: GroupDatum) => {
    if ((event as unknown as { defaultPrevented?: unknown }).defaultPrevented) return
    event.stopPropagation()
    clearClickTimer(d.id)
    if (((event as unknown as { detail?: unknown }).detail || 0) >= 2) {
      toggleOrExpandGroup(event, d)
      return
    }
    const handle = window.setTimeout(() => {
      setSelectionSource('canvas')
      selectGroup(d.id)
    }, 200)
    clickTimerById.set(d.id, handle)
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
    .on('click', queueGroupSelectOrToggle)
    .on('mouseover', updateGroupHover)
    .on('mousemove', updateGroupHover)
    .on('mouseout', clearGroupHover)
    .on('dblclick', toggleOrExpandGroup)

  const bindHitInteractions = <E extends SVGElement>(sel: d3.Selection<E, GroupDatum, SVGGElement, unknown>) => {
    sel
      .on('mouseover', updateGroupHover)
      .on('mousemove', updateGroupHover)
      .on('mouseout', clearGroupHover)
      .on('click', queueGroupSelectOrToggle)
      .on('dblclick', toggleOrExpandGroup)
  }

  bindHitInteractions(hitRectSel as unknown as d3.Selection<SVGRectElement, GroupDatum, SVGGElement, unknown>)
  bindHitInteractions(hitGeoSel as unknown as d3.Selection<SVGPathElement, GroupDatum, SVGGElement, unknown>)

  itemSel
    .on('mouseover', updateGroupHover)
    .on('mousemove', updateGroupHover)
    .on('mouseout', clearGroupHover)
    .on('click', queueGroupSelectOrToggle)
    .on('dblclick', toggleOrExpandGroup)

  chevronSel.on('click', toggleOrExpandGroup)
  chevronHitSel.on('click', toggleOrExpandGroup)

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
    let dragActivated = false
    let dragThresholdPx = 0
    let dragStartClientX = Number.NaN
    let dragStartClientY = Number.NaN
    let dragBoundsRef: { x: number; y: number; width: number; height: number; labelX?: number; labelY?: number } | null = null
    let dragZoomK = 1
    let endForceTune: null | (() => void) = null
    const activateGroupDrag = (event: d3.D3DragEvent<SVGElement, GroupDatum, GroupDatum>, d: GroupDatum) => {
      if (dragActivated) return
      dragActivated = true

      const svgEl = (event?.sourceEvent?.target as SVGElement | null)?.ownerSVGElement
      markGraphCanvasUserInteracted(svgEl)
      frozen = svgEl?.getAttribute('data-kg-layout-frozen') === '1'
      try {
        const k = d3.zoomTransform(svgEl as unknown as SVGSVGElement).k
        dragZoomK = typeof k === 'number' && Number.isFinite(k) && k > 0 ? k : 1
      } catch {
        dragZoomK = 1
      }

      dragBoundsOnly = false
      dragBoundsRef = null

      const explicit = readExplicitBounds(d)
      if (explicit) {
        dragBoundsOnly = true
        dragBoundsRef = { ...explicit }
        ;(d as unknown as { bounds?: unknown }).bounds = dragBoundsRef as any
        return
      }

      dragNodes = []
      for (let i = 0; i < d.memberNodeIds.length; i += 1) {
        const n = nodeById.get(String(d.memberNodeIds[i]))
        if (n) dragNodes.push(n)
      }
      const structured = readLayoutMode(schema) === 'radial'
      if (simulation && !structured && !frozen && !event.active) {
        const alphaTarget = (() => {
          try {
            const v = useGraphStore.getState().graphDragAlphaTarget2d
            return typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(0.6, v)) : DEFAULT_DRAG_ALPHA_TARGET
          } catch {
            return DEFAULT_DRAG_ALPHA_TARGET
          }
        })()
        endForceTune = beginDragForceTuning(simulation)
        simulation.alphaTarget(Math.min(alphaTarget, DEFAULT_DRAG_ALPHA_TARGET_HARD_CAP)).restart()
      }
      for (let i = 0; i < dragNodes.length; i += 1) {
        const n = dragNodes[i]!
        n.fx = n.x ?? 0
        n.fy = n.y ?? 0
      }
    }
    const dragBehavior = d3
      .drag<SVGElement, GroupDatum>()
      .on('start', (event, d) => {
        const srcEv = (event as unknown as { sourceEvent?: { stopPropagation?: () => void } }).sourceEvent
        if (srcEv && typeof srcEv.stopPropagation === 'function') srcEv.stopPropagation()
        setSelectionSource('canvas')
        selectGroup(d.id)
        const srcRecord = srcEv && typeof srcEv === 'object' ? (srcEv as Record<string, unknown>) : null
        dragActivated = false
        dragThresholdPx = readCanvasDragIntentThresholdPx(srcRecord?.pointerType)
        dragStartClientX = typeof srcRecord?.clientX === 'number' ? srcRecord.clientX : Number.NaN
        dragStartClientY = typeof srcRecord?.clientY === 'number' ? srcRecord.clientY : Number.NaN
        dragBoundsOnly = false
        dragBoundsRef = null
        dragNodes = []
        frozen = false
        dragZoomK = 1

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
            const nextProps = { ...props, 'visual:zIndex': nextZ }
            try {
              args.updateNode(id, { properties: nextProps as never })
            } catch {
              void 0
            }
          }
          return
        }
        if (!(dragThresholdPx > 0)) activateGroupDrag(event, d)
      })
      .on('drag', (event, d) => {
        if (!dragActivated && dragThresholdPx > 0) {
          const srcEv = (event as unknown as { sourceEvent?: unknown }).sourceEvent
          const srcRecord = srcEv && typeof srcEv === 'object' ? (srcEv as Record<string, unknown>) : null
          const clientX = typeof srcRecord?.clientX === 'number' ? srcRecord.clientX : Number.NaN
          const clientY = typeof srcRecord?.clientY === 'number' ? srcRecord.clientY : Number.NaN
          if (Number.isFinite(clientX) && Number.isFinite(clientY) && Number.isFinite(dragStartClientX) && Number.isFinite(dragStartClientY)) {
            const distancePx = Math.hypot(clientX - dragStartClientX, clientY - dragStartClientY)
            if (!(distancePx >= dragThresholdPx)) return
          }
          activateGroupDrag(event, d)
        } else if (!dragActivated) {
          activateGroupDrag(event, d)
        }
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
          applyComputedToGroup(d, computed, String(d.id || '').trim())
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
        if (dragActivated && dragBoundsOnly && dragBoundsRef) {
          const d = event.subject as unknown as GroupDatum
          const id = String(d.id || '').trim()
          if (id) commitGroupBounds(id, dragBoundsRef)
          dragBoundsOnly = false
          dragBoundsRef = null
          dragNodes = []
          frozen = false
          dragActivated = false
          dragThresholdPx = 0
          dragStartClientX = Number.NaN
          dragStartClientY = Number.NaN
          return
        }
        const structured = readLayoutMode(schema) === 'radial'
        if (dragActivated && simulation && !structured && !frozen && !event.active) {
          simulation.alphaTarget(0)
        }
        if (endForceTune) {
          try {
            endForceTune()
          } catch {
            void 0
          } finally {
            endForceTune = null
          }
        }
        if (dragActivated) {
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
        }
        dragNodes = []
        frozen = false
        dragBoundsOnly = false
        dragBoundsRef = null
        dragActivated = false
        dragThresholdPx = 0
        dragStartClientX = Number.NaN
        dragStartClientY = Number.NaN
      })
    
    labelSel.call(dragBehavior as unknown as d3.DragBehavior<SVGTextElement, GroupDatum, unknown>)
  }

  const eps = 0.5

  const { layoutCache, computeBoundsAndLabel, applyComputedToGroup, readExplicitBounds } =
    createGroupsLayoutEngine<GroupDatum>({
      shape,
      schema,
      nodeById,
      nodeHalfExtentsById,
      padding,
      nestedPaddingStep,
      maxDepth,
      labelPadding,
      chevronSizePx,
      chevronGapPx,
      chevronHitRadiusPx,
      collapsedSet,
      allowResize,
      resizeHandleBase: {
        dotRadiusPx: resizeHandleCfg.dotRadiusPx,
        hitRadiusPx: resizeHandleCfg.hitRadiusPx,
        strokeWidthPx: resizeHandleCfg.strokeWidthPx,
      },
      getGroupLabelText,
      rectSel,
      geoSel,
      labelSel,
      chevronSel,
      chevronHitSel,
      resizeHandleGroupSel,
      hitRectSel,
      hitGeoSel,
    })

  const groupDatumById = new Map<string, GroupDatum>()
  itemSel.each(function (d) {
    const id = String(d.id || '').trim()
    if (!id) return
    groupDatumById.set(id, d)
  })
  let lastSelectedGroupId = ''
  let activeResizeGroupId = ''

  function commitGroupBounds(groupId: string, bounds: { x: number; y: number; width: number; height: number; labelX?: number; labelY?: number }) {
    const id = String(groupId || '').trim()
    if (!id) return
    commitGroupBoundsOverrideToStore(id, bounds)
  }

  bindGroupsResizeHandle<GroupDatum>({
    resizeHandleHitSel,
    allowResize,
    minBoundsSizePx: resizeHandleCfg.minBoundsSizePx,
    dragSensitivity: resizeHandleCfg.dragSensitivity,
    dragDeadzonePx: resizeHandleCfg.dragDeadzonePx,
    snapGrid: readSnapGridConfigFromSchema(schema),
    setSelectionSource,
    selectGroup,
    readExplicitBounds,
    computeBoundsAndLabel,
    applyComputedToGroup,
    commitBounds: commitGroupBounds,
    onResizeActiveGroupIdChange: (nextId) => {
      const normalizedNextId = String(nextId || '').trim()
      const prevId = activeResizeGroupId
      activeResizeGroupId = normalizedNextId
      const selectedGroupId = String(useGraphStore.getState().selectedGroupId || '').trim()
      const ids = [prevId, normalizedNextId]
      for (let i = 0; i < ids.length; i += 1) {
        const id = String(ids[i] || '').trim()
        if (!id) continue
        const d = groupDatumById.get(id) || null
        if (!d) continue
        const computed = layoutCache.get(id) || computeBoundsAndLabel(d)
        applyComputedToGroup(d, computed, selectedGroupId, activeResizeGroupId)
      }
    },
  })

  const update = () => {
    const selectedGroupId = String(useGraphStore.getState().selectedGroupId || '').trim()
    const prevSelectedGroupId = lastSelectedGroupId
    if (allowResize && selectedGroupId !== prevSelectedGroupId) {
      const ids = [prevSelectedGroupId, selectedGroupId]
      for (let i = 0; i < ids.length; i += 1) {
        const id = String(ids[i] || '').trim()
        if (!id) continue
        const d = groupDatumById.get(id) || null
        if (!d) continue
        const cached = layoutCache.get(id) || null
        const computed = cached || computeBoundsAndLabel(d)
        applyComputedToGroup(d, computed, selectedGroupId, activeResizeGroupId)
      }
    }
    lastSelectedGroupId = selectedGroupId
    itemSel.each(function (d) {
      const idKey = String(d.id || '').trim()
      if (!idKey) return
      const computed = computeBoundsAndLabel(d)
      const prev = layoutCache.get(idKey) || null
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
      applyComputedToGroup(d, computed, selectedGroupId, activeResizeGroupId)
    })
  }

  update()
  return { update }
}
