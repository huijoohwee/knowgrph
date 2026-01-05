import React from 'react'
import CollapsibleSection from '@/features/panels/ui/CollapsibleSection'
import { AutoHeightMiniBarChart } from '@/features/panels/views/DatasetInspectorMiniViz'
import IconButton from '@/components/IconButton'
import { SlidersHorizontal } from 'lucide-react'
import { emitRendererPanelOpen } from '@/features/canvas/utils'
import { UI_COPY } from '@/lib/config-copy/uiCopy'
import type { SelectionSnapshot, StatsUiClasses, TokenCount, TokensByPolygonRow } from '@/components/BottomPanel/stats/types'

export default function PolygonWordFrequenciesSection({
  ui,
  neutralBarColor,
  selectedNodeIdSet,
  tokensByPolygon,
  polygonTokensForDropdown,
  polygonTokenFilter,
  setPolygonTokenFilter,
  polygonTokenSort,
  setPolygonTokenSort,
  statsFilterMode,
  setStatsFilterMode,
  statsExcludeTokens,
  setStatsExcludeTokens,
  statsIncludeTokens,
  setStatsIncludeTokens,
  toggleStatsToken,
  getStatsChartWidthPx,
  pinnedPolygonId,
  setPinnedPolygonId,
  clearPinnedEdgeState,
  clearPinnedCommunityState,
  polygonSelectionSnapshotRef,
  edgeSelectionSnapshotRef,
  communitySelectionSnapshotRef,
  captureSelectionSnapshot,
  restoreSelectionSnapshot,
  selectNodeIds,
}: {
  ui: StatsUiClasses
  neutralBarColor: string
  selectedNodeIdSet: ReadonlySet<string>
  tokensByPolygon: TokensByPolygonRow[]
  polygonTokensForDropdown: TokenCount[]
  polygonTokenFilter: string
  setPolygonTokenFilter: (next: string) => void
  polygonTokenSort: 'freq' | 'alpha'
  setPolygonTokenSort: (next: 'freq' | 'alpha') => void
  statsFilterMode: 'exclude' | 'include'
  setStatsFilterMode: (next: 'exclude' | 'include') => void
  statsExcludeTokens: string[]
  setStatsExcludeTokens: React.Dispatch<React.SetStateAction<string[]>>
  statsIncludeTokens: string[]
  setStatsIncludeTokens: React.Dispatch<React.SetStateAction<string[]>>
  toggleStatsToken: (token: string) => void
  getStatsChartWidthPx: (barCount: number) => number
  pinnedPolygonId: string | null
  setPinnedPolygonId: (next: string | null) => void
  clearPinnedEdgeState: () => void
  clearPinnedCommunityState: () => void
  polygonSelectionSnapshotRef: React.MutableRefObject<SelectionSnapshot | null>
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
  const selectedPolygonIdSet = React.useMemo(() => {
    const next = new Set<string>()
    if (!selectedNodeIdSet || selectedNodeIdSet.size === 0) return next
    for (let i = 0; i < tokensByPolygon.length; i += 1) {
      const row = tokensByPolygon[i]
      const ids = row && Array.isArray(row.nodeIds) ? row.nodeIds : []
      for (let j = 0; j < ids.length; j += 1) {
        const id = String(ids[j] || '')
        if (!id) continue
        if (!selectedNodeIdSet.has(id)) continue
        next.add(row.polygonId)
        break
      }
    }
    return next
  }, [selectedNodeIdSet, tokensByPolygon])
  const scrollToPolygonId = React.useMemo(() => {
    if (pinnedPolygonId) return pinnedPolygonId
    if (selectedPolygonIdSet.size === 0) return null
    const row = tokensByPolygon.find(r => selectedPolygonIdSet.has(r.polygonId)) || null
    return row ? row.polygonId : null
  }, [pinnedPolygonId, selectedPolygonIdSet, tokensByPolygon])

  return (
    <CollapsibleSection title="Word frequencies by polygon">
      {tokensByPolygon.length === 0 ? (
        <div className={[uiPanelMicroLabelTextSizeClass, uiPanelTextFontClass, 'text-gray-600'].join(' ')}>
          {UI_COPY.statsNoNodesAvailableLabel}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="rounded border border-gray-200 bg-white p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-1">
                <div className={[uiPanelKeyValueTextSizeClass, uiPanelTextFontClass, 'font-semibold text-gray-800'].join(' ')}>
                  Polygon
                </div>
                <IconButton
                  className="App-toolbar__btn"
                  title={UI_COPY.statsOpenRendererSettingsForPolygonsTitle}
                  onClick={emitRendererPanelOpen}
                  showTooltip
                >
                  <SlidersHorizontal className="w-3 h-3" />
                </IconButton>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  className={[
                    uiPanelMicroLabelTextSizeClass,
                    uiPanelTextFontClass,
                    'px-2 py-[2px] rounded border border-gray-200',
                  ].join(' ')}
                  placeholder={UI_COPY.statsFilterTokensPlaceholder}
                  value={polygonTokenFilter}
                  onChange={e => setPolygonTokenFilter(e.target.value)}
                />
                <select
                  className={[
                    uiPanelMicroLabelTextSizeClass,
                    uiPanelTextFontClass,
                    'px-2 py-[2px] rounded border border-gray-200 bg-white',
                  ].join(' ')}
                  value={polygonTokenSort}
                  onChange={e => {
                    const raw = e.target.value === 'alpha' ? 'alpha' : 'freq'
                    setPolygonTokenSort(raw)
                  }}
                >
                  <option value="freq">{UI_COPY.statsSortByCountLabel}</option>
                  <option value="alpha">{UI_COPY.statsSortAzLabel}</option>
                </select>
                <div className="inline-flex rounded border border-gray-200 overflow-hidden bg-white">
                  <button
                    type="button"
                    className={[
                      uiPanelMicroLabelTextSizeClass,
                      uiPanelTextFontClass,
                      'px-2 py-[2px]',
                      statsFilterMode === 'exclude'
                        ? 'bg-gray-100 text-gray-800'
                        : 'bg-white text-gray-500 hover:bg-gray-50',
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
                      'px-2 py-[2px] border-l border-gray-200',
                      statsFilterMode === 'include'
                        ? 'bg-gray-100 text-gray-800'
                        : 'bg-white text-gray-500 hover:bg-gray-50',
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
                    'px-2 py-[2px] rounded border border-gray-200 bg-white',
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
                    'px-2 py-[2px] rounded border border-gray-200 bg-white',
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
                  'w-full rounded border border-gray-200 bg-white max-h-40 overflow-y-auto',
                ].join(' ')}
              >
                {(() => {
                  const norm = (v: unknown) => String(v || '').toLowerCase()
                  const all = polygonTokensForDropdown.map(t => norm(t.token)).filter(Boolean)
                  const allSet = new Set(all)
                  const allSelected =
                    all.length > 0 &&
                    (statsFilterMode === 'include'
                      ? all.every(t => statsIncludeTokens.includes(t))
                      : all.every(t => !statsExcludeTokens.includes(t)))
                  return (
                    <label className="flex items-center justify-between gap-3 px-2 pt-2 pb-1 border-b border-gray-100 sticky top-0 z-10 bg-white">
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
                      <span className="text-gray-400">{String(all.length)}</span>
                    </label>
                  )
                })()}
                <div className="px-2 pb-2">
                  {polygonTokensForDropdown.map((t) => {
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
                              if (!nextChecked) setStatsIncludeTokens(prev => prev.filter(x => String(x || '').toLowerCase() !== tok))
                            }}
                          />
                          <span className="truncate">{tok}</span>
                        </span>
                        <span className="text-gray-500 shrink-0">{t.count}</span>
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
                  width={getStatsChartWidthPx(tokensByPolygon.length)}
                  logicalWidth={getStatsChartWidthPx(tokensByPolygon.length)}
                  scrollToKey={scrollToPolygonId}
                  data={tokensByPolygon.map((row) => ({
                    key: row.polygonId,
                    value: row.totalTokens,
                    color: row.fill || undefined,
                    label: `Polygon ${row.label} • ${row.nodeCount} nodes • ${row.totalTokens} tokens`,
                    active: pinnedPolygonId === row.polygonId || selectedPolygonIdSet.has(row.polygonId),
                    onClick: () => {
                      if (pinnedPolygonId === row.polygonId) {
                        setPinnedPolygonId(null)
                        restoreSelectionSnapshot(polygonSelectionSnapshotRef.current)
                        polygonSelectionSnapshotRef.current = null
                        return
                      }
                      clearPinnedEdgeState()
                      clearPinnedCommunityState()
                      edgeSelectionSnapshotRef.current = null
                      communitySelectionSnapshotRef.current = null
                      if (!polygonSelectionSnapshotRef.current) {
                        polygonSelectionSnapshotRef.current = captureSelectionSnapshot()
                      }
                      selectNodeIds(row.nodeIds)
                      setPinnedPolygonId(row.polygonId)
                    },
                  }))}
                />
              </div>
            )}
            {(() => {
              const row = pinnedPolygonId ? tokensByPolygon.find(r => r.polygonId === pinnedPolygonId) || null : null
              const has = !!(row && row.topTokens.length > 0)
              const w = row ? Math.max(140, row.topTokens.length * 12) : 140
              return (
                <div className="mt-2 min-h-[72px]">
                  {!has ? null : (
                    <>
                      <div className={[uiPanelMicroLabelTextSizeClass, uiPanelTextFontClass, 'text-gray-700 font-semibold'].join(' ')}>
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
            <div className={[uiPanelMicroLabelTextSizeClass, uiPanelTextFontClass, 'mt-1 text-gray-500'].join(' ')}>
              {UI_COPY.statsBarHeightTotalTokensHint}
            </div>
          </div>
          {tokensByPolygon.slice(0, Math.min(tokensByPolygon.length, 6)).map((row) => (
            <div key={row.polygonId} className="rounded border border-gray-200 bg-white p-3">
              <div className="flex items-center justify-between gap-2">
                <div className={[uiPanelKeyValueTextSizeClass, uiPanelTextFontClass, 'font-semibold text-gray-800'].join(' ')}>
                  Polygon {row.label}
                </div>
                <div className={[uiPanelMicroLabelTextSizeClass, uiPanelTextFontClass, 'text-gray-500'].join(' ')}>
                  {row.nodeCount} nodes, {row.totalTokens} tokens
                </div>
              </div>
              {row.topTokens.length === 0 ? (
                <div className={[uiPanelMicroLabelTextSizeClass, uiPanelTextFontClass, 'mt-2 text-gray-500'].join(' ')}>
                  {UI_COPY.statsNoTokensFoundForPolygonLabel}
                </div>
              ) : (
                <div className="mt-2 flex flex-wrap gap-1">
                  {row.topTokens.map(t => (
                    <span
                      key={t.token}
                      className={[
                        uiPanelMicroLabelTextSizeClass,
                        uiPanelTextFontClass,
                        'inline-flex items-center gap-1 px-2 py-[2px] rounded border border-gray-200 cursor-pointer',
                        (() => {
                          const tok = String(t.token || '').toLowerCase()
                          const excluded = statsExcludeTokens.includes(tok)
                          const included = statsIncludeTokens.includes(tok)
                          if (statsFilterMode === 'include') {
                            return included ? 'bg-blue-50 text-gray-700 border-blue-200' : 'bg-gray-50 text-gray-400'
                          }
                          return excluded ? 'bg-red-50 text-gray-400 border-red-200 line-through' : 'bg-gray-50 text-gray-700'
                        })(),
                      ].join(' ')}
                      onClick={() => toggleStatsToken(t.token)}
                    >
                      <span className={uiPanelMonospaceTextClass}>{t.token}</span>
                      <span className="text-gray-500">{t.count}</span>
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
