import { ancestorPathsForWorkspacePath, normalizeWorkspacePath } from './path'
import type { WorkspacePath } from './types'
import type { WorkspaceEntrySource, WorkspaceSourceIndex } from './sourceIndex'
import { WORKSPACE_DOCS_SOURCE_ROOT_PATH } from './workspaceSourceRoots'

const isWorkspaceUnderRoot = (path: WorkspacePath, rootPath: WorkspacePath): boolean => {
  const normalizedPath = normalizeWorkspacePath(path)
  const normalizedRootPath = normalizeWorkspacePath(rootPath)
  if (!normalizedPath || !normalizedRootPath || normalizedRootPath === '/') return false
  if (normalizedPath === normalizedRootPath) return true
  return normalizedPath.startsWith(`${normalizedRootPath}/`)
}

const isWorkspaceDocsMirrorPath = (path: WorkspacePath): boolean => {
  return isWorkspaceUnderRoot(path, WORKSPACE_DOCS_SOURCE_ROOT_PATH)
}

const isSourceIndexedWorkspaceEntrySource = (source: WorkspaceEntrySource | undefined): boolean => {
  return source?.kind === 'local' || source?.kind === 'url'
}

export const buildWorkspaceDocsMirrorSourceOwnedPathSet = (
  sourceIndex: WorkspaceSourceIndex | null | undefined,
): Set<WorkspacePath> => {
  const out = new Set<WorkspacePath>()
  if (!sourceIndex || typeof sourceIndex !== 'object') return out
  const entries = Object.entries(sourceIndex)
  for (let i = 0; i < entries.length; i += 1) {
    const [rawPath, source] = entries[i]
    if (!isSourceIndexedWorkspaceEntrySource(source)) continue
    const path = normalizeWorkspacePath(rawPath)
    if (!isWorkspaceDocsMirrorPath(path)) continue
    out.add(path)
    const ancestors = ancestorPathsForWorkspacePath(path)
    for (let j = 0; j < ancestors.length; j += 1) {
      const ancestorPath = ancestors[j]
      if (isWorkspaceDocsMirrorPath(ancestorPath)) out.add(ancestorPath)
    }
  }
  return out
}

export const shouldPreserveWorkspaceDocsMirrorSyncEntry = (args: {
  path: WorkspacePath
  sourceIndex?: WorkspaceSourceIndex | null
  sourceOwnedPathSet?: ReadonlySet<WorkspacePath> | null
}): boolean => {
  const path = normalizeWorkspacePath(args.path)
  const sourceOwnedPathSet = args.sourceOwnedPathSet || buildWorkspaceDocsMirrorSourceOwnedPathSet(args.sourceIndex)
  return sourceOwnedPathSet.has(path)
}
