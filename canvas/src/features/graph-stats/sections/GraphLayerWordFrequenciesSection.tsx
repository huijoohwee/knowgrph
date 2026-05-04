import React from 'react'
import CollapsibleSection from '@/features/panels/ui/CollapsibleSection'
import { AutoHeightMiniBarChart } from '@/features/panels/views/DatasetInspectorMiniViz'
import IconButton from '@/components/IconButton'
import { SlidersHorizontal } from 'lucide-react'
import { emitRendererPanelOpen } from '@/features/canvas/utils'
import { UI_COPY } from '@/lib/config'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import type { SelectionSnapshot, StatsUiClasses, TokenCount, TokensByGraphLayerRow } from '@/features/graph-stats/types'
import { PlainTextInputEditor } from '@/components/ui/PlainTextInputEditor'

const statsInputClassName = `px-2 py-[2px] rounded border ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.input.bg} ${UI_THEME_TOKENS.input.text} ${UI_THEME_TOKENS.focus.primaryBorderRing}`
const statsToggleButtonClassName = `px-2 py-[2px] rounded border ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.input.bg} ${UI_THEME_TOKENS.text.primary} ${UI_THEME_TOKENS.button.hoverBg}`
const statsFilterActiveClassName = `${UI_THEME_TOKENS.button.neutralMuted} ${UI_THEME_TOKENS.text.primary}`
const statsFilterInactiveClassName = `${UI_THEME_TOKENS.input.bg} ${UI_THEME_TOKENS.text.tertiary} ${UI_THEME_TOKENS.button.hoverBg}`
const statsTokenChipBaseClassName = `inline-flex items-center gap-1 px-2 py-[2px] rounded border cursor-pointer`
const statsTokenDefaultClassName = `${UI_THEME_TOKENS.button.neutralSubtle} ${UI_THEME_TOKENS.input.border}`
const statsTokenIncludedClassName = `bg-blue-50 ${UI_THEME_TOKENS.text.primary} border-blue-200 dark:bg-blue-900/20 dark:text-blue-100 dark:border-blue-800`
const statsTokenExcludedClassName = `bg-red-50 ${UI_THEME_TOKENS.text.tertiary} border-red-200 line-through dark:bg-red-900/20 dark:text-red-200 dark:border-red-800`
const statsTokenInactiveIncludedClassName = `${UI_THEME_TOKENS.button.neutralSubtle} ${UI_THEME_TOKENS.text.tertiary} ${UI_THEME_TOKENS.input.border}`
const statsPanelClassName = `rounded border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} p-3`
const statsSubpanelClassName = `w-full rounded border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} max-h-40 overflow-y-auto`

