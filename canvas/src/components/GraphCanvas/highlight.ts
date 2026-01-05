import { Selection } from 'd3-selection';
import { GraphNode, GraphEdge, GraphData, type SelectionAnchorIds } from '@/lib/graph/types';
import { GraphSchema } from '@/lib/graph/schema';
import { getAdjacencyMap, getEdgeEndpoints, type EdgeWithRuntime } from '@/components/GraphCanvas/utils';
import { getEdgeBaseStroke, getLayerOpacity, getNodeBaseFill, getEdgeStrokeWidth, hasNodeMedia } from '@/components/GraphCanvas/helpers';

export type SelectionHighlightParams = {
  data: GraphData
  schema: GraphSchema
  selectedNodeId: string | null
  selectedEdgeId: string | null
  selectedNodeIds?: string[]
  selectedEdgeIds?: string[]
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
  const baseStroke = schema.nodeStroke?.[node.type]?.color ?? '#ffffff'
  const baseStrokeWidth = schema.nodeStroke?.[node.type]?.width ?? 1.5
  const mediaFill = hasNodeMedia(node) ? 'transparent' : null
  if (selectedEdgeIdSet.size > 0) {
    if (selectedNodeIdSet.has(node.id)) {
      return { fill: mediaFill ?? '#3B82F6', opacity: 1, stroke: '#3B82F6', strokeWidth: baseStrokeWidth * 1.5 }
    }
    const isEndpoint = selectedEdgeEndpointNodeIdSet.has(node.id)
    const fill = mediaFill ?? (isEndpoint ? getNodeBaseFill(node, schema) : '#9CA3AF')
    const opacity = isEndpoint ? 1 : 0.2
    const stroke = isEndpoint ? baseStroke : '#9CA3AF'
    const strokeWidth = isEndpoint ? baseStrokeWidth : baseStrokeWidth
    return { fill, opacity, stroke, strokeWidth }
  }
  if (selectedNodeIdSet.size > 0) {
    if (selectedNodeIdSet.has(node.id)) {
      return { fill: mediaFill ?? '#3B82F6', opacity: 1, stroke: '#3B82F6', strokeWidth: baseStrokeWidth * 1.5 }
    }
    if (neighborIds.has(node.id)) {
      return { fill: mediaFill ?? getNodeBaseFill(node, schema), opacity: 1, stroke: baseStroke, strokeWidth: baseStrokeWidth }
    }
    return { fill: mediaFill ?? '#9CA3AF', opacity: 0.2, stroke: '#9CA3AF', strokeWidth: baseStrokeWidth }
  }
  const baseOpacity = getLayerOpacity(node, schema)
  return { fill: mediaFill ?? getNodeBaseFill(node, schema), opacity: baseOpacity, stroke: baseStroke, strokeWidth: baseStrokeWidth }
}

export const computeLabelVisual = (
  node: GraphNode,
  params: SelectionHighlightParams & { neighborIds: Set<string>; selectionSets?: ReturnType<typeof deriveSelectionSets> },
): LabelVisual => {
  const { schema, neighborIds, selectionSets } = params
  const { selectedNodeIdSet, selectedEdgeIdSet, selectedEdgeEndpointNodeIdSet } =
    selectionSets ?? deriveSelectionSets(params)
  if (selectedEdgeIdSet.size > 0) {
    if (selectedNodeIdSet.has(node.id)) return { opacity: 1 }
    const isEndpoint = selectedEdgeEndpointNodeIdSet.has(node.id)
    return { opacity: isEndpoint ? 1 : 0.2 }
  }
  if (selectedNodeIdSet.size === 0) {
    return { opacity: getLayerOpacity(node, schema) }
  }
  const isHighlighted = selectedNodeIdSet.has(node.id) || neighborIds.has(node.id)
  return { opacity: isHighlighted ? 1 : 0.2 }
}

