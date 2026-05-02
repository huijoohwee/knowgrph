import { LS_KEYS } from '@/lib/config'
import { lsJson, lsSetJsonCoalesced } from '@/lib/persistence'
import type { WorkspacePath } from './types'
import { normalizeWorkspacePath } from './path'

export type WorkspaceEntrySource =
  | { kind: 'local'; originalName?: string | null }
  | { kind: 'url'; url: string }

export type WorkspaceSourceIndex = Record<string, WorkspaceEntrySource>

let cachedSourceIndex: WorkspaceSourceIndex | null = null
let cachedSourceIndexRev = 0

const noteNextSourceIndex = (next: WorkspaceSourceIndex): WorkspaceSourceIndex => {
  cachedSourceIndex = next
  cachedSourceIndexRev += 1
  // Let the shared runtime+persistence scheduler coalesce bursts naturally (last-write-wins).
  // Avoid rev-based signatures that defeat cross-cycle suppression/dedupe.
  lsSetJsonCoalesced(LS_KEYS.markdownWorkspaceSourcesByPath, next)
  return next
}

const areEntrySourcesEqual = (a: WorkspaceEntrySource | null, b: WorkspaceEntrySource | null): boolean => {
  if (a === b) return true
  if (!a || !b) return false
  if (a.kind !== b.kind) return false
  if (a.kind === 'url') return String(a.url || '') === String((b as { url?: unknown }).url || '')
  if (a.kind === 'local') return String(a.originalName || '') === String((b as { originalName?: unknown }).originalName || '')
  return false
}

const parseSourceIndex = (raw: unknown): WorkspaceSourceIndex => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const rec = raw as Record<string, unknown>
  const out: WorkspaceSourceIndex = {}
  for (const [k, v] of Object.entries(rec)) {
    const path = String(k || '').trim()
    if (!path) continue
    const normalizedPath = normalizeWorkspacePath(path)
    if (!v || typeof v !== 'object' || Array.isArray(v)) continue
    const src = v as Record<string, unknown>
    const kind = String(src.kind || '').trim()
    if (kind === 'url') {
      const url = String(src.url || '').trim()
      if (!url) continue
      const next = { kind: 'url', url } satisfies WorkspaceEntrySource
      const existing = out[normalizedPath]
      if (!existing || existing.kind !== 'url') out[normalizedPath] = next
      continue
    }
    if (kind === 'local') {
      const originalName = typeof src.originalName === 'string' ? src.originalName : null
      if (!out[normalizedPath]) out[normalizedPath] = { kind: 'local', originalName }
    }
  }
  return out
}

export function loadWorkspaceSourceIndex(): WorkspaceSourceIndex {
  if (cachedSourceIndex) return cachedSourceIndex
  const loaded = lsJson<WorkspaceSourceIndex>(LS_KEYS.markdownWorkspaceSourcesByPath, {}, parseSourceIndex)
  cachedSourceIndex = loaded
  return loaded
}

export function readReusableWorkspaceSourceIndexSnapshot(
  sourcesByPath: WorkspaceSourceIndex | null | undefined,
): WorkspaceSourceIndex | undefined {
  return sourcesByPath && typeof sourcesByPath === 'object' ? sourcesByPath : undefined
}

export function resolveWorkspaceSourceIndexSnapshot(
  sourcesByPath: WorkspaceSourceIndex | null | undefined,
): WorkspaceSourceIndex {
  return readReusableWorkspaceSourceIndexSnapshot(sourcesByPath) || loadWorkspaceSourceIndex()
}

export function setWorkspaceEntrySource(path: WorkspacePath, source: WorkspaceEntrySource | null): WorkspaceSourceIndex {
  const key = normalizeWorkspacePath(path)
  if (!key) return loadWorkspaceSourceIndex()
  const existing = loadWorkspaceSourceIndex()
  if (!source) {
    if (!(key in existing)) return existing
    const next: WorkspaceSourceIndex = { ...existing }
    delete next[key]
    return noteNextSourceIndex(next)
  }
  const prev = existing[key] || null
  if (areEntrySourcesEqual(prev, source)) return existing
  const next: WorkspaceSourceIndex = { ...existing, [key]: source }
  return noteNextSourceIndex(next)
}

export function bulkSetWorkspaceEntrySources(items: Array<{ path: WorkspacePath; source: WorkspaceEntrySource }>): WorkspaceSourceIndex {
  const existing = loadWorkspaceSourceIndex()
  const next: WorkspaceSourceIndex = { ...existing }
  let changed = false
  for (const item of items) {
    const key = normalizeWorkspacePath(item?.path)
    if (!key) continue
    const source = item?.source
    if (!source) continue
    const prev = existing[key] || null
    if (areEntrySourcesEqual(prev, source)) continue
    next[key] = source
    changed = true
  }
  if (!changed) return existing
  return noteNextSourceIndex(next)
}

export function removeWorkspaceEntrySourcesForPrefix(path: WorkspacePath): WorkspaceSourceIndex {
  const key = normalizeWorkspacePath(path)
  if (!key) return loadWorkspaceSourceIndex()
  const existing = loadWorkspaceSourceIndex()
  const next: WorkspaceSourceIndex = { ...existing }
  const prefix = key.endsWith('/') ? key : `${key}/`
  let changed = false
  for (const k of Object.keys(next)) {
    if (k === key || k.startsWith(prefix)) {
      delete next[k]
      changed = true
    }
  }
  if (!changed) return existing
  return noteNextSourceIndex(next)
}
