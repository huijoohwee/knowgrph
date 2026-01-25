import React from 'react'
import Tooltip from '@/features/panels/ui/Tooltip'
import { useGraphStore } from '@/hooks/useGraphStore'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { SETTINGS_TAB_HEADER_TOOLTIP } from '@/lib/config'
import ExpandCollapseAllButton from '@/features/panels/ui/ExpandCollapseAllButton'
type MainPanelSettingsActions = {
  apply?: () => void
  reset?: () => void
  collapseAll?: () => void
  expandAll?: () => void
  allCollapsed?: boolean
}

type MainPanelSettingsHeaderProps = {
  settingsActions: MainPanelSettingsActions
}

export default function MainPanelSettingsHeader({ settingsActions }: MainPanelSettingsHeaderProps) {
  const uiSectionHeaderRowHeightClass = useGraphStore(
    s => s.uiSectionHeaderRowHeightClass || 'min-h-[36px]',
  )
  const uiSectionHeaderRowPaddingClass = useGraphStore(
    s => s.uiSectionHeaderRowPaddingClass || 'py-1',
  )
  const uiPanelMicroLabelTextSizeClass = useGraphStore(
    s => s.uiPanelMicroLabelTextSizeClass || 'text-xs',
  )
  return (
    <div
      className={
        [
          `mt-4 border-t ${UI_THEME_TOKENS.panel.divider} flex items-center justify-between mb-1`,
          uiSectionHeaderRowHeightClass,
          uiSectionHeaderRowPaddingClass,
        ].join(' ')
      }
    >
      <div
        className={[
          `text-left flex items-center gap-1 ${UI_THEME_TOKENS.text.secondary}`,
          uiPanelMicroLabelTextSizeClass,
        ].join(' ')}
      >
        <Tooltip
          content={SETTINGS_TAB_HEADER_TOOLTIP}
          maxWidthPx={280}
          contentClassName={UI_THEME_TOKENS.tooltip.bg}
        >
          <span>Settings</span>
        </Tooltip>
      </div>
      <div className="flex items-center gap-1">
        <ExpandCollapseAllButton
          allCollapsed={!!settingsActions.allCollapsed}
          onExpandAll={settingsActions.expandAll}
          onCollapseAll={settingsActions.collapseAll}
        />
      </div>
    </div>
  )
}
