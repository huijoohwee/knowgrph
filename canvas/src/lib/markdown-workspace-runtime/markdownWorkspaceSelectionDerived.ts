import {
  workspaceDocumentKey,
  WORKSPACE_ROOT_PATH,
} from '@/features/workspace-fs/path'
import type { WorkspaceSourceIndex } from '@/features/workspace-fs/sourceIndex'
import type { WorkspaceEntry, WorkspacePath } from '@/features/workspace-fs/types'

export function deriveMarkdownWorkspaceSelectionState(args: {
  activePath: WorkspacePath | null
  selectionPath: WorkspacePath | null
  entries: WorkspaceEntry[]
  sourcesByPath: WorkspaceSourceIndex
}) {
  const activeEntry = args.activePath
    ? args.entries.find(entry => entry.path === args.activePath) || null
    : null
  const selectionEntry = args.selectionPath
    ? args.entries.find(entry => entry.path === args.selectionPath) || null
    : null
  const activeEntryKind = activeEntry ? activeEntry.kind : null
  const activeEntryText = activeEntry && activeEntry.kind === 'file' ? activeEntry.text : undefined
  const activeDocumentKey =
    args.activePath && (!activeEntry || activeEntry.kind === 'file')
      ? workspaceDocumentKey(args.activePath)
      : ''

  const source = args.activePath ? args.sourcesByPath[args.activePath] : null
  const sourceUrl = source && source.kind === 'url' ? String(source.url || '').trim() : ''
  const activeDocumentSourceUrl = sourceUrl ? sourceUrl : null

  const createParentPath = !selectionEntry
    ? WORKSPACE_ROOT_PATH
    : selectionEntry.kind === 'folder'
      ? selectionEntry.path
      : selectionEntry.parentPath || WORKSPACE_ROOT_PATH

  return {
    activeEntry,
    selectionEntry,
    activeEntryKind,
    activeEntryText,
    activeDocumentKey,
    activeDocumentSourceUrl,
    createParentPath,
  }
}
