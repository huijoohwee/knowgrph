import type { WorkspaceEntry, WorkspaceFs, WorkspacePath } from './types'
import { WORKSPACE_ROOT_PATH, normalizeWorkspacePath, workspaceBasename } from './path'

const notifyWorkspaceFsDegraded = async (err: unknown) => {
  try {
    if (typeof window === 'undefined') return
    const mod = (await import('@/hooks/useGraphStore')) as typeof import('@/hooks/useGraphStore')
    const msg =
      err && typeof err === 'object' && 'message' in err
        ? String((err as { message?: unknown }).message || '').trim()
        : ''
    mod.useGraphStore.getState().pushUiToast({
      id: 'workspace-fs-persistence-disabled',
      kind: 'warning',
      message: `Workspace persistence is unavailable (IndexedDB blocked). Changes may not survive reload.${msg ? ` ${msg}` : ''}`,
    })
  } catch {
    void 0
  }
}

const canUseIndexedDb = () => {
  try {
    return (
      typeof window !== 'undefined' &&
      typeof indexedDB !== 'undefined' &&
      typeof (globalThis as unknown as { IDBKeyRange?: unknown }).IDBKeyRange !== 'undefined'
    )
  } catch {
    return false
  }
}

let fsSingleton: WorkspaceFs | null = null
let warnedDegraded = false

const SHADOW_MAX_FILE_TEXT_CHARS = 2_000_000
let shadowByPath: Map<string, WorkspaceEntry> | null = null

const ensureShadow = () => {
  if (shadowByPath) return shadowByPath
  shadowByPath = new Map<string, WorkspaceEntry>()
  shadowByPath.set(WORKSPACE_ROOT_PATH, {
    path: WORKSPACE_ROOT_PATH,
    parentPath: null,
    kind: 'folder',
    name: '',
    updatedAtMs: Date.now(),
  })
  return shadowByPath
}

const upsertShadowEntry = (entry: WorkspaceEntry) => {
  const shadow = ensureShadow()
  const normalized = normalizeWorkspacePath(entry.path)
  if (!normalized) return
  const kind = entry.kind === 'file' || entry.kind === 'folder' ? entry.kind : null
  if (!kind) return
  const next: WorkspaceEntry = {
    path: normalized,
    parentPath: entry.parentPath ? normalizeWorkspacePath(entry.parentPath) : null,
    kind,
    name: String(entry.name ?? ''),
    updatedAtMs: typeof entry.updatedAtMs === 'number' ? entry.updatedAtMs : Date.now(),
    ...(kind === 'file'
      ? { text: typeof entry.text === 'string' && entry.text.length <= SHADOW_MAX_FILE_TEXT_CHARS ? entry.text : '' }
      : {}),
  }
  shadow.set(normalized, next)
}

const deleteShadowEntry = (path: WorkspacePath) => {
  const shadow = ensureShadow()
  const p = normalizeWorkspacePath(path)
  if (!p || p === WORKSPACE_ROOT_PATH) return
  shadow.delete(p)
  const prefix = p.endsWith('/') ? p : `${p}/`
  for (const key of [...shadow.keys()]) {
    if (key.startsWith(prefix)) shadow.delete(key)
  }
}

const snapshotShadowEntries = (): WorkspaceEntry[] => {
  const shadow = ensureShadow()
  return [...shadow.values()]
}

