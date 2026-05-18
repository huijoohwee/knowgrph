import type { WorkspacePath } from '@/features/workspace-fs/types'
import { toCanonicalKgcWorkspacePath } from '@/features/chat/chatHistoryWorkspace.paths'
import { hasWorkspaceFileEntry, type WorkspaceEntriesIndex } from './workspaceEntriesIndex'

export function resolveMarkdownWorkspaceCanonicalSelection(args: {
  activePath: WorkspacePath | null
  selectionPath: WorkspacePath | null
  entriesIndex: WorkspaceEntriesIndex
}): { activePath: WorkspacePath; selectionPath: WorkspacePath | null } | null {
  const path = String(args.activePath || '').trim()
  if (!path) return null

  const canonicalPath = toCanonicalKgcWorkspacePath(path as WorkspacePath)
  if (!canonicalPath || canonicalPath === path) return null
  if (!hasWorkspaceFileEntry(args.entriesIndex, canonicalPath)) return null

  return {
    activePath: canonicalPath,
    selectionPath: args.selectionPath === path ? canonicalPath : null,
  }
}
