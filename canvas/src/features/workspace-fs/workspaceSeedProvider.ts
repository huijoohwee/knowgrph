import { readEnvString } from '@/lib/config.env'
import { buildCodebaseFilePath, buildLocalFsFetchPath } from '@/lib/url'
import { readWorkspaceImportDefaultSourceUrlSetting } from '@/lib/workspace/workspaceStoreSyncSettings'

const KG_FS_WRITE_PATH = '/__kg_fs_write'
const KG_FS_LIST_PATH = '/__kg_fs_list'
const WORKSPACE_DOCS_MIRROR_MAX_FILES = 500
const WORKSPACE_DOCS_MIRROR_MAX_FILE_BYTES = 500 * 1024

const normalizeRelPath = (value: string): string => {
  return String(value || '')
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')
}

const normalizeBasename = (value: string): string => {
  const normalized = normalizeRelPath(value)
  if (!normalized) return ''
  const parts = normalized.split('/').filter(Boolean)
  if (parts.length === 0) return ''
  return parts[parts.length - 1] || ''
}

const normalizeAbsRoot = (value: string): string => {
  return String(value || '')
    .trim()
    .replace(/\\/g, '/')
    .replace(/\/+$/, '')
}

const readWorkspaceInitializationDocsAbsRoot = (): string => {
  return normalizeAbsRoot(readEnvString('VITE_WORKSPACE_INITIALIZATION_DOCS_ABS_ROOT', ''))
}

const MARKDOWN_MIRROR_EXT_SET = new Set(['.md', '.markdown', '.mdx', '.mmd'])

const isMarkdownMirrorFileName = (name: string): boolean => {
  const normalized = String(name || '').trim().toLowerCase()
  if (!normalized) return false
  const dot = normalized.lastIndexOf('.')
  if (dot <= 0) return false
  return MARKDOWN_MIRROR_EXT_SET.has(normalized.slice(dot))
}

const resolveWorkspaceDocsRootFromSourceFilesSelection = async (): Promise<{
  selectedFolderPath: string
  localMarkdownFolderHandle: FileSystemDirectoryHandle | null
  localMarkdownFolderCacheId: string | null
  sourceFiles: Array<{
    name?: unknown
    text?: unknown
    updatedAtMs?: unknown
    source?: { kind?: unknown; path?: unknown; url?: unknown } | null
  }>
} | null> => {
  if (typeof window === 'undefined') return null
  try {
    const mod = (await import('@/hooks/useGraphStore')) as typeof import('@/hooks/useGraphStore')
    const state = mod.useGraphStore.getState()
    const selectedFolderPath = normalizeMirrorRelPath(String(state.localMarkdownSelectedFolderPath || ''))
    return {
      selectedFolderPath,
      localMarkdownFolderHandle: state.localMarkdownFolderHandle || null,
      localMarkdownFolderCacheId: String(state.localMarkdownFolderCacheId || '').trim() || null,
      sourceFiles: Array.isArray(state.sourceFiles) ? state.sourceFiles : [],
    }
  } catch {
    return null
  }
}

const normalizeSourceFileMirrorPath = (value: unknown): string => {
  const raw = String(value || '').trim()
  if (!raw) return ''
  const withoutWorkspacePrefix = raw.startsWith('workspace:') ? raw.slice('workspace:'.length) : raw
  return normalizeMirrorRelPath(withoutWorkspacePrefix)
}

const WORKSPACE_DOCS_MIRROR_ROOT_SEGMENT = 'docs'

const stripWorkspaceDocsMirrorRootPrefix = (path: string): string => {
  const normalized = normalizeMirrorRelPath(path)
  if (!normalized) return ''
  const parts = normalized.split('/').filter(Boolean)
  let start = 0
  while (start < parts.length && String(parts[start] || '').toLowerCase() === WORKSPACE_DOCS_MIRROR_ROOT_SEGMENT) {
    start += 1
  }
  if (start === 0) return normalized
  return normalizeMirrorRelPath(parts.slice(start).join('/'))
}

