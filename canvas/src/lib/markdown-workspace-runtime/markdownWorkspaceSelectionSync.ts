import type { WorkspacePath } from '@/features/workspace-fs/types'
import { hasWorkspaceEntry, type WorkspaceEntriesIndex } from './workspaceEntriesIndex'

export function resolveInitialMarkdownWorkspaceSelectionPath(args: {
  selectionPath: WorkspacePath | null
  activePath: WorkspacePath | null
}): WorkspacePath | null {
  if (!args.activePath) return null
  if (args.selectionPath === args.activePath) return null
  return args.activePath
}

export function resolveInvalidatedMarkdownWorkspaceSelectionPath(args: {
  selectionPath: WorkspacePath | null
  activePath: WorkspacePath | null
  entriesIndex: WorkspaceEntriesIndex
  loading: boolean
}): WorkspacePath | null | undefined {
  if (!args.selectionPath) return undefined
  if (args.loading) return undefined
  if (hasWorkspaceEntry(args.entriesIndex, args.selectionPath)) return undefined
  if (args.activePath && hasWorkspaceEntry(args.entriesIndex, args.activePath)) {
    return args.activePath
  }
  return null
}
