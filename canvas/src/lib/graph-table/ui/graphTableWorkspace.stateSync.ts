import { cancelWorkspaceSyncTask, scheduleWorkspaceSyncTask } from '@/lib/async/workspaceSyncScheduler'
import {
  WORKSPACE_SYNC_SCOPE_GRAPH_TABLE_VIEW_STATE_RUNTIME_PERSISTENCE,
  WORKSPACE_SYNC_TASK_GRAPH_TABLE_VIEW_STATE,
} from '@/lib/async/workspaceSyncKeys'
import { hashArrayOfObjectsSignature, hashRecordSignature, hashSignatureParts } from '@/lib/hash/signature'

export const toGraphTableWorkspaceViewStateSignature = (args: {
  columnVisibilityById: Record<string, unknown>
  filterMatch: string
  filterClauses: Array<Record<string, unknown>>
  groupBy: string
  sortRules: Array<Record<string, unknown>>
  rowHeightPreset: string
  columnWidthsPxById: Record<string, unknown>
  columnOrderByTableId: Record<string, unknown>
}): string =>
  hashSignatureParts([
    'v1',
    hashRecordSignature(args.columnVisibilityById),
    String(args.filterMatch || ''),
    hashArrayOfObjectsSignature(args.filterClauses),
    String(args.groupBy || ''),
    hashArrayOfObjectsSignature(args.sortRules),
    String(args.rowHeightPreset || ''),
    hashRecordSignature(args.columnWidthsPxById),
    hashRecordSignature(args.columnOrderByTableId),
  ])

export const scheduleGraphTableWorkspaceViewStateSync = (fn: () => void, signature: string): void => {
  scheduleWorkspaceSyncTask(WORKSPACE_SYNC_TASK_GRAPH_TABLE_VIEW_STATE, fn, 200, {
    signature,
    scopeKey: WORKSPACE_SYNC_SCOPE_GRAPH_TABLE_VIEW_STATE_RUNTIME_PERSISTENCE,
  })
}

export const cancelGraphTableWorkspaceViewStateSync = (): void => {
  cancelWorkspaceSyncTask(WORKSPACE_SYNC_TASK_GRAPH_TABLE_VIEW_STATE)
}
