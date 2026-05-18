import { useGraphStore } from '@/hooks/useGraphStore'
import { useMarkdownExplorerStore } from '@/features/markdown-explorer/store'
import { getWorkspaceFs } from '@/features/workspace-fs/workspaceFs'
import type { WorkspaceEntry, WorkspacePath } from '@/features/workspace-fs/types'
import {
  resolveWorkspaceSourceIndexSnapshot,
  type WorkspaceSourceIndex,
} from '@/features/workspace-fs/sourceIndex'
import { mergeWorkspaceEntriesIntoSourceFiles, resolveWorkspaceSourcePathKey } from '@/features/workspace-fs/syncToSourceFiles'
import { applyWorkspaceImportToCanvas } from '@/features/workspace-fs/applyWorkspaceImportToCanvas'
import { scheduleApplyComposedGraphFromSourceFiles } from '@/features/source-files/applyComposedGraphFromSourceFiles'
import { normalizeWorkspacePath } from '@/features/workspace-fs/path'
import type { WorkspaceFs } from '@/features/workspace-fs/types'
import {
  CUSTOM_TEST_VALIDATION_WORKSPACE_SEED_ACTIVE,
  DEFAULT_TEST_VALIDATION_WORKSPACE_SEED_REL_PATH,
  TEST_VALIDATION_WORKSPACE_SEED_PATH,
  TEST_VALIDATION_WORKSPACE_SEED_REL_PATH,
  isInitializationWorkspacePath,
  WORKSPACE_README_SEED_PATH,
} from '@/features/workspace-fs/workspaceFs'
import { readWorkspaceSourceFilesDocsOnlySetting } from '@/lib/workspace/workspaceStoreSyncSettings'
import { readEnvString } from '@/lib/config.env'
import { KNOWGRPH_STORAGE_ROUTE_PATHS } from '@/lib/storage/knowgrphStorageSyncContract'
import { buildKnowgrphWorkspaceIdFromSourceFilesWorkspaceState } from '@/features/source-files/sourceFilesStorageSync'

const normalizeString = (value: unknown): string => String(value || '').trim()
const STORAGE_DOC_FALLBACK_TIMEOUT_MS = 8000
const STORAGE_DOC_FALLBACK_CACHE_TTL_MS = 5 * 60 * 1000
const STORAGE_DOC_FALLBACK_NEGATIVE_CACHE_TTL_MS = 30 * 1000
const STORAGE_DOC_FALLBACK_CACHE_MAX_ENTRIES = 64
const STORAGE_DOC_FALLBACK_CACHE_MAX_CHARS = 1024 * 1024

type StorageDocTextCacheEntry = {
  text: string
  expiresAtMs: number
}

const storageDocTextCache = new Map<string, StorageDocTextCacheEntry>()
const storageDocTextInFlight = new Map<string, Promise<string>>()

