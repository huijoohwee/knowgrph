import type { WorkspacePath } from '@/features/workspace-fs/types'
import { normalizeWorkspacePath } from '@/features/workspace-fs/path'
import { toCanonicalKgcWorkspacePath } from '@/features/chat/chatHistoryWorkspace.paths'

function normalizeWorkspaceDocsSuffixPath(path: WorkspacePath): WorkspacePath {
  const normalized = normalizeWorkspacePath(path)
  const docsSegment = '/docs/'
  if (normalized.startsWith(docsSegment)) return normalized
  const docsIndex = normalized.lastIndexOf(docsSegment)
  if (docsIndex < 0) return normalized
  return normalizeWorkspacePath(normalized.slice(docsIndex))
}

export function normalizeMarkdownWorkspaceSelectionPath(path: WorkspacePath | null): WorkspacePath | null {
  if (!path) return null
  return toCanonicalKgcWorkspacePath(
    normalizeWorkspaceDocsSuffixPath(path),
  )
}
