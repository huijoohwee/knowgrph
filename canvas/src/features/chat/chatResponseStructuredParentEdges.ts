import type {
  ChatResponseSurfaceEdge,
  ChatResponseSurfaceNode,
} from './chatResponseStructuredContent'

const slugify = (value: unknown, fallback: string): string => {
  const slug = String(value || '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
  return slug || fallback
}

const readStructuredCardParentNodeId = (node: ChatResponseSurfaceNode): string => {
  for (const key of ['parentNodeId', 'parent_node_id', 'parentId', 'parent_id']) {
    const raw = node.properties?.[key]
    const value = typeof raw === 'string' || typeof raw === 'number' ? String(raw).trim() : ''
    if (value) return value
  }
  return ''
}

const isStructuredResponseCard = (node: ChatResponseSurfaceNode): boolean => (
  node.properties?.['chat:structuredRole'] === 'card'
)

export const buildStructuredCardParentEdges = (args: {
  nodes: readonly ChatResponseSurfaceNode[]
  nodeIdByReferenceKey: Map<string, string>
  nodeSourceHandleById: Map<string, string>
}): ChatResponseSurfaceEdge[] => args.nodes.flatMap((node, index) => {
  if (!isStructuredResponseCard(node)) return []
  const parentNodeId = readStructuredCardParentNodeId(node)
  if (!parentNodeId) return []
  const sourceId = args.nodeIdByReferenceKey.get(parentNodeId) || parentNodeId
  if (!sourceId || sourceId === node.id) return []
  const sourceHandle = args.nodeSourceHandleById.get(sourceId) || 'output'
  const targetHandle = node.targetHandle || 'output'
  return [{
    id: `e-mcp-response-${slugify(`${sourceId}-candidateOption-${node.id}`, String(index + 1))}`,
    source: sourceId,
    target: node.id,
    sourceHandle,
    targetHandle,
    label: 'candidateOption',
  }]
})
