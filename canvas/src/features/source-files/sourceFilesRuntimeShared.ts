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
  TEST_VALIDATION_WORKSPACE_SEED_REL_PATH,
  isInitializationWorkspacePath,
  resolveWorkspaceStartupActivePath,
} from '@/features/workspace-fs/workspaceFs'
import { readWorkspaceSourceFilesDocsOnlySetting } from '@/lib/workspace/workspaceStoreSyncSettings'
import { readEnvString } from '@/lib/config.env'
import { KNOWGRPH_STORAGE_ROUTE_PATHS } from '@/lib/storage/knowgrphStorageSyncContract'
import { buildKnowgrphWorkspaceIdFromSourceFilesWorkspaceState } from '@/features/source-files/sourceFilesStorageSync'

const normalizeString = (value: unknown): string => String(value || '').trim()

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
  return [`huijoohwee/docs/${rel}`, `docs/${rel}`]
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
        try {
          const response = await fetch(requestUrl)
          if (!response.ok) continue
          const text = String(await response.text())
          if (text.trim()) {
            fallbackByActivePath?.set(normalizedPath, text)
            return text
          }
        } catch {
          void 0
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

export async function resolveWorkspaceMaterializationEntries(args: {
  fs: Awaited<ReturnType<typeof getWorkspaceFs>>
  workspaceEntries?: WorkspaceEntry[]
}): Promise<WorkspaceEntry[]> {
  return Array.isArray(args.workspaceEntries) ? args.workspaceEntries : await args.fs.listEntries()
}

export function readReusableWorkspaceEntriesSnapshot(
  workspaceEntries: WorkspaceEntry[] | null | undefined,
): WorkspaceEntry[] | undefined {
  return Array.isArray(workspaceEntries) && workspaceEntries.length > 0 ? workspaceEntries : undefined
}

export async function hydrateWorkspaceEntriesInlineText(args: {
  fs: WorkspaceFs
  workspaceEntries: WorkspaceEntry[]
}): Promise<WorkspaceEntry[]> {
  const entries = Array.isArray(args.workspaceEntries) ? args.workspaceEntries : []
  if (entries.length === 0) return entries
  let changed = false
  const storageFallbackByPath = new Map<string, string>()
  const next = await Promise.all(
    entries.map(async entry => {
      if (!entry || entry.kind !== 'file') return entry
      if (typeof entry.text === 'string' && entry.text.trim().length > 0) return entry
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
  const workspaceEntries = await resolveWorkspaceMaterializationEntries({
    fs,
    workspaceEntries: args?.workspaceEntries,
  })
  const workspaceEntriesForMerge = !shouldApplyToGraph
    ? workspaceEntries.filter(entry => entry?.kind === 'file' && entry.path === activePath)
    : workspaceEntries
  const sourcesByPath = resolveWorkspaceSourceIndexSnapshot(args?.sourcesByPath)
  const merged = mergeWorkspaceEntriesIntoSourceFiles({
    existing,
    workspaceEntries: workspaceEntriesForMerge,
    sourcesByPath,
    forceIncludePaths: buildMaterializedWorkspaceForceIncludePaths({
      activePathOverride: activePath,
    }),
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
  const workspaceEntries = await fs.listEntries()
  const workspaceFilePaths = workspaceEntries
    .filter(entry => entry.kind === 'file')
    .map(entry => entry.path)
  const desiredActivePath = resolveWorkspaceStartupActivePath({
    workspaceFilePaths,
    activePath: resolveMaterializedWorkspaceActivePath({ explorerActivePath: explorer.activePath }),
    preferValidationSeedForDefaultFamily: false,
    forceValidationSeedIfPresent: preferCustomValidationSeed,
  })
  const currentActivePath = resolveMaterializedWorkspaceActivePath({ explorerActivePath: explorer.activePath })
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
