import {
  findComposedSourceFileByPath,
  normalizeComposedSourcePath,
} from '@/features/source-files/composedSourceSelection'
import { isStrybldrStoryboardMarkdown } from '@/features/strybldr/strybldrStoryboard'
import type { GraphState } from '@/hooks/store/types'
import { isFrontmatterFlowGraph } from '@/lib/graph/frontmatterMode'
import { projectComposedGraphToSourceLayer } from '@/lib/graph/sourceLayers'
import type { GraphData } from '@/lib/graph/types'

export type StoryboardCardMediaGraphSourceOwner = {
  documentName?: string | null
  documentText?: string | null
}

export function resolveStoryboardCardMediaGraphSourceOwner(args: {
  state: GraphState
  sourceOwner?: StoryboardCardMediaGraphSourceOwner
}): {
  state: GraphState
  ownerPath: string
  ownerFile: GraphState['sourceFiles'][number] | null
} {
  const activePath = normalizeComposedSourcePath(args.state.markdownDocumentName)
  const requestedPath = normalizeComposedSourcePath(args.sourceOwner?.documentName)
  const ownerPath = requestedPath || activePath
  const ownerFile = ownerPath ? findComposedSourceFileByPath({
    sourceFiles: args.state.sourceFiles || [],
    targetPath: ownerPath,
  }) : null
  if (!requestedPath || requestedPath === activePath) return { state: args.state, ownerPath, ownerFile }

  const indexedOwnerText = String(ownerFile?.text || '')
  const capturedOwnerText = String(args.sourceOwner?.documentText || '')
  return {
    ownerPath,
    ownerFile,
    state: {
      ...args.state,
      markdownDocumentName: ownerPath,
      markdownDocumentText: indexedOwnerText || capturedOwnerText,
    },
  }
}

export function resolveStoryboardCardMediaGraphSourceGraph(args: {
  graphData: GraphData
  ownerFile: GraphState['sourceFiles'][number] | null
  ownerText: string
}): GraphData {
  const projectedGraph = args.ownerFile
    ? projectComposedGraphToSourceLayer({ graphData: args.graphData, layer: args.ownerFile })
    : args.graphData
  if (isStrybldrStoryboardMarkdown(args.ownerText) || isFrontmatterFlowGraph(projectedGraph)) return projectedGraph
  return {
    ...projectedGraph,
    context: 'frontmatter-flow',
    metadata: {
      ...((projectedGraph.metadata || {}) as Record<string, unknown>),
      kind: 'frontmatter-flow',
    } as GraphData['metadata'],
  }
}

export function shouldUpdateStoryboardCardMediaGraphActiveDocument(args: {
  currentDocumentName?: string | null
  ownerPath: string
}): boolean {
  const ownerPath = normalizeComposedSourcePath(args.ownerPath)
  if (!ownerPath) return true
  return normalizeComposedSourcePath(args.currentDocumentName) === ownerPath
}
