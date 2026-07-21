import type { WorkspaceEntry, WorkspaceFs, WorkspacePath } from './types'
import { WORKSPACE_ROOT_PATH, joinWorkspacePath, normalizeWorkspacePath } from './path'
import {
  CANONICAL_XR_PHYSICS_WORKSPACE_SEED_ENABLED,
  CUSTOM_TEST_VALIDATION_WORKSPACE_SEED_ACTIVE,
  buildWorkspaceSeedFileEntry,
  expandWorkspaceSeedFileEntries,
  GEOSPATIAL_WORKSPACE_SEED_BASENAME,
  GEOSPATIAL_WORKSPACE_SEED_PATH,
  TEST_VALIDATION_WORKSPACE_SEED_BASENAME,
  getWorkspaceSeedFiles,
  isInitializationWorkspacePath,
  mergeCanonicalXrPhysicsWorkspaceSeedIntoDocsMirror,
  WORKSPACE_README_SEED_BASENAME,
  WORKSPACE_README_SEED_PATH,
  TEST_VALIDATION_WORKSPACE_SEED_PATH,
  shouldPreserveFallbackWorkspaceSeedText,
  XR_PHYSICS_WORKSPACE_ROOT_ALIAS_PATH,
  XR_PHYSICS_WORKSPACE_SEED_PATH,
} from './workspaceFs'
import { isWorkspaceRepoLocalRunReadyBootstrap } from './workspaceRunReadyDemos'
import { ensureWorkspaceDocsMirrorFolder, readWorkspaceInitializationDocsMirrorEntries, upsertWorkspaceDocsMirrorText, upsertWorkspaceInitializationSeedText } from './workspaceSeedProvider'
import { notifyWorkspaceFsChanged } from './workspaceFsEvents'
import {
  buildDocsMirrorBasenameSet,
  clearStaleXrPhysicsSourcesIfCanonicalMaterialized,
  hasOnlyCanonicalXrPhysicsFile,
  isStaleRootMarkdownAliasCoveredByDocsMirror,
  removeNoncanonicalXrPhysicsFiles,
  removeLegacyWorkspaceSourceEntries,
  resetWorkspaceDocsMirrorSyncForPersistedFs,
  syncWorkspaceDocsMirrorEntries,
  toWorkspaceDocsMirrorPath,
} from './workspaceFsPersistedReconciliation'
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
const WORKSPACE_DOCS_MIRROR_FLUSH_DEBOUNCE_MS = 150
const docsMirrorFolderFlushTimers = new Map<WorkspacePath, number>()
const docsMirrorTextFlushTimers = new Map<WorkspacePath, number>()
const docsMirrorPendingTextByPath = new Map<WorkspacePath, string>()

type WorkspaceRecordMap = { entries: WorkspaceEntry }
type WorkspaceCollections = PersistedCollectionMap<WorkspaceRecordMap>
type WorkspaceFsDb = PersistedCollectionDb<WorkspaceRecordMap>
let dbSingleton: Promise<WorkspaceFsDb> | null = null

