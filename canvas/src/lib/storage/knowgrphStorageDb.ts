import {
  createPersistedCollectionDb,
  type PersistedCollectionDb,
  type PersistedCollectionMap,
} from '@/lib/storage/persistedCollectionStore'
import type {
  KgDocumentChunkRecord,
  KgGraphSnapshotRecord,
  KnowgrphStorageCursorRecord,
  KnowgrphStorageOutboxRecord,
} from '@/lib/storage/knowgrphStorageSyncContract'

export type KgDocumentLocalRecord = {
  id: string
  workspaceId: string
  canonicalPath: string
  title: string | null
  docType: string | null
  lang: string | null
  graphId: string | null
  sourceKind: 'markdown'
  contentMd: string
  contentHash: string
  parserVersion: string
  documentRevision: number
  updatedAtMs: number
  isDeleted: boolean
}

type KnowgrphStorageRecordMap = {
  documents: KgDocumentLocalRecord
  documentChunks: KgDocumentChunkRecord
  graphSnapshots: KgGraphSnapshotRecord
  syncOutbox: KnowgrphStorageOutboxRecord
  syncCursor: KnowgrphStorageCursorRecord
}

export type KnowgrphStorageCollections = PersistedCollectionMap<KnowgrphStorageRecordMap>
export type KnowgrphStorageDb = PersistedCollectionDb<KnowgrphStorageRecordMap>

export const KNOWGRPH_STORAGE_DB_NAME = 'kg:knowgrph-storage'

let knowgrphStorageDbSingleton: Promise<KnowgrphStorageDb> | null = null

const isKnowgrphStorageDbTestMode = (): boolean => {
  try {
    const env = typeof process !== 'undefined' ? process.env : undefined
    if (!env) return false
    if (env.NODE_ENV === 'test') return true
    if (env.KG_TEST_QUIET === '1') return true
    return false
  } catch {
    return false
  }
}

export const getKnowgrphStorageDb = async (): Promise<KnowgrphStorageDb> => {
  if (knowgrphStorageDbSingleton) return knowgrphStorageDbSingleton
  knowgrphStorageDbSingleton = (async () => {
    const testMode = isKnowgrphStorageDbTestMode() || typeof window === 'undefined'
    return createPersistedCollectionDb<KnowgrphStorageRecordMap>({
      storageKey: KNOWGRPH_STORAGE_DB_NAME,
      persistent: !testMode,
      collectionNames: ['documents', 'documentChunks', 'graphSnapshots', 'syncOutbox', 'syncCursor'],
    })
  })()
  return knowgrphStorageDbSingleton.catch(err => {
    knowgrphStorageDbSingleton = null
    throw err
  })
}

export const warmKnowgrphStorageDb = async (): Promise<void> => {
  await getKnowgrphStorageDb()
}

export const __resetKnowgrphStorageDbForTests = async (): Promise<void> => {
  const current = knowgrphStorageDbSingleton
  knowgrphStorageDbSingleton = null
  let dbState: KnowgrphStorageDb | null = null
  if (current) {
    try {
      dbState = await current
    } catch {
      dbState = null
    }
  }
  if (!dbState) return
  try {
    await dbState.db.remove()
  } catch {
    try {
      await dbState.db.close()
    } catch {
      void 0
    }
  }
}
