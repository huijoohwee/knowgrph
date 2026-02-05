import { useGraphStore } from '@/hooks/useGraphStore'
import { useMarkdownExplorerStore } from '@/features/markdown-explorer/store'
import { getWorkspaceFs } from '@/features/workspace-fs/workspaceFs'
import { WORKSPACE_ROOT_PATH, normalizeWorkspacePath } from '@/features/workspace-fs/path'
import { buildGraphRagWorkflowFromGraphData } from '@/features/panels/utils/graphragConfig'
import type { GraphData } from '@/lib/graph/types'

export const ORCHESTRATOR_WORKFLOW_WORKSPACE_FOLDER = '/orchestrator'
export const ORCHESTRATOR_WORKFLOW_WORKSPACE_PATH = '/orchestrator/graphrag-workflow.jsonld'

async function ensureOrchestratorWorkspaceFolder(): Promise<void> {
  const fs = await getWorkspaceFs()
  await fs.ensureSeed()
  try {
    await fs.createFolder({ parentPath: WORKSPACE_ROOT_PATH, name: 'orchestrator' })
  } catch {
    void 0
  }
}

export async function ensureOrchestratorWorkflowWorkspaceFile(): Promise<void> {
  await ensureOrchestratorWorkspaceFolder()

  const fs = await getWorkspaceFs()
  try {
    await fs.readFileText(ORCHESTRATOR_WORKFLOW_WORKSPACE_PATH)
    return
  } catch {
    void 0
  }

  const state = useGraphStore.getState()
  const graph = state.graphData as GraphData | null
  const graphId = typeof state.graphId === 'string' && state.graphId.trim() ? state.graphId : 'graph'
  const fallback = buildGraphRagWorkflowFromGraphData(graphId, graph)
  const existing = typeof state.graphRagWorkflowJsonText === 'string' ? state.graphRagWorkflowJsonText.trim() : ''
  const nextText = existing ? state.graphRagWorkflowJsonText! : JSON.stringify(fallback, null, 2)
  try {
    await fs.createFile({
      parentPath: ORCHESTRATOR_WORKFLOW_WORKSPACE_FOLDER,
      name: 'graphrag-workflow.jsonld',
      text: nextText,
    })
  } catch {
    try {
      await fs.writeFileText(ORCHESTRATOR_WORKFLOW_WORKSPACE_PATH, nextText)
    } catch {
      void 0
    }
  }
}

export function openOrchestratorWorkflowWorkspaceFile(): void {
  try {
    useGraphStore.getState().setWorkspaceViewMode('editor')
  } catch {
    void 0
  }
  void (async () => {
    try {
      await ensureOrchestratorWorkflowWorkspaceFile()
      useMarkdownExplorerStore.getState().setActivePath(normalizeWorkspacePath(ORCHESTRATOR_WORKFLOW_WORKSPACE_PATH))
    } catch {
      void 0
    }
  })()
}

