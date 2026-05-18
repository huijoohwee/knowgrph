import { scheduleApplyComposedGraphFromSourceFiles } from '@/features/source-files/applyComposedGraphFromSourceFiles'
import {
  areSourceFileRecordsEqual,
  normalizeSourceFileRecord,
} from '@/features/source-files/sourceFileParsedState'
import {
  buildSourceFileGraphSnapshotId,
  readKnowgrphSourceFileIdFromDocumentId,
} from '@/features/source-files/sourceFilesStorageSync'
import { workspaceBasename } from '@/features/workspace-fs/path'
import { resolveWorkspaceSourcePathKey } from '@/features/workspace-fs/syncToSourceFiles'
import { hashStringToHex } from '@/lib/hash/stringHash'
import { readEnvString } from '@/lib/config.env'
import { useGraphStore } from '@/hooks/useGraphStore'
import type { SourceFile } from '@/hooks/store/types'
import type { GraphData } from '@/lib/graph/types'
import type {
  KgDocumentRecord,
  KgDocumentChunkRecord,
  KgGraphSnapshotRecord,
  KnowgrphStoragePullResponse,
} from '@/lib/storage/knowgrphStorageSyncContract'
import { KNOWGRPH_STORAGE_ROUTE_PATHS } from '@/lib/storage/knowgrphStorageSyncContract'

const normalizeString = (value: unknown): string => String(value || '').trim()

const looksLikeHttpUrl = (value: string): boolean => /^https?:\/\//i.test(value)

const readSourceFileNameFromCanonicalPath = (canonicalPath: string, fallbackTitle: string | null): string => {
  const safeTitle = normalizeString(fallbackTitle)
  if (safeTitle) return safeTitle
  if (looksLikeHttpUrl(canonicalPath)) {
    try {
      const url = new URL(canonicalPath)
      const parts = url.pathname.split('/').filter(Boolean)
      return parts[parts.length - 1] || url.hostname || 'remote.md'
    } catch {
      return canonicalPath || 'remote.md'
    }
  }
  const path = canonicalPath.startsWith('/') ? canonicalPath : `/${canonicalPath}`
  return workspaceBasename(path) || canonicalPath || 'remote.md'
}

const normalizeMarkdownWorkspaceDocsSourcePathFromCanonicalPath = (canonicalPathRaw: string): string => {
  const canonicalPath = normalizeString(canonicalPathRaw).replace(/\\/g, '/')
  if (!canonicalPath || looksLikeHttpUrl(canonicalPath)) return ''
  const withoutWorkspacePrefix = canonicalPath.startsWith('workspace:') ? canonicalPath.slice('workspace:'.length) : canonicalPath
  const normalized = withoutWorkspacePrefix.replace(/^\/+/, '')
  const lower = normalized.toLowerCase()
  const marker = 'huijoohwee/docs/'
  let docsRelative = ''
  const markerIndex = lower.indexOf(marker)
  if (markerIndex >= 0) {
    docsRelative = normalized.slice(markerIndex + marker.length)
  } else if (lower.startsWith('docs/')) {
    docsRelative = normalized.slice('docs/'.length)
  } else {
    return ''
  }
  const rel = docsRelative
    .split('/')
    .filter(Boolean)
    .join('/')
  if (!rel) return ''
  return `workspace:/docs/${rel}`
}

const normalizeStorageCanonicalPathCandidate = (value: string): string => {
  const normalized = normalizeString(value).replace(/\\/g, '/').replace(/^workspace:/, '').replace(/^\/+/, '')
  if (!normalized || looksLikeHttpUrl(normalized)) return ''
  const lower = normalized.toLowerCase()
  const marker = 'huijoohwee/docs/'
  if (lower.includes(marker)) {
    const idx = lower.indexOf(marker)
    return normalized.slice(idx)
  }
  if (lower.startsWith('docs/')) return `huijoohwee/${normalized}`
  return normalized
}

