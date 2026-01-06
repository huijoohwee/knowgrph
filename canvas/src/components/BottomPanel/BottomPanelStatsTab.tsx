import React from 'react'
import CollapsibleSection from '@/features/panels/ui/CollapsibleSection'
import DatasetInspectorSection from '@/features/panels/views/DatasetInspectorSection'
import { useGraphStore } from '@/hooks/useGraphStore'
import usePersistedBoolean from '@/features/hooks/usePersistedBoolean'
import { LS_KEYS } from '@/lib/config'
import CommunitiesStatsSection from '@/components/BottomPanel/stats/CommunitiesStatsSection'
import EdgesStatsSection from '@/components/BottomPanel/stats/EdgesStatsSection'
import NodeWordFrequenciesSection from '@/components/BottomPanel/stats/NodeWordFrequenciesSection'
import PolygonWordFrequenciesSection from '@/components/BottomPanel/stats/PolygonWordFrequenciesSection'
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
    pinnedPolygonId,
    setPinnedPolygonId,
    pinnedEdgeId,
    setPinnedEdgeId,
    pinnedCommunityId,
    setPinnedCommunityId,
    polygonSelectionSnapshotRef,
    edgeSelectionSnapshotRef,
    communitySelectionSnapshotRef,
    captureSelectionSnapshot,
    restoreSelectionSnapshot,
    selectNodeIds,
    selectEdgeIds,
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
    tokensByPolygon,
    polygonTokensForDropdown,
    polygonTokenFilter,
    setPolygonTokenFilter,
    polygonTokenSort,
    setPolygonTokenSort,
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

  const clearPinnedPolygonState = React.useCallback(() => {
    setPinnedPolygonId(null)
  }, [setPinnedPolygonId])

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
        isCollapsed={datasetInspectorCollapsed}
        onToggle={() => setDatasetInspectorCollapsed(!datasetInspectorCollapsed)}
        datasetStats={datasetStats}
        agenticContext={agenticContext}
        ignoreFilters={datasetIgnoreFilters}
        ui={ui}
      />

      <NodeWordFrequenciesSection
        tokensForSelectedNode={tokensForSelectedNode}
        tokensForSelectedNodes={tokensForSelectedNodes}
        getStatsChartWidthPx={getStatsChartWidthPx}
        statsFilterMode={statsFilterMode}
        setStatsFilterMode={setStatsFilterMode}
        statsExcludeTokens={statsExcludeTokens}
        setStatsExcludeTokens={setStatsExcludeTokens}
        statsIncludeTokens={statsIncludeTokens}
        setStatsIncludeTokens={setStatsIncludeTokens}
        toggleStatsStopword={toggleStatsStopword}
        ui={ui}
      />

      <PolygonWordFrequenciesSection
        tokensByPolygon={tokensByPolygon}
        pinnedPolygonId={pinnedPolygonId}
        setPinnedPolygonId={setPinnedPolygonId}
        polygonSelectionSnapshotRef={polygonSelectionSnapshotRef}
        captureSelectionSnapshot={captureSelectionSnapshot}
        restoreSelectionSnapshot={restoreSelectionSnapshot}
        clearPinnedPolygonState={clearPinnedPolygonState}
        selectNodeIds={selectNodeIds}
        getStatsChartWidthPx={getStatsChartWidthPx}
        polygonTokensForDropdown={polygonTokensForDropdown}
        polygonTokenFilter={polygonTokenFilter}
        setPolygonTokenFilter={setPolygonTokenFilter}
        polygonTokenSort={polygonTokenSort}
        setPolygonTokenSort={setPolygonTokenSort}
        toggleStatsStopword={toggleStatsStopword}
        ui={ui}
      />

      <CommunitiesStatsSection
        communities={communities}
        pinnedCommunityId={pinnedCommunityId}
        setPinnedCommunityId={setPinnedCommunityId}
        communitySelectionSnapshotRef={communitySelectionSnapshotRef}
        captureSelectionSnapshot={captureSelectionSnapshot}
        restoreSelectionSnapshot={restoreSelectionSnapshot}
        clearPinnedCommunityState={clearPinnedCommunityState}
        selectNodeIds={selectNodeIds}
        getStatsChartWidthPx={getStatsChartWidthPx}
        communityTokensForDropdown={communityTokensForDropdown}
        communityTokenFilter={communityTokenFilter}
        setCommunityTokenFilter={setCommunityTokenFilter}
        communityTokenSort={communityTokenSort}
        setCommunityTokenSort={setCommunityTokenSort}
        toggleStatsStopword={toggleStatsStopword}
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
        edgeSelectionSnapshotRef={edgeSelectionSnapshotRef}
        captureSelectionSnapshot={captureSelectionSnapshot}
        restoreSelectionSnapshot={restoreSelectionSnapshot}
        clearPinnedEdgeState={clearPinnedEdgeState}
        selectEdgeIds={selectEdgeIds}
        getStatsChartWidthPx={getStatsChartWidthPx}
        toggleStatsStopword={toggleStatsStopword}
        ui={ui}
      />
    </div>
  )
}
