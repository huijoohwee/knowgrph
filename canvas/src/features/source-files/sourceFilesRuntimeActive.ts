import { useGraphStore } from '@/hooks/useGraphStore'
import { getWorkspaceFs } from '@/features/workspace-fs/workspaceFs'
import type { WorkspaceEntry, WorkspaceFs, WorkspacePath } from '@/features/workspace-fs/types'
import type { SourceFile } from '@/hooks/store/types'
import { normalizeWorkspacePath, workspaceBasename, workspaceExtLower } from '@/features/workspace-fs/path'
import { buildLocalFsFetchPath } from '@/lib/url'
import { readEnvString } from '@/lib/config.env'
import { buildKnowgrphWorkspaceIdFromSourceFilesWorkspaceState } from '@/features/source-files/sourceFilesStorageSync'
import { loadPersistedSourceFilesWorkspace } from '@/features/source-files/sourceFilesDb'
import { readFirstKnowgrphStorageDocText } from '@/features/workspace-fs/workspaceSeedProviderStorageCache'
import { readWorkspaceInitializationDocsMirrorEntries } from '@/features/workspace-fs/workspaceSeedProvider'
import { isWorkspaceSourceMirrorFileName } from '@/features/workspace-fs/workspaceSourceMirrorFormats'
import { resolveWorkspaceSourceRootPaths } from '@/features/workspace-fs/workspaceSourceRoots'
import { readWorkspaceDocsMirrorRootPathSetting } from '@/lib/workspace/workspaceStoreSyncSettings'
import { readStorageCanonicalPathCandidatesForWorkspacePath } from '@/features/source-files/sourceFilesStoragePaths'
import { buildModelAssetWorkspaceFallbackMarkdown } from '@/features/markdown-workspace/workspaceImport/glbAsset'
import {
  readCachedWorkspaceActiveEntrySnapshot,
  rememberWorkspaceActiveEntrySnapshot,
} from '@/features/source-files/workspaceActiveEntryCache'

const normalizeString = (value: unknown): string => String(value || '').trim()

const isWorkspaceModelAssetPath = (path: WorkspacePath): 'glb' | 'gltf' | null => {
  const ext = workspaceExtLower(path)
  return ext === 'glb' || ext === 'gltf' ? ext : null
}

const hasWorkspaceModelAssetCanvasManifest = (text: string): boolean => {
  const sample = String(text || '').slice(0, 4096)
  return !!(
    sample.includes('kgAssetFormat') ||
    sample.includes('kgAssetType') ||
    sample.includes('kgCanvasSurfaceMode') ||
    sample.includes('kgCanvas3dMode')
  )
}

const buildWorkspaceModelAssetFallbackText = (activePath: WorkspacePath, format: 'glb' | 'gltf'): string =>
  buildModelAssetWorkspaceFallbackMarkdown({
    name: workspaceBasename(activePath),
    format,
    sourceKind: 'workspace',
  })

const normalizeDocsMirrorRelPath = (value: string): string => {
  let next = String(value || '')
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')
  const lowered = next.toLowerCase()
  if (lowered.startsWith('docs/huijoohwee/docs/')) {
    next = next.slice('docs/huijoohwee/docs/'.length)
  } else if (lowered.startsWith('huijoohwee/docs/')) {
    next = next.slice('huijoohwee/docs/'.length)
  } else if (lowered.startsWith('docs/')) {
    next = next.slice('docs/'.length)
  }
  return next
}

const buildWorkspaceDocsMirrorRelPathCandidates = (activePathRaw: WorkspacePath): string[] => {
  const activePath = normalizeWorkspacePath(activePathRaw)
  if (!activePath || activePath === '/') return []
  const out = new Set<string>()
  const push = (value: string) => {
    const next = normalizeDocsMirrorRelPath(value)
    if (!next || !isWorkspaceSourceMirrorFileName(next)) return
    out.add(next)
  }
  push(activePath)
  const sourceRoots = resolveWorkspaceSourceRootPaths({
    chatLocalStorageRootPath: useGraphStore.getState().chatLocalStorageRootPath,
  })
  for (let i = 0; i < sourceRoots.length; i += 1) {
    const root = normalizeWorkspacePath(sourceRoots[i] || '')
    if (!root || root === '/') continue
    if (activePath === root) continue
    if (activePath.startsWith(`${root}/`)) push(activePath.slice(root.length + 1))
  }
  return [...out]
}

