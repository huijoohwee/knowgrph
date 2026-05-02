import type { WorkspacePath } from '@/features/workspace-fs/types'
import { normalizeWorkspacePath } from '@/features/workspace-fs/path'
import { toCanonicalKgcWorkspacePath } from '@/features/chat/chatHistoryWorkspace.paths'

export function normalizeMarkdownWorkspaceSelectionPath(path: WorkspacePath | null): WorkspacePath | null {
  if (!path) return null
  return toCanonicalKgcWorkspacePath(normalizeWorkspacePath(path))
}
