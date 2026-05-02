import type { WorkspacePath } from '@/features/workspace-fs/types'
import {
  type MarkdownWorkspaceRestoreTextSnapshot,
  readMarkdownWorkspaceRestoreTextForPath,
  resolveMarkdownWorkspaceRestoreTextCandidate,
} from './markdownWorkspaceSelectionRestore'

export type MarkdownWorkspaceSelectionCollapseTransition =
  | { kind: 'capture-transition'; snapshot: { path: WorkspacePath; text: string } }
  | { kind: 'restore-transition'; text: string }
  | { kind: 'capture-collapsed'; snapshot: { path: WorkspacePath; text: string } }
  | { kind: 'restore-collapsed'; text: string }
  | { kind: 'noop' }

export function resolveMarkdownWorkspaceSelectionCollapseTransition(args: {
  path: WorkspacePath
  prevCollapsed: boolean
  collapsed: boolean
  activeText: string
  collapsedSnapshot: MarkdownWorkspaceRestoreTextSnapshot
  lastLoaded: MarkdownWorkspaceRestoreTextSnapshot
}): MarkdownWorkspaceSelectionCollapseTransition {
  if (args.prevCollapsed !== args.collapsed) {
    if (args.collapsed) {
      return {
        kind: 'capture-transition',
        snapshot: { path: args.path, text: args.activeText },
      }
    }

    const candidate = resolveMarkdownWorkspaceRestoreTextCandidate({
      path: args.path,
      collapsedSnapshot: args.collapsedSnapshot,
      lastLoaded: args.lastLoaded,
    })
    if (String(args.activeText || '').trim() || !candidate) return { kind: 'noop' }
    return candidate ? { kind: 'restore-transition', text: candidate } : { kind: 'noop' }
  }

  if (!args.collapsed) return { kind: 'noop' }
  if (String(args.activeText || '').trim()) {
    return {
      kind: 'capture-collapsed',
      snapshot: { path: args.path, text: args.activeText },
    }
  }

  const snapText = readMarkdownWorkspaceRestoreTextForPath(args.collapsedSnapshot, args.path)
  return snapText ? { kind: 'restore-collapsed', text: snapText } : { kind: 'noop' }
}
