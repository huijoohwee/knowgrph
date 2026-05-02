import type { WorkspacePath } from '@/features/workspace-fs/types'

export type MarkdownWorkspaceRestoreTextSnapshot = {
  path: WorkspacePath
  text: string
} | null

export function readMarkdownWorkspaceRestoreTextForPath(
  snapshot: MarkdownWorkspaceRestoreTextSnapshot,
  path: WorkspacePath,
): string {
  if (!snapshot || snapshot.path !== path) return ''
  return String(snapshot.text || '').trim() ? snapshot.text : ''
}

export function resolveMarkdownWorkspaceRestoreTextCandidate(args: {
  path: WorkspacePath
  collapsedSnapshot: MarkdownWorkspaceRestoreTextSnapshot
  lastLoaded: MarkdownWorkspaceRestoreTextSnapshot
}): string {
  return (
    readMarkdownWorkspaceRestoreTextForPath(args.collapsedSnapshot, args.path) ||
    readMarkdownWorkspaceRestoreTextForPath(args.lastLoaded, args.path)
  )
}
