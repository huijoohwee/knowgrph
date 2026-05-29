import React from 'react'
import Tooltip from '@/features/panels/ui/Tooltip'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'

type BuildSettingsEntryInputNodeArgs = {
  hasOptions: boolean
  renderInput: () => React.ReactNode
  settingType: string
  valueTooltip: string
}

const stopSettingsValueEvent = (event: React.SyntheticEvent) => {
  event.stopPropagation()
}

export function buildSettingsEntryInputNode({
  hasOptions,
  renderInput,
  settingType: _settingType,
  valueTooltip,
}: BuildSettingsEntryInputNodeArgs) {
  const valueWrapperClass = 'inline-flex w-full min-w-0 max-w-full items-center justify-start sm:justify-end min-h-[24px] overflow-hidden'

  return hasOptions && valueTooltip.trim().length > 0
    ? (
      <Tooltip
        content={valueTooltip}
        maxWidthPx={260}
        contentClassName={`${UI_THEME_TOKENS.tooltip.bg} ${UI_THEME_TOKENS.tooltip.text}`}
        className="w-full min-w-0 max-w-full overflow-hidden"
      >
        <span
          className={valueWrapperClass}
          onPointerDown={stopSettingsValueEvent}
          onMouseDown={stopSettingsValueEvent}
          onClick={stopSettingsValueEvent}
          onKeyDown={stopSettingsValueEvent}
        >
          {renderInput()}
        </span>
      </Tooltip>
    )
    : (
      <span
        className={valueWrapperClass}
        onPointerDown={stopSettingsValueEvent}
        onMouseDown={stopSettingsValueEvent}
        onClick={stopSettingsValueEvent}
        onKeyDown={stopSettingsValueEvent}
      >
        {renderInput()}
      </span>
    )
}
