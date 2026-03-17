import React from 'react'
import CollapsibleSection from '@/features/panels/ui/CollapsibleSection'
import { AutoHeightMiniBarChart } from '@/features/panels/views/DatasetInspectorMiniViz'
import IconButton from '@/components/IconButton'
import { SlidersHorizontal } from 'lucide-react'
import { emitRendererPanelOpen } from '@/features/canvas/utils'
import { UI_COPY } from '@/lib/config'
import type { SelectionSnapshot, StatsCommunity, StatsUiClasses, TokenCount } from '@/components/BottomPanel/stats/types'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'

export default function CommunitiesStatsSection({
  ui,
  neutralBarColor,
  selectedNodeIdSet,
  communities,
  communityTokensForDropdown,
  communityTokenFilter,
  setCommunityTokenFilter,
  communityTokenSort,
  setCommunityTokenSort,
  statsFilterMode,
  setStatsFilterMode,
  statsExcludeTokens,
  setStatsExcludeTokens,
  statsIncludeTokens,
  setStatsIncludeTokens,
  toggleStatsToken,
  pinnedCommunityId,
  setPinnedCommunityId,
  clearPinnedEdgeState,
  communitySelectionSnapshotRef,
  edgeSelectionSnapshotRef,
  captureSelectionSnapshot,
  restoreSelectionSnapshot,
  selectNodeIds,
  getStatsChartWidthPx,
}: {
  ui: StatsUiClasses
  neutralBarColor: string
  selectedNodeIdSet: ReadonlySet<string>
  communities: StatsCommunity[]
  communityTokensForDropdown: TokenCount[]
  communityTokenFilter: string
  setCommunityTokenFilter: (next: string) => void
  communityTokenSort: 'freq' | 'alpha'
  setCommunityTokenSort: (next: 'freq' | 'alpha') => void
  statsFilterMode: 'exclude' | 'include'
  setStatsFilterMode: (next: 'exclude' | 'include') => void
  statsExcludeTokens: string[]
  setStatsExcludeTokens: React.Dispatch<React.SetStateAction<string[]>>
  statsIncludeTokens: string[]
  setStatsIncludeTokens: React.Dispatch<React.SetStateAction<string[]>>
  toggleStatsToken: (token: string) => void
  pinnedCommunityId: number | null
  setPinnedCommunityId: (next: number | null) => void
  clearPinnedEdgeState: () => void
  communitySelectionSnapshotRef: React.MutableRefObject<SelectionSnapshot | null>
  edgeSelectionSnapshotRef: React.MutableRefObject<SelectionSnapshot | null>
  captureSelectionSnapshot: () => SelectionSnapshot
  restoreSelectionSnapshot: (snap: SelectionSnapshot | null) => void
  selectNodeIds: (nodeIds: string[]) => void
  getStatsChartWidthPx: (barCount: number) => number
}) {
  const {
    uiPanelMonospaceTextClass,
    uiPanelKeyValueTextSizeClass,
    uiPanelMicroLabelTextSizeClass,
    uiPanelTextFontClass,
  } = ui
  const [tokensCollapsed, setTokensCollapsed] = React.useState(false)
  const [chartCollapsed, setChartCollapsed] = React.useState(false)
  const selectedCommunityIdSet = React.useMemo(() => {
    const next = new Set<number>()
    if (!selectedNodeIdSet || selectedNodeIdSet.size === 0) return next
    for (let i = 0; i < communities.length; i += 1) {
      const c = communities[i]
      const ids = c && Array.isArray(c.nodeIds) ? c.nodeIds : []
      for (let j = 0; j < ids.length; j += 1) {
        const id = String(ids[j] || '')
        if (!id) continue
        if (!selectedNodeIdSet.has(id)) continue
        next.add(c.id)
        break
      }
    }
    return next
  }, [communities, selectedNodeIdSet])
  const scrollToCommunityKey = React.useMemo(() => {
    if (pinnedCommunityId != null) return String(pinnedCommunityId)
    if (selectedCommunityIdSet.size === 0) return null
    const match = communities.find(c => selectedCommunityIdSet.has(c.id)) || null
    return match ? String(match.id) : null
  }, [communities, pinnedCommunityId, selectedCommunityIdSet])

  return (
    <CollapsibleSection title="Clusters">
      {communities.length === 0 ? (
        <div className={[uiPanelMicroLabelTextSizeClass, uiPanelTextFontClass, UI_THEME_TOKENS.text.secondary].join(' ')}>
          No clusters detected.
        </div>
      ) : (
        <div className={`rounded border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} overflow-hidden`}>
          <div
            className={[
              uiPanelKeyValueTextSizeClass,
              uiPanelTextFontClass,
              'px-3 py-2 font-semibold flex items-center justify-between gap-3 border-b',
              UI_THEME_TOKENS.panel.divider,
              UI_THEME_TOKENS.text.primary,
            ].join(' ')}
          >
            <div className="flex items-center gap-1">
              <span>Cluster sizes</span>
              <IconButton
                className="App-toolbar__btn"
                title={UI_COPY.statsOpenRendererSettingsForCommunitiesTitle}
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
                  `px-2 py-[2px] rounded border ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.input.bg} ${UI_THEME_TOKENS.input.text}`,
                ].join(' ')}
                placeholder={UI_COPY.statsFilterTokensPlaceholder}
                value={communityTokenFilter}
                onChange={e => setCommunityTokenFilter(e.target.value)}
              />
              <select
                className={[
                  uiPanelMicroLabelTextSizeClass,
                  uiPanelTextFontClass,
                  `px-2 py-[2px] rounded border ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.input.bg} ${UI_THEME_TOKENS.input.text}`,
                ].join(' ')}
                value={communityTokenSort}
                onChange={e => {
                  const raw = e.target.value === 'alpha' ? 'alpha' : 'freq'
                  setCommunityTokenSort(raw)
                }}
              >
                <option value="freq">{UI_COPY.statsSortByCountLabel}</option>
                <option value="alpha">{UI_COPY.statsSortAzLabel}</option>
              </select>
              <div className={`inline-flex rounded border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} overflow-hidden`}>
                <button
                  type="button"
                  className={[
                    uiPanelMicroLabelTextSizeClass,
                    uiPanelTextFontClass,
                    'px-2 py-[2px]',
                    statsFilterMode === 'exclude'
                      ? `${UI_THEME_TOKENS.button.activeBg} ${UI_THEME_TOKENS.button.activeText}`
                      : `${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`,
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
                      ? `${UI_THEME_TOKENS.button.activeBg} ${UI_THEME_TOKENS.button.activeText}`
                      : `${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`,
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
                  `px-2 py-[2px] rounded border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg}`,
                  UI_THEME_TOKENS.button.text,
                  UI_THEME_TOKENS.button.hoverBg,
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
                  `px-2 py-[2px] rounded border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg}`,
                  UI_THEME_TOKENS.button.text,
                  UI_THEME_TOKENS.button.hoverBg,
                ].join(' ')}
                onClick={() => setChartCollapsed(prev => !prev)}
              >
                {chartCollapsed ? UI_COPY.statsShowChartLabel : UI_COPY.statsHideChartLabel}
              </button>
            </div>
          </div>
          {!tokensCollapsed && (
          <div className={`px-3 py-2 border-b ${UI_THEME_TOKENS.panel.divider}`}>
            <div
              className={[
                uiPanelMicroLabelTextSizeClass,
                uiPanelTextFontClass,
                `w-full rounded border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} max-h-40 overflow-y-auto`,
              ].join(' ')}
            >
              {(() => {
                const norm = (v: unknown) => String(v || '').toLowerCase()
                const all = communityTokensForDropdown.map(t => norm(t.token)).filter(Boolean)
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
                {communityTokensForDropdown.map((t) => {
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
                      <span className={`${UI_THEME_TOKENS.text.tertiary} shrink-0`}>{t.count}</span>
                    </label>
                  )
                })}
              </div>
            </div>
          </div>
          )}
          {!chartCollapsed && (
            <div className="px-3 py-2">
              <AutoHeightMiniBarChart
                containerClassName="overflow-x-auto h-16"
                minHeight={64}
                width={getStatsChartWidthPx(communities.length)}
                logicalWidth={getStatsChartWidthPx(communities.length)}
                scrollToKey={scrollToCommunityKey}
                data={communities.map((c) => ({
                  key: String(c.id),
                  value: c.count,
                  color: c.fill || undefined,
                  label: `${c.name} • ${c.count} nodes${c.description ? ` • ${c.description}` : ''}`,
                  active: pinnedCommunityId === c.id || selectedCommunityIdSet.has(c.id),
                  onClick: () => {
                    if (pinnedCommunityId === c.id) {
                      setPinnedCommunityId(null)
                      restoreSelectionSnapshot(communitySelectionSnapshotRef.current)
                      communitySelectionSnapshotRef.current = null
                      return
                    }
                    clearPinnedEdgeState()
                    edgeSelectionSnapshotRef.current = null
                    if (!communitySelectionSnapshotRef.current) {
                      communitySelectionSnapshotRef.current = captureSelectionSnapshot()
                    }
                    selectNodeIds(c.nodeIds)
                    setPinnedCommunityId(c.id)
                  },
                }))}
              />
              <div className="mt-2 min-h-[72px]">
                {(() => {
                  if (pinnedCommunityId == null) return null
                  const c = communities.find(x => x.id === pinnedCommunityId) || null
                  if (!c || !Array.isArray(c.topTokens) || c.topTokens.length === 0) return null
                  const w = Math.max(140, c.topTokens.length * 12)
                  return (
                    <>
                      <div className={[uiPanelMicroLabelTextSizeClass, uiPanelTextFontClass, 'font-semibold', UI_THEME_TOKENS.text.primary].join(' ')}>
                        Top tokens for {c.name}
                      </div>
                      <AutoHeightMiniBarChart
                        containerClassName="mt-1 overflow-x-auto h-16"
                        minHeight={64}
                        width={w}
                        logicalWidth={w}
                        defaultBarColor={neutralBarColor}
                        data={c.topTokens.map(t => ({
                          key: t.token,
                          value: t.count,
                          label: `${t.token} • ${t.count}`,
                        }))}
                      />
                    </>
                  )
                })()}
              </div>
            </div>
          )}
          <div className="divide-y divide-[color:var(--kg-divider)]">
            {communities.slice(0, Math.min(communities.length, 20)).map((c) => (
              <div key={String(c.id)} className="px-3 py-2 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`inline-block w-3 h-3 rounded border ${UI_THEME_TOKENS.panel.border}`}
                      style={{ backgroundColor: c.fill }}
                    />
                    <div className={[uiPanelMicroLabelTextSizeClass, uiPanelTextFontClass, UI_THEME_TOKENS.text.primary, 'truncate'].join(' ')}>
                      {c.name}{' '}
                      <span className={uiPanelMonospaceTextClass}>
                        {String(c.id)}
                      </span>
                    </div>
                  </div>
                  {c.description ? (
                    <div className={[uiPanelMicroLabelTextSizeClass, uiPanelTextFontClass, 'mt-0.5', UI_THEME_TOKENS.text.tertiary, 'truncate'].join(' ')}>
                      {c.description}
                    </div>
                  ) : null}
                  {Array.isArray(c.topTokens) && c.topTokens.length > 0 ? (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {c.topTokens.slice(0, 6).map(t => (
                        <span
                          key={t.token}
                          className={[
                            uiPanelMicroLabelTextSizeClass,
                            uiPanelTextFontClass,
                            `inline-flex items-center gap-1 px-2 py-[2px] rounded border ${UI_THEME_TOKENS.panel.border} cursor-pointer`,
                            (() => {
                              const tok = String(t.token || '').toLowerCase()
                              const excluded = statsExcludeTokens.includes(tok)
                              const included = statsIncludeTokens.includes(tok)
                              if (statsFilterMode === 'include') {
                                return included
                                  ? `${UI_THEME_TOKENS.button.activeBg} ${UI_THEME_TOKENS.text.primary}`
                                  : `${UI_THEME_TOKENS.button.hoverBg} ${UI_THEME_TOKENS.text.tertiary}`
                              }
                              return excluded
                                ? `bg-red-50 dark:bg-red-900/20 ${UI_THEME_TOKENS.text.tertiary} border-red-200 dark:border-red-800 line-through`
                                : `${UI_THEME_TOKENS.button.hoverBg} ${UI_THEME_TOKENS.text.primary}`
                            })(),
                          ].join(' ')}
                          onClick={() => toggleStatsToken(t.token)}
                        >
                          <span className={uiPanelMonospaceTextClass}>{t.token}</span>
                          <span className={UI_THEME_TOKENS.text.tertiary}>{t.count}</span>
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className={[uiPanelKeyValueTextSizeClass, uiPanelTextFontClass, 'font-semibold', UI_THEME_TOKENS.text.primary].join(' ')}>
                  {String(c.count)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </CollapsibleSection>
  )
}
