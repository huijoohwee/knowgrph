import React from 'react'
import CollapsibleSection from '@/features/panels/ui/CollapsibleSection'
import { HELP_STEP_COPY, getOrchestratorSectionListLabel } from '@/features/panels/config'
import { UI_COPY, UI_LABELS } from '@/lib/config'
import { useGraphStore } from '@/hooks/useGraphStore'

interface HelpPanelTourSectionProps {
  collapsed: boolean
  onToggle: (next: boolean) => void
}

export function HelpPanelTourSection({ collapsed, onToggle }: HelpPanelTourSectionProps) {
  const uiPanelKeyValueTextSizeClass = useGraphStore(
    s => s.uiPanelKeyValueTextSizeClass || 'text-sm',
  )
  const uiPanelTextFontClass = useGraphStore(
    s => s.uiPanelTextFontClass || 'font-sans',
  )

  return (
    <CollapsibleSection
      title={HELP_STEP_COPY.panelTour.title}
      collapsed={collapsed}
      onToggle={onToggle}
    >
      {HELP_STEP_COPY.panelTour.descriptionShort && (
        <div className={`${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} text-gray-600 mb-2`}>
          {HELP_STEP_COPY.panelTour.descriptionShort}
        </div>
      )}
      <ul
        className={`list-disc pl-4 ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} text-gray-700 space-y-1`}
      >
        <li>
          {UI_COPY.toolbarPrefix} load data, toggle 2D and 3D modes, open {UI_LABELS.graphFields}, and launch the guided workflow.
        </li>
        <li>
          {UI_COPY.mainPanelPrefix} switch between the Workflow tab, Help tab, and {UI_LABELS.graphFields} to guide schema and graph setup.
        </li>
        <li>
          {UI_COPY.bottomPanelPrefix} use Graph Data Table, Parser, Schema Configurator, Orchestrator (
          {getOrchestratorSectionListLabel()}
          ), and Renderer tabs together with the Workflow exports section to refine and export GraphData artifacts.
        </li>
      </ul>
    </CollapsibleSection>
  )
}
