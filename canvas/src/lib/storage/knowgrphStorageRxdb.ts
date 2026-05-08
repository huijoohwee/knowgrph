import { addRxPlugin, createRxDatabase, type RxCollection, type RxDatabase, type RxJsonSchema } from 'rxdb/plugins/core'
import { RxDBMigrationSchemaPlugin } from 'rxdb/plugins/migration-schema'
import { RxDBQueryBuilderPlugin } from 'rxdb/plugins/query-builder'
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory'
import { clearRxdbForDatabaseName } from '@/lib/storage/rxdbRecovery'
import { getCanvasRxStorage } from '@/lib/storage/rxdbStorage'
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

export type KnowgrphStorageCollections = {
  documents: RxCollection<KgDocumentLocalRecord>
  documentChunks: RxCollection<KgDocumentChunkRecord>
  graphSnapshots: RxCollection<KgGraphSnapshotRecord>
  syncOutbox: RxCollection<KnowgrphStorageOutboxRecord>
  syncCursor: RxCollection<KnowgrphStorageCursorRecord>
}

export type KnowgrphStorageDb = {
  db: RxDatabase<KnowgrphStorageCollections>
  collections: KnowgrphStorageCollections
}

export const KNOWGRPH_STORAGE_DB_NAME = 'kg:knowgrph-storage'

let rxdbPluginsInitialized = false
const ensureRxdbPlugins = () => {
  if (rxdbPluginsInitialized) return
  addRxPlugin(RxDBMigrationSchemaPlugin)
  addRxPlugin(RxDBQueryBuilderPlugin)
  rxdbPluginsInitialized = true
}

const maxSafeInt = 9_007_199_254_740_991

const documentSchema: RxJsonSchema<KgDocumentLocalRecord> = {
  title: 'knowgrph_storage_document',
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 256 },
    workspaceId: { type: 'string', maxLength: 256 },
    canonicalPath: { type: 'string', maxLength: 2048 },
    title: { type: ['string', 'null'] },
    docType: { type: ['string', 'null'] },
    lang: { type: ['string', 'null'] },
    graphId: { type: ['string', 'null'] },
    sourceKind: { type: 'string', maxLength: 32 },
    contentMd: { type: 'string' },
    contentHash: { type: 'string', maxLength: 256 },
    parserVersion: { type: 'string', maxLength: 64 },
    documentRevision: { type: 'integer', minimum: 0, maximum: maxSafeInt, multipleOf: 1 },
    updatedAtMs: { type: 'integer', minimum: 0, maximum: maxSafeInt, multipleOf: 1 },
    isDeleted: { type: 'boolean' },
  },
  required: [
    'id',
    'workspaceId',
    'canonicalPath',
    'title',
    'docType',
    'lang',
    'graphId',
    'sourceKind',
    'contentMd',
    'contentHash',
    'parserVersion',
    'documentRevision',
    'updatedAtMs',
    'isDeleted',
  ],
  indexes: ['workspaceId', ['workspaceId', 'canonicalPath'], ['workspaceId', 'updatedAtMs']],
}

const documentChunkSchema: RxJsonSchema<KgDocumentChunkRecord> = {
  title: 'knowgrph_storage_document_chunk',
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 512 },
    documentId: { type: 'string', maxLength: 256 },
    workspaceId: { type: 'string', maxLength: 256 },
    chunkKey: { type: 'string', maxLength: 512 },
    chunkOrder: { type: 'integer', minimum: 0, maximum: maxSafeInt, multipleOf: 1 },
    heading: { type: ['string', 'null'] },
    markdown: { type: 'string' },
    tokenEstimate: { type: 'integer', minimum: 0, maximum: maxSafeInt, multipleOf: 1 },
    contentHash: { type: 'string', maxLength: 256 },
    updatedAtMs: { type: 'integer', minimum: 0, maximum: maxSafeInt, multipleOf: 1 },
  },
  required: [
    'id',
    'documentId',
    'workspaceId',
    'chunkKey',
    'chunkOrder',
    'heading',
    'markdown',
    'tokenEstimate',
    'contentHash',
    'updatedAtMs',
  ],
  indexes: ['documentId', ['documentId', 'chunkKey'], ['workspaceId', 'updatedAtMs']],
}

