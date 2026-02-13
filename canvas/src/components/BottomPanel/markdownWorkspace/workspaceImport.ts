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
import { renderTemplateGalleryGridTwoRows } from '@/lib/websites/webpageMarkdownArtifactAscii'

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
        const text = buildWebpageWorkspaceEntryTextFromUpstreamMarkdown({
          upstreamMarkdown: mdRaw,
          url: normalizedUrl,
          view,
          websiteImportMeta: { importId, nodeId, outputDirRel: outputDirRel || undefined },
        })

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

export function buildWebpageWorkspaceEntryTextFromUpstreamMarkdown(args: {
  upstreamMarkdown: string
  url: string
  view: 'markdown' | 'json' | 'html'
  title?: string
  websiteImportMeta?: { importId: string; nodeId: string; outputDirRel?: string } | null
}): string {
  const url = String(args.url || '').trim()
  const view = args.view === 'html' ? 'html' : args.view === 'json' ? 'json' : 'markdown'
  const upstreamSanitized = sanitizeImportedMarkdownText(String(args.upstreamMarkdown || '')).text
  const strippedUpstream = (() => {
    const t = String(upstreamSanitized || '')
    if (!t.startsWith('---')) return t
    const end = t.indexOf('\n---')
    if (end < 0) return t
    return t.slice(end + 4).replace(/^\s*\n/, '')
  })()

  const urlLine = `kgWebpageUrl: ${yamlQuote(url)}`
  const viewLine = `kgWebpageView: ${yamlQuote(view)}`
  const fmLines = ['---', urlLine, viewLine]

  const importId = String(args.websiteImportMeta?.importId || '').trim()
  const nodeId = String(args.websiteImportMeta?.nodeId || '').trim()
  const outputDirRel = String(args.websiteImportMeta?.outputDirRel || '').trim()
  if (importId) fmLines.push(`kgWebsiteImportId: ${yamlQuote(importId)}`)
  if (nodeId) fmLines.push(`kgWebsiteNodeId: ${yamlQuote(nodeId)}`)
  if (outputDirRel) fmLines.push(`kgWebsiteOutputDirRel: ${yamlQuote(outputDirRel)}`)
  fmLines.push('---', '')

  const artifact = buildWebpageMarkdownArtifactDoc({ markdown: strippedUpstream, url, title: args.title })
  const artifactWithView = upsertWebpageFrontmatterMeta(artifact, { url, view })
  const strippedArtifact = (() => {
    const t = String(artifactWithView || '')
    if (!t.startsWith('---')) return t
    const end = t.indexOf('\n---')
    if (end < 0) return t
    return t.slice(end + 4).replace(/^\s*\n/, '')
  })()
  return [...fmLines, strippedArtifact].join('\n')
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

const fetchGitHubRepoMeta = async (args: { owner: string; repo: string }): Promise<GitHubRepoMeta> => {
  const url = `https://api.github.com/repos/${encodeURIComponent(args.owner)}/${encodeURIComponent(args.repo)}`
  const json = await fetchJson<GitHubRepoMeta>(url)
  return json && typeof json === 'object' ? json : {}
}

type GitHubRefResponse = { object?: { sha?: unknown } }
type GitHubCommitResponse = { tree?: { sha?: unknown } }
type GitHubTreeEntry = { path?: unknown; type?: unknown; size?: unknown }
type GitHubTreeResponse = { tree?: unknown; truncated?: unknown }

type GitHubRepoMeta = {
  name?: unknown
  full_name?: unknown
  description?: unknown
  license?: unknown
  stargazers_count?: unknown
  forks_count?: unknown
  updated_at?: unknown
  default_branch?: unknown
}

const isProbablyTextFile = (path: string) => {
  const lower = String(path || '').toLowerCase().trim()
  const dot = lower.lastIndexOf('.')
  const ext = dot > 0 ? lower.slice(dot) : ''
  if (!ext) return false
  return WORKSPACE_GITHUB_IMPORT_TEXT_EXTS.has(ext)
}

const normalizeRepoRelPathPrefix = (raw: string): string => {
  const s = String(raw || '')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')
  return s
}

const buildGitHubRawFileUrl = (args: { owner: string; repo: string; ref: string; relPath: string }): string => {
  const owner = encodeURIComponent(args.owner)
  const repo = encodeURIComponent(args.repo)
  const ref = encodeURIComponent(args.ref)
  const rel = normalizeRepoRelPathPrefix(args.relPath)
    .split('/')
    .filter(Boolean)
    .map(seg => encodeURIComponent(seg))
    .join('/')
  return `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${rel}`
}

const resolveGitHubTreeSha = async (args: { owner: string; repo: string; ref: string }): Promise<string> => {
  const base = `https://api.github.com/repos/${encodeURIComponent(args.owner)}/${encodeURIComponent(args.repo)}`
  const refJson = await fetchJson<GitHubRefResponse>(`${base}/git/refs/heads/${encodeURIComponent(args.ref)}`)
  const commitSha = typeof refJson.object?.sha === 'string' ? refJson.object.sha.trim() : ''
  if (!commitSha) throw new Error('GitHub ref sha missing')
  const commitJson = await fetchJson<GitHubCommitResponse>(`${base}/git/commits/${encodeURIComponent(commitSha)}`)
  const treeSha = typeof commitJson.tree?.sha === 'string' ? commitJson.tree.sha.trim() : ''
  if (!treeSha) throw new Error('GitHub tree sha missing')
  return treeSha
}

const listGitHubRepoTreeFiles = async (args: {
  owner: string
  repo: string
  ref: string
  subdirPath: string
  maxFiles: number
}): Promise<{ files: Array<{ relPath: string; rawUrl: string }>; totalEligible: number; allPaths: string[]; treeTruncated: boolean }> => {
  const base = `https://api.github.com/repos/${encodeURIComponent(args.owner)}/${encodeURIComponent(args.repo)}`
  const treeSha = await resolveGitHubTreeSha({ owner: args.owner, repo: args.repo, ref: args.ref })
  const treeJson = await fetchJson<GitHubTreeResponse>(`${base}/git/trees/${encodeURIComponent(treeSha)}?recursive=1`)
  const entries = Array.isArray(treeJson.tree) ? (treeJson.tree as GitHubTreeEntry[]) : []
  const treeTruncated = treeJson.truncated === true

  const prefix = normalizeRepoRelPathPrefix(args.subdirPath)
  const prefixWithSlash = prefix ? `${prefix}/` : ''
  const files: Array<{ relPath: string; rawUrl: string }> = []
  let totalEligible = 0

  const allPaths: string[] = []
  for (const e of entries) {
    const relPath = typeof e.path === 'string' ? String(e.path) : ''
    if (!relPath) continue
    if (prefix && relPath !== prefix && !relPath.startsWith(prefixWithSlash)) continue
    allPaths.push(relPath)
    if (allPaths.length >= 6_000) break
  }

  for (const e of entries) {
    const type = String(e.type || '').trim()
    if (type !== 'blob') continue
    const relPath = typeof e.path === 'string' ? String(e.path) : ''
    if (!relPath) continue
    if (prefix && relPath !== prefix && !relPath.startsWith(prefixWithSlash)) continue
    if (!isProbablyTextFile(relPath)) continue
    totalEligible += 1
    const rawUrl = buildGitHubRawFileUrl({ owner: args.owner, repo: args.repo, ref: args.ref, relPath })
    if (files.length < args.maxFiles) files.push({ relPath, rawUrl })
  }

  return { files, totalEligible, allPaths, treeTruncated }
}

const formatK = (n: number) => {
  if (!Number.isFinite(n) || n < 0) return ''
  if (n >= 100_000) return `${Math.round(n / 1000)}k`
  if (n >= 10_000) return `${(n / 1000).toFixed(1)}k`
  return String(Math.round(n))
}

const formatIsoDateMonthYear = (iso: string) => {
  const s = String(iso || '').trim()
  if (!s) return ''
  const d = new Date(s)
  if (!Number.isFinite(d.getTime())) return ''
  return d.toLocaleString('en-US', { month: 'long', year: 'numeric' })
}

type RepoTreeNode = { kind: 'folder' | 'file'; name: string; children?: Map<string, RepoTreeNode> }

const buildRepoTree = (paths: string[]) => {
  const root: RepoTreeNode = { kind: 'folder', name: '', children: new Map() }
  for (const p of paths) {
    const segs = String(p || '')
      .split('/')
      .map(s => s.trim())
      .filter(Boolean)
    if (!segs.length) continue
    let cur = root
    for (let i = 0; i < segs.length; i += 1) {
      const name = segs[i]
      const isLeaf = i === segs.length - 1
      const nextKind: RepoTreeNode['kind'] = isLeaf ? 'file' : 'folder'
      const children = cur.children || new Map<string, RepoTreeNode>()
      cur.children = children
      const existing = children.get(name)
      if (existing) {
        cur = existing
        continue
      }
      const node: RepoTreeNode = nextKind === 'folder' ? { kind: 'folder', name, children: new Map() } : { kind: 'file', name }
      children.set(name, node)
      cur = node
    }
  }
  return root
}

const renderRepoTreeAscii = (args: { rootName: string; paths: string[]; maxDepth: number; maxChildrenPerFolder: number }) => {
  const tree = buildRepoTree(args.paths)
  const lines: string[] = []
  lines.push(`${args.rootName}/`)
  const walk = (node: RepoTreeNode, prefix: string, depth: number) => {
    if (!node.children || depth >= args.maxDepth) return
    const entries = [...node.children.values()].sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'folder' ? -1 : 1
      return a.name.localeCompare(b.name)
    })
    const shown = entries.slice(0, args.maxChildrenPerFolder)
    for (let i = 0; i < shown.length; i += 1) {
      const child = shown[i]
      const isLast = i === shown.length - 1
      const branch = isLast ? '└── ' : '├── '
      lines.push(`${prefix}${branch}${child.name}${child.kind === 'folder' ? '/' : ''}`)
      const nextPrefix = `${prefix}${isLast ? '    ' : '│   '}`
      if (child.kind === 'folder') walk(child, nextPrefix, depth + 1)
    }
    if (entries.length > shown.length) {
      const branch = '└── '
      lines.push(`${prefix}${branch}… (${entries.length - shown.length} more)`) 
    }
  }
  walk(tree, '', 0)
  return lines.join('\n')
}

