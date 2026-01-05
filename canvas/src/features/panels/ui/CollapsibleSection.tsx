import React, { useCallback, useId, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import clsx from 'clsx'
import IconButton from '@/components/IconButton'
import { useGraphStore } from '@/hooks/useGraphStore'
import { UI_COPY } from '@/lib/config'
import { getIconSizeClass } from '@/lib/ui'

interface CollapsibleSectionProps {
  title: React.ReactNode
  defaultCollapsed?: boolean
  collapsed?: boolean
  onToggle?: (next: boolean) => void
  actions?: React.ReactNode
  children: React.ReactNode
  id?: string
  className?: string
  headerClassName?: string
  stickyHeader?: boolean
  toolbarAligned?: boolean
  stickyOffsetClassName?: string
}

export default function CollapsibleSection({
  title,
  defaultCollapsed = true,
  collapsed,
  onToggle,
  actions,
  children,
  id,
  className,
  headerClassName,
  stickyHeader = true,
  toolbarAligned = false,
  stickyOffsetClassName = 'top-0',
}: CollapsibleSectionProps) {
  const uiIconScale = useGraphStore(s => s.uiIconScale)
  const uiIconStrokeWidth = useGraphStore(s => s.uiIconStrokeWidth)
  const uiSectionHeaderRowHeightClass = useGraphStore(
    s => s.uiSectionHeaderRowHeightClass || 'min-h-[36px]',
  )
  const uiSectionHeaderRowPaddingClass = useGraphStore(
    s => s.uiSectionHeaderRowPaddingClass || 'py-1',
  )
  const iconSizeClass = getIconSizeClass(uiIconScale)
  const uncontrolled = typeof collapsed !== 'boolean'
  const [innerCollapsed, setInnerCollapsed] = useState<boolean>(defaultCollapsed)
  const isCollapsed = uncontrolled ? innerCollapsed : (collapsed as boolean)
  const setCollapsed = useCallback(
    (next: boolean) => {
      if (uncontrolled) setInnerCollapsed(next)
      if (onToggle) onToggle(next)
    },
    [uncontrolled, onToggle]
  )

  const generatedId = useId()
  const contentId = id || `section-${generatedId}`

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        setCollapsed(!isCollapsed)
      }
    },
    [isCollapsed, setCollapsed]
  )

  const chevronIcon = (
    <ChevronDown
      className={clsx(`${iconSizeClass} text-gray-700 transition-transform`, !isCollapsed && 'rotate-180')}
      strokeWidth={uiIconStrokeWidth}
      aria-hidden="true"
    />
  )

  return (
    <div className={clsx('mt-3 border-t border-gray-200 pt-2', className)}>
      <div
        className={clsx(
          'flex items-center justify-between cursor-pointer select-none',
          uiSectionHeaderRowHeightClass,
          uiSectionHeaderRowPaddingClass,
          stickyHeader && 'sticky bg-[var(--panel-bg)] z-10 backdrop-blur-[4px]',
          stickyHeader && stickyOffsetClassName,
          headerClassName,
        )}
        role="button"
        tabIndex={0}
        aria-expanded={!isCollapsed}
        aria-controls={contentId}
        onClick={() => setCollapsed(!isCollapsed)}
        onKeyDown={handleKeyDown}
      >
        <div className="text-xs font-semibold">{title}</div>
        {toolbarAligned ? (
          <div className="flex items-center gap-1">
            {actions}
            <IconButton
              className="App-toolbar__btn flex items-center justify-center"
              title={isCollapsed ? UI_COPY.expandSectionTitle : UI_COPY.collapseSectionTitle}
              onClick={(e) => {
                e.stopPropagation()
                setCollapsed(!isCollapsed)
              }}
              showTooltip
            >
              {chevronIcon}
            </IconButton>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {actions}
            <IconButton
              className="App-toolbar__btn flex items-center justify-center"
              title={isCollapsed ? UI_COPY.expandSectionTitle : UI_COPY.collapseSectionTitle}
              onClick={(e) => {
                e.stopPropagation()
                setCollapsed(!isCollapsed)
              }}
              showTooltip
            >
              {chevronIcon}
            </IconButton>
          </div>
        )}
      </div>
      <div id={contentId} className={clsx(isCollapsed ? 'hidden' : 'block mt-2')}>
        {children}
      </div>
    </div>
  )
}