const readWorkspaceDocsRootFileFallbackText = async (
  candidates: ReadonlyArray<string>,
): Promise<string> => {
  if (typeof fetch !== 'function') return ''
  const docsRoot = String(readWorkspaceDocsMirrorRootPathSetting() || '')
    .trim()
    .replace(/\\/g, '/')
    .replace(/\/+$/, '')
  if (!docsRoot) return ''
  for (let i = 0; i < candidates.length; i += 1) {
    const relPath = normalizeDocsMirrorRelPath(candidates[i] || '')
    if (!relPath || !isWorkspaceSourceMirrorFileName(relPath)) continue
    const localFsUrl = buildLocalFsFetchPath(`${docsRoot}/${relPath}`)
    if (!localFsUrl) continue
    try {
      const response = await fetch(localFsUrl)
      if (!response.ok) continue
      const text = await response.text()
      if (text.trim()) return text
    } catch {
      void 0
    }
  }
  return ''
}

const readWorkspaceDocsMirrorFallbackText = async (
  activePath: WorkspacePath,
  fallbackByActivePath?: Map<string, string>,
): Promise<string> => {
  const normalizedPath = normalizeWorkspacePath(String(activePath || '').trim())
  if (!normalizedPath) return ''
  const cacheKey = `docs-mirror:${normalizedPath}`
  const cached = fallbackByActivePath?.get(cacheKey)
  if (typeof cached === 'string') return cached
  const candidates = buildWorkspaceDocsMirrorRelPathCandidates(normalizedPath)
  if (candidates.length === 0) {
    fallbackByActivePath?.set(cacheKey, '')
    return ''
  }
  try {
    const entries = await readWorkspaceInitializationDocsMirrorEntries({ preferCompleteDataset: true })
    const byRelPath = new Map<string, string>()
    for (let i = 0; i < entries.length; i += 1) {
      const entry = entries[i]
      if (!entry) continue
      const relPath = normalizeDocsMirrorRelPath(String(entry.relPath || ''))
      if (!relPath || byRelPath.has(relPath)) continue
      byRelPath.set(relPath, String(entry.text || ''))
    }
    let blankMirrorMatch: string | null = null
    for (let i = 0; i < candidates.length; i += 1) {
      const text = byRelPath.get(candidates[i] || '')
      if (typeof text === 'string') {
        if (text.trim()) {
          fallbackByActivePath?.set(cacheKey, text)
          return text
        }
        if (blankMirrorMatch === null) blankMirrorMatch = text
      }
    }
    const directRootText = await readWorkspaceDocsRootFileFallbackText(candidates)
    if (directRootText.trim()) {
      fallbackByActivePath?.set(cacheKey, directRootText)
      return directRootText
    }
    if (blankMirrorMatch !== null) {
      fallbackByActivePath?.set(cacheKey, blankMirrorMatch)
      return blankMirrorMatch
    }
  } catch {
    void 0
  }
  fallbackByActivePath?.set(cacheKey, '')
  return ''
}