const filterToLikelyFilePaths = (paths: string[]): string[] => {
  const cleaned = paths
    .map(p => String(p || '').replace(/^\/+/, '').replace(/\/+$/, ''))
    .filter(Boolean)
  const sorted = [...new Set(cleaned)].sort((a, b) => a.localeCompare(b))
  const out: string[] = []
  for (let i = 0; i < sorted.length; i += 1) {
    const p = sorted[i]
    const next = sorted[i + 1] || ''
    if (next && next.startsWith(`${p}/`)) continue
    out.push(p)
  }
  return out
}

const extractRepoReadmeFeatureGroups = (markdown: string) => {
  const clean = String(markdown || '')
  const lines = clean.split(/\r?\n/)
  const groups: Array<{ title: string; items: string[] }> = []
  let curTitle = ''
  let curItems: string[] = []
  const flush = () => {
    const title = curTitle.trim()
    const items = curItems.map(s => s.trim()).filter(Boolean)
    if (title && items.length >= 4) groups.push({ title, items })
    curTitle = ''
    curItems = []
  }
  for (const raw of lines) {
    const h = raw.match(/^\s{0,3}#{2,4}\s+(.+?)\s*$/)
    if (h) {
      flush()
      curTitle = String(h[1] || '').replace(/\s*\(.*?\)\s*$/, '').trim()
      continue
    }
    const li = raw.match(/^\s{0,3}[-*+]\s+(.+?)\s*$/)
    if (li && curTitle) {
      const item = String(li[1] || '').replace(/\s+\[[^\]]*\]\([^\)]*\)\s*$/, '').trim()
      if (item) curItems.push(item)
      continue
    }
    if (curTitle && !raw.trim()) {
      // allow blank lines
      continue
    }
  }
  flush()
  return groups
}

const buildTemplateGridFromGroups = (groups: Array<{ title: string; items: string[] }>) => {
  const picked: string[] = []
  for (const g of groups) {
    if (picked.length >= 12) break
    for (const it of g.items) {
      const name = String(it || '').replace(/\s*\(.*?\)\s*$/, '').trim()
      if (!name) continue
      if (picked.some(x => x.toLowerCase() === name.toLowerCase())) continue
      picked.push(name)
      if (picked.length >= 12) break
    }
  }
  return picked
}

const extractPythonOutline = (python: string, maxItems: number) => {
  const lines = String(python || '').split(/\r?\n/)
  const defs: string[] = []
  const imports: string[] = []
  for (const l of lines) {
    const imp = l.match(/^\s*(?:from\s+([a-zA-Z0-9_.]+)\s+import\s+|import\s+([a-zA-Z0-9_.]+))/)
    if (imp) {
      const mod = String(imp[1] || imp[2] || '').trim()
      if (mod && !imports.some(x => x === mod)) imports.push(mod)
      continue
    }
    const d = l.match(/^def\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/)
    if (d) {
      const name = String(d[1] || '').trim()
      if (name && !defs.includes(name)) defs.push(name)
      if (defs.length >= maxItems) break
    }
  }
  return { defs, imports: imports.slice(0, Math.max(6, Math.min(24, maxItems * 2))) }
}

