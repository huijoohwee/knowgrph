import React, { useCallback, useId, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import clsx from 'clsx'
import { useGraphStore } from '@/hooks/useGraphStore'

interface CollapsibleSubsectionProps {
  title: React.ReactNode
  defaultCollapsed?: boolean
  collapsed?: boolean
  onToggle?: (next: boolean) => void
  children: React.ReactNode
  id?: string
  className?: string
  headerClassName?: string
}

export default function CollapsibleSubsection({ title, defaultCollapsed = true, collapsed, onToggle, children, id, className, headerClassName }: CollapsibleSubsectionProps) {
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
  const contentId = id || `subsection-${generatedId}`

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        setCollapsed(!isCollapsed)
      }
    },
    [isCollapsed, setCollapsed]
  )

  const uiSectionHeaderRowHeightClass = useGraphStore(
    s => s.uiSectionHeaderRowHeightClass || 'min-h-[36px]',
  )
  const uiSectionHeaderRowPaddingClass = useGraphStore(
    s => s.uiSectionHeaderRowPaddingClass || 'py-1',
  )

  return (
    <div className={clsx('mt-3 border-t border-gray-200 pt-2', className)}>
      <div
        className={clsx(
          'flex items-center justify-between px-3 cursor-pointer select-none sticky top-0 bg-[var(--panel-bg)] z-10 backdrop-blur-[4px]',
          uiSectionHeaderRowHeightClass,
          uiSectionHeaderRowPaddingClass,
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
        <ChevronDown className={clsx('w-3.5 h-3.5 text-gray-700 transition-transform', !isCollapsed && 'rotate-180')} aria-hidden="true" />
      </div>
      <div id={contentId} className={clsx(isCollapsed ? 'hidden' : 'block')}>
        <div className="px-3 mt-2">{children}</div>
      </div>
    </div>
  )
}
