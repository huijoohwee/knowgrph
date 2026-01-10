import React from 'react'
import CollapsibleSection from '@/features/panels/ui/CollapsibleSection'
import DatasetInspectorSection from '@/features/panels/views/DatasetInspectorSection'
import { useGraphStore } from '@/hooks/useGraphStore'
import usePersistedBoolean from '@/features/hooks/usePersistedBoolean'
import { LS_KEYS } from '@/lib/config'
import CommunitiesStatsSection from '@/components/BottomPanel/stats/CommunitiesStatsSection'
import EdgesStatsSection from '@/components/BottomPanel/stats/EdgesStatsSection'
import NodeWordFrequenciesSection from '@/components/BottomPanel/stats/NodeWordFrequenciesSection'
import GraphLayerWordFrequenciesSection from '@/components/BottomPanel/stats/GraphLayerWordFrequenciesSection'
import type { StatsUiClasses } from '@/components/BottomPanel/stats/types'
import { useStatsSelection } from '@/components/BottomPanel/hooks/useStatsSelection'
import { useStatsTokens } from '@/components/BottomPanel/hooks/useStatsTokens'
import { useStatsDerivedData } from '@/components/BottomPanel/hooks/useStatsDerivedData'

export default function BottomPanelStatsTab() {
  const {
    data,
    schema,
    effectiveGraph,
    statsScope,
    setStatsScope,
    statsLod,
    setStatsLod,
    effectiveLod,
    pinnedGraphLayerId,
    setPinnedGraphLayerId,
    pinnedEdgeId,
    setPinnedEdgeId,
    pinnedCommunityId,
    setPinnedCommunityId,
    graphLayerSelectionSnapshotRef,
    edgeSelectionSnapshotRef,
    communitySelectionSnapshotRef,
    captureSelectionSnapshot,
    restoreSelectionSnapshot,
    selectNodeIds,
    selectEdgeIds,
    selectedNodeIdSet,
    selectedEdgeIdSet,
  } = useStatsSelection()

  const {
    baseTokenCfg,
    tokenCfg,
    statsExcludeTokens,
    setStatsExcludeTokens,
    statsIncludeTokens,
    setStatsIncludeTokens,
    statsFilterMode,
    setStatsFilterMode,
    toggleStatsStopword,
  } = useStatsTokens({ schema })

  const {
    datasetStats,
    agenticContext,
    datasetIgnoreFilters,
    tokensByGraphLayer,
    graphLayerTokensForDropdown,
    graphLayerTokenFilter,
    setGraphLayerTokenFilter,
    graphLayerTokenSort,
    setGraphLayerTokenSort,
    communityTokensForDropdown,
    communityTokenFilter,
    setCommunityTokenFilter,
    communityTokenSort,
    setCommunityTokenSort,
    tokensForSelectedNode,
    tokensForSelectedNodes,
    selectedEdge,
    selectedEdgeTokenCounts,
    topSemanticEdges,
    semanticEdgeColor,
    neutralBarColor,
    communities,
    similarityMetricLabel,
  } = useStatsDerivedData({
    effectiveGraph,
    data,
    schema,
    tokenCfg,
    effectiveLod,
    baseTokenCfg,
  })

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

  const getStatsChartWidthPx = React.useCallback((barCount: number) => {
    const count = Number.isFinite(barCount) ? Math.max(0, Math.floor(barCount)) : 0
    if (count <= 0) return 140
    return Math.max(140, count * 4)
  }, [])

  const [datasetInspectorCollapsed, setDatasetInspectorCollapsed] = usePersistedBoolean(
    LS_KEYS.renderDatasetInspectorCollapsed,
    true,
  )

  const ui: StatsUiClasses = React.useMemo(() => {
    return {
      uiPanelMonospaceTextClass,
      uiPanelKeyValueTextSizeClass,
      uiPanelMicroLabelTextSizeClass,
      uiPanelTextFontClass,
    }
  }, [uiPanelKeyValueTextSizeClass, uiPanelMicroLabelTextSizeClass, uiPanelMonospaceTextClass, uiPanelTextFontClass])

  const clearPinnedGraphLayerState = React.useCallback(() => {
    setPinnedGraphLayerId(null)
  }, [setPinnedGraphLayerId])

  const clearPinnedEdgeState = React.useCallback(() => {
    setPinnedEdgeId(null)
  }, [setPinnedEdgeId])

  const clearPinnedCommunityState = React.useCallback(() => {
    setPinnedCommunityId(null)
  }, [setPinnedCommunityId])

  return (
    <div className="h-full min-h-0 flex flex-col overflow-auto px-3">
      <CollapsibleSection
        title="Dashboard"
        className="mt-0 border-t-0 pt-0"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex rounded-md border border-gray-200 bg-white overflow-hidden">
            {(['auto', 'dataset', 'selection'] as const).map(key => (
              <button
                key={key}
                type="button"
                className={[
                  uiPanelMicroLabelTextSizeClass,
                  uiPanelTextFontClass,
                  'px-2 py-[2px]',
                  statsScope === key ? 'bg-gray-200 text-gray-800' : 'text-gray-500',
                ].join(' ')}
                onClick={() => setStatsScope(key)}
              >
                {key === 'auto' ? 'Auto' : key === 'dataset' ? 'Dataset' : 'Selection'}
              </button>
            ))}
          </div>
          <div className="inline-flex rounded-md border border-gray-200 bg-white overflow-hidden">
            {(['auto', 'low', 'medium', 'high'] as const).map(key => (
              <button
                key={key}
                type="button"
                className={[
                  uiPanelMicroLabelTextSizeClass,
                  uiPanelTextFontClass,
                  'px-2 py-[2px]',
                  statsLod === key ? 'bg-gray-200 text-gray-800' : 'text-gray-500',
                ].join(' ')}
                onClick={() => setStatsLod(key)}
              >
                {key === 'auto' ? 'Auto' : key === 'low' ? 'Low' : key === 'medium' ? 'Med' : 'High'}
              </button>
            ))}
          </div>
        </div>
      </CollapsibleSection>

      <DatasetInspectorSection
        collapsed={datasetInspectorCollapsed}
        onToggle={() => setDatasetInspectorCollapsed(!datasetInspectorCollapsed)}
        datasetStats={datasetStats}
        contextComparison={agenticContext}
        ignoreFilters={datasetIgnoreFilters}
      />

      <NodeWordFrequenciesSection
        tokensForSelectedNode={tokensForSelectedNode}
        tokensForSelectedNodes={tokensForSelectedNodes}
        statsFilterMode={statsFilterMode}
        statsExcludeTokens={statsExcludeTokens}
        statsIncludeTokens={statsIncludeTokens}
        toggleStatsToken={toggleStatsStopword}
        ui={ui}
      />

      <GraphLayerWordFrequenciesSection
        tokensByGraphLayer={tokensByGraphLayer}
        pinnedGraphLayerId={pinnedGraphLayerId}
        setPinnedGraphLayerId={setPinnedGraphLayerId}
        graphLayerSelectionSnapshotRef={graphLayerSelectionSnapshotRef}
        edgeSelectionSnapshotRef={edgeSelectionSnapshotRef}
        communitySelectionSnapshotRef={communitySelectionSnapshotRef}
        captureSelectionSnapshot={captureSelectionSnapshot}
        restoreSelectionSnapshot={restoreSelectionSnapshot}
        clearPinnedEdgeState={clearPinnedEdgeState}
        clearPinnedCommunityState={clearPinnedCommunityState}
        selectNodeIds={selectNodeIds}
        selectedNodeIdSet={selectedNodeIdSet}
        getStatsChartWidthPx={getStatsChartWidthPx}
        graphLayerTokensForDropdown={graphLayerTokensForDropdown}
        graphLayerTokenFilter={graphLayerTokenFilter}
        setGraphLayerTokenFilter={setGraphLayerTokenFilter}
        graphLayerTokenSort={graphLayerTokenSort}
        setGraphLayerTokenSort={setGraphLayerTokenSort}
        toggleStatsToken={toggleStatsStopword}
        statsExcludeTokens={statsExcludeTokens}
        setStatsExcludeTokens={setStatsExcludeTokens}
        statsIncludeTokens={statsIncludeTokens}
        setStatsIncludeTokens={setStatsIncludeTokens}
        statsFilterMode={statsFilterMode}
        setStatsFilterMode={setStatsFilterMode}
        neutralBarColor={neutralBarColor}
        ui={ui}
      />

      <CommunitiesStatsSection
        communities={communities}
        communityTokensForDropdown={communityTokensForDropdown}
        communityTokenFilter={communityTokenFilter}
        setCommunityTokenFilter={setCommunityTokenFilter}
        communityTokenSort={communityTokenSort}
        setCommunityTokenSort={setCommunityTokenSort}
        statsFilterMode={statsFilterMode}
        setStatsFilterMode={setStatsFilterMode}
        statsExcludeTokens={statsExcludeTokens}
        setStatsExcludeTokens={setStatsExcludeTokens}
        statsIncludeTokens={statsIncludeTokens}
        setStatsIncludeTokens={setStatsIncludeTokens}
        toggleStatsToken={toggleStatsStopword}
        pinnedCommunityId={pinnedCommunityId}
        setPinnedCommunityId={setPinnedCommunityId}
        clearPinnedGraphLayerState={clearPinnedGraphLayerState}
        clearPinnedEdgeState={clearPinnedEdgeState}
        communitySelectionSnapshotRef={communitySelectionSnapshotRef}
        graphLayerSelectionSnapshotRef={graphLayerSelectionSnapshotRef}
        edgeSelectionSnapshotRef={edgeSelectionSnapshotRef}
        captureSelectionSnapshot={captureSelectionSnapshot}
        restoreSelectionSnapshot={restoreSelectionSnapshot}
        selectNodeIds={selectNodeIds}
        getStatsChartWidthPx={getStatsChartWidthPx}
        selectedNodeIdSet={selectedNodeIdSet}
        neutralBarColor={neutralBarColor}
        ui={ui}
      />

      <EdgesStatsSection
        selectedEdge={selectedEdge}
        selectedEdgeTokenCounts={selectedEdgeTokenCounts}
        topSemanticEdges={topSemanticEdges}
        similarityMetricLabel={similarityMetricLabel}
        semanticEdgeColor={semanticEdgeColor}
        neutralBarColor={neutralBarColor}
        pinnedEdgeId={pinnedEdgeId}
        setPinnedEdgeId={setPinnedEdgeId}
        clearPinnedGraphLayerState={clearPinnedGraphLayerState}
        clearPinnedCommunityState={clearPinnedCommunityState}
        edgeSelectionSnapshotRef={edgeSelectionSnapshotRef}
        graphLayerSelectionSnapshotRef={graphLayerSelectionSnapshotRef}
        communitySelectionSnapshotRef={communitySelectionSnapshotRef}
        captureSelectionSnapshot={captureSelectionSnapshot}
        restoreSelectionSnapshot={restoreSelectionSnapshot}
        selectEdgeIds={selectEdgeIds}
        selectedEdgeIdSet={selectedEdgeIdSet}
        getStatsChartWidthPx={getStatsChartWidthPx}
        ui={ui}
      />
    </div>
  )
}
