import {
  createPersistedCollectionDb,
  type PersistedCollectionMap,
} from '@/lib/storage/persistedCollectionStore'

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

type MarkdownFsRecordMap = {
  folders: MarkdownFsFolderRow
  entries: MarkdownFsEntryRow
}
type MarkdownFsCollections = PersistedCollectionMap<MarkdownFsRecordMap>
let dbSingleton: Promise<ReturnType<typeof createPersistedCollectionDb<MarkdownFsRecordMap>>> | null = null
const normalizeNonNegativeInt = (value: unknown, fallback = 0): number => {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n) || n < 0) return Math.max(0, Math.floor(fallback))
  return Math.floor(n)
}

const getDb = async () => {
  if (dbSingleton) return dbSingleton
  dbSingleton = (async () => {
    return createPersistedCollectionDb<MarkdownFsRecordMap>({
      storageKey: MARKDOWN_FS_DB_NAME,
      collectionNames: ['folders', 'entries'],
    })
  })()
  return dbSingleton.catch(err => {
    dbSingleton = null
    throw err
  })
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
  await collections.folders.incrementalUpsert({
    ...folderRow,
    updatedAtMs: normalizeNonNegativeInt(folderRow.updatedAtMs, now),
  })
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i]!
    await collections.entries.incrementalUpsert({
      ...row,
      updatedAtMs: normalizeNonNegativeInt(row.updatedAtMs, now),
    })
  }
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
  if (folder) await folder.incrementalPatch({ updatedAtMs: normalizeNonNegativeInt(now, now) })
  await collections.entries.incrementalUpsert({
    id: key,
    folderId: id,
    path: p,
    text: nextText,
    updatedAtMs: normalizeNonNegativeInt(now, now),
  })
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