const readWorkspaceStorageDocFallbackText = async (
  activePath: WorkspacePath,
  fallbackByActivePath?: Map<string, string>,
): Promise<string> => {
  if (typeof fetch !== 'function') return ''
  const normalizedPath = normalizeWorkspacePath(String(activePath || '').trim())
  if (!normalizedPath) return ''
  const cached = fallbackByActivePath?.get(normalizedPath)
  if (typeof cached === 'string') return cached
  const baseUrl = normalizeString(readEnvString('VITE_KNOWGRPH_STORAGE_BASE_URL', ''))
  if (!baseUrl) return ''
  const canonicalCandidates = readStorageCanonicalPathCandidatesForWorkspacePath(normalizedPath)
  if (canonicalCandidates.length === 0) {
    fallbackByActivePath?.set(normalizedPath, '')
    return ''
  }
  try {
    const workspaceIdCandidates = new Set<string>()
    const workspaceIdOverride = normalizeString(readEnvString('VITE_KNOWGRPH_STORAGE_WORKSPACE_ID', ''))
    if (workspaceIdOverride) workspaceIdCandidates.add(workspaceIdOverride)
    const runtimeWorkspaceId = normalizeString(buildKnowgrphWorkspaceIdFromSourceFilesWorkspaceState({
      folderName: useGraphStore.getState().localMarkdownFolderName,
      accessMode: useGraphStore.getState().localMarkdownFolderAccessMode,
      folderCacheId: useGraphStore.getState().localMarkdownFolderCacheId,
      selectedFolderPath: useGraphStore.getState().localMarkdownSelectedFolderPath,
    }))
    if (runtimeWorkspaceId) workspaceIdCandidates.add(runtimeWorkspaceId)
    let persistedWorkspaceId = ''
    try {
      const workspaceState = await loadPersistedSourceFilesWorkspace()
      persistedWorkspaceId = normalizeString(buildKnowgrphWorkspaceIdFromSourceFilesWorkspaceState(workspaceState))
    } catch {
      persistedWorkspaceId = ''
    }
    if (persistedWorkspaceId) workspaceIdCandidates.add(persistedWorkspaceId)
    if (workspaceIdCandidates.size === 0) return ''
    const workspaceIds = [...workspaceIdCandidates]
    for (let w = 0; w < workspaceIds.length; w += 1) {
      const workspaceId = workspaceIds[w]
      if (!workspaceId) continue
      const text = await readFirstKnowgrphStorageDocText({
        baseUrl,
        workspaceId,
        canonicalPathCandidates: canonicalCandidates,
      })
      if (text.trim()) {
        fallbackByActivePath?.set(normalizedPath, text)
        return text
      }
    }
  } catch {
    return ''
  }
  fallbackByActivePath?.set(normalizedPath, '')
  return ''
}

export function readReusableWorkspaceEntriesSnapshot(
  workspaceEntries: WorkspaceEntry[] | null | undefined,
): WorkspaceEntry[] | undefined {
  return Array.isArray(workspaceEntries) && workspaceEntries.length > 0 ? workspaceEntries : undefined
}

export async function readWorkspaceActiveDocumentResolvedText(args: {
  activePath: WorkspacePath
  currentText?: string
  fs?: WorkspaceFs | Awaited<ReturnType<typeof getWorkspaceFs>>
  storageFallbackByPath?: Map<string, string>
}): Promise<string> {
  const activePath = normalizeWorkspacePath(args.activePath)
  const modelAssetFormat = isWorkspaceModelAssetPath(activePath)
  const currentText = String(args.currentText || '')
  if (currentText.trim()) {
    if (!modelAssetFormat || hasWorkspaceModelAssetCanvasManifest(currentText)) return currentText
    return buildWorkspaceModelAssetFallbackText(activePath, modelAssetFormat)
  }
  let fsText = ''
  try {
    const fs = args.fs || (await getWorkspaceFs())
    fsText = String((await fs.readFileText(activePath)) || '')
  } catch {
    fsText = ''
  }
  if (fsText.trim()) {
    if (!modelAssetFormat || hasWorkspaceModelAssetCanvasManifest(fsText)) return fsText
    return buildWorkspaceModelAssetFallbackText(activePath, modelAssetFormat)
  }
  const docsMirrorText = await readWorkspaceDocsMirrorFallbackText(activePath, args.storageFallbackByPath)
  if (docsMirrorText.trim()) {
    if (!modelAssetFormat || hasWorkspaceModelAssetCanvasManifest(docsMirrorText)) return docsMirrorText
    return buildWorkspaceModelAssetFallbackText(activePath, modelAssetFormat)
  }
  const storageText = await readWorkspaceStorageDocFallbackText(activePath, args.storageFallbackByPath)
  if (storageText.trim()) {
    if (!modelAssetFormat || hasWorkspaceModelAssetCanvasManifest(storageText)) return storageText
    return buildWorkspaceModelAssetFallbackText(activePath, modelAssetFormat)
  }
  if (modelAssetFormat) {
    return buildWorkspaceModelAssetFallbackText(activePath, modelAssetFormat)
  }
  return ''
}

