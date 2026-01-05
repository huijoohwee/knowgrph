import { useCallback, useState, useMemo } from 'react'
import {
  LS_KEYS,
  ORCHESTRATOR_SECTION_IDS,
  type OrchestratorSectionId,
  buildOrchestratorSectionToggleAnalyticsEvent,
  type OrchestratorSectionToggleAnalyticsEvent,
} from '@/lib/config'
import { lsJson, lsSetJson } from '@/lib/persistence'
import usePersistedBoolean from '@/features/hooks/usePersistedBoolean'

export type OrchestratorView = 'ui' | 'text'

interface OrchestratorBottomPanelStateSections {
  byId: Record<OrchestratorSectionId, boolean>
  setters: Record<OrchestratorSectionId, (next: boolean) => void>
}

export interface OrchestratorBottomPanelState {
  view: OrchestratorView
  setView: (next: OrchestratorView) => void
  sections: OrchestratorBottomPanelStateSections
  areAllSectionsCollapsed: boolean
  setAllSectionsCollapsed: (next: boolean) => void
}

type OrchestratorSectionToggleEventDetail = OrchestratorSectionToggleAnalyticsEvent & {
  source: 'bottomPanel'
}

function emitOrchestratorSectionToggle(sectionId: OrchestratorSectionId, collapsed: boolean) {
  if (typeof window === 'undefined') return
  try {
    const payload = buildOrchestratorSectionToggleAnalyticsEvent(sectionId, collapsed)
    if (!payload) return
    const event = new CustomEvent<OrchestratorSectionToggleEventDetail>('kg-orchestrator-section-toggle', {
      detail: { ...payload, collapsed, source: 'bottomPanel' },
    })
    window.dispatchEvent(event)
  } catch {
    void 0
  }
}

export function useOrchestratorBottomPanelState(): OrchestratorBottomPanelState {
  const [viewState, setViewState] = useState<OrchestratorView>(() =>
    lsJson<OrchestratorView>(LS_KEYS.orchestratorView, 'ui', raw => {
      if (raw === 'ui' || raw === 'text') return raw
      return null
    }),
  )

  const setView = useCallback((next: OrchestratorView) => {
    lsSetJson(LS_KEYS.orchestratorView, next)
    setViewState(next)
  }, [])

  const [graphRagCollapsed, setGraphRagCollapsed] = usePersistedBoolean(LS_KEYS.orchestratorGraphRagCollapsed, true)
  const [presetsCollapsed, setPresetsCollapsed] = usePersistedBoolean(LS_KEYS.orchestratorPresetsCollapsed, true)
  const [editorCollapsed, setEditorCollapsed] = usePersistedBoolean(LS_KEYS.orchestratorEditorCollapsed, true)
  const [contextCollapsed, setContextCollapsed] = usePersistedBoolean(LS_KEYS.orchestratorContextCollapsed, true)
  const [workflowIndexingCollapsed, setWorkflowIndexingCollapsed] = usePersistedBoolean(
    LS_KEYS.orchestratorWorkflowIndexingCollapsed, true)
  const [workflowTracingCollapsed, setWorkflowTracingCollapsed] = usePersistedBoolean(
    LS_KEYS.orchestratorWorkflowTracingCollapsed, true)

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

  const sections: OrchestratorBottomPanelStateSections = useMemo(
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
      graphRagCollapsed,
      presetsCollapsed,
      editorCollapsed,
      contextCollapsed,
      workflowIndexingCollapsed,
      workflowTracingCollapsed,
      handleSetGraphRagCollapsed,
      handleSetPresetsCollapsed,
      handleSetEditorCollapsed,
      handleSetContextCollapsed,
      handleSetWorkflowIndexingCollapsed,
      handleSetWorkflowTracingCollapsed,
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
    view: viewState,
    setView,
    sections,
    areAllSectionsCollapsed,
    setAllSectionsCollapsed,
  }
}