const resolveSelectedFolderRelativeMirrorPath = (fullPath: string, selectedFolderPath: string): string => {
  const normalizedFullPath = normalizeSourceFileMirrorPath(fullPath)
  const normalizedSelectedFolderPath = normalizeMirrorRelPath(selectedFolderPath)
  if (!normalizedFullPath) return ''
  if (!normalizedSelectedFolderPath) {
    const trimmed = stripWorkspaceDocsMirrorRootPrefix(normalizedFullPath)
    return trimmed || normalizedFullPath
  }
  if (normalizedFullPath === normalizedSelectedFolderPath) return ''
  const prefix = `${normalizedSelectedFolderPath}/`
  if (normalizedFullPath.startsWith(prefix)) {
    return stripWorkspaceDocsMirrorRootPrefix(normalizedFullPath.slice(prefix.length))
  }
  const nestedPrefix = `${normalizedSelectedFolderPath}/`
  const nestedIndex = normalizedFullPath.indexOf(nestedPrefix)
  if (nestedIndex >= 0) {
    return stripWorkspaceDocsMirrorRootPrefix(normalizedFullPath.slice(nestedIndex + nestedPrefix.length))
  }
  const selectedParts = normalizedSelectedFolderPath.split('/').filter(Boolean)
  const selectedLeaf = selectedParts.length > 0 ? String(selectedParts[selectedParts.length - 1] || '').toLowerCase() : ''
  if (selectedLeaf) {
    const fullLower = normalizedFullPath.toLowerCase()
    if (fullLower === selectedLeaf) return ''
    if (fullLower.startsWith(`${selectedLeaf}/`)) {
      return stripWorkspaceDocsMirrorRootPrefix(normalizedFullPath.slice(selectedLeaf.length + 1))
    }
  }
  if (!normalizedFullPath.includes('/')) {
    return stripWorkspaceDocsMirrorRootPrefix(normalizedFullPath)
  }
  if (normalizedFullPath.endsWith(`/${normalizedSelectedFolderPath}`)) return ''
  return ''
}

const readWorkspaceDocsMirrorEntriesFromSourceFilesRecords = (args: {
  sourceFiles: Array<{
    name?: unknown
    text?: unknown
    updatedAtMs?: unknown
    source?: { kind?: unknown; path?: unknown; url?: unknown } | null
  }>
  selectedFolderPath: string
}): WorkspaceDocsMirrorEntry[] => {
  const sourceFiles = Array.isArray(args.sourceFiles) ? args.sourceFiles : []
  if (sourceFiles.length === 0) return []
  const selectedFolderPath = normalizeMirrorRelPath(args.selectedFolderPath)
  const byRelPath = new Map<string, WorkspaceDocsMirrorEntry>()
  for (let i = 0; i < sourceFiles.length; i += 1) {
    const sourceFile = sourceFiles[i]
    if (!sourceFile) continue
    const sourceKind = String(sourceFile.source?.kind || '').trim().toLowerCase()
    if (sourceKind && sourceKind !== 'local') continue
    const text = String(sourceFile.text || '')
    if (!text.trim()) continue
    const pathCandidate = normalizeSourceFileMirrorPath(sourceFile.source?.path || sourceFile.name || '')
    if (!pathCandidate) continue
    if (!isMarkdownMirrorFileName(pathCandidate)) continue
    const relPath = resolveSelectedFolderRelativeMirrorPath(pathCandidate, selectedFolderPath)
    if (!relPath || !isMarkdownMirrorFileName(relPath)) continue
    const updatedAtMsRaw = Number(sourceFile.updatedAtMs)
    const updatedAtMs = Number.isFinite(updatedAtMsRaw) ? Math.floor(updatedAtMsRaw) : Date.now()
    const next: WorkspaceDocsMirrorEntry = { relPath, text, updatedAtMs }
    const existing = byRelPath.get(relPath)
    if (!existing || next.updatedAtMs >= existing.updatedAtMs) {
      byRelPath.set(relPath, next)
    }
  }
  return [...byRelPath.values()]
    .sort((a, b) => a.relPath.localeCompare(b.relPath))
    .slice(0, WORKSPACE_DOCS_MIRROR_MAX_FILES)
}

