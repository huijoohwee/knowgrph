import React from 'react'
import { UI_COPY } from '@/lib/config'
import { useGraphStore } from '@/hooks/useGraphStore'
import { getChipClass } from '@/lib/ui'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'

type MainPanelGraphFieldsHeaderProps = {
  agenticLegend: string[] | null
}

export default function MainPanelGraphFieldsHeader({
  agenticLegend,
}: MainPanelGraphFieldsHeaderProps) {
  const uiIconPillClass = useGraphStore(s => s.uiIconPillClass)
  const uiPanelKeyValueTextSizeClass = useGraphStore(
    s => s.uiPanelKeyValueTextSizeClass || 'text-xs',
  )
  const uiPanelTextFontClass = useGraphStore(
    s => s.uiPanelTextFontClass || 'font-sans',
  )

  if (!agenticLegend || agenticLegend.length === 0) return null

  return (
    <div
      className={[
        `mt-4 pt-3 border-t ${UI_THEME_TOKENS.panel.divider} mb-1 ${UI_THEME_TOKENS.text.tertiary} space-y-1`,
        uiPanelKeyValueTextSizeClass,
        uiPanelTextFontClass,
      ].join(' ')}
    >
      <div className="flex flex-wrap items-center gap-1">
        <span
          className={getChipClass('default', {
            textSizeClass: 'text-[9px]',
            textColorClass: UI_THEME_TOKENS.text.secondary,
            extraClassName: `font-medium ${UI_THEME_TOKENS.button.neutralSubtle} ${UI_THEME_TOKENS.input.border}`,
          })}
        >
          {UI_COPY.graphFieldsAgenticLegendChipLabel}
        </span>
        {agenticLegend.map(label => (
          <span
            key={label}
            className={getChipClass('selected', {
              textSizeClass: 'text-[9px]',
              textColorClass: 'text-blue-700',
              extraClassName: uiIconPillClass,
            })}
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  )
}
