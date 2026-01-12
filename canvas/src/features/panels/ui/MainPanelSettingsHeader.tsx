import React from 'react'
import { ChevronDown } from 'lucide-react'
import IconButton from '@/components/IconButton'
import Tooltip from '@/features/panels/ui/Tooltip'
import { useGraphStore } from '@/hooks/useGraphStore'
import {
  UI_COLOR_PRIMARY_BLUE_BG,
  uiToolbarToggleActiveClassName,
} from '@/features/graph-data-table/ui/GraphDataTableToolbarStyles'
import { getIconSizeClass } from '@/lib/ui'
import { SETTINGS_TAB_HEADER_TOOLTIP } from '@/lib/config'
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
  const uiIconScale = useGraphStore(s => s.uiIconScale)
  const uiIconStrokeWidth = useGraphStore(s => s.uiIconStrokeWidth)
  const uiIconAnimationEnabled = useGraphStore(s => s.uiIconAnimationEnabled)
  const uiHeaderRowHeightClass = useGraphStore(
    s => s.uiHeaderRowHeightClass || 'min-h-[36px]',
  )
  const uiHeaderRowPaddingClass = useGraphStore(
    s => s.uiHeaderRowPaddingClass || 'py-1',
  )
  const uiSectionHeaderRowHeightClass = useGraphStore(
    s => s.uiSectionHeaderRowHeightClass || 'min-h-[36px]',
  )
  const uiSectionHeaderRowPaddingClass = useGraphStore(
    s => s.uiSectionHeaderRowPaddingClass || 'py-1',
  )
  const uiPanelMicroLabelTextSizeClass = useGraphStore(
    s => s.uiPanelMicroLabelTextSizeClass || 'text-xs',
  )
  const setUiIconScale = useGraphStore(s => s.setUiIconScale)
  const setUiIconAnimationEnabled = useGraphStore(s => s.setUiIconAnimationEnabled)
  const setUiHeaderRowHeightClass = useGraphStore(s => s.setUiHeaderRowHeightClass)
  const setUiHeaderRowPaddingClass = useGraphStore(s => s.setUiHeaderRowPaddingClass)
  const setUiSectionHeaderRowHeightClass = useGraphStore(
    s => s.setUiSectionHeaderRowHeightClass,
  )
  const setUiSectionHeaderRowPaddingClass = useGraphStore(
    s => s.setUiSectionHeaderRowPaddingClass,
  )
  const iconSizeClass = getIconSizeClass(uiIconScale)
  const iconToggleButtonBaseClass =
    'h-6 px-1.5 border rounded text-xs leading-tight focus:outline-none focus:ring-1'
  const headerDensityIsDefault =
    uiHeaderRowHeightClass === 'min-h-[36px]' &&
    uiHeaderRowPaddingClass === 'py-1' &&
    uiSectionHeaderRowHeightClass === 'min-h-[36px]' &&
    uiSectionHeaderRowPaddingClass === 'py-1'
  const headerDensityIsCompact =
    uiHeaderRowHeightClass === 'min-h-[32px]' &&
    uiHeaderRowPaddingClass === 'py-0.5' &&
    uiSectionHeaderRowHeightClass === 'min-h-[32px]' &&
    uiSectionHeaderRowPaddingClass === 'py-0.5'
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
          'text-left flex items-center gap-1 text-gray-600',
          uiPanelMicroLabelTextSizeClass,
        ].join(' ')}
      >
        <Tooltip
          content={SETTINGS_TAB_HEADER_TOOLTIP}
          maxWidthPx={280}
          contentClassName="bg-gray-800/90"
        >
          <span>Settings</span>
        </Tooltip>
      </div>
      <div className="flex items-center gap-2">
        <div
          className={[
            'hidden md:flex items-center gap-1 text-gray-600',
            uiPanelMicroLabelTextSizeClass,
          ].join(' ')}
        >
          <span className="uppercase tracking-wide text-[9px] text-gray-500">
            Icons
          </span>
          <button
            type="button"
            className={`${iconToggleButtonBaseClass} ${
              uiIconScale === 'default'
                ? uiToolbarToggleActiveClassName
                : 'border-gray-300 bg-white text-gray-700'
            }`}
            onClick={() => setUiIconScale('default')}
          >
            Default
          </button>
          <button
            type="button"
            className={`${iconToggleButtonBaseClass} ${
              uiIconScale === 'compact'
                ? uiToolbarToggleActiveClassName
                : 'border-gray-300 bg-white text-gray-700'
            }`}
            onClick={() => setUiIconScale('compact')}
          >
            Compact
          </button>
          <button
            type="button"
            className={`${iconToggleButtonBaseClass} ${
              uiIconAnimationEnabled
                ? uiToolbarToggleActiveClassName
                : 'border-gray-300 bg-white text-gray-700'
            }`}
            onClick={() => setUiIconAnimationEnabled(!uiIconAnimationEnabled)}
          >
            Motion
          </button>
          <button
            type="button"
            className={`${iconToggleButtonBaseClass} border-dashed border-blue-400 text-blue-700 ${UI_COLOR_PRIMARY_BLUE_BG}`}
            onClick={() => {
              setUiIconScale('compact')
              setUiIconAnimationEnabled(true)
            }}
          >
            Compact preset
          </button>
        </div>
        <div
          className={[
            'hidden md:flex items-center gap-1 text-gray-600',
            uiPanelMicroLabelTextSizeClass,
          ].join(' ')}
        >
          <span className="uppercase tracking-wide text-[9px] text-gray-500">
            Headers
          </span>
          <button
            type="button"
            className={`${iconToggleButtonBaseClass} ${
              headerDensityIsDefault
                ? uiToolbarToggleActiveClassName
                : 'border-gray-300 bg-white text-gray-700'
            }`}
            onClick={() => {
              setUiHeaderRowHeightClass('min-h-[36px]')
              setUiHeaderRowPaddingClass('py-1')
              setUiSectionHeaderRowHeightClass('min-h-[36px]')
              setUiSectionHeaderRowPaddingClass('py-1')
            }}
          >
            Default
          </button>
          <button
            type="button"
            className={`${iconToggleButtonBaseClass} ${
              headerDensityIsCompact
                ? uiToolbarToggleActiveClassName
                : 'border-gray-300 bg-white text-gray-700'
            }`}
            onClick={() => {
              setUiHeaderRowHeightClass('min-h-[32px]')
              setUiHeaderRowPaddingClass('py-0.5')
              setUiSectionHeaderRowHeightClass('min-h-[32px]')
              setUiSectionHeaderRowPaddingClass('py-0.5')
            }}
          >
            Compact
          </button>
        </div>
        <div className="flex items-center gap-1">
          <IconButton
            className="App-toolbar__btn flex items-center justify-center"
            title={settingsActions.allCollapsed ? 'Expand All' : 'Collapse All'}
            onClick={() => {
              const allCollapsed = settingsActions.allCollapsed
              if (allCollapsed) {
                if (settingsActions.expandAll) settingsActions.expandAll()
              } else if (settingsActions.collapseAll) {
                settingsActions.collapseAll()
              }
            }}
            showTooltip
          >
            <ChevronDown
              className={`${iconSizeClass} text-gray-700 transition-transform ${
                settingsActions.allCollapsed ? '' : 'rotate-180'
              }`}
              strokeWidth={uiIconStrokeWidth}
              aria-hidden="true"
            />
          </IconButton>
        </div>
      </div>
    </div>
  )
}
