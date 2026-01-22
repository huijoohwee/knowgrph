import { Selection } from 'd3-selection';
import { GraphNode, GraphEdge, GraphData, type SelectionAnchorIds } from '@/lib/graph/types';
import { GraphSchema, getRendererPalette, MVP_COLOR_PALETTE } from '@/lib/graph/schema';
import { getAdjacencyMap, getEdgeEndpoints, type EdgeWithRuntime } from '@/components/GraphCanvas/simulation';
import { getEdgeBaseStroke, getLayerOpacity, getNodeBaseFill, getEdgeStrokeWidth, hasNodeMedia } from '@/components/GraphCanvas/helpers';
import { UI_THEME_COLORS_CSS, type ThemeColors } from '@/lib/ui/theme-tokens';

export type SelectionHighlightParams = {
  data: GraphData
  schema: GraphSchema
  selectedNodeId: string | null
  selectedEdgeId: string | null
  selectedNodeIds?: string[]
  selectedEdgeIds?: string[]
  renderMediaAsNodes: boolean
  mediaNodeOpacity?: number
  themeColors?: ThemeColors
}

export type SelectionIdParams = Pick<
  SelectionHighlightParams,
  'selectedNodeId' | 'selectedEdgeId' | 'selectedNodeIds' | 'selectedEdgeIds'
>

export const normalizeSelectionIds = (
  params: SelectionIdParams,
): SelectionAnchorIds => {
  const { selectedNodeId, selectedEdgeId, selectedNodeIds, selectedEdgeIds } = params
  const selectionNodeIds =
    Array.isArray(selectedNodeIds) && selectedNodeIds.length > 0
      ? selectedNodeIds
      : selectedNodeId
        ? [selectedNodeId]
        : []
  const selectionEdgeIds =
    Array.isArray(selectedEdgeIds) && selectedEdgeIds.length > 0
      ? selectedEdgeIds
      : selectedEdgeId
        ? [selectedEdgeId]
        : []
  return { selectionNodeIds, selectionEdgeIds }
}

export type NodeVisual = {
  fill: string
  opacity: number
  stroke: string
  strokeWidth: number
}

export type LabelVisual = {
  opacity: number
}

export type EdgeVisual = {
  stroke: string
  opacity: number
  width: number
}

function deriveSelectionSets(params: SelectionHighlightParams): {
  selectedNodeIdSet: Set<string>
  selectedEdgeIdSet: Set<string>
  selectedEdgeEndpointNodeIdSet: Set<string>
} {
  const { data, selectedNodeId, selectedEdgeId, selectedNodeIds, selectedEdgeIds } = params
  const { selectionNodeIds, selectionEdgeIds } = normalizeSelectionIds({
    selectedNodeId,
    selectedEdgeId,
    selectedNodeIds,
    selectedEdgeIds,
  })
  const selectedNodeIdSet = new Set<string>(selectionNodeIds.map(String))
  const selectedEdgeIdSet = new Set<string>(selectionEdgeIds.map(String))
  const selectedEdgeEndpointNodeIdSet = new Set<string>()
  if (selectedEdgeIdSet.size > 0) {
    for (let i = 0; i < data.edges.length; i += 1) {
      const e = data.edges[i]
      if (!selectedEdgeIdSet.has(String(e.id))) continue
      const src = String(e.source)
      const tgt = String(e.target)
      if (src) selectedEdgeEndpointNodeIdSet.add(src)
      if (tgt) selectedEdgeEndpointNodeIdSet.add(tgt)
    }
  }
  return { selectedNodeIdSet, selectedEdgeIdSet, selectedEdgeEndpointNodeIdSet }
}

export const computeNeighborIds = (params?: SelectionHighlightParams | null): Set<string> => {
  if (!params || !params.data || !params.schema) {
    return new Set<string>()
  }
  const { data, schema } = params
  const expansionCfg = schema.behavior?.expansion || {}
  const expansionEnabled = expansionCfg.enabled !== false
  const highlightNeighbors = expansionEnabled && expansionCfg.highlightNeighbors !== false
  const neighborIds = new Set<string>()
  const { selectedNodeIdSet, selectedEdgeIdSet } = deriveSelectionSets(params)
  if (selectedEdgeIdSet.size === 0 && selectedNodeIdSet.size > 0 && highlightNeighbors) {
    const adj = getAdjacencyMap(data)
    for (const selectedNodeId of selectedNodeIdSet) {
      const neighbors = adj.get(selectedNodeId)
      if (neighbors) {
        neighbors.forEach(id => neighborIds.add(id))
      }
    }
  }
  return neighborIds
}

