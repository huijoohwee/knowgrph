import { hashStringToHex } from '@/lib/hash/stringHash'

export type SourceFilesWorkspaceState = {
  folderName: string | null
  accessMode: 'fs-access' | 'opfs' | 'file-input' | null
  folderCacheId: string | null
  selectedFolderPath: string | null
}

export const EMPTY_SOURCE_FILES_WORKSPACE_STATE: SourceFilesWorkspaceState = {
  folderName: null,
  accessMode: null,
  folderCacheId: null,
  selectedFolderPath: null,
}

const normalizeOptionalString = (value: unknown): string | null => {
  const next = String(value || '').trim()
  return next || null
}

const normalizeWorkspacePath = (value: unknown): string | null => {
  const raw = String(value || '').trim()
  if (!raw) return null
  const normalized = raw.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '')
  return normalized || null
}

export function normalizeSourceFilesWorkspaceState(value: unknown): SourceFilesWorkspaceState {
  const current = (value && typeof value === 'object' ? (value as Record<string, unknown>) : {})
  const accessModeRaw = normalizeOptionalString(current.accessMode)
  const accessMode: SourceFilesWorkspaceState['accessMode'] =
    accessModeRaw === 'fs-access' || accessModeRaw === 'opfs' || accessModeRaw === 'file-input'
      ? accessModeRaw
      : null
  return {
    folderName: normalizeOptionalString(current.folderName),
    accessMode,
    folderCacheId: normalizeOptionalString(current.folderCacheId),
    selectedFolderPath: normalizeWorkspacePath(current.selectedFolderPath),
  }
}

export function areSourceFilesWorkspaceStatesEqual(
  left: SourceFilesWorkspaceState | null | undefined,
  right: SourceFilesWorkspaceState | null | undefined,
): boolean {
  const aa = normalizeSourceFilesWorkspaceState(left)
  const bb = normalizeSourceFilesWorkspaceState(right)
  return (
    aa.folderName === bb.folderName &&
    aa.accessMode === bb.accessMode &&
    aa.folderCacheId === bb.folderCacheId &&
    aa.selectedFolderPath === bb.selectedFolderPath
  )
}

export function buildSourceFilesWorkspaceStateSignature(value: unknown): string {
  const normalized = normalizeSourceFilesWorkspaceState(value)
  return hashStringToHex(
    [
      String(normalized.folderName || ''),
      String(normalized.accessMode || ''),
      String(normalized.folderCacheId || ''),
      String(normalized.selectedFolderPath || ''),
    ].join('|'),
  )
}
