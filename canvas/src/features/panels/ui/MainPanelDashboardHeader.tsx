import React from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'
import { UI_LABELS } from '@/lib/config'

export default function MainPanelDashboardHeader() {
  const uiSectionHeaderRowHeightClass = useGraphStore(
    s => s.uiSectionHeaderRowHeightClass || 'min-h-[36px]',
  )
  const uiSectionHeaderRowPaddingClass = useGraphStore(
    s => s.uiSectionHeaderRowPaddingClass || 'py-1',
  )
  const uiPanelMicroLabelTextSizeClass = useGraphStore(
    s => s.uiPanelMicroLabelTextSizeClass || 'text-xs',
  )
  const uiPanelTextFontClass = useGraphStore(
    s => s.uiPanelTextFontClass || 'font-sans',
  )

  return (
    <header
      className={[
        'mt-4 border-t border-gray-200 flex items-center justify-between mb-1 text-gray-600',
        uiSectionHeaderRowHeightClass,
        uiSectionHeaderRowPaddingClass,
        uiPanelMicroLabelTextSizeClass,
        uiPanelTextFontClass,
      ].join(' ')}
    >
      <span>{UI_LABELS.dashboard}</span>
    </header>
  )
}

