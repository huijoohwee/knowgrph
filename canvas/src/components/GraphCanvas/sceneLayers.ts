import * as d3 from 'd3'
import type { MutableRefObject } from 'react'
import type { GraphNode, GraphEdge, GraphData } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import type { PendingLink, TempLinkSelection } from '@/features/edge-creation'
import { finalizePendingEdge, startEdgeFromNode, startUpdateEdgeEndpoint } from '@/features/edge-creation'
import { emitPropsPanelOpen } from '@/features/canvas/utils'
import type { HoverInfo } from '@/components/GraphHoverTooltip'
import { getEdgeBaseStroke, getEdgeStrokeWidth, getNodeBaseFill, getNodeMediaSpec, getRenderNodeRadius2d } from '@/components/GraphCanvas/helpers'
import { computeTidyTreeLabelVisibility } from '@/components/GraphCanvas/tidyTreeLabelLod'
import { getEdgeEndpoints, nodeDragBehavior, type EdgeWithRuntime, type TidyTreeDerivation } from '@/components/GraphCanvas/utils'

type SvgSelection = d3.Selection<SVGSVGElement, unknown, null, undefined>
type GSelection = d3.Selection<SVGGElement, unknown, null, undefined>

export const createDefs = (svg: SvgSelection) => {
  const defs = svg.append('defs')
  defs
    .append('marker')
    .attr('id', 'arrowhead')
    .attr('viewBox', '0 0 10 10')
    .attr('refX', 8)
    .attr('refY', 5)
    .attr('markerWidth', 6)
    .attr('markerHeight', 6)
    .attr('orient', 'auto-start-reverse')
    .append('path')
    .attr('d', 'M 0 0 L 10 5 L 0 10 z')
    .attr('fill', '#999')
  defs
    .append('clipPath')
    .attr('id', 'node-media-circle-clip')
    .attr('clipPathUnits', 'objectBoundingBox')
    .append('circle')
    .attr('cx', 0.5)
    .attr('cy', 0.5)
    .attr('r', 0.5)
}

export const createLinksLayer = (args: {
  g: GSelection
  edgesForDisplay: GraphEdge[]
  schema: GraphSchema
  hoverEnabled: boolean
  setHoverInfo: (updater: (prev: HoverInfo | null) => HoverInfo | null) => void
  setSelectionSource: (src: 'menu' | 'canvas' | 'toolbar' | 'editor' | 'unknown') => void
  selectNode: (id: string | null) => void
  selectEdge: (id: string | null) => void
}) => {
  const {
    g,
    edgesForDisplay,
    schema,
    hoverEnabled,
    setHoverInfo,
    setSelectionSource,
    selectNode,
    selectEdge,
  } = args
  const isTidyTree = schema.layout?.mode === 'tidy-tree'
  const tidyCfg = schema.layout?.tidyTree || {}
  const tidyColorMode = tidyCfg.colorMode === 'schema' ? 'schema' : 'observable'
  const linkRoot = g.append('g').attr('data-kg-layer', 'links')
  const link = isTidyTree
    ? linkRoot.selectAll<SVGPathElement, GraphEdge>('path').data(edgesForDisplay).enter().append('path').attr('fill', 'none')
    : linkRoot.selectAll<SVGLineElement, GraphEdge>('line').data(edgesForDisplay).enter().append('line')
  ;(link as d3.Selection<SVGElement, GraphEdge, SVGGElement, unknown>)
    .attr('stroke', (d: GraphEdge) => {
      if (isTidyTree) {
        const override = typeof tidyCfg.linkStroke === 'string' ? tidyCfg.linkStroke.trim() : ''
        if (override) return override
        if (tidyColorMode === 'observable') return '#555'
        return getEdgeBaseStroke(d, schema)
      }
      return getEdgeBaseStroke(d, schema)
    })
    .attr('stroke-opacity', () => {
      if (!isTidyTree) return 0.6
      const raw = tidyCfg.linkOpacity
      if (typeof raw === 'number' && Number.isFinite(raw)) return Math.max(0, Math.min(1, raw))
      return 0.4
    })
    .attr('stroke-width', (d: GraphEdge) => {
      if (!isTidyTree) return getEdgeStrokeWidth(d, schema)
      const raw = tidyCfg.linkWidth
      if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return raw
      if (tidyColorMode === 'observable') return 1.5
      return getEdgeStrokeWidth(d, schema)
    })
    .style('cursor', 'pointer')
    .on('click', (event: MouseEvent, d: GraphEdge) => {
      event.stopPropagation()
      setSelectionSource('canvas')
      selectEdge(d.id)
    })
    .on('mouseover', (event: MouseEvent, d: GraphEdge) => {
      if (!hoverEnabled) return
      setHoverInfo(() => ({
        kind: 'edge',
        id: d.id,
        clientX: event.clientX,
        clientY: event.clientY,
      }))
    })
    .on('mousemove', (event: MouseEvent, d: GraphEdge) => {
      if (!hoverEnabled) return
      setHoverInfo(() => ({
        kind: 'edge',
        id: d.id,
        clientX: event.clientX,
        clientY: event.clientY,
      }))
    })
    .on('mouseout', () => {
      if (!hoverEnabled) return
      setHoverInfo(prev => (prev && prev.kind === 'edge' ? null : prev))
    })
    .on('contextmenu', (event: MouseEvent, d: GraphEdge) => {
      event.preventDefault()
      event.stopPropagation()
      setSelectionSource('menu')
      selectNode(null)
      selectEdge(d.id)
      emitPropsPanelOpen({ clientX: event.clientX, clientY: event.clientY })
    })
  if (!isTidyTree) {
    ;(link as d3.Selection<SVGLineElement, GraphEdge, SVGGElement, unknown>).attr(
      'marker-end',
      (d: GraphEdge) => (schema.edgeStyles[d.label]?.arrow ? 'url(#arrowhead)' : null),
    )
  } else {
    ;(link as d3.Selection<SVGPathElement, GraphEdge, SVGGElement, unknown>)
      .attr('stroke-linecap', 'round')
      .attr('stroke-linejoin', 'round')
  }
  return link as unknown as d3.Selection<SVGElement, GraphEdge, SVGGElement, unknown>
}

