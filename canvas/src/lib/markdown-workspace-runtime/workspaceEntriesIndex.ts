import { normalizeWorkspacePath } from '@/features/workspace-fs/path'
import type { WorkspaceEntry, WorkspacePath } from '@/features/workspace-fs/types'

export type WorkspaceEntriesIndex = {
  byPath: ReadonlyMap<string, WorkspaceEntry>
  filePathSet: ReadonlySet<string>
  filePaths: WorkspacePath[]
  firstFilePath: WorkspacePath | null
  firstDescendantFileByFolderPath: ReadonlyMap<string, WorkspacePath>
}

const parentFolderPath = (path: string): WorkspacePath => {
  const normalized = normalizeWorkspacePath(path as WorkspacePath)
  if (normalized === '/') return '/' as WorkspacePath
  const idx = normalized.lastIndexOf('/')
  if (idx <= 0) return '/' as WorkspacePath
  return normalized.slice(0, idx) as WorkspacePath
}

const rememberFirstDescendant = (
  byFolder: Map<string, WorkspacePath>,
  filePath: WorkspacePath,
  parentPath: WorkspacePath | null | undefined,
): void => {
  let folder = normalizeWorkspacePath((parentPath || parentFolderPath(filePath)) as WorkspacePath)
  for (let depth = 0; depth < 128; depth += 1) {
    if (!byFolder.has(folder)) byFolder.set(folder, filePath)
    if (folder === '/') return
    folder = parentFolderPath(folder)
  }
}

export function buildWorkspaceEntriesIndex(entries: WorkspaceEntry[]): WorkspaceEntriesIndex {
  const byPath = new Map<string, WorkspaceEntry>()
  const filePathSet = new Set<string>()
  const filePaths: WorkspacePath[] = []
  const firstDescendantFileByFolderPath = new Map<string, WorkspacePath>()

  for (const entry of entries || []) {
    if (!entry) continue
    byPath.set(entry.path, entry)
    if (entry.kind !== 'file') continue
    filePathSet.add(entry.path)
    filePaths.push(entry.path)
    rememberFirstDescendant(firstDescendantFileByFolderPath, entry.path, entry.parentPath)
  }

  return {
    byPath,
    filePathSet,
    filePaths,
    firstFilePath: filePaths[0] || null,
    firstDescendantFileByFolderPath,
  }
}

export const getWorkspaceEntry = (
  entriesIndex: WorkspaceEntriesIndex,
  path: WorkspacePath | null | undefined,
): WorkspaceEntry | null => {
  const key = path ? normalizeWorkspacePath(path) : ''
  if (!key) return null
  return entriesIndex.byPath.get(key) || null
}

export const getWorkspaceFileEntry = (
  entriesIndex: WorkspaceEntriesIndex,
  path: WorkspacePath | null | undefined,
): (WorkspaceEntry & { kind: 'file' }) | null => {
  const entry = getWorkspaceEntry(entriesIndex, path)
  return entry?.kind === 'file' ? (entry as WorkspaceEntry & { kind: 'file' }) : null
}

export const hasWorkspaceEntry = (
  entriesIndex: WorkspaceEntriesIndex,
  path: WorkspacePath | null | undefined,
): boolean => !!getWorkspaceEntry(entriesIndex, path)

export const hasWorkspaceFileEntry = (
  entriesIndex: WorkspaceEntriesIndex,
  path: WorkspacePath | null | undefined,
): boolean => {
  const key = path ? normalizeWorkspacePath(path) : ''
  return !!key && entriesIndex.filePathSet.has(key)
}

export const getFirstDescendantFilePath = (
  entriesIndex: WorkspaceEntriesIndex,
  folderPath: WorkspacePath,
): WorkspacePath | null => {
  const key = normalizeWorkspacePath(folderPath)
  return entriesIndex.firstDescendantFileByFolderPath.get(key) || null
}
