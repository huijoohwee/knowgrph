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

export function testGraphTableSelectionInspectorUsesWorkspaceSyncModeOnly() {
  const p = resolve(process.cwd(), 'src', 'features', 'graph-table', 'ui', 'GraphTableSelectionInspector.tsx')
  const text = readFileSync(p, 'utf8')
  if (text.includes('editorWorkspacePane') || text.includes("workspaceViewMode")) {
    throw new Error('expected GraphTableSelectionInspector to avoid removed graph-table pane state')
  }
  if (!text.includes("const syncEnabled = canvasWorkspaceSyncMode === 'realtime'")) {
    throw new Error('expected GraphTableSelectionInspector sync to be gated by workspace sync mode only')
  }
  if (!text.includes("buildScopedGraphSemanticKey('graph-table-selection-inspector-base-graph'")) {
    throw new Error('expected GraphTableSelectionInspector to key base-graph fallback selection from the shared semantic graph helper')
  }
  if (!text.includes("cacheScope: 'graph-table-selection-inspector-base-graph'") || !text.includes('getCachedGraphLookup({')) {
    throw new Error('expected GraphTableSelectionInspector to reuse the shared graph lookup cache instead of rebuilding a raw node id set for widget fallback selection')
  }
  if (!text.includes('preferCurrentGraphDataRefs: true')) {
    throw new Error('expected GraphTableSelectionInspector base graph lookup to preserve current graph references on cache refresh')
  }
}
