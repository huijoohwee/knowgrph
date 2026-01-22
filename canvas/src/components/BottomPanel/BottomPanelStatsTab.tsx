import React from 'react'
import CollapsibleSection from '@/features/panels/ui/CollapsibleSection'
import DatasetInspectorSection from '@/features/panels/views/DatasetInspectorSection'
import { useGraphStore } from '@/hooks/useGraphStore'
import usePersistedBoolean from '@/features/hooks/usePersistedBoolean'
import { LS_KEYS } from '@/lib/config'
import CommunitiesStatsSection from '@/components/BottomPanel/stats/CommunitiesStatsSection'
import EdgesStatsSection from '@/components/BottomPanel/stats/EdgesStatsSection'
import NodeWordFrequenciesSection from '@/components/BottomPanel/stats/NodeWordFrequenciesSection'
import KeywordEntitiesSection from '@/components/BottomPanel/stats/KeywordEntitiesSection'
import GraphRagCentralityStatsSection from '@/components/BottomPanel/stats/GraphRagCentralityStatsSection'
import type { StatsUiClasses } from '@/components/BottomPanel/stats/types'
import { useStatsSelection } from '@/components/BottomPanel/hooks/useStatsSelection'
import { useStatsTokens } from '@/components/BottomPanel/hooks/useStatsTokens'
import { useStatsDerivedData } from '@/components/BottomPanel/hooks/useStatsDerivedData'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'

export default function BottomPanelStatsTab() {
  const semanticMode = useGraphStore(s => (s.documentSemanticMode || 'document') as 'document' | 'keyword')
  const {
    data,
    schema,
    effectiveGraph,
    statsScope,
    setStatsScope,
    statsLod,
    setStatsLod,
    effectiveLod,
    pinnedEdgeId,
    setPinnedEdgeId,
    pinnedCommunityId,
    setPinnedCommunityId,
    edgeSelectionSnapshotRef,
    communitySelectionSnapshotRef,
    captureSelectionSnapshot,
    restoreSelectionSnapshot,
    selectNodeIds,
    selectEdgeIds,
    selectedNodeIdSet,
    selectedEdgeIdSet,
  } = useStatsSelection()

  React.useEffect(() => {
    if (semanticMode !== 'keyword') return
    if (statsScope === 'dataset') return
    setStatsScope('dataset')
  }, [semanticMode, setStatsScope, statsScope])

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
    semanticMode,
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

  const clearPinnedEdgeState = React.useCallback(() => {
    setPinnedEdgeId(null)
  }, [setPinnedEdgeId])

  const clearPinnedCommunityState = React.useCallback(() => {
    setPinnedCommunityId(null)
  }, [setPinnedCommunityId])

  const keywordNodes = React.useMemo(() => {
    if (semanticMode !== 'keyword') return []
    const graph = effectiveGraph
    if (!graph || !Array.isArray(graph.nodes)) return []
    const maxListItems = effectiveLod === 'low' ? 10 : effectiveLod === 'medium' ? 20 : 50
    const out = graph.nodes
      .map(n => {
        const props = (n.properties || {}) as Record<string, unknown>
        const kind = String(props['keyword:kind'] || '')
        if (kind && kind !== 'entity') return null
        const rawCount = props.count
        const count = typeof rawCount === 'number' && Number.isFinite(rawCount) ? rawCount : 0
        const vf = typeof props['visual:fill'] === 'string' ? props['visual:fill'].trim() : ''
        const f = typeof props['fill'] === 'string' ? props['fill'].trim() : ''
        const color = vf || f || ''
        return { id: String(n.id), label: String(n.label || n.id), count, color }
      })
      .filter((x): x is { id: string; label: string; count: number; color: string } => !!x && !!x.id)
    out.sort((a, b) => {
      const diff = b.count - a.count
      if (diff !== 0) return diff
      return a.label.localeCompare(b.label)
    })
    return out.slice(0, Math.max(0, maxListItems))
  }, [effectiveGraph, effectiveLod, semanticMode])

  return (
    <div className="h-full min-h-0 flex flex-col overflow-auto px-3">
      <CollapsibleSection
        title="Dashboard"
        className="mt-0 border-t-0 pt-0"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className={`inline-flex rounded-md border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} overflow-hidden`}>
            {(['auto', 'dataset', 'selection'] as const).map(key => (
              <button
                key={key}
                type="button"
                className={[
                  uiPanelMicroLabelTextSizeClass,
                  uiPanelTextFontClass,
                  'px-2 py-[2px]',
                  statsScope === key ? `${UI_THEME_TOKENS.button.activeBg} ${UI_THEME_TOKENS.button.activeText}` : UI_THEME_TOKENS.button.text,
                ].join(' ')}
                onClick={() => setStatsScope(key)}
              >
                {key === 'auto' ? 'Auto' : key === 'dataset' ? 'Dataset' : 'Selection'}
              </button>
            ))}
          </div>
          <div className={`inline-flex rounded-md border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} overflow-hidden`}>
            {(['auto', 'low', 'medium', 'high'] as const).map(key => (
              <button
                key={key}
                type="button"
                className={[
                  uiPanelMicroLabelTextSizeClass,
                  uiPanelTextFontClass,
                  'px-2 py-[2px]',
                  statsLod === key ? `${UI_THEME_TOKENS.button.activeBg} ${UI_THEME_TOKENS.button.activeText}` : UI_THEME_TOKENS.button.text,
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

      <GraphRagCentralityStatsSection
        ui={ui}
        neutralBarColor={neutralBarColor}
      />

      {semanticMode === 'keyword' ? (
        <KeywordEntitiesSection
          keywordNodes={keywordNodes}
          selectedNodeIdSet={selectedNodeIdSet}
          selectNodeIds={selectNodeIds}
          ui={ui}
        />
      ) : (
        <NodeWordFrequenciesSection
          tokensForSelectedNode={tokensForSelectedNode}
          tokensForSelectedNodes={tokensForSelectedNodes}
          statsFilterMode={statsFilterMode}
          statsExcludeTokens={statsExcludeTokens}
          statsIncludeTokens={statsIncludeTokens}
          toggleStatsToken={toggleStatsStopword}
          ui={ui}
        />
      )}

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
        clearPinnedEdgeState={clearPinnedEdgeState}
        communitySelectionSnapshotRef={communitySelectionSnapshotRef}
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
        semanticMode={semanticMode}
        pinnedEdgeId={pinnedEdgeId}
        setPinnedEdgeId={setPinnedEdgeId}
        clearPinnedCommunityState={clearPinnedCommunityState}
        edgeSelectionSnapshotRef={edgeSelectionSnapshotRef}
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
