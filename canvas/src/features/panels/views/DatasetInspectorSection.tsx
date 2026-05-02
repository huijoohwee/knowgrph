import React from 'react'
import type { AgenticRagContextComparison, AgenticRagIgnoreFiltersSummary } from '@/lib/graph/jsonld/index'
import CollapsibleSection from '@/features/panels/ui/CollapsibleSection'
import Tooltip from '@/features/panels/ui/Tooltip'
import { RENDER_PANEL_SECTION_COPY } from '@/features/panels/config'
import { AgenticRagIgnoreFiltersSummaryView } from '@/features/panels/views/AgenticRagContextSection'
import { useGraphStore } from '@/hooks/useGraphStore'
import { getPillClass } from '@/lib/ui'
import {
  AGENTIC_RAG_CONTEXT_LABEL,
  AGENTIC_RAG_DATASET_CONTEXT_VOCAB_LABEL,
  DATASET_EMPTY_TEXT,
} from '@/lib/config'
import type { GraphData, SelectionAnchorIds } from '@/lib/graph/types'
import { buildSelectionSubgraphForAnchorIds } from '@/lib/graph/file'
import { normalizeSelectionIds } from '@/components/GraphCanvas/highlight'
import { useActiveGraphRenderData } from '@/hooks/useActiveGraphData'
import {
  DatasetDistributionViz,
  DatasetHierarchyViz,
  DatasetPathViz,
  DatasetPolygonViz,
} from '@/features/panels/views/DatasetInspectorMiniViz'

const EMPTY_STRING_ARRAY: string[] = []

interface DatasetStats {
  nodeCount: number
  edgeCount: number
  distinctTriples: number
}

interface DatasetInspectorSectionProps {
  datasetStats: DatasetStats
  contextComparison?: AgenticRagContextComparison | null
  ignoreFilters?: AgenticRagIgnoreFiltersSummary | null
  toolbarAligned?: boolean
  collapsed?: boolean
  onToggle?: (next: boolean) => void
}