const iterDirectoryEntries = (handle: FileSystemDirectoryHandle): AsyncIterable<[string, FileSystemHandle]> => {
  const h = handle as unknown as { entries?: () => AsyncIterable<[string, FileSystemHandle]> }
  if (typeof h.entries === 'function') return h.entries()
  const v = handle as unknown as { values?: () => AsyncIterable<FileSystemHandle> }
  if (typeof v.values === 'function') {
    const values = v.values()
    return (async function* () {
      for await (const entry of values) {
        const name = String((entry as unknown as { name?: unknown }).name || '')
        yield [name, entry]
      }
    })()
  }
  return (async function* () {})()
}

const readWorkspaceDocsMirrorEntriesFromLocalFolderHandle = async (args: {
  rootHandle: FileSystemDirectoryHandle
  selectedFolderPath: string
}): Promise<WorkspaceDocsMirrorEntry[]> => {
  let root = args.rootHandle
  const selectedFolderPath = normalizeMirrorRelPath(args.selectedFolderPath)
  if (selectedFolderPath) {
    const parts = selectedFolderPath.split('/').filter(Boolean)
    for (let i = 0; i < parts.length; i += 1) {
      root = await root.getDirectoryHandle(parts[i]!)
    }
  }
  const out: WorkspaceDocsMirrorEntry[] = []
  const stack: Array<{ handle: FileSystemDirectoryHandle; relBase: string }> = [{ handle: root, relBase: '' }]
  while (stack.length > 0 && out.length < WORKSPACE_DOCS_MIRROR_MAX_FILES) {
    const next = stack.pop()
    if (!next) break
    const { handle, relBase } = next
    for await (const [entryName, entry] of iterDirectoryEntries(handle)) {
      if (out.length >= WORKSPACE_DOCS_MIRROR_MAX_FILES) break
      const name = String(entryName || '').trim()
      if (!name || name.startsWith('.')) continue
      if (entry.kind === 'directory') {
        const rel = relBase ? `${relBase}/${name}` : name
        stack.push({ handle: entry as FileSystemDirectoryHandle, relBase: rel })
        continue
      }
      if (entry.kind !== 'file') continue
      if (!isMarkdownMirrorFileName(name)) continue
      try {
        const file = await (entry as FileSystemFileHandle).getFile()
        if (!file || !Number.isFinite(file.size) || file.size > WORKSPACE_DOCS_MIRROR_MAX_FILE_BYTES) continue
        const text = String(await file.text())
        if (!text.trim()) continue
        const relPath = normalizeMirrorRelPath(relBase ? `${relBase}/${name}` : name)
        if (!relPath) continue
        out.push({
          relPath,
          text,
          updatedAtMs: Number.isFinite(file.lastModified) ? Math.floor(file.lastModified) : Date.now(),
        })
      } catch {
        void 0
      }
    }
  }
  return out
}

const readWorkspaceDocsMirrorEntriesFromLocalFolderCache = async (args: {
  folderCacheId: string
  selectedFolderPath: string
}): Promise<WorkspaceDocsMirrorEntry[]> => {
  const folderCacheId = String(args.folderCacheId || '').trim()
  if (!folderCacheId) return []
  try {
    const cache = (await import('@/features/source-files/markdownFsCache')) as typeof import('@/features/source-files/markdownFsCache')
    const selectedFolderPath = normalizeMirrorRelPath(args.selectedFolderPath)
    const prefix = selectedFolderPath ? `${selectedFolderPath}/` : ''
    const paths = await cache.listCachedMarkdownPaths(folderCacheId)
    const candidates = paths
      .map(path => normalizeMirrorRelPath(path))
      .filter(Boolean)
      .filter(path => (!prefix ? true : path === selectedFolderPath || path.startsWith(prefix)))
      .filter(path => isMarkdownMirrorFileName(path))
      .slice(0, WORKSPACE_DOCS_MIRROR_MAX_FILES)
    const out: WorkspaceDocsMirrorEntry[] = []
    for (let i = 0; i < candidates.length; i += 1) {
      const fullPath = candidates[i]!
      const text = await cache.readCachedMarkdownText(folderCacheId, fullPath)
      if (typeof text !== 'string' || !text.trim()) continue
      const relPath = selectedFolderPath
        ? normalizeMirrorRelPath(fullPath.slice(selectedFolderPath.length).replace(/^\/+/, ''))
        : fullPath
      if (!relPath) continue
      out.push({
        relPath,
        text,
        updatedAtMs: Date.now(),
      })
    }
    return out
  } catch {
    return []
  }
}

