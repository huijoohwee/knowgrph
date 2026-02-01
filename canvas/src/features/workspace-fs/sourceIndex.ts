import { LS_KEYS } from '@/lib/config'
import { lsJson, lsSetJson } from '@/lib/persistence'
import type { WorkspacePath } from './types'
import { normalizeWorkspacePath } from './path'

export type WorkspaceEntrySource =
  | { kind: 'local'; originalName?: string | null }
  | { kind: 'url'; url: string }

export type WorkspaceSourceIndex = Record<string, WorkspaceEntrySource>

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
  return lsJson<WorkspaceSourceIndex>(LS_KEYS.markdownWorkspaceSourcesByPath, {}, parseSourceIndex)
}

export function setWorkspaceEntrySource(path: WorkspacePath, source: WorkspaceEntrySource | null): WorkspaceSourceIndex {
  const key = normalizeWorkspacePath(path)
  if (!key) return loadWorkspaceSourceIndex()
  const existing = loadWorkspaceSourceIndex()
  const next: WorkspaceSourceIndex = { ...existing }
  if (!source) {
    if (key in next) delete next[key]
    lsSetJson(LS_KEYS.markdownWorkspaceSourcesByPath, next)
    return next
  }
  next[key] = source
  lsSetJson(LS_KEYS.markdownWorkspaceSourcesByPath, next)
  return next
}

export function bulkSetWorkspaceEntrySources(items: Array<{ path: WorkspacePath; source: WorkspaceEntrySource }>): WorkspaceSourceIndex {
  const existing = loadWorkspaceSourceIndex()
  const next: WorkspaceSourceIndex = { ...existing }
  for (const item of items) {
    const key = normalizeWorkspacePath(item?.path)
    if (!key) continue
    const source = item?.source
    if (!source) continue
    next[key] = source
  }
  lsSetJson(LS_KEYS.markdownWorkspaceSourcesByPath, next)
  return next
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
  if (changed) lsSetJson(LS_KEYS.markdownWorkspaceSourcesByPath, next)
  return next
}
