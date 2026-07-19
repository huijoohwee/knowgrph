import { resolveWidgetNodeTitle } from '@/components/StoryboardWidget/widgetEditorTitle'
import {
  GRAPH_NODE_CARD_TEXT_FIELDS,
  type GraphNodeCardTextFieldId,
} from '@/lib/cards/graphNodeCardFields'
import { resolveGraphNodeByCanonicalId } from '@/lib/graph/canonicalNodeIds'
import type { GraphData, GraphNode } from '@/lib/graph/types'
import { applyConnectedValuesToNodeForRender } from '@/lib/render/effectiveMediaNode'
import { isRichMediaPanelNode } from '@/lib/render/richMediaPanelNode'
import type {
  FlowConnectedValue,
  FlowConnectedValuesBySchemaPath,
} from '@/lib/storyboardWidget/flowDataflow'

export type StoryboardCardSourceReference = {
  nodeId: string
  label: string
  edgeIds: readonly string[]
  targetFieldIds: readonly GraphNodeCardTextFieldId[]
}

export type StoryboardCardConnectedProjection = {
  renderNode: GraphNode
  sourceReferences: readonly StoryboardCardSourceReference[]
  connectedTextFieldId: GraphNodeCardTextFieldId | null
}

const textFieldIdByPropertyKey = new Map<string, GraphNodeCardTextFieldId>(
  GRAPH_NODE_CARD_TEXT_FIELDS.flatMap(field => (
    field.propertyKeys.map(propertyKey => [propertyKey, field.id] as const)
  )),
)

const resolveConnectedTextFieldId = (schemaPath: string): GraphNodeCardTextFieldId | null => {
  const normalizedPath = String(schemaPath || '').trim()
  if (!normalizedPath.startsWith('properties.')) return null
  const propertyKey = normalizedPath.slice('properties.'.length).split('.')[0] || ''
  return textFieldIdByPropertyKey.get(propertyKey) || null
}

const resolveSourceLabel = (graphData: GraphData | null, nodeId: string): string => {
  const sourceNode = resolveGraphNodeByCanonicalId(graphData, nodeId)
  return sourceNode ? resolveWidgetNodeTitle({ node: sourceNode }) : nodeId
}

const buildSourceReferences = (
  graphData: GraphData | null,
  connectedTextValues: ReadonlyArray<readonly [string, FlowConnectedValue, GraphNodeCardTextFieldId]>,
): StoryboardCardSourceReference[] => {
  const referencesByNodeId = new Map<string, {
    label: string
    edgeIds: Set<string>
    targetFieldIds: Set<GraphNodeCardTextFieldId>
  }>()
  for (const [, connected, targetFieldId] of connectedTextValues) {
    for (const source of connected.sources || []) {
      const nodeId = String(source.nodeId || '').trim()
      if (!nodeId) continue
      const reference = referencesByNodeId.get(nodeId) || {
        label: resolveSourceLabel(graphData, nodeId),
        edgeIds: new Set<string>(),
        targetFieldIds: new Set<GraphNodeCardTextFieldId>(),
      }
      const edgeId = String(source.edgeId || '').trim()
      if (edgeId) reference.edgeIds.add(edgeId)
      reference.targetFieldIds.add(targetFieldId)
      referencesByNodeId.set(nodeId, reference)
    }
  }
  return Array.from(referencesByNodeId.entries()).map(([nodeId, reference]) => ({
    nodeId,
    label: reference.label,
    edgeIds: Array.from(reference.edgeIds).sort(),
    targetFieldIds: Array.from(reference.targetFieldIds),
  }))
}

export function buildStoryboardCardConnectedProjection(args: {
  graphData: GraphData | null
  node: GraphNode
  connectedValuesBySchemaPath?: FlowConnectedValuesBySchemaPath
}): StoryboardCardConnectedProjection {
  const connectedValues = args.connectedValuesBySchemaPath
  if (!connectedValues || Object.keys(connectedValues).length === 0) {
    return { renderNode: args.node, sourceReferences: [], connectedTextFieldId: null }
  }
  if (isRichMediaPanelNode(args.node)) {
    return {
      renderNode: applyConnectedValuesToNodeForRender({ node: args.node, connectedValuesBySchemaPath: connectedValues }),
      sourceReferences: [],
      connectedTextFieldId: null,
    }
  }

  const renderValues: FlowConnectedValuesBySchemaPath = {}
  const connectedTextValues: Array<readonly [string, FlowConnectedValue, GraphNodeCardTextFieldId]> = []
  for (const [schemaPath, connected] of Object.entries(connectedValues)) {
    const textFieldId = resolveConnectedTextFieldId(schemaPath)
    if (textFieldId) connectedTextValues.push([schemaPath, connected, textFieldId])
    else renderValues[schemaPath] = connected
  }
  return {
    renderNode: applyConnectedValuesToNodeForRender({ node: args.node, connectedValuesBySchemaPath: renderValues }),
    sourceReferences: buildSourceReferences(args.graphData, connectedTextValues),
    connectedTextFieldId: connectedTextValues[0]?.[2] || null,
  }
}
