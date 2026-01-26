import React from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'
import MainPanelContainer from './MainPanelContainer'
import TabHeader, { type TabIconComponent } from './TabHeader'

interface MainPanelFrameProps {
  collapsed?: boolean
  onToggle?: () => void
  onDragStart?: (ev: React.PointerEvent<HTMLDivElement>) => void
  searchVisible?: boolean
  searchPlaceholder?: string
  searchQuery?: string
  onSearchChange?: (q: string) => void
  rightSlot?: React.ReactNode
  children: React.ReactNode
  tabs?: Array<{ key: string; label: string }>
  activeTab?: string
  onTabChange?: (key: string) => void
  footer?: React.ReactNode
  tabVariant?: 'text' | 'icon'
  tabIconByKey?: Partial<Record<string, TabIconComponent>>
}

export default function MainPanelFrame({
  collapsed,
  onToggle,
  onDragStart,
  searchVisible,
  searchPlaceholder,
  searchQuery,
  onSearchChange,
  rightSlot,
  children,
  tabs = [],
  activeTab,
  onTabChange,
  footer,
  tabVariant,
  tabIconByKey,
}: MainPanelFrameProps) {
  const uiHeaderRowHeightClass = useGraphStore(
    s => s.uiHeaderRowHeightClass || 'min-h-[36px]',
  )
  const uiHeaderRowPaddingClass = useGraphStore(
    s => s.uiHeaderRowPaddingClass || 'py-1',
  )

  return (
    <MainPanelContainer className={collapsed ? 'h-auto' : 'h-full'}>
      <div className="flex h-full flex-col">
        <TabHeader
          collapsed={collapsed}
          onToggle={onToggle}
          onDragStart={onDragStart}
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={onTabChange}
          searchVisible={searchVisible}
          searchPlaceholder={searchPlaceholder}
          searchQuery={searchQuery}
          onSearchChange={onSearchChange}
          rightSlot={rightSlot}
          tabVariant={tabVariant}
          tabIconByKey={tabIconByKey}
        />
        {!collapsed && (
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <div className="flex-1 min-h-0 overflow-auto">
              {children}
            </div>
            {footer ? (
              <div
                className={[
                  'FooterBar border-t border-gray-200',
                  uiHeaderRowHeightClass,
                  uiHeaderRowPaddingClass,
                ].join(' ')}
              >
                {footer}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </MainPanelContainer>
  )
}
