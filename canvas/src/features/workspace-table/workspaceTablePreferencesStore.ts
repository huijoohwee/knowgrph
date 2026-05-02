import { LS_KEYS } from '@/lib/config'
import {
  readJsonImportWorkspaceTarget,
  type JsonImportWorkspaceTarget,
  writeJsonImportWorkspaceTarget,
} from '@/features/workspace-table/jsonImportWorkspaceTarget'
import {
  readJsonMarkdownMode,
  readJsonMarkdownTableMaxColumns,
  readJsonMarkdownTableMaxRows,
  writeJsonMarkdownMode,
  writeJsonMarkdownTableMaxColumns,
  writeJsonMarkdownTableMaxRows,
} from '@/features/markdown/jsonMarkdownPreferences'
import type { JsonToMarkdownMode } from '@/features/markdown/jsonToMarkdown'
import {
  readWorkspaceEditorMode,
  type WorkspaceEditorMode,
  writeWorkspaceEditorMode,
} from '@/features/workspace-table/workspaceEditorMode'
import {
  readWorkspaceCellSelectPanelPlacement,
  type WorkspaceCellSelectPanelPlacement,
  writeWorkspaceCellSelectPanelPlacement,
} from '@/features/workspace-table/cellSelectPanelPlacement'

import {
  emitWorkspaceTablePreferencesChanged,
  subscribeWorkspaceTablePreferencesChanged,
} from '@/features/workspace-table/workspaceTablePreferencesEvents'
import { cancelWorkspaceSyncTask, scheduleWorkspaceSyncTask } from '@/lib/async/workspaceSyncScheduler'
import {
  WORKSPACE_SYNC_SCOPE_WORKSPACE_TABLE_PREFS_RUNTIME_PERSISTENCE,
  WORKSPACE_SYNC_TASK_WORKSPACE_TABLE_PREFS_NOTIFY,
} from '@/lib/async/workspaceSyncKeys'

export type WorkspaceTablePreferencesSnapshot = {
  workspaceEditorMode: WorkspaceEditorMode
  workspaceCellSelectPanelPlacement: WorkspaceCellSelectPanelPlacement
  jsonImportTarget: JsonImportWorkspaceTarget
  jsonMarkdownMode: JsonToMarkdownMode
  jsonTableMaxRows: number
  jsonTableMaxColumns: number
}

const buildSnapshot = (): WorkspaceTablePreferencesSnapshot => ({
  workspaceEditorMode: readWorkspaceEditorMode(),
  workspaceCellSelectPanelPlacement: readWorkspaceCellSelectPanelPlacement(),
  jsonImportTarget: readJsonImportWorkspaceTarget(),
  jsonMarkdownMode: readJsonMarkdownMode(),
  jsonTableMaxRows: readJsonMarkdownTableMaxRows(),
  jsonTableMaxColumns: readJsonMarkdownTableMaxColumns(),
})

const isSameSnapshot = (
  left: WorkspaceTablePreferencesSnapshot,
  right: WorkspaceTablePreferencesSnapshot,
): boolean =>
  left.workspaceEditorMode === right.workspaceEditorMode &&
  left.workspaceCellSelectPanelPlacement === right.workspaceCellSelectPanelPlacement &&
  left.jsonImportTarget === right.jsonImportTarget &&
  left.jsonMarkdownMode === right.jsonMarkdownMode &&
  left.jsonTableMaxRows === right.jsonTableMaxRows &&
  left.jsonTableMaxColumns === right.jsonTableMaxColumns

let cachedSnapshot: WorkspaceTablePreferencesSnapshot | null = null
const subscribers = new Set<() => void>()
let listenersAttached = false
let detachListeners: (() => void) | null = null

const buildSnapshotSignature = (snap: WorkspaceTablePreferencesSnapshot): string =>
  [
    snap.workspaceEditorMode,
    snap.workspaceCellSelectPanelPlacement,
    snap.jsonImportTarget,
    snap.jsonMarkdownMode,
    String(snap.jsonTableMaxRows),
    String(snap.jsonTableMaxColumns),
  ].join('|')

const readSnapshot = (): WorkspaceTablePreferencesSnapshot => {
  const next = buildSnapshot()
  if (cachedSnapshot && isSameSnapshot(cachedSnapshot, next)) return cachedSnapshot
  cachedSnapshot = next
  return next
}

