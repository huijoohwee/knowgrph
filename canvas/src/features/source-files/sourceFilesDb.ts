import type { SourceFile } from '@/hooks/store/types'
import {
  createPersistedCollectionDb,
  type PersistedCollectionDb,
  type PersistedCollectionMap,
} from '@/lib/storage/persistedCollectionStore'
import { reconcileDefaultWorkspaceSeedSourceFiles } from '@/features/source-files/workspaceSeedSourceFiles'
import { readWorkspaceSourceFilesDocsOnlySetting } from '@/lib/workspace/workspaceStoreSyncSettings'
import {
  areSourceFilesWorkspaceStatesEqual,
  EMPTY_SOURCE_FILES_WORKSPACE_STATE,
  normalizeSourceFilesWorkspaceState,
  type SourceFilesWorkspaceState,
} from '@/features/source-files/sourceFilesWorkspaceState'
import {
  areSourceFileSourcesEqual,
  areSourceFileRecordsEqual,
  readPersistedSourceFileRecord,
} from '@/features/source-files/sourceFileParsedState'
export const SOURCE_FILES_DB_NAME = 'kg:source-files'
export const SOURCE_FILES_DB_VERSION = 2
const normalizeNonNegativeInt = (value: unknown, fallback = 0): number => {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n) || n < 0) return Math.max(0, Math.floor(fallback))
  return Math.floor(n)
}

type SourceFileRowV1 = {
  id: string
  orderIndex: number
  payload: SourceFile
  updatedAtMs: number
}

type WorkspaceRowV1 = {
  id: 'workspace'
  payload: SourceFilesWorkspaceState
  updatedAtMs: number
}

type SourceFilesRecordMap = {
  sourceFiles: SourceFileRowV1
  workspace: WorkspaceRowV1
}
type SourceFilesCollections = PersistedCollectionMap<SourceFilesRecordMap>
type SourceFilesDb = PersistedCollectionDb<SourceFilesRecordMap>

let dbSingleton: Promise<SourceFilesDb> | null = null

const getDb = async () => {
  if (dbSingleton) return dbSingleton
  dbSingleton = (async () => {
    return createPersistedCollectionDb<SourceFilesRecordMap>({
      storageKey: SOURCE_FILES_DB_NAME,
      collectionNames: ['sourceFiles', 'workspace'],
    })
  })()
  return dbSingleton.catch(err => {
    dbSingleton = null
    throw err
  })
}

export const loadPersistedSourceFiles = async (): Promise<SourceFile[]> => {
  const { collections } = await getDb()
  const rows = await collections.sourceFiles.find().sort({ orderIndex: 'asc' }).exec()
  const loaded = rows
    .map(r => {
      try {
        const next = readPersistedSourceFileRecord(r.get('payload') as SourceFile)
        if (!next.id) return null
        return next
      } catch {
        return null
      }
    })
    .filter(Boolean) as SourceFile[]
  if (readWorkspaceSourceFilesDocsOnlySetting()) return loaded
  return reconcileDefaultWorkspaceSeedSourceFiles(loaded)
}

export const persistSourceFiles = async (files: SourceFile[]): Promise<void> => {
  const list = (Array.isArray(files) ? files : []).filter(file => {
    return !String(file?.source?.path || '').trim().startsWith('workspace:')
  })
  const now = normalizeNonNegativeInt(Date.now(), Date.now())
  const rows = list
    .map((payload, orderIndex) => {
      const normalized = readPersistedSourceFileRecord(payload)
      const id = String(normalized?.id || '').trim()
      if (!id) return null
      return { id, orderIndex, payload: normalized }
    })
    .filter(Boolean) as Array<Pick<SourceFileRowV1, 'id' | 'orderIndex' | 'payload'>>

  const { collections } = await getDb()
  const existing = await collections.sourceFiles.find().exec()
  const existingById = new Map(existing.map(doc => [String(doc.get('id') || ''), doc]))
  const keep = new Set(rows.map(r => r.id))
  for (const doc of existing) {
    if (keep.has(doc.get('id'))) continue
    await doc.remove()
  }
  for (const row of rows) {
    const existingDoc = existingById.get(row.id)
    if (existingDoc) {
      const existingOrderIndex = Number(existingDoc.get('orderIndex') || 0)
      const existingPayload = readPersistedSourceFileRecord(existingDoc.get('payload') as SourceFile)
      if (
        existingOrderIndex === row.orderIndex &&
        areSourceFileRecordsEqual(existingPayload, row.payload, { includeGraphData: false, includeGraphRevision: false }) &&
        areSourceFileSourcesEqual(existingPayload.source, row.payload.source)
      ) continue
    }
    await collections.sourceFiles.incrementalUpsert({ ...row, orderIndex: normalizeNonNegativeInt(row.orderIndex, 0), updatedAtMs: now })
  }
}

export const loadPersistedSourceFilesWorkspace = async (): Promise<SourceFilesWorkspaceState> => {
  const { collections } = await getDb()
  const row = await collections.workspace.findOne('workspace').exec()
  if (!row) return EMPTY_SOURCE_FILES_WORKSPACE_STATE
  return normalizeSourceFilesWorkspaceState(row.get('payload'))
}

export const persistSourceFilesWorkspace = async (state: SourceFilesWorkspaceState): Promise<void> => {
  const { collections } = await getDb()
  const now = normalizeNonNegativeInt(Date.now(), Date.now())
  const payload = normalizeSourceFilesWorkspaceState(state)
  const existing = await collections.workspace.findOne('workspace').exec()
  if (existing) {
    const existingPayload = normalizeSourceFilesWorkspaceState(existing.get('payload'))
    if (areSourceFilesWorkspaceStatesEqual(existingPayload, payload)) return
  }
  await collections.workspace.incrementalUpsert({ id: 'workspace', payload, updatedAtMs: now })
}
