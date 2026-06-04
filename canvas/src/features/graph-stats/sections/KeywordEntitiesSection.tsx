import React from 'react'
import CollapsibleSection from '@/features/panels/ui/CollapsibleSection'
import { AutoHeightMiniBarChart } from '@/features/panels/views/DatasetInspectorMiniViz'
import { UI_COPY } from '@/lib/config'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import type { StatsUiClasses } from '@/features/graph-stats/types'
import { STATS_MINI_CHART_MIN_HEIGHT_PX } from '@/features/graph-stats/statsMiniChart'
import { UI_RESPONSIVE_COMPACT_INLINE_CONTROL_CLASSNAME, UI_RESPONSIVE_STATS_MINI_CHART_SCROLL_CLASSNAME } from '@/lib/ui/responsiveElementClasses'

type KeywordNodeRow = {
  id: string
  label: string
  count: number
  color?: string
}

export default function KeywordEntitiesSection({
  ui,
  keywordNodes,
  selectedNodeIdSet,
  selectNodeIds,
}: {
  ui: StatsUiClasses
  keywordNodes: KeywordNodeRow[]
  selectedNodeIdSet: ReadonlySet<string>
  selectNodeIds: (nodeIds: string[]) => void
}) {
  const { uiPanelKeyValueTextSizeClass, uiPanelMicroLabelTextSizeClass, uiPanelTextFontClass } = ui
  const [chartCollapsed, setChartCollapsed] = React.useState(false)
  const scrollToId = React.useMemo(() => {
    if (!selectedNodeIdSet || selectedNodeIdSet.size === 0) return null
    for (const id of selectedNodeIdSet) return id
    return null
  }, [selectedNodeIdSet])

  return (
    <CollapsibleSection title={UI_COPY.statsKeywordNodesSectionTitle}>
      {keywordNodes.length === 0 ? (
        <section className={[uiPanelMicroLabelTextSizeClass, uiPanelTextFontClass, UI_THEME_TOKENS.text.secondary].join(' ')}>
          {UI_COPY.statsNoKeywordNodesLabel}
        </section>
      ) : (
        <section className={`mt-1 rounded border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} p-3`}>
          <section className="flex items-center justify-between gap-3">
            <section className={[uiPanelKeyValueTextSizeClass, uiPanelTextFontClass, 'font-semibold', UI_THEME_TOKENS.text.primary].join(' ')}>
              {UI_COPY.statsKeywordNodesTitle}
            </section>
            <button
              type="button"
              className={[
                uiPanelMicroLabelTextSizeClass,
                uiPanelTextFontClass,
                `${UI_RESPONSIVE_COMPACT_INLINE_CONTROL_CLASSNAME} rounded border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg}`,
              ].join(' ')}
              onClick={() => setChartCollapsed(prev => !prev)}
            >
              {chartCollapsed ? UI_COPY.statsShowChartLabel : UI_COPY.statsHideChartLabel}
            </button>
          </section>
          {!chartCollapsed && (
            <AutoHeightMiniBarChart
              containerClassName={`${UI_RESPONSIVE_STATS_MINI_CHART_SCROLL_CLASSNAME} mt-2`}
              minHeight={STATS_MINI_CHART_MIN_HEIGHT_PX}
              width={Math.max(160, keywordNodes.length * 6)}
              logicalWidth={Math.max(160, keywordNodes.length * 6)}
              scrollToKey={scrollToId}
              data={keywordNodes.map((n) => {
                const id = String(n.id)
                return {
                  key: id,
                  value: n.count,
                  label: `${String(n.label)} • ${String(n.count)}`,
                  color: typeof n.color === 'string' && n.color.trim() ? n.color.trim() : undefined,
                  active: selectedNodeIdSet ? selectedNodeIdSet.has(id) : false,
                  onClick: () => selectNodeIds([id]),
                }
              })}
            />
          )}
          <section className={[uiPanelMicroLabelTextSizeClass, uiPanelTextFontClass, 'mt-1', UI_THEME_TOKENS.text.tertiary].join(' ')}>
            {UI_COPY.statsKeywordNodesBarHeightHint}
          </section>
        </section>
      )}
    </CollapsibleSection>
  )
}
