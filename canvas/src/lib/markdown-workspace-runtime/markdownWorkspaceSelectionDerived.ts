import {
  workspaceDocumentKey,
  WORKSPACE_ROOT_PATH,
} from '@/features/workspace-fs/path'
import type { WorkspaceSourceIndex } from '@/features/workspace-fs/sourceIndex'
import type { WorkspaceEntry, WorkspacePath } from '@/features/workspace-fs/types'
import { getWorkspaceEntry, type WorkspaceEntriesIndex } from './workspaceEntriesIndex'

export function deriveMarkdownWorkspaceSelectionState(args: {
  activePath: WorkspacePath | null
  selectionPath: WorkspacePath | null
  entriesIndex: WorkspaceEntriesIndex
  sourcesByPath: WorkspaceSourceIndex
}) {
  const activeEntry = args.activePath
    ? getWorkspaceEntry(args.entriesIndex, args.activePath)
    : null
  const selectionEntry = args.selectionPath
    ? getWorkspaceEntry(args.entriesIndex, args.selectionPath)
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
