import type { WorkspaceFs, WorkspacePath } from '@/features/workspace-fs/types'
import { WORKSPACE_ROOT_PATH, normalizeWorkspacePath } from '@/features/workspace-fs/path'
import { parseWebkitRelativePath } from '@/features/source-files/webkitRelativePath'
import { deriveFilenameFromUrl, isYouTubeUrl, normalizeGitHubBlobLikeUrl, unwrapUserProvidedText } from '@/lib/url'
import { fetchRemoteTextDetailed } from '@/lib/net/fetchRemoteText'
import { describeFetchRemoteTextFailure } from '@/lib/net/fetchRemoteTextFailure'
import { convertPdfUrlToMarkdown, fetchYouTubeTranscriptMarkdown, fetchWebpageMarkdown } from '@/lib/net/remoteMarkdownConversions'
import { useGraphStore } from '@/hooks/useGraphStore'
import { readPdfWorkspaceOutputDirRel } from '@/lib/pdf/pdfWorkspacePreferences'
import { fetchPdfWorkspaceDoc, importPdfToWorkspace } from '@/lib/pdf/pdfWorkspaceClient'
import type { WorkspaceEntrySource } from '@/features/workspace-fs/sourceIndex'
import { SOURCE_FILES_FORMATS } from '@/lib/config-copy/importExportCopy'
import { deriveMarkdownNameFromPdfFilename } from '@/features/toolbar/ingestUtils'
import { upsertWebpageFrontmatterMeta } from '@/lib/markdown/frontmatter'
import { sanitizeImportedMarkdownText } from '@/lib/markdown/sanitizeImportedMarkdown'
import { buildWebpageMarkdownArtifactDoc } from '@/lib/websites/webpageMarkdownArtifact'

export type WorkspaceImportResult = {
  createdPaths: WorkspacePath[]
  sources: Array<{ path: WorkspacePath; source: WorkspaceEntrySource }>
  skipped: Array<{ name: string; reason: 'unsupported' | 'missing-name' }>
  failed: Array<{ name: string; error: string }>
}

export type WorkspaceUrlContent = {
  normalizedUrl: string
  name: string
  text: string
}

export type WorkspaceImportProgress = {
  phase: 'listing' | 'fetching' | 'writing'
  current: number
  total?: number
  label?: string
}

function toFileArray(files: FileList | ReadonlyArray<File> | null): File[] {
  if (!files) return []
  try {
    return Array.from(files as ArrayLike<File>)
  } catch {
    return []
  }
}

function isPdfFile(file: File): boolean {
  const lower = String(file.name || '').toLowerCase()
  if (lower.endsWith('.pdf')) return true
  return file.type === 'application/pdf'
}

type PdfWorkspaceImportMode = 'text-only' | 'image-heavy' | 'scan-ocr'

function coercePdfWorkspaceImportMode(raw: unknown): PdfWorkspaceImportMode {
  return raw === 'image-heavy' ? 'image-heavy' : raw === 'scan-ocr' ? 'scan-ocr' : 'text-only'
}

