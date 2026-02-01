import Dexie, { type Table } from 'dexie'
import type { SourceFile } from '@/hooks/store/types'

export const SOURCE_FILES_DB_NAME = 'kg:source-files'
export const SOURCE_FILES_DB_VERSION = 2

export type SourceFilesWorkspaceState = {
  folderName: string | null
  accessMode: 'fs-access' | 'opfs' | 'file-input' | null
  folderCacheId: string | null
  selectedFolderPath: string | null
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

class SourceFilesDb extends Dexie {
  sourceFiles!: Table<SourceFileRowV1, string>
  workspace!: Table<WorkspaceRowV1, string>

  constructor() {
    super(SOURCE_FILES_DB_NAME)
    this.version(1).stores({
      sourceFiles: '&id, orderIndex, updatedAtMs',
    })
    this.version(SOURCE_FILES_DB_VERSION).stores({
      sourceFiles: '&id, orderIndex, updatedAtMs',
      workspace: '&id, updatedAtMs',
    })
  }
}

let dbSingleton: SourceFilesDb | null = null

const getDb = (): SourceFilesDb => {
  if (dbSingleton) return dbSingleton
  dbSingleton = new SourceFilesDb()
  return dbSingleton
}

export const loadPersistedSourceFiles = async (): Promise<SourceFile[]> => {
  const db = getDb()
  const rows = await db.sourceFiles.orderBy('orderIndex').toArray()
  return rows
    .map(r => {
      try {
        const next = normalizeSourceFileForPersistence(r.payload as SourceFile)
        if (!next.id) return null
        return next
      } catch {
        return null
      }
    })
    .filter(Boolean) as SourceFile[]
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

  const db = getDb()
  await db.transaction('rw', db.sourceFiles, async () => {
    const kept = new Set(rows.map(r => r.id))
    const existing = await db.sourceFiles.toCollection().primaryKeys()
    const toDelete = existing.filter(id => !kept.has(String(id)))
    if (toDelete.length > 0) await db.sourceFiles.bulkDelete(toDelete)
    if (rows.length > 0) await db.sourceFiles.bulkPut(rows)
  })
}

export const loadPersistedSourceFilesWorkspace = async (): Promise<SourceFilesWorkspaceState> => {
  const db = getDb()
  const row = await db.workspace.get('workspace')
  if (!row) return { folderName: null, accessMode: null, folderCacheId: null, selectedFolderPath: null }
  return normalizeWorkspaceState(row.payload)
}

export const persistSourceFilesWorkspace = async (state: SourceFilesWorkspaceState): Promise<void> => {
  const db = getDb()
  const now = Date.now()
  const payload = normalizeWorkspaceState(state)
  await db.workspace.put({ id: 'workspace', payload, updatedAtMs: now })
}
