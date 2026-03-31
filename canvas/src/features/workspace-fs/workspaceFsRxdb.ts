import { createRxDatabase, type RxCollection, type RxDatabase, type RxJsonSchema } from 'rxdb/plugins/core'
import type { WorkspaceEntry, WorkspaceFs, WorkspacePath } from './types'
import { WORKSPACE_ROOT_PATH, joinWorkspacePath, normalizeWorkspacePath } from './path'
import { LEGACY_WORKSPACE_README_PATH, LEGACY_WORKSPACE_README_TEXT, getWorkspaceSeedFiles } from './workspaceFs'
import { notifyWorkspaceFsChanged } from './workspaceFsEvents'
import { LS_KEYS } from '@/lib/config'
import { lsBool, lsRemove, lsSetBool } from '@/lib/persistence'
import { getCanvasRxStorage } from '@/lib/storage/rxdbStorage'

const DB_NAME = 'kg:workspace-fs'

type WorkspaceEntryRow = WorkspaceEntry
type WorkspaceCollections = {
  entries: RxCollection<WorkspaceEntryRow>
}

const workspaceEntrySchema: RxJsonSchema<WorkspaceEntryRow> = {
  title: 'workspace_entry',
  version: 0,
  primaryKey: 'path',
  type: 'object',
  properties: {
    path: { type: 'string', maxLength: 2048 },
    parentPath: { type: ['string', 'null'], maxLength: 2048 },
    kind: { type: 'string', maxLength: 16 },
    name: { type: 'string' },
    text: { type: ['string', 'null'] },
    updatedAtMs: { type: 'number' },
  },
  required: ['path', 'parentPath', 'kind', 'name', 'updatedAtMs'],
  indexes: ['parentPath', 'kind', 'updatedAtMs'],
}

let dbSingleton: Promise<{ db: RxDatabase<WorkspaceCollections>; collections: WorkspaceCollections }> | null = null

const getDb = async () => {
  if (dbSingleton) return dbSingleton
  dbSingleton = (async () => {
    const db = await createRxDatabase<WorkspaceCollections>({
      name: DB_NAME,
      storage: getCanvasRxStorage(),
      multiInstance: true,
      eventReduce: true,
      closeDuplicates: true,
    })
    const collections = await db.addCollections({
      entries: { schema: workspaceEntrySchema },
    })
    return { db, collections }
  })()
  return dbSingleton
}