const buildKnowgrphStorageRequestUrl = (args: { path: string; baseUrl: string }): string => {
  const safePath = normalizeString(args.path)
  if (!safePath) return ''
  if (typeof window !== 'undefined') {
    const host = normalizeString(window.location?.hostname).toLowerCase()
    const isLocalhost = host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0'
    if (isLocalhost && safePath.startsWith('/api/storage/')) return safePath
  }
  const baseUrl = normalizeString(args.baseUrl)
  if (!baseUrl) return safePath
  return new URL(safePath, baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`).toString()
}

const readStorageCanonicalPathCandidatesForActivePath = (activePath: WorkspacePath): string[] => {
  const normalized = normalizeWorkspacePath(String(activePath || '').trim())
  if (!normalized) return []
  const sourcePath = resolveWorkspaceSourcePathKey(normalized)
  const docsPrefix = 'workspace:/docs/'
  const rel = sourcePath.startsWith(docsPrefix)
    ? sourcePath.slice(docsPrefix.length).replace(/^\/+/, '')
    : (normalized.startsWith('/docs/') ? normalized.slice('/docs/'.length).replace(/^\/+/, '') : '')
  if (!rel) return []
  const out = new Set<string>()
  if (sourcePath.startsWith('workspace:/')) out.add(sourcePath)
  if (normalized.startsWith('/')) out.add(`workspace:${normalized}`)
  out.add(`huijoohwee/docs/${rel}`)
  out.add(`docs/${rel}`)
  return [...out]
}

const readStorageDocTextViaFetch = async (requestUrl: string): Promise<string> => {
  if (typeof fetch !== 'function') return ''
  const url = normalizeString(requestUrl)
  if (!url) return ''
  const now = Date.now()
  const cached = storageDocTextCache.get(url)
  if (cached && cached.expiresAtMs > now) {
    storageDocTextCache.delete(url)
    storageDocTextCache.set(url, cached)
    return cached.text
  }
  if (cached) storageDocTextCache.delete(url)
  const inFlight = storageDocTextInFlight.get(url)
  if (inFlight) return inFlight
  const promise = (async (): Promise<string> => {
    const text = await readStorageDocTextViaFetchUncached(url)
    if (!text || text.length <= STORAGE_DOC_FALLBACK_CACHE_MAX_CHARS) {
      storageDocTextCache.set(url, {
        text,
        expiresAtMs: Date.now() + (text ? STORAGE_DOC_FALLBACK_CACHE_TTL_MS : STORAGE_DOC_FALLBACK_NEGATIVE_CACHE_TTL_MS),
      })
      while (storageDocTextCache.size > STORAGE_DOC_FALLBACK_CACHE_MAX_ENTRIES) {
        const oldest = storageDocTextCache.keys().next().value
        if (!oldest) break
        storageDocTextCache.delete(oldest)
      }
    }
    return text
  })()
  storageDocTextInFlight.set(url, promise)
  try {
    return await promise
  } finally {
    storageDocTextInFlight.delete(url)
  }
}

const readStorageDocTextViaFetchUncached = async (url: string): Promise<string> => {
  const controller = typeof AbortController === 'function' ? new AbortController() : null
  const timeout = controller && typeof setTimeout === 'function'
    ? setTimeout(() => {
        try {
          controller.abort()
        } catch {
          void 0
        }
      }, STORAGE_DOC_FALLBACK_TIMEOUT_MS)
    : null
  try {
    const response = await fetch(url, controller ? { signal: controller.signal } : undefined)
    if (!response.ok) return ''
    const text = String(await response.text())
    return text.trim() ? text : ''
  } catch {
    return ''
  } finally {
    if (timeout != null) clearTimeout(timeout)
  }
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
  const canonicalCandidates = readStorageCanonicalPathCandidatesForActivePath(normalizedPath)
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
    const persistedWorkspaceId = await (async () => {
      try {
        const { loadPersistedSourceFilesWorkspace } = await import('@/features/source-files/sourceFilesDb')
        const workspaceState = await loadPersistedSourceFilesWorkspace()
        return normalizeString(buildKnowgrphWorkspaceIdFromSourceFilesWorkspaceState(workspaceState))
      } catch {
        return ''
      }
    })()
    if (persistedWorkspaceId) workspaceIdCandidates.add(persistedWorkspaceId)
    if (workspaceIdCandidates.size === 0) return ''
    const workspaceIds = [...workspaceIdCandidates]
    for (let w = 0; w < workspaceIds.length; w += 1) {
      const workspaceId = workspaceIds[w]
      if (!workspaceId) continue
      for (let i = 0; i < canonicalCandidates.length; i += 1) {
        const canonicalPath = canonicalCandidates[i]
        if (!canonicalPath) continue
        const docPath = `${KNOWGRPH_STORAGE_ROUTE_PATHS.docPrefix}${encodeURIComponent(workspaceId)}/${encodeURIComponent(canonicalPath)}`
        const requestUrl = buildKnowgrphStorageRequestUrl({ path: docPath, baseUrl })
        if (!requestUrl) continue
        const text = await readStorageDocTextViaFetch(requestUrl)
        if (text.trim()) {
          fallbackByActivePath?.set(normalizedPath, text)
          return text
        }
      }
    }
  } catch {
    return ''
  }
  fallbackByActivePath?.set(normalizedPath, '')
  return ''
}

function normalizeWorkspaceSourceFilesToSingleActive(args: {
  sourceFiles: ReturnType<typeof useGraphStore.getState>['sourceFiles']
  activeSourcePath: string
}): ReturnType<typeof useGraphStore.getState>['sourceFiles'] {
  const list = Array.isArray(args.sourceFiles) ? args.sourceFiles : []
  if (list.length === 0) return list
  let changed = false
  const next = list.map(file => {
    if (!file) return file
    const sourcePath = String(file.source?.path || '')
    if (!sourcePath.startsWith('workspace:')) return file
    const shouldEnable = sourcePath === args.activeSourcePath
    if (file.enabled === shouldEnable) return file
    changed = true
    return { ...file, enabled: shouldEnable }
  })
  return changed ? next : list
}

function pruneWorkspaceSourceFilesToActive(args: {
  sourceFiles: ReturnType<typeof useGraphStore.getState>['sourceFiles']
  activeSourcePath: string
}): ReturnType<typeof useGraphStore.getState>['sourceFiles'] {
  const list = Array.isArray(args.sourceFiles) ? args.sourceFiles : []
  if (list.length === 0) return list
  const next = list.filter(file => {
    if (!file) return false
    const sourcePath = String(file.source?.path || '')
    if (!sourcePath.startsWith('workspace:')) return true
    return sourcePath === args.activeSourcePath
  })
  if (next.length === 0) return next
  const activeIndex = next.findIndex(file => String(file?.source?.path || '') === args.activeSourcePath)
  if (activeIndex < 0) return next
  const activeFile = next[activeIndex]
  if (!activeFile || activeFile.enabled === true) return next
  const normalized = next.slice()
  normalized[activeIndex] = { ...activeFile, enabled: true }
  return normalized
}

export function resolveMaterializedWorkspaceActivePath(args?: {
  activePathOverride?: WorkspacePath | null
  explorerActivePath?: WorkspacePath | null
}): WorkspacePath | null {
  const raw = args?.activePathOverride ?? args?.explorerActivePath ?? null
  const trimmed = String(raw || '').trim()
  if (!trimmed) return null
  const withoutWorkspacePrefix = trimmed.startsWith('workspace:') ? trimmed.slice('workspace:'.length) : trimmed
  const normalized = normalizeWorkspacePath(withoutWorkspacePrefix)
  return normalized === '/' ? null : normalized
}

export function buildMaterializedWorkspaceActivePathKey(args?: {
  activePathOverride?: WorkspacePath | null
  explorerActivePath?: WorkspacePath | null
}): string {
  return String(resolveMaterializedWorkspaceActivePath(args) || '')
}

export function buildMaterializedWorkspaceForceIncludePaths(args?: {
  activePathOverride?: WorkspacePath | null
  explorerActivePath?: WorkspacePath | null
}): WorkspacePath[] {
  const activePath = resolveMaterializedWorkspaceActivePath(args)
  return activePath ? [activePath] : []
}

export function readReusableWorkspaceEntriesSnapshot(
  workspaceEntries: WorkspaceEntry[] | null | undefined,
): WorkspaceEntry[] | undefined {
  return Array.isArray(workspaceEntries) && workspaceEntries.length > 0 ? workspaceEntries : undefined
}

export const readWorkspaceActiveEntrySnapshot = async (args: {
  fs: WorkspaceFs
  activePath: WorkspacePath
  workspaceEntries?: WorkspaceEntry[]
}): Promise<WorkspaceEntry[]> => {
  const activePath = normalizeWorkspacePath(args.activePath)
  const provided = Array.isArray(args.workspaceEntries) ? args.workspaceEntries : []
  const existingEntry = provided.find(entry => entry?.kind === 'file' && normalizeWorkspacePath(entry.path) === activePath) || null
  if (existingEntry && typeof existingEntry.text === 'string' && existingEntry.text.trim()) return [existingEntry]
  let text = existingEntry && typeof existingEntry.text === 'string' ? existingEntry.text : ''
  if (!text.trim()) {
    try {
      const fsText = await args.fs.readFileText(activePath)
      text = typeof fsText === 'string' && fsText.trim()
        ? fsText
        : await readWorkspaceStorageDocFallbackText(activePath)
    } catch {
      text = await readWorkspaceStorageDocFallbackText(activePath)
    }
  }
  const pathParts = activePath.replace(/^\/+/, '').split('/').filter(Boolean)
  const name = pathParts[pathParts.length - 1] || ''
  const parentPath = pathParts.length > 1
    ? normalizeWorkspacePath(pathParts.slice(0, -1).join('/'))
    : '/'
  return [{
    ...(existingEntry || {}),
    path: activePath,
    parentPath,
    kind: 'file',
    name: String(existingEntry?.name || name),
    text,
    updatedAtMs: typeof existingEntry?.updatedAtMs === 'number' ? existingEntry.updatedAtMs : Date.now(),
  }]
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
      if (forceIncludePathSet.size > 0 && !forceIncludePathSet.has(normalizeWorkspacePath(entry.path))) return entry
      const text = await args.fs.readFileText(entry.path)
      const fallbackText = typeof text === 'string' && text.trim()
        ? text
        : await readWorkspaceStorageDocFallbackText(entry.path, storageFallbackByPath)
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

export function buildInitialWorkspaceStartupSnapshot(args: {
  currentActivePath: WorkspacePath | null
  desiredActivePath: WorkspacePath | null
  workspaceEntries: WorkspaceEntry[]
  lastSetActivePath?: unknown
  preferCustomValidationSeed?: boolean
}): {
  activePath: WorkspacePath | null
  workspaceEntries: WorkspaceEntry[]
} {
  if (args.lastSetActivePath && !args.preferCustomValidationSeed) {
    if (!args.desiredActivePath || args.desiredActivePath === args.currentActivePath) {
      return {
        activePath: args.currentActivePath,
        workspaceEntries: [],
      }
    }
  }
  return {
    activePath: args.desiredActivePath,
    workspaceEntries: args.workspaceEntries,
  }
}

export async function materializeActiveWorkspaceEntryIntoSourceFiles(args?: {
  activePathOverride?: WorkspacePath | null
  fs?: Awaited<ReturnType<typeof getWorkspaceFs>>
  workspaceEntries?: WorkspaceEntry[]
  sourcesByPath?: WorkspaceSourceIndex
  applyToGraph?: boolean
}): Promise<void> {
  const activePath = resolveMaterializedWorkspaceActivePath({
    activePathOverride: args?.activePathOverride ?? null,
    explorerActivePath: useMarkdownExplorerStore.getState().activePath,
  })
  if (!activePath) return
  const shouldApplyToGraph = args?.applyToGraph === true || isInitializationWorkspacePath(activePath)
  const store = useGraphStore.getState()
  const activeSourcePath = resolveWorkspaceSourcePathKey(activePath)
  const existing = Array.isArray(store.sourceFiles) ? store.sourceFiles : []
  if (!shouldApplyToGraph && existing.length > 0) {
    const activeIndex = existing.findIndex(file => String(file?.source?.path || '') === activeSourcePath)
    if (activeIndex >= 0) {
      let nextSourceFiles = existing
      const activeFile = existing[activeIndex] || null
      const activeText = String(activeFile?.text || '')
      if (!activeText.trim()) {
        try {
          const fs = args?.fs || (await getWorkspaceFs())
          const hydratedText = await fs.readFileText(activePath)
          const fallbackText = typeof hydratedText === 'string' && hydratedText.trim()
            ? hydratedText
            : await readWorkspaceStorageDocFallbackText(activePath)
          if (fallbackText.trim()) {
            nextSourceFiles = existing.slice()
            nextSourceFiles[activeIndex] = {
              ...activeFile,
              text: fallbackText,
            }
          }
        } catch {
          void 0
        }
      }
      const next = pruneWorkspaceSourceFilesToActive({
        sourceFiles: nextSourceFiles,
        activeSourcePath,
      })
      if (next !== existing) store.setSourceFiles(next)
      return
    }
  }
  const fs = args?.fs || (await getWorkspaceFs())
  const workspaceEntries = await readWorkspaceActiveEntrySnapshot({
    fs,
    activePath,
    workspaceEntries: args?.workspaceEntries,
  })
  const sourcesByPath = resolveWorkspaceSourceIndexSnapshot(args?.sourcesByPath)
  const merged = mergeWorkspaceEntriesIntoSourceFiles({
    existing,
    workspaceEntries,
    sourcesByPath,
    forceIncludePaths: buildMaterializedWorkspaceForceIncludePaths({
      activePathOverride: activePath,
    }),
    forceIncludeOnly: true,
    workspaceDocsOnly: readWorkspaceSourceFilesDocsOnlySetting(),
  })
  const normalizedMerged = !shouldApplyToGraph
    ? pruneWorkspaceSourceFilesToActive({
        sourceFiles: merged,
        activeSourcePath,
      })
    : merged
  if (normalizedMerged !== existing) {
    store.setSourceFiles(normalizedMerged)
  }
  if (!shouldApplyToGraph) return
  const preserveFrontmatterDrivenLanding = shouldApplyToGraph && isInitializationWorkspacePath(activePath)
  const materialized = await applyWorkspaceImportToCanvas({
    fs,
    createdPaths: [activePath],
    opts: {
      workspaceEntries,
      sourcesByPath,
      applyToGraph: shouldApplyToGraph,
      skipComposedGraphApply: preserveFrontmatterDrivenLanding,
    },
  })
  if (
    !preserveFrontmatterDrivenLanding &&
    shouldApplyToGraph &&
    (materialized.parsedCount > 0 || materialized.enabledCount > 0)
  ) {
    scheduleApplyComposedGraphFromSourceFiles()
  }
}

export async function resolveInitialWorkspaceStartupState(): Promise<{
  activePath: WorkspacePath | null
  workspaceEntries: WorkspaceEntry[]
}> {
  const explorer = useMarkdownExplorerStore.getState()
  const preferCustomValidationSeed =
    CUSTOM_TEST_VALIDATION_WORKSPACE_SEED_ACTIVE &&
    TEST_VALIDATION_WORKSPACE_SEED_REL_PATH !== DEFAULT_TEST_VALIDATION_WORKSPACE_SEED_REL_PATH
  const fs = await getWorkspaceFs()
  await fs.ensureSeed()
  const currentActivePath = resolveMaterializedWorkspaceActivePath({ explorerActivePath: explorer.activePath })
  let desiredActivePath = preferCustomValidationSeed
    ? TEST_VALIDATION_WORKSPACE_SEED_PATH
    : currentActivePath
  let workspaceEntries = desiredActivePath
    ? await readWorkspaceActiveEntrySnapshot({ fs, activePath: desiredActivePath })
    : []
  const hasDesiredActiveText = workspaceEntries.some(entry => entry?.kind === 'file' && String(entry.text || '').trim())
  if (!hasDesiredActiveText && !preferCustomValidationSeed) {
    desiredActivePath = WORKSPACE_README_SEED_PATH
    workspaceEntries = await readWorkspaceActiveEntrySnapshot({ fs, activePath: desiredActivePath })
  }
  const snapshot = buildInitialWorkspaceStartupSnapshot({
    currentActivePath,
    desiredActivePath,
    workspaceEntries,
    lastSetActivePath: explorer.lastSetActivePath,
    preferCustomValidationSeed,
  })
  if (desiredActivePath && desiredActivePath !== currentActivePath) {
    explorer.setActivePath(desiredActivePath)
  }
  return snapshot
}
