import React, { useCallback, useId, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import clsx from 'clsx'
import { useGraphStore } from '@/hooks/useGraphStore'
import { KTV_HEADER_LABEL_CLASS_NAME } from '@/features/panels/ui/KeyTypeValueRow'
import { UI_RESPONSIVE_PANEL_HEADER_ROW_CLASSNAME } from '@/lib/ui/responsiveElementClasses'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'

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
    s => s.uiSectionHeaderRowHeightClass || UI_RESPONSIVE_PANEL_HEADER_ROW_CLASSNAME,
  )
  const uiSectionHeaderRowPaddingClass = useGraphStore(
    s => s.uiSectionHeaderRowPaddingClass || 'py-1',
  )

  return (
    <div className={clsx(`mt-3 border-t ${UI_THEME_TOKENS.panel.divider} pt-2`, className)}>
      <div
        className={clsx(
          `sticky top-0 z-10 flex cursor-pointer select-none items-center justify-between px-3 backdrop-blur-[4px] ${UI_THEME_TOKENS.panel.bg}`,
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
        <div className={KTV_HEADER_LABEL_CLASS_NAME}>{title}</div>
        <ChevronDown
          className={clsx(`h-3.5 w-3.5 ${UI_THEME_TOKENS.text.secondary} transition-transform`, !isCollapsed && 'rotate-180')}
          aria-hidden="true"
        />
      </div>
      <div id={contentId} className={clsx(isCollapsed ? 'hidden' : 'block')}>
        <div className="px-3 mt-2">{children}</div>
      </div>
    </div>
  )
}
