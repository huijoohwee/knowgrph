import type { WorkspaceEntry, WorkspaceFs, WorkspacePath } from './types'
import { WORKSPACE_ROOT_PATH, joinWorkspacePath, normalizeWorkspacePath, workspaceBasename } from './path'
import {
  CUSTOM_TEST_VALIDATION_WORKSPACE_SEED_ACTIVE,
  buildWorkspaceSeedFileEntry,
  expandWorkspaceSeedFileEntries,
  GEOSPATIAL_WORKSPACE_SEED_BASENAME,
  GEOSPATIAL_WORKSPACE_SEED_PATH,
  TEST_VALIDATION_WORKSPACE_SEED_BASENAME,
  getWorkspaceSeedFiles,
  isInitializationWorkspacePath,
  WORKSPACE_README_SEED_BASENAME,
  WORKSPACE_README_SEED_PATH,
  TEST_VALIDATION_WORKSPACE_SEED_PATH,
  shouldPreserveFallbackWorkspaceSeedText,
} from './workspaceFs'
import { upsertWorkspaceInitializationSeedText } from './workspaceSeedProvider'
import { readWorkspaceInitializationDocsMirrorEntries } from './workspaceSeedProvider'
import { ensureWorkspaceDocsMirrorFolder, upsertWorkspaceDocsMirrorText } from './workspaceSeedProvider'
import { notifyWorkspaceFsChanged } from './workspaceFsEvents'
import { LS_KEYS } from '@/lib/config'
import { lsBool, lsJson, lsRemove, lsSetBool } from '@/lib/persistence'
import {
  createPersistedCollectionDb,
  type PersistedCollectionDb,
  type PersistedCollectionMap,
} from '@/lib/storage/persistedCollectionStore'
import { readWorkspaceSourceFilesDocsOnlySetting } from '@/lib/workspace/workspaceStoreSyncSettings'
import { CHAT_LOCAL_STORAGE_ROOT_PATH_DEFAULT, normalizeChatLocalStorageRootPath } from '@/features/chat/chatStorageConfig'

const DB_NAME = 'kg:workspace-fs'
let lastDocsMirrorSyncSignature = ''
const WORKSPACE_DOCS_MIRROR_FLUSH_DEBOUNCE_MS = 150
const docsMirrorFolderFlushTimers = new Map<WorkspacePath, number>()
const docsMirrorTextFlushTimers = new Map<WorkspacePath, number>()
const docsMirrorPendingTextByPath = new Map<WorkspacePath, string>()

type WorkspaceEntryRow = WorkspaceEntry
type WorkspaceRecordMap = {
  entries: WorkspaceEntryRow
}
type WorkspaceCollections = PersistedCollectionMap<WorkspaceRecordMap>
type WorkspaceFsDb = PersistedCollectionDb<WorkspaceRecordMap>
let dbSingleton: Promise<WorkspaceFsDb> | null = null

const WORKSPACE_SEED_BASENAME_BY_PATH = new Map<WorkspacePath, string>([
  [WORKSPACE_README_SEED_PATH, WORKSPACE_README_SEED_BASENAME],
  [TEST_VALIDATION_WORKSPACE_SEED_PATH, TEST_VALIDATION_WORKSPACE_SEED_BASENAME],
  [GEOSPATIAL_WORKSPACE_SEED_PATH, GEOSPATIAL_WORKSPACE_SEED_BASENAME],
])
const WORKSPACE_DOCS_MIRROR_ROOT_PATH = normalizeWorkspacePath('/docs')
const WORKSPACE_AGENTIC_OS_DOCS_MIRROR_ROOT_PATH = normalizeWorkspacePath('/agentic-os-docs')
const readChatLocalStorageRootPath = (): WorkspacePath => {
  const value = lsJson<string>(
    LS_KEYS.chatLocalStorageRootPath,
    CHAT_LOCAL_STORAGE_ROOT_PATH_DEFAULT,
    input => (typeof input === 'string' ? input : null),
  )
  return normalizeWorkspacePath(normalizeChatLocalStorageRootPath(value))
}

