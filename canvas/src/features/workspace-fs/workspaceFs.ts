import type { WorkspaceEntry, WorkspaceFs, WorkspacePath } from './types'
import { WORKSPACE_ROOT_PATH, ancestorPathsForWorkspacePath, normalizeWorkspacePath, workspaceBasename } from './path'
import { readEnvString } from '@/lib/config.env'
import { buildRepoFilePath } from '@/lib/url'

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
      message: `Workspace persistence is unavailable. Changes may not survive reload.${msg ? ` ${msg}` : ''}`,
    })
  } catch {
    void 0
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

const mergeEntriesWithShadow = (entries: WorkspaceEntry[]): WorkspaceEntry[] => {
  const merged = new Map<string, WorkspaceEntry>()
  for (const entry of entries) {
    if (!entry || typeof entry !== 'object') continue
    const path = normalizeWorkspacePath(entry.path)
    if (!path) continue
    merged.set(path, {
      ...entry,
      path,
      parentPath: entry.parentPath ? normalizeWorkspacePath(entry.parentPath) : null,
    })
  }
  for (const entry of snapshotShadowEntries()) {
    const path = normalizeWorkspacePath(entry.path)
    if (!path || merged.has(path)) continue
    merged.set(path, entry)
  }
  return [...merged.values()].sort((a, b) => a.path.localeCompare(b.path))
}

const readShadowFileText = (path: WorkspacePath): string | null => {
  const shadow = ensureShadow()
  const normalized = normalizeWorkspacePath(path)
  const entry = shadow.get(normalized)
  if (!entry || entry.kind !== 'file') return null
  return String(entry.text ?? '')
}

export const createResilientWorkspaceFs = (inner: WorkspaceFs): WorkspaceFs => {
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
        return mergeEntriesWithShadow(list)
      }),
    readFileText: (path: WorkspacePath) =>
      run('readFileText', async fs => {
        const text = await fs.readFileText(path)
        const p = normalizeWorkspacePath(path)
        if (typeof text === 'string') {
          upsertShadowEntry({
            path: p,
            parentPath: p === WORKSPACE_ROOT_PATH ? null : normalizeWorkspacePath(p.slice(0, p.lastIndexOf('/')) || WORKSPACE_ROOT_PATH),
            kind: 'file',
            name: workspaceBasename(p),
            text: text.length <= SHADOW_MAX_FILE_TEXT_CHARS ? text : '',
            updatedAtMs: Date.now(),
          })
          return text
        }
        return readShadowFileText(p)
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

  try {
    const { createWorkspaceRxdbFs } = await import('./workspaceFsRxdb.ts')
    const persistentFs = createWorkspaceRxdbFs()
    await persistentFs.ensureSeed()
    fsSingleton = createResilientWorkspaceFs(persistentFs)
    return fsSingleton
  } catch (e: unknown) {
    fsSingleton = createResilientWorkspaceFs(memory)
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

export function resetWorkspaceFsForTests(): void {
  fsSingleton = null
  warnedDegraded = false
}

export const LEGACY_WORKSPACE_README_PATH = '/README.md' as WorkspacePath
export const LEGACY_WORKSPACE_TRIP_DEMO_PATH = '/trip-demo-mmd.md' as WorkspacePath
export const LEGACY_WORKSPACE_SEED_PATHS = new Set<WorkspacePath>([
  LEGACY_WORKSPACE_README_PATH,
  LEGACY_WORKSPACE_TRIP_DEMO_PATH,
])
export const TEST_VALIDATION_WORKSPACE_SEED_REL_PATH = readEnvString(
  'VITE_TEST_VALIDATION_SOURCE_FILE_REL_PATH',
  'sandbox/test-data/knowgrph-rich-media-generation-demo.md',
)
const normalizedValidationSeedPath = normalizeWorkspacePath(TEST_VALIDATION_WORKSPACE_SEED_REL_PATH)
export const TEST_VALIDATION_WORKSPACE_SEED_PATH =
  normalizedValidationSeedPath === WORKSPACE_ROOT_PATH
    ? ('/sandbox/test-data/knowgrph-rich-media-generation-demo.md' as WorkspacePath)
    : normalizedValidationSeedPath
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

const loadValidationWorkspaceSeedText = async (): Promise<string> => {
  const repoFilePath = buildRepoFilePath(TEST_VALIDATION_WORKSPACE_SEED_REL_PATH)
  if (typeof fetch === 'function') {
    try {
      const res = await fetch(repoFilePath)
      if (res.ok) {
        const text = (await res.text()).trim()
        if (text) return text
      }
    } catch {
      void 0
    }
  }
  return [
    '---',
    `title: "${workspaceBasename(TEST_VALIDATION_WORKSPACE_SEED_PATH) || 'knowgrph-rich-media-generation-demo.md'}"`,
    '---',
    '',
    `Validation seed fallback for \`${TEST_VALIDATION_WORKSPACE_SEED_REL_PATH}\`.`,
  ].join('\n')
}

export function expandWorkspaceSeedFileEntries(path: WorkspacePath, text: string, updatedAtMs = Date.now()): WorkspaceEntry[] {
  const normalizedPath = normalizeWorkspacePath(path)
  const folderPaths = ancestorPathsForWorkspacePath(normalizedPath)
  const out: WorkspaceEntry[] = []
  for (let i = 0; i < folderPaths.length; i += 1) {
    const folderPath = normalizeWorkspacePath(folderPaths[i]!)
    const parentPath =
      i === 0 ? WORKSPACE_ROOT_PATH : normalizeWorkspacePath(folderPaths[i - 1] || WORKSPACE_ROOT_PATH)
    out.push({
      path: folderPath,
      parentPath,
      kind: 'folder',
      name: workspaceBasename(folderPath),
      updatedAtMs,
    })
  }
  out.push({
    path: normalizedPath,
    parentPath: folderPaths.length > 0 ? normalizeWorkspacePath(folderPaths[folderPaths.length - 1]!) : WORKSPACE_ROOT_PATH,
    kind: 'file',
    name: workspaceBasename(normalizedPath),
    text: String(text ?? ''),
    updatedAtMs,
  })
  return out
}

export async function getWorkspaceSeedFiles(): Promise<Array<{ path: WorkspacePath; text: string }>> {
  const validationText = await loadValidationWorkspaceSeedText()
  return [
    { path: TEST_VALIDATION_WORKSPACE_SEED_PATH, text: validationText || DEFAULT_WORKSPACE_README_TEXT },
  ]
}

export function shouldMigrateLegacyWorkspaceSeedPaths(paths: ReadonlyArray<WorkspacePath>): boolean {
  const normalized = paths
    .map(path => normalizeWorkspacePath(path))
    .filter((path): path is WorkspacePath => Boolean(path))
  if (normalized.length === 0) return false
  for (let i = 0; i < normalized.length; i += 1) {
    if (!LEGACY_WORKSPACE_SEED_PATHS.has(normalized[i]!)) return false
  }
  return true
}

export function defaultParentPath(): WorkspacePath {
  return WORKSPACE_ROOT_PATH
}
