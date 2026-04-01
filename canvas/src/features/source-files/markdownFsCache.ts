import { createRxDatabase, type RxCollection, type RxDatabase, type RxJsonSchema } from 'rxdb/plugins/core'
import { getCanvasRxStorage } from '@/lib/storage/rxdbStorage'

export type MarkdownFsAccessMode = 'fs-access' | 'opfs' | 'file-input' | null

export type MarkdownFsFolderRow = {
  id: string
  name: string | null
  accessMode: MarkdownFsAccessMode
  updatedAtMs: number
}

export type MarkdownFsEntryRow = {
  id: string
  folderId: string
  path: string
  text: string
  updatedAtMs: number
}

const MARKDOWN_FS_DB_NAME = 'kg:markdown-fs'

type MarkdownFsCollections = {
  folders: RxCollection<MarkdownFsFolderRow>
  entries: RxCollection<MarkdownFsEntryRow>
}

const folderSchema: RxJsonSchema<MarkdownFsFolderRow> = {
  title: 'markdown_fs_folder',
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 256 },
    name: { type: ['string', 'null'] },
    accessMode: { type: ['string', 'null'] },
    updatedAtMs: { type: 'integer', minimum: 0, maximum: 9_007_199_254_740_991, multipleOf: 1 },
  },
  required: ['id', 'name', 'accessMode', 'updatedAtMs'],
  indexes: ['updatedAtMs'],
}

const entrySchema: RxJsonSchema<MarkdownFsEntryRow> = {
  title: 'markdown_fs_entry',
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 1024 },
    folderId: { type: 'string', maxLength: 256 },
    path: { type: 'string', maxLength: 2048 },
    text: { type: 'string' },
    updatedAtMs: { type: 'integer', minimum: 0, maximum: 9_007_199_254_740_991, multipleOf: 1 },
  },
  required: ['id', 'folderId', 'path', 'text', 'updatedAtMs'],
  indexes: ['folderId', ['folderId', 'path'], 'updatedAtMs'],
}

let dbSingleton: Promise<{ db: RxDatabase<MarkdownFsCollections>; collections: MarkdownFsCollections }> | null = null

const getDb = async () => {
  if (dbSingleton) return dbSingleton
  dbSingleton = (async () => {
    const db = await createRxDatabase<MarkdownFsCollections>({
      name: MARKDOWN_FS_DB_NAME,
      storage: getCanvasRxStorage(),
      multiInstance: true,
      eventReduce: true,
      closeDuplicates: true,
    })
    const collections = await db.addCollections({
      folders: { schema: folderSchema },
      entries: { schema: entrySchema },
    })
    return { db, collections }
  })()
  return dbSingleton
}

const buildFolderId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `mdfs_${Date.now()}_${Math.random().toString(16).slice(2)}`
}

const entryId = (folderId: string, path: string): string => `${folderId}:${String(path || '').trim().toLowerCase()}`

export async function cacheMarkdownFolderFromFileInput(args: {
  folderName: string | null
  entries: Array<{ path: string; text: string }>
}): Promise<{ folderId: string }> {
  const folderId = buildFolderId()
  const now = Date.now()
  const folderRow: MarkdownFsFolderRow = {
    id: folderId,
    name: args.folderName,
    accessMode: 'file-input',
    updatedAtMs: now,
  }
  const rows: MarkdownFsEntryRow[] = args.entries.map(e => ({
    id: entryId(folderId, e.path),
    folderId,
    path: e.path,
    text: e.text,
    updatedAtMs: now,
  }))

  const { collections } = await getDb()
  await collections.folders.incrementalUpsert(folderRow)
  for (const row of rows) await collections.entries.incrementalUpsert(row)
  return { folderId }
}

export async function listCachedMarkdownPaths(folderId: string): Promise<string[]> {
  const id = String(folderId || '').trim()
  if (!id) return []
  const { collections } = await getDb()
  const rows = await collections.entries.find({ selector: { folderId: id } }).exec()
  return rows
    .map(r => String(r.get('path') || '').trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b))
}

export async function readCachedMarkdownText(folderId: string, path: string): Promise<string | null> {
  const id = String(folderId || '').trim()
  const p = String(path || '').trim().replace(/\\/g, '/').replace(/^\/+/, '')
  if (!id || !p) return null
  const { collections } = await getDb()
  const row = await collections.entries.findOne(entryId(id, p)).exec()
  return row?.get('text') ?? null
}

export async function writeCachedMarkdownText(folderId: string, path: string, text: string): Promise<void> {
  const id = String(folderId || '').trim()
  const p = String(path || '').trim().replace(/\\/g, '/').replace(/^\/+/, '')
  if (!id || !p) return
  const now = Date.now()
  const nextText = String(text ?? '')
  const key = entryId(id, p)
  const { collections } = await getDb()
  const folder = await collections.folders.findOne(id).exec()
  if (folder) await folder.incrementalPatch({ updatedAtMs: now })
  await collections.entries.incrementalUpsert({ id: key, folderId: id, path: p, text: nextText, updatedAtMs: now })
}

export async function getCachedMarkdownFolderMetadata(folderId: string): Promise<MarkdownFsFolderRow | null> {
  const id = String(folderId || '').trim()
  if (!id) return null
  const { collections } = await getDb()
  const row = await collections.folders.findOne(id).exec()
  return row ? row.toJSON() : null
}

export async function getMostRecentCachedMarkdownFolderId(): Promise<string | null> {
  const { collections } = await getDb()
  const row = await collections.folders.find().sort({ updatedAtMs: 'desc' }).limit(1).exec()
  return row[0]?.get('id') ?? null
}
