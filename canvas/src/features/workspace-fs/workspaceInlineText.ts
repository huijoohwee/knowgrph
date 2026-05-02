import { WORKSPACE_ENTRY_INLINE_TEXT_MAX_CHARS } from '@/lib/config'
import { normalizeWorkspacePath, WORKSPACE_ROOT_PATH } from './path'
import type { WorkspaceEntry, WorkspacePath } from './types'

export function resolveWorkspaceEntryInlineText(
  text: string,
  maxInlineChars: number = WORKSPACE_ENTRY_INLINE_TEXT_MAX_CHARS,
): string | undefined {
  return text.length <= maxInlineChars ? text : undefined
}

export function resolveWorkspaceSourceFileInlineText(
  text: string,
  maxInlineChars: number = WORKSPACE_ENTRY_INLINE_TEXT_MAX_CHARS,
): string {
  return resolveWorkspaceEntryInlineText(text, maxInlineChars) ?? ''
}

export function upsertWorkspaceEntryInlineText(args: {
  entries: WorkspaceEntry[]
  path: WorkspacePath
  text: string
  maxInlineChars?: number
  createIfMissing?: boolean
  updatedAtMs?: number
}): WorkspaceEntry[] {
  const normalizedPath = normalizeWorkspacePath(args.path)
  if (!normalizedPath || normalizedPath === '/') return args.entries

  const inlineText = resolveWorkspaceEntryInlineText(args.text, args.maxInlineChars)
  const updatedAtMs = typeof args.updatedAtMs === 'number' ? args.updatedAtMs : Date.now()
  let found = false
  let changed = false

  const next = args.entries.map(entry => {
    if (entry.kind !== 'file' || entry.path !== normalizedPath) return entry
    found = true
    if (entry.text === inlineText) return entry
    changed = true
    return { ...entry, text: inlineText, updatedAtMs }
  })

  if (found) return changed ? next : args.entries
  if (!args.createIfMissing) return args.entries

  const parts = normalizedPath.replace(/^\/+/, '').split('/').filter(Boolean)
  const name = parts[parts.length - 1] || ''
  const parentPath = parts.length <= 1 ? WORKSPACE_ROOT_PATH : normalizeWorkspacePath(parts.slice(0, -1).join('/'))
  const created: WorkspaceEntry = {
    path: normalizedPath,
    parentPath,
    kind: 'file',
    name,
    text: inlineText,
    updatedAtMs,
  }
  return [...args.entries, created].sort((left, right) => left.path.localeCompare(right.path))
}
