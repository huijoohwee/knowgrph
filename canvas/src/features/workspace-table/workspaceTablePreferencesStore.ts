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

const readSnapshot = (): WorkspaceTablePreferencesSnapshot => ({
  workspaceEditorMode: readWorkspaceEditorMode(),
  workspaceCellSelectPanelPlacement: readWorkspaceCellSelectPanelPlacement(),
  jsonImportTarget: readJsonImportWorkspaceTarget(),
  jsonMarkdownMode: readJsonMarkdownMode(),
  jsonTableMaxRows: readJsonMarkdownTableMaxRows(),
  jsonTableMaxColumns: readJsonMarkdownTableMaxColumns(),
})

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
    const written = writeWorkspaceEditorMode(next)
    emitWorkspaceTablePreferencesChanged()
    return written
  },
  setJsonImportTarget(next: JsonImportWorkspaceTarget): JsonImportWorkspaceTarget {
    const written = writeJsonImportWorkspaceTarget(next)
    emitWorkspaceTablePreferencesChanged()
    return written
  },
  setJsonMarkdownMode(next: JsonToMarkdownMode): JsonToMarkdownMode {
    const written = writeJsonMarkdownMode(next)
    emitWorkspaceTablePreferencesChanged()
    return written
  },
  setJsonTableMaxRows(next: unknown): number {
    const written = writeJsonMarkdownTableMaxRows(next)
    emitWorkspaceTablePreferencesChanged()
    return written
  },
  setJsonTableMaxColumns(next: unknown): number {
    const written = writeJsonMarkdownTableMaxColumns(next)
    emitWorkspaceTablePreferencesChanged()
    return written
  },
  setWorkspaceCellSelectPanelPlacement(next: WorkspaceCellSelectPanelPlacement): WorkspaceCellSelectPanelPlacement {
    const written = writeWorkspaceCellSelectPanelPlacement(next)
    emitWorkspaceTablePreferencesChanged()
    return written
  },
}