const WORKSPACE_SEED_BASENAME_BY_PATH = new Map<WorkspacePath, string>([
  [WORKSPACE_README_SEED_PATH, WORKSPACE_README_SEED_BASENAME],
  [TEST_VALIDATION_WORKSPACE_SEED_PATH, TEST_VALIDATION_WORKSPACE_SEED_BASENAME],
  [GEOSPATIAL_WORKSPACE_SEED_PATH, GEOSPATIAL_WORKSPACE_SEED_BASENAME],
])
const WORKSPACE_DOCS_MIRROR_ROOT_PATH = normalizeWorkspacePath('/docs')
const WORKSPACE_AGENTIC_OS_DOCS_MIRROR_ROOT_PATH = normalizeWorkspacePath('/agentic-canvas-os/docs')
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
const readWorkspaceSeedBasenameForPath = (path: WorkspacePath): string | null => WORKSPACE_SEED_BASENAME_BY_PATH.get(path) || null

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
  resetWorkspaceDocsMirrorSyncForPersistedFs()
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
    if (await removeLegacyWorkspaceSourceEntries(collections)) changed = true
    const docsOnlyMode = readWorkspaceSourceFilesDocsOnlySetting()
    const sourceDocsMirrorEntries = docsOnlyMode && !isWorkspaceRepoLocalRunReadyBootstrap()
      ? await readWorkspaceInitializationDocsMirrorEntries({ preferCompleteDataset: true })
      : []
    const docsMirrorEntries = docsOnlyMode
      ? sourceDocsMirrorEntries.every(entry => entry.authority === 'agentic-canvas-os-github')
        ? sourceDocsMirrorEntries
        : await mergeCanonicalXrPhysicsWorkspaceSeedIntoDocsMirror(sourceDocsMirrorEntries)
      : []
    const hasDocsMirrorFiles = sourceDocsMirrorEntries.length > 0
    const hasAnyFilesNow = await collections.entries.find({ selector: { kind: 'file' } }).exec().then(rows => rows.length > 0)
    const canonicalXrDocsMirrorEnabled = CANONICAL_XR_PHYSICS_WORKSPACE_SEED_ENABLED && docsMirrorEntries.some(entry => (
      toWorkspaceDocsMirrorPath(entry.relPath) === XR_PHYSICS_WORKSPACE_SEED_PATH
    ))
    if (docsOnlyMode && canonicalXrDocsMirrorEnabled && await removeNoncanonicalXrPhysicsFiles(collections)) {
      changed = true
    }
    if (docsOnlyMode && hasDocsMirrorFiles) {
      const rootSeedPaths = new Set<WorkspacePath>([
        WORKSPACE_README_SEED_PATH,
        TEST_VALIDATION_WORKSPACE_SEED_PATH,
        GEOSPATIAL_WORKSPACE_SEED_PATH,
        XR_PHYSICS_WORKSPACE_ROOT_ALIAS_PATH,
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
    const clearedWorkspaceNeedsProtectedXrOnly = userClearedAll && (
      fileCount === 0 || await hasOnlyCanonicalXrPhysicsFile(collections)
    )
    if (clearedWorkspaceNeedsProtectedXrOnly) {
      const canonicalXrSeed = (await getWorkspaceSeedFiles()).find(seed => (
        normalizeWorkspacePath(seed.path) === XR_PHYSICS_WORKSPACE_SEED_PATH
      )) || null
      if (canonicalXrSeed) {
        const existing = await collections.entries.findOne(XR_PHYSICS_WORKSPACE_SEED_PATH).exec()
        if (existing?.get('kind') === 'file') {
          const nextText = String(canonicalXrSeed.text ?? '')
          if (String(existing.get('text') ?? '') !== nextText) {
            const entry = buildWorkspaceSeedFileEntry(XR_PHYSICS_WORKSPACE_SEED_PATH, nextText, Date.now())
            await existing.incrementalPatch({
              parentPath: entry.parentPath || '',
              name: entry.name,
              text: nextText,
              updatedAtMs: normalizeUpdatedAtMs(entry.updatedAtMs),
            })
            changed = true
          }
        } else {
          const entries = expandWorkspaceSeedFileEntries(
            XR_PHYSICS_WORKSPACE_SEED_PATH,
            canonicalXrSeed.text,
            Date.now(),
          )
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
        if (await clearStaleXrPhysicsSourcesIfCanonicalMaterialized(collections)) changed = true
      }
      return changed
    }
    if (fileCount > 0) {
      if (!(docsOnlyMode && hasDocsMirrorFiles)) {
        const seeds = await getWorkspaceSeedFiles()
        let seededTextChanged = false
        const canonicalXrSeed = seeds.find(seed => (
          normalizeWorkspacePath(seed.path) === XR_PHYSICS_WORKSPACE_SEED_PATH
        )) || null
        if (canonicalXrSeed && await removeNoncanonicalXrPhysicsFiles(collections)) {
          seededTextChanged = true
        }
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
          if (!row || row.get('kind') !== 'file') {
            if (path !== XR_PHYSICS_WORKSPACE_SEED_PATH) continue
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
        if (canonicalXrSeed && await clearStaleXrPhysicsSourcesIfCanonicalMaterialized(collections)) {
          seededTextChanged = true
        }
        if (seededTextChanged) changed = true
      }
      if (hasDocsMirrorFiles && await syncWorkspaceDocsMirrorEntries(collections, docsMirrorEntries)) changed = true
      if (canonicalXrDocsMirrorEnabled && await clearStaleXrPhysicsSourcesIfCanonicalMaterialized(collections)) changed = true
      if (!seeded) lsSetBool(LS_KEYS.markdownWorkspaceSeeded, true)
      if (userClearedAll && !await hasOnlyCanonicalXrPhysicsFile(collections)) {
        lsRemove(LS_KEYS.markdownWorkspaceUserClearedAllFiles)
      }
      return changed
    }
    const now = Date.now()
    if (!(docsOnlyMode && hasDocsMirrorFiles)) {
      const seeds = await getWorkspaceSeedFiles()
      const canonicalXrSeed = seeds.find(seed => (
        normalizeWorkspacePath(seed.path) === XR_PHYSICS_WORKSPACE_SEED_PATH
      )) || null
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
      if (canonicalXrSeed && await clearStaleXrPhysicsSourcesIfCanonicalMaterialized(collections)) changed = true
    }
    if (hasDocsMirrorFiles && await syncWorkspaceDocsMirrorEntries(collections, docsMirrorEntries)) changed = true
    if (canonicalXrDocsMirrorEnabled && await clearStaleXrPhysicsSourcesIfCanonicalMaterialized(collections)) changed = true
    lsSetBool(LS_KEYS.markdownWorkspaceSeeded, true)
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