const isWorkspacePreferenceStorageKey = (storageKey: string | null): boolean =>
  storageKey === LS_KEYS.workspaceEditorMode ||
  storageKey === LS_KEYS.graphTableViewMode ||
  storageKey === LS_KEYS.workspaceCellSelectPanelPlacement ||
  storageKey === LS_KEYS.jsonImportWorkspaceTarget ||
  storageKey === LS_KEYS.jsonMarkdownMode ||
  storageKey === LS_KEYS.jsonMarkdownTableMaxRows ||
  storageKey === LS_KEYS.jsonMarkdownTableMaxColumns

const notifySubscribersCoalesced = (): void => {
  if (subscribers.size === 0) return
  const snap = readSnapshot()
  const signature = buildSnapshotSignature(snap)
  scheduleWorkspaceSyncTask(
    WORKSPACE_SYNC_TASK_WORKSPACE_TABLE_PREFS_NOTIFY,
    () => {
      const items = [...subscribers]
      for (const fn of items) {
        try {
          fn()
        } catch {
          void 0
        }
      }
    },
    0,
    { scopeKey: WORKSPACE_SYNC_SCOPE_WORKSPACE_TABLE_PREFS_RUNTIME_PERSISTENCE, signature },
  )
}

const ensureListenersAttached = (): void => {
  if (listenersAttached) return
  if (typeof window === 'undefined') return
  const handleChanged = () => notifySubscribersCoalesced()
  const handleStorage = (event: StorageEvent) => {
    if (!isWorkspacePreferenceStorageKey(event.key)) return
    notifySubscribersCoalesced()
  }
  const unsubscribeChanged = subscribeWorkspaceTablePreferencesChanged(handleChanged)
  window.addEventListener('storage', handleStorage)
  listenersAttached = true

  detachListeners = () => {
    try {
      unsubscribeChanged()
      window.removeEventListener('storage', handleStorage)
    } catch {
      void 0
    }
    listenersAttached = false
  }
}

const cleanupListenersIfIdle = (): void => {
  if (!listenersAttached) return
  if (subscribers.size > 0) return
  cancelWorkspaceSyncTask(WORKSPACE_SYNC_TASK_WORKSPACE_TABLE_PREFS_NOTIFY)
  const cleanup = detachListeners
  detachListeners = null
  if (cleanup) cleanup()
}

export const workspaceTablePreferencesStore = {
  subscribe(onStoreChange: () => void): () => void {
    if (typeof window === 'undefined') return () => void 0
    ensureListenersAttached()
    subscribers.add(onStoreChange)
    return () => {
      subscribers.delete(onStoreChange)
      cleanupListenersIfIdle()
    }
  },
  getSnapshot: readSnapshot,
  getServerSnapshot: readSnapshot,
  setWorkspaceEditorMode(next: WorkspaceEditorMode): WorkspaceEditorMode {
    const before = readSnapshot()
    const written = writeWorkspaceEditorMode(next)
    const after = readSnapshot()
    if (!isSameSnapshot(before, after)) emitWorkspaceTablePreferencesChanged()
    return written
  },
  setJsonImportTarget(next: JsonImportWorkspaceTarget): JsonImportWorkspaceTarget {
    const before = readSnapshot()
    const written = writeJsonImportWorkspaceTarget(next)
    const after = readSnapshot()
    if (!isSameSnapshot(before, after)) emitWorkspaceTablePreferencesChanged()
    return written
  },
  setJsonMarkdownMode(next: JsonToMarkdownMode): JsonToMarkdownMode {
    const before = readSnapshot()
    const written = writeJsonMarkdownMode(next)
    const after = readSnapshot()
    if (!isSameSnapshot(before, after)) emitWorkspaceTablePreferencesChanged()
    return written
  },
  setJsonTableMaxRows(next: unknown): number {
    const before = readSnapshot()
    const written = writeJsonMarkdownTableMaxRows(next)
    const after = readSnapshot()
    if (!isSameSnapshot(before, after)) emitWorkspaceTablePreferencesChanged()
    return written
  },
  setJsonTableMaxColumns(next: unknown): number {
    const before = readSnapshot()
    const written = writeJsonMarkdownTableMaxColumns(next)
    const after = readSnapshot()
    if (!isSameSnapshot(before, after)) emitWorkspaceTablePreferencesChanged()
    return written
  },
  setWorkspaceCellSelectPanelPlacement(next: WorkspaceCellSelectPanelPlacement): WorkspaceCellSelectPanelPlacement {
    const before = readSnapshot()
    const written = writeWorkspaceCellSelectPanelPlacement(next)
    const after = readSnapshot()
    if (!isSameSnapshot(before, after)) emitWorkspaceTablePreferencesChanged()
    return written
  },
}
