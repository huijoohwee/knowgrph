import type { SourceFile } from '@/hooks/store/types'
import { hashStringToHex } from '@/lib/hash/stringHash'
import { toCloneSafeObject } from '@/lib/storage/cloneSafe'
import {
  getKnowgrphStorageDb,
  type KgDocumentLocalRecord,
  type KnowgrphStorageDb,
} from '@/lib/storage/knowgrphStorageRxdb'
import { queueKnowgrphStorageMutation } from '@/lib/storage/knowgrphStorageClientSync'
import type {
  KgDocumentRecord,
  KgGraphSnapshotRecord,
} from '@/lib/storage/knowgrphStorageSyncContract'
import {
  normalizeSourceFilesWorkspaceState,
  type SourceFilesWorkspaceState,
} from '@/features/source-files/sourceFilesWorkspaceState'

const KNOWGRPH_SOURCE_FILE_DOCUMENT_ID_PREFIX = 'sf:'
const KNOWGRPH_SOURCE_FILE_GRAPH_SNAPSHOT_ID_PREFIX = 'sf-graph:'

const normalizeString = (value: unknown): string => String(value || '').trim()

const normalizeSourceFileCanonicalPath = (file: SourceFile): string => {
  const sourcePath = normalizeString(file.source?.path)
  if (sourcePath) return sourcePath
  const sourceUrl = normalizeString(file.source?.url)
  if (sourceUrl) return sourceUrl
  return normalizeString(file.name) || file.id
}

const buildSourceFileDocumentId = (fileId: string): string =>
  `${KNOWGRPH_SOURCE_FILE_DOCUMENT_ID_PREFIX}${normalizeString(fileId)}`

export const buildSourceFileGraphSnapshotId = (fileId: string): string =>
  `${KNOWGRPH_SOURCE_FILE_GRAPH_SNAPSHOT_ID_PREFIX}${normalizeString(fileId)}`

export const isKnowgrphSourceFileDocumentId = (value: unknown): boolean =>
  normalizeString(value).startsWith(KNOWGRPH_SOURCE_FILE_DOCUMENT_ID_PREFIX)

export const readKnowgrphSourceFileIdFromDocumentId = (value: unknown): string => {
  const documentId = normalizeString(value)
  return isKnowgrphSourceFileDocumentId(documentId)
    ? documentId.slice(KNOWGRPH_SOURCE_FILE_DOCUMENT_ID_PREFIX.length)
    : ''
}

const buildSourceFileDocumentHash = (file: SourceFile): string =>
  hashStringToHex(
    [
      normalizeSourceFileCanonicalPath(file),
      normalizeString(file.name),
      String(file.text || ''),
      normalizeString(file.parsedTextHash),
      String(file.enabled ? '1' : '0'),
    ].join('|'),
  )

const buildSourceFileGraphHash = (file: SourceFile): string =>
  hashStringToHex(
    [
      normalizeString(file.id),
      normalizeString(file.parsedParserId),
      normalizeString(file.parsedTextHash),
      JSON.stringify(file.parsedGraphData || {}),
    ].join('|'),
  )

const resolveWorkspaceIdentitySeed = (workspaceState: SourceFilesWorkspaceState): string => {
  const normalized = normalizeSourceFilesWorkspaceState(workspaceState)
  return (
    normalizeString(normalized.folderCacheId)
    || normalizeString(normalized.selectedFolderPath)
    || normalizeString(normalized.folderName)
    || 'default'
  )
}

export const buildKnowgrphWorkspaceIdFromSourceFilesWorkspaceState = (
  workspaceState: SourceFilesWorkspaceState,
): string => {
  const normalized = normalizeSourceFilesWorkspaceState(workspaceState)
  const seed = [
    resolveWorkspaceIdentitySeed(normalized),
    normalizeString(normalized.accessMode),
    normalizeString(normalized.folderName),
    normalizeString(normalized.selectedFolderPath),
  ].join('|')
  return `kgws:${hashStringToHex(seed)}`
}

const toRemoteDocumentRecord = (
  localRecord: KgDocumentLocalRecord,
): KgDocumentRecord => ({
  id: localRecord.id,
  workspaceId: localRecord.workspaceId,
  canonicalPath: localRecord.canonicalPath,
  title: localRecord.title,
  docType: localRecord.docType,
  lang: localRecord.lang,
  graphId: localRecord.graphId,
  sourceKind: localRecord.sourceKind,
  contentMd: localRecord.contentMd,
  contentHash: localRecord.contentHash,
  parserVersion: localRecord.parserVersion,
  revision: localRecord.documentRevision,
  updatedAtMs: localRecord.updatedAtMs,
  deleted: localRecord.isDeleted,
})

