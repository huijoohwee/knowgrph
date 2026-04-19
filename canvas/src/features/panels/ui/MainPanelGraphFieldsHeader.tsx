import React from 'react'
import { UI_COPY } from '@/lib/config'
import { useGraphStore } from '@/hooks/useGraphStore'
import { getChipClass } from '@/lib/ui'

type MainPanelGraphFieldsHeaderProps = {
  agenticLegend: string[] | null
}

export default function MainPanelGraphFieldsHeader({
  agenticLegend,
}: MainPanelGraphFieldsHeaderProps) {
  if (!agenticLegend || agenticLegend.length === 0) return null

  const uiIconPillClass = useGraphStore(s => s.uiIconPillClass)
  const uiPanelKeyValueTextSizeClass = useGraphStore(
    s => s.uiPanelKeyValueTextSizeClass || 'text-xs',
  )
  const uiPanelTextFontClass = useGraphStore(
    s => s.uiPanelTextFontClass || 'font-sans',
  )
  return (
    <div
      className={[
        'mt-4 pt-3 border-t border-gray-200 mb-1 text-gray-500 space-y-1',
        uiPanelKeyValueTextSizeClass,
        uiPanelTextFontClass,
      ].join(' ')}
    >
      <div className="flex flex-wrap items-center gap-1">
        <span
          className={getChipClass('default', {
            textSizeClass: 'text-[9px]',
            textColorClass: 'text-gray-700',
            extraClassName: 'font-medium bg-gray-50 border-gray-300',
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
