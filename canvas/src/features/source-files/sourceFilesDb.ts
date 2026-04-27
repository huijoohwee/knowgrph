import { addRxPlugin, createRxDatabase, type RxCollection, type RxDatabase, type RxJsonSchema } from 'rxdb/plugins/core'
import { RxDBMigrationSchemaPlugin } from 'rxdb/plugins/migration-schema'
import { RxDBQueryBuilderPlugin } from 'rxdb/plugins/query-builder'
import type { SourceFile } from '@/hooks/store/types'
import { getCanvasRxStorage } from '@/lib/storage/rxdbStorage'
import { clearRxdbLocalstorageForDatabaseName } from '@/lib/storage/rxdbRecovery'
import { reconcileDefaultWorkspaceSeedSourceFiles } from '@/features/source-files/workspaceSeedSourceFiles'

export const SOURCE_FILES_DB_NAME = 'kg:source-files'
export const SOURCE_FILES_DB_VERSION = 2

let rxdbPluginsInitialized = false
const ensureRxdbPlugins = () => {
  if (rxdbPluginsInitialized) return
  addRxPlugin(RxDBMigrationSchemaPlugin)
  addRxPlugin(RxDBQueryBuilderPlugin)
  rxdbPluginsInitialized = true
}

export type SourceFilesWorkspaceState = {
  folderName: string | null
  accessMode: 'fs-access' | 'opfs' | 'file-input' | null
  folderCacheId: string | null
  selectedFolderPath: string | null
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
        clearRxdbLocalstorageForDatabaseName(SOURCE_FILES_DB_NAME)
      }
    }
    throw new Error('Failed to initialize source-files database')
  })()
  return dbSingleton.catch(err => {
    dbSingleton = null
    throw err
  })
}

const normalizeText = (v: unknown): string => String(v || '')
const normalizeOptionalString = (v: unknown): string | null => {
  const s = String(v || '').trim()
  return s ? s : null
}

const normalizeWorkspacePath = (v: unknown): string | null => {
  const raw = String(v || '').trim()
  if (!raw) return null
  const normalized = raw.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '')
  return normalized || null
}

const normalizeSourceFileForPersistence = (payload: SourceFile): SourceFile => {
  const id = normalizeOptionalString(payload?.id)
  const name = normalizeText(payload?.name)
  const enabled = !!payload?.enabled
  const statusRaw = normalizeOptionalString(payload?.status)
  const status: SourceFile['status'] =
    statusRaw === 'idle' || statusRaw === 'parsed' || statusRaw === 'error' ? statusRaw : 'idle'
  const text = normalizeText(payload?.text)

  const sourceKind = normalizeOptionalString(payload?.source?.kind)
  const sourcePath = normalizeOptionalString(payload?.source?.path)
  const sourceUrl = normalizeOptionalString(payload?.source?.url)
  const source =
    sourceKind === 'local'
      ? ({ kind: 'local', path: sourcePath || name } satisfies SourceFile['source'])
      : sourceKind === 'url'
      ? ({ kind: 'url', url: sourceUrl || undefined } satisfies SourceFile['source'])
      : undefined

  return {
    id: id || '',
    name,
    text,
    enabled,
    geoLayerEnabled: payload?.geoLayerEnabled,
    status,
    error: normalizeOptionalString(payload?.error) || undefined,
    parsedParserId: normalizeOptionalString(payload?.parsedParserId) || undefined,
    parsedTextHash: normalizeOptionalString(payload?.parsedTextHash) || undefined,
    source,
  } satisfies SourceFile
}

const normalizeWorkspaceState = (v: unknown): SourceFilesWorkspaceState => {
  const obj = (v && typeof v === 'object' ? (v as Record<string, unknown>) : {})
  const accessModeRaw = normalizeOptionalString(obj.accessMode)
  const accessMode: SourceFilesWorkspaceState['accessMode'] =
    accessModeRaw === 'fs-access' || accessModeRaw === 'opfs' || accessModeRaw === 'file-input'
      ? accessModeRaw
      : null
  return {
    folderName: normalizeOptionalString(obj.folderName),
    accessMode,
    folderCacheId: normalizeOptionalString(obj.folderCacheId),
    selectedFolderPath: normalizeWorkspacePath(obj.selectedFolderPath),
  }
}

export const loadPersistedSourceFiles = async (): Promise<SourceFile[]> => {
  const { collections } = await getDb()
  const rows = await collections.sourceFiles.find().sort({ orderIndex: 'asc' }).exec()
  const loaded = rows
    .map(r => {
      try {
        const next = normalizeSourceFileForPersistence(r.get('payload') as SourceFile)
        if (!next.id) return null
        return next
      } catch {
        return null
      }
    })
    .filter(Boolean) as SourceFile[]
  return reconcileDefaultWorkspaceSeedSourceFiles(loaded)
}

export const persistSourceFiles = async (files: SourceFile[]): Promise<void> => {
  const list = Array.isArray(files) ? files : []
  const now = Date.now()
  const rows: SourceFileRowV1[] = list
    .map((payload, orderIndex) => {
      const normalized = normalizeSourceFileForPersistence(payload)
      const id = String(normalized?.id || '').trim()
      if (!id) return null
      return { id, orderIndex, payload: normalized, updatedAtMs: now } satisfies SourceFileRowV1
    })
    .filter(Boolean) as SourceFileRowV1[]

  const { collections } = await getDb()
  const existing = await collections.sourceFiles.find().exec()
  const keep = new Set(rows.map(r => r.id))
  for (const doc of existing) {
    if (keep.has(doc.get('id'))) continue
    await doc.remove()
  }
  for (const row of rows) {
    await collections.sourceFiles.incrementalUpsert(row)
  }
}

export const loadPersistedSourceFilesWorkspace = async (): Promise<SourceFilesWorkspaceState> => {
  const { collections } = await getDb()
  const row = await collections.workspace.findOne('workspace').exec()
  if (!row) return { folderName: null, accessMode: null, folderCacheId: null, selectedFolderPath: null }
  return normalizeWorkspaceState(row.get('payload'))
}

export const persistSourceFilesWorkspace = async (state: SourceFilesWorkspaceState): Promise<void> => {
  const { collections } = await getDb()
  const now = Date.now()
  const payload = normalizeWorkspaceState(state)
  await collections.workspace.incrementalUpsert({ id: 'workspace', payload, updatedAtMs: now })
}