export const readWorkspaceActiveEntrySnapshot = async (args: {
  fs: WorkspaceFs
  activePath: WorkspacePath
  workspaceEntries?: WorkspaceEntry[]
}): Promise<WorkspaceEntry[]> => {
  const activePath = normalizeWorkspacePath(args.activePath)
  const provided = Array.isArray(args.workspaceEntries) ? args.workspaceEntries : []
  const existingEntry = provided.find(entry => entry?.kind === 'file' && normalizeWorkspacePath(entry.path) === activePath) || null
  if (existingEntry && typeof existingEntry.text === 'string' && existingEntry.text.trim()) {
    const snapshot = [existingEntry]
    return rememberWorkspaceActiveEntrySnapshot({ activePath, entries: snapshot }) || snapshot
  }
  const cached = readCachedWorkspaceActiveEntrySnapshot({
    activePath,
    minUpdatedAtMs: typeof existingEntry?.updatedAtMs === 'number' ? existingEntry.updatedAtMs : undefined,
  })
  if (cached) return cached
  let text = existingEntry && typeof existingEntry.text === 'string' ? existingEntry.text : ''
  if (!text.trim()) {
    text = await readWorkspaceActiveDocumentResolvedText({
      activePath,
      currentText: text,
      fs: args.fs,
    })
  }
  const pathParts = activePath.replace(/^\/+/, '').split('/').filter(Boolean)
  const name = pathParts[pathParts.length - 1] || ''
  const parentPath = pathParts.length > 1
    ? normalizeWorkspacePath(pathParts.slice(0, -1).join('/'))
    : '/'
  const snapshot: WorkspaceEntry[] = [{
    ...(existingEntry || {}),
    path: activePath,
    parentPath,
    kind: 'file',
    name: String(existingEntry?.name || name),
    text,
    updatedAtMs: typeof existingEntry?.updatedAtMs === 'number' ? existingEntry.updatedAtMs : Date.now(),
  }]
  return rememberWorkspaceActiveEntrySnapshot({ activePath, entries: snapshot }) || snapshot
}

export const readWorkspaceSourceRootEntriesSnapshot = async (args: {
  fs: WorkspaceFs
  activePath: WorkspacePath
  workspaceEntries?: WorkspaceEntry[]
}): Promise<WorkspaceEntry[]> => {
  const activePath = normalizeWorkspacePath(args.activePath)
  const provided = Array.isArray(args.workspaceEntries) ? args.workspaceEntries : []
  const allEntries = provided.length > 1 ? provided : await args.fs.listEntries()
  if (!activePath) return allEntries
  const activeEntries = await readWorkspaceActiveEntrySnapshot({
    fs: args.fs,
    activePath,
    workspaceEntries: allEntries,
  })
  const activeEntry = activeEntries.find(entry => entry?.kind === 'file' && normalizeWorkspacePath(entry.path) === activePath) || null
  if (!activeEntry) return allEntries
  let foundActive = false
  let changed = false
  const next = allEntries.map(entry => {
    if (!entry || entry.kind !== 'file' || normalizeWorkspacePath(entry.path) !== activePath) return entry
    foundActive = true
    if (entry === activeEntry) return entry
    changed = true
    return activeEntry
  })
  if (!foundActive) {
    return [...allEntries, activeEntry].sort((a, b) => String(a.path || '').localeCompare(String(b.path || '')))
  }
  return changed ? next : allEntries
}