export const computeNodeVisual = (
  node: GraphNode,
  params: SelectionHighlightParams & { neighborIds: Set<string>; selectionSets?: ReturnType<typeof deriveSelectionSets> },
): NodeVisual => {
  const { schema, neighborIds, selectionSets } = params
  const { selectedNodeIdSet, selectedEdgeIdSet, selectedEdgeEndpointNodeIdSet } =
    selectionSets ?? deriveSelectionSets(params)
  const palette = getRendererPalette(schema)
  const highlightFill = typeof palette.nodes.idea === 'string' && palette.nodes.idea.trim()
    ? palette.nodes.idea
    : MVP_COLOR_PALETTE.nodes.idea
  const dimmedFill = typeof palette.edges.neutral === 'string' && palette.edges.neutral.trim()
    ? palette.edges.neutral
    : MVP_COLOR_PALETTE.edges.neutral
  const baseStroke = schema.nodeStroke?.[node.type]?.color ?? params.themeColors?.nodeStroke ?? '#ffffff'
  const baseStrokeWidth = schema.nodeStroke?.[node.type]?.width ?? 1.5
  const baseLayerOpacity = getLayerOpacity(node, schema)
  const isMediaNode = params.renderMediaAsNodes && hasNodeMedia(node)
  const mediaOpacity = (() => {
    const raw = params.mediaNodeOpacity
    if (typeof raw === 'number' && Number.isFinite(raw)) {
      if (raw < 0) return 0
      if (raw > 1) return 1
      return raw
    }
    return 0.9
  })()
  const mediaLayerOpacity = Math.max(0, Math.min(1, mediaOpacity * baseLayerOpacity))
  
  if (selectedEdgeIdSet.size > 0) {
    if (selectedNodeIdSet.has(node.id)) {
      return {
        fill: highlightFill,
        opacity: isMediaNode ? mediaLayerOpacity : 1,
        stroke: highlightFill,
        strokeWidth: baseStrokeWidth * 1.5,
      }
    }
    const isEndpoint = selectedEdgeEndpointNodeIdSet.has(node.id)
    const fill = isEndpoint ? getNodeBaseFill(node, schema) : dimmedFill
    const opacity = isMediaNode ? mediaLayerOpacity : isEndpoint ? 1 : 0.2
    const stroke = isEndpoint ? baseStroke : dimmedFill
    const strokeWidth = isEndpoint ? baseStrokeWidth : baseStrokeWidth
    return { fill, opacity, stroke, strokeWidth }
  }
  if (selectedNodeIdSet.size > 0) {
    if (selectedNodeIdSet.has(node.id)) {
      return {
        fill: highlightFill,
        opacity: isMediaNode ? mediaLayerOpacity : 1,
        stroke: highlightFill,
        strokeWidth: baseStrokeWidth * 1.5,
      }
    }
    if (neighborIds.has(node.id)) {
      const opacity = isMediaNode ? mediaLayerOpacity : 1
      return {
        fill: getNodeBaseFill(node, schema),
        opacity,
        stroke: baseStroke,
        strokeWidth: baseStrokeWidth,
      }
    }
    const opacity = isMediaNode ? mediaLayerOpacity : 0.2
    return {
      fill: dimmedFill,
      opacity,
      stroke: dimmedFill,
      strokeWidth: baseStrokeWidth,
    }
  }
  const opacity = isMediaNode ? mediaLayerOpacity : baseLayerOpacity
  return { fill: getNodeBaseFill(node, schema), opacity, stroke: baseStroke, strokeWidth: baseStrokeWidth }
}

export const computeLabelVisual = (
  node: GraphNode,
  params: SelectionHighlightParams & { neighborIds: Set<string>; selectionSets?: ReturnType<typeof deriveSelectionSets> },
): LabelVisual => {
  const { schema, neighborIds, selectionSets } = params
  const { selectedNodeIdSet, selectedEdgeIdSet, selectedEdgeEndpointNodeIdSet } =
    selectionSets ?? deriveSelectionSets(params)
  
  if (selectedEdgeIdSet.size > 0) {
    if (selectedNodeIdSet.has(node.id)) {
      return { opacity: 1 }
    }
    const isEndpoint = selectedEdgeEndpointNodeIdSet.has(node.id)
    const opacity = isEndpoint ? 1 : 0.2
    return { opacity }
  }
  if (selectedNodeIdSet.size === 0) {
    const opacity = getLayerOpacity(node, schema)
    return { opacity }
  }
  const isHighlighted = selectedNodeIdSet.has(node.id) || neighborIds.has(node.id)
  const opacity = isHighlighted ? 1 : 0.2
  return { opacity }
}

