import React from 'react'
import { ChevronDown } from 'lucide-react'
import IconButton from '@/components/IconButton'
import Tooltip from '@/features/panels/ui/Tooltip'
import { useGraphStore } from '@/hooks/useGraphStore'
import { getIconSizeClass } from '@/lib/ui'
import { HELP_TAB_HEADER_TOOLTIP } from '@/lib/config'

type MainPanelHelpHeaderProps = {
  allSectionsCollapsed: boolean
  onCollapseAll: () => void
  onExpandAll: () => void
}

export default function MainPanelHelpHeader({
  allSectionsCollapsed,
  onCollapseAll,
  onExpandAll,
}: MainPanelHelpHeaderProps) {
  const uiIconScale = useGraphStore(s => s.uiIconScale)
  const uiSectionHeaderRowHeightClass = useGraphStore(
    s => s.uiSectionHeaderRowHeightClass || 'min-h-[36px]',
  )
  const uiSectionHeaderRowPaddingClass = useGraphStore(
    s => s.uiSectionHeaderRowPaddingClass || 'py-1',
  )
  const uiPanelMicroLabelTextSizeClass = useGraphStore(
    s => s.uiPanelMicroLabelTextSizeClass || 'text-xs',
  )
  const iconSizeClass = getIconSizeClass(uiIconScale)
  return (
    <div
      className={
        [
          'mt-4 border-t border-gray-200 flex items-center justify-between mb-1',
          uiSectionHeaderRowHeightClass,
          uiSectionHeaderRowPaddingClass,
        ].join(' ')
      }
    >
      <div
        className={[
          'flex items-center gap-1 text-gray-600',
          uiPanelMicroLabelTextSizeClass,
        ].join(' ')}
      >
        <Tooltip
          content={HELP_TAB_HEADER_TOOLTIP}
          maxWidthPx={280}
          contentClassName="bg-gray-800/90"
        >
          <span>Help</span>
        </Tooltip>
      </div>
      <IconButton
        className="App-toolbar__btn flex items-center justify-center"
        title={allSectionsCollapsed ? 'Expand All' : 'Collapse All'}
        onClick={() => {
          if (allSectionsCollapsed) {
            onExpandAll()
          } else {
            onCollapseAll()
          }
        }}
        showTooltip
      >
        <ChevronDown
          className={`${iconSizeClass} text-gray-700 transition-transform ${allSectionsCollapsed ? '' : 'rotate-180'}`}
          aria-hidden="true"
        />
      </IconButton>
    </div>
  )
}
