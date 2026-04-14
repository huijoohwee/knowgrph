import React from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'
import IconButton from '@/components/IconButton'
import { getIconSizeClass } from '@/lib/ui'
import { UI_SELECTORS } from '@/lib/config'
import {
  uiPrimaryPillActiveClassName,
  uiToolbarToggleActiveClassName,
  uiPrimaryIconInactiveClassName,
} from '@/features/toolbar/ui/toolbarStyles'

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
  onDragStart?: (ev: React.PointerEvent<HTMLElement>) => void
  tabs?: Tab[]
  activeTab?: string
  onTabChange?: (key: string) => void
  tabIdBase?: string
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
  tabIdBase,
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

  const onHeaderClick = React.useCallback((e: React.MouseEvent<HTMLElement>) => {
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

  const handleDoubleClick = React.useCallback((e: React.MouseEvent<HTMLElement>) => {
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

  const handlePointerDown = React.useCallback((e: React.PointerEvent<HTMLElement>) => {
    if (!onDragStart) return
    const el = e.target as Element
    if (el.closest(UI_SELECTORS.draggablePanelIgnorePointerDown)) return
    onDragStart(e)
  }, [onDragStart])

  const base = String(tabIdBase || 'panel').trim() || 'panel'
  const inputId = `${base}-search`
  return (
    <header
      className={
        [
          'HeaderBar',
          'flex-wrap items-start gap-y-1 sm:flex-nowrap sm:items-center',
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
      <nav className="flex min-w-0 flex-1 items-center overflow-x-auto" aria-label="Panel tabs">
        {tabs.length > 0 && (
          <section
            role="tablist"
            aria-label="Tabs"
            aria-orientation="horizontal"
            className={`flex min-w-0 flex-nowrap items-center gap-1 overflow-x-auto overscroll-x-contain pb-[1px] ${tabVariant === 'icon' ? '' : 'whitespace-nowrap'}`}
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
                    role="tab"
                    id={`${base}-${t.key}-tab`}
                    aria-selected={activeTab === t.key}
                    aria-controls={`${base}-${t.key}-panel`}
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
                  role="tab"
                  id={`${base}-${t.key}-tab`}
                  aria-selected={activeTab === t.key}
                  aria-controls={`${base}-${t.key}-panel`}
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
          </section>
        )}
      </nav>
      <section className="flex w-full flex-wrap items-center justify-end gap-1 sm:w-auto sm:shrink-0 sm:gap-2" aria-label="Panel tools">
        {onSearchChange && (
          <section
            className={`overflow-hidden transition-[width,flex-basis,opacity] duration-200 ease-out ${
              searchVisible ? 'basis-full w-full sm:basis-auto sm:w-72' : 'basis-0 w-0'
            }`}
          >
            <label htmlFor={inputId} className="sr-only">
              {searchPlaceholder || 'Search'}
            </label>
            <input
              id={inputId}
              value={searchQuery || ''}
              onChange={e => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder || 'Search'}
              className={`h-[var(--kg-control-height)] w-full min-w-0 px-2 text-xs border border-gray-300 rounded-lg bg-white transition-opacity duration-150 select-text ${
                searchVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
              }`}
            />
          </section>
        )}
        {rightSlot}
      </section>
    </header>
  )
}

const TabHeader = React.memo(TabHeaderImpl)
export default TabHeader
