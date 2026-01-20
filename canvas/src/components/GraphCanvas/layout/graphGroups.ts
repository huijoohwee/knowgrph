import type { GraphData } from '@/lib/graph/types'
import type { GraphGroup } from '@/components/GraphCanvas/layout/graphGroupsTypes'
import { deriveMermaidSubgraphGroups } from '@/components/GraphCanvas/layout/mermaidSubgraphGroups'
import { deriveMarkdownHeadingGroups } from '@/components/GraphCanvas/layout/markdownHeadingGroups'

export const deriveGraphGroups = (data: GraphData): GraphGroup[] => {
  const mermaid = deriveMermaidSubgraphGroups(data) as GraphGroup[]
  const headings = deriveMarkdownHeadingGroups(data)
  const merged = [...mermaid, ...headings]
  merged.sort((a, b) => {
    if (a.depth !== b.depth) return a.depth - b.depth
    return a.id.localeCompare(b.id)
  })
  return merged
}

