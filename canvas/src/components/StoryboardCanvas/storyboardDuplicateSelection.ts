import type { GraphNode } from '@/lib/graph/types'
import { getDocumentLocationFromMetadata } from '@/lib/graph/markdownMetadata'

export function findDuplicatedMarkdownNodeId(args: {
  committedNodes: readonly GraphNode[]
  beforeIds: ReadonlySet<string>
  documentPath: string
  duplicatedStartLine: number
  duplicatedEndLine: number
}): string | null {
  for (const node of args.committedNodes) {
    const nodeId = String(node?.id || '').trim()
    if (!nodeId || args.beforeIds.has(nodeId)) continue
    const location = getDocumentLocationFromMetadata(node?.metadata)
    if (
      location?.documentPath === args.documentPath
      && location.lineStart === args.duplicatedStartLine
      && location.lineEnd === args.duplicatedEndLine
    ) {
      return nodeId
    }
  }
  return null
}
