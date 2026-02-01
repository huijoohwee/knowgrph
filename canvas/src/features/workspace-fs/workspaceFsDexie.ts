import Dexie, { type Table } from 'dexie'
import type { WorkspaceEntry, WorkspaceFs, WorkspacePath } from './types'
import { WORKSPACE_ROOT_PATH, joinWorkspacePath, normalizeWorkspacePath } from './path'
import { WORKSPACE_SEED_FILES } from './workspaceFs'

const DB_NAME = 'kg:workspace-fs'
const DB_VERSION = 1

type WorkspaceEntryRow = WorkspaceEntry

class WorkspaceDb extends Dexie {
  entries!: Table<WorkspaceEntryRow, string>

  constructor() {
    super(DB_NAME)
    this.version(DB_VERSION).stores({
      entries: '&path, parentPath, kind, updatedAtMs',
    })
  }
}

let dbSingleton: WorkspaceDb | null = null

const getDb = () => {
  if (dbSingleton) return dbSingleton
  dbSingleton = new WorkspaceDb()
  return dbSingleton
}

export function createDexieWorkspaceFs(): WorkspaceFs {
  const ensureRoot = async () => {
    const db = getDb()
    const existing = await db.entries.get(WORKSPACE_ROOT_PATH)
    if (existing) return
    await db.entries.put({
      path: WORKSPACE_ROOT_PATH,
      parentPath: null,
      kind: 'folder',
      name: '',
      updatedAtMs: Date.now(),
    })
  }

  const ensureSeed = async () => {
    const db = getDb()
    await ensureRoot()
    const fileCount = await db.entries.where('kind').equals('file').count()
    if (fileCount > 0) return
    const now = Date.now()
    await db.transaction('rw', db.entries, async () => {
      for (const seed of WORKSPACE_SEED_FILES) {
        const path = normalizeWorkspacePath(seed.path)
        await db.entries.put({
          path,
          parentPath: WORKSPACE_ROOT_PATH,
          kind: 'file',
          name: path.split('/').pop() || '',
          text: seed.text,
          updatedAtMs: now,
        })
      }
    })
  }

  const listEntries = async () => {
    const db = getDb()
    await ensureRoot()
    const rows = await db.entries.toArray()
    return rows.sort((a, b) => a.path.localeCompare(b.path))
  }

  const readFileText = async (path: WorkspacePath) => {
    const db = getDb()
    const p = normalizeWorkspacePath(path)
    const row = await db.entries.get(p)
    if (!row || row.kind !== 'file') return null
    return String(row.text ?? '')
  }

  const writeFileText = async (path: WorkspacePath, text: string) => {
    const db = getDb()
    const p = normalizeWorkspacePath(path)
    const row = await db.entries.get(p)
    if (!row || row.kind !== 'file') return
    await db.entries.put({
      ...row,
      text: String(text ?? ''),
      updatedAtMs: Date.now(),
    })
  }

  const createFolder = async (args: { parentPath: WorkspacePath; name: string }) => {
    const db = getDb()
    await ensureRoot()
    const parent = normalizeWorkspacePath(args.parentPath)
    const desired = String(args.name ?? '').trim() || 'folder'
    let name = desired
    let path = joinWorkspacePath(parent, name)
    for (let i = 2; i <= 999; i += 1) {
      const exists = await db.entries.get(path)
      if (!exists) break
      name = `${desired}-${i}`
      path = joinWorkspacePath(parent, name)
    }
    await db.entries.put({
      path,
      parentPath: parent,
      kind: 'folder',
      name,
      updatedAtMs: Date.now(),
    })
    return path
  }

  const createFile = async (args: { parentPath: WorkspacePath; name: string; text: string }) => {
    const db = getDb()
    await ensureRoot()
    const parent = normalizeWorkspacePath(args.parentPath)
    const desired = String(args.name ?? '').trim() || 'file.md'
    let name = desired
    let path = joinWorkspacePath(parent, name)
    for (let i = 2; i <= 999; i += 1) {
      const exists = await db.entries.get(path)
      if (!exists) break
      const extIndex = desired.lastIndexOf('.')
      const stem = extIndex > 0 ? desired.slice(0, extIndex) : desired
      const ext = extIndex > 0 ? desired.slice(extIndex) : ''
      name = `${stem}-${i}${ext}`
      path = joinWorkspacePath(parent, name)
    }
    await db.entries.put({
      path,
      parentPath: parent,
      kind: 'file',
      name,
      text: String(args.text ?? ''),
      updatedAtMs: Date.now(),
    })
    return path
  }

  const deleteEntry = async (path: WorkspacePath) => {
    const db = getDb()
    await ensureRoot()
    const p = normalizeWorkspacePath(path)
    if (p === WORKSPACE_ROOT_PATH) return
    const row = await db.entries.get(p)
    if (!row) return
    if (row.kind === 'file') {
      await db.entries.delete(p)
      return
    }
    const prefix = p.endsWith('/') ? p : `${p}/`
    await db.transaction('rw', db.entries, async () => {
      const all = await db.entries.toArray()
      const toDelete = all
        .map(r => r.path)
        .filter(key => key === p || key.startsWith(prefix))
      if (toDelete.length > 0) await db.entries.bulkDelete(toDelete)
    })
  }

  return {
    ensureSeed,
    listEntries,
    readFileText,
    writeFileText,
    createFile,
    createFolder,
    deleteEntry,
  }
}