export const createNodesLayer = (args: {
  g: GSelection
  graphData: GraphData
  edgesForDisplay: GraphEdge[]
  schema: GraphSchema
  tidyTreeDerivation: TidyTreeDerivation | null
  hoverEnabled: boolean
  zoomOnDoubleClick: boolean
  isEditModeRef: MutableRefObject<boolean>
  selectedEdgeIdRef: MutableRefObject<string | null>
  tempLinkSelRef: MutableRefObject<TempLinkSelection>
  linkDragRef: MutableRefObject<PendingLink | null>
  simulation: d3.Simulation<GraphNode, GraphEdge>
  selectNode: (id: string | null) => void
  selectEdge: (id: string | null) => void
  setSelectionSource: (src: 'menu' | 'canvas' | 'toolbar' | 'editor' | 'unknown') => void
  addEdge: (e: GraphEdge) => void
  updateEdge: (id: string, u: Partial<GraphEdge>) => void
  setHoverInfo: (updater: (prev: HoverInfo | null) => HoverInfo | null) => void
  requestZoomSelection: () => void
}): {
  nodeSel: d3.Selection<SVGCircleElement, GraphNode, SVGGElement, unknown>
  mediaSel: d3.Selection<SVGGraphicsElement, GraphNode, SVGGElement, unknown> | null
} => {
  const {
    g,
    graphData,
    edgesForDisplay,
    schema,
    tidyTreeDerivation,
    hoverEnabled,
    zoomOnDoubleClick,
    isEditModeRef,
    selectedEdgeIdRef,
    tempLinkSelRef,
    linkDragRef,
    selectNode,
    selectEdge,
    setSelectionSource,
    addEdge,
    updateEdge,
    setHoverInfo,
    requestZoomSelection,
    simulation,
  } = args

  const isTidyTree = schema.layout?.mode === 'tidy-tree'
  const tidyCfg = schema.layout?.tidyTree || {}
  const tidyColorMode = tidyCfg.colorMode === 'schema' ? 'schema' : 'observable'
  const direction = tidyTreeDerivation?.direction ?? 'source-target'
  const nodesWithChildren = new Set<string>()
  if (isTidyTree && tidyColorMode === 'observable') {
    for (let i = 0; i < edgesForDisplay.length; i += 1) {
      const e = edgesForDisplay[i]
      const src = String(e.source ?? '')
      const tgt = String(e.target ?? '')
      const parent = direction === 'source-target' ? src : tgt
      const child = direction === 'source-target' ? tgt : src
      if (!parent || !child || parent === child) continue
      nodesWithChildren.add(parent)
    }
  }
  const internalFill = (() => {
    const raw = typeof tidyCfg.internalFill === 'string' ? tidyCfg.internalFill.trim() : ''
    if (raw) return raw
    const linkStroke = typeof tidyCfg.linkStroke === 'string' ? tidyCfg.linkStroke.trim() : ''
    return linkStroke || '#555'
  })()
  const leafFill = (() => {
    const raw = typeof tidyCfg.leafFill === 'string' ? tidyCfg.leafFill.trim() : ''
    return raw || '#999'
  })()

  const rawNodes = Array.isArray(graphData.nodes) ? graphData.nodes : []
  const layerMode = schema.layers?.mode || 'property'
  const hiddenTypeSet =
    layerMode === 'semantic' ? new Set(['Document', 'Section', 'Paragraph', 'CodeBlock', 'Table', 'List', 'ListItem']) : null
  const nodes = (() => {
    if (!hiddenTypeSet) return rawNodes
    const filtered = rawNodes.filter(n => !hiddenTypeSet.has(String(n.type || '')))
    return filtered.length > 0 ? filtered : rawNodes
  })()
  const mediaByNodeId = new Map<string, ReturnType<typeof getNodeMediaSpec>>()
  for (let i = 0; i < nodes.length; i += 1) {
    const n = nodes[i]
    const spec = getNodeMediaSpec(n)
    if (!spec) continue
    mediaByNodeId.set(String(n.id), spec)
  }

  const mediaLayer = g.append('g')

  if (mediaByNodeId.size > 0) {
    const mediaNodes = nodes.filter(n => mediaByNodeId.has(String(n.id)))
    const mediaImageNodes = mediaNodes.filter(n => {
      const spec = mediaByNodeId.get(String(n.id))
      return spec?.kind === 'image' || spec?.kind === 'svg'
    })
    const mediaEmbedNodes = mediaNodes.filter(n => {
      const spec = mediaByNodeId.get(String(n.id))
      return spec?.kind === 'video' || spec?.kind === 'iframe'
    })

    if (mediaImageNodes.length > 0) {
      ;(mediaLayer
        .selectAll('image')
        .data(mediaImageNodes, (d: unknown) => String((d as GraphNode).id))
        .enter()
        .append('image')
        .attr('href', (d: GraphNode) => {
          const spec = mediaByNodeId.get(String(d.id))
          return spec ? spec.url : ''
        })
        .attr('preserveAspectRatio', 'xMidYMid slice')
        .attr('clip-path', 'url(#node-media-circle-clip)')
        .style('pointer-events', 'none')) as unknown as d3.Selection<SVGImageElement, GraphNode, SVGGElement, unknown>
    }

    if (mediaEmbedNodes.length > 0) {
      const embedSel = (mediaLayer
        .selectAll('foreignObject')
        .data(mediaEmbedNodes, (d: unknown) => String((d as GraphNode).id))
        .enter()
        .append('foreignObject')
        .attr('clip-path', 'url(#node-media-circle-clip)')
        .style('pointer-events', (d: GraphNode) => {
          const spec = mediaByNodeId.get(String(d.id))
          return spec?.interactive ? 'auto' : 'none'
        })
        .style('overflow', 'hidden')) as unknown as d3.Selection<SVGForeignObjectElement, GraphNode, SVGGElement, unknown>

      embedSel.each(function (d: GraphNode) {
        const spec = mediaByNodeId.get(String(d.id))
        if (!spec) return
        const fo = d3.select(this)
        const container = fo
          .append('xhtml:div')
          .style('width', '100%')
          .style('height', '100%')
          .style('border-radius', '9999px')
          .style('overflow', 'hidden')
          .style('background', '#000')
          .style('pointer-events', spec.interactive ? 'auto' : 'none')

        if (spec.kind === 'video') {
          container
            .append('xhtml:video')
            .attr('src', spec.url)
            .attr('playsinline', 'true')
            .attr('muted', 'true')
            .attr('autoplay', 'true')
            .attr('loop', 'true')
            .attr('preload', 'metadata')
            .style('width', '100%')
            .style('height', '100%')
            .style('object-fit', 'cover')
        } else if (spec.kind === 'iframe') {
          container
            .append('xhtml:iframe')
            .attr('src', spec.url)
            .attr('loading', 'lazy')
            .attr('referrerpolicy', 'no-referrer')
            .attr('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups allow-presentation')
            .attr('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share')
            .style('width', '100%')
            .style('height', '100%')
            .style('border', '0')
        }
      })
    }
  }

  const mediaSel =
    mediaByNodeId.size > 0
      ? (mediaLayer.selectAll('image,foreignObject') as unknown as d3.Selection<SVGGraphicsElement, GraphNode, SVGGElement, unknown>)
      : null

  const node = g
    .append('g')
    .selectAll('circle')
    .data(nodes)
    .enter()
    .append('circle')
    .attr('r', (d: GraphNode) => getRenderNodeRadius2d(d, schema))
    .attr('fill', (d: GraphNode) =>
      mediaByNodeId.has(String(d.id))
        ? 'transparent'
        : (isTidyTree && tidyColorMode === 'observable'
            ? (nodesWithChildren.has(String(d.id)) ? internalFill : leafFill)
            : getNodeBaseFill(d, schema)),
    )
    .attr('stroke', (d: GraphNode) => {
      if (isTidyTree && tidyColorMode === 'observable') return 'none'
      if (schema.layout?.mode === 'tidy-tree') return schema.nodeStroke?.[d.type]?.color ?? 'none'
      return schema.nodeStroke?.[d.type]?.color ?? '#ffffff'
    })
    .attr('stroke-width', (d: GraphNode) => {
      if (isTidyTree && tidyColorMode === 'observable') return 0
      const w = schema.nodeStroke?.[d.type]?.width
      if (typeof w === 'number' && Number.isFinite(w) && w >= 0) return w
      if (schema.layout?.mode === 'tidy-tree') return 0
      return 1.5
    })
    .style('cursor', (d: GraphNode) => {
      const spec = mediaByNodeId.get(String(d.id))
      return spec?.interactive ? 'default' : 'pointer'
    })
    .style('pointer-events', (d: GraphNode) => {
      const spec = mediaByNodeId.get(String(d.id))
      return spec?.interactive ? 'none' : 'all'
    })

  if (schema.behavior.allowNodeDrag) {
    const dragBehavior = nodeDragBehavior(simulation, schema)
    ;(node as d3.Selection<SVGCircleElement, GraphNode, SVGGElement, unknown>).call(
      dragBehavior as d3.DragBehavior<SVGCircleElement, GraphNode, unknown>,
    )
  }

  node.on('contextmenu', (event: MouseEvent, d: GraphNode) => {
    event.preventDefault()
    event.stopPropagation()
    setSelectionSource('menu')
    selectEdge(null)
    selectNode(d.id)
    emitPropsPanelOpen({ clientX: event.clientX, clientY: event.clientY })
  })

  node.on('mousedown', (event, d: GraphNode) => {
    if (isEditModeRef.current && schema.behavior.allowEdgeCreation && (event as MouseEvent).shiftKey) {
      const currentSelectedEdgeId = selectedEdgeIdRef.current
      const sel = currentSelectedEdgeId ? graphData.edges.find(e => e.id === currentSelectedEdgeId) || null : null
      if (sel) {
        const endpoints = getEdgeEndpoints(sel as EdgeWithRuntime)
        const srcId = endpoints.src || ''
        const tgtId = endpoints.tgt || ''
        const selectEdgeNonNull = (id: string) => selectEdge(id)
        const setSelectionSourceStrict = (src: 'menu' | 'canvas' | 'toolbar' | 'editor' | 'unknown') =>
          setSelectionSource(src)
        if (d.id === srcId) {
          startUpdateEdgeEndpoint(
            sel,
            d,
            'update-source',
            tempLinkSelRef,
            linkDragRef,
            selectEdgeNonNull,
            setSelectionSourceStrict,
          )
        } else if (d.id === tgtId) {
          startUpdateEdgeEndpoint(
            sel,
            d,
            'update-target',
            tempLinkSelRef,
            linkDragRef,
            selectEdgeNonNull,
            setSelectionSourceStrict,
          )
        } else {
          startEdgeFromNode(d, tempLinkSelRef, linkDragRef)
        }
      } else {
        startEdgeFromNode(d, tempLinkSelRef, linkDragRef)
      }
      return
    }
    if ((event as MouseEvent).detail === 0) {
      setSelectionSource('canvas')
      selectNode(d.id)
    }
  })

  node.on('click', (event, d: GraphNode) => {
    event.stopPropagation()
    const currentGraphData: GraphData = graphData
    const selectEdgeNonNull = (id: string) => selectEdge(id)
    const setSelectionSourceStrict = (src: 'menu' | 'canvas' | 'toolbar' | 'editor' | 'unknown') =>
      setSelectionSource(src)
    if (
      finalizePendingEdge(
        d.id,
        currentGraphData,
        selectedEdgeIdRef.current,
        tempLinkSelRef,
        linkDragRef,
        addEdge,
        updateEdge,
        selectEdgeNonNull,
        setSelectionSourceStrict,
        schema,
      )
    ) {
      return
    }
    setSelectionSource('canvas')
    selectNode(d.id)
  })

  node.on('dblclick', (event, d: GraphNode) => {
    event.stopPropagation()
    setSelectionSource('canvas')
    selectNode(d.id)
    if (zoomOnDoubleClick) {
      requestZoomSelection()
    }
  })

  node.on('touchstart', (_event, d: GraphNode) => {
    setSelectionSource('canvas')
    selectNode(d.id)
  })

  node.on('mouseover', (event: MouseEvent, d: GraphNode) => {
    if (!hoverEnabled) return
    setHoverInfo(() => ({
      kind: 'node',
      id: d.id,
      clientX: event.clientX,
      clientY: event.clientY,
    }))
  })

  node.on('mousemove', (event: MouseEvent, d: GraphNode) => {
    if (!hoverEnabled) return
    setHoverInfo(() => ({
      kind: 'node',
      id: d.id,
      clientX: event.clientX,
      clientY: event.clientY,
    }))
  })

  node.on('mouseout', () => {
    if (!hoverEnabled) return
    setHoverInfo(prev => (prev && prev.kind === 'node' ? null : prev))
  })

  return { nodeSel: node as d3.Selection<SVGCircleElement, GraphNode, SVGGElement, unknown>, mediaSel }
}

