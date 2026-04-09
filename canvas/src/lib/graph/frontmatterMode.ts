import type { GraphData } from '@/lib/graph/types'
import { hasFrontmatterMermaidSeeds } from '@/lib/graph/layerDerivation'

function isFrontmatterFlowGraph(graphData: GraphData): boolean {
  const context = String(graphData.context || '').trim().toLowerCase()
  if (context === 'frontmatter-flow') return true
  const metadata = graphData.metadata && typeof graphData.metadata === 'object'
    ? (graphData.metadata as Record<string, unknown>)
    : null
  const kind = String(metadata?.kind || '').trim().toLowerCase()
  return kind === 'frontmatter-flow'
}

export function computeEffectiveFrontmatterMode(args: {
  frontmatterModeEnabled: boolean
  documentSemanticMode: string
  graphData: GraphData | null
}): boolean {
  if (args.frontmatterModeEnabled !== true) return false
  if (!args.graphData) return false
  if (isFrontmatterFlowGraph(args.graphData)) return true
  return hasFrontmatterMermaidSeeds(args.graphData)
}