const buildDocumentLocalRecordForSourceFile = (
  workspaceId: string,
  file: SourceFile,
  existing: KgDocumentLocalRecord | null,
): KgDocumentLocalRecord => {
  const contentHash = buildSourceFileDocumentHash(file)
  const nowMs = Date.now()
  const didSemanticChange =
    !existing
    || existing.canonicalPath !== normalizeSourceFileCanonicalPath(file)
    || existing.title !== normalizeString(file.name)
    || existing.contentHash !== contentHash
    || existing.isDeleted
  return {
    id: buildSourceFileDocumentId(file.id),
    workspaceId,
    canonicalPath: normalizeSourceFileCanonicalPath(file),
    title: normalizeString(file.name) || null,
    docType: 'markdown',
    lang: null,
    graphId: buildSourceFileGraphSnapshotId(file.id),
    sourceKind: 'markdown',
    contentMd: String(file.text || ''),
    contentHash,
    parserVersion: normalizeString(file.parsedParserId) || 'source-files',
    documentRevision: didSemanticChange ? Math.max(1, Number(existing?.documentRevision || 0) + 1) : Math.max(1, Number(existing?.documentRevision || 1)),
    updatedAtMs: nowMs,
    isDeleted: false,
  }
}

const buildGraphSnapshotRecordForSourceFile = (
  workspaceId: string,
  file: SourceFile,
  documentRevision: number,
): KgGraphSnapshotRecord => ({
  id: buildSourceFileGraphSnapshotId(file.id),
  documentId: buildSourceFileDocumentId(file.id),
  workspaceId,
  graphRevision: Math.max(1, Number(file.parsedGraphRevision || documentRevision || 1)),
  graphHash: buildSourceFileGraphHash(file),
  graphJson: toCloneSafeObject(file.parsedGraphData, {}),
  layoutJson: null,
  derivedFromDocumentRevision: Math.max(1, documentRevision),
  updatedAtMs: Date.now(),
})

const shouldSyncSourceFile = (file: SourceFile | null | undefined): file is SourceFile => {
  if (!file) return false
  const id = normalizeString(file.id)
  if (!id) return false
  const text = String(file.text || '')
  const canonicalPath = normalizeSourceFileCanonicalPath(file)
  return !!canonicalPath || !!text.trim()
}

