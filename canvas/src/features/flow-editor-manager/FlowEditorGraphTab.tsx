import React from 'react'

import { useGraphStore } from '@/hooks/useGraphStore'
import { UI_LABELS } from '@/lib/config'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { usePanelTypography } from '@/lib/ui/panelTypography'
import { deriveGraphGroups } from '@/components/GraphCanvas/layout/graphGroups'
import { cn } from '@/lib/utils'
import GraphFieldsView from '@/features/panels/views/GraphFieldsView'
import GraphTableWorkspace from '@/features/graph-table/ui/GraphTableWorkspace'
import { workspaceTablePreferencesStore } from '@/features/workspace-table/workspaceTablePreferencesStore'

const GRAPH_FIELDS_ALIAS_LABELS = [
  'Renderer',
  'Node',
  'Edges',
  'Clusters',
  'Layer Mode',
] as const

const WORKFLOW_ALIAS_LABELS = [
  ...GRAPH_FIELDS_ALIAS_LABELS,
  'Workflow sections mode',
  'Workflow Sections',
  'Steps',
  'Tier B',
  'runtime',
  'pipeline',
  'mermaid',
  'flow',
  'Nodes · Quick Editor Gallery',
  'Edges',
  'Clusters · Samples',
  'Inspector',
] as const

export default function FlowEditorGraphTab({ searchQuery, workflowMode = false }: { searchQuery: string; workflowMode?: boolean }) {
  const panelTypography = usePanelTypography()
  const graphData = useGraphStore(s => s.graphData)
  const graphFieldsStatusNoop = React.useCallback((_msg: string) => {
    void _msg
  }, [])
  const workspaceEditorMode = React.useSyncExternalStore(
    workspaceTablePreferencesStore.subscribe,
    () => workspaceTablePreferencesStore.getSnapshot().workspaceEditorMode,
    () => workspaceTablePreferencesStore.getServerSnapshot().workspaceEditorMode,
  )
  const multiDimTableView = workspaceEditorMode === 'multiDimTable'

  const nodeCount = Array.isArray(graphData?.nodes) ? graphData!.nodes.length : 0
  const edgeCount = Array.isArray(graphData?.edges) ? graphData!.edges.length : 0
  const clusterCount = React.useMemo(() => (graphData ? deriveGraphGroups(graphData).length : 0), [graphData])

  const [entryOpenRequest, setEntryOpenRequest] = React.useState<{ token: number; entryLabel: string } | null>(null)
  const entryOpenTokenRef = React.useRef(0)
  const openEntryInFieldSettings = React.useCallback((entryLabel: string) => {
    entryOpenTokenRef.current += 1
    setEntryOpenRequest({ token: entryOpenTokenRef.current, entryLabel })
  }, [])

  if (workflowMode) {
    return (
      <section className="h-full min-h-0 flex flex-col" aria-label={UI_LABELS.flowEditorGraph}>
        <main className="flex-1 min-h-0 overflow-hidden" aria-label="Workflow manager">
          <section className="p-3 min-h-0 h-full overflow-hidden">
            {multiDimTableView ? (
              <section className="h-[360px] min-h-[280px] rounded border p-2 overflow-hidden">
                <GraphTableWorkspace active />
              </section>
            ) : (
              <section className="h-full min-h-0 rounded border p-2 overflow-auto">
                <GraphFieldsView
                  onStatusChange={graphFieldsStatusNoop}
                  searchQuery={searchQuery}
                  embedded={true}
                  entryOpenRequest={entryOpenRequest}
                  entryAliasLabels={WORKFLOW_ALIAS_LABELS}
                  onEntryAliasClick={openEntryInFieldSettings}
                />
              </section>
            )}
          </section>
        </main>
      </section>
    )
  }

  return (
    <section className="h-full min-h-0 flex flex-col" aria-label={UI_LABELS.flowEditorGraph}>
      <header className={cn('px-3 py-2 border-b flex items-center justify-between gap-3', UI_THEME_TOKENS.panel.border)}>
        <section className="min-w-0" aria-label="Summary">
          <section className={cn(panelTypography.microLabelClass, UI_THEME_TOKENS.text.secondary)}>{UI_LABELS.status}</section>
          <section className={cn('text-xs font-semibold truncate', UI_THEME_TOKENS.text.primary)}>
            {UI_LABELS.nodesLabel} {nodeCount} · {UI_LABELS.edgesLabel} {edgeCount} · {UI_LABELS.graphLayersMode} {clusterCount}
          </section>
        </section>
      </header>

      <main className="flex-1 min-h-0 overflow-hidden" aria-label="Graph content">
        <section className="h-full min-h-0 p-3" aria-label="Graph manager">
          <section className="min-h-0 h-full overflow-hidden rounded border p-2" aria-label="Graph Fields and Field Settings">
            <section className="h-full min-h-0 overflow-hidden">
              {multiDimTableView ? (
                <GraphTableWorkspace active />
              ) : (
                <GraphFieldsView
                  onStatusChange={graphFieldsStatusNoop}
                  searchQuery={searchQuery}
                  embedded={true}
                  entryOpenRequest={entryOpenRequest}
                  entryAliasLabels={GRAPH_FIELDS_ALIAS_LABELS}
                  onEntryAliasClick={openEntryInFieldSettings}
                />
              )}
            </section>
          </section>
        </section>
      </main>
    </section>
  )
}
