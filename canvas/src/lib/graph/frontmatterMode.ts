import type { GraphData } from '@/lib/graph/types'
import { hasFrontmatterMermaidSeeds } from '@/lib/graph/layerDerivation'

export function isFrontmatterFlowGraph(graphData: GraphData): boolean {
  const context = String(graphData.context || '').trim().toLowerCase()
  if (context === 'frontmatter-flow') return true
  const metadata = graphData.metadata && typeof graphData.metadata === 'object'
    ? (graphData.metadata as Record<string, unknown>)
    : null
  const kind = String(metadata?.kind || '').trim().toLowerCase()
  if (kind === 'frontmatter-flow') return true
  return false
}

export function computeEffectiveFrontmatterMode(args: {
  frontmatterModeEnabled: boolean
  documentSemanticMode: string
  graphData: GraphData | null
}): boolean {
  if (args.frontmatterModeEnabled !== true) return false
  const semantic = String(args.documentSemanticMode || '').trim().toLowerCase()
  if (semantic && semantic !== 'document') return false
  if (!args.graphData) return false
  if (isFrontmatterFlowGraph(args.graphData)) return true
  return hasFrontmatterMermaidSeeds(args.graphData)
}

export function isFrontmatterDocumentModeRequested(args: {
  frontmatterModeEnabled: boolean
  documentSemanticMode: string
}): boolean {
  if (args.frontmatterModeEnabled !== true) return false
  const semantic = String(args.documentSemanticMode || '').trim().toLowerCase()
  return semantic === 'document'
}

export function isFlowEditorFrontmatterDocumentModeRequested(args: {
  canvas2dRenderer: string
  frontmatterModeEnabled: boolean
  documentSemanticMode: string
}): boolean {
  if (String(args.canvas2dRenderer || '').trim() !== 'flowEditor') return false
  return isFrontmatterDocumentModeRequested({
    frontmatterModeEnabled: args.frontmatterModeEnabled,
    documentSemanticMode: args.documentSemanticMode,
  })
}