const readStorageCanonicalPathCandidatesForDocument = (args: {
  documentCanonicalPath: string
  sourcePath: string
}): string[] => {
  const out = new Set<string>()
  const pushWorkspaceCanonical = (value: string) => {
    const normalized = normalizeString(value).replace(/\\/g, '/')
    if (!normalized.startsWith('workspace:/')) return
    const lower = normalized.toLowerCase()
    if (!lower.endsWith('.md') && !lower.endsWith('.markdown') && !lower.endsWith('.mdx') && !lower.endsWith('.mmd')) return
    out.add(normalized)
  }
  const push = (value: string) => {
    const normalized = normalizeStorageCanonicalPathCandidate(value)
    if (!normalized) return
    const lower = normalized.toLowerCase()
    if (!lower.endsWith('.md') && !lower.endsWith('.markdown') && !lower.endsWith('.mdx') && !lower.endsWith('.mmd')) return
    if (lower.includes('/huijoohwee/docs/huijoohwee/docs/')) return
    out.add(normalized)
  }
  pushWorkspaceCanonical(args.documentCanonicalPath)
  push(args.documentCanonicalPath)
  const sourcePath = normalizeString(args.sourcePath)
  if (sourcePath.startsWith('workspace:/docs/')) {
    pushWorkspaceCanonical(sourcePath)
    const rel = sourcePath.slice('workspace:/docs/'.length).replace(/^\/+/, '')
    if (rel) {
      push(`huijoohwee/docs/${rel}`)
      push(`docs/${rel}`)
    }
  }
  return [...out]
}

