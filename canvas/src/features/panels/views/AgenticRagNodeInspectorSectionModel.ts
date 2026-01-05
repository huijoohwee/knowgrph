import type { AgenticRagNodeId, AgenticRagNodeView } from '@/lib/graph/types'

export interface AgenticPathInfo {
  pathType: 'traverse' | 'example' | 'mixed'
  query?: string
  example?: string
  traverse: AgenticRagNodeId[]
  multiHop: string[]
  hops: string[]
  hasTraverse: boolean
  hasHops: boolean
  hasMultiHop: boolean
}

export const buildAgenticPathInfo = (
  selectedAgenticNode: AgenticRagNodeView | null,
): AgenticPathInfo | null => {
  if (!selectedAgenticNode) return null
  const traversePath = selectedAgenticNode.parsedGraphRagTraversePath
  const examplePath = selectedAgenticNode.parsedGraphRagExamplePath
  if (!traversePath && !examplePath) return null
  const query = typeof traversePath?.query === 'string' ? traversePath.query : undefined
  const example = typeof examplePath?.example === 'string' ? examplePath.example : undefined
  const traverse = Array.isArray(traversePath?.traverse)
    ? traversePath.traverse ?? []
    : []
  const multiHop = Array.isArray(traversePath?.multiHop)
    ? traversePath.multiHop ?? []
    : []
  const hops = Array.isArray(examplePath?.hops)
    ? examplePath.hops ?? []
    : []
  const hasTraverse = traverse.length > 0
  const hasHops = hops.length > 0
  const hasMultiHop = multiHop.length > 0
  let pathType: 'traverse' | 'example' | 'mixed' = 'mixed'
  if (hasTraverse && !hasHops) pathType = 'traverse'
  else if (hasHops && !hasTraverse) pathType = 'example'
  return {
    pathType,
    query,
    example,
    traverse,
    multiHop,
    hops,
    hasTraverse,
    hasHops,
    hasMultiHop,
  }
}