const graphSnapshotSchema: RxJsonSchema<KgGraphSnapshotRecord> = {
  title: 'knowgrph_storage_graph_snapshot',
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 512 },
    documentId: { type: 'string', maxLength: 256 },
    workspaceId: { type: 'string', maxLength: 256 },
    graphRevision: { type: 'integer', minimum: 0, maximum: maxSafeInt, multipleOf: 1 },
    graphHash: { type: 'string', maxLength: 256 },
    graphJson: { type: 'object', additionalProperties: true },
    layoutJson: { type: ['object', 'null'], additionalProperties: true },
    derivedFromDocumentRevision: { type: 'integer', minimum: 0, maximum: maxSafeInt, multipleOf: 1 },
    updatedAtMs: { type: 'integer', minimum: 0, maximum: maxSafeInt, multipleOf: 1 },
  },
  required: [
    'id',
    'documentId',
    'workspaceId',
    'graphRevision',
    'graphHash',
    'graphJson',
    'layoutJson',
    'derivedFromDocumentRevision',
    'updatedAtMs',
  ],
  indexes: ['documentId', ['documentId', 'graphRevision'], ['workspaceId', 'updatedAtMs']],
}

const syncOutboxSchema: RxJsonSchema<KnowgrphStorageOutboxRecord> = {
  title: 'knowgrph_storage_sync_outbox',
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 256 },
    workspaceId: { type: 'string', maxLength: 256 },
    deviceId: { type: 'string', maxLength: 256 },
    entity: { type: 'string', maxLength: 64 },
    op: { type: 'string', maxLength: 32 },
    recordId: { type: 'string', maxLength: 512 },
    baseRevision: { type: ['integer', 'null'], minimum: 0, maximum: maxSafeInt, multipleOf: 1 },
    payload: { type: 'object', additionalProperties: true },
    payloadHash: { type: 'string', maxLength: 256 },
    attemptCount: { type: 'integer', minimum: 0, maximum: maxSafeInt, multipleOf: 1 },
    lastAckStatus: { type: 'string', maxLength: 32 },
    lastAckMessage: { type: ['string', 'null'] },
    createdAtMs: { type: 'integer', minimum: 0, maximum: maxSafeInt, multipleOf: 1 },
    updatedAtMs: { type: 'integer', minimum: 0, maximum: maxSafeInt, multipleOf: 1 },
  },
  required: [
    'id',
    'workspaceId',
    'deviceId',
    'entity',
    'op',
    'recordId',
    'baseRevision',
    'payload',
    'payloadHash',
    'attemptCount',
    'lastAckStatus',
    'lastAckMessage',
    'createdAtMs',
    'updatedAtMs',
  ],
  indexes: ['workspaceId', ['workspaceId', 'createdAtMs'], ['workspaceId', 'entity'], ['workspaceId', 'lastAckStatus']],
}

const syncCursorSchema: RxJsonSchema<KnowgrphStorageCursorRecord> = {
  title: 'knowgrph_storage_sync_cursor',
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 512 },
    workspaceId: { type: 'string', maxLength: 256 },
    deviceId: { type: 'string', maxLength: 256 },
    lastPullCursor: { type: ['string', 'null'] },
    lastPushCursor: { type: ['string', 'null'] },
    serverClockMs: { type: ['integer', 'null'], minimum: 0, maximum: maxSafeInt, multipleOf: 1 },
    updatedAtMs: { type: 'integer', minimum: 0, maximum: maxSafeInt, multipleOf: 1 },
  },
  required: ['id', 'workspaceId', 'deviceId', 'lastPullCursor', 'lastPushCursor', 'serverClockMs', 'updatedAtMs'],
  indexes: ['workspaceId', ['workspaceId', 'deviceId']],
}

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
    ensureRxdbPlugins()
    const testMode = isKnowgrphStorageDbTestMode() || typeof window === 'undefined'
    let didReset = false
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const db = await createRxDatabase<KnowgrphStorageCollections>({
          name: KNOWGRPH_STORAGE_DB_NAME,
          storage: testMode ? getRxStorageMemory() : getCanvasRxStorage(),
          multiInstance: !testMode,
          eventReduce: !testMode,
          closeDuplicates: true,
        })
        const collections = await db.addCollections({
          documents: { schema: documentSchema },
          documentChunks: { schema: documentChunkSchema },
          graphSnapshots: { schema: graphSnapshotSchema },
          syncOutbox: { schema: syncOutboxSchema },
          syncCursor: { schema: syncCursorSchema },
        })
        return { db, collections }
      } catch (err) {
        if (didReset) {
          knowgrphStorageDbSingleton = null
          throw err
        }
        didReset = true
        await clearRxdbForDatabaseName(KNOWGRPH_STORAGE_DB_NAME)
      }
    }
    throw new Error('Failed to initialize knowgrph storage database')
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
