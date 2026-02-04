import type { GraphData } from '@/lib/graph/types'
import { hasFrontmatterMermaidSeeds } from '@/lib/graph/layerDerivation'

export function computeEffectiveFrontmatterMode(args: {
  frontmatterModeEnabled: boolean
  documentSemanticMode: string
  graphData: GraphData | null
}): boolean {
  if (args.frontmatterModeEnabled !== true) return false
  if (String(args.documentSemanticMode) === 'keyword') return false
  if (!args.graphData) return false
  return hasFrontmatterMermaidSeeds(args.graphData)
}