const withResilientFallback = (inner: WorkspaceFs): WorkspaceFs => {
  const run = async <T>(op: keyof WorkspaceFs, fn: (fs: WorkspaceFs) => Promise<T>): Promise<T> => {
    try {
      return await fn(inner)
    } catch (e: unknown) {
      const { createMemoryWorkspaceFs } = (await import('./workspaceFsMemory.ts')) as typeof import('./workspaceFsMemory.ts')
      const memory = createMemoryWorkspaceFs({ initialEntries: snapshotShadowEntries() })
      fsSingleton = memory
      try {
        await memory.ensureSeed()
      } catch {
        void 0
      }
      if (!warnedDegraded) {
        warnedDegraded = true
        await notifyWorkspaceFsDegraded(e)
      }
      return await fn(memory)
    }
  }

  return {
    ensureSeed: () => run('ensureSeed', fs => fs.ensureSeed()),
    listEntries: () =>
      run('listEntries', async fs => {
        const list = await fs.listEntries()
        for (const entry of list) upsertShadowEntry(entry)
        return list
      }),
    readFileText: (path: WorkspacePath) =>
      run('readFileText', async fs => {
        const text = await fs.readFileText(path)
        if (typeof text === 'string') {
          const p = normalizeWorkspacePath(path)
          upsertShadowEntry({
            path: p,
            parentPath: p === WORKSPACE_ROOT_PATH ? null : normalizeWorkspacePath(p.slice(0, p.lastIndexOf('/')) || WORKSPACE_ROOT_PATH),
            kind: 'file',
            name: workspaceBasename(p),
            text: text.length <= SHADOW_MAX_FILE_TEXT_CHARS ? text : '',
            updatedAtMs: Date.now(),
          })
        }
        return text
      }),
    writeFileText: (path: WorkspacePath, text: string) =>
      run('writeFileText', async fs => {
        await fs.writeFileText(path, text)
        const p = normalizeWorkspacePath(path)
        upsertShadowEntry({
          path: p,
          parentPath: p === WORKSPACE_ROOT_PATH ? null : normalizeWorkspacePath(p.slice(0, p.lastIndexOf('/')) || WORKSPACE_ROOT_PATH),
          kind: 'file',
          name: workspaceBasename(p),
          text: String(text ?? '').slice(0, SHADOW_MAX_FILE_TEXT_CHARS),
          updatedAtMs: Date.now(),
        })
      }),
    createFile: args =>
      run('createFile', async fs => {
        const path = await fs.createFile(args)
        const p = normalizeWorkspacePath(path)
        upsertShadowEntry({
          path: p,
          parentPath: normalizeWorkspacePath(args.parentPath),
          kind: 'file',
          name: workspaceBasename(p) || String(args.name ?? ''),
          text: String(args.text ?? '').slice(0, SHADOW_MAX_FILE_TEXT_CHARS),
          updatedAtMs: Date.now(),
        })
        return path
      }),
    createFolder: args =>
      run('createFolder', async fs => {
        const path = await fs.createFolder(args)
        const p = normalizeWorkspacePath(path)
        upsertShadowEntry({
          path: p,
          parentPath: normalizeWorkspacePath(args.parentPath),
          kind: 'folder',
          name: workspaceBasename(p) || String(args.name ?? ''),
          updatedAtMs: Date.now(),
        })
        return path
      }),
    deleteEntry: (path: WorkspacePath) =>
      run('deleteEntry', async fs => {
        await fs.deleteEntry(path)
        deleteShadowEntry(path)
      }),
  }
}

export async function getWorkspaceFs(): Promise<WorkspaceFs> {
  if (fsSingleton) return fsSingleton

  const { createMemoryWorkspaceFs } = await import('./workspaceFsMemory.ts')
  const memory = createMemoryWorkspaceFs({ initialEntries: snapshotShadowEntries() })

  if (!canUseIndexedDb()) {
    fsSingleton = memory
    return fsSingleton
  }

  try {
    const { createDexieWorkspaceFs } = await import('./workspaceFsDexie.ts')
    const dexie = createDexieWorkspaceFs()
    await dexie.ensureSeed()
    fsSingleton = withResilientFallback(dexie)
    return fsSingleton
  } catch (e: unknown) {
    fsSingleton = withResilientFallback(memory)
    try {
      await fsSingleton.ensureSeed()
    } catch {
      void 0
    }
    if (!warnedDegraded) {
      warnedDegraded = true
      await notifyWorkspaceFsDegraded(e)
    }
    return fsSingleton
  }
}

export async function ensureSeedWorkspaceFs(): Promise<void> {
  const fs = await getWorkspaceFs()
  await fs.ensureSeed()
}

export const LEGACY_WORKSPACE_README_PATH = '/README.md' as WorkspacePath
export const LEGACY_WORKSPACE_README_TEXT = [
  '# Workspace',
  '',
  '- Select a file in SOURCE FILES to load it into the editor.',
  '- Headings show up in TOC.',
  '- Use [[README]] as a wikilink example.',
  '',
  '## Notes',
  '',
  'This workspace is stored locally in your browser.',
].join('\n')

const DEFAULT_WORKSPACE_README_TEXT = [
  '# Workspace',
  '',
  '- Select a file in SOURCE FILES to load it into the editor.',
  '- Headings show up in TOC.',
  '- Use [[README]] as a wikilink example.',
  '',
  '## Demo',
  '',
  'Open `trip-demo-mmd.md` to verify the Markdown Editor/Viewer renders content.',
].join('\n')

const loadTripDemoMmdSeedText = async (): Promise<string> => {
  try {
    const mod = (await import('./seed/trip-demo-mmd.md?raw')) as unknown
    const text = (mod as { default?: unknown })?.default
    const out = typeof text === 'string' ? text.trim() : ''
    return out
  } catch {
    return ''
  }
}

export async function getWorkspaceSeedFiles(): Promise<Array<{ path: WorkspacePath; text: string }>> {
  const tripText = await loadTripDemoMmdSeedText()
  return [
    { path: '/README.md', text: DEFAULT_WORKSPACE_README_TEXT },
    { path: '/trip-demo-mmd.md', text: tripText || DEFAULT_WORKSPACE_README_TEXT },
  ]
}

export function defaultParentPath(): WorkspacePath {
  return WORKSPACE_ROOT_PATH
}