function yamlQuote(value: string): string {
  return `"${String(value || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

function buildPdfWorkspaceFrontmatter(args: { docId: string; mode: PdfWorkspaceImportMode; outputDirRel: string }): string {
  return `---\nkgPdfWorkspaceDocId: ${yamlQuote(args.docId)}\nkgPdfWorkspaceMode: ${yamlQuote(args.mode)}\nkgPdfWorkspaceOutputDirRel: ${yamlQuote(args.outputDirRel)}\n---\n\n`
}

function stripEmbeddedBase64ImageSrc(raw: string): { text: string; changed: boolean } {
  const s = String(raw || '')
  const needle = 'data:image/'
  const base64Needle = ';base64,'
  let i = 0
  let changed = false
  let out = ''
  while (i < s.length) {
    const start = s.indexOf(needle, i)
    if (start < 0) {
      out += s.slice(i)
      break
    }
    const base64Pos = s.indexOf(base64Needle, start)
    if (base64Pos < 0) {
      out += s.slice(i)
      break
    }
    out += s.slice(i, start)

    const afterBase64 = base64Pos + base64Needle.length
    const maxScan = Math.min(s.length, afterBase64 + 2_000_000)
    let end = afterBase64
    for (; end < maxScan; end += 1) {
      const ch = s.charCodeAt(end)
      if (ch === 41 || ch === 34 || ch === 39 || ch === 32 || ch === 10 || ch === 13 || ch === 9) break
    }
    out += 'data:,'
    changed = true
    i = end
  }
  return { text: out, changed }
}

async function importPdfFile(args: { fs: WorkspaceFs; file: File; parentPath: WorkspacePath }): Promise<WorkspacePath> {
  const store = useGraphStore.getState()
  const mode = coercePdfWorkspaceImportMode((store as unknown as { pdfImportConversionMode?: unknown }).pdfImportConversionMode)
  const outputDirRel = readPdfWorkspaceOutputDirRel()
  const imported = await importPdfToWorkspace({ file: args.file, conversionMode: mode, outputDirRel })
  if (!imported) throw new Error('PDF import failed')
  if (imported.ok !== true) throw new Error(imported.error || 'PDF import failed')
  const fetched = await fetchPdfWorkspaceDoc({ docId: imported.docId, mode: imported.mode, outputDirRel })
  if (!fetched) throw new Error('PDF import failed')
  if (fetched.ok !== true) throw new Error(fetched.error || 'PDF import failed')
  const markdownRaw = String(fetched.markdown || '')
  const stripped = stripEmbeddedBase64ImageSrc(markdownRaw)
  const notice = stripped.changed ? `> Embedded base64 image data omitted for editor readability.\n\n` : ''
  const text = `${buildPdfWorkspaceFrontmatter({ docId: imported.docId, mode: imported.mode, outputDirRel })}${notice}${stripped.text}`
  return args.fs.createFile({ parentPath: args.parentPath, name: String(imported.name || 'document.md'), text })
}

async function importTextFile(args: { fs: WorkspaceFs; file: File; parentPath: WorkspacePath }): Promise<WorkspacePath> {
  const text = await args.file.text()
  return args.fs.createFile({ parentPath: args.parentPath, name: args.file.name, text })
}

type PendingLocalImportItem =
  | { kind: 'text'; file: File; originalName: string }
  | { kind: 'pdf'; file: File; originalName: string }

const pendingLocalImportsByPath = new Map<string, PendingLocalImportItem>()

const PENDING_LOCAL_IMPORT_MARKER = 'kg:pending-local-import'

function buildPendingLocalImportStub(args: { kind: PendingLocalImportItem['kind']; originalName: string }): string {
  const name = String(args.originalName || '').trim() || 'file'
  const kindLabel = args.kind === 'pdf' ? 'PDF' : 'file'
  return [
    `<!--${PENDING_LOCAL_IMPORT_MARKER}-->`,
    `> Pending local folder import (${kindLabel}).`,
    `> Re-import the folder if you reload before opening this ${kindLabel}.`,
    `> Original: ${name}`,
    '',
  ].join('\n')
}

export function peekPendingWorkspaceLocalImport(path: WorkspacePath): PendingLocalImportItem | null {
  const key = normalizeWorkspacePath(path)
  return pendingLocalImportsByPath.get(key) || null
}

export function isPendingLocalImportStubText(text: string): boolean {
  return String(text || '').includes(PENDING_LOCAL_IMPORT_MARKER)
}

export async function hydrateWorkspaceFileFromPendingLocalImport(args: {
  fs: WorkspaceFs
  path: WorkspacePath
}): Promise<{ kind: PendingLocalImportItem['kind']; text: string } | null> {
  const key = normalizeWorkspacePath(args.path)
  const pending = pendingLocalImportsByPath.get(key)
  if (!pending) return null
  try {
    if (pending.kind === 'pdf') {
      const store = useGraphStore.getState()
      const mode = coercePdfWorkspaceImportMode((store as unknown as { pdfImportConversionMode?: unknown }).pdfImportConversionMode)
      const outputDirRel = readPdfWorkspaceOutputDirRel()
      const imported = await importPdfToWorkspace({ file: pending.file, conversionMode: mode, outputDirRel })
      if (!imported) throw new Error('PDF import failed')
      if (imported.ok !== true) throw new Error(imported.error || 'PDF import failed')
      const fetched = await fetchPdfWorkspaceDoc({ docId: imported.docId, mode: imported.mode, outputDirRel })
      if (!fetched) throw new Error('PDF import failed')
      if (fetched.ok !== true) throw new Error(fetched.error || 'PDF import failed')
      const markdownRaw = String(fetched.markdown || '')
      const stripped = stripEmbeddedBase64ImageSrc(markdownRaw)
      const notice = stripped.changed ? `> Embedded base64 image data omitted for editor readability.\n\n` : ''
      const text = `${buildPdfWorkspaceFrontmatter({ docId: imported.docId, mode: imported.mode, outputDirRel })}${notice}${stripped.text}`
      await args.fs.writeFileText(key, text)
      pendingLocalImportsByPath.delete(key)
      return { kind: 'pdf', text }
    }

    const text = await pending.file.text()
    await args.fs.writeFileText(key, text)
    pendingLocalImportsByPath.delete(key)
    return { kind: 'text', text }
  } catch {
    return null
  }
}

const WORKSPACE_IMPORT_EXTS = (() => {
  const exts = new Set<string>()
  for (const ext of SOURCE_FILES_FORMATS.import) exts.add(String(ext || '').toLowerCase())
  exts.add('.mdx')
  return exts
})()

const WORKSPACE_GITHUB_IMPORT_TEXT_EXTS = (() => {
  const exts = new Set<string>()
  for (const ext of SOURCE_FILES_FORMATS.importLocalText) exts.add(String(ext || '').toLowerCase())
  exts.add('.mdx')
  return exts
})()

function isSupportedWorkspaceImportFile(file: File): boolean {
  const name = String(file.name || '').trim()
  if (!name) return false
  const lower = name.toLowerCase()
  const dot = lower.lastIndexOf('.')
  const ext = dot > 0 ? lower.slice(dot) : ''
  if (!ext || !ext.startsWith('.')) return false
  return WORKSPACE_IMPORT_EXTS.has(ext)
}

export async function importWorkspaceLocalFiles(args: {
  fs: WorkspaceFs
  files: FileList | ReadonlyArray<File> | null
  parentPath?: WorkspacePath
  onProgress?: (p: {
    label?: string
    current: number
    total: number
    name?: string
    bytesCurrent?: number
    bytesTotal?: number
  }) => void
}): Promise<WorkspaceImportResult> {
  const files = toFileArray(args.files)
  if (files.length === 0) return { createdPaths: [], sources: [], skipped: [], failed: [] }
  const parentPath = args.parentPath || WORKSPACE_ROOT_PATH
  const createdPaths: WorkspacePath[] = []
  const sources: Array<{ path: WorkspacePath; source: WorkspaceEntrySource }> = []
  const skipped: Array<{ name: string; reason: 'unsupported' | 'missing-name' }> = []
  const failed: Array<{ name: string; error: string }> = []

  const bytesTotal = files.reduce((sum, f) => sum + Math.max(0, Number(f?.size || 0)), 0)
  let bytesCurrent = 0

  for (let index = 0; index < files.length; index += 1) {
    const file = files[index]
    const nameRaw = String(file?.name || '').trim()
    const name = nameRaw || 'file'
    try {
      bytesCurrent += Math.max(0, Number(file?.size || 0))
      args.onProgress?.({
        label: isPdfFile(file) ? 'Converting PDF' : 'Importing',
        current: index + 1,
        total: files.length,
        name,
        bytesCurrent,
        bytesTotal,
      })
      await new Promise<void>(resolve => setTimeout(resolve, 0))
    } catch {
      void 0
    }

    if (!nameRaw) {
      skipped.push({ name: '', reason: 'missing-name' })
      continue
    }
    if (!isSupportedWorkspaceImportFile(file)) {
      skipped.push({ name: nameRaw, reason: 'unsupported' })
      continue
    }
    try {
      const createdPath = isPdfFile(file)
        ? await importPdfFile({ fs: args.fs, file, parentPath })
        : await importTextFile({ fs: args.fs, file, parentPath })
      const normalized = normalizeWorkspacePath(createdPath)
      createdPaths.push(normalized)
      sources.push({ path: normalized, source: { kind: 'local', originalName: file.name } })
    } catch (e) {
      failed.push({ name: nameRaw, error: String((e as { message?: unknown })?.message ?? e) })
    }
  }

  return { createdPaths, sources, skipped, failed }
}

export async function importWorkspaceLocalFolder(args: {
  fs: WorkspaceFs
  files: FileList | ReadonlyArray<File> | null
  onProgress?: (p: {
    label?: string
    current: number
    total: number
    name?: string
    bytesCurrent?: number
    bytesTotal?: number
  }) => void
}): Promise<WorkspaceImportResult> {
  const list = toFileArray(args.files)
  if (list.length === 0) return { createdPaths: [], sources: [], skipped: [], failed: [] }
  const folderMap = new Map<string, WorkspacePath>()
  const createdPaths: WorkspacePath[] = []
  const sources: Array<{ path: WorkspacePath; source: WorkspaceEntrySource }> = []
  const skipped: Array<{ name: string; reason: 'unsupported' | 'missing-name' }> = []
  const failed: Array<{ name: string; error: string }> = []

  const ensureFolder = async (parent: WorkspacePath, name: string, key: string) => {
    const existing = folderMap.get(key)
    if (existing) return existing
    const created = await args.fs.createFolder({ parentPath: parent, name })
    const normalized = normalizeWorkspacePath(created)
    folderMap.set(key, normalized)
    return normalized
  }

  for (let index = 0; index < list.length; index += 1) {
    const file = list[index]
    const nameRaw = String(file?.name || '').trim()
    if (index % 25 === 0) {
      try {
        await new Promise<void>(resolve => setTimeout(resolve, 0))
      } catch {
        void 0
      }
    }

    if (!nameRaw) {
      skipped.push({ name: '', reason: 'missing-name' })
      continue
    }
    if (!isSupportedWorkspaceImportFile(file)) {
      skipped.push({ name: nameRaw, reason: 'unsupported' })
      continue
    }
    const rel = String((file as unknown as { webkitRelativePath?: unknown }).webkitRelativePath || '').trim()
    const parsed = parseWebkitRelativePath(rel, file.name)
    const parts = parsed.folderName
      ? [parsed.folderName, ...String(parsed.rawRelativePath || '').split('/').filter(Boolean)]
      : String(parsed.rawRelativePath || '').split('/').filter(Boolean)
    if (parts.length === 0) continue
    let parentPath: WorkspacePath = WORKSPACE_ROOT_PATH
    let relKey = ''
    for (let i = 0; i < parts.length - 1; i += 1) {
      const seg = String(parts[i] || '').trim()
      if (!seg) continue
      relKey = relKey ? `${relKey}/${seg}` : seg
      parentPath = await ensureFolder(parentPath, seg, relKey)
    }
    try {
      const isPdf = isPdfFile(file)
      const leafName = isPdf ? deriveMarkdownNameFromPdfFilename(file.name) : parts[parts.length - 1] || file.name
      const stub = buildPendingLocalImportStub({ kind: isPdf ? 'pdf' : 'text', originalName: file.name })
      const createdPath = await args.fs.createFile({ parentPath, name: leafName, text: stub })
      const normalized = normalizeWorkspacePath(createdPath)
      createdPaths.push(normalized)
      sources.push({ path: normalized, source: { kind: 'local', originalName: file.name } })
      pendingLocalImportsByPath.set(normalized, {
        kind: isPdf ? 'pdf' : 'text',
        file,
        originalName: file.name,
      })
    } catch (e) {
      failed.push({ name: nameRaw, error: String((e as { message?: unknown })?.message ?? e) })
    }
  }

  return { createdPaths, sources, skipped, failed }
}

export async function fetchWorkspaceUrlContent(urlRaw: string): Promise<WorkspaceUrlContent> {
  const rawUrl = unwrapUserProvidedText(String(urlRaw || '').trim()) || String(urlRaw || '').trim()
  if (!rawUrl) throw new Error('Missing URL')

  const normalizedUrl = normalizeGitHubBlobLikeUrl(rawUrl) || rawUrl
  const normalizedLower = normalizedUrl.toLowerCase()

  const isPdf = /\.pdf(\?|#|$)/i.test(normalizedUrl)
  if (isYouTubeUrl(normalizedUrl)) {
    const converted = await fetchYouTubeTranscriptMarkdown(normalizedUrl)
    if (!converted) throw new Error('YouTube import failed')
    if (converted.ok === false) throw new Error(converted.error || 'YouTube import failed')
    return {
      normalizedUrl,
      name: String(converted.name || 'youtube-transcript.md'),
      text: String(converted.markdown || ''),
    }
  }

  if (isPdf) {
    const converted = await convertPdfUrlToMarkdown(normalizedUrl)
    if (!converted) throw new Error('PDF import failed')
    if (converted.ok === false) throw new Error(converted.error || 'PDF import failed')
    return {
      normalizedUrl,
      name: String(converted.name || 'document.md'),
      text: String(converted.markdown || ''),
    }
  }

  const looksLikeCodeOrData = /\.(json|jsonld|geojson|csv|yaml|yml|txt|js|ts|py|md|markdown|mdx)(\?|#|$)/i.test(normalizedLower)
  if (!looksLikeCodeOrData) {
    const includeImages = useGraphStore.getState().webpageImportIncludeImages ?? true
    const view = (() => {
      const v = useGraphStore.getState().webpageImportView
      if (v === 'html') return 'html'
      if (v === 'json') return 'json'
      return 'markdown'
    })()

    const outputDirRel = String(useGraphStore.getState().websiteImportOutputDirRel || '').trim()
    try {
      const startRes = await fetch(`/__website_import/import-url?outputDirRel=${encodeURIComponent(outputDirRel)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ url: normalizedUrl, options: { includeImages } }),
      })
      const startJson = (await startRes.json()) as { ok?: unknown; importId?: unknown; nodeId?: unknown; url?: unknown; error?: unknown }
      if (startRes.ok && startJson.ok === true && typeof startJson.importId === 'string' && typeof startJson.nodeId === 'string') {
        const importId = startJson.importId
        const nodeId = startJson.nodeId
        const mdRes = await fetch(
          `/__website_import/artifact?outputDirRel=${encodeURIComponent(outputDirRel)}&importId=${encodeURIComponent(importId)}&nodeId=${encodeURIComponent(nodeId)}&kind=markdown`,
          { headers: { Accept: 'text/plain' } },
        )
        const mdRaw = await mdRes.text()
        const markdownBody = sanitizeImportedMarkdownText(mdRaw).text
        const stripped = (() => {
          const t = String(markdownBody || '')
          if (!t.startsWith('---')) return t
          const end = t.indexOf('\n---')
          if (end < 0) return t
          return t.slice(end + 4).replace(/^\s*\n/, '')
        })()

        const urlLine = `kgWebpageUrl: ${yamlQuote(normalizedUrl)}`
        const viewLine = `kgWebpageView: ${yamlQuote(view)}`
        const importLine = `kgWebsiteImportId: ${yamlQuote(importId)}`
        const nodeLine = `kgWebsiteNodeId: ${yamlQuote(nodeId)}`
        const outputDirLine = outputDirRel && outputDirRel.trim() ? `kgWebsiteOutputDirRel: ${yamlQuote(outputDirRel.trim())}` : ''
        const fmLines = ['---', urlLine, viewLine, importLine, nodeLine]
        if (outputDirLine) fmLines.push(outputDirLine)
        fmLines.push('---', '')
        const artifact = buildWebpageMarkdownArtifactDoc({ markdown: stripped, url: normalizedUrl })
        const artifactWithView = upsertWebpageFrontmatterMeta(artifact, { url: normalizedUrl, view })
        const strippedArtifact = (() => {
          const t = String(artifactWithView || '')
          if (!t.startsWith('---')) return t
          const end = t.indexOf('\n---')
          if (end < 0) return t
          return t.slice(end + 4).replace(/^\s*\n/, '')
        })()
        const text = [...fmLines, strippedArtifact].join('\n')

        const base = deriveFilenameFromUrl(normalizedUrl, 'webpage')
        const baseNoExt = base.replace(/\.[a-z0-9]+$/i, '') || 'webpage'
        const name = `${baseNoExt}.md`
        return { normalizedUrl, name, text }
      }
      const err = typeof startJson.error === 'string' && startJson.error.trim() ? startJson.error.trim() : `HTTP ${startRes.status}`
      void err
    } catch {
      void 0
    }

    const webpage = await fetchWebpageMarkdown(normalizedUrl, { includeImages })
    if (webpage && webpage.ok) {
      const sanitized = sanitizeImportedMarkdownText(String(webpage.markdown || '')).text
      const content = upsertWebpageFrontmatterMeta(sanitized, { url: normalizedUrl, view })
      return { normalizedUrl, name: String(webpage.name || 'webpage.md'), text: content }
    }
  }

  const res = await fetchRemoteTextDetailed(normalizedUrl, { preflightHead: true, preferProxy: true })
  if (!res.ok) throw new Error(describeFetchRemoteTextFailure(res as import('grph-shared/net/fetchRemoteText').FetchRemoteTextFailure))
  const text = res.text

  const fallbackExt = (() => {
    if (normalizedLower.endsWith('.md') || normalizedLower.endsWith('.markdown') || normalizedLower.endsWith('.mdx')) return '.md'
    if (normalizedLower.endsWith('.json') || normalizedLower.endsWith('.jsonld') || normalizedLower.endsWith('.geojson')) return '.json'
    if (normalizedLower.endsWith('.csv')) return '.csv'
    if (normalizedLower.endsWith('.yaml') || normalizedLower.endsWith('.yml')) return '.yaml'
    if (normalizedLower.endsWith('.html') || normalizedLower.endsWith('.htm')) return '.html'
    return '.txt'
  })()

  const fallback = `import${fallbackExt}`
  const derived = deriveFilenameFromUrl(normalizedUrl, fallback)
  const name = derived.includes('.') ? derived : `${derived}${fallbackExt}`
  return { normalizedUrl, name, text }
}

