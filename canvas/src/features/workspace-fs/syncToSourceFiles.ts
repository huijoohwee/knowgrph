import type { SourceFile } from '@/hooks/store/types'
import type { WorkspaceEntry } from '@/features/workspace-fs/types'
import type { WorkspaceSourceIndex } from '@/features/workspace-fs/sourceIndex'
import { hashStringToHex } from '@/lib/hash/stringHash'
import { areSourceFileRecordsEqual, buildSourceFileRecord, readSourceFileParsedState } from '@/features/source-files/sourceFileParsedState'
import {
  defaultEnabledForWorkspaceSourcePath,
  isCanonicalWorkspaceSeedSourcePath,
  resolveWorkspaceSeedSourcePath,
} from '@/features/source-files/workspaceSeedSourceFiles'

export function workspaceSourcePathKey(path: string): string {
  const p = String(path || '').trim()
  return p ? `workspace:${p}` : 'workspace:'
}

export function resolveWorkspaceSourcePathKey(path: string): string {
  const raw = String(path || '').trim()
  const seedSourcePath = resolveWorkspaceSeedSourcePath(raw)
  if (seedSourcePath) return seedSourcePath
  const withoutWorkspacePrefix = raw.startsWith('workspace:') ? raw.slice('workspace:'.length) : raw
  return workspaceSourcePathKey(withoutWorkspacePrefix)
}

export function mergeWorkspaceEntriesIntoSourceFiles(args: {
  existing: SourceFile[]
  workspaceEntries: WorkspaceEntry[]
  sourcesByPath: WorkspaceSourceIndex
  forceIncludePaths?: string[]
  forceIncludeOnly?: boolean
  workspaceDocsOnly?: boolean
}): SourceFile[] {
  const existing = Array.isArray(args.existing) ? args.existing : []
  const entries = Array.isArray(args.workspaceEntries) ? args.workspaceEntries : []
  const sourcesByPath = args.sourcesByPath || {}
  const forceInclude = new Set((Array.isArray(args.forceIncludePaths) ? args.forceIncludePaths : []).map(path => String(path || '').trim()).filter(Boolean))
  const forceIncludeOnly = args.forceIncludeOnly === true && forceInclude.size > 0
  const workspaceDocsOnly = args.workspaceDocsOnly === true
  const docsMirrorCanonicalSeedSourcePathSet = new Set<string>(
    entries
      .filter(entry => entry?.kind === 'file')
      .map(entry => String(entry.path || '').trim())
      .filter(path => !forceIncludeOnly || forceInclude.has(path))
      .filter(path => path.startsWith('/docs/'))
      .map(path => {
        const normalized = path.replace(/\\/g, '/').replace(/\/+$/, '')
        const basename = normalized.split('/').pop() || ''
        return resolveWorkspaceSeedSourcePath(`/${basename}`)
      })
      .filter(
        (seedSourcePath): seedSourcePath is string =>
          !!seedSourcePath && isCanonicalWorkspaceSeedSourcePath(seedSourcePath),
      ),
  )

  const nonWorkspace = existing.filter(f => {
    const path = String(f?.source?.path || '')
    if (workspaceDocsOnly) return false
    return !path.startsWith('workspace:')
  })

  const existingWorkspaceByPath = new Map<string, SourceFile>()
  for (const f of existing) {
    const srcPath = String(f?.source?.path || '')
    if (!srcPath.startsWith('workspace:')) continue
    existingWorkspaceByPath.set(srcPath, f)
  }

  const nextWorkspaceBySourcePath = new Map<string, SourceFile>()
  const nextWorkspaceRankBySourcePath = new Map<string, number>()
  const nextWorkspaceKeyBySourcePath = new Map<string, string>()
  for (const e of entries) {
    if (!e || e.kind !== 'file') continue
    const path = String(e.path || '').trim()
    if (!path) continue
    if (forceIncludeOnly && !forceInclude.has(path)) continue
    if (workspaceDocsOnly && !path.startsWith('/docs/') && !forceInclude.has(path)) continue

    const seedSourcePath = resolveWorkspaceSeedSourcePath(path)
    const isLegacyRootSeedAliasCoveredByDocsMirror =
      !!seedSourcePath
      && isCanonicalWorkspaceSeedSourcePath(seedSourcePath)
      && !path.startsWith('/docs/')
      && docsMirrorCanonicalSeedSourcePathSet.has(seedSourcePath)
    if (isLegacyRootSeedAliasCoveredByDocsMirror) continue
    const srcPath = resolveWorkspaceSourcePathKey(path)
    const prev = existingWorkspaceByPath.get(srcPath) || null
    if (!prev && !sourcesByPath[path] && !forceInclude.has(path) && !seedSourcePath) continue
    const id = prev?.id || `ws:${hashStringToHex(srcPath)}`

    const src = sourcesByPath[path]
    const source: NonNullable<SourceFile['source']> =
      src && src.kind === 'url'
        ? { kind: 'url', url: String(src.url || ''), path: srcPath }
        : { kind: 'local', path: srcPath }

    const inlineText = typeof e.text === 'string' ? e.text : null
    const text = inlineText && inlineText.trim().length > 0
      ? inlineText
      : (prev?.text ?? '')

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

    const nextCandidate = prev && areSourceFileRecordsEqual(prev, candidate) ? prev : candidate
    const candidateRank =
      (forceInclude.has(path) ? 100 : 0)
      + (path.startsWith('/docs/') ? 10 : 0)
      + (typeof e.text === 'string' ? 1 : 0)
    const candidateSortKey = `${String(path).length}:${String(path)}`
    const previousRank = nextWorkspaceRankBySourcePath.get(srcPath)
    const previousSortKey = nextWorkspaceKeyBySourcePath.get(srcPath)
    if (typeof previousRank === 'number') {
      if (previousRank > candidateRank) continue
      if (previousRank === candidateRank && typeof previousSortKey === 'string' && previousSortKey <= candidateSortKey) continue
    }
    nextWorkspaceBySourcePath.set(srcPath, nextCandidate)
    nextWorkspaceRankBySourcePath.set(srcPath, candidateRank)
    nextWorkspaceKeyBySourcePath.set(srcPath, candidateSortKey)
  }

  const nextWorkspace = [...nextWorkspaceBySourcePath.values()]
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