const isWorkspaceUnderRoot = (path: WorkspacePath, rootPath: WorkspacePath): boolean => {
  const normalizedPath = normalizeWorkspacePath(path)
  const normalizedRootPath = normalizeWorkspacePath(rootPath)
  if (!normalizedPath || !normalizedRootPath || normalizedRootPath === '/') return false
  if (normalizedPath === normalizedRootPath) return true
  return normalizedPath.startsWith(`${normalizedRootPath}/`)
}
const normalizeUpdatedAtMs = (value: unknown, fallback = Date.now()): number => {
  const n = Number(value)
  if (!Number.isFinite(n) || n < 0) return Math.max(0, Math.floor(fallback))
  return Math.floor(n)
}

const readWorkspaceSeedBasenameForPath = (path: WorkspacePath): string | null => {
  return WORKSPACE_SEED_BASENAME_BY_PATH.get(path) || null
}

const normalizeDocsMirrorRelPath = (value: string): string => {
  const normalized = String(value || '')
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')
  if (!normalized) return ''
  const lowered = normalized.toLowerCase()
  const docsRootMarker = 'huijoohwee/docs/'
  if (lowered.startsWith(docsRootMarker)) {
    return normalized.slice(docsRootMarker.length)
  }
  if (lowered.startsWith(`docs/${docsRootMarker}`)) {
    return normalized.slice(`docs/${docsRootMarker}`.length)
  }
  const docsRootIndex = lowered.indexOf(`/${docsRootMarker}`)
  if (docsRootIndex >= 0) {
    return normalized.slice(docsRootIndex + docsRootMarker.length + 1)
  }
  return normalized
}

const toWorkspaceDocsMirrorPath = (relPath: string): WorkspacePath => {
  const normalizedRelPath = normalizeDocsMirrorRelPath(relPath)
  if (normalizedRelPath === 'agentic-os-docs' || normalizedRelPath.startsWith('agentic-os-docs/')) return normalizeWorkspacePath(`/${normalizedRelPath}`)
  return normalizeWorkspacePath(`${WORKSPACE_DOCS_MIRROR_ROOT_PATH}/${normalizedRelPath}`)
}

const isWorkspaceDocsMirrorPath = (path: WorkspacePath): boolean => isWorkspaceUnderRoot(path, WORKSPACE_DOCS_MIRROR_ROOT_PATH)
const isWorkspaceAgenticOsDocsMirrorPath = (path: WorkspacePath): boolean => isWorkspaceUnderRoot(path, WORKSPACE_AGENTIC_OS_DOCS_MIRROR_ROOT_PATH)
const isWorkspaceDocsBackedMirrorPath = (path: WorkspacePath): boolean => isWorkspaceDocsMirrorPath(path) || isWorkspaceAgenticOsDocsMirrorPath(path)
const isWorkspaceChatMirrorPath = (path: WorkspacePath): boolean => isWorkspaceUnderRoot(path, readChatLocalStorageRootPath())

const scheduleWorkspaceDocsMirrorFolderEnsure = (workspacePath: WorkspacePath): void => {
  if (typeof window === 'undefined') {
    void ensureWorkspaceDocsMirrorFolder({ workspacePath })
    return
  }
  const existingTimer = docsMirrorFolderFlushTimers.get(workspacePath)
  if (existingTimer) window.clearTimeout(existingTimer)
  const timer = window.setTimeout(() => {
    docsMirrorFolderFlushTimers.delete(workspacePath)
    void ensureWorkspaceDocsMirrorFolder({ workspacePath })
  }, WORKSPACE_DOCS_MIRROR_FLUSH_DEBOUNCE_MS)
  docsMirrorFolderFlushTimers.set(workspacePath, timer)
}

const scheduleWorkspaceDocsMirrorTextUpsert = (workspacePath: WorkspacePath, text: string): void => {
  if (typeof window === 'undefined') {
    void upsertWorkspaceDocsMirrorText({ workspacePath, text })
    return
  }
  docsMirrorPendingTextByPath.set(workspacePath, String(text ?? ''))
  const existingTimer = docsMirrorTextFlushTimers.get(workspacePath)
  if (existingTimer) window.clearTimeout(existingTimer)
  const timer = window.setTimeout(() => {
    docsMirrorTextFlushTimers.delete(workspacePath)
    const nextText = docsMirrorPendingTextByPath.get(workspacePath)
    docsMirrorPendingTextByPath.delete(workspacePath)
    if (typeof nextText !== 'string') return
    void upsertWorkspaceDocsMirrorText({
      workspacePath,
      text: nextText,
    })
  }, WORKSPACE_DOCS_MIRROR_FLUSH_DEBOUNCE_MS)
  docsMirrorTextFlushTimers.set(workspacePath, timer)
}

