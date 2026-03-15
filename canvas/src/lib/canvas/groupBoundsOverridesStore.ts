import type { GraphNode } from '@/lib/graph/types'
import { useGraphStore } from '@/hooks/useGraphStore'
import type { GroupBoundsOverride } from '@/lib/canvas/groupBoundsOverrides'
import { withSchemaGroupBoundsOverride, withoutSchemaGroupBoundsOverride } from '@/lib/canvas/groupBoundsOverrides'

const readProps = (node: GraphNode | null): Record<string, unknown> => {
  if (!node) return {}
  const props = (node as unknown as { properties?: unknown }).properties
  return props && typeof props === 'object' && !Array.isArray(props) ? (props as Record<string, unknown>) : {}
}

const findNodeById = (nodes: ReadonlyArray<GraphNode>, id: string): GraphNode | null => {
  for (let i = 0; i < nodes.length; i += 1) {
    const n = nodes[i]
    if (String(n.id || '') === id) return n
  }
  return null
}

const resolveNodeIdForGroupId = (groupId: string): string | null => {
  const id = String(groupId || '').trim()
  if (!id) return null
  if (id.startsWith('md:')) {
    const s = id.slice('md:'.length).trim()
    return s ? s : null
  }
  return id
}

export const commitGroupBoundsOverrideToStore = (groupId: string, bounds: GroupBoundsOverride): boolean => {
  const id = String(groupId || '').trim()
  if (!id) return false
  if (!Number.isFinite(bounds.x) || !Number.isFinite(bounds.y) || !Number.isFinite(bounds.width) || !Number.isFinite(bounds.height)) return false
  if (bounds.width <= 0 || bounds.height <= 0) return false

  const st = useGraphStore.getState()
  const updateNode = typeof st.updateNode === 'function' ? st.updateNode : null
  const graphData = st.graphData
  const graphNodes = Array.isArray(graphData?.nodes) ? (graphData?.nodes as GraphNode[]) : ([] as GraphNode[])

  const nodeId = resolveNodeIdForGroupId(id)
  if (nodeId && updateNode) {
    const node = findNodeById(graphNodes, nodeId)
    if (node) {
      const props = readProps(node)
      const nextProps = { ...props, 'visual:boundsOverride': { ...bounds } }
      try {
        updateNode(nodeId, { properties: nextProps as never })
        return true
      } catch {
        void 0
      }
    }
  }

  const setSchema = typeof st.setSchema === 'function' ? st.setSchema : null
  const schema = st.schema
  if (!setSchema || !schema) return false
  try {
    setSchema(withSchemaGroupBoundsOverride(schema, id, bounds))
    return true
  } catch {
    return false
  }
}

export const resetGroupBoundsOverrideInStore = (groupId: string): boolean => {
  const id = String(groupId || '').trim()
  if (!id) return false

  const st = useGraphStore.getState()
  const updateNode = typeof st.updateNode === 'function' ? st.updateNode : null
  const graphData = st.graphData
  const graphNodes = Array.isArray(graphData?.nodes) ? (graphData?.nodes as GraphNode[]) : ([] as GraphNode[])

  const nodeId = resolveNodeIdForGroupId(id)
  if (nodeId && updateNode) {
    const node = findNodeById(graphNodes, nodeId)
    if (node) {
      const props = readProps(node)
      if ('visual:boundsOverride' in props) {
        const nextProps = { ...props }
        delete (nextProps as Record<string, unknown>)['visual:boundsOverride']
        try {
          updateNode(nodeId, { properties: nextProps as never })
          return true
        } catch {
          void 0
        }
      }
    }
  }

  const setSchema = typeof st.setSchema === 'function' ? st.setSchema : null
  const schema = st.schema
  if (!setSchema || !schema) return false
  try {
    setSchema(withoutSchemaGroupBoundsOverride(schema, id))
    return true
  } catch {
    return false
  }
}

