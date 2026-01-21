import React from 'react'
import CollapsibleSection from '@/features/panels/ui/CollapsibleSection'
import { AutoHeightMiniBarChart } from '@/features/panels/views/DatasetInspectorMiniViz'
import { UI_COPY } from '@/lib/config'
import type { StatsUiClasses } from '@/components/BottomPanel/stats/types'

type KeywordNodeRow = {
  id: string
  label: string
  count: number
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
        <div className={[uiPanelMicroLabelTextSizeClass, uiPanelTextFontClass, 'text-gray-600'].join(' ')}>
          {UI_COPY.statsNoKeywordNodesLabel}
        </div>
      ) : (
        <div className="mt-1 rounded border border-gray-200 bg-white p-3">
          <div className="flex items-center justify-between gap-3">
            <div className={[uiPanelKeyValueTextSizeClass, uiPanelTextFontClass, 'font-semibold text-gray-800'].join(' ')}>
              {UI_COPY.statsKeywordNodesTitle}
            </div>
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
          {!chartCollapsed && (
            <AutoHeightMiniBarChart
              containerClassName="overflow-x-auto h-16 mt-2"
              minHeight={64}
              width={Math.max(160, keywordNodes.length * 6)}
              logicalWidth={Math.max(160, keywordNodes.length * 6)}
              scrollToKey={scrollToId}
              data={keywordNodes.map((n) => {
                const id = String(n.id)
                return {
                  key: id,
                  value: n.count,
                  label: `${String(n.label)} • ${String(n.count)}`,
                  active: selectedNodeIdSet ? selectedNodeIdSet.has(id) : false,
                  onClick: () => selectNodeIds([id]),
                }
              })}
            />
          )}
          <div className={[uiPanelMicroLabelTextSizeClass, uiPanelTextFontClass, 'mt-1 text-gray-500'].join(' ')}>
            {UI_COPY.statsKeywordNodesBarHeightHint}
          </div>
        </div>
      )}
    </CollapsibleSection>
  )
}
