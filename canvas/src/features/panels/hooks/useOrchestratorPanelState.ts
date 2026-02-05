import { useCallback, useMemo } from 'react'
import {
  LS_KEYS,
  ORCHESTRATOR_SECTION_IDS,
  type OrchestratorSectionId,
  buildOrchestratorSectionToggleAnalyticsEvent,
  type OrchestratorSectionToggleAnalyticsEvent,
} from '@/lib/config'
import usePersistedBoolean from '@/features/hooks/usePersistedBoolean'

interface OrchestratorPanelStateSections {
  byId: Record<OrchestratorSectionId, boolean>
  setters: Record<OrchestratorSectionId, (next: boolean) => void>
}

export interface OrchestratorPanelState {
  sections: OrchestratorPanelStateSections
  areAllSectionsCollapsed: boolean
  setAllSectionsCollapsed: (next: boolean) => void
}

type OrchestratorSectionToggleEventDetail = OrchestratorSectionToggleAnalyticsEvent & {
  source: 'floatingPanel'
}

function emitOrchestratorSectionToggle(sectionId: OrchestratorSectionId, collapsed: boolean) {
  if (typeof window === 'undefined') return
  try {
    const payload = buildOrchestratorSectionToggleAnalyticsEvent(sectionId, collapsed)
    if (!payload) return
    const event = new CustomEvent<OrchestratorSectionToggleEventDetail>('kg-orchestrator-section-toggle', {
      detail: { ...payload, collapsed, source: 'floatingPanel' },
    })
    window.dispatchEvent(event)
  } catch {
    void 0
  }
}

export function useOrchestratorPanelState(): OrchestratorPanelState {
  const [graphRagCollapsed, setGraphRagCollapsed] = usePersistedBoolean(LS_KEYS.orchestratorGraphRagCollapsed, true)
  const [presetsCollapsed, setPresetsCollapsed] = usePersistedBoolean(LS_KEYS.orchestratorPresetsCollapsed, true)
  const [editorCollapsed, setEditorCollapsed] = usePersistedBoolean(LS_KEYS.orchestratorEditorCollapsed, true)
  const [contextCollapsed, setContextCollapsed] = usePersistedBoolean(LS_KEYS.orchestratorContextCollapsed, true)
  const [workflowIndexingCollapsed, setWorkflowIndexingCollapsed] = usePersistedBoolean(
    LS_KEYS.orchestratorWorkflowIndexingCollapsed,
    true,
  )
  const [workflowTracingCollapsed, setWorkflowTracingCollapsed] = usePersistedBoolean(
    LS_KEYS.orchestratorWorkflowTracingCollapsed,
    true,
  )

  const handleSetGraphRagCollapsed = useCallback(
    (next: boolean) => {
      emitOrchestratorSectionToggle('graphRag', next)
      setGraphRagCollapsed(next)
    },
    [setGraphRagCollapsed],
  )

  const handleSetPresetsCollapsed = useCallback(
    (next: boolean) => {
      emitOrchestratorSectionToggle('presets', next)
      setPresetsCollapsed(next)
    },
    [setPresetsCollapsed],
  )

  const handleSetEditorCollapsed = useCallback(
    (next: boolean) => {
      emitOrchestratorSectionToggle('editor', next)
      setEditorCollapsed(next)
    },
    [setEditorCollapsed],
  )

  const handleSetContextCollapsed = useCallback(
    (next: boolean) => {
      emitOrchestratorSectionToggle('context', next)
      setContextCollapsed(next)
    },
    [setContextCollapsed],
  )

  const handleSetWorkflowIndexingCollapsed = useCallback(
    (next: boolean) => {
      emitOrchestratorSectionToggle('workflowIndexing', next)
      setWorkflowIndexingCollapsed(next)
    },
    [setWorkflowIndexingCollapsed],
  )

  const handleSetWorkflowTracingCollapsed = useCallback(
    (next: boolean) => {
      emitOrchestratorSectionToggle('workflowTracing', next)
      setWorkflowTracingCollapsed(next)
    },
    [setWorkflowTracingCollapsed],
  )

  const sections: OrchestratorPanelStateSections = useMemo(
    () => ({
      byId: {
        graphRag: graphRagCollapsed,
        presets: presetsCollapsed,
        editor: editorCollapsed,
        context: contextCollapsed,
        workflowIndexing: workflowIndexingCollapsed,
        workflowTracing: workflowTracingCollapsed,
      },
      setters: {
        graphRag: handleSetGraphRagCollapsed,
        presets: handleSetPresetsCollapsed,
        editor: handleSetEditorCollapsed,
        context: handleSetContextCollapsed,
        workflowIndexing: handleSetWorkflowIndexingCollapsed,
        workflowTracing: handleSetWorkflowTracingCollapsed,
      },
    }),
    [
      contextCollapsed,
      editorCollapsed,
      graphRagCollapsed,
      handleSetContextCollapsed,
      handleSetEditorCollapsed,
      handleSetGraphRagCollapsed,
      handleSetPresetsCollapsed,
      handleSetWorkflowIndexingCollapsed,
      handleSetWorkflowTracingCollapsed,
      presetsCollapsed,
      workflowIndexingCollapsed,
      workflowTracingCollapsed,
    ],
  )

  const areAllSectionsCollapsed = useMemo(
    () => ORCHESTRATOR_SECTION_IDS.every(id => sections.byId[id]),
    [sections],
  )

  const setAllSectionsCollapsed = useCallback(
    (next: boolean) => {
      ORCHESTRATOR_SECTION_IDS.forEach(id => {
        sections.setters[id](next)
      })
    },
    [sections],
  )

  return {
    sections,
    areAllSectionsCollapsed,
    setAllSectionsCollapsed,
  }
}

