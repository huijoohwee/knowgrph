import { LS_KEYS } from '@/lib/config'
import {
  ORCHESTRATOR_TRAVERSAL_DELAY_DEFAULT_MS,
  TRAVERSAL_MAX_DEPTH_DEFAULT,
  clampTraversalMaxDepth,
} from '@/features/panels/utils/orchestratorTraversal'
import { createMemoryStorage } from '@/tests/lib/memoryStorage'
import type { WindowHarnessEnv } from '@/tests/lib/windowHarness'
import { initWindowHarness } from '@/tests/lib/windowHarness'

export type FloatingPanelTraversalConfig = {
  floatingPanelTraversal: {
    eventType: string
    orchestratorTraversalDelayMs: number
    traversalQuery: {
      traversalStartNodeId: string
      traversalMaxDepth: number
      traversalLabelFilter: string
    }
    collapse: {
      orchestratorGraphRagCollapsed: boolean
      orchestratorPresetsCollapsed: boolean
      orchestratorEditorCollapsed: boolean
      orchestratorContextCollapsed: boolean
      orchestratorWorkflowIndexingCollapsed: boolean
      orchestratorWorkflowTracingCollapsed: boolean
    }
  }
}

export const GRAPH_TRAVERSAL_FLOATING_PANEL_EVENT_TYPE = 'kg:floatingPanelOpen:graphTraversal'

export function buildDefaultFloatingPanelTraversalConfig(): FloatingPanelTraversalConfig {
  return {
    floatingPanelTraversal: {
      eventType: GRAPH_TRAVERSAL_FLOATING_PANEL_EVENT_TYPE,
      orchestratorTraversalDelayMs: ORCHESTRATOR_TRAVERSAL_DELAY_DEFAULT_MS,
      traversalQuery: {
        traversalStartNodeId: '',
        traversalMaxDepth: TRAVERSAL_MAX_DEPTH_DEFAULT,
        traversalLabelFilter: '',
      },
      collapse: {
        orchestratorGraphRagCollapsed: true,
        orchestratorPresetsCollapsed: true,
        orchestratorEditorCollapsed: true,
        orchestratorContextCollapsed: true,
        orchestratorWorkflowIndexingCollapsed: true,
        orchestratorWorkflowTracingCollapsed: true,
      },
    },
  }
}

export function initGraphTraversalFloatingPanelHarness(
  config?: Partial<FloatingPanelTraversalConfig>,
): WindowHarnessEnv {
  const base = buildDefaultFloatingPanelTraversalConfig()
  const merged: FloatingPanelTraversalConfig = {
    floatingPanelTraversal: {
      eventType: config?.floatingPanelTraversal?.eventType || base.floatingPanelTraversal.eventType,
      orchestratorTraversalDelayMs:
        typeof config?.floatingPanelTraversal?.orchestratorTraversalDelayMs === 'number'
          ? config.floatingPanelTraversal.orchestratorTraversalDelayMs
          : base.floatingPanelTraversal.orchestratorTraversalDelayMs,
      traversalQuery: {
        traversalStartNodeId:
          config?.floatingPanelTraversal?.traversalQuery?.traversalStartNodeId ??
          base.floatingPanelTraversal.traversalQuery.traversalStartNodeId,
        traversalMaxDepth: clampTraversalMaxDepth(
          config?.floatingPanelTraversal?.traversalQuery?.traversalMaxDepth ??
            base.floatingPanelTraversal.traversalQuery.traversalMaxDepth,
        ),
        traversalLabelFilter:
          config?.floatingPanelTraversal?.traversalQuery?.traversalLabelFilter ??
          base.floatingPanelTraversal.traversalQuery.traversalLabelFilter,
      },
      collapse: {
        orchestratorGraphRagCollapsed:
          config?.floatingPanelTraversal?.collapse?.orchestratorGraphRagCollapsed ??
          base.floatingPanelTraversal.collapse.orchestratorGraphRagCollapsed,
        orchestratorPresetsCollapsed:
          config?.floatingPanelTraversal?.collapse?.orchestratorPresetsCollapsed ??
          base.floatingPanelTraversal.collapse.orchestratorPresetsCollapsed,
        orchestratorEditorCollapsed:
          config?.floatingPanelTraversal?.collapse?.orchestratorEditorCollapsed ??
          base.floatingPanelTraversal.collapse.orchestratorEditorCollapsed,
        orchestratorContextCollapsed:
          config?.floatingPanelTraversal?.collapse?.orchestratorContextCollapsed ??
          base.floatingPanelTraversal.collapse.orchestratorContextCollapsed,
        orchestratorWorkflowIndexingCollapsed:
          config?.floatingPanelTraversal?.collapse?.orchestratorWorkflowIndexingCollapsed ??
          base.floatingPanelTraversal.collapse.orchestratorWorkflowIndexingCollapsed,
        orchestratorWorkflowTracingCollapsed:
          config?.floatingPanelTraversal?.collapse?.orchestratorWorkflowTracingCollapsed ??
          base.floatingPanelTraversal.collapse.orchestratorWorkflowTracingCollapsed,
      },
    },
  }

  const storage = createMemoryStorage({
    [LS_KEYS.orchestratorTraversalDelayMs]: String(
      merged.floatingPanelTraversal.orchestratorTraversalDelayMs,
    ),
    [LS_KEYS.orchestratorGraphRagCollapsed]: JSON.stringify(
      merged.floatingPanelTraversal.collapse.orchestratorGraphRagCollapsed,
    ),
    [LS_KEYS.orchestratorPresetsCollapsed]: JSON.stringify(
      merged.floatingPanelTraversal.collapse.orchestratorPresetsCollapsed,
    ),
    [LS_KEYS.orchestratorEditorCollapsed]: JSON.stringify(
      merged.floatingPanelTraversal.collapse.orchestratorEditorCollapsed,
    ),
    [LS_KEYS.orchestratorContextCollapsed]: JSON.stringify(
      merged.floatingPanelTraversal.collapse.orchestratorContextCollapsed,
    ),
    [LS_KEYS.orchestratorWorkflowIndexingCollapsed]: JSON.stringify(
      merged.floatingPanelTraversal.collapse.orchestratorWorkflowIndexingCollapsed,
    ),
    [LS_KEYS.orchestratorWorkflowTracingCollapsed]: JSON.stringify(
      merged.floatingPanelTraversal.collapse.orchestratorWorkflowTracingCollapsed,
    ),
  })

  const env = initWindowHarness({
    storage,
    withCustomEvent: true,
  })

  return env
}

export function dispatchGraphTraversalFloatingPanelOpenEvent(g: Window & typeof globalThis): void {
  try {
    const Ctor = g.CustomEvent as typeof CustomEvent | undefined
    if (!Ctor) {
      g.dispatchEvent(new Event(GRAPH_TRAVERSAL_FLOATING_PANEL_EVENT_TYPE))
      return
    }
    g.dispatchEvent(new Ctor(GRAPH_TRAVERSAL_FLOATING_PANEL_EVENT_TYPE))
  } catch {
    void 0
  }
}
