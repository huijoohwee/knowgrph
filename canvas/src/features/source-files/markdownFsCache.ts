import Dexie, { type Table } from 'dexie'

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
const MARKDOWN_FS_DB_VERSION = 1

class MarkdownFsDb extends Dexie {
  folders!: Table<MarkdownFsFolderRow, string>
  entries!: Table<MarkdownFsEntryRow, string>

  constructor() {
    super(MARKDOWN_FS_DB_NAME)
    this.version(MARKDOWN_FS_DB_VERSION).stores({
      folders: '&id, updatedAtMs',
      entries: '&id, folderId, path, updatedAtMs',
    })
  }
}

type MemoryStore = {
  folders: Map<string, MarkdownFsFolderRow>
  entries: Map<string, MarkdownFsEntryRow>
}

let dbSingleton: MarkdownFsDb | null = null
const MEMORY_STORE_KEY = '__KG_MARKDOWN_FS_CACHE__'

const canUseIndexedDb = (): boolean => {
  return typeof indexedDB !== 'undefined'
}

const getDb = (): MarkdownFsDb | null => {
  if (!canUseIndexedDb()) return null
  if (dbSingleton) return dbSingleton
  dbSingleton = new MarkdownFsDb()
  return dbSingleton
}

const getMemory = (): MemoryStore => {
  const g = globalThis as unknown as Record<string, unknown>
  const existing = g[MEMORY_STORE_KEY] as MemoryStore | undefined
  if (existing && existing.folders instanceof Map && existing.entries instanceof Map) return existing
  const created: MemoryStore = {
    folders: new Map(),
    entries: new Map(),
  }
  g[MEMORY_STORE_KEY] = created
  return created
}

const buildFolderId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `mdfs_${Date.now()}_${Math.random().toString(16).slice(2)}`
}

const entryId = (folderId: string, path: string): string => {
  return `${folderId}:${String(path || '').trim().toLowerCase()}`
}

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

  const db = getDb()
  if (!db) {
    const mem = getMemory()
    mem.folders.set(folderId, folderRow)
    for (const r of rows) mem.entries.set(r.id, r)
    return { folderId }
  }

  await db.transaction('rw', db.folders, db.entries, async () => {
    await db.folders.put(folderRow)
    if (rows.length > 0) await db.entries.bulkPut(rows)
  })
  return { folderId }
}

export async function listCachedMarkdownPaths(folderId: string): Promise<string[]> {
  const id = String(folderId || '').trim()
  if (!id) return []
  const db = getDb()
  if (!db) {
    const mem = getMemory()
    const out: string[] = []
    for (const row of mem.entries.values()) {
      if (row.folderId === id) out.push(row.path)
    }
    out.sort((a, b) => a.localeCompare(b))
    return out
  }

  const rows = await db.entries.where('folderId').equals(id).toArray()
  return rows
    .map(r => String(r.path || '').trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b))
}

export async function readCachedMarkdownText(folderId: string, path: string): Promise<string | null> {
  const id = String(folderId || '').trim()
  const p = String(path || '').trim().replace(/\\/g, '/').replace(/^\/+/, '')
  if (!id || !p) return null
  const db = getDb()
  const key = entryId(id, p)
  if (!db) {
    const mem = getMemory()
    return mem.entries.get(key)?.text ?? null
  }
  const row = await db.entries.get(key)
  return row?.text ?? null
}

export async function writeCachedMarkdownText(folderId: string, path: string, text: string): Promise<void> {
  const id = String(folderId || '').trim()
  const p = String(path || '').trim().replace(/\\/g, '/').replace(/^\/+/, '')
  if (!id || !p) return
  const now = Date.now()
  const nextText = String(text ?? '')
  const db = getDb()
  const key = entryId(id, p)

  if (!db) {
    const mem = getMemory()
    const prevFolder = mem.folders.get(id)
    if (prevFolder) mem.folders.set(id, { ...prevFolder, updatedAtMs: now })
    const prevEntry = mem.entries.get(key)
    mem.entries.set(key, {
      ...(prevEntry || { id: key, folderId: id, path: p, text: nextText, updatedAtMs: now }),
      id: key,
      folderId: id,
      path: p,
      text: nextText,
      updatedAtMs: now,
    })
    return
  }

  await db.transaction('rw', db.folders, db.entries, async () => {
    const existingFolder = await db.folders.get(id)
    if (existingFolder) {
      await db.folders.put({ ...existingFolder, updatedAtMs: now })
    }

    const existingEntry = await db.entries.get(key)
    if (existingEntry) {
      await db.entries.put({ ...existingEntry, text: nextText, updatedAtMs: now })
      return
    }
    await db.entries.put({ id: key, folderId: id, path: p, text: nextText, updatedAtMs: now })
  })
}

export async function getCachedMarkdownFolderMetadata(folderId: string): Promise<MarkdownFsFolderRow | null> {
  const id = String(folderId || '').trim()
  if (!id) return null
  const db = getDb()
  if (!db) {
    const mem = getMemory()
    return mem.folders.get(id) ?? null
  }
  return (await db.folders.get(id)) ?? null
}

export async function getMostRecentCachedMarkdownFolderId(): Promise<string | null> {
  const db = getDb()
  if (!db) {
    const mem = getMemory()
    let best: MarkdownFsFolderRow | null = null
    for (const row of mem.folders.values()) {
      if (!best || row.updatedAtMs > best.updatedAtMs) best = row
    }
    return best?.id ?? null
  }

  const row = await db.folders.orderBy('updatedAtMs').reverse().first()
  return row?.id ?? null
}
