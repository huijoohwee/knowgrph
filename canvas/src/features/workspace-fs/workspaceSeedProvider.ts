import { readEnvString } from '@/lib/config.env'
import { buildCodebaseFilePath, buildLocalFsFetchPath } from '@/lib/url'
import { readWorkspaceImportDefaultSourceUrlSetting } from '@/lib/workspace/workspaceStoreSyncSettings'
import { buildKnowgrphWorkspaceIdFromSourceFilesWorkspaceState } from '@/features/source-files/sourceFilesStorageSync'
import {
  KNOWGRPH_STORAGE_ROUTE_PATHS,
  buildKnowgrphStorageExportPath,
  type KnowgrphStorageExportResponse,
} from '@/lib/storage/knowgrphStorageSyncContract'

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

const readWorkspaceInitializationKnowgrphStorageBaseUrl = (): string => {
  return String(readEnvString('VITE_KNOWGRPH_STORAGE_BASE_URL', '') || '').trim()
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
  folderName: string | null
  accessMode: string | null
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
    const selectedFolderPath = normalizeSelectedFolderMirrorPath(String(state.localMarkdownSelectedFolderPath || ''))
    return {
      selectedFolderPath,
      folderName: String(state.localMarkdownFolderName || '').trim() || null,
      accessMode: String(state.localMarkdownFolderAccessMode || '').trim() || null,
      localMarkdownFolderHandle: state.localMarkdownFolderHandle || null,
      localMarkdownFolderCacheId: String(state.localMarkdownFolderCacheId || '').trim() || null,
      sourceFiles: Array.isArray(state.sourceFiles) ? state.sourceFiles : [],
    }
  } catch {
    return null
  }
}

