import React from 'react'

import { UI_LABELS } from '@/lib/config'
import MainPanelBody from '@/features/panels/ui/MainPanelBody'
import MainPanelFlowEditorManagerHeader, { type FlowEditorManagerTabKey } from '@/features/panels/ui/MainPanelFlowEditorManagerHeader'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { usePanelTypography } from '@/lib/ui/panelTypography'

import FlowEditorMappingTab from '@/features/flow-editor-manager/FlowEditorMappingTab'
import FlowEditorSpecificationTab from '@/features/flow-editor-manager/FlowEditorSpecificationTab'

export default function FlowEditorManagerView({
  searchQuery,
  onRegisterActions,
}: {
  searchQuery: string
  onRegisterActions?: (actions: {
    apply?: () => void
    reset?: () => void
    applyDisabled?: boolean
    resetDisabled?: boolean
  }) => void
}) {
  const panelTypography = usePanelTypography()
  const [tab, setTab] = React.useState<FlowEditorManagerTabKey>('mapping')

  return (
    <MainPanelBody header={<MainPanelFlowEditorManagerHeader activeTab={tab} onTabChange={setTab} />} scrollable={false}>
      <section
        className={`min-h-0 py-2 ${UI_THEME_TOKENS.text.primary} ${panelTypography.panelTextClass} h-full overflow-hidden`}
        aria-label={UI_LABELS.flowEditorManager}
      >
        {tab === 'mapping' ? (
          <section role="tabpanel" aria-label={UI_LABELS.flowEditorMapping} className="h-full">
            <FlowEditorMappingTab searchQuery={searchQuery} onRegisterActions={onRegisterActions} />
          </section>
        ) : (
          <section role="tabpanel" aria-label={UI_LABELS.flowEditorSpecification} className="h-full">
            <FlowEditorSpecificationTab onRegisterActions={onRegisterActions} />
          </section>
        )}
      </section>
    </MainPanelBody>
  )
}
