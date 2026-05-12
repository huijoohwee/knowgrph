import React from 'react'
import Tooltip from '@/features/panels/ui/Tooltip'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'

type BuildSettingsEntryInputNodeArgs = {
  hasOptions: boolean
  renderInput: () => React.ReactNode
  settingType: string
  valueTooltip: string
}

export function buildSettingsEntryInputNode({
  hasOptions,
  renderInput,
  settingType,
  valueTooltip,
}: BuildSettingsEntryInputNodeArgs) {
  const valueWrapperBaseClass = 'inline-flex w-full min-w-0 items-center min-h-[24px]'
  const valueWrapperClass = settingType === 'boolean'
    ? `${valueWrapperBaseClass} justify-end`
    : valueWrapperBaseClass

  return hasOptions && valueTooltip.trim().length > 0
    ? (
      <Tooltip
        content={valueTooltip}
        maxWidthPx={260}
        contentClassName={`${UI_THEME_TOKENS.tooltip.bg} ${UI_THEME_TOKENS.tooltip.text}`}
        className="w-full"
      >
        <span className={valueWrapperClass} onClick={event => event.stopPropagation()}>
          {renderInput()}
        </span>
      </Tooltip>
    )
    : (
      <span className={valueWrapperClass} onClick={event => event.stopPropagation()}>
        {renderInput()}
      </span>
    )
}