export default function DatasetInspectorSection({
  datasetStats,
  contextComparison,
  ignoreFilters,
  toolbarAligned = false,
  collapsed,
  onToggle,
}: DatasetInspectorSectionProps) {
  const uiIconPillBadgeTextSizeClass = useGraphStore(s => s.uiIconPillBadgeTextSizeClass)
  const uiPanelMonospaceTextClass = useGraphStore(
    s => s.uiPanelMonospaceTextClass || 'font-mono text-xs',
  )
  const uiPanelKeyValueTextSizeClass = useGraphStore(
    s => s.uiPanelKeyValueTextSizeClass || 'text-xs',
  )
  const uiPanelMicroLabelTextSizeClass = useGraphStore(
    s => s.uiPanelMicroLabelTextSizeClass || 'text-xs',
  )
  const uiPanelTextFontClass = useGraphStore(
    s => s.uiPanelTextFontClass || 'font-sans',
  )
  const selectedNodeId = useGraphStore(s => s.selectedNodeId)
  const selectedEdgeId = useGraphStore(s => s.selectedEdgeId)
  const selectedNodeIds = useGraphStore(s => s.selectedNodeIds ?? EMPTY_STRING_ARRAY)
  const selectedEdgeIds = useGraphStore(s => s.selectedEdgeIds ?? EMPTY_STRING_ARRAY)
  const copy = RENDER_PANEL_SECTION_COPY.datasetInspector
  const graph = useActiveGraphRenderData()

  const selectionSubgraph = React.useMemo<GraphData | null>(() => {
    if (!graph) return null
    const selectionAnchorIds: SelectionAnchorIds = normalizeSelectionIds({
      selectedNodeId,
      selectedEdgeId,
      selectedNodeIds,
      selectedEdgeIds,
    })
    const { selectionNodeIds, selectionEdgeIds } = selectionAnchorIds
    if (selectionNodeIds.length === 0 && selectionEdgeIds.length === 0) return null
    return buildSelectionSubgraphForAnchorIds(graph, selectionAnchorIds)
  }, [graph, selectedEdgeId, selectedEdgeIds, selectedNodeId, selectedNodeIds])

  const hasSelectionSubgraph = !!(
    selectionSubgraph &&
    Array.isArray(selectionSubgraph.nodes) &&
    selectionSubgraph.nodes.length > 0 &&
    Array.isArray(selectionSubgraph.edges)
  )

  const [vizSource, setVizSource] = React.useState<'auto' | 'dataset' | 'selection'>('auto')

  const effectiveGraph = React.useMemo<GraphData | null>(() => {
    if (!graph) return null
    if (vizSource === 'dataset') return graph
    if (vizSource === 'selection') return selectionSubgraph && hasSelectionSubgraph ? selectionSubgraph : graph
    if (vizSource === 'auto' && hasSelectionSubgraph && selectionSubgraph) return selectionSubgraph
    return graph
  }, [graph, hasSelectionSubgraph, selectionSubgraph, vizSource])

  const selectionSummary = React.useMemo(() => {
    if (!hasSelectionSubgraph || !selectionSubgraph) return ''
    const nodeCount = Array.isArray(selectionSubgraph.nodes) ? selectionSubgraph.nodes.length : 0
    const edgeCount = Array.isArray(selectionSubgraph.edges) ? selectionSubgraph.edges.length : 0
    if (!nodeCount && !edgeCount) return ''
    const nodeLabel = nodeCount === 1 ? 'node' : 'nodes'
    const edgeLabel = edgeCount === 1 ? 'edge' : 'edges'
    return `Selection: ${nodeCount} ${nodeLabel}, ${edgeCount} ${edgeLabel}`
  }, [hasSelectionSubgraph, selectionSubgraph])

  const titleContent = (
    <div className="flex flex-col">
      <span className="inline-flex items-center gap-2">
        {copy.badge && (
          <span
            className={[
              uiPanelKeyValueTextSizeClass,
              uiPanelTextFontClass,
              'font-semibold text-gray-500',
            ].join(' ')}
          >
            {copy.badge}
          </span>
        )}
        <span className="text-xs font-semibold text-gray-800">
          {copy.title}
        </span>
      </span>
      {copy.descriptionShort && (
        <span
          className={[
            uiPanelMicroLabelTextSizeClass,
            uiPanelTextFontClass,
            'text-gray-600',
          ].join(' ')}
        >
          {copy.descriptionShort}
        </span>
      )}
    </div>
  )

  return (
    <CollapsibleSection
      title={copy.tooltip ? (
        <Tooltip
          content={copy.tooltip}
          maxWidthPx={260}
          contentClassName="bg-gray-800/90"
        >
          {titleContent}
        </Tooltip>
      ) : (
        titleContent
      )}
      toolbarAligned={toolbarAligned}
      collapsed={collapsed}
      onToggle={onToggle}
    >
      {datasetStats.nodeCount === 0 && datasetStats.edgeCount === 0 ? (
        <div
          className={[
            uiPanelMicroLabelTextSizeClass,
            'text-gray-600',
          ].join(' ')}
        >
          {DATASET_EMPTY_TEXT}
        </div>
      ) : (
        <div
          className={[
            'grid grid-cols-3 gap-2 text-gray-700',
            uiPanelKeyValueTextSizeClass,
            uiPanelTextFontClass,
          ].join(' ')}
        >
          <div className="flex flex-col">
            <span className="uppercase tracking-wide text-gray-500">Nodes</span>
            <span className="font-semibold">{String(datasetStats.nodeCount)}</span>
          </div>
          <div className="flex flex-col">
            <span className="uppercase tracking-wide text-gray-500">Edges</span>
            <span className="font-semibold">{String(datasetStats.edgeCount)}</span>
          </div>
          <div className="flex flex-col">
            <span className="uppercase tracking-wide text-gray-500">Distinct relationships</span>
            <span className="font-semibold">{String(datasetStats.distinctTriples)}</span>
          </div>
        </div>
      )}
      {effectiveGraph &&
        Array.isArray(effectiveGraph.nodes) &&
        Array.isArray(effectiveGraph.edges) &&
        effectiveGraph.nodes.length > 0 && (
          <>
            {hasSelectionSubgraph && selectionSummary && (
              <div className="mt-2 flex items-center justify-between gap-2">
                <div
                  className={[
                    uiPanelMicroLabelTextSizeClass,
                    uiPanelTextFontClass,
                    'text-gray-600 truncate',
                  ].join(' ')}
                >
                  {selectionSummary}
                </div>
                <div className="inline-flex rounded-md border border-gray-200 bg-white overflow-hidden">
                  <button
                    type="button"
                    className={[
                      uiPanelMicroLabelTextSizeClass,
                      uiPanelTextFontClass,
                      'px-2 py-[2px]',
                      vizSource === 'auto' ? 'bg-gray-200 text-gray-800' : 'text-gray-500',
                    ].join(' ')}
                    onClick={() => setVizSource('auto')}
                  >
                    Auto
                  </button>
                  <button
                    type="button"
                    className={[
                      uiPanelMicroLabelTextSizeClass,
                      uiPanelTextFontClass,
                      'px-2 py-[2px]',
                      vizSource === 'dataset' ? 'bg-gray-200 text-gray-800' : 'text-gray-500',
                    ].join(' ')}
                    onClick={() => setVizSource('dataset')}
                  >
                    Dataset
                  </button>
                  <button
                    type="button"
                    className={[
                      uiPanelMicroLabelTextSizeClass,
                      uiPanelTextFontClass,
                      'px-2 py-[2px]',
                      vizSource === 'selection' ? 'bg-gray-200 text-gray-800' : 'text-gray-500',
                    ].join(' ')}
                    onClick={() => setVizSource('selection')}
                  >
                    Selection
                  </button>
                </div>
              </div>
            )}
            <div className="mt-2 grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1">
                <span
                  className={[
                    uiPanelMicroLabelTextSizeClass,
                    uiPanelTextFontClass,
                    'text-gray-600',
                  ].join(' ')}
                >
                  Node type distribution
                </span>
                <DatasetDistributionViz graph={effectiveGraph} />
              </div>
              <div className="flex flex-col gap-1">
                <span
                  className={[
                    uiPanelMicroLabelTextSizeClass,
                    uiPanelTextFontClass,
                    'text-gray-600',
                  ].join(' ')}
                >
                  Type/label hierarchy
                </span>
                <DatasetHierarchyViz graph={effectiveGraph} />
              </div>
              <div className="flex flex-col gap-1">
                <span
                  className={[
                    uiPanelMicroLabelTextSizeClass,
                    uiPanelTextFontClass,
                    'text-gray-600',
                  ].join(' ')}
                >
                  Degree outline (nodes)
                </span>
                <DatasetPolygonViz graph={effectiveGraph} />
              </div>
              <div className="flex flex-col gap-1">
                <span
                  className={[
                    uiPanelMicroLabelTextSizeClass,
                    uiPanelTextFontClass,
                    'text-gray-600',
                  ].join(' ')}
                >
                  Edge length path
                </span>
                <DatasetPathViz graph={effectiveGraph} />
              </div>
            </div>
          </>
        )}
      {contextComparison && (
        <div className={`mt-1 text-gray-500 ${uiPanelKeyValueTextSizeClass}`}>
          <span
            className={getPillClass('badge', {
              baseClass:
                'inline-flex items-center px-1 py-[1px] mr-1 rounded border border-gray-300 bg-gray-50',
              badgeTextSizeClass: uiIconPillBadgeTextSizeClass,
              textColorClass: 'text-gray-600',
            })}
          >
            {RENDER_PANEL_SECTION_COPY.presetsAndTuning.badge}
          </span>
          {AGENTIC_RAG_CONTEXT_LABEL}
          {' '}
          <span className={`${uiPanelMonospaceTextClass} break-all`}>
            {contextComparison.canonicalContextUrl}
          </span>
          {contextComparison.graphContextUrl && (
            <>
              {' '}
              {AGENTIC_RAG_DATASET_CONTEXT_VOCAB_LABEL}
              {' '}
              <span className={`${uiPanelMonospaceTextClass} break-all`}>
                {contextComparison.graphContextUrl}
              </span>
              {contextComparison.isCanonicalMatch === true && ' (matches)'}
              {contextComparison.isCanonicalMatch === false && ' (differs)'}
            </>
          )}
        </div>
      )}
      <AgenticRagIgnoreFiltersSummaryView
        ignoreFilters={ignoreFilters ?? null}
        className="mt-1"
      />
    </CollapsibleSection>
  )
}