const extractPythonStructuredOutline = (python: string, limits: { maxTopLevelDefs: number; maxClasses: number; maxMethodsPerClass: number; maxImports: number }) => {
  const lines = String(python || '').split(/\r?\n/)
  const topLevelDefs: Array<{ name: string; args: string }> = []
  const classes: Array<{ name: string; methods: Array<{ name: string; args: string }> }> = []
  const imports: string[] = []

  let currentClass: { name: string; methods: Array<{ name: string; args: string }> } | null = null
  let currentClassIndent = 0

  const pushClass = () => {
    if (!currentClass) return
    if (classes.length >= limits.maxClasses) {
      currentClass = null
      currentClassIndent = 0
      return
    }
    classes.push(currentClass)
    currentClass = null
    currentClassIndent = 0
  }

  for (const raw of lines) {
    const line = String(raw || '')

    const imp = line.match(/^\s*(?:from\s+([a-zA-Z0-9_.]+)\s+import\s+|import\s+([a-zA-Z0-9_.]+))/)
    if (imp) {
      const mod = String(imp[1] || imp[2] || '').trim()
      if (mod && !imports.includes(mod)) imports.push(mod)
      continue
    }

    const classMatch = line.match(/^(\s*)class\s+([A-Za-z_][A-Za-z0-9_]*)\b/)
    if (classMatch) {
      pushClass()
      if (classes.length >= limits.maxClasses) continue
      currentClassIndent = (classMatch[1] || '').length
      currentClass = { name: String(classMatch[2] || '').trim(), methods: [] }
      continue
    }

    const defMatch = line.match(/^(\s*)def\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)/)
    if (defMatch) {
      const indent = (defMatch[1] || '').length
      const name = String(defMatch[2] || '').trim()
      const args = String(defMatch[3] || '').trim()
      if (!name) continue

      if (currentClass && indent > currentClassIndent) {
        if (currentClass.methods.length < limits.maxMethodsPerClass) {
          if (!currentClass.methods.some(m => m.name === name)) currentClass.methods.push({ name, args })
        }
        continue
      }

      if (currentClass && indent <= currentClassIndent) pushClass()
      if (topLevelDefs.length < limits.maxTopLevelDefs) {
        if (!topLevelDefs.some(d => d.name === name)) topLevelDefs.push({ name, args })
      }
      continue
    }

    if (currentClass) {
      const trimmed = line.trim()
      if (!trimmed) continue
      if (/^#/.test(trimmed)) continue
      const indent = line.match(/^(\s*)/)?.[1]?.length ?? 0
      if (indent <= currentClassIndent) pushClass()
    }
  }
  pushClass()

  return { topLevelDefs, classes, imports: imports.slice(0, Math.max(0, limits.maxImports)) }
}

const extractGpuTypesFromReadme = (markdown: string) => {
  const m = String(markdown || '').match(/GPU\s+types\s*\(([^)]+)\)/i)
  if (!m) return []
  return String(m[1] || '')
    .split(',')
    .map(x => x.trim())
    .filter(Boolean)
}

const detectSupportedPlatformsFromReadme = (markdown: string) => {
  const t = String(markdown || '')
  const out: string[] = []
  const add = (name: string) => {
    if (!out.some(x => x.toLowerCase() === name.toLowerCase())) out.push(name)
  }
  if (/\bWindows\b/i.test(t)) add('Windows')
  if (/\bmacOS\b/i.test(t)) add('macOS')
  if (/\bLinux\b/i.test(t)) add('Linux')
  return out
}