export function createWorkspaceRxdbFs(): WorkspaceFs {
  const ensureRoot = async () => {
    const { collections } = await getDb()
    const existing = await collections.entries.findOne(WORKSPACE_ROOT_PATH).exec()
    if (existing) return
    await collections.entries.insert({
      path: WORKSPACE_ROOT_PATH,
      parentPath: null,
      kind: 'folder',
      name: '',
      updatedAtMs: Date.now(),
    })
  }

  const ensureSeed = async () => {
    const { collections } = await getDb()
    await ensureRoot()
    const legacyPath = normalizeWorkspacePath(LEGACY_WORKSPACE_README_PATH)
    const legacy = await collections.entries.findOne(legacyPath).exec()
    if (legacy && legacy.get('kind') === 'file' && String(legacy.get('text') ?? '') === LEGACY_WORKSPACE_README_TEXT) {
      await legacy.remove()
    }
    const fileCount = await collections.entries.find({ selector: { kind: 'file' } }).exec().then(rows => rows.length)
    const seeded = lsBool(LS_KEYS.markdownWorkspaceSeeded, false)
    const userClearedAll = lsBool(LS_KEYS.markdownWorkspaceUserClearedAllFiles, false)
    if (fileCount > 0) {
      if (!seeded) lsSetBool(LS_KEYS.markdownWorkspaceSeeded, true)
      if (userClearedAll) lsRemove(LS_KEYS.markdownWorkspaceUserClearedAllFiles)
      return
    }
    if (userClearedAll) return
    const now = Date.now()
    const seeds = await getWorkspaceSeedFiles()
    for (const seed of seeds) {
      const path = normalizeWorkspacePath(seed.path)
      await collections.entries.incrementalUpsert({
        path,
        parentPath: WORKSPACE_ROOT_PATH,
        kind: 'file',
        name: path.split('/').pop() || '',
        text: seed.text,
        updatedAtMs: now,
      })
    }
    lsSetBool(LS_KEYS.markdownWorkspaceSeeded, true)
    if (userClearedAll) lsRemove(LS_KEYS.markdownWorkspaceUserClearedAllFiles)
  }

  const listEntries = async () => {
    await ensureRoot()
    const { collections } = await getDb()
    const rows = await collections.entries.find().exec()
    return rows.map(r => r.toJSON()).sort((a, b) => a.path.localeCompare(b.path))
  }

  const readFileText = async (path: WorkspacePath) => {
    const { collections } = await getDb()
    const p = normalizeWorkspacePath(path)
    const row = await collections.entries.findOne(p).exec()
    if (!row || row.get('kind') !== 'file') return null
    return String(row.get('text') ?? '')
  }

  const writeFileText = async (path: WorkspacePath, text: string) => {
    const { collections } = await getDb()
    const p = normalizeWorkspacePath(path)
    const row = await collections.entries.findOne(p).exec()
    if (!row || row.get('kind') !== 'file') return
    await row.incrementalPatch({
      text: String(text ?? ''),
      updatedAtMs: Date.now(),
    })
    notifyWorkspaceFsChanged({ op: 'writeFileText', path: p })
  }

  const createFolder = async (args: { parentPath: WorkspacePath; name: string }) => {
    await ensureRoot()
    const { collections } = await getDb()
    const parent = normalizeWorkspacePath(args.parentPath)
    const desired = String(args.name ?? '').trim() || 'folder'
    let name = desired
    let path = joinWorkspacePath(parent, name)
    for (let i = 2; i <= 999; i += 1) {
      const exists = await collections.entries.findOne(path).exec()
      if (!exists) break
      name = `${desired}-${i}`
      path = joinWorkspacePath(parent, name)
    }
    await collections.entries.insert({
      path,
      parentPath: parent,
      kind: 'folder',
      name,
      updatedAtMs: Date.now(),
    })
    notifyWorkspaceFsChanged({ op: 'createFolder', path })
    return path
  }

  const createFile = async (args: { parentPath: WorkspacePath; name: string; text: string }) => {
    await ensureRoot()
    const { collections } = await getDb()
    const parent = normalizeWorkspacePath(args.parentPath)
    const desired = String(args.name ?? '').trim() || 'file.md'
    let name = desired
    let path = joinWorkspacePath(parent, name)
    for (let i = 2; i <= 999; i += 1) {
      const exists = await collections.entries.findOne(path).exec()
      if (!exists) break
      const extIndex = desired.lastIndexOf('.')
      const stem = extIndex > 0 ? desired.slice(0, extIndex) : desired
      const ext = extIndex > 0 ? desired.slice(extIndex) : ''
      name = `${stem}-${i}${ext}`
      path = joinWorkspacePath(parent, name)
    }
    await collections.entries.insert({
      path,
      parentPath: parent,
      kind: 'file',
      name,
      text: String(args.text ?? ''),
      updatedAtMs: Date.now(),
    })
    if (lsBool(LS_KEYS.markdownWorkspaceUserClearedAllFiles, false)) lsRemove(LS_KEYS.markdownWorkspaceUserClearedAllFiles)
    notifyWorkspaceFsChanged({ op: 'createFile', path })
    return path
  }

  const deleteEntry = async (path: WorkspacePath) => {
    await ensureRoot()
    const { collections } = await getDb()
    const p = normalizeWorkspacePath(path)
    if (p === WORKSPACE_ROOT_PATH) return
    const row = await collections.entries.findOne(p).exec()
    if (!row) return
    if (row.get('kind') === 'file') {
      await row.remove()
      const remaining = await collections.entries.find({ selector: { kind: 'file' } }).exec().then(rows => rows.length)
      if (remaining === 0) lsSetBool(LS_KEYS.markdownWorkspaceUserClearedAllFiles, true)
      notifyWorkspaceFsChanged({ op: 'deleteEntry', path: p })
      return
    }
    const prefix = p.endsWith('/') ? p : `${p}/`
    const all = await collections.entries.find().exec()
    for (const doc of all) {
      const key = doc.get('path')
      if (key === p || key.startsWith(prefix)) await doc.remove()
    }
    const remaining = await collections.entries.find({ selector: { kind: 'file' } }).exec().then(rows => rows.length)
    if (remaining === 0) lsSetBool(LS_KEYS.markdownWorkspaceUserClearedAllFiles, true)
    notifyWorkspaceFsChanged({ op: 'deleteEntry', path: p })
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
