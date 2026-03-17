import React from 'react'
import TabHeader from '@/features/panels/ui/TabHeader'
import HeaderActions from '@/features/panels/ui/HeaderActions'
import { getBottomTabLabel, PANEL_MAX_RATIO } from '@/features/panels/config'
import { openBottomPanel, type BottomTab } from '@/features/bottom-panel/open'
import { DEFAULT_BOTTOM_PANEL_HEIGHT_RATIO } from '@/features/bottom-panel/constants'
import { History, Layers, MonitorPlay } from 'lucide-react'
import { UI_COPY } from '@/lib/config'

function toBottomTabFromHeaderKey(key: string): BottomTab | null {
  if (
    key === 'stats' ||
    key === 'render' ||
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
  startTransition: (fn: () => void) => void
  setTabStore: (tab: BottomTab) => void
  setBottomPanelHeightRatio: (v: number) => void
  setCollapsed: (next: boolean) => void
  searchOpen: boolean
  searchQuery: string
  setSearchQuery: (value: string) => void
  onToggleSearch: () => void
}

export default function BottomPanelHeader({
  collapsed,
  bottomPanelHeightRatio,
  tab,
  startTransition,
  setTabStore,
  setBottomPanelHeightRatio,
  setCollapsed,
  searchOpen,
  searchQuery,
  setSearchQuery,
  onToggleSearch,
}: BottomPanelHeaderProps) {
  const canSearch = !collapsed && tab === 'history'
  const applyAction = undefined
  const resetAction = undefined

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
        { key: 'stats', label: getBottomTabLabel('stats') },
        { key: 'render', label: getBottomTabLabel('render') },
        { key: 'history', label: getBottomTabLabel('history') },
      ]}
      tabVariant="icon"
      tabIconByKey={{
        stats: Layers,
        render: MonitorPlay,
        history: History,
      }}
      activeTab={tab}
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
      searchVisible={!collapsed && searchOpen && tab === 'history'}
      searchPlaceholder={
        tab === 'history' ? UI_COPY.searchHistoryPlaceholder : 'Search'
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