type GitHubRepoRef = {
  owner: string
  repo: string
  ref: string | null
  subdirPath: string
}

const parseGitHubRepoUrl = (urlRaw: string): GitHubRepoRef | null => {
  try {
    const url = new URL(urlRaw)
    if (url.hostname !== 'github.com') return null
    const parts = url.pathname.split('/').filter(Boolean)
    const owner = String(parts[0] || '').trim()
    const repo = String(parts[1] || '').trim()
    if (!owner || !repo) return null
    if (parts[2] === 'tree') {
      const ref = String(parts[3] || '').trim()
      if (!ref) return null
      const subdirPath = parts.slice(4).join('/')
      return { owner, repo, ref, subdirPath }
    }
    if (parts.length === 2) {
      return { owner, repo, ref: null, subdirPath: '' }
    }
    return null
  } catch {
    return null
  }
}

const encodeGitHubContentsPath = (path: string) => {
  const trimmed = String(path || '').replace(/^\/+/, '').replace(/\/+$/, '')
  if (!trimmed) return ''
  return trimmed
    .split('/')
    .filter(Boolean)
    .map(seg => encodeURIComponent(seg))
    .join('/')
}

const fetchJson = async <T,>(url: string): Promise<T> => {
  const res = await fetchRemoteTextDetailed(url, { preferProxy: true, preflightHead: false, maxBytes: 2_000_000 })
  if (!res.ok) {
    throw new Error(describeFetchRemoteTextFailure(res as import('grph-shared/net/fetchRemoteText').FetchRemoteTextFailure))
  }
  try {
    return JSON.parse(res.text) as T
  } catch {
    throw new Error('Invalid JSON response')
  }
}

