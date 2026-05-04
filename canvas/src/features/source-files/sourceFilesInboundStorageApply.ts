import { scheduleApplyComposedGraphFromSourceFiles } from '@/features/source-files/applyComposedGraphFromSourceFiles'
import {
  areSourceFileRecordsEqual,
  normalizeSourceFileRecord,
} from '@/features/source-files/sourceFileParsedState'
import {
  buildSourceFileGraphSnapshotId,
  isKnowgrphSourceFileDocumentId,
  readKnowgrphSourceFileIdFromDocumentId,
} from '@/features/source-files/sourceFilesStorageSync'
import { workspaceBasename } from '@/features/workspace-fs/path'
import { useGraphStore } from '@/hooks/useGraphStore'
import type { SourceFile } from '@/hooks/store/types'
import type { GraphData } from '@/lib/graph/types'
import type {
  KgDocumentRecord,
  KgGraphSnapshotRecord,
  KnowgrphStoragePullResponse,
} from '@/lib/storage/knowgrphStorageSyncContract'

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

const toSourceFileSource = (canonicalPath: string): SourceFile['source'] => {
  if (looksLikeHttpUrl(canonicalPath)) {
    return { kind: 'url', url: canonicalPath }
  }
  return { kind: 'local', path: canonicalPath }
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

const buildSourceFileFromStorageDocument = (
  document: KgDocumentRecord,
  graphSnapshot: KgGraphSnapshotRecord | null,
  existing: SourceFile | null,
): SourceFile => {
  const sourceFileId = readKnowgrphSourceFileIdFromDocumentId(document.id)
  const graphData = graphSnapshot?.graphJson as unknown as GraphData | undefined
  return normalizeSourceFileRecord({
    id: sourceFileId,
    name: readSourceFileNameFromCanonicalPath(normalizeString(document.canonicalPath), document.title),
    text: String(document.contentMd || ''),
    enabled: existing ? !!existing.enabled : true,
    ...(typeof existing?.geoLayerEnabled === 'boolean' ? { geoLayerEnabled: existing.geoLayerEnabled } : {}),
    status: graphData ? 'parsed' : existing?.status || 'idle',
    error: undefined,
    parsedParserId: graphSnapshot ? normalizeString(document.parserVersion) || 'remote-sync' : existing?.parsedParserId,
    parsedTextHash: normalizeString(document.contentHash) || existing?.parsedTextHash,
    parsedGraphRevision: graphSnapshot?.graphRevision ?? existing?.parsedGraphRevision,
    parsedGraphData: graphData ?? existing?.parsedGraphData,
    source: toSourceFileSource(normalizeString(document.canonicalPath)),
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

  for (let i = 0; i < documents.length; i += 1) {
    const document = documents[i]
    if (!document) continue
    if (normalizeString(document.workspaceId) !== normalizeString(args.workspaceId)) continue
    if (!isKnowgrphSourceFileDocumentId(document.id)) continue
    const sourceFileId = readKnowgrphSourceFileIdFromDocumentId(document.id)
    if (!sourceFileId) continue
    const currentIndex = next.findIndex(file => normalizeString(file?.id) === sourceFileId)
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
    const materialized = buildSourceFileFromStorageDocument(document, graphSnapshot, existing)
    if (existing) {
      if (areSourceFileRecordsEqual(existing, materialized, { includeGraphData: false, includeGraphRevision: true })) continue
      next[currentIndex] = materialized
      changed = true
      continue
    }
    next.push(materialized)
    changed = true
  }

  if (!changed) return { applied: false, nextCount: currentSourceFiles.length }
  current.setSourceFiles(next)
  scheduleApplyComposedGraphFromSourceFiles()
  return { applied: true, nextCount: next.length }
}
