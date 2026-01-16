import React from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'
import IconButton from '@/components/IconButton'
import { getIconSizeClass } from '@/lib/ui'
import { UI_SELECTORS } from '@/lib/config'
import {
  uiPrimaryPillActiveClassName,
  uiToolbarToggleActiveClassName,
  uiPrimaryIconInactiveClassName,
} from '@/features/graph-data-table/ui/GraphDataTableToolbarStyles'

type Tab = { key: string; label: string }

export type TabIconComponent = React.ComponentType<{
  className?: string
  strokeWidth?: number | string
  'aria-hidden'?: boolean | 'true' | 'false'
}>

interface TabHeaderProps {
  collapsed?: boolean
  onToggle?: () => void
  onHeaderDoubleClick?: () => void
  onDragStart?: (ev: React.PointerEvent<HTMLDivElement>) => void
  tabs?: Tab[]
  activeTab?: string
  onTabChange?: (key: string) => void
  searchVisible?: boolean
  searchPlaceholder?: string
  searchQuery?: string
  onSearchChange?: (q: string) => void
  rightSlot?: React.ReactNode
  tabVariant?: 'text' | 'icon'
  tabIconByKey?: Partial<Record<string, TabIconComponent>>
}

function TabHeaderImpl({
  collapsed,
  onToggle,
  onHeaderDoubleClick,
  onDragStart,
  tabs = [],
  activeTab,
  onTabChange,
  searchVisible,
  searchPlaceholder,
  searchQuery,
  onSearchChange,
  rightSlot,
  tabVariant = 'text',
  tabIconByKey,
}: TabHeaderProps) {
  const clickTimeoutRef = React.useRef<number | null>(null)
  const uiHeaderRowHeightClass = useGraphStore(
    s => s.uiHeaderRowHeightClass || 'min-h-[36px]',
  )
  const uiHeaderRowPaddingClass = useGraphStore(
    s => s.uiHeaderRowPaddingClass || 'py-1',
  )
  const uiIconScale = useGraphStore(s => s.uiIconScale)
  const uiIconStrokeWidth = useGraphStore(s => s.uiIconStrokeWidth)
  const iconSizeClass = getIconSizeClass(uiIconScale)

  React.useEffect(() => {
    return () => {
      if (clickTimeoutRef.current !== null) {
        window.clearTimeout(clickTimeoutRef.current)
        clickTimeoutRef.current = null
      }
    }
  }, [])

  const onHeaderClick = React.useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!onToggle) return
    const el = e.target as Element
    if (el.closest(UI_SELECTORS.draggablePanelIgnorePointerDown)) return
    if (clickTimeoutRef.current !== null) {
      window.clearTimeout(clickTimeoutRef.current)
      clickTimeoutRef.current = null
    }
    clickTimeoutRef.current = window.setTimeout(() => {
      clickTimeoutRef.current = null
      onToggle()
    }, 200)
  }, [onToggle])

  const handleDoubleClick = React.useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!onHeaderDoubleClick) return
    const el = e.target as Element
    if (el.closest(UI_SELECTORS.draggablePanelIgnorePointerDown)) return
    if (clickTimeoutRef.current !== null) {
      window.clearTimeout(clickTimeoutRef.current)
      clickTimeoutRef.current = null
    }
    try {
      const sel = window.getSelection?.()
      if (sel && sel.type === 'Range') sel.removeAllRanges()
    } catch {
      void 0
    }
    e.preventDefault()
    onHeaderDoubleClick()
  }, [onHeaderDoubleClick])

  const handlePointerDown = React.useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!onDragStart) return
    const el = e.target as Element
    if (el.closest(UI_SELECTORS.draggablePanelIgnorePointerDown)) return
    onDragStart(e)
  }, [onDragStart])
  return (
    <div
      className={
        [
          'HeaderBar',
          'select-none',
          onDragStart ? 'cursor-move' : '',
          onToggle ? 'cursor-pointer' : '',
          uiHeaderRowHeightClass,
          uiHeaderRowPaddingClass,
        ].join(' ')
      }
      onClick={onHeaderClick}
      onDoubleClick={handleDoubleClick}
      onPointerDown={handlePointerDown}
      aria-expanded={typeof collapsed === 'boolean' ? !collapsed : undefined}
    >
      <div className="flex items-center gap-2 min-w-0">
        {tabs.length > 0 && (
          <div
            className={`flex items-center gap-1 min-w-0 ${
              tabVariant === 'icon' ? '' : 'overflow-x-auto whitespace-nowrap'
            }`}
          >
            {tabs.map(t => {
              if (tabVariant === 'icon') {
                const TabIcon = tabIconByKey?.[t.key]
                if (!TabIcon) return null
                return (
                  <IconButton
                    key={t.key}
                    data-kg-spotlight-tab={t.key}
                    title={t.label}
                    onClick={() => onTabChange && onTabChange(t.key)}
                    className={`App-toolbar__btn ${
                      activeTab === t.key ? uiPrimaryPillActiveClassName : uiPrimaryIconInactiveClassName
                    }`}
                    showTooltip
                  >
                    <TabIcon className={iconSizeClass} strokeWidth={uiIconStrokeWidth} aria-hidden={true} />
                  </IconButton>
                )
              }
              return (
                <button
                  key={t.key}
                  data-kg-spotlight-tab={t.key}
                  type="button"
                  onClick={() => onTabChange && onTabChange(t.key)}
                  className={`App-toolbar__btn text-xs ${
                    activeTab === t.key
                      ? uiToolbarToggleActiveClassName
                      : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {t.label}
                </button>
              )
            })}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {onSearchChange && (
          <div
            className={`overflow-hidden transition-[width] duration-200 ease-out ${
              searchVisible ? 'w-72' : 'w-0'
            }`}
          >
            <input
              value={searchQuery || ''}
              onChange={e => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder || 'Search'}
              className={`h-7 w-72 px-2 text-xs border border-gray-300 rounded-lg bg-white transition-opacity duration-150 select-text ${
                searchVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
              }`}
            />
          </div>
        )}
        {rightSlot}
      </div>
    </div>
  )
}

const TabHeader = React.memo(TabHeaderImpl)
export default TabHeader
