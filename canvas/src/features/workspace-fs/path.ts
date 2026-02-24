import type { WorkspacePath } from './types'
import { coerceCodebaseRelPath } from '@/lib/codebase/relPath'

export const WORKSPACE_ROOT_PATH: WorkspacePath = '/'

export function normalizeWorkspacePath(raw: unknown): WorkspacePath {
  const rel = coerceCodebaseRelPath(raw)
  const s = String(rel || (raw ?? '')).trim().replace(/\\/g, '/')
  if (!s) return WORKSPACE_ROOT_PATH
  const withLeading = s.startsWith('/') ? s : `/${s}`
  const collapsed = withLeading.replace(/\/+/g, '/').replace(/\/+$/, '')
  return collapsed === '' ? WORKSPACE_ROOT_PATH : collapsed
}

export function splitWorkspacePath(path: WorkspacePath): string[] {
  const normalized = normalizeWorkspacePath(path)
  if (normalized === WORKSPACE_ROOT_PATH) return []
  return normalized.replace(/^\/+/, '').split('/').filter(Boolean)
}

export function joinWorkspacePath(parentPath: WorkspacePath, name: string): WorkspacePath {
  const parent = normalizeWorkspacePath(parentPath)
  const trimmed = String(name ?? '').trim().replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '')
  if (!trimmed) return parent
  if (parent === WORKSPACE_ROOT_PATH) return `/${trimmed}`
  return `${parent}/${trimmed}`
}

export function workspaceBasename(path: WorkspacePath): string {
  const parts = splitWorkspacePath(path)
  return parts[parts.length - 1] || ''
}

export function workspaceStem(path: WorkspacePath): string {
  const base = workspaceBasename(path)
  const i = base.lastIndexOf('.')
  return i > 0 ? base.slice(0, i) : base
}

export function workspaceExtLower(path: WorkspacePath): string {
  const base = workspaceBasename(path)
  const i = base.lastIndexOf('.')
  return i > 0 ? base.slice(i + 1).toLowerCase() : ''
}

export function workspaceDocumentKey(path: WorkspacePath): string {
  const parts = splitWorkspacePath(path)
  return parts.join('/')
}

export function ancestorPathsForWorkspacePath(path: WorkspacePath): WorkspacePath[] {
  const normalized = normalizeWorkspacePath(path)
  const parts = normalized.replace(/^\/+/, '').split('/').filter(Boolean)
  if (parts.length <= 1) return []
  const out: WorkspacePath[] = []
  let acc = ''
  for (let i = 0; i < parts.length - 1; i += 1) {
    const seg = String(parts[i] || '').trim()
    if (!seg) continue
    acc = acc ? `${acc}/${seg}` : seg
    out.push(normalizeWorkspacePath(acc))
  }
  return out
}