const buildDocsMirrorBasenameSet = (
  docsEntries: ReadonlyArray<{ relPath: string }>,
): Set<string> => {
  const out = new Set<string>()
  for (let i = 0; i < docsEntries.length; i += 1) {
    const relPath = normalizeDocsMirrorRelPath(String(docsEntries[i]?.relPath || ''))
    const basename = workspaceBasename(`/${relPath}`).toLowerCase()
    if (basename) out.add(basename)
  }
  return out
}

const isStaleRootMarkdownAliasCoveredByDocsMirror = (args: {
  path: WorkspacePath
  docsMirrorBasenames: ReadonlySet<string>
  rootSeedPaths: ReadonlySet<WorkspacePath>
}): boolean => {
  const path = normalizeWorkspacePath(args.path)
  if (!path || path.startsWith('/docs/')) return false
  if (args.rootSeedPaths.has(path)) return false
  const segments = path.split('/').filter(Boolean)
  if (segments.length !== 1) return false
  const basename = workspaceBasename(path)
  if (!basename || !/\.md$/i.test(basename)) return false
  if (!args.docsMirrorBasenames.has(basename.toLowerCase())) return false
  return true
}

const buildDocsMirrorSyncSignature = (
  docsEntries: ReadonlyArray<{ relPath: string; text: string; updatedAtMs: number }>,
): string => {
  const rows = (Array.isArray(docsEntries) ? docsEntries : [])
    .map(entry => {
      const relPath = normalizeDocsMirrorRelPath(String(entry?.relPath || ''))
      if (!relPath) return ''
      return `${relPath}:${Number(entry?.updatedAtMs || 0)}:${String(entry?.text || '').length}`
    })
    .filter(Boolean)
    .sort()
  return rows.join('|')
}

const syncWorkspaceDocsMirrorEntries = async (
  collections: WorkspaceCollections,
  docsEntriesInput?: ReadonlyArray<{ relPath: string; text: string; updatedAtMs: number }>,
): Promise<boolean> => {
  const docsEntries = Array.isArray(docsEntriesInput)
    ? [...docsEntriesInput]
    : await readWorkspaceInitializationDocsMirrorEntries({ preferCompleteDataset: true })
  if (docsEntries.length === 0) return false
  const docsMirrorSignature = buildDocsMirrorSyncSignature(docsEntries)
  if (docsMirrorSignature && docsMirrorSignature === lastDocsMirrorSyncSignature) return false
  const desiredEntriesByPath = new Map<WorkspacePath, WorkspaceEntry>()
  for (let i = 0; i < docsEntries.length; i += 1) {
    const entry = docsEntries[i]
    if (!entry) continue
    const mirrorPath = toWorkspaceDocsMirrorPath(entry.relPath)
    const expanded = expandWorkspaceSeedFileEntries(
      mirrorPath,
      String(entry.text || ''),
      Number.isFinite(entry.updatedAtMs) ? entry.updatedAtMs : Date.now(),
    )
    for (let j = 0; j < expanded.length; j += 1) {
      const next = expanded[j]
      if (!next) continue
      desiredEntriesByPath.set(next.path, next)
    }
  }
  if (desiredEntriesByPath.size === 0) return false
  const existingRows = await collections.entries.find().exec()
  let changed = false
  for (let i = 0; i < existingRows.length; i += 1) {
    const row = existingRows[i]
    if (!row) continue
    const existingPath = normalizeWorkspacePath(String(row.get('path') || ''))
    if (!existingPath.startsWith(`${WORKSPACE_DOCS_MIRROR_ROOT_PATH}/`)) continue
    const desired = desiredEntriesByPath.get(existingPath) || null
    if (!desired) {
      await row.remove()
      changed = true
      continue
    }
    desiredEntriesByPath.delete(existingPath)
    const existingKind = String(row.get('kind') || '')
    const existingName = String(row.get('name') || '')
    const existingParentPath = String(row.get('parentPath') || '')
    const existingText = String(row.get('text') ?? '')
    const nextParentPath = String(desired.parentPath || '')
    const nextText = desired.kind === 'file' ? String(desired.text || '') : ''
    if (
      existingKind !== desired.kind
      || existingName !== desired.name
      || existingParentPath !== nextParentPath
      || (desired.kind === 'file' && existingText !== nextText)
    ) {
      await row.incrementalPatch({
        parentPath: nextParentPath,
        kind: desired.kind,
        name: desired.name,
        text: nextText,
        updatedAtMs: normalizeUpdatedAtMs(desired.updatedAtMs),
      })
      changed = true
    }
  }
  const pendingEntries = [...desiredEntriesByPath.values()].sort((a, b) => a.path.localeCompare(b.path))
  for (let i = 0; i < pendingEntries.length; i += 1) {
    const entry = pendingEntries[i]
    if (!entry) continue
    await collections.entries.incrementalUpsert({
      path: entry.path,
      parentPath: String(entry.parentPath || ''),
      kind: entry.kind,
      name: entry.name,
      text: entry.kind === 'file' ? String(entry.text || '') : '',
      updatedAtMs: normalizeUpdatedAtMs(entry.updatedAtMs),
    })
    changed = true
  }
  if (docsMirrorSignature) lastDocsMirrorSyncSignature = docsMirrorSignature
  return changed
}

