import { normalizeGraphData } from '@/lib/graph/normalize'
import type { GraphSchema } from '@/lib/graph/schema'
import type { GraphData, GraphNode } from '@/lib/graph/types'
import {
  FLOW_EDITOR_LOOP_NODE_TYPE,
  FLOW_EDITOR_NODE_KIND_LOOP_VALUE,
  FLOW_EDITOR_NODE_KIND_PROPERTY_KEY,
} from '@/lib/config'
import { isPortHandlesShowAllInputsEnabled } from '@/lib/graph/portHandlesBehavior'

export function isHandlesForAllInputsEnabled(schema: GraphSchema | null | undefined): boolean {
  return isPortHandlesShowAllInputsEnabled(schema)
}

export function enableHandlesForAllInputsInSchema(schema: GraphSchema): { changed: boolean; schema: GraphSchema } {
  if (isHandlesForAllInputsEnabled(schema)) return { changed: false, schema }

  const behavior = schema.behavior || ({} as GraphSchema['behavior'])
  const prevPort = (behavior.portHandles || {}) as NonNullable<GraphSchema['behavior']>['portHandles']
  const nextPort = { ...prevPort, enabled: true, showAllInputs: true }
  const nextBehavior = { ...behavior, portHandles: nextPort }
  return { changed: true, schema: { ...schema, behavior: nextBehavior } }
}

export function isLoopNode(node: Pick<GraphNode, 'type' | 'properties'> | null | undefined): boolean {
  if (!node) return false
  const type = String((node as { type?: unknown }).type || '').trim()
  if (type !== FLOW_EDITOR_LOOP_NODE_TYPE) return false
  const props = (node as { properties?: unknown }).properties
  if (!props || typeof props !== 'object' || Array.isArray(props)) return false
  return (props as Record<string, unknown>)[FLOW_EDITOR_NODE_KIND_PROPERTY_KEY] === FLOW_EDITOR_NODE_KIND_LOOP_VALUE
}

export function convertNodeToLoopInGraphData(graphData: GraphData, nodeId: string): { changed: boolean; graphData: GraphData } {
  const id = String(nodeId || '').trim()
  if (!id) return { changed: false, graphData }
  const nodes = Array.isArray(graphData.nodes) ? graphData.nodes : []
  const idx = nodes.findIndex(n => String(n?.id || '') === id)
  if (idx < 0) return { changed: false, graphData }

  const target = nodes[idx] as GraphNode
  if (isLoopNode(target)) return { changed: false, graphData }

  const nextNodes = nodes.slice()
  const prevProps = (target.properties || {}) as Record<string, unknown>
  const nextProps: Record<string, unknown> = {
    ...prevProps,
    [FLOW_EDITOR_NODE_KIND_PROPERTY_KEY]: FLOW_EDITOR_NODE_KIND_LOOP_VALUE,
  }
  nextNodes[idx] = { ...target, type: FLOW_EDITOR_LOOP_NODE_TYPE, properties: nextProps as never }
  return { changed: true, graphData: normalizeGraphData({ ...graphData, nodes: nextNodes }) }
}
