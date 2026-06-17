import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testGraphRecordDbSyncDoesNotUseModuleGlobalKeyGuards() {
  const p = resolve(process.cwd(), 'src', 'features', 'graph-inspector', 'hooks', 'useGraphRecordDbSync.ts')
  const text = readFileSync(p, 'utf8')
  if (text.includes('lastSyncedKeyGlobal') || text.includes('lastGraphWriteKeyGlobal')) {
    throw new Error('expected useGraphRecordDbSync to avoid module-global key guards')
  }
  if (!text.includes('syncGateByViewKey') || !text.includes('new Map')) {
    throw new Error('expected useGraphRecordDbSync to use a viewKey-scoped sync gate')
  }
  if (!text.includes('scheduleWorkspaceSyncTask') || !text.includes('graph-record:runtime-persistence-sync:')) {
    throw new Error('expected useGraphRecordDbSync to use shared workspace sync scheduler key dedupe')
  }
  if (!text.includes('subscriberCount')) {
    throw new Error('expected useGraphRecordDbSync to track subscriberCount per viewKey to avoid cross-subscription churn')
  }
  if (!text.includes('cancelWorkspaceSyncTask(toSyncTaskKey(viewKey))')) {
    throw new Error('expected useGraphRecordDbSync to cancel scheduler task only from viewKey lifecycle cleanup')
  }
}

export function testGraphRecordSelectionInspectorUsesWorkspaceSyncModeOnly() {
  const p = resolve(process.cwd(), 'src', 'features', 'graph-inspector', 'ui', 'GraphRecordSelectionInspector.tsx')
  const text = readFileSync(p, 'utf8')
  if (text.includes('editorWorkspacePane') || text.includes("workspaceViewMode")) {
    throw new Error('expected GraphRecordSelectionInspector to avoid removed graph-table pane state')
  }
  if (!text.includes("const syncEnabled = canvasWorkspaceSyncMode === 'realtime'")) {
    throw new Error('expected GraphRecordSelectionInspector sync to be gated by workspace sync mode only')
  }
  if (!text.includes("from '@/features/graph-inspector/hooks/useGraphRecordDbSync'")) {
    throw new Error('expected GraphRecordSelectionInspector to reuse the neutral graph-inspector DB sync hook')
  }
  if (!text.includes("buildScopedGraphSemanticKey('graph-record-selection-inspector-base-graph'")) {
    throw new Error('expected GraphRecordSelectionInspector to key base-graph fallback selection from the shared semantic graph helper')
  }
  if (!text.includes("cacheScope: 'graph-record-selection-inspector-base-graph'") || !text.includes('getCachedGraphLookup({')) {
    throw new Error('expected GraphRecordSelectionInspector to reuse the shared graph lookup cache instead of rebuilding a raw node id set for widget fallback selection')
  }
  if (!text.includes('preferCurrentGraphDataRefs: true')) {
    throw new Error('expected GraphRecordSelectionInspector base graph lookup to preserve current graph references on cache refresh')
  }
}
