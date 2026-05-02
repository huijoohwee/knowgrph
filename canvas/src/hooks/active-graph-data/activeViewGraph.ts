import type { GraphData } from '@/lib/graph/types'
import { filterGraphToFrontmatterFlow, filterGraphToFrontmatterMermaid } from '@/lib/graph/layerDerivation'
import { deriveGraphDataWithGroupCollapse } from '@/components/GraphCanvas/viewDerivation'
import { computeEffectiveFrontmatterMode, isFrontmatterFlowGraph, readFlowchartFrontmatterGraphSource } from '@/lib/graph/frontmatterMode'
import { deriveMarkdownTableGraphForFrontmatterMode } from '@/features/markdown/tableGraph/deriveMarkdownTableGraph'
import { normalizeCollapsedGroupIds } from '@/lib/canvas/collapsedGroupIdsKey'
import { readDocumentViewModeContext, withActiveDocumentViewMode } from '@/lib/graph/documentViewMode'

const activeViewGraphCache = new WeakMap<object, Map<string, GraphData>>()

const getCachedDerivedActiveViewGraph = (args: {
  graphData: GraphData
  cacheKey: string
  derive: () => GraphData
}): GraphData => {
  const graphKey = args.graphData as unknown as object
  let perGraph = activeViewGraphCache.get(graphKey)
  if (!perGraph) {
    perGraph = new Map<string, GraphData>()
    activeViewGraphCache.set(graphKey, perGraph)
  }
  const cached = perGraph.get(args.cacheKey)
  if (cached) return cached
  const derived = args.derive()
  perGraph.set(args.cacheKey, derived)
  return derived
}

export function deriveFrontmatterActiveViewGraph(graphData: GraphData): GraphData {
  const frontmatterGraph = isFrontmatterFlowGraph(graphData)
    ? filterGraphToFrontmatterFlow(graphData)
    : filterGraphToFrontmatterMermaid(graphData)
  return withActiveDocumentViewMode(frontmatterGraph, 'frontmatter')
}

export function deriveFlowchartFrontmatterActiveViewGraph(args: {
  graphData: GraphData | null | undefined
  markdownText: string | null | undefined
}): GraphData | null {
  const source = readFlowchartFrontmatterGraphSource(args)
  if (!source) return null
  return isFrontmatterFlowGraph(source) ? source : deriveFrontmatterActiveViewGraph(source)
}

export function deriveGraphDataForActiveView(args: {
  graphData: GraphData
  frontmatterModeEnabled: boolean
  multiDimTableModeEnabled: boolean
  documentSemanticMode: string
  documentStructureBaselineLock: boolean
  collapsedGroupIds: string[]
}): GraphData {
  const documentViewMode = readDocumentViewModeContext({
    frontmatterModeEnabled: args.frontmatterModeEnabled,
    multiDimTableModeEnabled: args.multiDimTableModeEnabled,
    documentSemanticMode: args.documentSemanticMode,
    documentStructureBaselineLock: args.documentStructureBaselineLock,
  })
  const mode = documentViewMode.activeDocumentViewMode
  const normalizedCollapsedGroupIds = normalizeCollapsedGroupIds(args.collapsedGroupIds)
  const semanticViewModeKey = documentViewMode.documentSemanticViewModeKey
  const cacheKey = `${semanticViewModeKey}|collapsed:${normalizedCollapsedGroupIds.join('|')}`
  return getCachedDerivedActiveViewGraph({
    graphData: args.graphData,
    cacheKey,
    derive: () => {
      const base = (() => {
        if (mode === 'multiDimTable') {
          const tableGraph = deriveMarkdownTableGraphForFrontmatterMode({ graphData: args.graphData })
          return tableGraph || args.graphData
        }
        if (mode === 'frontmatter') {
          const effective = computeEffectiveFrontmatterMode({
            frontmatterModeEnabled: true,
            documentSemanticMode: 'document',
            graphData: args.graphData,
          })
          if (!effective) return args.graphData
          return deriveFrontmatterActiveViewGraph(args.graphData)
        }
        return args.graphData
      })()
      const modeTaggedBase = withActiveDocumentViewMode(base, mode)
      if (normalizedCollapsedGroupIds.length === 0) return modeTaggedBase
      return withActiveDocumentViewMode(
        deriveGraphDataWithGroupCollapse({ graphData: modeTaggedBase, collapsedGroupIds: normalizedCollapsedGroupIds }),
        mode,
      )
    },
  })
}