const buildWorkspaceSeedAbsolutePathCandidates = (args: {
  basename: string
  relPathCandidates: ReadonlyArray<string>
}): string[] => {
  const root = readWorkspaceInitializationDocsAbsRoot()
  if (!root) return []
  const basename = normalizeBasename(args.basename)
  const relPathCandidates = Array.from(
    new Set((args.relPathCandidates || []).map(path => normalizeRelPath(path)).filter(Boolean)),
  )
  const out = new Set<string>()
  if (basename) out.add(`${root}/${basename}`)
  for (let i = 0; i < relPathCandidates.length; i += 1) {
    const relPath = relPathCandidates[i]!
    out.add(`${root}/${relPath}`)
    if (relPath.startsWith('docs/')) {
      out.add(`${root}/${relPath.slice('docs/'.length)}`)
    }
  }
  return [...out]
}

const readTextViaFetch = async (url: string): Promise<string | null> => {
  if (typeof fetch !== 'function') return null
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const text = (await res.text()).trim()
    return text || null
  } catch {
    return null
  }
}

const readTextViaNodeFs = async (absolutePath: string): Promise<string | null> => {
  if (typeof window !== 'undefined') return null
  try {
    const fs = (await import('node:fs/promises')) as typeof import('node:fs/promises')
    const text = String(await fs.readFile(absolutePath, 'utf8')).trim()
    return text || null
  } catch {
    return null
  }
}

const writeTextViaLocalFsProxy = async (absolutePath: string, text: string): Promise<boolean> => {
  if (typeof window === 'undefined' || typeof fetch !== 'function') return false
  try {
    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => {
      try {
        controller.abort()
      } catch {
        void 0
      }
    }, 5000)
    try {
      const response = await fetch(KG_FS_WRITE_PATH, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          path: absolutePath,
          text: String(text ?? ''),
        }),
        signal: controller.signal,
      })
      return response.ok
    } finally {
      window.clearTimeout(timeoutId)
    }
  } catch {
    return false
  }
}

export async function readWorkspaceInitializationSeedText(args: {
  basename: string
  relPathCandidates: ReadonlyArray<string>
}): Promise<string | null> {
  const basename = normalizeBasename(args.basename)
  if (!basename) return null

  const absolutePathCandidates = buildWorkspaceSeedAbsolutePathCandidates({
    basename,
    relPathCandidates: args.relPathCandidates,
  })
  for (let i = 0; i < absolutePathCandidates.length; i += 1) {
    const absolutePath = absolutePathCandidates[i]!
    const absoluteViaFetch = buildLocalFsFetchPath(absolutePath)
    if (absoluteViaFetch) {
      const text = await readTextViaFetch(absoluteViaFetch)
      if (text) return text
    }
    const text = await readTextViaNodeFs(absolutePath)
    if (text) return text
  }

  const relCandidates = Array.from(
    new Set((args.relPathCandidates || []).map(path => normalizeRelPath(path)).filter(Boolean)),
  )
  for (let i = 0; i < relCandidates.length; i += 1) {
    const text = await readTextViaFetch(buildCodebaseFilePath(relCandidates[i]!))
    if (text) return text
  }
  return null
}

