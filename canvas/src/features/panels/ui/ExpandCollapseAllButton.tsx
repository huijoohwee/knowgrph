import React from 'react'
import { ChevronDown } from 'lucide-react'
import IconButton from '@/components/IconButton'
import { useGraphStore } from '@/hooks/useGraphStore'
import { getIconSizeClass } from '@/lib/ui'

type ExpandCollapseAllButtonProps = {
  allCollapsed: boolean
  onExpandAll?: () => void
  onCollapseAll?: () => void
  titleExpand?: string
  titleCollapse?: string
}

export default function ExpandCollapseAllButton({
  allCollapsed,
  onExpandAll,
  onCollapseAll,
  titleExpand = 'Expand All',
  titleCollapse = 'Collapse All',
}: ExpandCollapseAllButtonProps) {
  const uiIconScale = useGraphStore(s => s.uiIconScale)
  const uiIconStrokeWidth = useGraphStore(s => s.uiIconStrokeWidth)
  const iconSizeClass = getIconSizeClass(uiIconScale)

  return (
    <IconButton
      className="App-toolbar__btn flex items-center justify-center"
      title={allCollapsed ? titleExpand : titleCollapse}
      onClick={() => {
        if (allCollapsed) {
          if (onExpandAll) onExpandAll()
          return
        }
        if (onCollapseAll) onCollapseAll()
      }}
      showTooltip
    >
      <ChevronDown
        className={`${iconSizeClass} text-gray-700 transition-transform ${
          allCollapsed ? '' : 'rotate-180'
        }`}
        strokeWidth={uiIconStrokeWidth}
        aria-hidden="true"
      />
    </IconButton>
  )
}