const getDb = async () => {
  if (dbSingleton) return dbSingleton
  dbSingleton = (async () => {
    return createPersistedCollectionDb<WorkspaceRecordMap>({
      storageKey: DB_NAME,
      collectionNames: ['entries'],
      recordKeyByCollection: {
        entries: row => normalizeWorkspacePath(String(row.path || '')),
      },
    })
  })()
  return dbSingleton.catch(err => {
    dbSingleton = null
    throw err
  })
}

export function createWorkspacePersistedFs(): WorkspaceFs {
  lastDocsMirrorSyncSignature = ''
  const ensureRoot = async () => {
    const { collections } = await getDb()
    const existing = await collections.entries.findOne(WORKSPACE_ROOT_PATH).exec()
    if (existing) {
      const updatedAtMs = normalizeUpdatedAtMs(existing.get('updatedAtMs'))
      const parentPath = String(existing.get('parentPath') || '')
      if (Number(existing.get('updatedAtMs')) !== updatedAtMs || parentPath !== '') {
        await existing.incrementalPatch({
          parentPath: '',
          updatedAtMs,
        })
      }
      return
    }
    await collections.entries.incrementalUpsert({
      path: WORKSPACE_ROOT_PATH,
      parentPath: '',
      kind: 'folder',
      name: '',
      updatedAtMs: normalizeUpdatedAtMs(Date.now()),
    })
  }

  const ensureSeed = async (): Promise<boolean> => {
    const { collections } = await getDb()
    await ensureRoot()
    let changed = false
    const docsOnlyMode = readWorkspaceSourceFilesDocsOnlySetting()
    const docsMirrorEntries = docsOnlyMode
      ? await readWorkspaceInitializationDocsMirrorEntries({ preferCompleteDataset: true })
      : []
    const hasDocsMirrorFiles = docsMirrorEntries.length > 0
    const hasAnyFilesNow = await collections.entries.find({ selector: { kind: 'file' } }).exec().then(rows => rows.length > 0)
    if (docsOnlyMode && hasDocsMirrorFiles) {
      const rootSeedPaths = new Set<WorkspacePath>([
        WORKSPACE_README_SEED_PATH,
        TEST_VALIDATION_WORKSPACE_SEED_PATH,
        GEOSPATIAL_WORKSPACE_SEED_PATH,
      ])
      const docsMirrorBasenames = buildDocsMirrorBasenameSet(docsMirrorEntries)
      const rows = await collections.entries.find({ selector: { kind: 'file' } }).exec()
      for (let i = 0; i < rows.length; i += 1) {
        const row = rows[i]
        if (!row) continue
        const path = normalizeWorkspacePath(String(row.get('path') || ''))
        if (!path || path.startsWith('/docs/')) continue
        const shouldRemoveRootSeedAlias = rootSeedPaths.has(path)
        const shouldRemoveStaleRootDocsAlias = isStaleRootMarkdownAliasCoveredByDocsMirror({
          path,
          docsMirrorBasenames,
          rootSeedPaths,
        })
        if (!shouldRemoveRootSeedAlias && !shouldRemoveStaleRootDocsAlias) continue
        await row.remove()
        changed = true
      }
    }
    if (CUSTOM_TEST_VALIDATION_WORKSPACE_SEED_ACTIVE && !hasAnyFilesNow) {
      const now = Date.now()
      const seeds = await getWorkspaceSeedFiles()
      const validationSeed = seeds.find(seed => normalizeWorkspacePath(seed.path) === TEST_VALIDATION_WORKSPACE_SEED_PATH) || null
      const existing = validationSeed ? await collections.entries.findOne(TEST_VALIDATION_WORKSPACE_SEED_PATH).exec() : null
      if (validationSeed && (!existing || existing.get('kind') !== 'file' || !String(existing.get('text') ?? '').trim())) {
        const entries = expandWorkspaceSeedFileEntries(TEST_VALIDATION_WORKSPACE_SEED_PATH, validationSeed.text, now)
        for (const entry of entries) {
          await collections.entries.incrementalUpsert({
            path: entry.path,
            parentPath: entry.parentPath || '',
            kind: entry.kind,
            name: entry.name,
            text: entry.kind === 'file' ? String(entry.text ?? '') : '',
            updatedAtMs: normalizeUpdatedAtMs(entry.updatedAtMs),
          })
          changed = true
        }
      }
    }
    const fileCount = await collections.entries.find({ selector: { kind: 'file' } }).exec().then(rows => rows.length)
    const seeded = lsBool(LS_KEYS.markdownWorkspaceSeeded, false)
    const userClearedAll = lsBool(LS_KEYS.markdownWorkspaceUserClearedAllFiles, false)
    if (fileCount > 0) {
      if (!(docsOnlyMode && hasDocsMirrorFiles)) {
        const seeds = await getWorkspaceSeedFiles()
        let seededTextChanged = false
        for (const seed of seeds) {
          const path = normalizeWorkspacePath(seed.path)
          const row = await collections.entries.findOne(path).exec()
          if (CUSTOM_TEST_VALIDATION_WORKSPACE_SEED_ACTIVE && path === TEST_VALIDATION_WORKSPACE_SEED_PATH && (!row || row.get('kind') !== 'file')) {
            const entries = expandWorkspaceSeedFileEntries(path, seed.text, Date.now())
            for (const entry of entries) {
              await collections.entries.incrementalUpsert({
                path: entry.path,
                parentPath: entry.parentPath || '',
                kind: entry.kind,
                name: entry.name,
                text: entry.kind === 'file' ? String(entry.text ?? '') : '',
                updatedAtMs: normalizeUpdatedAtMs(entry.updatedAtMs),
              })
            }
            seededTextChanged = true
            continue
          }
          if (!row || row.get('kind') !== 'file') continue
          const currentText = String(row.get('text') ?? '')
          if (seed.isFallback && shouldPreserveFallbackWorkspaceSeedText(currentText)) continue
          const nextText = String(seed.text ?? '')
          if (currentText === nextText) continue
          const entry = buildWorkspaceSeedFileEntry(path, nextText, Date.now())
          await row.incrementalPatch({
            parentPath: entry.parentPath || '',
            name: entry.name,
            text: String(entry.text ?? ''),
            updatedAtMs: normalizeUpdatedAtMs(entry.updatedAtMs),
          })
          seededTextChanged = true
        }
        if (seededTextChanged) changed = true
      }
      if (await syncWorkspaceDocsMirrorEntries(collections, docsMirrorEntries)) changed = true
      if (!seeded) lsSetBool(LS_KEYS.markdownWorkspaceSeeded, true)
      if (userClearedAll) lsRemove(LS_KEYS.markdownWorkspaceUserClearedAllFiles)
      return changed
    }
    if (userClearedAll) return changed
    const now = Date.now()
    if (!(docsOnlyMode && hasDocsMirrorFiles)) {
      const seeds = await getWorkspaceSeedFiles()
      for (const seed of seeds) {
        const entries = expandWorkspaceSeedFileEntries(normalizeWorkspacePath(seed.path), seed.text, now)
        for (const entry of entries) {
          await collections.entries.incrementalUpsert({
            path: entry.path,
            parentPath: entry.parentPath || '',
            kind: entry.kind,
            name: entry.name,
            text: entry.kind === 'file' ? String(entry.text ?? '') : '',
            updatedAtMs: normalizeUpdatedAtMs(entry.updatedAtMs),
          })
          changed = true
        }
      }
    }
    if (await syncWorkspaceDocsMirrorEntries(collections, docsMirrorEntries)) changed = true
    lsSetBool(LS_KEYS.markdownWorkspaceSeeded, true)
    if (userClearedAll) lsRemove(LS_KEYS.markdownWorkspaceUserClearedAllFiles)
    return changed
  }

  const listEntries = async () => {
    await ensureRoot()
    const { collections } = await getDb()
    const rows = await collections.entries.find().exec()
    return rows
      .map(r => {
        const row = r.toJSON()
        const updatedAtMs = normalizeUpdatedAtMs((row as { updatedAtMs?: unknown }).updatedAtMs)
        if (Number((row as { updatedAtMs?: unknown }).updatedAtMs) !== updatedAtMs) {
          void r.incrementalPatch({ updatedAtMs })
        }
        return {
          ...row,
          parentPath: row.parentPath ? row.parentPath : null,
          updatedAtMs,
        }
      })
      .sort((a, b) => a.path.localeCompare(b.path))
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
    const nextText = String(text ?? '')
    const previousText = String(row.get('text') ?? '')
    if (previousText === nextText) return
    await row.incrementalPatch({
      text: nextText,
      updatedAtMs: Date.now(),
    })
    const seedBasename = readWorkspaceSeedBasenameForPath(p)
    if (seedBasename) {
      void upsertWorkspaceInitializationSeedText({
        basename: seedBasename,
        text: nextText,
      })
    } else if (isWorkspaceDocsBackedMirrorPath(p)) {
      scheduleWorkspaceDocsMirrorTextUpsert(p, nextText)
    } else if (isWorkspaceChatMirrorPath(p)) {
      void upsertWorkspaceDocsMirrorText({
        workspacePath: p,
        text: nextText,
      })
    }
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
    await collections.entries.incrementalUpsert({
      path,
      parentPath: parent,
      kind: 'folder',
      name,
      updatedAtMs: Date.now(),
    })
    if (isWorkspaceDocsBackedMirrorPath(path)) {
      scheduleWorkspaceDocsMirrorFolderEnsure(path)
    } else if (isWorkspaceChatMirrorPath(path)) {
      void ensureWorkspaceDocsMirrorFolder({ workspacePath: path })
    }
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
    await collections.entries.incrementalUpsert({
      path,
      parentPath: parent,
      kind: 'file',
      name,
      text: String(args.text ?? ''),
      updatedAtMs: Date.now(),
    })
    if (isWorkspaceDocsBackedMirrorPath(parent)) {
      scheduleWorkspaceDocsMirrorFolderEnsure(parent)
    } else if (isWorkspaceChatMirrorPath(parent)) {
      void ensureWorkspaceDocsMirrorFolder({ workspacePath: parent })
    }
    if (isWorkspaceDocsBackedMirrorPath(path)) {
      scheduleWorkspaceDocsMirrorTextUpsert(path, String(args.text ?? ''))
    } else if (isWorkspaceChatMirrorPath(path)) {
      void upsertWorkspaceDocsMirrorText({
        workspacePath: path,
        text: String(args.text ?? ''),
      })
    }
    if (lsBool(LS_KEYS.markdownWorkspaceUserClearedAllFiles, false)) lsRemove(LS_KEYS.markdownWorkspaceUserClearedAllFiles)
    notifyWorkspaceFsChanged({ op: 'createFile', path })
    return path
  }

  const deleteEntry = async (path: WorkspacePath) => {
    await ensureRoot()
    const { collections } = await getDb()
    const p = normalizeWorkspacePath(path)
    if (p === WORKSPACE_ROOT_PATH || isInitializationWorkspacePath(p)) return
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
