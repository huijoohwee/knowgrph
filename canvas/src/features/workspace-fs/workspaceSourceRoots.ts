import { CHAT_LOCAL_STORAGE_ROOT_PATH_DEFAULT, normalizeChatLocalStorageRootPath } from '@/features/chat/chatStorageConfig'
import { normalizeWorkspacePath } from '@/features/workspace-fs/path'
import type { WorkspacePath } from '@/features/workspace-fs/types'

export const DEFAULT_WORKSPACE_SOURCE_ROOT_PATHS: WorkspacePath[] = ['/docs', CHAT_LOCAL_STORAGE_ROOT_PATH_DEFAULT]

export function resolveWorkspaceSourceRootPaths(args?: {
  chatLocalStorageRootPath?: string | null | undefined
}): WorkspacePath[] {
  const chatRoot = normalizeWorkspacePath(
    normalizeChatLocalStorageRootPath(args?.chatLocalStorageRootPath || CHAT_LOCAL_STORAGE_ROOT_PATH_DEFAULT) as WorkspacePath,
  )
  const unique = new Set<string>()
  const ordered: WorkspacePath[] = []
  for (const candidate of ['/docs', chatRoot]) {
    const normalized = normalizeWorkspacePath(candidate as WorkspacePath)
    if (unique.has(normalized)) continue
    unique.add(normalized)
    ordered.push(normalized)
  }
  return ordered
}

export function normalizeWorkspaceSourceRootPaths(rootPaths?: ReadonlyArray<string>): WorkspacePath[] {
  const unique = new Set<string>()
  const ordered: WorkspacePath[] = []
  const input = Array.isArray(rootPaths) && rootPaths.length > 0
    ? rootPaths
    : DEFAULT_WORKSPACE_SOURCE_ROOT_PATHS
  for (let i = 0; i < input.length; i += 1) {
    const raw = String(input[i] || '').trim()
    if (!raw) continue
    const normalized = normalizeWorkspacePath(raw as WorkspacePath)
    if (unique.has(normalized)) continue
    unique.add(normalized)
    ordered.push(normalized)
  }
  return ordered
}

export function isWorkspacePathUnderSourceRoots(path: string, rootPaths?: ReadonlyArray<string>): boolean {
  const normalizedPath = normalizeWorkspacePath(path as WorkspacePath)
  const roots = normalizeWorkspaceSourceRootPaths(rootPaths)
  for (let i = 0; i < roots.length; i += 1) {
    const root = normalizeWorkspacePath(String(roots[i] || '') as WorkspacePath)
    if (!root || root === '/') continue
    if (normalizedPath === root || normalizedPath.startsWith(`${root}/`)) return true
  }
  return false
}
