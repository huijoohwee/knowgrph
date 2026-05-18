import { addRxPlugin, createRxDatabase, type RxCollection, type RxDatabase, type RxJsonSchema } from 'rxdb/plugins/core'
import { RxDBMigrationSchemaPlugin } from 'rxdb/plugins/migration-schema'
import { RxDBQueryBuilderPlugin } from 'rxdb/plugins/query-builder'
import type { SourceFile } from '@/hooks/store/types'
import { getCanvasRxStorage } from '@/lib/storage/rxdbStorage'
import { clearRxdbForDatabaseName } from '@/lib/storage/rxdbRecovery'
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

let rxdbPluginsInitialized = false
const ensureRxdbPlugins = () => {
  if (rxdbPluginsInitialized) return
  addRxPlugin(RxDBMigrationSchemaPlugin)
  addRxPlugin(RxDBQueryBuilderPlugin)
  rxdbPluginsInitialized = true
}
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

type SourceFilesCollections = {
  sourceFiles: RxCollection<SourceFileRowV1>
  workspace: RxCollection<WorkspaceRowV1>
}

const sourceFileSchema: RxJsonSchema<SourceFileRowV1> = {
  title: 'source_files_row',
  version: 1,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 256 },
    orderIndex: { type: 'integer', minimum: 0, maximum: 2_147_483_647, multipleOf: 1 },
    payload: { type: 'object', additionalProperties: true },
    updatedAtMs: { type: 'integer', minimum: 0, maximum: 9_007_199_254_740_991, multipleOf: 1 },
  },
  required: ['id', 'orderIndex', 'payload', 'updatedAtMs'],
  indexes: ['orderIndex', 'updatedAtMs'],
}

const workspaceSchema: RxJsonSchema<WorkspaceRowV1> = {
  title: 'source_files_workspace',
  version: 1,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 64 },
    payload: { type: 'object', additionalProperties: true },
    updatedAtMs: { type: 'integer', minimum: 0, maximum: 9_007_199_254_740_991, multipleOf: 1 },
  },
  required: ['id', 'payload', 'updatedAtMs'],
}

let dbSingleton: Promise<{ db: RxDatabase<SourceFilesCollections>; collections: SourceFilesCollections }> | null = null

const isRxConflictError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false
  const rec = error as Record<string, unknown>
  const status = Number(rec.status)
  if (Number.isFinite(status) && status === 409) return true
  const code = String(rec.code || '').trim().toUpperCase()
  if (code === 'CONFLICT') return true
  const message = String(rec.message || '').trim().toUpperCase()
  return message.includes('CONFLICT')
}

const getDb = async () => {
  if (dbSingleton) return dbSingleton
  dbSingleton = (async () => {
    ensureRxdbPlugins()
    let didReset = false
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const db = await createRxDatabase<SourceFilesCollections>({
          name: SOURCE_FILES_DB_NAME,
          storage: getCanvasRxStorage(),
          multiInstance: true,
          eventReduce: true,
          closeDuplicates: true,
        })
        const collections = await db.addCollections({
          sourceFiles: {
            schema: sourceFileSchema,
            migrationStrategies: {
              1: (doc: unknown) => {
                const d = (doc && typeof doc === 'object' ? (doc as Record<string, unknown>) : {})
                const id = String(d.id || '').slice(0, 256)
                const orderIndex = Number.isFinite(d.orderIndex) ? Math.max(0, Math.floor(d.orderIndex as number)) : 0
                const payload = (d.payload && typeof d.payload === 'object' ? d.payload : {}) as SourceFile
                const updatedAtMs = Number.isFinite(d.updatedAtMs) ? Math.max(0, Math.floor(d.updatedAtMs as number)) : 0
                return { id, orderIndex, payload, updatedAtMs } satisfies SourceFileRowV1
              },
            },
          },
          workspace: {
            schema: workspaceSchema,
            migrationStrategies: {
              1: (doc: unknown) => {
                const d = (doc && typeof doc === 'object' ? (doc as Record<string, unknown>) : {})
                const id = 'workspace' as const
                const payload = (d.payload && typeof d.payload === 'object' ? d.payload : {}) as SourceFilesWorkspaceState
                const updatedAtMs = Number.isFinite(d.updatedAtMs) ? Math.max(0, Math.floor(d.updatedAtMs as number)) : 0
                return { id, payload, updatedAtMs } satisfies WorkspaceRowV1
              },
            },
          },
        })
        return { db, collections }
      } catch (err) {
        if (didReset) {
          dbSingleton = null
          throw err
        }
        didReset = true
        await clearRxdbForDatabaseName(SOURCE_FILES_DB_NAME)
      }
    }
    throw new Error('Failed to initialize source-files database')
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
    try {
      await doc.remove()
    } catch (error) {
      if (!isRxConflictError(error)) throw error
    }
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