const normalizeMirrorRelPath = (value: string): string => {
  return String(value || '')
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')
}

export type WorkspaceDocsMirrorEntry = {
  relPath: string
  text: string
  updatedAtMs: number
}

const readWorkspaceDocsMirrorEntriesViaProxy = async (
  docsAbsRoot: string,
): Promise<WorkspaceDocsMirrorEntry[]> => {
  if (typeof window === 'undefined' || typeof fetch !== 'function') return []
  try {
    const response = await fetch(KG_FS_LIST_PATH, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        path: docsAbsRoot,
        maxFiles: WORKSPACE_DOCS_MIRROR_MAX_FILES,
      }),
    })
    if (!response.ok) return []
    const json = (await response.json()) as {
      ok?: boolean
      files?: Array<{ relPath?: unknown; text?: unknown; updatedAtMs?: unknown }>
    }
    if (json.ok !== true || !Array.isArray(json.files)) return []
    const out: WorkspaceDocsMirrorEntry[] = []
    for (let i = 0; i < json.files.length; i += 1) {
      const item = json.files[i]
      const relPath = normalizeMirrorRelPath(String(item?.relPath || ''))
      if (!relPath) continue
      const text = typeof item?.text === 'string' ? item.text : ''
      if (!text.trim()) continue
      out.push({
        relPath,
        text,
        updatedAtMs: Number.isFinite(Number(item?.updatedAtMs)) ? Math.floor(Number(item?.updatedAtMs)) : Date.now(),
      })
    }
    return out
  } catch {
    return []
  }
}

const readWorkspaceDocsMirrorEntriesViaNodeFs = async (
  docsAbsRoot: string,
): Promise<WorkspaceDocsMirrorEntry[]> => {
  if (typeof window !== 'undefined') return []
  try {
    const fs = (await import('node:fs/promises')) as typeof import('node:fs/promises')
    const path = (await import('node:path')) as typeof import('node:path')
    const root = normalizeAbsRoot(docsAbsRoot)
    if (!root) return []
    const out: WorkspaceDocsMirrorEntry[] = []
    const queue = [root]
    const extSet = new Set(['.md', '.markdown', '.mdx', '.mmd'])
    while (queue.length > 0 && out.length < WORKSPACE_DOCS_MIRROR_MAX_FILES) {
      const dir = queue.shift()
      if (!dir) continue
      let entries: Array<import('node:fs').Dirent> = []
      try {
        entries = await fs.readdir(dir, { withFileTypes: true })
      } catch {
        continue
      }
      entries.sort((a, b) => a.name.localeCompare(b.name))
      for (let i = 0; i < entries.length; i += 1) {
        if (out.length >= WORKSPACE_DOCS_MIRROR_MAX_FILES) break
        const entry = entries[i]
        if (!entry) continue
        const absPath = path.resolve(dir, entry.name)
        if (entry.isDirectory()) {
          queue.push(absPath)
          continue
        }
        if (!entry.isFile()) continue
        const ext = String(path.extname(entry.name) || '').toLowerCase()
        if (!extSet.has(ext)) continue
        try {
          const stat = await fs.stat(absPath)
          if (!stat.isFile() || stat.size > WORKSPACE_DOCS_MIRROR_MAX_FILE_BYTES) continue
          const text = String(await fs.readFile(absPath, 'utf8'))
          if (!text.trim()) continue
          const relPath = normalizeMirrorRelPath(path.relative(root, absPath))
          if (!relPath) continue
          out.push({
            relPath,
            text,
            updatedAtMs: Number.isFinite(stat.mtimeMs) ? Math.floor(stat.mtimeMs) : Date.now(),
          })
        } catch {
          void 0
        }
      }
    }
    return out
  } catch {
    return []
  }
}

