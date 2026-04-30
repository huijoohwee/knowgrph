import type { WorkspaceEntry, WorkspaceFs, WorkspacePath } from './types'
import { WORKSPACE_ROOT_PATH, joinWorkspacePath, normalizeWorkspacePath } from './path'
import {
  CUSTOM_TEST_VALIDATION_WORKSPACE_SEED_ACTIVE,
  expandWorkspaceSeedFileEntries,
  LEGACY_WORKSPACE_README_PATH,
  LEGACY_WORKSPACE_README_TEXT,
  getWorkspaceSeedFiles,
  isInitializationWorkspacePath,
  TEST_VALIDATION_WORKSPACE_SEED_PATH,
  shouldMigrateLegacyWorkspaceSeedPaths,
} from './workspaceFs'
import { notifyWorkspaceFsChanged } from './workspaceFsEvents'
import { LS_KEYS } from '@/lib/config'
import { lsBool, lsRemove, lsSetBool } from '@/lib/persistence'

export function createMemoryWorkspaceFs(args?: { initialEntries?: WorkspaceEntry[] }): WorkspaceFs {
  const entriesByPath = new Map<string, WorkspaceEntry>()

  const loadInitial = () => {
    const initial = Array.isArray(args?.initialEntries) ? args?.initialEntries : []
    for (const raw of initial) {
      if (!raw || typeof raw !== 'object') continue
      const kind = raw.kind === 'file' || raw.kind === 'folder' ? raw.kind : null
      if (!kind) continue
      const path = normalizeWorkspacePath(raw.path)
      if (!path) continue
      const next: WorkspaceEntry = {
        path,
        parentPath: raw.parentPath ? normalizeWorkspacePath(raw.parentPath) : null,
        kind,
        name: String(raw.name ?? ''),
        updatedAtMs: typeof raw.updatedAtMs === 'number' ? raw.updatedAtMs : Date.now(),
        ...(kind === 'file' ? { text: typeof raw.text === 'string' ? raw.text : '' } : {}),
      }
      entriesByPath.set(path, next)
    }
  }

  loadInitial()

  const ensureRoot = () => {
    if (entriesByPath.has(WORKSPACE_ROOT_PATH)) return
    entriesByPath.set(WORKSPACE_ROOT_PATH, {
      path: WORKSPACE_ROOT_PATH,
      parentPath: null,
      kind: 'folder',
      name: '',
      updatedAtMs: Date.now(),
    })
  }

  const ensureSeed = async () => {
    ensureRoot()

    const legacyPath = normalizeWorkspacePath(LEGACY_WORKSPACE_README_PATH)
    const legacy = entriesByPath.get(legacyPath)
    if (legacy && legacy.kind === 'file' && String(legacy.text ?? '') === LEGACY_WORKSPACE_README_TEXT) {
      entriesByPath.delete(legacyPath)
    }

    const existingFilePaths = [...entriesByPath.values()]
      .filter(e => e.kind === 'file')
      .map(e => normalizeWorkspacePath(e.path))
      .filter((path): path is WorkspacePath => Boolean(path))
    if (shouldMigrateLegacyWorkspaceSeedPaths(existingFilePaths)) {
      for (const path of existingFilePaths) entriesByPath.delete(path)
    }

    const hasAnyFilesNow = [...entriesByPath.values()].some(e => e.kind === 'file')
    if (CUSTOM_TEST_VALIDATION_WORKSPACE_SEED_ACTIVE && !hasAnyFilesNow) {
      const now = Date.now()
      const seeds = await getWorkspaceSeedFiles()
      const validationSeed = seeds.find(seed => normalizeWorkspacePath(seed.path) === TEST_VALIDATION_WORKSPACE_SEED_PATH) || null
      const existing = validationSeed ? entriesByPath.get(TEST_VALIDATION_WORKSPACE_SEED_PATH) : null
      if (validationSeed && (!existing || existing.kind !== 'file' || !String(existing.text ?? '').trim())) {
        const entries = expandWorkspaceSeedFileEntries(TEST_VALIDATION_WORKSPACE_SEED_PATH, validationSeed.text, now)
        for (const entry of entries) {
          entriesByPath.set(entry.path, entry)
        }
      }
    }

    const hasFiles = [...entriesByPath.values()].some(e => e.kind === 'file')
    const seeded = lsBool(LS_KEYS.markdownWorkspaceSeeded, false)
    const userClearedAll = lsBool(LS_KEYS.markdownWorkspaceUserClearedAllFiles, false)
    if (hasFiles) {
      if (!seeded) lsSetBool(LS_KEYS.markdownWorkspaceSeeded, true)
      if (userClearedAll) lsRemove(LS_KEYS.markdownWorkspaceUserClearedAllFiles)
      return
    }
    if (userClearedAll) return
    const seeds = await getWorkspaceSeedFiles()
    for (const seed of seeds) {
      const entries = expandWorkspaceSeedFileEntries(normalizeWorkspacePath(seed.path), seed.text, Date.now())
      for (const entry of entries) {
        entriesByPath.set(entry.path, entry)
      }
    }
    lsSetBool(LS_KEYS.markdownWorkspaceSeeded, true)
    if (userClearedAll) lsRemove(LS_KEYS.markdownWorkspaceUserClearedAllFiles)
  }

  const listEntries = async () => {
    ensureRoot()
    return [...entriesByPath.values()].sort((a, b) => a.path.localeCompare(b.path))
  }

  const readFileText = async (path: WorkspacePath) => {
    const p = normalizeWorkspacePath(path)
    const entry = entriesByPath.get(p)
    if (!entry || entry.kind !== 'file') return null
    return String(entry.text ?? '')
  }

  const writeFileText = async (path: WorkspacePath, text: string) => {
    ensureRoot()
    const p = normalizeWorkspacePath(path)
    const entry = entriesByPath.get(p)
    if (!entry || entry.kind !== 'file') return
    entriesByPath.set(p, { ...entry, text: String(text ?? ''), updatedAtMs: Date.now() })
    notifyWorkspaceFsChanged({ op: 'writeFileText', path: p })
  }

  const createFolder = async (args: { parentPath: WorkspacePath; name: string }) => {
    ensureRoot()
    const parent = normalizeWorkspacePath(args.parentPath)
    const desired = String(args.name ?? '').trim() || 'folder'
    let name = desired
    let path = joinWorkspacePath(parent, name)
    for (let i = 2; i <= 999 && entriesByPath.has(path); i += 1) {
      name = `${desired}-${i}`
      path = joinWorkspacePath(parent, name)
    }
    entriesByPath.set(path, {
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
    ensureRoot()
    const parent = normalizeWorkspacePath(args.parentPath)
    const desired = String(args.name ?? '').trim() || 'file.md'
    let name = desired
    let path = joinWorkspacePath(parent, name)
    for (let i = 2; i <= 999 && entriesByPath.has(path); i += 1) {
      const extIndex = desired.lastIndexOf('.')
      const stem = extIndex > 0 ? desired.slice(0, extIndex) : desired
      const ext = extIndex > 0 ? desired.slice(extIndex) : ''
      name = `${stem}-${i}${ext}`
      path = joinWorkspacePath(parent, name)
    }
    entriesByPath.set(path, {
      path,
      parentPath: parent,
      kind: 'file',
      name,
      text: String(args.text ?? ''),
      updatedAtMs: Date.now(),
    })
    if (lsBool(LS_KEYS.markdownWorkspaceUserClearedAllFiles, false)) {
      lsRemove(LS_KEYS.markdownWorkspaceUserClearedAllFiles)
    }
    notifyWorkspaceFsChanged({ op: 'createFile', path })
    return path
  }

  const deleteEntry = async (path: WorkspacePath) => {
    ensureRoot()
    const p = normalizeWorkspacePath(path)
    if (p === WORKSPACE_ROOT_PATH || isInitializationWorkspacePath(p)) return
    const target = entriesByPath.get(p)
    if (!target) return
    if (target.kind === 'file') {
      entriesByPath.delete(p)
      const remainingHasFiles = [...entriesByPath.values()].some(e => e.kind === 'file')
      if (!remainingHasFiles) lsSetBool(LS_KEYS.markdownWorkspaceUserClearedAllFiles, true)
      notifyWorkspaceFsChanged({ op: 'deleteEntry', path: p })
      return
    }
    const prefix = p.endsWith('/') ? p : `${p}/`
    for (const key of [...entriesByPath.keys()]) {
      if (key === p || key.startsWith(prefix)) entriesByPath.delete(key)
    }
    const remainingHasFiles = [...entriesByPath.values()].some(e => e.kind === 'file')
    if (!remainingHasFiles) lsSetBool(LS_KEYS.markdownWorkspaceUserClearedAllFiles, true)
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
