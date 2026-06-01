import type { WorkspacePath } from '@/features/workspace-fs/types'
import { hasWorkspaceEntry, type WorkspaceEntriesIndex } from './workspaceEntriesIndex'
import { normalizeMarkdownWorkspaceSelectionPath } from './markdownWorkspaceSelectionPath'
import { resolveMarkdownWorkspaceDocsMirrorCanonicalPath } from './markdownWorkspaceSelectionCanonicalPath'

export function resolveInitialMarkdownWorkspaceSelectionPath(args: {
  selectionPath: WorkspacePath | null
  activePath: WorkspacePath | null
  entriesIndex: WorkspaceEntriesIndex
}): WorkspacePath | null {
  const rawActivePath = normalizeMarkdownWorkspaceSelectionPath(args.activePath)
  if (!rawActivePath) return null
  const activePath = resolveMarkdownWorkspaceDocsMirrorCanonicalPath(rawActivePath, args.entriesIndex) || rawActivePath
  const rawSelectionPath = normalizeMarkdownWorkspaceSelectionPath(args.selectionPath)
  const selectionPath = rawSelectionPath
    ? (resolveMarkdownWorkspaceDocsMirrorCanonicalPath(rawSelectionPath, args.entriesIndex) || rawSelectionPath)
    : null
  if (selectionPath === activePath) return null
  const selectionPathPrefix = String(selectionPath || '').replace(/\/+$/, '')
  if (selectionPathPrefix && String(activePath || '').startsWith(`${selectionPathPrefix}/`)) return null
  return activePath
}

export function resolveInvalidatedMarkdownWorkspaceSelectionPath(args: {
  selectionPath: WorkspacePath | null
  activePath: WorkspacePath | null
  entriesIndex: WorkspaceEntriesIndex
  loading: boolean
}): WorkspacePath | null | undefined {
  const selectionPath = normalizeMarkdownWorkspaceSelectionPath(args.selectionPath)
  if (!selectionPath) return undefined
  const activePath = normalizeMarkdownWorkspaceSelectionPath(args.activePath)
  if (activePath && selectionPath === activePath) return undefined
  if (args.loading) return undefined
  if (hasWorkspaceEntry(args.entriesIndex, selectionPath)) return undefined
  if (activePath && hasWorkspaceEntry(args.entriesIndex, activePath)) {
    return activePath
  }
  return null
}

export function resolveActivePathFromWorkspaceFileSelection(args: {
  selectionPath: WorkspacePath | null
  activePath: WorkspacePath | null
  entriesIndex?: WorkspaceEntriesIndex
  selectionEntryKind: string | null
}): WorkspacePath | null {
  const rawSelectionPath = normalizeMarkdownWorkspaceSelectionPath(args.selectionPath)
  const selectionPath = rawSelectionPath && args.entriesIndex
    ? (resolveMarkdownWorkspaceDocsMirrorCanonicalPath(rawSelectionPath, args.entriesIndex) || rawSelectionPath)
    : rawSelectionPath
  if (!selectionPath) return null
  if (args.selectionEntryKind !== 'file') return null
  const rawActivePath = normalizeMarkdownWorkspaceSelectionPath(args.activePath)
  const activePath = rawActivePath && args.entriesIndex
    ? (resolveMarkdownWorkspaceDocsMirrorCanonicalPath(rawActivePath, args.entriesIndex) || rawActivePath)
    : rawActivePath
  if (selectionPath === activePath) return null
  return selectionPath as WorkspacePath
}