const buildKnowgrphStorageRequestUrl = (args: { path: string; baseUrl: string }): string => {
  const safePath = normalizeString(args.path)
  if (!safePath) return ''
  if (typeof window !== 'undefined') {
    const host = normalizeString(window.location?.hostname).toLowerCase()
    const isLocalhost = host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0'
    if (isLocalhost && safePath.startsWith('/api/storage/')) return safePath
  }
  const baseUrl = normalizeString(args.baseUrl)
  if (!baseUrl) return safePath
  return new URL(safePath, baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`).toString()
}

const readStorageDocFallbackText = async (args: {
  workspaceId: string
  canonicalPathCandidates: string[]
}): Promise<string> => {
  if (typeof fetch !== 'function') return ''
  const baseUrl = normalizeString(readEnvString('VITE_KNOWGRPH_STORAGE_BASE_URL', ''))
  const workspaceId = normalizeString(args.workspaceId)
  if (!baseUrl || !workspaceId) return ''
  for (let i = 0; i < args.canonicalPathCandidates.length; i += 1) {
    const canonicalPath = normalizeStorageCanonicalPathCandidate(args.canonicalPathCandidates[i] || '')
    if (!canonicalPath) continue
    const docPath = `${KNOWGRPH_STORAGE_ROUTE_PATHS.docPrefix}${encodeURIComponent(workspaceId)}/${encodeURIComponent(canonicalPath)}`
    const requestUrl = buildKnowgrphStorageRequestUrl({ path: docPath, baseUrl })
    if (!requestUrl) continue
    try {
      const response = await fetch(requestUrl)
      if (!response.ok) continue
      const text = String(await response.text())
      if (text.trim()) return text
    } catch {
      void 0
    }
  }
  return ''
}

const scheduleBlankPulledDocsHydration = (args: {
  workspaceId: string
  tasks: Array<{ sourceFileId: string; sourcePath: string; canonicalPathCandidates: string[] }>
}) => {
  if (!Array.isArray(args.tasks) || args.tasks.length === 0) return
  void (async () => {
    const bySourceFileId = new Map<string, string>()
    for (let i = 0; i < args.tasks.length; i += 1) {
      const task = args.tasks[i]
      if (!task) continue
      const sourceFileId = normalizeString(task.sourceFileId)
      if (!sourceFileId || bySourceFileId.has(sourceFileId)) continue
      const fallbackText = await readStorageDocFallbackText({
        workspaceId: args.workspaceId,
        canonicalPathCandidates: task.canonicalPathCandidates,
      })
      if (!fallbackText.trim()) continue
      bySourceFileId.set(sourceFileId, fallbackText)
    }
    if (bySourceFileId.size === 0) return
    const state = useGraphStore.getState()
    const currentSourceFiles = Array.isArray(state.sourceFiles) ? state.sourceFiles : []
    let changed = false
    const next = currentSourceFiles.map(file => {
      if (!file) return file
      const sourceFileId = normalizeString(file.id)
      const sourcePath = resolveWorkspaceSourcePathKey(normalizeString(file.source?.path))
      let replacementText = bySourceFileId.get(sourceFileId) || ''
      if (!replacementText) {
        for (let i = 0; i < args.tasks.length; i += 1) {
          const task = args.tasks[i]
          if (!task) continue
          if (resolveWorkspaceSourcePathKey(normalizeString(task.sourcePath)) !== sourcePath) continue
          replacementText = bySourceFileId.get(normalizeString(task.sourceFileId)) || ''
          if (replacementText) break
        }
      }
      if (!replacementText.trim()) return file
      if (String(file.text || '').trim()) return file
      changed = true
      return normalizeSourceFileRecord({
        ...file,
        text: replacementText,
      })
    })
    if (!changed) return
    state.setSourceFiles(next)
    scheduleApplyComposedGraphFromSourceFiles()
  })()
}

const resolvePulledDocumentSourceFileIdentity = (document: KgDocumentRecord): {
  id: string
  sourcePath: string
} | null => {
  const canonicalizeWorkspaceSourcePath = (value: string): string =>
    looksLikeHttpUrl(value) ? value : resolveWorkspaceSourcePathKey(value)
  const sourceFileId = readKnowgrphSourceFileIdFromDocumentId(document.id)
  if (sourceFileId) {
    const sourcePath = canonicalizeWorkspaceSourcePath(normalizeString(document.canonicalPath))
    if (!sourcePath) return null
    return { id: sourceFileId, sourcePath }
  }
  const sourcePath = canonicalizeWorkspaceSourcePath(
    normalizeMarkdownWorkspaceDocsSourcePathFromCanonicalPath(document.canonicalPath),
  )
  if (!sourcePath) return null
  return {
    id: `ws:${hashStringToHex(sourcePath)}`,
    sourcePath,
  }
}

const readGraphSnapshotByDocumentId = (
  graphSnapshots: KgGraphSnapshotRecord[],
  documentId: string,
): KgGraphSnapshotRecord | null => {
  for (let i = 0; i < graphSnapshots.length; i += 1) {
    const snapshot = graphSnapshots[i]
    if (!snapshot) continue
    if (normalizeString(snapshot.documentId) === documentId) return snapshot
  }
  return null
}

const readGraphSnapshotById = (
  graphSnapshots: KgGraphSnapshotRecord[],
  id: string,
): KgGraphSnapshotRecord | null => {
  for (let i = 0; i < graphSnapshots.length; i += 1) {
    const snapshot = graphSnapshots[i]
    if (!snapshot) continue
    if (normalizeString(snapshot.id) === id) return snapshot
  }
  return null
}

const readPulledDocumentMarkdownByDocumentId = (
  documentChunks: KgDocumentChunkRecord[],
  workspaceId: string,
): Map<string, string> => {
  const safeWorkspaceId = normalizeString(workspaceId)
  const chunksByDocumentId = new Map<string, Array<{ order: number; markdown: string; id: string }>>()
  for (let i = 0; i < documentChunks.length; i += 1) {
    const chunk = documentChunks[i]
    if (!chunk) continue
    if (normalizeString(chunk.workspaceId) !== safeWorkspaceId) continue
    const documentId = normalizeString(chunk.documentId)
    if (!documentId) continue
    const markdown = String(chunk.markdown || '')
    if (!markdown.trim()) continue
    const chunkOrderRaw = Number(chunk.chunkOrder)
    const chunkOrder = Number.isFinite(chunkOrderRaw) ? Math.floor(chunkOrderRaw) : i
    const list = chunksByDocumentId.get(documentId) || []
    list.push({ order: chunkOrder, markdown, id: normalizeString(chunk.id) })
    chunksByDocumentId.set(documentId, list)
  }
  const markdownByDocumentId = new Map<string, string>()
  chunksByDocumentId.forEach((chunks, documentId) => {
    const text = chunks
      .slice()
      .sort((a, b) => (a.order - b.order) || a.id.localeCompare(b.id))
      .map(chunk => chunk.markdown)
      .join('\n\n')
    if (text.trim()) markdownByDocumentId.set(documentId, text)
  })
  return markdownByDocumentId
}

const buildSourceFileFromStorageDocument = (
  sourceFileId: string,
  sourcePath: string,
  document: KgDocumentRecord,
  markdownText: string,
  graphSnapshot: KgGraphSnapshotRecord | null,
  existing: SourceFile | null,
): SourceFile => {
  const nextText = String(markdownText || '').trim()
    ? String(markdownText || '')
    : String(existing?.text || '')
  const graphData = graphSnapshot?.graphJson as unknown as GraphData | undefined
  const isHttpSource = looksLikeHttpUrl(sourcePath)
  const source = isHttpSource
    ? { kind: 'url' as const, url: sourcePath }
    : { kind: 'local' as const, path: sourcePath }
  const fallbackTitle = isHttpSource ? document.title : null
  const name = isHttpSource
    ? readSourceFileNameFromCanonicalPath(sourcePath, fallbackTitle)
    : workspaceBasename(sourcePath.startsWith('/') ? sourcePath : `/${sourcePath}`) || readSourceFileNameFromCanonicalPath(sourcePath, document.title)
  return normalizeSourceFileRecord({
    id: sourceFileId,
    name,
    text: nextText,
    enabled: existing ? !!existing.enabled : true,
    ...(typeof existing?.geoLayerEnabled === 'boolean' ? { geoLayerEnabled: existing.geoLayerEnabled } : {}),
    status: graphData ? 'parsed' : existing?.status || 'idle',
    error: undefined,
    parsedParserId: graphSnapshot ? normalizeString(document.parserVersion) || 'remote-sync' : existing?.parsedParserId,
    parsedTextHash: existing?.parsedTextHash,
    parsedGraphRevision: graphSnapshot?.graphRevision ?? existing?.parsedGraphRevision,
    parsedGraphData: graphData ?? existing?.parsedGraphData,
    source,
  })
}

export const applyPulledKnowgrphStorageChangesToSourceFiles = (args: {
  workspaceId: string
  changes: KnowgrphStoragePullResponse['changes']
}): { applied: boolean; nextCount: number } => {
  const current = useGraphStore.getState()
  const currentSourceFiles = Array.isArray(current.sourceFiles) ? current.sourceFiles : []
  const next = currentSourceFiles.slice()
  let changed = false
  const graphSnapshots = Array.isArray(args.changes.graphSnapshots) ? args.changes.graphSnapshots : []
  const documents = Array.isArray(args.changes.documents) ? args.changes.documents : []
  const documentChunks = Array.isArray(args.changes.documentChunks) ? args.changes.documentChunks : []
  const pulledMarkdownByDocumentId = readPulledDocumentMarkdownByDocumentId(documentChunks, args.workspaceId)
  const blankPulledDocHydrationTasks: Array<{ sourceFileId: string; sourcePath: string; canonicalPathCandidates: string[] }> = []

  for (let i = 0; i < documents.length; i += 1) {
    const document = documents[i]
    if (!document) continue
    if (normalizeString(document.workspaceId) !== normalizeString(args.workspaceId)) continue
    const identity = resolvePulledDocumentSourceFileIdentity(document)
    if (!identity) continue
    const sourceFileId = identity.id
    const currentIndex = next.findIndex(file =>
      normalizeString(file?.id) === sourceFileId
      || (
        normalizeString(file?.source?.path) === identity.sourcePath
        || resolveWorkspaceSourcePathKey(normalizeString(file?.source?.path)) === identity.sourcePath
      ),
    )
    if (document.deleted) {
      if (currentIndex >= 0) {
        next.splice(currentIndex, 1)
        changed = true
      }
      continue
    }
    const graphSnapshot =
      readGraphSnapshotByDocumentId(graphSnapshots, document.id)
      || readGraphSnapshotById(graphSnapshots, buildSourceFileGraphSnapshotId(sourceFileId))
    const existing = currentIndex >= 0 ? next[currentIndex] || null : null
    const markdownText = (() => {
      const inline = String(document.contentMd || '')
      if (inline.trim()) return inline
      return String(pulledMarkdownByDocumentId.get(normalizeString(document.id)) || '')
    })()
    if (!markdownText.trim()) {
      blankPulledDocHydrationTasks.push({
        sourceFileId,
        sourcePath: identity.sourcePath,
        canonicalPathCandidates: readStorageCanonicalPathCandidatesForDocument({
          documentCanonicalPath: String(document.canonicalPath || ''),
          sourcePath: identity.sourcePath,
        }),
      })
    }
    const materialized = buildSourceFileFromStorageDocument(
      sourceFileId,
      identity.sourcePath,
      document,
      markdownText,
      graphSnapshot,
      existing,
    )
    if (existing) {
      if (areSourceFileRecordsEqual(existing, materialized, { includeGraphData: false, includeGraphRevision: true })) continue
      next[currentIndex] = materialized
      changed = true
      continue
    }
    next.push(materialized)
    changed = true
  }

  if (blankPulledDocHydrationTasks.length > 0) {
    scheduleBlankPulledDocsHydration({
      workspaceId: args.workspaceId,
      tasks: blankPulledDocHydrationTasks,
    })
  }
  if (!changed) return { applied: false, nextCount: currentSourceFiles.length }
  current.setSourceFiles(next)
  scheduleApplyComposedGraphFromSourceFiles()
  void (async () => {
    try {
      const mod = (await import('@/features/workspace-fs/workspaceFs')) as typeof import('@/features/workspace-fs/workspaceFs')
      const fs = await mod.getWorkspaceFs()
      await fs.ensureSeed()
    } catch {
      void 0
    }
  })()
  return { applied: true, nextCount: next.length }
}