const readWorkspaceDocsMirrorEntriesFromDefaultSourceUrl = async (
  url: string,
): Promise<WorkspaceDocsMirrorEntry[]> => {
  try {
    const { fetchWorkspaceUrlContent } = await import(
      '@/features/markdown-workspace/workspaceImport/urlContent'
    ) as typeof import('@/features/markdown-workspace/workspaceImport/urlContent')
    const content = await fetchWorkspaceUrlContent(url, { mode: 'import', viewHint: 'markdown' })
    const text = String(content.text || '').trim()
    if (!text) return []
    const name = String(content.name || '').trim()
    const relPath = name.endsWith('.md') ? name : `${name || 'imported'}.md`
    return [{ relPath, text, updatedAtMs: Date.now() }]
  } catch {
    return []
  }
}

export async function readWorkspaceInitializationDocsMirrorEntries(): Promise<WorkspaceDocsMirrorEntry[]> {
  const sourceFilesSelection = await resolveWorkspaceDocsRootFromSourceFilesSelection()
  if (sourceFilesSelection?.sourceFiles?.length) {
    const viaSourceFiles = readWorkspaceDocsMirrorEntriesFromSourceFilesRecords({
      sourceFiles: sourceFilesSelection.sourceFiles,
      selectedFolderPath: sourceFilesSelection.selectedFolderPath,
    })
    if (viaSourceFiles.length > 0) return viaSourceFiles
  }
  if (sourceFilesSelection?.localMarkdownFolderHandle) {
    const viaHandle = await readWorkspaceDocsMirrorEntriesFromLocalFolderHandle({
      rootHandle: sourceFilesSelection.localMarkdownFolderHandle,
      selectedFolderPath: sourceFilesSelection.selectedFolderPath,
    })
    if (viaHandle.length > 0) return viaHandle
  }
  if (sourceFilesSelection?.localMarkdownFolderCacheId) {
    const viaCache = await readWorkspaceDocsMirrorEntriesFromLocalFolderCache({
      folderCacheId: sourceFilesSelection.localMarkdownFolderCacheId,
      selectedFolderPath: sourceFilesSelection.selectedFolderPath,
    })
    if (viaCache.length > 0) return viaCache
  }
  const defaultSourceUrl = readWorkspaceImportDefaultSourceUrlSetting()
  if (defaultSourceUrl) {
    const viaUrl = await readWorkspaceDocsMirrorEntriesFromDefaultSourceUrl(defaultSourceUrl)
    if (viaUrl.length > 0) return viaUrl
  }
  const docsAbsRoot = readWorkspaceInitializationDocsAbsRoot()
  if (!docsAbsRoot) return []
  const viaProxy = await readWorkspaceDocsMirrorEntriesViaProxy(docsAbsRoot)
  if (viaProxy.length > 0) return viaProxy
  return readWorkspaceDocsMirrorEntriesViaNodeFs(docsAbsRoot)
}

export async function upsertWorkspaceInitializationSeedText(args: {
  basename: string
  text: string
}): Promise<boolean> {
  const absolutePath = buildWorkspaceSeedAbsolutePathCandidates({
    basename: args.basename,
    relPathCandidates: [],
  })[0] || null
  if (!absolutePath) return false
  if (typeof window !== 'undefined') {
    return writeTextViaLocalFsProxy(absolutePath, args.text)
  }
  try {
    const fs = (await import('node:fs/promises')) as typeof import('node:fs/promises')
    const path = (await import('node:path')) as typeof import('node:path')
    await fs.mkdir(path.dirname(absolutePath), { recursive: true })
    await fs.writeFile(absolutePath, String(args.text ?? ''), 'utf8')
    return true
  } catch {
    return false
  }
}

export async function deleteWorkspaceInitializationSeedText(args: {
  basename: string
}): Promise<boolean> {
  const absolutePath = buildWorkspaceSeedAbsolutePathCandidates({
    basename: args.basename,
    relPathCandidates: [],
  })[0] || null
  if (!absolutePath || typeof window !== 'undefined') return false
  try {
    const fs = (await import('node:fs/promises')) as typeof import('node:fs/promises')
    await fs.unlink(absolutePath)
    return true
  } catch {
    return false
  }
}
