import type { GraphData } from '@/lib/graph/types'
import { filterGraphToFrontmatterFlow, filterGraphToFrontmatterMermaid } from '@/lib/graph/layerDerivation'
import { deriveGraphDataWithGroupCollapse } from '@/components/GraphCanvas/viewDerivation'
import { computeEffectiveFrontmatterMode, isFrontmatterFlowGraph } from '@/lib/graph/frontmatterMode'
import { deriveMarkdownTableGraphForFrontmatterMode } from '@/features/markdown/tableGraph/deriveMarkdownTableGraph'
import { normalizeCollapsedGroupIds } from '@/lib/canvas/collapsedGroupIdsKey'
import { buildDocumentSemanticModeKey, resolveActiveDocumentViewMode, withActiveDocumentViewMode } from '@/lib/graph/documentViewMode'

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

export function deriveGraphDataForActiveView(args: {
  graphData: GraphData
  frontmatterModeEnabled: boolean
  multiDimTableModeEnabled: boolean
  documentSemanticMode: string
  documentStructureBaselineLock: boolean
  collapsedGroupIds: string[]
}): GraphData {
  const mode = resolveActiveDocumentViewMode({
    frontmatterModeEnabled: args.frontmatterModeEnabled,
    multiDimTableModeEnabled: args.multiDimTableModeEnabled,
    documentSemanticMode: args.documentSemanticMode,
    documentStructureBaselineLock: args.documentStructureBaselineLock,
  })
  const normalizedCollapsedGroupIds = normalizeCollapsedGroupIds(args.collapsedGroupIds)
  const semanticKey = buildDocumentSemanticModeKey({
    frontmatterModeEnabled: args.frontmatterModeEnabled,
    multiDimTableModeEnabled: args.multiDimTableModeEnabled,
    documentSemanticMode: args.documentSemanticMode,
    documentStructureBaselineLock: args.documentStructureBaselineLock,
  })
  const cacheKey = `${semanticKey}|mode:${mode}|collapsed:${normalizedCollapsedGroupIds.join('|')}`
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
          return isFrontmatterFlowGraph(args.graphData)
            ? filterGraphToFrontmatterFlow(args.graphData)
            : filterGraphToFrontmatterMermaid(args.graphData)
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