export const createTempLink = (g: GSelection, tempLinkSelRef: MutableRefObject<TempLinkSelection>) => {
  const tempLink = g
    .append('line')
    .attr('stroke', '#3B82F6')
    .attr('stroke-opacity', 0.6)
    .attr('stroke-width', 2)
    .attr('stroke-dasharray', '4,2')
    .style('pointer-events', 'none')
    .style('display', 'none')
  tempLinkSelRef.current = tempLink
}

export const createLabelsLayer = (args: {
  g: GSelection
  graphData: GraphData
  schema: GraphSchema
  edgesForDisplay: GraphEdge[]
  tidyTreeDerivation: TidyTreeDerivation | null
  labelsSelRef: MutableRefObject<d3.Selection<SVGTextElement, GraphNode, SVGGElement, unknown> | null>
}) => {
  const { g, graphData, schema, edgesForDisplay, tidyTreeDerivation, labelsSelRef } = args
  const isTidyTree = schema.layout?.mode === 'tidy-tree'
  const tidyCfg = schema.layout?.tidyTree || {}
  const tidyColorMode = tidyCfg.colorMode === 'schema' ? 'schema' : 'observable'
  const direction = tidyTreeDerivation?.direction ?? 'source-target'
  const rawNodes = Array.isArray(graphData.nodes) ? graphData.nodes : []
  const layerMode = schema.layers?.mode || 'property'
  const hiddenTypeSet =
    layerMode === 'semantic' ? new Set(['Document', 'Section', 'Paragraph', 'CodeBlock', 'Table', 'List', 'ListItem']) : null
  const nodes = (() => {
    if (!hiddenTypeSet) return rawNodes
    const filtered = rawNodes.filter(n => !hiddenTypeSet.has(String(n.type || '')))
    return filtered.length > 0 ? filtered : rawNodes
  })()
  const tidyTreeLabelVisibility = isTidyTree
    ? computeTidyTreeLabelVisibility({ nodes, edgesForDisplay, direction, lod: schema.performance?.lod?.tidyTree })
    : null
  const nodesWithChildren = new Set<string>()
  if (isTidyTree) {
    for (let i = 0; i < edgesForDisplay.length; i += 1) {
      const e = edgesForDisplay[i]
      const src = String(e.source ?? '')
      const tgt = String(e.target ?? '')
      const parent = direction === 'source-target' ? src : tgt
      const child = direction === 'source-target' ? tgt : src
      if (!parent || !child || parent === child) continue
      nodesWithChildren.add(parent)
    }
  }
  const haloColor = schema.labelStyles?.halo?.color ?? '#ffffff'
  const haloWidthRaw = schema.labelStyles?.halo?.width
  const haloWidth =
    typeof haloWidthRaw === 'number' && Number.isFinite(haloWidthRaw) && haloWidthRaw > 0 ? haloWidthRaw : 3
  const labelFontSize = (() => {
    if (!isTidyTree) return schema.labelStyles?.fontSize ?? 12
    const raw = tidyCfg.labelFontSize
    if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return raw
    const fromLabelStyles = schema.labelStyles?.fontSize
    if (typeof fromLabelStyles === 'number' && Number.isFinite(fromLabelStyles) && fromLabelStyles > 0) return fromLabelStyles
    return 10
  })()
  const labelFontFamily = (() => {
    if (!isTidyTree) return null
    const raw = typeof tidyCfg.labelFontFamily === 'string' ? tidyCfg.labelFontFamily.trim() : ''
    return raw ? raw : 'sans-serif'
  })()
  const labelFill = (() => {
    if (!isTidyTree) return schema.labelStyles?.color ?? '#111'
    if (tidyColorMode === 'schema') return schema.labelStyles?.color ?? '#111'
    const override = typeof tidyCfg.linkStroke === 'string' ? tidyCfg.linkStroke.trim() : ''
    return override || '#555'
  })()
  const baseDx = schema.labelStyles?.offset?.dx ?? 12
  const label = g
    .append('g')
    .selectAll('text')
    .data(nodes)
    .enter()
    .append('text')
    .text((d: GraphNode) => d.label)
    .attr('font-size', labelFontSize)
    .attr('font-family', labelFontFamily)
    .attr('data-lod-hidden', (d: GraphNode) => {
      if (!isTidyTree) return '0'
      const id = String(d.id)
      return tidyTreeLabelVisibility && tidyTreeLabelVisibility.has(id) ? '0' : '1'
    })
    .attr('data-zoom-lod-hidden', '0')
    .attr('dx', (d: GraphNode) => {
      if (!isTidyTree) return schema.labelStyles?.offset?.dx ?? 12
      const id = String(d.id)
      const r = getRenderNodeRadius2d(d, schema)
      const pad = 6
      if (tidyColorMode === 'observable') {
        const delta = Math.max(pad, r + 3)
        return nodesWithChildren.has(id) ? -delta : delta
      }
      return nodesWithChildren.has(id) ? -(r + pad) : r + pad
    })
    .attr('dy', isTidyTree ? '0.32em' : (schema.labelStyles?.offset?.dy ?? 4))
    .attr('data-base-anchor', (d: GraphNode) => {
      if (!isTidyTree) return 'start'
      const id = String(d.id)
      return nodesWithChildren.has(id) ? 'end' : 'start'
    })
    .attr('data-base-dx', (d: GraphNode) => {
      if (!isTidyTree) return String(baseDx)
      const id = String(d.id)
      const r = getRenderNodeRadius2d(d, schema)
      const pad = 6
      if (tidyColorMode === 'observable') {
        const delta = Math.max(pad, r + 3)
        return String(nodesWithChildren.has(id) ? -delta : delta)
      }
      return String(nodesWithChildren.has(id) ? -(r + pad) : r + pad)
    })
    .attr('data-base-dy', () => {
      if (isTidyTree) return ''
      return String(schema.labelStyles?.offset?.dy ?? 4)
    })
    .attr('fill', labelFill)
    .attr('text-anchor', (d: GraphNode) => {
      if (!isTidyTree) return null
      const id = String(d.id)
      return nodesWithChildren.has(id) ? 'end' : 'start'
    })
    .attr('paint-order', isTidyTree && tidyColorMode === 'observable' ? 'stroke' : null)
    .attr('stroke', isTidyTree && tidyColorMode === 'observable' ? haloColor : null)
    .attr('stroke-width', isTidyTree && tidyColorMode === 'observable' ? haloWidth : null)
    .attr('stroke-linejoin', isTidyTree && tidyColorMode === 'observable' ? 'round' : null)
    .style('pointer-events', 'none')
  labelsSelRef.current = label as d3.Selection<SVGTextElement, GraphNode, SVGGElement, unknown>
}
