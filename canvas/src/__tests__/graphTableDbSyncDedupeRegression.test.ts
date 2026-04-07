import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testGraphTableDbSyncDoesNotUseModuleGlobalKeyGuards() {
  const p = resolve(process.cwd(), 'src', 'features', 'graph-table', 'hooks', 'useGraphTableDbSync.ts')
  const text = readFileSync(p, 'utf8')
  if (text.includes('lastSyncedKeyGlobal') || text.includes('lastGraphWriteKeyGlobal')) {
    throw new Error('expected useGraphTableDbSync to avoid module-global key guards')
  }
  if (!text.includes('syncGateByViewKey') || !text.includes('new Map')) {
    throw new Error('expected useGraphTableDbSync to use a viewKey-scoped sync gate')
  }
  if (!text.includes('scheduleWorkspaceSyncTask') || !text.includes('graph-table:runtime-persistence-sync:')) {
    throw new Error('expected useGraphTableDbSync to use shared workspace sync scheduler key dedupe')
  }
  if (!text.includes('subscriberCount')) {
    throw new Error('expected useGraphTableDbSync to track subscriberCount per viewKey to avoid cross-subscription churn')
  }
  if (!text.includes('cancelWorkspaceSyncTask(toSyncTaskKey(viewKey))')) {
    throw new Error('expected useGraphTableDbSync to cancel scheduler task only from viewKey lifecycle cleanup')
  }
}

export function testGraphTableSelectionInspectorGatesDbSyncWhenGraphTablePaneIsActive() {
  const p = resolve(process.cwd(), 'src', 'features', 'graph-table', 'ui', 'GraphTableSelectionInspector.tsx')
  const text = readFileSync(p, 'utf8')
  if (!text.includes('editorWorkspacePane') || !text.includes("workspaceViewMode")) {
    throw new Error('expected GraphTableSelectionInspector to read editor workspace state')
  }
  if (!text.includes('syncEnabled') || !text.includes("editorWorkspacePane !== 'graphTable'")) {
    throw new Error('expected GraphTableSelectionInspector to disable sync when graphTable pane is active')
  }
}
