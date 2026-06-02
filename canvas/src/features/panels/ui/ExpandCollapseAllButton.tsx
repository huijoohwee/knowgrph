import React from 'react'
import { ChevronsDown, ChevronsUp } from 'lucide-react'
import IconButton from '@/components/IconButton'
import { useGraphStore } from '@/hooks/useGraphStore'
import { getIconSizeClass } from '@/lib/ui'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'

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
  const Icon = allCollapsed ? ChevronsDown : ChevronsUp

  return (
    <IconButton
      className="App-toolbar__btn flex h-7 w-7 items-center justify-center"
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
      <Icon
        className={`${iconSizeClass} ${UI_THEME_TOKENS.text.secondary}`}
        strokeWidth={uiIconStrokeWidth}
        aria-hidden="true"
      />
    </IconButton>
  )
}