const resolveGitHubDefaultBranch = async (args: { owner: string; repo: string }): Promise<string> => {
  const url = `https://api.github.com/repos/${encodeURIComponent(args.owner)}/${encodeURIComponent(args.repo)}`
  const json = await fetchJson<{ default_branch?: unknown }>(url)
  const branch = typeof json.default_branch === 'string' ? json.default_branch.trim() : ''
  return branch || 'main'
}

type GitHubContentItem = {
  type: 'file' | 'dir' | string
  path?: unknown
  name?: unknown
  download_url?: unknown
  url?: unknown
}

const listGitHubFolderContents = async (args: { owner: string; repo: string; ref: string; folderPath: string }) => {
  const encodedPath = encodeGitHubContentsPath(args.folderPath)
  const pathPart = encodedPath ? `/${encodedPath}` : ''
  const url = `https://api.github.com/repos/${encodeURIComponent(args.owner)}/${encodeURIComponent(args.repo)}/contents${pathPart}?ref=${encodeURIComponent(args.ref)}`
  const json = await fetchJson<unknown>(url)
  if (!Array.isArray(json)) return []
  return json as GitHubContentItem[]
}

const isProbablyTextFile = (path: string) => {
  const lower = String(path || '').toLowerCase().trim()
  const dot = lower.lastIndexOf('.')
  const ext = dot > 0 ? lower.slice(dot) : ''
  if (!ext) return false
  return WORKSPACE_GITHUB_IMPORT_TEXT_EXTS.has(ext)
}

