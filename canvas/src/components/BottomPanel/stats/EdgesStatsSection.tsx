import React from 'react'
import CollapsibleSection from '@/features/panels/ui/CollapsibleSection'
import { AutoHeightMiniBarChart } from '@/features/panels/views/DatasetInspectorMiniViz'
import IconButton from '@/components/IconButton'
import { SlidersHorizontal } from 'lucide-react'
import { emitRendererPanelOpen } from '@/features/canvas/utils'
import { UI_COPY } from '@/lib/config'
import { formatNumber, getEdgeCooccurrenceForStats, getEdgeWeightForStats } from '@/components/BottomPanel/BottomPanelStatsUtils'
import type { SelectionSnapshot, StatsEdge, StatsUiClasses, TokenCount } from '@/components/BottomPanel/stats/types'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'

export default function EdgesStatsSection({
  ui,
  neutralBarColor,
  selectedEdgeIdSet,
  similarityMetricLabel,
  selectedEdge,
  topSemanticEdges,
  selectedEdgeTokenCounts,
  semanticMode,
  pinnedEdgeId,
  setPinnedEdgeId,
  clearPinnedCommunityState,
  edgeSelectionSnapshotRef,
  communitySelectionSnapshotRef,
  captureSelectionSnapshot,
  restoreSelectionSnapshot,
  selectEdgeIds,
  getStatsChartWidthPx,
  semanticEdgeColor,
}: {
  ui: StatsUiClasses
  neutralBarColor: string
  selectedEdgeIdSet: ReadonlySet<string>
  similarityMetricLabel: string
  selectedEdge: StatsEdge | null
  topSemanticEdges: StatsEdge[]
  selectedEdgeTokenCounts: TokenCount[] | null
  semanticMode: 'document' | 'keyword'
  pinnedEdgeId: string | null
  setPinnedEdgeId: (next: string | null) => void
  clearPinnedCommunityState: () => void
  edgeSelectionSnapshotRef: React.MutableRefObject<SelectionSnapshot | null>
  communitySelectionSnapshotRef: React.MutableRefObject<SelectionSnapshot | null>
  captureSelectionSnapshot: () => SelectionSnapshot
  restoreSelectionSnapshot: (snap: SelectionSnapshot | null) => void
  selectEdgeIds: (edgeIds: string[]) => void
  getStatsChartWidthPx: (barCount: number) => number
  semanticEdgeColor: string
}) {
  const {
    uiPanelMonospaceTextClass,
    uiPanelKeyValueTextSizeClass,
    uiPanelMicroLabelTextSizeClass,
    uiPanelTextFontClass,
  } = ui
  const [chartCollapsed, setChartCollapsed] = React.useState(false)
  const scrollToEdgeId = React.useMemo(() => {
    if (pinnedEdgeId) return pinnedEdgeId
    const direct = selectedEdge && selectedEdge.id != null ? String(selectedEdge.id) : ''
    if (direct && selectedEdgeIdSet && selectedEdgeIdSet.has(direct)) return direct
    if (selectedEdgeIdSet) {
      for (const id of selectedEdgeIdSet) return id
    }
    return null
  }, [pinnedEdgeId, selectedEdge, selectedEdgeIdSet])

  return (
    <CollapsibleSection
      title={semanticMode === 'keyword' ? UI_COPY.statsEdgesKeywordSectionTitle : UI_COPY.statsEdgesSectionTitle}
    >
      {selectedEdge ? (
        <div className={`rounded border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} p-3`}>
          <div className={[uiPanelKeyValueTextSizeClass, uiPanelTextFontClass, 'font-semibold', UI_THEME_TOKENS.text.primary].join(' ')}>
            Selected edge
          </div>
          <div className={[uiPanelMicroLabelTextSizeClass, uiPanelTextFontClass, 'mt-1', UI_THEME_TOKENS.text.secondary].join(' ')}>
            id: <span className={uiPanelMonospaceTextClass}>{String(selectedEdge.id)}</span> · label:{' '}
            <span className={uiPanelMonospaceTextClass}>{String(selectedEdge.label ?? '')}</span>
          </div>
          <div className={[uiPanelKeyValueTextSizeClass, uiPanelTextFontClass, 'mt-2 grid grid-cols-2 gap-2', UI_THEME_TOKENS.text.primary].join(' ')}>
            <div className="flex flex-col">
              <span className={['uppercase tracking-wide', UI_THEME_TOKENS.text.tertiary].join(' ')}>
                {similarityMetricLabel} weight
              </span>
              <span className="font-semibold">{formatNumber(getEdgeWeightForStats(selectedEdge))}</span>
            </div>
            <div className="flex flex-col">
              <span className={['uppercase tracking-wide', UI_THEME_TOKENS.text.tertiary].join(' ')}>
                Co-occurrence
              </span>
              <span className="font-semibold">{String(getEdgeCooccurrenceForStats(selectedEdge))}</span>
            </div>
            <div className="flex flex-col">
              <span className={['uppercase tracking-wide', UI_THEME_TOKENS.text.tertiary].join(' ')}>
                Source
              </span>
              <span className={uiPanelMonospaceTextClass}>{String(selectedEdge.source ?? '')}</span>
            </div>
            <div className="flex flex-col">
              <span className={['uppercase tracking-wide', UI_THEME_TOKENS.text.tertiary].join(' ')}>
                Target
              </span>
              <span className={uiPanelMonospaceTextClass}>{String(selectedEdge.target ?? '')}</span>
            </div>
          </div>
        </div>
      ) : (
        <div className={[uiPanelMicroLabelTextSizeClass, uiPanelTextFontClass, UI_THEME_TOKENS.text.secondary].join(' ')}>
          {UI_COPY.statsSelectEdgeToSeeValuesLabel}
        </div>
      )}

      {topSemanticEdges.length > 0 && (
        <div className={`mt-2 rounded border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} p-3`}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1">
              <div className={[uiPanelKeyValueTextSizeClass, uiPanelTextFontClass, 'font-semibold', UI_THEME_TOKENS.text.primary].join(' ')}>
                {semanticMode === 'keyword' ? `Relationship edges (${similarityMetricLabel})` : `Top semantic edges (${similarityMetricLabel})`}
              </div>
              <IconButton
                className="App-toolbar__btn"
                title={UI_COPY.statsOpenRendererSettingsForSemanticEdgesTitle}
                onClick={emitRendererPanelOpen}
                showTooltip
              >
                <SlidersHorizontal className="w-3 h-3" />
              </IconButton>
            </div>
            <button
              type="button"
              className={[
                uiPanelMicroLabelTextSizeClass,
                uiPanelTextFontClass,
                `px-2 py-[2px] rounded border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg}`,
                UI_THEME_TOKENS.button.text,
                UI_THEME_TOKENS.button.hoverBg,
              ].join(' ')}
              onClick={() => setChartCollapsed(prev => !prev)}
            >
              {chartCollapsed ? UI_COPY.statsShowChartLabel : UI_COPY.statsHideChartLabel}
            </button>
          </div>
          {!chartCollapsed && (
            <div
              onClickCapture={(e) => {
                const target = e.target as HTMLElement | null
                const tag = target && typeof target.tagName === 'string' ? target.tagName.toLowerCase() : ''
                if (tag === 'rect') return
                if (!pinnedEdgeId) return
                setPinnedEdgeId(null)
                restoreSelectionSnapshot(edgeSelectionSnapshotRef.current)
                edgeSelectionSnapshotRef.current = null
              }}
            >
              <AutoHeightMiniBarChart
                containerClassName="overflow-x-auto h-16"
                minHeight={64}
                width={getStatsChartWidthPx(topSemanticEdges.length)}
                logicalWidth={getStatsChartWidthPx(topSemanticEdges.length)}
                scrollToKey={scrollToEdgeId}
                data={topSemanticEdges.map((e) => {
                  const id = String(e.id)
                  const src = String(e.source ?? '')
                  const tgt = String(e.target ?? '')
                  const w = getEdgeWeightForStats(e)
                  const c = getEdgeCooccurrenceForStats(e)
                  return {
                    key: id,
                    value: w,
                    color: semanticEdgeColor || undefined,
                    label: `${src} → ${tgt} • ${similarityMetricLabel} ${formatNumber(w)} • count ${String(c)}`,
                    active: pinnedEdgeId === id || (selectedEdgeIdSet ? selectedEdgeIdSet.has(id) : false),
                    onClick: () => {
                      if (pinnedEdgeId === id) {
                        setPinnedEdgeId(null)
                        restoreSelectionSnapshot(edgeSelectionSnapshotRef.current)
                        edgeSelectionSnapshotRef.current = null
                        return
                      }
                      clearPinnedCommunityState()
                      communitySelectionSnapshotRef.current = null
                      if (!edgeSelectionSnapshotRef.current) {
                        edgeSelectionSnapshotRef.current = captureSelectionSnapshot()
                      }
                      selectEdgeIds([id])
                      setPinnedEdgeId(id)
                    },
                  }
                })}
              />
            </div>
          )}
          {selectedEdgeTokenCounts && selectedEdgeTokenCounts.length > 0 && (
            <div className="mt-2">
              <div className={[uiPanelMicroLabelTextSizeClass, uiPanelTextFontClass, 'font-semibold', UI_THEME_TOKENS.text.primary].join(' ')}>
                Top tokens (edge endpoints)
              </div>
              <AutoHeightMiniBarChart
                containerClassName="mt-1 overflow-x-auto h-16"
                minHeight={64}
                width={Math.max(140, selectedEdgeTokenCounts.length * 12)}
                logicalWidth={Math.max(140, selectedEdgeTokenCounts.length * 12)}
                defaultBarColor={neutralBarColor}
                data={selectedEdgeTokenCounts.map(t => ({
                  key: t.token,
                  value: t.count,
                  label: `${t.token} • ${t.count}`,
                }))}
              />
            </div>
          )}
          <div className={[uiPanelMicroLabelTextSizeClass, uiPanelTextFontClass, 'mt-1', UI_THEME_TOKENS.text.tertiary].join(' ')}>
            {UI_COPY.statsBarHeightSimilarityWeightHint(similarityMetricLabel)}
          </div>
        </div>
      )}
    </CollapsibleSection>
  )
}
