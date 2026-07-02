import type { GraphData } from '@/lib/graph/types'
import { toMetadataRecord } from '@/lib/graph/documentMetadata'
import { hasFrontmatterMermaidSeeds } from '@/lib/graph/layerDerivation'
import { containsFrontmatterMermaid } from 'grph-shared/markdown/mermaidInput'

const readNormalizedDocumentSemanticMode = (raw: string): string => {
  return String(raw || '').trim().toLowerCase()
}

const readFrontmatterGraphMetadata = (
  graphData: { metadata?: unknown } | null | undefined,
): Record<string, unknown> => toMetadataRecord(graphData?.metadata)

export function isFrontmatterFlowGraph(graphData: GraphData | null | undefined): boolean {
  if (!graphData || typeof graphData !== 'object') return false
  const context = String(graphData.context || '').trim().toLowerCase()
  if (context === 'frontmatter-flow') return true
  const metadata = readFrontmatterGraphMetadata(graphData)
  const kind = String(metadata.kind || '').trim().toLowerCase()
  if (kind === 'frontmatter-flow') return true
  const baseGraphKind = String(metadata.baseGraphKind || '').trim().toLowerCase()
  if (baseGraphKind === 'frontmatter-flow') return true
  return false
}

export function isPendingFrontmatterFlowGraph(graphData: GraphData | null | undefined): boolean {
  if (!isFrontmatterFlowGraph(graphData)) return false
  const metadata = readFrontmatterGraphMetadata(graphData)
  return metadata.pending === true
}

export function computeEffectiveFrontmatterMode(args: {
  frontmatterModeEnabled: boolean
  documentSemanticMode: string
  graphData: GraphData | null
}): boolean {
  if (args.frontmatterModeEnabled !== true) return false
  const semantic = readNormalizedDocumentSemanticMode(args.documentSemanticMode)
  if (semantic && semantic !== 'document') return false
  if (!args.graphData) return false
  if (isFrontmatterFlowGraph(args.graphData)) return true
  return hasFrontmatterMermaidSeeds(args.graphData)
}

export function readFlowchartFrontmatterGraphSource(args: {
  graphData: GraphData | null | undefined
  markdownText: string | null | undefined
}): GraphData | null {
  const graphData = args.graphData
  if (!graphData) return null
  if (!containsFrontmatterMermaid(String(args.markdownText || ''))) return null
  if (isFrontmatterFlowGraph(graphData)) return graphData
  return hasFrontmatterMermaidSeeds(graphData) ? graphData : null
}

export function isFrontmatterDocumentModeRequested(args: {
  frontmatterModeEnabled: boolean
  documentSemanticMode: string
}): boolean {
  if (args.frontmatterModeEnabled !== true) return false
  const semantic = readNormalizedDocumentSemanticMode(args.documentSemanticMode)
  return semantic === 'document'
}

export function isStoryboardWidgetFrontmatterDocumentModeRequested(args: {
  canvas2dRenderer: string
  frontmatterModeEnabled: boolean
  documentSemanticMode: string
}): boolean {
  if (String(args.canvas2dRenderer || '').trim() !== 'storyboard') return false
  return isFrontmatterDocumentModeRequested({
    frontmatterModeEnabled: args.frontmatterModeEnabled,
    documentSemanticMode: args.documentSemanticMode,
  })
}
