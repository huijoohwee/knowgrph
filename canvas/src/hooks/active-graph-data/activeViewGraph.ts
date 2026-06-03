import type { GraphData } from '@/lib/graph/types'
import { filterGraphToFrontmatterFlow, filterGraphToFrontmatterMermaid } from '@/lib/graph/layerDerivation'
import { deriveGraphDataWithGroupCollapse } from '@/components/GraphCanvas/viewDerivation'
import { computeEffectiveFrontmatterMode, isFrontmatterFlowGraph, readFlowchartFrontmatterGraphSource } from '@/lib/graph/frontmatterMode'
import { deriveMarkdownTableGraphForFrontmatterMode } from '@/features/markdown/tableGraph/deriveMarkdownTableGraph'
import { normalizeCollapsedGroupIds } from '@/lib/canvas/collapsedGroupIdsKey'
import { readDocumentViewModeContext, withActiveDocumentViewMode } from '@/lib/graph/documentViewMode'
import { defaultDelimitedTextDelimiterForName, parseDelimitedText } from '@/lib/delimited-text/delimitedText'
import { hashSignatureParts } from '@/lib/hash/signature'
import { hashStringToHexSharedContentCached } from '@/lib/hash/textHashCache'
import {
  buildDataViewCandidatesFromDelimitedTextParseResult,
  buildDataViewCandidatesFromRowsJsonArtifact,
  type DataViewCandidate,
} from '@/features/markdown-workspace/main/viewer/markdownWorkspaceDataViewCandidates'

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

const isDelimitedTextDocumentName = (nameRaw: string | null | undefined): boolean => {
  const normalized = String(nameRaw || '').split(/[?#]/)[0]?.toLowerCase() || ''
  return normalized.endsWith('.csv') || normalized.endsWith('.tsv') || normalized.endsWith('.tab')
}

const deriveSourceTableGraphFromCandidate = (args: {
  graphData: GraphData
  documentPath: string
  candidate: DataViewCandidate
}): GraphData | null => {
  const columns = args.candidate.view.columns || []
  const rows = args.candidate.view.rows || []
  if (columns.length < 1 || rows.length < 1) return null
  const header = columns.map(column => String(column.name || '').trim() || column.id)
  const tableRows = rows.map(row => columns.map((_, index) => String(row.cells[index] ?? '')))
  const tableId = String(args.candidate.id || '').trim() || `md-block:1-${Math.max(1, tableRows.length + 2)}`
  const baseMeta = args.graphData.metadata && typeof args.graphData.metadata === 'object' && !Array.isArray(args.graphData.metadata)
    ? (args.graphData.metadata as Record<string, unknown>)
    : {}
  const syntheticGraph: GraphData = {
    type: 'Graph',
    context: 'workspace-data-view-source-table',
    nodes: [
      {
        id: `document:${args.documentPath || 'active'}`,
        type: 'Document',
        label: args.documentPath || 'Active document',
        properties: { path: args.documentPath },
      },
      {
        id: `table:${tableId}`,
        type: 'Table',
        label: args.candidate.label || tableId,
        properties: {
          'table:header': header,
          'table:rows': tableRows,
        },
        metadata: {
          documentPath: args.documentPath,
          lineStart: 1,
          lineEnd: Math.max(1, tableRows.length + 2),
        },
      },
    ],
    edges: [],
    metadata: {
      ...baseMeta,
      source: `workspace-data-view:${args.documentPath || 'active'}:${tableId}`,
    },
  }
  return deriveMarkdownTableGraphForFrontmatterMode({ graphData: syntheticGraph })
}

const deriveWorkspaceSourceTableGraphForActiveView = (args: {
  graphData: GraphData
  markdownName?: string | null
  markdownText?: string | null
  jsonSourceText?: string | null
}): GraphData | null => {
  const documentPath = String(args.markdownName || '').trim()
  const jsonSourceText = String(args.jsonSourceText || '').trim()
  if (jsonSourceText) {
    const jsonSourceHash = hashStringToHexSharedContentCached(jsonSourceText, 'rows-json-active-view')
    const candidates = buildDataViewCandidatesFromRowsJsonArtifact(
      jsonSourceText,
      hashSignatureParts(['rows-json-active-view', documentPath, jsonSourceText.length, jsonSourceHash]),
    )
    const candidate = candidates[0]
    if (candidate) {
      const sourcePath = String(documentPath || candidate.label || '').trim()
      return deriveSourceTableGraphFromCandidate({ graphData: args.graphData, documentPath: sourcePath, candidate })
    }
  }

  const markdownText = String(args.markdownText || '')
  if (!documentPath || !markdownText.trim() || !isDelimitedTextDocumentName(documentPath)) return null
  const markdownTextHash = hashStringToHexSharedContentCached(markdownText, 'delimited-active-view')
  const parsed = parseDelimitedText(markdownText, {
    header: true,
    delimiter: defaultDelimitedTextDelimiterForName(documentPath),
  })
  const hasError = parsed.diagnostics.some(item => item.severity === 'error')
  if (hasError) return null
  const candidates = buildDataViewCandidatesFromDelimitedTextParseResult({
    parseResult: parsed,
    candidatesKey: hashSignatureParts(['delimited-active-view', documentPath, markdownText.length, markdownTextHash]),
    sourcePath: documentPath,
  })
  const candidate = candidates[0]
  return candidate ? deriveSourceTableGraphFromCandidate({ graphData: args.graphData, documentPath, candidate }) : null
}

export function deriveGraphDataForActiveView(args: {
  graphData: GraphData
  frontmatterModeEnabled: boolean
  multiDimTableModeEnabled: boolean
  documentSemanticMode: string
  documentStructureBaselineLock: boolean
  collapsedGroupIds: string[]
  markdownName?: string | null
  markdownText?: string | null
  jsonSourceText?: string | null
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
  const deriveActiveViewGraph = (): GraphData => {
      const base = (() => {
        if (mode === 'multiDimTable') {
          const tableGraph =
            deriveMarkdownTableGraphForFrontmatterMode({ graphData: args.graphData })
            || deriveWorkspaceSourceTableGraphForActiveView({
              graphData: args.graphData,
              markdownName: args.markdownName,
              markdownText: args.markdownText,
              jsonSourceText: args.jsonSourceText,
            })
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
  }
  if (mode === 'multiDimTable') return deriveActiveViewGraph()
  return getCachedDerivedActiveViewGraph({
    graphData: args.graphData,
    cacheKey,
    derive: deriveActiveViewGraph,
  })
}