export function readProvidedActiveWorkspaceEntriesSnapshot(args: {
  activePath: WorkspacePath
  activeWorkspaceEntriesSnapshot?: WorkspaceEntry[]
}): WorkspaceEntry[] | null {
  const activePath = normalizeWorkspacePath(args.activePath)
  const provided = Array.isArray(args.activeWorkspaceEntriesSnapshot) ? args.activeWorkspaceEntriesSnapshot : []
  if (provided.length === 0) return null
  const activeEntry = provided.find(entry => entry?.kind === 'file' && normalizeWorkspacePath(entry.path) === activePath) || null
  if (!activeEntry || typeof activeEntry.text !== 'string' || !activeEntry.text.trim()) return null
  const snapshot = [activeEntry]
  return rememberWorkspaceActiveEntrySnapshot({ activePath, entries: snapshot }) || snapshot
}

export async function resolveActiveWorkspaceEntriesSnapshot(args: {
  activePath: WorkspacePath
  fs: WorkspaceFs
  workspaceEntries?: WorkspaceEntry[]
  activeWorkspaceEntriesSnapshot?: WorkspaceEntry[]
}): Promise<WorkspaceEntry[]> {
  const providedSnapshot = readProvidedActiveWorkspaceEntriesSnapshot({
    activePath: args.activePath,
    activeWorkspaceEntriesSnapshot: args.activeWorkspaceEntriesSnapshot,
  })
  if (providedSnapshot) return providedSnapshot
  return readWorkspaceActiveEntrySnapshot({
    fs: args.fs,
    activePath: args.activePath,
    workspaceEntries: args.workspaceEntries,
  })
}

export async function readActiveWorkspaceSourceFileFallbackText(args: {
  activePath: WorkspacePath
  activeFile?: SourceFile | null
  activeWorkspaceEntriesSnapshot?: WorkspaceEntry[]
  fs?: Awaited<ReturnType<typeof getWorkspaceFs>>
  ignoreActiveFileText?: boolean
}): Promise<string> {
  const activeText = String(args.activeFile?.text || '')
  if (!args.ignoreActiveFileText && activeText.trim()) return activeText
  const providedSnapshot = readProvidedActiveWorkspaceEntriesSnapshot({
    activePath: args.activePath,
    activeWorkspaceEntriesSnapshot: args.activeWorkspaceEntriesSnapshot,
  })
  const providedText = String(providedSnapshot?.[0]?.text || '')
  return readWorkspaceActiveDocumentResolvedText({
    activePath: args.activePath,
    currentText: providedText,
    fs: args.fs,
  })
}

export async function hydrateWorkspaceEntriesInlineText(args: {
  fs: WorkspaceFs
  workspaceEntries: WorkspaceEntry[]
  forceIncludePaths?: WorkspacePath[]
}): Promise<WorkspaceEntry[]> {
  const entries = Array.isArray(args.workspaceEntries) ? args.workspaceEntries : []
  if (entries.length === 0) return entries
  const forceIncludePathSet = new Set(
    (Array.isArray(args.forceIncludePaths) ? args.forceIncludePaths : [])
      .map(path => normalizeWorkspacePath(String(path || '').trim()))
      .filter(Boolean),
  )
  let changed = false
  const storageFallbackByPath = new Map<string, string>()
  const next = await Promise.all(
    entries.map(async entry => {
      if (!entry || entry.kind !== 'file') return entry
      if (typeof entry.text === 'string' && entry.text.trim().length > 0) return entry
      const entryPath = normalizeWorkspacePath(entry.path)
      if (forceIncludePathSet.size > 0 && !forceIncludePathSet.has(entryPath)) return entry
      const fallbackText = await readWorkspaceActiveDocumentResolvedText({
        activePath: entryPath,
        currentText: typeof entry.text === 'string' ? entry.text : '',
        fs: args.fs,
        storageFallbackByPath,
      })
      if (!fallbackText.trim()) return entry
      changed = true
      return {
        ...entry,
        text: fallbackText,
      }
    }),
  )
  return changed ? next : entries
}