const extractReadmeSectionBlock = (markdown: string, heading: string, maxChars: number) => {
  const text = String(markdown || '')
  const lines = text.split(/\r?\n/)
  const needle = String(heading || '').trim().toLowerCase()
  if (!needle) return ''
  let startIdx = -1
  let startLevel = 0
  for (let i = 0; i < lines.length; i += 1) {
    const m = lines[i].match(/^\s{0,3}(#{1,6})\s+(.+?)\s*$/)
    if (!m) continue
    const title = String(m[2] || '').trim().toLowerCase()
    if (title === needle) {
      startIdx = i
      startLevel = (m[1] || '').length
      break
    }
  }
  if (startIdx < 0) return ''
  const out: string[] = []
  for (let i = startIdx + 1; i < lines.length; i += 1) {
    const m = lines[i].match(/^\s{0,3}(#{1,6})\s+(.+?)\s*$/)
    if (m) {
      const level = (m[1] || '').length
      if (level <= startLevel) break
    }
    out.push(lines[i])
    if (out.join('\n').length >= maxChars) break
  }
  const joined = out.join('\n').trim()
  return joined.length > maxChars ? joined.slice(0, maxChars) : joined
}

const extractShortcutKeybinds = (readme: string, maxItems: number) => {
  const block = extractReadmeSectionBlock(readme, 'Shortcuts', 20_000)
  if (!block) return []
  const lines = block.split(/\r?\n/)
  const items: Array<{ key: string; desc: string }> = []
  const push = (keyRaw: string, descRaw: string) => {
    const key = String(keyRaw || '').trim()
    const desc = String(descRaw || '').trim()
    if (!key) return
    if (/keybind/i.test(key) && /explanation/i.test(desc)) return
    items.push({ key, desc: desc || '(not provided)' })
  }
  for (let i = 0; i < lines.length; i += 1) {
    const row = lines[i]
    const li = row.match(/^\s{0,3}[-*+]\s+(.+?)\s*$/)
    if (li) {
      const key = String(li[1] || '').trim()
      if (key) push(key, '(not provided)')
      if (items.length >= maxItems) break
      continue
    }

    if (row.includes('|')) {
      if (/^\s*\|\s*-+/.test(row)) continue
      const cells = row
        .split('|')
        .map(c => c.trim())
        .filter(Boolean)
      if (cells.length < 2) continue
      push(cells[0], cells[1])
      if (items.length >= maxItems) break
    }
  }
  const dedup: Array<{ key: string; desc: string }> = []
  for (const it of items) {
    if (dedup.some(x => x.key.toLowerCase() === it.key.toLowerCase())) continue
    dedup.push(it)
  }
  return dedup
}

const extractGitHubRoutesFromServerText = (python: string, maxItems: number) => {
  const text = String(python || '')
  const candidates = new Set<string>()

  for (const m of text.matchAll(/['"]\/(?:[A-Za-z0-9_\-./{}]+)?['"]/g)) {
    const raw = String(m[0] || '')
    const path = raw.replace(/^['"]|['"]$/g, '')
    if (!path || path === '/') continue
    if (path.length > 64) continue
    candidates.add(path)
    if (candidates.size >= maxItems * 3) break
  }

  const filtered = [...candidates]
    .filter(p => !/\.(?:css|js|png|jpg|jpeg|gif|svg|ico|woff2?)$/i.test(p))
    .sort((a, b) => a.localeCompare(b))
    .slice(0, Math.max(0, maxItems))

  return filtered
}

const parseRequirements = (text: string, maxItems: number) => {
  const lines = String(text || '').split(/\r?\n/)
  const out: Array<{ pkg: string; spec: string }> = []
  for (const raw of lines) {
    const line = String(raw || '').trim()
    if (!line || line.startsWith('#')) continue
    if (line.startsWith('-r ') || line.startsWith('--')) continue
    const m = line.match(/^([A-Za-z0-9_.-]+)\s*([^;#]*)/)
    if (!m) continue
    const pkg = String(m[1] || '').trim()
    const spec = String(m[2] || '').trim()
    if (!pkg) continue
    out.push({ pkg, spec: spec || '(unspecified)' })
    if (out.length >= maxItems) break
  }
  return out
}

const detectRepoKeyFiles = (allTreePaths: string[], readmeMarkdown: string, maxFiles: number) => {
  const max = typeof maxFiles === 'number' && Number.isFinite(maxFiles) && maxFiles > 0 ? Math.floor(maxFiles) : 6
  const rootFiles = allTreePaths.filter(p => p && !p.includes('/') && !p.endsWith('/'))
  const readmeLower = String(readmeMarkdown || '').toLowerCase()

  const scoreFor = (file: string): number => {
    const lower = String(file || '').toLowerCase()
    const ext = lower.includes('.') ? lower.slice(lower.lastIndexOf('.') + 1) : ''
    let score = 0
    if (ext === 'py') score += 3
    if (ext === 'ts' || ext === 'tsx') score += 2
    if (ext === 'js' || ext === 'jsx') score += 1
    if (lower.includes('main')) score += 9
    if (lower.includes('server')) score += 8
    if (lower.includes('app')) score += 6
    if (lower.includes('execution')) score += 6
    if (lower === 'nodes.py' || lower.includes('nodes')) score += 5
    if (lower.includes('cli') || lower.includes('command')) score += 3
    if (lower.includes('api')) score += 3
    if (lower.startsWith('index.')) score += 2
    if (readmeLower.includes('entry point') && lower.includes('main')) score += 3
    if (readmeLower.includes('api') && lower.includes('server')) score += 2
    return score
  }

  const titleFor = (file: string): string => {
    const lower = String(file || '').toLowerCase()
    if (lower.includes('main')) return 'Main Entry Point'
    if (lower.includes('server')) return 'Server Module'
    if (lower.includes('execution')) return 'Execution Engine'
    if (lower === 'nodes.py' || lower.includes('nodes')) return 'Node System'
    if (lower.includes('api')) return 'API Layer'
    if (lower.includes('cli')) return 'CLI'
    return 'Key File'
  }

  const scored = rootFiles
    .map(file => ({ file, score: scoreFor(file), title: titleFor(file) }))
    .filter(x => x.score > 0)
  scored.sort((a, b) => b.score - a.score || a.file.localeCompare(b.file))
  const picked: Array<{ file: string; title: string }> = []
  for (const s of scored) {
    if (picked.some(p => p.file === s.file)) continue
    picked.push({ file: s.file, title: s.title })
    if (picked.length >= max) break
  }
  return picked
}

const buildGitHubRepoUserJourneyMarkdown = (args: {
  owner: string
  repo: string
  repoMeta: GitHubRepoMeta
  ref: string
  allTreePaths: string[]
  readmeMarkdown: string
}): string => {
  const rootName = String(args.repo || 'repo').replace(/\.git$/i, '') || 'repo'
  const repoUrl = `https://github.com/${args.owner}/${args.repo}`
  const desc = typeof args.repoMeta.description === 'string' ? args.repoMeta.description : ''
  const date = new Date()
  const dateDisplay = date.toISOString().slice(0, 10)
  const readmeLower = String(args.readmeMarkdown || '').toLowerCase()

  const installModes = (() => {
    const modes: string[] = []
    if (readmeLower.includes('desktop application')) modes.push('Desktop Application')
    if (readmeLower.includes('windows portable')) modes.push('Windows Portable')
    if (readmeLower.includes('manual install') || readmeLower.includes('manual install')) modes.push('Manual Install')
    if (!modes.length) modes.push('Install')
    return modes
  })()

  const port = (() => {
    const m = String(args.readmeMarkdown || '').match(/localhost\s*[:]\s*(\d{2,5})/i)
    return m ? String(m[1] || '').trim() : ''
  })()

  const shortcuts = extractShortcutKeybinds(args.readmeMarkdown, 18)
  const groups = extractRepoReadmeFeatureGroups(args.readmeMarkdown)
  const primaryFeatureGroup = groups.find(g => /features|image models|video models|audio models/i.test(g.title)) || groups[0] || null
  const templateNames = buildTemplateGridFromGroups(groups)

  const hasApi = readmeLower.includes('api') || args.allTreePaths.some(p => p.toLowerCase().includes('api'))
  const hasCustomNodes = readmeLower.includes('custom nodes') || args.allTreePaths.some(p => p.toLowerCase().includes('custom_nodes'))
  const hasOffline = readmeLower.includes('offline')
  const hasQueue = readmeLower.includes('queue') || shortcuts.some(s => /queue/i.test(s.desc))

  const doc: string[] = []
  doc.push(`# ${rootName} User Journey Flow & UI Map`)
  doc.push(`## ${repoUrl}`)
  doc.push('')
  doc.push(
    `> **Document Purpose:** Comprehensive user journey mapping with ASCII flow diagrams, UI interactions, and code dependencies for ${rootName}${desc ? ` — ${desc}` : ''}.`,
  )
  doc.push('')
  doc.push(`**Repository:** ${repoUrl}  `)
  doc.push(`**Analysis Date:** ${dateDisplay}`)
  doc.push('')
  doc.push('---')
  doc.push('')

  doc.push('## 👥 User Personas')
  doc.push('')
  doc.push('### Persona 1: Beginner Artist (Emma)')
  doc.push('- **Background:** New to generative workflows')
  doc.push('- **Goal:** Generate results from a simple text prompt')
  doc.push('- **Technical Level:** Low')
  doc.push('- **Primary Path:** Simple text-to-image workflow')
  doc.push('')
  doc.push('### Persona 2: Power User (Alex)')
  doc.push('- **Background:** Experienced with diffusion tooling')
  doc.push('- **Goal:** Build advanced multi-step workflows (ControlNet, LoRA, etc.)')
  doc.push('- **Technical Level:** High')
  doc.push('- **Primary Path:** Advanced multi-step workflows')
  doc.push('')
  doc.push('### Persona 3: Developer (Jordan)')
  doc.push('- **Background:** Software developer')
  doc.push('- **Goal:** Integrate into an automated pipeline')
  doc.push('- **Technical Level:** Expert')
  doc.push(`- **Primary Path:** ${hasApi ? 'API usage' : 'CLI/config'} + custom extensions`)
  doc.push('')
  doc.push('### Persona 4: Content Creator (Sam)')
  doc.push('- **Background:** Produces repeatable outputs with consistent style')
  doc.push('- **Goal:** Batch process outputs with consistent settings')
  doc.push('- **Technical Level:** Medium')
  doc.push('- **Primary Path:** Template workflows + batch generation')
  doc.push('')
  doc.push('---')
  doc.push('')

  doc.push('## 🗺️ Master User Journey Overview')
  doc.push('')
  doc.push('```ascii')
  doc.push('┌─────────────────────────────────────────────────────────────────────────────┐')
  doc.push(`│${` ${rootName.toUpperCase()} USER JOURNEY MAP `.padEnd(77, ' ')}│`)
  doc.push('└─────────────────────────────────────────────────────────────────────────────┘')
  doc.push('')
  doc.push('                              ┌──────────────┐')
  doc.push('                              │  NEW USER    │')
  doc.push('                              │   ARRIVES    │')
  doc.push('                              └──────┬───────┘')
  doc.push('                                     │')
  if (installModes.length >= 3) {
    doc.push('                     ┌───────────────┼───────────────┐')
    doc.push('                     │               │               │')
    doc.push(`              ┌──────▼──────┐ ┌─────▼──────┐ ┌─────▼──────┐`)
    doc.push(`              │ ${installModes[0].toUpperCase().slice(0, 10).padEnd(12, ' ')}│ │ ${installModes[1].toUpperCase().slice(0, 10).padEnd(11, ' ')}│ │ ${installModes[2].toUpperCase().slice(0, 10).padEnd(11, ' ')}│`)
    doc.push('              └──────┬──────┘ └─────┬──────┘ └─────┬──────┘')
    doc.push('                     │               │               │')
    doc.push('                     └───────────────┼───────────────┘')
    doc.push('                                     │')
  } else {
    doc.push(`                              ┌──────▼───────┐`)
    doc.push(`                              │ ${installModes[0].toUpperCase().padEnd(12, ' ')}│`)
    doc.push('                              └──────┬───────┘')
    doc.push('                                     │')
  }
  doc.push('                              ┌──────▼───────┐')
  doc.push('                              │ FIRST LAUNCH │')
  doc.push(`                              │ ${port ? `localhost:${port}`.padEnd(12, ' ') : 'localhost'.padEnd(12, ' ')}│`)
  doc.push('                              └──────┬───────┘')
  doc.push('                                     │')
  doc.push('                              ┌──────▼───────┐')
  doc.push('                              │BUILD WORKFLOW│')
  doc.push('                              │ Add Nodes   │')
  doc.push('                              │Connect Wires │')
  doc.push('                              └──────┬───────┘')
  doc.push('                                     │')
  doc.push('                              ┌──────▼───────┐')
  doc.push('                              │QUEUE / RUN   │')
  doc.push(`                              │ ${shortcuts.find(s => /enter/i.test(s.key) && /queue/i.test(s.desc))?.key || 'Ctrl+Enter'}       │`)
  doc.push('                              └──────┬───────┘')
  doc.push('                                     │')
  doc.push('                              ┌──────▼───────┐')
  doc.push('                              │ REVIEW OUTPUT│')
  doc.push('                              │ Iterate/Save │')
  doc.push('                              └──────────────┘')
  doc.push('```')
  doc.push('')
  doc.push('---')
  doc.push('')

  doc.push('## 📱 UI Layout & Interaction Map')
  doc.push('')
  doc.push('### Main Interface Structure')
  doc.push('')
  doc.push('```ascii')
  doc.push('┌─────────────────────────────────────────────────────────────────────────────┐')
  doc.push(`│ ${rootName.toUpperCase().padEnd(32, ' ')} ${port ? `localhost:${port}`.padEnd(18, ' ') : ''.padEnd(18, ' ')}                          │`)
  doc.push('├─────────────────────────────────────────────────────────────────────────────┤')
  doc.push('│ ┌─────────────────────────────────────────────────────────────────────────┐ │')
  doc.push('│ │ TOP MENU BAR                                                            │ │')
  doc.push('│ │ [Load] [Save] [Queue] [Settings] [Help]                                 │ │')
  doc.push('│ └─────────────────────────────────────────────────────────────────────────┘ │')
  doc.push('│ ┌───────────┬─────────────────────────────────────────────┬───────────────┐ │')
  doc.push('│ │ NODES     │ CANVAS AREA                                  │ SIDEBAR       │ │')
  doc.push('│ │ Search…   │ (Drag and drop nodes here)                   │ Queue/History │ │')
  doc.push('│ │ Categories│                                             │               │ │')
  doc.push('│ └───────────┴─────────────────────────────────────────────┴───────────────┘ │')
  doc.push('│ ┌─────────────────────────────────────────────────────────────────────────┐ │')
  doc.push(`│ │ STATUS: ${hasQueue ? 'Queue active' : 'Ready'} | ${hasOffline ? 'Offline-capable' : 'Network optional'} | ${hasCustomNodes ? 'Custom nodes' : 'Extensions'} │ │`)
  doc.push('│ └─────────────────────────────────────────────────────────────────────────┘ │')
  doc.push('└─────────────────────────────────────────────────────────────────────────────┘')
  doc.push('```')
  doc.push('')
  doc.push('### UI Component Breakdown')
  doc.push('')
  doc.push('| Component | Location | Purpose | User Interaction |')
  doc.push('|-----------|----------|---------|------------------|')
  doc.push('| **Menu Bar** | Top | Primary actions | Click buttons / shortcuts |')
  doc.push('| **Nodes Panel** | Left | Browse/search nodes | Drag to canvas |')
  doc.push('| **Canvas** | Center | Build workflows | Drag, connect, edit |')
  doc.push(`| **Queue Panel** | Right | ${hasQueue ? 'Manage queued runs' : 'Run controls'} | Start/cancel/manage |`)
  doc.push('| **History Panel** | Right | Review past runs | Load previous |')
  doc.push('| **Status Bar** | Bottom | System state | Monitor resources |')
  doc.push('')
  doc.push('---')
  doc.push('')

  doc.push('## 🎯 Journey 1: First-Time User (Emma) - Simple Text-to-Image')
  doc.push('')
  doc.push('### Journey Flow Diagram')
  doc.push('')
  doc.push('```ascii')
  doc.push(`START: Emma opens ${rootName} for the first time`)
  doc.push('│')
  doc.push('├─ STEP 1: Install')
  doc.push(`│  └─> Choose: ${installModes.join(' | ')}`)
  doc.push('│')
  doc.push('├─ STEP 2: First Launch')
  doc.push(`│  └─> Open UI at ${port ? `http://localhost:${port}` : 'http://localhost:<port>'}`)
  doc.push('│')
  doc.push('├─ STEP 3: Load Example / Start Blank')
  doc.push('│  └─> User Action: click a starting point to populate the canvas')
  doc.push('│')
  doc.push('├─ STEP 4: Modify Parameters')
  doc.push('│  └─> User Action: edit prompt / settings inside nodes')
  doc.push('│')
  doc.push('├─ STEP 5: Queue / Run')
  doc.push(`│  └─> User Action: ${shortcuts.find(s => /enter/i.test(s.key) && /queue/i.test(s.desc))?.key || 'Ctrl+Enter'} (or click Queue)`)
  doc.push('│')
  doc.push('├─ STEP 6: Watch Execution')
  doc.push('│  └─> UI shows progress + previews; results appear in output/history')
  doc.push('│')
  doc.push('└─ STEP 7: Save / Share')
  doc.push('   └─> Save workflow; export outputs; iterate')
  doc.push('```')
  doc.push('')

  if (shortcuts.length) {
    doc.push('---')
    doc.push('')
    doc.push('## ⌨️ Keyboard Shortcuts (Extracted)')
    doc.push('')
    doc.push('| Keybind | Explanation |')
    doc.push('|--------|-------------|')
    for (const s of shortcuts.slice(0, 18)) {
      doc.push(`| ${s.key} | ${s.desc} |`)
    }
    doc.push('')
  }

  doc.push('---')
  doc.push('')
  doc.push('## 🎯 Journey 2: Power User (Alex) - Advanced Workflow')
  doc.push('')
  doc.push('```ascii')
  doc.push('START: Alex assembles an advanced workflow')
  doc.push('│')
  doc.push('├─ STEP 1: Load or clone an existing workflow')
  doc.push('│')
  doc.push('├─ STEP 2: Add specialized nodes (extensions / custom nodes if available)')
  doc.push('│')
  doc.push('├─ STEP 3: Create variants via parameters (seeds, samplers, conditioning)')
  doc.push('│')
  doc.push('├─ STEP 4: Queue multiple runs and monitor progress')
  doc.push('│')
  doc.push('└─ STEP 5: Save/share as a reusable template')
  doc.push('```')
  doc.push('')

  doc.push('---')
  doc.push('')
  doc.push('## 🎯 Journey 3: Developer (Jordan) - API & Extensions')
  doc.push('')
  doc.push('```ascii')
  doc.push('START: Jordan integrates the system into automation')
  doc.push('│')
  doc.push(`├─ STEP 1: Run backend (${args.allTreePaths.includes('server.py') ? 'server.py' : 'server'}) and verify health`) 
  doc.push(`├─ STEP 2: ${hasApi ? 'Call API endpoints / WebSocket for execution' : 'Drive execution via supported interfaces'}`)
  doc.push(`├─ STEP 3: ${hasCustomNodes ? 'Develop/enable custom nodes' : 'Extend behavior via available plugin surfaces'}`)
  doc.push('└─ STEP 4: Deploy, monitor, and version workflows')
  doc.push('```')
  doc.push('')

  doc.push('---')
  doc.push('')
  doc.push('## 🎯 Journey 4: Content Creator (Sam) - Batch Production')
  doc.push('')
  doc.push('```ascii')
  doc.push('START: Sam produces a batch of consistent outputs')
  doc.push('│')
  doc.push('├─ STEP 1: Pick a template / saved workflow')
  doc.push('├─ STEP 2: Set batch parameters (seed ranges, prompts, model selection)')
  doc.push('├─ STEP 3: Queue multiple jobs and review history')
  doc.push('└─ STEP 4: Export outputs and reuse the workflow later')
  doc.push('```')
  doc.push('')

  if (primaryFeatureGroup) {
    doc.push('---')
    doc.push('')
    doc.push(`## 📌 Key Capabilities Snapshot: ${primaryFeatureGroup.title}`)
    doc.push('')
    doc.push('| Capability | Notes |')
    doc.push('|------------|-------|')
    for (const it of primaryFeatureGroup.items.slice(0, 14)) {
      const note = it.toLowerCase().includes('api') ? 'Automation surface' : it.toLowerCase().includes('offline') ? 'Local-first execution' : 'Feature'
      doc.push(`| **${it}** | ${note} |`)
    }
    doc.push('')
  }

  if (templateNames.length) {
    doc.push('---')
    doc.push('')
    doc.push('## 📑 Template Showcase')
    doc.push('')
    doc.push('```ascii')
    doc.push(renderTemplateGalleryGridTwoRows(templateNames))
    doc.push('```')
    doc.push('')
    doc.push('| Template | Category |')
    doc.push('|----------|----------|')
    for (const g of groups.slice(0, 6)) {
      for (const it of g.items.slice(0, 12)) {
        if (!templateNames.some(t => t.toLowerCase() === it.toLowerCase())) continue
        doc.push(`| **${it}** | ${g.title} |`)
      }
    }
    doc.push('')
  }

  if (shortcuts.length) {
    doc.push('---')
    doc.push('')
    doc.push('## ⌨️ Shortcuts (Extracted)')
    doc.push('')
    doc.push('| Keybind | Action |')
    doc.push('|--------|--------|')
    for (const s of shortcuts) {
      doc.push(`| **${s.key}** | ${s.desc} |`)
    }
    doc.push('')
  }

  if (desc) {
    doc.push('---')
    doc.push('')
    doc.push('## 🧾 Notes')
    doc.push('')
    doc.push(`- ${desc}`)
    doc.push(`- Ref: ${args.ref}`)
    doc.push('')
  }
  return doc.join('\n')
}

const buildGitHubRepoSitemapMarkdown = async (args: {
  owner: string
  repo: string
  ref: string
  repoMeta: GitHubRepoMeta
  allTreePaths: string[]
  readmeMarkdown: string
}): Promise<string> => {
  const fullName = typeof args.repoMeta.full_name === 'string' ? args.repoMeta.full_name : `${args.owner}/${args.repo}`
  const desc = typeof args.repoMeta.description === 'string' ? args.repoMeta.description : ''
  const licenseSpdx = (() => {
    const lic = args.repoMeta.license
    if (lic && typeof lic === 'object' && 'spdx_id' in lic) {
      const spdx = (lic as { spdx_id?: unknown }).spdx_id
      return typeof spdx === 'string' ? spdx : ''
    }
    return ''
  })()
  const stars = typeof args.repoMeta.stargazers_count === 'number' ? args.repoMeta.stargazers_count : Number(args.repoMeta.stargazers_count)
  const forks = typeof args.repoMeta.forks_count === 'number' ? args.repoMeta.forks_count : Number(args.repoMeta.forks_count)
  const updated = typeof args.repoMeta.updated_at === 'string' ? args.repoMeta.updated_at : ''
  const rootName = String(args.repo || 'repo').replace(/\.git$/i, '') || 'repo'

  const folderCount = (() => {
    const s = new Set<string>()
    for (const p of args.allTreePaths) {
      const parts = String(p || '').split('/').filter(Boolean)
      let cur = ''
      for (let i = 0; i < parts.length - 1; i += 1) {
        cur = cur ? `${cur}/${parts[i]}` : parts[i]
        s.add(cur)
      }
    }
    return s.size
  })()

  const rootPy = args.allTreePaths.filter(p => /^[^/]+\.py$/i.test(p))
  const rootFiles = args.allTreePaths.filter(p => p && !p.includes('/') && !p.endsWith('/'))
  const readmeGroups = extractRepoReadmeFeatureGroups(args.readmeMarkdown)
  const templateNames = buildTemplateGridFromGroups(readmeGroups)
  const platforms = detectSupportedPlatformsFromReadme(args.readmeMarkdown)
  const gpuTypes = extractGpuTypesFromReadme(args.readmeMarkdown)
  const hasCustomNodes = args.allTreePaths.some(p => p.toLowerCase().includes('custom_nodes'))
  const hasApi =
    /\bwebsocket\b/i.test(args.readmeMarkdown) ||
    /\bapi\b/i.test(args.readmeMarkdown) ||
    args.allTreePaths.some(p => p.toLowerCase().includes('api'))

  const doc: string[] = []
  doc.push(`# ${rootName} Repository Sitemap`)
  doc.push(`## https://github.com/${args.owner}/${args.repo}`)
  doc.push('')
  if (desc) doc.push(`> **Repository Overview:** ${desc}`)
  doc.push('')
  if (licenseSpdx) doc.push(`**License:** ${licenseSpdx}  `)
  if (Number.isFinite(stars)) doc.push(`**Stars:** ${formatK(stars)}  `)
  if (Number.isFinite(forks)) doc.push(`**Forks:** ${formatK(forks)}  `)
  const updatedDisplay = formatIsoDateMonthYear(updated)
  if (updatedDisplay) doc.push(`**Last Updated:** ${updatedDisplay}`)
  doc.push('')
  doc.push('---')
  doc.push('')

  doc.push('## 🔝 Header Navigation')
  doc.push('')
  doc.push('| Area | Items | Notes |')
  doc.push('|------|-------|-------|')
  doc.push(`| **Repository** | Code, Issues, Pull requests, Actions, Projects, Wiki, Security, Insights | Derived GitHub UI tabs |`)
  doc.push('')
  doc.push('---')
  doc.push('')

  doc.push('## 🎯 Hero Section')
  doc.push('')
  doc.push('| Element | Type | Value |')
  doc.push('|---------|------|-------|')
  doc.push(`| **Repository** | Text | ${fullName} |`)
  doc.push(`| **Description** | Text | ${desc || '(not detected)'} |`)
  doc.push(`| **Default Ref** | Text | ${args.ref || '(unknown)'} |`)
  doc.push(`| **Stars** | Metric | ${Number.isFinite(stars) ? formatK(stars) : '(unknown)'} |`)
  doc.push(`| **Forks** | Metric | ${Number.isFinite(forks) ? formatK(forks) : '(unknown)'} |`)
  doc.push(`| **License** | Text | ${licenseSpdx || '(unknown)'} |`)
  doc.push('')
  doc.push('---')
  doc.push('')

  doc.push('## 📊 Repository Statistics')
  doc.push('')
  doc.push('| Metric | Value |')
  doc.push('|--------|-------|')
  doc.push(`| **Total Folders** | ${folderCount} |`)
  doc.push(`| **Core Python Files** | ${rootPy.length || 0}${rootPy.length ? '+' : ''} (root level) |`)
  doc.push(`| **Custom Nodes Support** | ${hasCustomNodes ? 'Yes' : 'Unknown'} |`)
  doc.push(`| **API Support** | ${hasApi ? 'Detected' : 'Unknown'} |`)
  doc.push(`| **Supported Platforms** | ${platforms.length ? platforms.join(', ') : 'Unknown'} |`)
  doc.push(`| **GPU Support** | ${gpuTypes.length ? gpuTypes.join(', ') : 'Unknown'} |`)
  doc.push('')
  doc.push('---')
  doc.push('')

  doc.push('## 🗂️ Directory Structure')
  doc.push('')
  doc.push('```')
  const filePaths = filterToLikelyFilePaths(args.allTreePaths)
  doc.push(renderRepoTreeAscii({ rootName, paths: filePaths, maxDepth: 4, maxChildrenPerFolder: 28 }))
  doc.push('```')
  doc.push('')

  if (rootFiles.length) {
    doc.push('---')
    doc.push('')
    doc.push('## 📄 Top-Level Files (Detected)')
    doc.push('')
    doc.push('| File | Notes |')
    doc.push('|------|-------|')
    for (const f of rootFiles.slice(0, 36)) {
      const lower = f.toLowerCase()
      const note =
        lower === 'readme.md'
          ? 'Repository overview and usage'
          : lower.includes('license')
            ? 'License'
            : lower.includes('requirements') || lower.includes('pyproject')
              ? 'Dependencies'
              : lower.includes('docker')
                ? 'Containerization'
                : lower.includes('makefile')
                  ? 'Build automation'
                  : '—'
      doc.push(`| \`${f}\` | ${note} |`)
    }
    doc.push('')
  }

  if (templateNames.length) {
    doc.push('---')
    doc.push('')
    doc.push('## 📑 Template Showcase')
    doc.push('')
    doc.push('```ascii')
    doc.push(renderTemplateGalleryGridTwoRows(templateNames))
    doc.push('```')
    doc.push('')
    doc.push('| Template | Source Section |')
    doc.push('|----------|----------------|')
    for (const g of readmeGroups) {
      const used = g.items.filter(it => templateNames.some(t => t.toLowerCase() === it.toLowerCase()))
      for (const t of used.slice(0, 6)) {
        doc.push(`| **${t}** | ${g.title} |`)
      }
      if (templateNames.length >= 12) break
    }
    doc.push('')
  }

  if (readmeGroups.length) {
    doc.push('---')
    doc.push('')
    doc.push('## ⚡ Feature Sections (Extracted)')
    doc.push('')
    doc.push('| Section | Items | Notes |')
    doc.push('|---------|-------|-------|')
    for (const g of readmeGroups.slice(0, 8)) {
      doc.push(`| **${g.title}** | ${g.items.length} | From README list items |`)
    }
    doc.push('')

    let idx = 1
    for (const g of readmeGroups.slice(0, 6)) {
      doc.push('---')
      doc.push('')
      doc.push(`## ${idx === 1 ? '💻' : idx === 2 ? '🧩' : idx === 3 ? '🎬' : idx === 4 ? '🎛️' : idx === 5 ? '🧠' : '⚙️'} Section Statistics: ${g.title}`)
      doc.push('')
      doc.push(`- **List Items:** ${g.items.length}`)
      doc.push(`- **Unique Tokens:** ${new Set(g.items.map(x => x.toLowerCase())).size}`)
      doc.push('')
      doc.push('| Item |')
      doc.push('|------|')
      for (const it of g.items.slice(0, 18)) {
        doc.push(`| ${it} |`)
      }
      doc.push('')
      idx += 1
    }
  }

  doc.push('---')
  doc.push('')
  doc.push('## 🎯 Core Entry Points & Dependencies')
  doc.push('')

  const keyFiles = detectRepoKeyFiles(args.allTreePaths, args.readmeMarkdown, 6)
  let sectionIdx = 1
  for (const k of keyFiles) {
    if (!args.allTreePaths.includes(k.file)) continue
    const rawUrl = buildGitHubRawFileUrl({ owner: args.owner, repo: args.repo, ref: args.ref, relPath: k.file })
    const fetched = await fetchRemoteTextDetailed(rawUrl, { preferProxy: true, preflightHead: true, maxBytes: 350_000 })
    doc.push(`### ${sectionIdx}. ${k.title}`)
    doc.push('')
    if (!fetched.ok) {
      doc.push('(unavailable)')
      doc.push('')
      doc.push('---')
      doc.push('')
      sectionIdx += 1
      continue
    }
    if (/\.py$/i.test(k.file)) {
      const outline = extractPythonStructuredOutline(fetched.text, { maxTopLevelDefs: 14, maxClasses: 8, maxMethodsPerClass: 12, maxImports: 24 })
      doc.push('| Module | Class/Object | Function/Method | Input | Output | Decision Logic |')
      doc.push('|--------|--------------|-----------------|-------|--------|----------------|')
      for (const d of outline.topLevelDefs) {
        const input = d.args ? d.args.split(',').map(x => x.trim()).filter(Boolean).slice(0, 6).join(', ') : ''
        doc.push(`| \`${k.file}\` | N/A | \`${d.name}()\` | ${input || '—'} | — | — |`)
      }
      for (const c of outline.classes) {
        for (const m of c.methods.slice(0, 12)) {
          const input = m.args ? m.args.split(',').map(x => x.trim()).filter(Boolean).slice(0, 6).join(', ') : ''
          doc.push(`| \`${k.file}\` | \`${c.name}\` | \`${m.name}()\` | ${input || '—'} | — | — |`)
        }
      }
      doc.push('')
      if (outline.imports.length) {
        doc.push('**Dependencies:**')
        for (const imp of outline.imports.slice(0, 18)) doc.push(`- \`${imp}\``)
        doc.push('')
      }
    } else {
      doc.push('```')
      doc.push(fetched.text.slice(0, 1200).trimEnd())
      doc.push('```')
      doc.push('')
    }
    doc.push('---')
    doc.push('')
    sectionIdx += 1
  }

  const serverFile = args.allTreePaths.includes('server.py') ? 'server.py' : null
  if (serverFile) {
    const rawUrl = buildGitHubRawFileUrl({ owner: args.owner, repo: args.repo, ref: args.ref, relPath: serverFile })
    const fetched = await fetchRemoteTextDetailed(rawUrl, { preferProxy: true, preflightHead: true, maxBytes: 350_000 })
    if (fetched.ok) {
      const routes = extractGitHubRoutesFromServerText(fetched.text, 18)
      if (routes.length) {
        doc.push('## 🧭 Key Routes (Heuristic)')
        doc.push('')
        doc.push('| Route | Notes |')
        doc.push('|------|-------|')
        for (const r of routes) doc.push(`| \`${r}\` | Extracted from source strings |`)
        doc.push('')
        doc.push('---')
        doc.push('')
      }
    }
  }

  const reqFile = args.allTreePaths.includes('requirements.txt') ? 'requirements.txt' : null
  if (reqFile) {
    const rawUrl = buildGitHubRawFileUrl({ owner: args.owner, repo: args.repo, ref: args.ref, relPath: reqFile })
    const fetched = await fetchRemoteTextDetailed(rawUrl, { preferProxy: true, preflightHead: true, maxBytes: 250_000 })
    if (fetched.ok) {
      const deps = parseRequirements(fetched.text, 18)
      if (deps.length) {
        doc.push('## 📚 External Dependencies (requirements.txt)')
        doc.push('')
        doc.push('| Package | Version/Spec |')
        doc.push('|---------|--------------|')
        for (const d of deps) doc.push(`| \`${d.pkg}\` | ${d.spec} |`)
        doc.push('')
        doc.push('---')
        doc.push('')
      }
    }
  }

  if (hasCustomNodes) {
    doc.push('## 🏗️ Extension System (Detected)')
    doc.push('')
    doc.push('### Custom Node Development')
    doc.push('')
    doc.push('**Required Files:**')
    doc.push('- `__init__.py` - Node registration')
    doc.push('- `prestartup_script.py` - (Optional) Pre-initialization')
    doc.push('- Node class files')
    doc.push('')
    doc.push('---')
    doc.push('')
  }

  return doc.join('\n')
}

async function importGitHubFolder(args: {
  fs: WorkspaceFs
  repoRef: GitHubRepoRef
  parentPath: WorkspacePath
  onProgress?: (p: WorkspaceImportProgress) => void
  maxFiles?: number
}) : Promise<WorkspaceImportResult> {
  const maxFiles =
    typeof args.maxFiles === 'number' && Number.isFinite(args.maxFiles) && args.maxFiles > 0
      ? Math.floor(args.maxFiles)
      : 60
  const ref = args.repoRef.ref || (await resolveGitHubDefaultBranch({ owner: args.repoRef.owner, repo: args.repoRef.repo }))

  args.onProgress?.({ phase: 'listing', current: 0, label: 'Listing repo' })
  const tree = await listGitHubRepoTreeFiles({
    owner: args.repoRef.owner,
    repo: args.repoRef.repo,
    ref,
    subdirPath: args.repoRef.subdirPath,
    maxFiles,
  })
  const filesToFetch = tree.files

  const repoMeta = await fetchGitHubRepoMeta({ owner: args.repoRef.owner, repo: args.repoRef.repo })

  const rootFolderName = String(args.repoRef.repo || 'repo').replace(/\.git$/i, '') || 'repo'
  const rootFolderPath = await args.fs.createFolder({ parentPath: args.parentPath, name: rootFolderName })

  const createdPaths: WorkspacePath[] = []
  const sources: Array<{ path: WorkspacePath; source: WorkspaceEntrySource }> = []
  const failed: Array<{ name: string; error: string }> = []
  if (tree.totalEligible > maxFiles) {
    failed.push({ name: 'GitHub repo import', error: `Truncated to ${maxFiles} text files (found ${tree.totalEligible})` })
  }
  if (tree.treeTruncated === true) {
    failed.push({ name: 'GitHub repo import', error: 'GitHub tree response truncated; directory structure may be incomplete' })
  }
  const folderMap = new Map<string, WorkspacePath>()

  const allTreePaths = tree.allPaths

  const readmeUrl = buildGitHubRawFileUrl({ owner: args.repoRef.owner, repo: args.repoRef.repo, ref, relPath: 'README.md' })
  const readmeFetched = await fetchRemoteTextDetailed(readmeUrl, { preferProxy: true, preflightHead: true, maxBytes: 350_000 })
  const readmeMarkdown = readmeFetched.ok ? readmeFetched.text : ''
  const sitemapText = await buildGitHubRepoSitemapMarkdown({
    owner: args.repoRef.owner,
    repo: args.repoRef.repo,
    ref,
    repoMeta,
    allTreePaths,
    readmeMarkdown,
  })
  const sitemapPath = await args.fs.createFile({ parentPath: rootFolderPath, name: 'repo.sitemap.md', text: sitemapText })
  createdPaths.push(normalizeWorkspacePath(sitemapPath))
  sources.push({ path: normalizeWorkspacePath(sitemapPath), source: { kind: 'url', url: `https://github.com/${args.repoRef.owner}/${args.repoRef.repo}` } })

  const userJourneyText = buildGitHubRepoUserJourneyMarkdown({
    owner: args.repoRef.owner,
    repo: args.repoRef.repo,
    repoMeta,
    ref,
    allTreePaths,
    readmeMarkdown,
  })
  const userJourneyPath = await args.fs.createFile({ parentPath: rootFolderPath, name: 'repo.user-journey.md', text: userJourneyText })
  createdPaths.push(normalizeWorkspacePath(userJourneyPath))
  sources.push({ path: normalizeWorkspacePath(userJourneyPath), source: { kind: 'url', url: `https://github.com/${args.repoRef.owner}/${args.repoRef.repo}` } })

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
    const fetched = await fetchRemoteTextDetailed(file.rawUrl, { preflightHead: true, preferProxy: true })
    if (!fetched.ok) {
      failed.push({
        name: file.relPath,
        error: describeFetchRemoteTextFailure(fetched as import('grph-shared/net/fetchRemoteText').FetchRemoteTextFailure),
      })
      continue
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
    try {
      const createdPath = await args.fs.createFile({
        parentPath: parentFolder,
        name: segments[segments.length - 1] || 'file.txt',
        text: fetched.text,
      })
      createdPaths.push(normalizeWorkspacePath(createdPath))
      sources.push({ path: normalizeWorkspacePath(createdPath), source: { kind: 'url', url: file.rawUrl } })
    } catch (e) {
      failed.push({ name: file.relPath, error: String((e as { message?: unknown })?.message ?? e) })
    }
  }

  return { createdPaths, sources, skipped: [], failed }
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