export const computeEdgeVisual = (
  edge: EdgeWithRuntime,
  params: SelectionHighlightParams & { selectionSets?: ReturnType<typeof deriveSelectionSets> },
): EdgeVisual => {
  const { schema, selectionSets } = params
  const { selectedNodeIdSet, selectedEdgeIdSet } =
    selectionSets ?? deriveSelectionSets(params)
  if (selectedEdgeIdSet.size > 0) {
    const isSelected = selectedEdgeIdSet.has(edge.id)
    const stroke = isSelected ? '#3B82F6' : getEdgeBaseStroke(edge, schema)
    const opacity = isSelected ? 0.9 : 0.2
    const width = isSelected ? getEdgeStrokeWidth(edge, schema) * 1.5 : getEdgeStrokeWidth(edge, schema)
    return { stroke, opacity, width }
  }
  const { src, tgt } = getEdgeEndpoints(edge)
  const isHighlighted =
    selectedNodeIdSet.size > 0 &&
    ((typeof src === 'string' && selectedNodeIdSet.has(src)) || (typeof tgt === 'string' && selectedNodeIdSet.has(tgt)))
  const baseStroke = getEdgeBaseStroke(edge, schema)
  const baseWidth = getEdgeStrokeWidth(edge, schema)
  if (selectedNodeIdSet.size === 0) {
    const baseOpacity = schema.layout?.mode === 'tidy-tree' ? 0.4 : 0.6
    return { stroke: baseStroke, opacity: baseOpacity, width: baseWidth }
  }
  if (isHighlighted) {
    return { stroke: '#3B82F6', opacity: 0.9, width: baseWidth * 1.5 }
  }
  return { stroke: baseStroke, opacity: 0.2, width: baseWidth }
}

export const applySelectionHighlight = (
  nodesSel: Selection<SVGCircleElement, GraphNode, SVGGElement, unknown> | null,
  mediaSel: Selection<SVGGraphicsElement, GraphNode, SVGGElement, unknown> | null,
  labelsSel: Selection<SVGTextElement, GraphNode, SVGGElement, unknown> | null,
  linksSel: Selection<SVGElement, GraphEdge, SVGGElement, unknown> | null,
  data: GraphData,
  schema: GraphSchema,
  selectedNodeId: string | null,
  selectedEdgeId: string | null,
  selectedNodeIds?: string[],
  selectedEdgeIds?: string[],
) => {
  const params: SelectionHighlightParams = { data, schema, selectedNodeId, selectedEdgeId, selectedNodeIds, selectedEdgeIds }
  const neighborIds = computeNeighborIds(params)
  const selectionSets = deriveSelectionSets(params)
  const { selectedNodeIdSet, selectedEdgeIdSet, selectedEdgeEndpointNodeIdSet } = selectionSets
  const nodeParams = { ...params, neighborIds, selectionSets }
  const labelParams = { ...params, neighborIds, selectionSets }
  const edgeParams = { ...params, selectionSets }

  if (nodesSel) {
    nodesSel
      .attr('fill', (d: GraphNode) => {
        const v = computeNodeVisual(d, nodeParams)
        return v.fill
      })
      .attr('stroke', (d: GraphNode) => {
        const v = computeNodeVisual(d, nodeParams)
        return v.stroke
      })
      .attr('stroke-width', (d: GraphNode) => {
        const v = computeNodeVisual(d, nodeParams)
        return v.strokeWidth
      })
      .style('opacity', (d: GraphNode) => {
        const v = computeNodeVisual(d, nodeParams)
        return v.opacity
      });
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
    linksSel
      .attr('stroke', d => {
        const v = computeEdgeVisual(d as EdgeWithRuntime, edgeParams)
        return v.stroke
      })
      .attr('stroke-opacity', d => {
        const v = computeEdgeVisual(d as EdgeWithRuntime, edgeParams)
        return v.opacity
      })
      .attr('stroke-width', d => {
        const v = computeEdgeVisual(d as EdgeWithRuntime, edgeParams)
        return v.width
      });
  }
};
