import type { SourceFile } from '@/hooks/store/types'
import type { WorkspaceEntry } from '@/features/workspace-fs/types'
import type { WorkspaceSourceIndex } from '@/features/workspace-fs/sourceIndex'
import { hashStringToHex } from '@/lib/hash/stringHash'
import {
  defaultEnabledForWorkspaceSourcePath,
  isCanonicalWorkspaceSeedSourcePath,
} from '@/features/source-files/workspaceSeedSourceFiles'

export function workspaceSourcePathKey(path: string): string {
  const p = String(path || '').trim()
  return p ? `workspace:${p}` : 'workspace:'
}

export function mergeWorkspaceEntriesIntoSourceFiles(args: {
  existing: SourceFile[]
  workspaceEntries: WorkspaceEntry[]
  sourcesByPath: WorkspaceSourceIndex
  forceIncludePaths?: string[]
}): SourceFile[] {
  const existing = Array.isArray(args.existing) ? args.existing : []
  const entries = Array.isArray(args.workspaceEntries) ? args.workspaceEntries : []
  const sourcesByPath = args.sourcesByPath || {}
  const forceInclude = new Set((Array.isArray(args.forceIncludePaths) ? args.forceIncludePaths : []).map(path => String(path || '').trim()).filter(Boolean))

  const sourceEqual = (a: SourceFile['source'] | undefined, b: SourceFile['source'] | undefined): boolean => {
    if (!a && !b) return true
    if (!a || !b) return false
    if (a.kind !== b.kind) return false
    if (String(a.path || '') !== String(b.path || '')) return false
    if (a.kind === 'url') {
      const aa = a as { url?: unknown }
      const bb = b as { url?: unknown }
      return String(aa.url || '') === String(bb.url || '')
    }
    return true
  }

  const workspaceFileEqual = (prev: SourceFile, next: SourceFile): boolean => {
    if (prev === next) return true
    if (String(prev.id || '') !== String(next.id || '')) return false
    if (String(prev.name || '') !== String(next.name || '')) return false
    if (String(prev.text || '') !== String(next.text || '')) return false
    if (Boolean(prev.enabled) !== Boolean(next.enabled)) return false
    if (Boolean(prev.geoLayerEnabled) !== Boolean(next.geoLayerEnabled)) return false
    if (String(prev.status || '') !== String(next.status || '')) return false
    if (String(prev.error || '') !== String(next.error || '')) return false
    if (String(prev.parsedParserId || '') !== String(next.parsedParserId || '')) return false
    if (String(prev.parsedTextHash || '') !== String(next.parsedTextHash || '')) return false
    if ((prev.parsedGraphRevision || 0) !== (next.parsedGraphRevision || 0)) return false
    if (prev.parsedGraphData !== next.parsedGraphData) return false
    if (!sourceEqual(prev.source, next.source)) return false
    return true
  }

  const nonWorkspace = existing.filter(f => {
    const path = String(f?.source?.path || '')
    return !path.startsWith('workspace:')
  })

  const existingWorkspaceByPath = new Map<string, SourceFile>()
  for (const f of existing) {
    const srcPath = String(f?.source?.path || '')
    if (!srcPath.startsWith('workspace:')) continue
    existingWorkspaceByPath.set(srcPath, f)
  }

  const nextWorkspace: SourceFile[] = []
  for (const e of entries) {
    if (!e || e.kind !== 'file') continue
    const path = String(e.path || '').trim()
    if (!path) continue

    const srcPath = workspaceSourcePathKey(path)
    const prev = existingWorkspaceByPath.get(srcPath) || null
    const isCanonicalSeed = isCanonicalWorkspaceSeedSourcePath(srcPath)
    if (!prev && !sourcesByPath[path] && !forceInclude.has(path) && !isCanonicalSeed) continue
    const id = prev?.id || `ws:${hashStringToHex(srcPath)}`

    const src = sourcesByPath[path]
    const source: NonNullable<SourceFile['source']> =
      src && src.kind === 'url'
        ? { kind: 'url', url: String(src.url || ''), path: srcPath }
        : { kind: 'local', path: srcPath }

    const inlineText = typeof e.text === 'string' ? e.text : null
    const text = inlineText != null ? inlineText : (prev?.text ?? '')

    const enabled = forceInclude.has(path)
      ? true
      : (prev?.enabled ?? defaultEnabledForWorkspaceSourcePath(srcPath, false))

    const candidate: SourceFile = {
      id,
      name: String(e.name || ''),
      text,
      enabled,
      geoLayerEnabled: prev?.geoLayerEnabled,
      status: prev?.status ?? 'idle',
      error: prev?.error,
      parsedParserId: prev?.parsedParserId,
      parsedTextHash: prev?.parsedTextHash,
      parsedGraphRevision: prev?.parsedGraphRevision,
      parsedGraphData: prev?.parsedGraphData,
      source,
    }

    if (prev && workspaceFileEqual(prev, candidate)) {
      nextWorkspace.push(prev)
    } else {
      nextWorkspace.push(candidate)
    }
  }

  const next = [...nonWorkspace, ...nextWorkspace]
  if (existing.length === next.length) {
    let same = true
    for (let i = 0; i < next.length; i += 1) {
      if (existing[i] !== next[i]) {
        same = false
        break
      }
    }
    if (same) return existing
  }
  return next
}
