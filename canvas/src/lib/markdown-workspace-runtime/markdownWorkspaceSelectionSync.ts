import type { WorkspaceEntry, WorkspacePath } from '@/features/workspace-fs/types'

export function resolveInitialMarkdownWorkspaceSelectionPath(args: {
  selectionPath: WorkspacePath | null
  activePath: WorkspacePath | null
}): WorkspacePath | null {
  if (args.selectionPath) return null
  return args.activePath || null
}

export function resolveInvalidatedMarkdownWorkspaceSelectionPath(args: {
  selectionPath: WorkspacePath | null
  activePath: WorkspacePath | null
  entries: WorkspaceEntry[]
  loading: boolean
}): WorkspacePath | null | undefined {
  if (!args.selectionPath) return undefined
  if (args.loading) return undefined
  if (args.entries.some(entry => entry.path === args.selectionPath)) return undefined
  if (args.activePath && args.entries.some(entry => entry.path === args.activePath)) {
    return args.activePath
  }
  return null
}