export default function GraphLayerWordFrequenciesSection({
  ui,
  neutralBarColor,
  selectedNodeIdSet,
  tokensByGraphLayer,
  graphLayerTokensForDropdown,
  graphLayerTokenFilter,
  setGraphLayerTokenFilter,
  graphLayerTokenSort,
  setGraphLayerTokenSort,
  statsFilterMode,
  setStatsFilterMode,
  statsExcludeTokens,
  setStatsExcludeTokens,
  statsIncludeTokens,
  setStatsIncludeTokens,
  toggleStatsToken,
  getStatsChartWidthPx,
  pinnedGraphLayerId,
  setPinnedGraphLayerId,
  clearPinnedEdgeState,
  clearPinnedCommunityState,
  graphLayerSelectionSnapshotRef,
  edgeSelectionSnapshotRef,
  communitySelectionSnapshotRef,
  captureSelectionSnapshot,
  restoreSelectionSnapshot,
  selectNodeIds,
}: {
  ui: StatsUiClasses
  neutralBarColor: string
  selectedNodeIdSet: ReadonlySet<string>
  tokensByGraphLayer: TokensByGraphLayerRow[]
  graphLayerTokensForDropdown: TokenCount[]
  graphLayerTokenFilter: string
  setGraphLayerTokenFilter: (next: string) => void
  graphLayerTokenSort: 'freq' | 'alpha'
  setGraphLayerTokenSort: (next: 'freq' | 'alpha') => void
  statsFilterMode: 'exclude' | 'include'
  setStatsFilterMode: (next: 'exclude' | 'include') => void
  statsExcludeTokens: string[]
  setStatsExcludeTokens: React.Dispatch<React.SetStateAction<string[]>>
  statsIncludeTokens: string[]
  setStatsIncludeTokens: React.Dispatch<React.SetStateAction<string[]>>
  toggleStatsToken: (token: string) => void
  getStatsChartWidthPx: (barCount: number) => number
  pinnedGraphLayerId: string | null
  setPinnedGraphLayerId: (next: string | null) => void
  clearPinnedEdgeState: () => void
  clearPinnedCommunityState: () => void
  graphLayerSelectionSnapshotRef: React.MutableRefObject<SelectionSnapshot | null>
  edgeSelectionSnapshotRef: React.MutableRefObject<SelectionSnapshot | null>
  communitySelectionSnapshotRef: React.MutableRefObject<SelectionSnapshot | null>
  captureSelectionSnapshot: () => SelectionSnapshot
  restoreSelectionSnapshot: (snap: SelectionSnapshot | null) => void
  selectNodeIds: (nodeIds: string[]) => void
}) {
  const {
    uiPanelMonospaceTextClass,
    uiPanelKeyValueTextSizeClass,
    uiPanelMicroLabelTextSizeClass,
    uiPanelTextFontClass,
  } = ui
  const [tokensCollapsed, setTokensCollapsed] = React.useState(false)
  const [chartCollapsed, setChartCollapsed] = React.useState(false)
  const selectedGraphLayerIdSet = React.useMemo(() => {
    const next = new Set<string>()
    if (!selectedNodeIdSet || selectedNodeIdSet.size === 0) return next
    for (let i = 0; i < tokensByGraphLayer.length; i += 1) {
      const row = tokensByGraphLayer[i]
      const ids = row && Array.isArray(row.nodeIds) ? row.nodeIds : []
      for (let j = 0; j < ids.length; j += 1) {
        const id = String(ids[j] || '')
        if (!id) continue
        if (!selectedNodeIdSet.has(id)) continue
        next.add(row.graphLayerId)
        break
      }
    }
    return next
  }, [selectedNodeIdSet, tokensByGraphLayer])
  const scrollToGraphLayerId = React.useMemo(() => {
    if (pinnedGraphLayerId) return pinnedGraphLayerId
    if (selectedGraphLayerIdSet.size === 0) return null
    const row = tokensByGraphLayer.find(r => selectedGraphLayerIdSet.has(r.graphLayerId)) || null
    return row ? row.graphLayerId : null
  }, [pinnedGraphLayerId, selectedGraphLayerIdSet, tokensByGraphLayer])

  return (
    <CollapsibleSection title="Word frequencies by cluster layer">
      {tokensByGraphLayer.length === 0 ? (
        <div className={[uiPanelMicroLabelTextSizeClass, uiPanelTextFontClass, UI_THEME_TOKENS.text.secondary].join(' ')}>
          {UI_COPY.statsNoNodesAvailableLabel}
        </div>
      ) : (
        <div className="space-y-2">
          <div className={statsPanelClassName}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-1">
                <div className={[uiPanelKeyValueTextSizeClass, uiPanelTextFontClass, `font-semibold ${UI_THEME_TOKENS.text.primary}`].join(' ')}>
                  Cluster layer
                </div>
                <IconButton
                  className="App-toolbar__btn"
                  title={UI_COPY.statsOpenRendererSettingsForGraphLayersTitle}
                  onClick={emitRendererPanelOpen}
                  showTooltip
                >
                  <SlidersHorizontal className="w-3 h-3" />
                </IconButton>
              </div>
              <div className="flex items-center gap-2">
                <PlainTextInputEditor
                  className={[
                    uiPanelMicroLabelTextSizeClass,
                    uiPanelTextFontClass,
                    statsInputClassName,
                  ].join(' ')}
                  placeholder={UI_COPY.statsFilterTokensPlaceholder}
                  value={graphLayerTokenFilter}
                  onChange={setGraphLayerTokenFilter}
                />
                <select
                  className={[
                    uiPanelMicroLabelTextSizeClass,
                    uiPanelTextFontClass,
                    statsInputClassName,
                  ].join(' ')}
                  value={graphLayerTokenSort}
                  onChange={e => {
                    const raw = e.target.value === 'alpha' ? 'alpha' : 'freq'
                    setGraphLayerTokenSort(raw)
                  }}
                >
                  <option value="freq">{UI_COPY.statsSortByCountLabel}</option>
                  <option value="alpha">{UI_COPY.statsSortAzLabel}</option>
                </select>
                <div className={`inline-flex rounded border ${UI_THEME_TOKENS.panel.border} overflow-hidden ${UI_THEME_TOKENS.panel.bg}`}>
                  <button
                    type="button"
                    className={[
                      uiPanelMicroLabelTextSizeClass,
                      uiPanelTextFontClass,
                      'px-2 py-[2px]',
                      statsFilterMode === 'exclude'
                        ? statsFilterActiveClassName
                        : statsFilterInactiveClassName,
                    ].join(' ')}
                    onClick={() => setStatsFilterMode('exclude')}
                  >
                    {UI_COPY.statsExcludeWordsLabel}
                  </button>
                  <button
                    type="button"
                    className={[
                      uiPanelMicroLabelTextSizeClass,
                      uiPanelTextFontClass,
                      `px-2 py-[2px] border-l ${UI_THEME_TOKENS.panel.divider}`,
                      statsFilterMode === 'include'
                        ? statsFilterActiveClassName
                        : statsFilterInactiveClassName,
                    ].join(' ')}
                    onClick={() => setStatsFilterMode('include')}
                  >
                    {UI_COPY.statsIncludeWordsLabel}
                  </button>
                </div>
                <button
                  type="button"
                  className={[
                    uiPanelMicroLabelTextSizeClass,
                    uiPanelTextFontClass,
                    statsToggleButtonClassName,
                  ].join(' ')}
                  onClick={() => setTokensCollapsed(prev => !prev)}
                >
                  {tokensCollapsed ? UI_COPY.statsShowTokensLabel : UI_COPY.statsHideTokensLabel}
                </button>
                <button
                  type="button"
                  className={[
                    uiPanelMicroLabelTextSizeClass,
                    uiPanelTextFontClass,
                    statsToggleButtonClassName,
                  ].join(' ')}
                  onClick={() => setChartCollapsed(prev => !prev)}
                >
                  {chartCollapsed ? UI_COPY.statsShowChartLabel : UI_COPY.statsHideChartLabel}
                </button>
              </div>
            </div>
            {!tokensCollapsed && (
            <div className="mt-2">
              <div
                className={[
                  uiPanelMicroLabelTextSizeClass,
                  uiPanelTextFontClass,
                  statsSubpanelClassName,
                ].join(' ')}
              >
                {(() => {
                  const norm = (v: unknown) => String(v || '').toLowerCase()
                  const all = graphLayerTokensForDropdown.map(t => norm(t.token)).filter(Boolean)
                  const allSet = new Set(all)
                  const allSelected =
                    all.length > 0 &&
                    (statsFilterMode === 'include'
                      ? all.every(t => statsIncludeTokens.includes(t))
                      : all.every(t => !statsExcludeTokens.includes(t)))
                  return (
                    <label className={`flex items-center justify-between gap-3 px-2 pt-2 pb-1 border-b ${UI_THEME_TOKENS.panel.divider} sticky top-0 z-10 ${UI_THEME_TOKENS.panel.bg}`}>
                      <span className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={allSelected}
                          onChange={(e) => {
                            const nextChecked = !!e.target.checked
                            if (statsFilterMode === 'include') {
                              setStatsIncludeTokens(prev => {
                                const cur = new Set(prev.map(norm).filter(Boolean))
                                if (nextChecked) all.forEach(t => cur.add(t))
                                else all.forEach(t => cur.delete(t))
                                return Array.from(cur)
                              })
                              if (nextChecked) {
                                setStatsExcludeTokens(prev => prev.map(norm).filter(t => !allSet.has(t)))
                              }
                              return
                            }
                            setStatsExcludeTokens(prev => {
                              const cur = new Set(prev.map(norm).filter(Boolean))
                              if (nextChecked) {
                                all.forEach(t => cur.delete(t))
                              } else {
                                all.forEach(t => cur.add(t))
                              }
                              return Array.from(cur)
                            })
                            if (!nextChecked) {
                              setStatsIncludeTokens(prev => prev.map(norm).filter(t => !allSet.has(t)))
                            }
                          }}
                        />
                        <span>{UI_COPY.statsSelectAllLabel}</span>
                      </span>
                      <span className={UI_THEME_TOKENS.text.tertiary}>{String(all.length)}</span>
                    </label>
                  )
                })()}
                <div className="px-2 pb-2">
                  {graphLayerTokensForDropdown.map((t) => {
                    const tok = String(t.token || '').toLowerCase()
                    const checked =
                      statsFilterMode === 'include'
                        ? statsIncludeTokens.includes(tok)
                        : !statsExcludeTokens.includes(tok)
                    return (
                      <label key={tok} className="flex items-center justify-between gap-3 py-0.5">
                        <span className="flex items-center gap-2 min-w-0">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              const nextChecked = !!e.target.checked
                              if (statsFilterMode === 'include') {
                                setStatsIncludeTokens(prev => {
                                  const cur = new Set(prev.map(s => String(s || '').toLowerCase()).filter(Boolean))
                                  if (nextChecked) cur.add(tok); else cur.delete(tok)
                                  return Array.from(cur)
                                })
                                if (nextChecked) setStatsExcludeTokens(prev => prev.filter(x => String(x || '').toLowerCase() !== tok))
                                return
                              }
                              setStatsExcludeTokens(prev => {
                                const cur = new Set(prev.map(s => String(s || '').toLowerCase()).filter(Boolean))
                                if (nextChecked) cur.delete(tok); else cur.add(tok)
                                return Array.from(cur)
                              })
                              if (!nextChecked) {
                                setStatsIncludeTokens(prev => prev.filter(x => String(x || '').toLowerCase() !== tok))
                              }
                            }}
                          />
                          <span className="truncate">{tok}</span>
                        </span>
                        <span className={`${UI_THEME_TOKENS.text.tertiary} shrink-0`}>{t.count}</span>
                      </label>
                    )
                  })}
                </div>
              </div>
            </div>
            )}
            {!chartCollapsed && (
              <div className="mt-2">
                <AutoHeightMiniBarChart
                  containerClassName="overflow-x-auto h-16"
                  minHeight={64}
                  width={getStatsChartWidthPx(tokensByGraphLayer.length)}
                  logicalWidth={getStatsChartWidthPx(tokensByGraphLayer.length)}
                  scrollToKey={scrollToGraphLayerId}
                  data={tokensByGraphLayer.map((row) => ({
                    key: row.graphLayerId,
                    value: row.totalTokens,
                    color: row.fill || undefined,
                    label: `Cluster layer ${row.label} • ${row.nodeCount} nodes • ${row.totalTokens} tokens`,
                    active: pinnedGraphLayerId === row.graphLayerId || selectedGraphLayerIdSet.has(row.graphLayerId),
                    onClick: () => {
                      if (pinnedGraphLayerId === row.graphLayerId) {
                        setPinnedGraphLayerId(null)
                        restoreSelectionSnapshot(graphLayerSelectionSnapshotRef.current)
                        graphLayerSelectionSnapshotRef.current = null
                        return
                      }
                      clearPinnedEdgeState()
                      clearPinnedCommunityState()
                      edgeSelectionSnapshotRef.current = null
                      communitySelectionSnapshotRef.current = null
                      if (!graphLayerSelectionSnapshotRef.current) {
                        graphLayerSelectionSnapshotRef.current = captureSelectionSnapshot()
                      }
                      selectNodeIds(row.nodeIds)
                      setPinnedGraphLayerId(row.graphLayerId)
                    },
                  }))}
                />
              </div>
            )}
            {(() => {
              const row = pinnedGraphLayerId ? tokensByGraphLayer.find(r => r.graphLayerId === pinnedGraphLayerId) || null : null
              const has = !!(row && row.topTokens.length > 0)
              const w = row ? Math.max(140, row.topTokens.length * 12) : 140
              return (
                <div className="mt-2 min-h-[72px]">
                  {!has ? null : (
                    <>
                      <div className={[uiPanelMicroLabelTextSizeClass, uiPanelTextFontClass, `${UI_THEME_TOKENS.text.primary} font-semibold`].join(' ')}>
                        Top tokens for {row!.label}
                      </div>
                      <AutoHeightMiniBarChart
                        containerClassName="mt-1 overflow-x-auto h-16"
                        minHeight={64}
                        width={w}
                        logicalWidth={w}
                        defaultBarColor={neutralBarColor}
                        data={row!.topTokens.map(t => ({
                          key: t.token,
                          value: t.count,
                          label: `${t.token} • ${t.count}`,
                        }))}
                      />
                    </>
                  )}
                </div>
              )
            })()}
            <div className={[uiPanelMicroLabelTextSizeClass, uiPanelTextFontClass, `mt-1 ${UI_THEME_TOKENS.text.tertiary}`].join(' ')}>
              {UI_COPY.statsBarHeightTotalTokensHint}
            </div>
          </div>
          {tokensByGraphLayer.slice(0, Math.min(tokensByGraphLayer.length, 6)).map((row) => (
            <div key={row.graphLayerId} className={statsPanelClassName}>
              <div className="flex items-center justify_between gap-2">
                <div className={[uiPanelKeyValueTextSizeClass, uiPanelTextFontClass, `font-semibold ${UI_THEME_TOKENS.text.primary}`].join(' ')}>
                  Cluster layer {row.label}
                </div>
                <div className={[uiPanelMicroLabelTextSizeClass, uiPanelTextFontClass, UI_THEME_TOKENS.text.tertiary].join(' ')}>
                  {row.nodeCount} nodes, {row.totalTokens} tokens
                </div>
              </div>
              {row.topTokens.length === 0 ? (
                <div className={[uiPanelMicroLabelTextSizeClass, uiPanelTextFontClass, `mt-2 ${UI_THEME_TOKENS.text.tertiary}`].join(' ')}>
                  {UI_COPY.statsNoTokensFoundForGraphLayerLabel}
                </div>
              ) : (
                <div className="mt-2 flex flex-wrap gap-1">
                  {row.topTokens.map(t => (
                    <span
                      key={t.token}
                      className={[
                        uiPanelMicroLabelTextSizeClass,
                        uiPanelTextFontClass,
                      statsTokenChipBaseClassName,
                        (() => {
                          const tok = String(t.token || '').toLowerCase()
                          const excluded = statsExcludeTokens.includes(tok)
                          const included = statsIncludeTokens.includes(tok)
                          if (statsFilterMode === 'include') {
                          return included ? statsTokenIncludedClassName : statsTokenInactiveIncludedClassName
                          }
                        return excluded ? statsTokenExcludedClassName : statsTokenDefaultClassName
                        })(),
                      ].join(' ')}
                      onClick={() => toggleStatsToken(t.token)}
                    >
                      <span className={uiPanelMonospaceTextClass}>{t.token}</span>
                      <span className={UI_THEME_TOKENS.text.tertiary}>{t.count}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </CollapsibleSection>
  )
}
