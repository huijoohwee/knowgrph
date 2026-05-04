import React from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'
import { UI_LABELS } from '@/lib/config'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'

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
        `mt-4 mb-1 flex items-center justify-between border-t ${UI_THEME_TOKENS.panel.divider} ${UI_THEME_TOKENS.text.secondary}`,
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