const readWorkspaceDocsMirrorEntriesFromKnowgrphStorageExport = async (args: {
  baseUrl: string
  workspaceId: string
  selectedFolderPath: string
}): Promise<WorkspaceDocsMirrorEntry[]> => {
  if (typeof fetch !== 'function') return []
  const baseUrl = String(args.baseUrl || '').trim()
  const workspaceId = String(args.workspaceId || '').trim()
  if (!baseUrl || !workspaceId) return []
  try {
    const docsAbsRoot = readWorkspaceInitializationDocsAbsRoot()
    const exportPath = buildKnowgrphStorageExportPath(workspaceId)
    const requestUrl = (() => {
      if (typeof window !== 'undefined') {
        const host = String(window.location?.hostname || '').trim().toLowerCase()
        const isLocalhost = host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0'
        if (isLocalhost && exportPath.startsWith('/api/storage/')) return exportPath
      }
      return new URL(exportPath, baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`).toString()
    })()
    const response = await fetch(requestUrl, { method: 'GET' })
    if (!response.ok) return []
    const json = (await response.json()) as Partial<KnowgrphStorageExportResponse> & { ok?: boolean }
    if (!json || json.ok !== true || !Array.isArray(json.documents)) return []
    const chunkRows = Array.isArray(json.documentChunks) ? json.documentChunks : []
    const chunksByDocumentId = new Map<string, Array<{ order: number; markdown: string; id: string }>>()
    for (let i = 0; i < chunkRows.length; i += 1) {
      const chunk = chunkRows[i]
      if (!chunk) continue
      const documentId = String(chunk.documentId || '').trim()
      const markdown = String(chunk.markdown || '')
      if (!documentId || !markdown.trim()) continue
      const orderRaw = Number(chunk.chunkOrder)
      const order = Number.isFinite(orderRaw) ? Math.floor(orderRaw) : i
      const id = String(chunk.id || '').trim()
      const existing = chunksByDocumentId.get(documentId) || []
      existing.push({ order, markdown, id })
      chunksByDocumentId.set(documentId, existing)
    }
    const selectedFolderPath = normalizeMirrorRelPath(args.selectedFolderPath)
    const byRelPath = new Map<string, WorkspaceDocsMirrorEntry>()
    for (let i = 0; i < json.documents.length; i += 1) {
      const document = json.documents[i]
      if (!document || document.deleted === true) continue
      let text = String(document.contentMd || '')
      if (!text.trim()) {
        const documentId = String(document.id || '').trim()
        const chunks = (chunksByDocumentId.get(documentId) || []).slice()
          .sort((a, b) => (a.order - b.order) || a.id.localeCompare(b.id))
        if (chunks.length > 0) {
          text = chunks.map(chunk => chunk.markdown).join('\n\n')
        }
      }
      if (!text.trim()) continue
      const canonicalPathRaw = String(document.canonicalPath || document.title || document.id || '').trim()
      const canonicalPath = normalizeSourceFileMirrorPath(
        docsAbsRoot && canonicalPathRaw.startsWith(`${docsAbsRoot}/`)
          ? canonicalPathRaw.slice(docsAbsRoot.length + 1)
          : canonicalPathRaw,
      )
      if (!canonicalPath) continue
      if (!isMarkdownMirrorFileName(canonicalPath)) continue
      const relPath = resolveSelectedFolderRelativeMirrorPath(canonicalPath, selectedFolderPath)
      if (!relPath || !isMarkdownMirrorFileName(relPath)) continue
      const updatedAtMs = Number.isFinite(Number(document.updatedAtMs))
        ? Math.floor(Number(document.updatedAtMs))
        : Date.now()
      const next: WorkspaceDocsMirrorEntry = { relPath, text, updatedAtMs }
      const existing = byRelPath.get(relPath)
      if (!existing || next.updatedAtMs >= existing.updatedAtMs) {
        byRelPath.set(relPath, next)
      }
    }
    return [...byRelPath.values()]
      .sort((a, b) => a.relPath.localeCompare(b.relPath))
      .slice(0, WORKSPACE_DOCS_MIRROR_MAX_FILES)
  } catch {
    return []
  }
}

const buildKnowgrphStorageRequestUrl = (args: { path: string; baseUrl: string }): string => {
  const safePath = String(args.path || '').trim()
  if (!safePath) return ''
  if (typeof window !== 'undefined') {
    const host = String(window.location?.hostname || '').trim().toLowerCase()
    const isLocalhost = host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0'
    if (isLocalhost && safePath.startsWith('/api/storage/')) return safePath
  }
  const baseUrl = String(args.baseUrl || '').trim()
  if (!baseUrl) return safePath
  return new URL(safePath, baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`).toString()
}

const readCanonicalPathCandidatesForSourcePath = (sourcePathRaw: string): string[] => {
  const sourcePath = String(sourcePathRaw || '').trim().replace(/\\/g, '/')
  if (!sourcePath) return []
  const withoutWorkspace = sourcePath.startsWith('workspace:') ? sourcePath.slice('workspace:'.length) : sourcePath
  const normalizeCanonicalPath = (value: string): string => {
    let next = normalizeMirrorRelPath(value)
    if (!next) return ''
    const collapsePrefix = (path: string, prefix: string): string => {
      const normalizedPath = normalizeMirrorRelPath(path)
      const normalizedPrefix = normalizeMirrorRelPath(prefix)
      const doubled = `${normalizedPrefix}/${normalizedPrefix}/`
      if (normalizedPath.startsWith(doubled)) {
        return `${normalizedPrefix}/${normalizedPath.slice(doubled.length)}`
      }
      return normalizedPath
    }
    const docsRootMarker = 'huijoohwee/docs/'
    const docsRootIndex = next.toLowerCase().indexOf(docsRootMarker)
    if (docsRootIndex > 0) {
      next = next.slice(docsRootIndex)
    }
    if (next.toLowerCase().startsWith('docs/huijoohwee/docs/')) {
      next = `huijoohwee/docs/${next.slice('docs/huijoohwee/docs/'.length)}`
    }
    next = collapsePrefix(next, 'docs')
    next = collapsePrefix(next, 'huijoohwee/docs')
    return normalizeMirrorRelPath(next)
  }
  const normalized = normalizeCanonicalPath(withoutWorkspace)
  if (!normalized) return []
  const candidates = new Set<string>()
  const push = (value: string) => {
    const next = normalizeCanonicalPath(value)
    if (!next || !isMarkdownMirrorFileName(next)) return
    if (next.toLowerCase().includes('/huijoohwee/docs/huijoohwee/docs/')) return
    if (next.toLowerCase().startsWith('docs/huijoohwee/docs/')) return
    candidates.add(next)
  }
  if (normalized.startsWith('docs/')) {
    // Prefer canonical storage owner path first to avoid noisy/failed docs/* probes.
    push(`huijoohwee/${normalized}`)
    push(normalized)
  } else if (normalized.startsWith('huijoohwee/docs/')) {
    push(normalized)
    push(normalized.slice('huijoohwee/'.length))
  } else {
    push(normalized)
  }
  return [...candidates]
}

const readWorkspaceDocsMirrorEntriesFromKnowgrphStorageDocsBySourceFiles = async (args: {
  baseUrl: string
  workspaceId: string
  selectedFolderPath: string
  sourceFiles: Array<{
    name?: unknown
    text?: unknown
    updatedAtMs?: unknown
    source?: { kind?: unknown; path?: unknown; url?: unknown } | null
  }>
}): Promise<WorkspaceDocsMirrorEntry[]> => {
  if (typeof fetch !== 'function') return []
  const workspaceId = String(args.workspaceId || '').trim()
  if (!workspaceId) return []
  const sourceFiles = Array.isArray(args.sourceFiles) ? args.sourceFiles : []
  if (sourceFiles.length === 0) return []
  const selectedFolderPath = normalizeMirrorRelPath(args.selectedFolderPath)
  const byRelPath = new Map<string, WorkspaceDocsMirrorEntry>()
  const maxFiles = Math.min(WORKSPACE_DOCS_MIRROR_MAX_FILES, 200)
  for (let i = 0; i < sourceFiles.length && byRelPath.size < maxFiles; i += 1) {
    const sourceFile = sourceFiles[i]
    if (!sourceFile) continue
    const sourceKind = String(sourceFile.source?.kind || '').trim().toLowerCase()
    if (sourceKind && sourceKind !== 'local') continue
    const sourcePathRaw = String(sourceFile.source?.path || sourceFile.name || '').trim()
    const pathCandidate = normalizeSourceFileMirrorPath(sourcePathRaw)
    if (!pathCandidate || !isMarkdownMirrorFileName(pathCandidate)) continue
    const canonicalCandidates = readCanonicalPathCandidatesForSourcePath(sourcePathRaw)
    const relPath = (() => {
      const fromSourcePath = resolveSelectedFolderRelativeMirrorPath(pathCandidate, selectedFolderPath)
      if (fromSourcePath && isMarkdownMirrorFileName(fromSourcePath)) return fromSourcePath
      const fallbackCanonical = canonicalCandidates.length > 0 ? String(canonicalCandidates[0] || '') : ''
      const fromCanonical = resolveSelectedFolderRelativeMirrorPath(fallbackCanonical, selectedFolderPath)
      if (fromCanonical && isMarkdownMirrorFileName(fromCanonical)) return fromCanonical
      return ''
    })()
    if (!relPath) continue
    let text = ''
    for (let c = 0; c < canonicalCandidates.length; c += 1) {
      const canonicalPath = canonicalCandidates[c]
      if (!canonicalPath) continue
      const docPath = `${KNOWGRPH_STORAGE_ROUTE_PATHS.docPrefix}${encodeURIComponent(workspaceId)}/${encodeURIComponent(canonicalPath)}`
      const requestUrl = buildKnowgrphStorageRequestUrl({ path: docPath, baseUrl: args.baseUrl })
      if (!requestUrl) continue
      const fetched = await readTextViaFetch(requestUrl)
      if (!fetched) continue
      text = fetched
      break
    }
    if (!text.trim()) continue
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
}

const readWorkspaceDocsMirrorEntriesFromKnowgrphStorageDbCache = async (args: {
  workspaceId: string
  selectedFolderPath: string
}): Promise<WorkspaceDocsMirrorEntry[]> => {
  const workspaceId = String(args.workspaceId || '').trim()
  if (!workspaceId) return []
  try {
    const mod = (await import('@/lib/storage/knowgrphStorageRxdb')) as typeof import('@/lib/storage/knowgrphStorageRxdb')
    const dbState = await mod.getKnowgrphStorageDb()
    const documents = await dbState.collections.documents.find({
      selector: {
        workspaceId,
        isDeleted: false,
      },
    }).exec()
    if (!documents || documents.length === 0) return []
    const chunks = await dbState.collections.documentChunks.find({
      selector: { workspaceId },
    }).exec()
    const chunksByDocumentId = new Map<string, Array<{ order: number; markdown: string }>>()
    for (let i = 0; i < chunks.length; i += 1) {
      const row = chunks[i]
      if (!row) continue
      const documentId = String(row.get('documentId') || '').trim()
      const markdown = String(row.get('markdown') || '')
      if (!documentId || !markdown.trim()) continue
      const chunkOrderRaw = Number(row.get('chunkOrder'))
      const chunkOrder = Number.isFinite(chunkOrderRaw) ? Math.floor(chunkOrderRaw) : i
      const existing = chunksByDocumentId.get(documentId) || []
      existing.push({ order: chunkOrder, markdown })
      chunksByDocumentId.set(documentId, existing)
    }
    const selectedFolderPath = normalizeMirrorRelPath(args.selectedFolderPath)
    const byRelPath = new Map<string, WorkspaceDocsMirrorEntry>()
    for (let i = 0; i < documents.length; i += 1) {
      const row = documents[i]
      if (!row) continue
      const canonicalPath = normalizeSourceFileMirrorPath(String(row.get('canonicalPath') || ''))
      if (!canonicalPath || !isMarkdownMirrorFileName(canonicalPath)) continue
      const relPath = resolveSelectedFolderRelativeMirrorPath(canonicalPath, selectedFolderPath)
      if (!relPath || !isMarkdownMirrorFileName(relPath)) continue
      let text = String(row.get('contentMd') || '')
      if (!text.trim()) {
        const documentId = String(row.get('id') || '').trim()
        const docChunks = (chunksByDocumentId.get(documentId) || []).slice().sort((a, b) => a.order - b.order)
        if (docChunks.length > 0) {
          text = docChunks.map(chunk => chunk.markdown).join('\n\n')
        }
      }
      if (!text.trim()) continue
      const updatedAtMsRaw = Number(row.get('updatedAtMs'))
      const updatedAtMs = Number.isFinite(updatedAtMsRaw) ? Math.floor(updatedAtMsRaw) : Date.now()
      const next: WorkspaceDocsMirrorEntry = { relPath, text, updatedAtMs }
      const existing = byRelPath.get(relPath)
      if (!existing || next.updatedAtMs >= existing.updatedAtMs) {
        byRelPath.set(relPath, next)
      }
      if (byRelPath.size >= WORKSPACE_DOCS_MIRROR_MAX_FILES) break
    }
    return [...byRelPath.values()].sort((a, b) => a.relPath.localeCompare(b.relPath))
  } catch {
    return []
  }
}

const normalizeSourceFileMirrorPath = (value: unknown): string => {
  const raw = String(value || '').trim()
  if (!raw) return ''
  const withoutWorkspacePrefix = raw.startsWith('workspace:') ? raw.slice('workspace:'.length) : raw
  const collapsePrefix = (path: string, prefix: string): string => {
    const normalizedPath = normalizeMirrorRelPath(path)
    const normalizedPrefix = normalizeMirrorRelPath(prefix)
    if (!normalizedPath || !normalizedPrefix) return normalizedPath
    const doubled = `${normalizedPrefix}/${normalizedPrefix}/`
    if (normalizedPath.startsWith(doubled)) {
      return `${normalizedPrefix}/${normalizedPath.slice(doubled.length)}`
    }
    return normalizedPath
  }
  let normalized = normalizeMirrorRelPath(withoutWorkspacePrefix)
  if (!normalized) return ''
  const docsRootMarker = 'huijoohwee/docs/'
  const docsRootIndex = normalized.toLowerCase().indexOf(docsRootMarker)
  if (docsRootIndex > 0) {
    normalized = normalized.slice(docsRootIndex)
  }
  if (normalized.toLowerCase().startsWith('docs/huijoohwee/docs/')) {
    normalized = `huijoohwee/docs/${normalized.slice('docs/huijoohwee/docs/'.length)}`
  }
  normalized = collapsePrefix(normalized, 'docs')
  normalized = collapsePrefix(normalized, 'huijoohwee/docs')
  return normalizeMirrorRelPath(normalized)
}

const WORKSPACE_DOCS_MIRROR_ROOT_SEGMENT = 'docs'

const stripWorkspaceDocsMirrorRootPrefix = (path: string): string => {
  const normalized = normalizeMirrorRelPath(path)
  if (!normalized) return ''
  const lowered = normalized.toLowerCase()
  const docsRootMarker = 'huijoohwee/docs/'
  if (lowered.startsWith(docsRootMarker)) {
    return normalizeMirrorRelPath(normalized.slice(docsRootMarker.length))
  }
  if (lowered.startsWith(`docs/${docsRootMarker}`)) {
    return normalizeMirrorRelPath(normalized.slice(`docs/${docsRootMarker}`.length))
  }
  const docsRootIndex = lowered.indexOf(`/${docsRootMarker}`)
  if (docsRootIndex >= 0) {
    return normalizeMirrorRelPath(normalized.slice(docsRootIndex + docsRootMarker.length + 1))
  }
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
  const normalizedSelectedFolderPath = normalizeSelectedFolderMirrorPath(selectedFolderPath)
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

const hasIncompleteSourceFilesMirrorText = (args: {
  sourceFiles: Array<{
    name?: unknown
    text?: unknown
    source?: { kind?: unknown; path?: unknown } | null
  }>
  selectedFolderPath: string
}): boolean => {
  const sourceFiles = Array.isArray(args.sourceFiles) ? args.sourceFiles : []
  if (sourceFiles.length === 0) return false
  const selectedFolderPath = normalizeMirrorRelPath(args.selectedFolderPath)
  for (let i = 0; i < sourceFiles.length; i += 1) {
    const sourceFile = sourceFiles[i]
    if (!sourceFile) continue
    const sourceKind = String(sourceFile.source?.kind || '').trim().toLowerCase()
    if (sourceKind && sourceKind !== 'local') continue
    const pathCandidate = normalizeSourceFileMirrorPath(sourceFile.source?.path || sourceFile.name || '')
    if (!pathCandidate) continue
    if (!isMarkdownMirrorFileName(pathCandidate)) continue
    const relPath = resolveSelectedFolderRelativeMirrorPath(pathCandidate, selectedFolderPath)
    if (!relPath || !isMarkdownMirrorFileName(relPath)) continue
    const text = String(sourceFile.text || '')
    if (!text.trim()) return true
  }
  return false
}

const readWorkspaceDocsMirrorEntriesFromSourceFilesRecordsHydrated = async (args: {
  sourceFiles: Array<{
    name?: unknown
    text?: unknown
    updatedAtMs?: unknown
    source?: { kind?: unknown; path?: unknown; url?: unknown } | null
  }>
  selectedFolderPath: string
  storageDocFallback?: {
    baseUrl: string
    workspaceId: string
  } | null
}): Promise<WorkspaceDocsMirrorEntry[]> => {
  const sourceFiles = Array.isArray(args.sourceFiles) ? args.sourceFiles : []
  if (sourceFiles.length === 0) return []
  const docsAbsRoot = readWorkspaceInitializationDocsAbsRoot()
  const selectedFolderPath = normalizeMirrorRelPath(args.selectedFolderPath)
  const selectedFolderAbsRoot = normalizeAbsRoot(args.selectedFolderPath)
  const buildLocalFsHydrationCandidates = (value: string): string[] => {
    const raw = String(value || '').trim()
    if (!raw) return []
    const withoutWorkspacePrefix = raw.startsWith('workspace:') ? raw.slice('workspace:'.length) : raw
    const normalized = normalizeMirrorRelPath(withoutWorkspacePrefix)
    const out = new Set<string>()
    const push = (candidate: string) => {
      const next = normalizeAbsRoot(candidate)
      if (!next) return
      out.add(next)
    }
    if (withoutWorkspacePrefix.startsWith('/')) {
      push(withoutWorkspacePrefix)
      return [...out]
    }
    if (docsAbsRoot) {
      push(`${docsAbsRoot}/${normalized}`)
      if (normalized.startsWith('docs/')) push(`${docsAbsRoot}/${normalized.slice('docs/'.length)}`)
    }
    if (selectedFolderAbsRoot && selectedFolderAbsRoot.startsWith('/')) {
      push(`${selectedFolderAbsRoot}/${normalized}`)
      if (normalized.startsWith('docs/')) push(`${selectedFolderAbsRoot}/${normalized.slice('docs/'.length)}`)
    }
    return [...out]
  }
  const byRelPath = new Map<string, WorkspaceDocsMirrorEntry>()
  for (let i = 0; i < sourceFiles.length; i += 1) {
    const sourceFile = sourceFiles[i]
    if (!sourceFile) continue
    const sourceKind = String(sourceFile.source?.kind || '').trim().toLowerCase()
    if (sourceKind && sourceKind !== 'local') continue
    const sourcePathRaw = String(sourceFile.source?.path || sourceFile.name || '').trim()
    const pathCandidate = normalizeSourceFileMirrorPath(sourcePathRaw)
    if (!pathCandidate) continue
    if (!isMarkdownMirrorFileName(pathCandidate)) continue
    const relPath = resolveSelectedFolderRelativeMirrorPath(pathCandidate, selectedFolderPath)
    if (!relPath || !isMarkdownMirrorFileName(relPath)) continue

    let text = String(sourceFile.text || '')
    if (!text.trim()) {
      const fsCandidates = buildLocalFsHydrationCandidates(sourcePathRaw)
      for (let c = 0; c < fsCandidates.length; c += 1) {
        const localFsUrl = buildLocalFsFetchPath(fsCandidates[c]!)
        if (!localFsUrl) continue
        const hydrated = await readTextViaFetch(localFsUrl)
        if (!hydrated) continue
        text = hydrated
        break
      }
    }
    if (!text.trim()) {
      const fallbackWorkspaceId = String(args.storageDocFallback?.workspaceId || '').trim()
      const fallbackBaseUrl = String(args.storageDocFallback?.baseUrl || '').trim()
      if (fallbackWorkspaceId && fallbackBaseUrl) {
        const canonicalCandidates = readCanonicalPathCandidatesForSourcePath(sourcePathRaw)
        for (let c = 0; c < canonicalCandidates.length; c += 1) {
          const canonicalPath = String(canonicalCandidates[c] || '').trim()
          if (!canonicalPath) continue
          const docPath = `${KNOWGRPH_STORAGE_ROUTE_PATHS.docPrefix}${encodeURIComponent(fallbackWorkspaceId)}/${encodeURIComponent(canonicalPath)}`
          const requestUrl = buildKnowgrphStorageRequestUrl({ path: docPath, baseUrl: fallbackBaseUrl })
          if (!requestUrl) continue
          const hydrated = await readTextViaFetch(requestUrl)
          if (!hydrated) continue
          text = hydrated
          break
        }
      }
    }
    if (!text.trim()) continue

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

const normalizeSelectedFolderMirrorPath = (value: string): string => {
  const normalized = normalizeMirrorRelPath(value)
  if (!normalized) return ''
  const asFolder = (() => {
    const markdownLikeExt = /\.(md|markdown|mdx|mmd)$/i
    if (!markdownLikeExt.test(normalized)) return normalized
    const parts = normalized.split('/').filter(Boolean)
    if (parts.length <= 1) return ''
    return normalizeMirrorRelPath(parts.slice(0, -1).join('/'))
  })()
  const lower = asFolder.toLowerCase()
  const docsRootPrefix = 'huijoohwee/docs/'
  const docsRootIndex = lower.indexOf(docsRootPrefix)
  if (docsRootIndex >= 0) {
    return normalizeMirrorRelPath(asFolder.slice(docsRootIndex + docsRootPrefix.length))
  }
  if (lower === 'docs' || lower.endsWith('/docs')) return ''
  if (lower.startsWith('docs/')) return normalizeMirrorRelPath(asFolder.slice('docs/'.length))
  const parts = asFolder.split('/').filter(Boolean)
  let docsIndex = -1
  for (let i = 0; i < parts.length; i += 1) {
    if (String(parts[i] || '').toLowerCase() === 'docs') docsIndex = i
  }
  if (docsIndex >= 0) {
    return normalizeMirrorRelPath(parts.slice(docsIndex + 1).join('/'))
  }
  return asFolder
}

export type WorkspaceDocsMirrorEntry = {
  relPath: string
  text: string
  updatedAtMs: number
}

const readWorkspaceDocsMirrorDatasetScore = (entries: ReadonlyArray<WorkspaceDocsMirrorEntry>): number => {
  const list = Array.isArray(entries) ? entries : []
  if (list.length === 0) return 0
  let totalChars = 0
  for (let i = 0; i < list.length; i += 1) {
    totalChars += String(list[i]?.text || '').trim().length
  }
  return (list.length * 1_000_000) + totalChars
}

const chooseBestWorkspaceDocsMirrorDataset = (
  datasets: ReadonlyArray<ReadonlyArray<WorkspaceDocsMirrorEntry>>,
): WorkspaceDocsMirrorEntry[] => {
  let best: WorkspaceDocsMirrorEntry[] = []
  let bestScore = 0
  for (let i = 0; i < datasets.length; i += 1) {
    const candidate = Array.isArray(datasets[i]) ? datasets[i] as WorkspaceDocsMirrorEntry[] : []
    const score = readWorkspaceDocsMirrorDatasetScore(candidate)
    if (score > bestScore) {
      best = candidate
      bestScore = score
    }
  }
  return best
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
  const knowgrphStorageBaseUrl = readWorkspaceInitializationKnowgrphStorageBaseUrl()
  if (knowgrphStorageBaseUrl && sourceFilesSelection) {
    const workspaceId = buildKnowgrphWorkspaceIdFromSourceFilesWorkspaceState({
      folderName: sourceFilesSelection.folderName,
      accessMode: sourceFilesSelection.accessMode as 'fs-access' | 'opfs' | 'file-input' | null,
      folderCacheId: sourceFilesSelection.localMarkdownFolderCacheId,
      selectedFolderPath: sourceFilesSelection.selectedFolderPath || null,
    })
    if (workspaceId) {
      const storageDatasets: WorkspaceDocsMirrorEntry[][] = []
      const viaKnowgrphStorageDb = await readWorkspaceDocsMirrorEntriesFromKnowgrphStorageDbCache({
        workspaceId,
        selectedFolderPath: sourceFilesSelection.selectedFolderPath,
      })
      if (viaKnowgrphStorageDb.length > 0) storageDatasets.push(viaKnowgrphStorageDb)
      if (sourceFilesSelection.sourceFiles.length > 0) {
        const viaKnowgrphDocView = await readWorkspaceDocsMirrorEntriesFromKnowgrphStorageDocsBySourceFiles({
          baseUrl: knowgrphStorageBaseUrl,
          workspaceId,
          selectedFolderPath: sourceFilesSelection.selectedFolderPath,
          sourceFiles: sourceFilesSelection.sourceFiles,
        })
        if (viaKnowgrphDocView.length > 0) return viaKnowgrphDocView
      }
      const viaKnowgrphStorage = await readWorkspaceDocsMirrorEntriesFromKnowgrphStorageExport({
        baseUrl: knowgrphStorageBaseUrl,
        workspaceId,
        selectedFolderPath: sourceFilesSelection.selectedFolderPath,
      })
      if (viaKnowgrphStorage.length > 0) storageDatasets.push(viaKnowgrphStorage)
      const bestStorageDataset = chooseBestWorkspaceDocsMirrorDataset(storageDatasets)
      if (bestStorageDataset.length > 0) return bestStorageDataset
    }
  }
  if (sourceFilesSelection?.sourceFiles?.length) {
    const sourceFilesIncomplete = hasIncompleteSourceFilesMirrorText({
      sourceFiles: sourceFilesSelection.sourceFiles,
      selectedFolderPath: sourceFilesSelection.selectedFolderPath,
    })
    if (sourceFilesIncomplete) {
      const viaSourceFilesHydrated = await readWorkspaceDocsMirrorEntriesFromSourceFilesRecordsHydrated({
        sourceFiles: sourceFilesSelection.sourceFiles,
        selectedFolderPath: sourceFilesSelection.selectedFolderPath,
        storageDocFallback: workspaceId && knowgrphStorageBaseUrl
          ? { workspaceId, baseUrl: knowgrphStorageBaseUrl }
          : null,
      })
      if (viaSourceFilesHydrated.length > 0) return viaSourceFilesHydrated
    } else {
      const viaSourceFiles = readWorkspaceDocsMirrorEntriesFromSourceFilesRecords({
        sourceFiles: sourceFilesSelection.sourceFiles,
        selectedFolderPath: sourceFilesSelection.selectedFolderPath,
      })
      if (viaSourceFiles.length > 0) return viaSourceFiles
    }
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
  if (!knowgrphStorageBaseUrl) {
    const defaultSourceUrl = readWorkspaceImportDefaultSourceUrlSetting()
    if (defaultSourceUrl) {
      const viaUrl = await readWorkspaceDocsMirrorEntriesFromDefaultSourceUrl(defaultSourceUrl)
      if (viaUrl.length > 0) return viaUrl
    }
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
