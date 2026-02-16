import React from 'react'

import Tooltip from '@/features/panels/ui/Tooltip'
import { useGraphStore } from '@/hooks/useGraphStore'
import { UI_COPY, UI_LABELS } from '@/lib/config'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'

export type FlowEditorManagerTabKey = 'mapping' | 'specification' | 'graph'

export default function MainPanelFlowEditorManagerHeader(props: {
  activeTab: FlowEditorManagerTabKey
  onTabChange: (tab: FlowEditorManagerTabKey) => void
}) {
  const { activeTab, onTabChange } = props

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
    <header
      className={[
        `mt-4 border-t ${UI_THEME_TOKENS.panel.divider} flex items-center justify-between mb-1`,
        uiSectionHeaderRowHeightClass,
        uiSectionHeaderRowPaddingClass,
      ].join(' ')}
      aria-label={UI_LABELS.flowEditorManager}
    >
      <section
        className={[
          `text-left flex items-center gap-1 ${UI_THEME_TOKENS.text.secondary}`,
          uiPanelMicroLabelTextSizeClass,
        ].join(' ')}
        aria-label="Title"
      >
        <Tooltip
          content={UI_COPY.flowEditorManagerHeaderTooltip}
          maxWidthPx={320}
          contentClassName={UI_THEME_TOKENS.tooltip.bg}
        >
          <span>{UI_LABELS.flowEditorManager}</span>
        </Tooltip>
      </section>

      <nav className="flex items-center gap-1" aria-label="Flow Editor Manager tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'mapping'}
          className={`App-toolbar__btn text-xs ${
            activeTab === 'mapping'
              ? `${UI_THEME_TOKENS.button.activeBg} ${UI_THEME_TOKENS.button.activeText}`
              : `${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`
          }`}
          onClick={() => onTabChange('mapping')}
        >
          {UI_LABELS.flowEditorMapping}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'specification'}
          className={`App-toolbar__btn text-xs ${
            activeTab === 'specification'
              ? `${UI_THEME_TOKENS.button.activeBg} ${UI_THEME_TOKENS.button.activeText}`
              : `${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`
          }`}
          onClick={() => onTabChange('specification')}
        >
          {UI_LABELS.flowEditorSpecification}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'graph'}
          className={`App-toolbar__btn text-xs ${
            activeTab === 'graph'
              ? `${UI_THEME_TOKENS.button.activeBg} ${UI_THEME_TOKENS.button.activeText}`
              : `${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`
          }`}
          onClick={() => onTabChange('graph')}
        >
          {UI_LABELS.flowEditorGraph}
        </button>
      </nav>
    </header>
  )
}
