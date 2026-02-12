import type { SourceFile } from '@/hooks/store/types'
import type { WorkspaceEntry } from '@/features/workspace-fs/types'
import type { WorkspaceSourceIndex } from '@/features/workspace-fs/sourceIndex'
import { hashStringToHex } from '@/lib/hash/stringHash'

export function workspaceSourcePathKey(path: string): string {
  const p = String(path || '').trim()
  return p ? `workspace:${p}` : 'workspace:'
}

export function mergeWorkspaceEntriesIntoSourceFiles(args: {
  existing: SourceFile[]
  workspaceEntries: WorkspaceEntry[]
  sourcesByPath: WorkspaceSourceIndex
}): SourceFile[] {
  const existing = Array.isArray(args.existing) ? args.existing : []
  const entries = Array.isArray(args.workspaceEntries) ? args.workspaceEntries : []
  const sourcesByPath = args.sourcesByPath || {}

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
    const id = prev?.id || `ws:${hashStringToHex(srcPath)}`

    const src = sourcesByPath[path]
    const source: NonNullable<SourceFile['source']> =
      src && src.kind === 'url'
        ? { kind: 'url', url: String(src.url || ''), path: srcPath }
        : { kind: 'local', path: srcPath }

    const inlineText = typeof e.text === 'string' ? e.text : null
    const text = inlineText != null ? inlineText : (prev?.text ?? '')

    nextWorkspace.push({
      id,
      name: String(e.name || ''),
      text,
      enabled: prev?.enabled ?? false,
      geoLayerEnabled: prev?.geoLayerEnabled,
      status: prev?.status ?? 'idle',
      error: prev?.error,
      parsedParserId: prev?.parsedParserId,
      parsedTextHash: prev?.parsedTextHash,
      parsedGraphData: prev?.parsedGraphData,
      source,
    })
  }

  return [...nonWorkspace, ...nextWorkspace]
}

