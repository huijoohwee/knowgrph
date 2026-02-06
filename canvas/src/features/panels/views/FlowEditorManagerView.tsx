import React from 'react'

import { UI_LABELS } from '@/lib/config'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { usePanelTypography } from '@/lib/ui/panelTypography'

import FlowEditorMappingTab from '@/features/flow-editor-manager/FlowEditorMappingTab'
import FlowEditorSpecificationTab from '@/features/flow-editor-manager/FlowEditorSpecificationTab'

type FlowEditorManagerTab = 'mapping' | 'specification'

export default function FlowEditorManagerView({ searchQuery }: { searchQuery: string }) {
  const panelTypography = usePanelTypography()
  const [tab, setTab] = React.useState<FlowEditorManagerTab>('mapping')

  return (
    <article className="h-full min-h-0 flex flex-col" aria-label={UI_LABELS.flowEditorManager}>
      <header className={`px-3 py-2 border-b ${UI_THEME_TOKENS.panel.border}`}>
        <section className="flex items-start justify-between gap-2" aria-label="Flow Editor Manager header">
          <section className="min-w-0" aria-label="Title">
            <h3 className={`font-semibold ${UI_THEME_TOKENS.text.primary} ${panelTypography.panelTextClass}`}>{UI_LABELS.flowEditorManager}</h3>
            <p className={`${panelTypography.microLabelClass} ${UI_THEME_TOKENS.text.secondary}`}>Mapping and neutral specifications</p>
          </section>
          <nav className="flex items-center gap-1" aria-label="Flow Editor Manager tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'mapping'}
              className={`App-toolbar__btn ${tab === 'mapping' ? `${UI_THEME_TOKENS.button.activeBg} ${UI_THEME_TOKENS.button.activeText}` : `${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`}`}
              onClick={() => setTab('mapping')}
            >
              {UI_LABELS.flowEditorMapping}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'specification'}
              className={`App-toolbar__btn ${tab === 'specification' ? `${UI_THEME_TOKENS.button.activeBg} ${UI_THEME_TOKENS.button.activeText}` : `${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`}`}
              onClick={() => setTab('specification')}
            >
              {UI_LABELS.flowEditorSpecification}
            </button>
          </nav>
        </section>
      </header>

      <section className="flex-1 min-h-0 overflow-hidden" aria-label="Flow Editor Manager content">
        <section role="tabpanel" aria-label={UI_LABELS.flowEditorMapping} className={tab === 'mapping' ? 'block h-full' : 'hidden'}>
          <FlowEditorMappingTab searchQuery={searchQuery} />
        </section>
        <section role="tabpanel" aria-label={UI_LABELS.flowEditorSpecification} className={tab === 'specification' ? 'block h-full' : 'hidden'}>
          <FlowEditorSpecificationTab />
        </section>
      </section>
    </article>
  )
}
