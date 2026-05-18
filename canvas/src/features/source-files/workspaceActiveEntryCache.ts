import { normalizeWorkspacePath } from '@/features/workspace-fs/path'
import type { WorkspaceEntry, WorkspacePath } from '@/features/workspace-fs/types'

const ACTIVE_ENTRY_CACHE_MAX_PATHS = 12
const ACTIVE_ENTRY_CACHE_MAX_TOTAL_CHARS = 1_500_000
const ACTIVE_ENTRY_CACHE_MAX_ENTRY_CHARS = 500_000

type CachedActiveEntrySnapshot = {
  entries: WorkspaceEntry[]
  textChars: number
  updatedAtMs: number
}

const cachedActiveEntriesByPath = new Map<WorkspacePath, CachedActiveEntrySnapshot>()

function countWorkspaceEntryTextChars(entries: ReadonlyArray<WorkspaceEntry>): number {
  let total = 0
  for (const entry of entries) {
    if (!entry || entry.kind !== 'file') continue
    if (typeof entry.text !== 'string') continue
    total += entry.text.length
  }
  return total
}

function readSnapshotUpdatedAtMs(entries: ReadonlyArray<WorkspaceEntry>, activePath: WorkspacePath): number {
  let latest = 0
  for (const entry of entries) {
    if (!entry || entry.kind !== 'file') continue
    if (normalizeWorkspacePath(entry.path) !== activePath) continue
    const updatedAtMs = typeof entry.updatedAtMs === 'number' && Number.isFinite(entry.updatedAtMs)
      ? Math.max(0, Math.floor(entry.updatedAtMs))
      : 0
    latest = Math.max(latest, updatedAtMs)
  }
  return latest
}

function hasTextForActivePath(entries: ReadonlyArray<WorkspaceEntry>, activePath: WorkspacePath): boolean {
  return entries.some(entry => (
    entry?.kind === 'file' &&
    normalizeWorkspacePath(entry.path) === activePath &&
    typeof entry.text === 'string' &&
    entry.text.trim().length > 0
  ))
}

function pruneActiveEntryCache(): void {
  let totalChars = 0
  for (const entry of cachedActiveEntriesByPath.values()) {
    totalChars += entry.textChars
  }
  while (
    cachedActiveEntriesByPath.size > ACTIVE_ENTRY_CACHE_MAX_PATHS ||
    totalChars > ACTIVE_ENTRY_CACHE_MAX_TOTAL_CHARS
  ) {
    const oldestKey = cachedActiveEntriesByPath.keys().next().value
    if (typeof oldestKey !== 'string') break
    const oldest = cachedActiveEntriesByPath.get(oldestKey)
    cachedActiveEntriesByPath.delete(oldestKey)
    totalChars -= oldest?.textChars || 0
  }
}

export function readCachedWorkspaceActiveEntrySnapshot(args: {
  activePath: WorkspacePath
  minUpdatedAtMs?: number
}): WorkspaceEntry[] | undefined {
  const activePath = normalizeWorkspacePath(args.activePath)
  if (!activePath || activePath === '/') return undefined
  const cached = cachedActiveEntriesByPath.get(activePath)
  if (!cached) return undefined
  const minUpdatedAtMs = typeof args.minUpdatedAtMs === 'number' ? Math.max(0, Math.floor(args.minUpdatedAtMs)) : 0
  if (minUpdatedAtMs > 0 && cached.updatedAtMs > 0 && cached.updatedAtMs < minUpdatedAtMs) {
    cachedActiveEntriesByPath.delete(activePath)
    return undefined
  }
  cachedActiveEntriesByPath.delete(activePath)
  cachedActiveEntriesByPath.set(activePath, cached)
  return cached.entries
}

export function rememberWorkspaceActiveEntrySnapshot(args: {
  activePath: WorkspacePath
  entries: WorkspaceEntry[]
}): WorkspaceEntry[] | undefined {
  const activePath = normalizeWorkspacePath(args.activePath)
  if (!activePath || activePath === '/') return undefined
  const entries = Array.isArray(args.entries) ? args.entries : []
  if (!hasTextForActivePath(entries, activePath)) {
    cachedActiveEntriesByPath.delete(activePath)
    return undefined
  }
  const textChars = countWorkspaceEntryTextChars(entries)
  if (textChars > ACTIVE_ENTRY_CACHE_MAX_ENTRY_CHARS) {
    cachedActiveEntriesByPath.delete(activePath)
    return undefined
  }
  const snapshot = entries.slice()
  cachedActiveEntriesByPath.set(activePath, {
    entries: snapshot,
    textChars,
    updatedAtMs: readSnapshotUpdatedAtMs(snapshot, activePath),
  })
  pruneActiveEntryCache()
  return snapshot
}

export function invalidateCachedWorkspaceActiveEntrySnapshot(path?: WorkspacePath | null): void {
  const normalizedPath = normalizeWorkspacePath(String(path || '').trim())
  if (!normalizedPath || normalizedPath === '/') {
    cachedActiveEntriesByPath.clear()
    return
  }
  cachedActiveEntriesByPath.delete(normalizedPath)
}