export const computeEdgeVisual = (
  edge: EdgeWithRuntime,
  params: SelectionHighlightParams & {
    selectionSets?: ReturnType<typeof deriveSelectionSets>
    neighborIds?: Set<string>
  },
): EdgeVisual => {
  const { schema, selectionSets } = params
  const { selectedEdgeIdSet } =
    selectionSets ?? deriveSelectionSets(params)
  const palette = getRendererPalette(schema)
  const highlightStroke = typeof palette.nodes.idea === 'string' && palette.nodes.idea.trim()
    ? palette.nodes.idea
    : MVP_COLOR_PALETTE.nodes.idea
  if (selectedEdgeIdSet.size > 0) {
    const isSelected = selectedEdgeIdSet.has(edge.id)
    const stroke = isSelected ? highlightStroke : getEdgeBaseStroke(edge, schema)
    const opacity = isSelected ? 0.9 : 0.2
    const width = isSelected ? getEdgeStrokeWidth(edge, schema) * 1.5 : getEdgeStrokeWidth(edge, schema)
    return { stroke, opacity, width }
  }
  const { src, tgt } = getEdgeEndpoints(edge)
  const { selectedNodeIdSet } = selectionSets ?? deriveSelectionSets(params)
  
  const isEndpointSelected =
    selectedNodeIdSet.size > 0 &&
    ((typeof src === 'string' && selectedNodeIdSet.has(src)) ||
      (typeof tgt === 'string' && selectedNodeIdSet.has(tgt)))
  
  const isHighlighted = isEndpointSelected
  const baseStroke = getEdgeBaseStroke(edge, schema)
  const baseWidth = getEdgeStrokeWidth(edge, schema)
  if (selectedNodeIdSet.size === 0) {
    const baseOpacity = 0.6
    return { stroke: baseStroke, opacity: baseOpacity, width: baseWidth }
  }
  if (isHighlighted) {
    return { stroke: highlightStroke, opacity: 0.9, width: baseWidth * 1.5 }
  }
  return { stroke: baseStroke, opacity: 0.2, width: baseWidth }
}

export const applySelectionHighlight = (
  nodesSel: Selection<SVGElement, GraphNode, SVGGElement, unknown> | null,
  mediaSel: Selection<SVGGraphicsElement, GraphNode, SVGGElement, unknown> | null,
  labelsSel: Selection<SVGTextElement, GraphNode, SVGGElement, unknown> | null,
  linksSel: Selection<SVGElement, GraphEdge, SVGGElement, unknown> | null,
  data: GraphData,
  schema: GraphSchema,
  selectedNodeId: string | null,
  selectedEdgeId: string | null,
  selectedNodeIds?: string[],
  selectedEdgeIds?: string[],
  renderMediaAsNodes: boolean = true,
  extra?: {
    mediaNodeOpacity?: number
    themeColors?: ThemeColors
  },
): void => {
  const params: SelectionHighlightParams = {
    data,
    schema,
    selectedNodeId,
    selectedEdgeId,
    selectedNodeIds,
    selectedEdgeIds,
    renderMediaAsNodes,
    mediaNodeOpacity: extra?.mediaNodeOpacity,
    themeColors: extra?.themeColors ?? UI_THEME_COLORS_CSS,
  }
  const neighborIds = computeNeighborIds(params)
  const selectionSets = deriveSelectionSets(params)
  const { selectedEdgeIdSet, selectedNodeIdSet, selectedEdgeEndpointNodeIdSet } = selectionSets
  const nodeParams = { ...params, neighborIds, selectionSets }
  const labelParams = { ...params, neighborIds, selectionSets }
  const edgeParams = { ...params, selectionSets, neighborIds }

  if (nodesSel) {
    nodesSel.each(function (d: GraphNode) {
      const v = computeNodeVisual(d, nodeParams)
      const el = this as unknown as SVGElement
      el.setAttribute('fill', v.fill)
      el.setAttribute('stroke', v.stroke)
      el.setAttribute('stroke-width', String(v.strokeWidth))
      try {
        ;(el.style as CSSStyleDeclaration).opacity = String(v.opacity)
      } catch {
        void 0
      }
    })
  }

  if (mediaSel) {
    mediaSel.style('opacity', (d: GraphNode) => {
      const v = computeNodeVisual(d, nodeParams)
      return v.opacity
    })
  }

  if (labelsSel) {
    labelsSel
      .style('opacity', function (d: GraphNode) {
        const el = this as unknown as SVGTextElement
        const hidden = el.getAttribute('data-lod-hidden') === '1' || el.getAttribute('data-zoom-lod-hidden') === '1'
        if (hidden) {
          const id = String(d.id)
          if (selectedEdgeIdSet.size > 0) {
            const isPinned = selectedNodeIdSet.has(id) || selectedEdgeEndpointNodeIdSet.has(id)
            if (!isPinned) return 0
          } else if (selectedNodeIdSet.size > 0) {
            const isPinned = selectedNodeIdSet.has(id) || neighborIds.has(id)
            if (!isPinned) return 0
          } else {
            return 0
          }
        }
        const v = computeLabelVisual(d, labelParams)
        return v.opacity
      });
  }

  if (linksSel) {
    linksSel.each(function (d) {
      const v = computeEdgeVisual(d as EdgeWithRuntime, edgeParams)
      const el = this as unknown as SVGElement
      el.setAttribute('stroke', v.stroke)
      el.setAttribute('stroke-opacity', String(v.opacity))
      el.setAttribute('stroke-width', String(v.width))
    })
  }
};
