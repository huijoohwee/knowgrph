import TabHeader from '@/features/panels/ui/TabHeader'
import HeaderActions from '@/features/panels/ui/HeaderActions'
import { getBottomTabLabel, PANEL_MAX_RATIO } from '@/features/panels/config'
import { openBottomPanel, type BottomTab } from '@/features/bottom-panel/open'
import { DEFAULT_BOTTOM_PANEL_HEIGHT_RATIO } from '@/features/bottom-panel/constants'
import { BarChart3, Database, FileCode, GitBranch, History, Layers, MonitorPlay } from 'lucide-react'
import { UI_COPY } from '@/lib/config'

function toBottomTabFromHeaderKey(key: string): BottomTab | null {
  if (
    key === 'curation' ||
    key === 'stats' ||
    key === 'parser' ||
    key === 'schema' ||
    key === 'orchestrator' ||
    key === 'render' ||
    key === 'settings' ||
    key === 'history'
  ) {
    return key
  }
  return null
}

type BottomPanelHeaderProps = {
  collapsed: boolean
  bottomPanelHeightRatio?: number
  tab: BottomTab
  isGraphJsonView: boolean
  startTransition: (fn: () => void) => void
  setTabStore: (tab: BottomTab) => void
  setBottomPanelHeightRatio: (v: number) => void
  setCollapsed: (next: boolean) => void
  searchOpen: boolean
  searchQuery: string
  setSearchQuery: (value: string) => void
  onToggleSearch: () => void
  onApply: () => void
  onApplyParser: () => void
  onApplySchema: () => void
  onRevert: () => void
  onResetParser: () => void
  onResetSchema: () => void
}

export default function BottomPanelHeader({
  collapsed,
  bottomPanelHeightRatio,
  tab,
  isGraphJsonView,
  startTransition,
  setTabStore,
  setBottomPanelHeightRatio,
  setCollapsed,
  searchOpen,
  searchQuery,
  setSearchQuery,
  onToggleSearch,
  onApply,
  onApplyParser,
  onApplySchema,
  onRevert,
  onResetParser,
  onResetSchema,
}: BottomPanelHeaderProps) {
  const canSearch =
    !collapsed &&
    (tab === 'curation' || tab === 'nodes' || tab === 'edges' || tab === 'history')
  const applyAction =
    !collapsed
      ? tab === 'curation' && isGraphJsonView
        ? onApply
        : tab === 'parser'
        ? onApplyParser
        : tab === 'schema'
        ? onApplySchema
        : undefined
      : undefined
  const resetAction =
    !collapsed
      ? tab === 'curation' && isGraphJsonView
        ? onRevert
        : tab === 'parser'
        ? onResetParser
        : tab === 'schema'
        ? onResetSchema
        : undefined
      : undefined

  return (
    <TabHeader
      collapsed={collapsed}
      onToggle={() => {
        if (collapsed) {
          setBottomPanelHeightRatio(DEFAULT_BOTTOM_PANEL_HEIGHT_RATIO)
          setCollapsed(false)
        } else {
          setCollapsed(true)
        }
      }}
      onHeaderDoubleClick={() => {
        if (collapsed) {
          setBottomPanelHeightRatio(PANEL_MAX_RATIO)
          setCollapsed(false)
        } else {
          if (bottomPanelHeightRatio >= PANEL_MAX_RATIO - 0.05) {
            setBottomPanelHeightRatio(DEFAULT_BOTTOM_PANEL_HEIGHT_RATIO)
            setCollapsed(true)
            return
          }
          setBottomPanelHeightRatio(PANEL_MAX_RATIO)
        }
      }}
      tabs={[
        { key: 'curation', label: getBottomTabLabel('curation') },
        { key: 'stats', label: getBottomTabLabel('stats') },
        { key: 'parser', label: getBottomTabLabel('parser') },
        { key: 'schema', label: getBottomTabLabel('schema') },
        { key: 'orchestrator', label: getBottomTabLabel('orchestrator') },
        { key: 'render', label: getBottomTabLabel('render') },
        { key: 'history', label: getBottomTabLabel('history') },
      ]}
      tabVariant="icon"
      tabIconByKey={{
        curation: BarChart3,
        stats: Layers,
        parser: FileCode,
        schema: Database,
        orchestrator: GitBranch,
        render: MonitorPlay,
        history: History,
      }}
      activeTab={tab === 'code' || tab === 'curation' || tab === 'nodes' || tab === 'edges' ? 'curation' : tab}
      onTabChange={(key) => {
        const nextTab = toBottomTabFromHeaderKey(key)
        if (!nextTab) return
        if (nextTab === 'render') {
          openBottomPanel('render')
          return
        }
        startTransition(() => {
          if (collapsed) {
            setBottomPanelHeightRatio(DEFAULT_BOTTOM_PANEL_HEIGHT_RATIO)
            setCollapsed(false)
          }
          setTabStore(nextTab)
        })
      }}
      searchVisible={!collapsed && searchOpen && (tab === 'curation' || tab === 'nodes' || tab === 'edges' || tab === 'history')}
      searchPlaceholder={
        tab === 'curation'
          ? UI_COPY.searchGraphPlaceholder
          : tab === 'nodes'
          ? UI_COPY.searchNodesPlaceholder
          : tab === 'edges'
          ? UI_COPY.searchEdgesPlaceholder
          : tab === 'history'
          ? UI_COPY.searchHistoryPlaceholder
          : 'Search'
      }
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      rightSlot={
        <HeaderActions
          onSearchToggle={canSearch ? onToggleSearch : undefined}
          onApply={applyAction}
          onReset={resetAction}
          onRestore={
            collapsed
              ? () => {
                  setBottomPanelHeightRatio(DEFAULT_BOTTOM_PANEL_HEIGHT_RATIO)
                  setCollapsed(false)
                }
              : undefined
          }
          onMinimize={!collapsed ? () => setCollapsed(true) : undefined}
          applyDisabled={!applyAction}
          resetDisabled={!resetAction}
        />
      }
    />
  )
}