export const syncSourceFilesToKnowgrphStorage = async (args: {
  workspaceId: string
  sourceFiles: SourceFile[]
  previousSourceFiles?: SourceFile[] | null
  dbState?: KnowgrphStorageDb | null
}): Promise<{ queuedMutationCount: number }> => {
  const workspaceId = normalizeString(args.workspaceId)
  if (!workspaceId) return { queuedMutationCount: 0 }
  const dbState = args.dbState || (await getKnowgrphStorageDb())
  const { collections } = dbState
  const rows = await collections.documents.find({ selector: { workspaceId } }).exec()
  const existingById = new Map<string, KgDocumentLocalRecord>()
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i]!
    const id = normalizeString(row.get('id'))
    if (!id.startsWith(KNOWGRPH_SOURCE_FILE_DOCUMENT_ID_PREFIX)) continue
    existingById.set(id, row.toJSON() as KgDocumentLocalRecord)
  }
  let queuedMutationCount = 0
  const keepDocumentIds = new Set<string>()
  const nextFiles = Array.isArray(args.sourceFiles) ? args.sourceFiles : []
  for (let i = 0; i < nextFiles.length; i += 1) {
    const file = nextFiles[i]
    if (!shouldSyncSourceFile(file)) continue
    const documentId = buildSourceFileDocumentId(file.id)
    keepDocumentIds.add(documentId)
    const existing = existingById.get(documentId) || null
    const nextLocalRecord = buildDocumentLocalRecordForSourceFile(workspaceId, file, existing)
    const didDocumentChange =
      !existing
      || existing.canonicalPath !== nextLocalRecord.canonicalPath
      || existing.title !== nextLocalRecord.title
      || existing.contentHash !== nextLocalRecord.contentHash
      || existing.documentRevision !== nextLocalRecord.documentRevision
      || existing.isDeleted !== nextLocalRecord.isDeleted
    if (didDocumentChange) {
      await collections.documents.incrementalUpsert(nextLocalRecord)
      await queueKnowgrphStorageMutation({
        workspaceId,
        entity: 'document',
        op: 'upsert',
        recordId: nextLocalRecord.id,
        baseRevision: existing ? existing.documentRevision : null,
        record: toRemoteDocumentRecord(nextLocalRecord),
        dbState,
      })
      queuedMutationCount += 1
    }
    const hasGraphData = !!(file.parsedGraphData && typeof file.parsedGraphData === 'object')
    const graphSnapshotId = buildSourceFileGraphSnapshotId(file.id)
    const existingGraphSnapshotDoc = await collections.graphSnapshots.findOne(graphSnapshotId).exec()
    const existingGraphSnapshot = existingGraphSnapshotDoc?.toJSON() || null
    if (hasGraphData) {
      const nextGraphSnapshot = buildGraphSnapshotRecordForSourceFile(workspaceId, file, nextLocalRecord.documentRevision)
      const didGraphChange =
        !existingGraphSnapshot
        || normalizeString(existingGraphSnapshot.graphHash) !== nextGraphSnapshot.graphHash
        || Number(existingGraphSnapshot.graphRevision || 0) !== nextGraphSnapshot.graphRevision
        || Number(existingGraphSnapshot.derivedFromDocumentRevision || 0) !== nextGraphSnapshot.derivedFromDocumentRevision
      if (didGraphChange) {
        await collections.graphSnapshots.incrementalUpsert(nextGraphSnapshot)
        await queueKnowgrphStorageMutation({
          workspaceId,
          entity: 'graphSnapshot',
          op: 'upsert',
          recordId: nextGraphSnapshot.id,
          baseRevision: existingGraphSnapshot ? Number(existingGraphSnapshot.graphRevision || 0) : null,
          record: nextGraphSnapshot,
          dbState,
        })
        queuedMutationCount += 1
      }
    } else if (existingGraphSnapshotDoc) {
      const deletedSnapshot = {
        ...(existingGraphSnapshot as KgGraphSnapshotRecord),
        updatedAtMs: Date.now(),
      }
      await existingGraphSnapshotDoc.remove()
      await queueKnowgrphStorageMutation({
        workspaceId,
        entity: 'graphSnapshot',
        op: 'delete',
        recordId: graphSnapshotId,
        baseRevision: Number(existingGraphSnapshot?.graphRevision || 0) || null,
        record: deletedSnapshot,
        dbState,
      })
      queuedMutationCount += 1
    }
  }
  const previousFiles = Array.isArray(args.previousSourceFiles) ? args.previousSourceFiles : []
  for (let i = 0; i < previousFiles.length; i += 1) {
    const previousFile = previousFiles[i]
    if (!shouldSyncSourceFile(previousFile)) continue
    const documentId = buildSourceFileDocumentId(previousFile.id)
    if (keepDocumentIds.has(documentId)) continue
    const existing = existingById.get(documentId)
    if (!existing) continue
    const deletedRecord: KgDocumentLocalRecord = {
      ...existing,
      documentRevision: Math.max(1, Number(existing.documentRevision || 0) + 1),
      updatedAtMs: Date.now(),
      isDeleted: true,
    }
    await collections.documents.incrementalUpsert(deletedRecord)
    await queueKnowgrphStorageMutation({
      workspaceId,
      entity: 'document',
      op: 'delete',
      recordId: deletedRecord.id,
      baseRevision: existing.documentRevision,
      record: toRemoteDocumentRecord(deletedRecord),
      dbState,
    })
    queuedMutationCount += 1
    const graphSnapshotId = buildSourceFileGraphSnapshotId(previousFile.id)
    const existingGraphSnapshotDoc = await collections.graphSnapshots.findOne(graphSnapshotId).exec()
    if (existingGraphSnapshotDoc) {
      const deletedSnapshot = {
        ...(existingGraphSnapshotDoc.toJSON() as KgGraphSnapshotRecord),
        updatedAtMs: Date.now(),
      }
      await existingGraphSnapshotDoc.remove()
      await queueKnowgrphStorageMutation({
        workspaceId,
        entity: 'graphSnapshot',
        op: 'delete',
        recordId: graphSnapshotId,
        baseRevision: Number(deletedSnapshot.graphRevision || 0) || null,
        record: deletedSnapshot,
        dbState,
      })
      queuedMutationCount += 1
    }
  }
  return { queuedMutationCount }
}
