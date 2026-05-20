import { useGraphStore } from '@/hooks/useGraphStore'
import { getWorkspaceFs } from '@/features/workspace-fs/workspaceFs'
import type { WorkspaceEntry, WorkspaceFs, WorkspacePath } from '@/features/workspace-fs/types'
import type { SourceFile } from '@/hooks/store/types'
import { resolveWorkspaceSourcePathKey } from '@/features/workspace-fs/syncToSourceFiles'
import { normalizeWorkspacePath } from '@/features/workspace-fs/path'
import { readEnvString } from '@/lib/config.env'
import { KNOWGRPH_STORAGE_ROUTE_PATHS } from '@/lib/storage/knowgrphStorageSyncContract'
import { buildKnowgrphWorkspaceIdFromSourceFilesWorkspaceState } from '@/features/source-files/sourceFilesStorageSync'
import { loadPersistedSourceFilesWorkspace } from '@/features/source-files/sourceFilesDb'
import {
  readCachedWorkspaceActiveEntrySnapshot,
  rememberWorkspaceActiveEntrySnapshot,
} from '@/features/source-files/workspaceActiveEntryCache'

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
  const currentText = String(args.currentText || '')
  if (currentText.trim()) return currentText
  let fsText = ''
  try {
    const fs = args.fs || (await getWorkspaceFs())
    fsText = String((await fs.readFileText(args.activePath)) || '')
  } catch {
    fsText = ''
  }
  if (fsText.trim()) return fsText
  return readWorkspaceStorageDocFallbackText(args.activePath, args.storageFallbackByPath)
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
}): Promise<string> {
  const activeText = String(args.activeFile?.text || '')
  if (activeText.trim()) return activeText
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
