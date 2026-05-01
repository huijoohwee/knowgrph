import type { SourceFile } from '@/hooks/store/types'
import type { WorkspaceEntry } from '@/features/workspace-fs/types'
import type { WorkspaceSourceIndex } from '@/features/workspace-fs/sourceIndex'
import { hashStringToHex } from '@/lib/hash/stringHash'
import { areSourceFileRecordsEqual, buildSourceFileRecord, readSourceFileParsedState } from '@/features/source-files/sourceFileParsedState'
import {
  defaultEnabledForWorkspaceSourcePath,
  resolveWorkspaceSeedSourcePath,
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

    const seedSourcePath = resolveWorkspaceSeedSourcePath(path)
    const srcPath = seedSourcePath || workspaceSourcePathKey(path)
    const prev = existingWorkspaceByPath.get(srcPath) || null
    if (!prev && !sourcesByPath[path] && !forceInclude.has(path) && !seedSourcePath) continue
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
    const parsed = readSourceFileParsedState(prev)
    const candidate = buildSourceFileRecord({
      id,
      name: String(e.name || ''),
      text,
      enabled,
      geoLayerEnabled: prev?.geoLayerEnabled,
      status: prev?.status ?? 'idle',
      error: prev?.error,
      parserId: parsed.parsedParserId,
      textHash: parsed.parsedTextHash,
      graphData: parsed.parsedGraphData,
      previousState: prev,
      preserveExistingRevision: true,
      source,
    })

    if (prev && areSourceFileRecordsEqual(prev, candidate)) {
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
