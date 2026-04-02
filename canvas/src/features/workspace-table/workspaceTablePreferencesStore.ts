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

const WORKSPACE_TABLE_PREFS_EVENT = 'kg:workspace-table-prefs:changed'

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

const readSnapshot = (): WorkspaceTablePreferencesSnapshot => {
  const next = buildSnapshot()
  if (cachedSnapshot && isSameSnapshot(cachedSnapshot, next)) return cachedSnapshot
  cachedSnapshot = next
  return next
}

const emitWorkspaceTablePreferencesChanged = () => {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(WORKSPACE_TABLE_PREFS_EVENT))
}

const isWorkspacePreferenceStorageKey = (storageKey: string | null): boolean =>
  storageKey === LS_KEYS.workspaceEditorMode ||
  storageKey === LS_KEYS.markdownDerivedViewerMode ||
  storageKey === LS_KEYS.graphTableViewMode ||
  storageKey === LS_KEYS.workspaceCellSelectPanelPlacement ||
  storageKey === LS_KEYS.jsonImportWorkspaceTarget ||
  storageKey === LS_KEYS.jsonMarkdownMode ||
  storageKey === LS_KEYS.jsonMarkdownTableMaxRows ||
  storageKey === LS_KEYS.jsonMarkdownTableMaxColumns

export const workspaceTablePreferencesStore = {
  subscribe(onStoreChange: () => void): () => void {
    if (typeof window === 'undefined') return () => void 0
    const handleChanged = () => onStoreChange()
    const handleStorage = (event: StorageEvent) => {
      if (!isWorkspacePreferenceStorageKey(event.key)) return
      onStoreChange()
    }
    window.addEventListener(WORKSPACE_TABLE_PREFS_EVENT, handleChanged)
    window.addEventListener('storage', handleStorage)
    return () => {
      window.removeEventListener(WORKSPACE_TABLE_PREFS_EVENT, handleChanged)
      window.removeEventListener('storage', handleStorage)
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
