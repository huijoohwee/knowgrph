import type { WorkspaceEntry, WorkspacePath } from '@/features/workspace-fs/types'
import { toCanonicalKgcWorkspacePath } from '@/features/chat/chatHistoryWorkspace.paths'

export function resolveMarkdownWorkspaceCanonicalSelection(args: {
  activePath: WorkspacePath | null
  selectionPath: WorkspacePath | null
  entries: WorkspaceEntry[]
}): { activePath: WorkspacePath; selectionPath: WorkspacePath | null } | null {
  const path = String(args.activePath || '').trim()
  if (!path) return null

  const canonicalPath = toCanonicalKgcWorkspacePath(path as WorkspacePath)
  if (!canonicalPath || canonicalPath === path) return null
  if (!args.entries.some(entry => entry.kind === 'file' && entry.path === canonicalPath)) return null

  return {
    activePath: canonicalPath,
    selectionPath: args.selectionPath === path ? canonicalPath : null,
  }
}
