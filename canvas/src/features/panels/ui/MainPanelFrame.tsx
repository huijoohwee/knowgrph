import React from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'
import MainPanelContainer from './MainPanelContainer'
import TabHeader, { type TabIconComponent } from './TabHeader'

interface MainPanelFrameProps {
  ariaLabel: string
  collapsed?: boolean
  onToggle?: () => void
  onDragStart?: (ev: React.PointerEvent<HTMLElement>) => void
  searchVisible?: boolean
  searchPlaceholder?: string
  searchQuery?: string
  onSearchChange?: (q: string) => void
  rightSlot?: React.ReactNode
  children: React.ReactNode
  tabs?: Array<{ key: string; label: string }>
  activeTab?: string
  onTabChange?: (key: string) => void
  tabIdBase?: string
  footer?: React.ReactNode
  tabVariant?: 'text' | 'icon'
  tabIconByKey?: Partial<Record<string, TabIconComponent>>
}

export default function MainPanelFrame({
  ariaLabel,
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
  tabIdBase,
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
    <MainPanelContainer ariaLabel={ariaLabel} className={collapsed ? 'h-auto' : 'h-full'}>
      <section className="flex h-full flex-col" aria-label={ariaLabel}>
        <TabHeader
          collapsed={collapsed}
          onToggle={onToggle}
          onDragStart={onDragStart}
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={onTabChange}
          tabIdBase={tabIdBase}
          searchVisible={searchVisible}
          searchPlaceholder={searchPlaceholder}
          searchQuery={searchQuery}
          onSearchChange={onSearchChange}
          rightSlot={rightSlot}
          tabVariant={tabVariant}
          tabIconByKey={tabIconByKey}
        />
        {!collapsed && (
          <section className="flex-1 min-h-0 flex flex-col overflow-hidden" aria-label="Panel content">
            <main className="flex-1 min-h-0 overflow-auto">
              {children}
            </main>
            {footer ? (
              <footer
                className={[
                  'FooterBar border-t border-gray-200',
                  uiHeaderRowHeightClass,
                  uiHeaderRowPaddingClass,
                ].join(' ')}
              >
                {footer}
              </footer>
            ) : null}
          </section>
        )}
      </section>
    </MainPanelContainer>
  )
}
