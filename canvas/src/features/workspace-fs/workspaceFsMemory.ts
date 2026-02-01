import type { WorkspaceEntry, WorkspaceFs, WorkspacePath } from './types'
import { WORKSPACE_ROOT_PATH, joinWorkspacePath, normalizeWorkspacePath } from './path'
import { WORKSPACE_SEED_FILES } from './workspaceFs'

export function createMemoryWorkspaceFs(): WorkspaceFs {
  const entriesByPath = new Map<string, WorkspaceEntry>()

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
    if ([...entriesByPath.values()].some(e => e.kind === 'file')) return
    for (const seed of WORKSPACE_SEED_FILES) {
      const path = normalizeWorkspacePath(seed.path)
      entriesByPath.set(path, {
        path,
        parentPath: WORKSPACE_ROOT_PATH,
        kind: 'file',
        name: path.split('/').pop() || '',
        text: seed.text,
        updatedAtMs: Date.now(),
      })
    }
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
    return path
  }

  const deleteEntry = async (path: WorkspacePath) => {
    ensureRoot()
    const p = normalizeWorkspacePath(path)
    if (p === WORKSPACE_ROOT_PATH) return
    const target = entriesByPath.get(p)
    if (!target) return
    if (target.kind === 'file') {
      entriesByPath.delete(p)
      return
    }
    const prefix = p.endsWith('/') ? p : `${p}/`
    for (const key of [...entriesByPath.keys()]) {
      if (key === p || key.startsWith(prefix)) entriesByPath.delete(key)
    }
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