async function importGitHubFolder(args: {
  fs: WorkspaceFs
  repoRef: GitHubRepoRef
  parentPath: WorkspacePath
  onProgress?: (p: WorkspaceImportProgress) => void
  maxFiles?: number
}) : Promise<WorkspaceImportResult> {
  const maxFiles = typeof args.maxFiles === 'number' && Number.isFinite(args.maxFiles) && args.maxFiles > 0 ? Math.floor(args.maxFiles) : 120
  const ref = args.repoRef.ref || (await resolveGitHubDefaultBranch({ owner: args.repoRef.owner, repo: args.repoRef.repo }))

  const rootFolderName = String(args.repoRef.repo || 'repo').replace(/\.git$/i, '') || 'repo'
  const rootFolderPath = await args.fs.createFolder({ parentPath: args.parentPath, name: rootFolderName })

  const folderQueue: string[] = [String(args.repoRef.subdirPath || '').replace(/^\/+/, '')]
  const filesToFetch: Array<{ relPath: string; downloadUrl: string }> = []

  let listed = 0
  while (folderQueue.length > 0) {
    const folderPath = folderQueue.shift() || ''
    args.onProgress?.({ phase: 'listing', current: listed, label: folderPath ? `Listing ${folderPath}` : 'Listing repo' })
    const children = await listGitHubFolderContents({ owner: args.repoRef.owner, repo: args.repoRef.repo, ref, folderPath })
    listed += 1

    for (const item of children) {
      const type = String(item.type || '').trim()
      const relPath = typeof item.path === 'string' ? String(item.path) : ''
      if (!relPath) continue
      if (type === 'dir') {
        folderQueue.push(relPath)
        continue
      }
      if (type !== 'file') continue
      const downloadUrl = typeof item.download_url === 'string' ? String(item.download_url) : ''
      if (!downloadUrl) continue
      if (!isProbablyTextFile(relPath)) continue
      filesToFetch.push({ relPath, downloadUrl })
      if (filesToFetch.length >= maxFiles) break
    }
    if (filesToFetch.length >= maxFiles) break
  }

  const createdPaths: WorkspacePath[] = []
  const sources: Array<{ path: WorkspacePath; source: WorkspaceEntrySource }> = []
  const folderMap = new Map<string, WorkspacePath>()

  const ensureFolder = async (parent: WorkspacePath, name: string, key: string) => {
    const existing = folderMap.get(key)
    if (existing) return existing
    const created = await args.fs.createFolder({ parentPath: parent, name })
    folderMap.set(key, created)
    return created
  }

  const totalFiles = filesToFetch.length
  for (let i = 0; i < filesToFetch.length; i += 1) {
    const file = filesToFetch[i]
    args.onProgress?.({ phase: 'fetching', current: i + 1, total: totalFiles, label: `Fetching ${file.relPath}` })
    const fetched = await fetchRemoteTextDetailed(file.downloadUrl, { preflightHead: true, preferProxy: true })
    if (!fetched.ok) {
      throw new Error(describeFetchRemoteTextFailure(fetched as import('grph-shared/net/fetchRemoteText').FetchRemoteTextFailure))
    }

    const segments = String(file.relPath || '').split('/').filter(Boolean)
    if (segments.length === 0) continue
    let parentFolder: WorkspacePath = rootFolderPath
    let relKey = ''
    for (let si = 0; si < segments.length - 1; si += 1) {
      const seg = String(segments[si] || '').trim()
      if (!seg) continue
      relKey = relKey ? `${relKey}/${seg}` : seg
      parentFolder = await ensureFolder(parentFolder, seg, relKey)
    }

    args.onProgress?.({ phase: 'writing', current: i + 1, total: totalFiles, label: `Writing ${file.relPath}` })
    const createdPath = await args.fs.createFile({ parentPath: parentFolder, name: segments[segments.length - 1] || 'file.txt', text: fetched.text })
    createdPaths.push(normalizeWorkspacePath(createdPath))
    sources.push({ path: normalizeWorkspacePath(createdPath), source: { kind: 'url', url: file.downloadUrl } })
  }

  return { createdPaths, sources, skipped: [], failed: [] }
}

export async function importWorkspaceUrl(args: {
  fs: WorkspaceFs
  urlRaw: string
  parentPath?: WorkspacePath
  onProgress?: (p: WorkspaceImportProgress) => void
}): Promise<WorkspaceImportResult> {
  const rawUrl = String(args.urlRaw || '').trim()
  if (!rawUrl) return { createdPaths: [], sources: [], skipped: [], failed: [] }
  const parentPath = args.parentPath || WORKSPACE_ROOT_PATH

  const repoRef = parseGitHubRepoUrl(rawUrl)
  if (repoRef) {
    return importGitHubFolder({ fs: args.fs, repoRef, parentPath, onProgress: args.onProgress })
  }

  const fetched = await fetchWorkspaceUrlContent(rawUrl)
  const createdPath = await args.fs.createFile({ parentPath, name: fetched.name, text: fetched.text })
  const normalized = normalizeWorkspacePath(createdPath)
  return {
    createdPaths: [normalized],
    sources: [{ path: normalized, source: { kind: 'url', url: fetched.normalizedUrl } }],
    skipped: [],
    failed: [],
  }
}
