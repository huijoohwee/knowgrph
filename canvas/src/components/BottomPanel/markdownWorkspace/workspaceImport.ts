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
import { isFrontmatterOnlyDoc, upsertWebpageFrontmatterMeta } from '@/lib/markdown/frontmatter'
import { sanitizeImportedMarkdownText } from '@/lib/markdown/sanitizeImportedMarkdown'
import { buildWebpageMarkdownArtifactDoc, looksLikeWebpageMarkdownArtifactDoc } from '@/lib/websites/webpageMarkdownArtifact'
import { summarizeCategorizedSignalsFromMarkdown } from '@/lib/websites/signalTokens'
import { buildLayoutStructureAscii } from '@/lib/websites/webpageMarkdownArtifactAscii'
import { fetchWebpageHtmlAuto } from '@/lib/websites/webpageIframeSrcdoc'
import { convertWebpageHtmlToMarkdownArtifactAsync } from '@/lib/websites/webpageHtmlToMarkdownArtifact'
import { runInIdle } from '@/features/panels/utils/idle'
import { parseGitHubRepoUrl } from './githubRepoApi'
import { importGitHubFolder } from './githubRepoImport'

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

function ensureWebpageTocLayoutAscii(markdown: string): string {
  const text = String(markdown || '')
  if (!text.trim()) return text
  if (text.includes('```ascii') || text.includes('kg-webpage-layout') || /\bGLOBAL\s+NAVIGATION\b/i.test(text)) return text
  const lines = text.split(/\r?\n/)
  const tocHeadingIdx = lines.findIndex(l => /^##\s*(?:📋\s*)?table\s+of\s+contents\s*$/i.test(String(l || '').trim()))
  if (tocHeadingIdx < 0) return text

  const listIdx = (() => {
    for (let i = tocHeadingIdx + 1; i < Math.min(lines.length, tocHeadingIdx + 220); i += 1) {
      const s = String(lines[i] || '')
      if (/^##\s+/.test(s.trim())) break
      if (/^\s*\d+\.\s+\[/.test(s)) return i
    }
    return -1
  })()
  if (listIdx < 0) return text

  for (let i = tocHeadingIdx + 1; i < listIdx; i += 1) {
    const s = String(lines[i] || '').trim()
    if (/^(```+|~~~+)/.test(s)) return text
    if (/GLOBAL\s+NAVIGATION/i.test(s)) return text
  }

  const insertionIdx = (() => {
    let i = tocHeadingIdx + 1
    while (i < listIdx && !String(lines[i] || '').trim()) i += 1
    return i
  })()

  const signals = summarizeCategorizedSignalsFromMarkdown(text, { maxLines: 8000, maxPerKind: 12 })
  const navLabels = signals.nav.map(x => String(x.label || '').replace(/^\[NAV\]\s*/i, '').trim()).filter(Boolean)
  const ctaLabels = signals.cta.map(x => String(x.label || '').replace(/^\[CTA\]\s*/i, '').trim()).filter(Boolean)
  const ascii = buildLayoutStructureAscii({ navLabels, ctaLabels })
  if (!String(ascii || '').trim()) return text

  const injected = ['', '```ascii', ascii, '```', '']
  const next = [...lines.slice(0, insertionIdx), ...injected, ...lines.slice(insertionIdx)]
  return next.join('\n')
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

export async function fetchWorkspaceUrlContent(
  urlRaw: string,
  opts?: {
    mode?: 'import' | 'refresh'
    onProgress?: (percentage: number) => void
  },
): Promise<WorkspaceUrlContent> {
  const rawUrl = unwrapUserProvidedText(String(urlRaw || '').trim()) || String(urlRaw || '').trim()
  if (!rawUrl) throw new Error('Missing URL')

  const normalizedUrl = normalizeGitHubBlobLikeUrl(rawUrl) || rawUrl
  const normalizedLower = normalizedUrl.toLowerCase()

  const isHttpUrl = /^https?:\/\//i.test(normalizedUrl)
  const isLocalRepoPath = !isHttpUrl && !/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(normalizedUrl)
  const localRepoPath = isLocalRepoPath ? normalizedUrl.replace(/\\/g, '/').replace(/^\.+\//, '').replace(/^\/+/, '') : ''
  const localSiteRootRel = isLocalRepoPath
    ? (() => {
        const parts = localRepoPath.split('/').filter(Boolean)
        if (parts.length <= 1) return ''
        return parts.slice(0, -1).join('/')
      })()
    : ''

  const encodeRepoPathForUrl = (rel: string): string =>
    String(rel || '')
      .replace(/\\/g, '/')
      .split('/')
      .filter(Boolean)
      .map(seg => encodeURIComponent(seg))
      .join('/')

  const isPdf = /\.pdf(\?|#|$)/i.test(normalizedUrl)
  if (isYouTubeUrl(normalizedUrl)) {
    opts?.onProgress?.(10)
    const converted = await fetchYouTubeTranscriptMarkdown(normalizedUrl)
    opts?.onProgress?.(100)
    if (!converted) throw new Error('YouTube import failed')
    if (converted.ok === false) throw new Error(converted.error || 'YouTube import failed')
    return {
      normalizedUrl,
      name: String(converted.name || 'youtube-transcript.md'),
      text: String(converted.markdown || ''),
    }
  }

  if (isPdf) {
    opts?.onProgress?.(10)
    const converted = await convertPdfUrlToMarkdown(normalizedUrl)
    opts?.onProgress?.(100)
    if (!converted) throw new Error('PDF import failed')
    if (converted.ok === false) throw new Error(converted.error || 'PDF import failed')
    return {
      normalizedUrl,
      name: String(converted.name || 'document.md'),
      text: String(converted.markdown || ''),
    }
  }

  const looksLikeCodeOrData = /\.(json|jsonld|geojson|csv|yaml|yml|txt|js|ts|py|md|markdown|mdx)(\?|#|$)/i.test(normalizedLower)
  const looksLikeLocalHtml = isLocalRepoPath && /\.(html|htm)(\?|#|$)/i.test(normalizedLower)
  if (!looksLikeCodeOrData) {
    const base = deriveFilenameFromUrl(normalizedUrl, 'webpage')
    const baseNoExt = base.replace(/\.[a-z0-9]+$/i, '') || 'webpage'
    const name = `${baseNoExt}.md`
    const mode = opts?.mode === 'refresh' ? 'refresh' : 'import'
    if (mode === 'import') {
      const text = ['---', `kgWebpageUrl: ${yamlQuote(normalizedUrl)}`, `kgWebpageView: ${yamlQuote('html')}`, '---', ''].join('\n')
      return { normalizedUrl, name, text }
    }
    const ctrl = new AbortController()
    let progressTimer: number | null = null
    try {
      let p = 0
      progressTimer = window.setInterval(() => {
        if (p < 90) {
           p += Math.random() * 15
           if (p > 90) p = 90
           opts?.onProgress?.(Math.round(p))
        }
      }, 300)

      const upstreamMarkdown = await (async () => {
        try {
          const includeImages = false
          const converted = await fetchWebpageMarkdown(normalizedUrl, { includeImages })
          if (converted && converted.ok === true && typeof converted.markdown === 'string') {
            return String(converted.markdown || '')
          }
        } catch {
          void 0
        }

        const rawHtml = await fetchWebpageHtmlAuto({ url: normalizedUrl, signal: ctrl.signal })
        const boundedHtml = rawHtml.length > 5_000_000 ? rawHtml.slice(0, 5_000_000) : rawHtml
        opts?.onProgress?.(65)
        const converted = await convertWebpageHtmlToMarkdownArtifactAsync({ html: boundedHtml, url: normalizedUrl })
        opts?.onProgress?.(85)
        return converted
      })()

      if (progressTimer) clearInterval(progressTimer)
      opts?.onProgress?.(95)

      const text = await runInIdle(
        () =>
          buildWebpageWorkspaceEntryTextFromUpstreamMarkdown({
            upstreamMarkdown,
            url: normalizedUrl,
            view: 'html',
          }),
        { timeoutMs: 80 },
      )
      opts?.onProgress?.(100)
      if (text && text.trim() && !isFrontmatterOnlyDoc(text)) return { normalizedUrl, name, text }
    } catch {
      void 0
    } finally {
      if (progressTimer) clearInterval(progressTimer)
      try {
        ctrl.abort()
      } catch {
        void 0
      }
    }
    const text = ['---', `kgWebpageUrl: ${yamlQuote(normalizedUrl)}`, `kgWebpageView: ${yamlQuote('html')}`, '---', ''].join('\n')
    return { normalizedUrl, name, text }
  }

  if (isLocalRepoPath) {
    if (localRepoPath.includes('..')) throw new Error('Invalid local path')
    if (looksLikeLocalHtml) {
      const base = localRepoPath.split('/').pop() || 'webpage'
      const baseNoExt = base.replace(/\.[a-z0-9]+$/i, '') || 'webpage'
      const name = `${baseNoExt}.md`
      const text = [
        '---',
        `kgWebpageUrl: ${yamlQuote(localRepoPath)}`,
        `kgWebpageView: ${yamlQuote('html')}`,
        localSiteRootRel ? `kgWebpageSiteRootRel: ${yamlQuote(localSiteRootRel)}` : null,
        '---',
        '',
      ]
        .filter(Boolean)
        .join('\n')
      return { normalizedUrl: localRepoPath, name, text }
    }

    opts?.onProgress?.(10)
    const res = await fetch(`/__repo_file/${encodeRepoPathForUrl(localRepoPath)}`, { headers: { Accept: '*/*' } })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const text = await res.text()
    opts?.onProgress?.(100)

    const fallbackExt = (() => {
      if (normalizedLower.endsWith('.md') || normalizedLower.endsWith('.markdown') || normalizedLower.endsWith('.mdx')) return '.md'
      if (normalizedLower.endsWith('.json') || normalizedLower.endsWith('.jsonld') || normalizedLower.endsWith('.geojson')) return '.json'
      if (normalizedLower.endsWith('.csv')) return '.csv'
      if (normalizedLower.endsWith('.yaml') || normalizedLower.endsWith('.yml')) return '.yaml'
      if (normalizedLower.endsWith('.html') || normalizedLower.endsWith('.htm')) return '.html'
      return '.txt'
    })()

    const base = localRepoPath.split('/').pop() || `import${fallbackExt}`
    const name = base.includes('.') ? base : `${base}${fallbackExt}`
    return { normalizedUrl: localRepoPath, name, text }
  }

  opts?.onProgress?.(10)
  const res = await fetchRemoteTextDetailed(normalizedUrl, { preflightHead: true, preferProxy: true })
  opts?.onProgress?.(100)
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

  const fidelityMaxLevel = useGraphStore.getState().webpageArtifactFidelityMaxLevel ?? 4
  const isAlreadyArtifact = looksLikeWebpageMarkdownArtifactDoc(strippedUpstream)
  const artifactRaw = isAlreadyArtifact
    ? strippedUpstream
    : buildWebpageMarkdownArtifactDoc({
        markdown: strippedUpstream,
        url,
        title: args.title,
        fidelityMaxLevel,
      })
  const artifact = isAlreadyArtifact ? artifactRaw : ensureWebpageTocLayoutAscii(artifactRaw)
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

export function buildWebsiteImportWebpageDocFromUpstreamMarkdown(args: {
  upstreamMarkdown: string
  url: string
  view: 'markdown' | 'json' | 'html'
  websiteImportMeta: { importId: string; nodeId: string; outputDirRel?: string }
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

  const importId = String(args.websiteImportMeta.importId || '').trim()
  const nodeId = String(args.websiteImportMeta.nodeId || '').trim()
  const outputDirRel = String(args.websiteImportMeta.outputDirRel || '').trim()

  const fmLines = [
    '---',
    `kgWebpageUrl: ${yamlQuote(url)}`,
    `kgWebpageView: ${yamlQuote(view)}`,
    `kgWebsiteImportId: ${yamlQuote(importId)}`,
    `kgWebsiteNodeId: ${yamlQuote(nodeId)}`,
  ]
  if (outputDirRel) fmLines.push(`kgWebsiteOutputDirRel: ${yamlQuote(outputDirRel)}`)
  fmLines.push('---', '')

  const withView = upsertWebpageFrontmatterMeta(strippedUpstream, { url, view })
  const body = (() => {
    const t = String(withView || '')
    if (!t.startsWith('---')) return t
    const end = t.indexOf('\n---')
    if (end < 0) return t
    return t.slice(end + 4).replace(/^\s*\n/, '')
  })()

  return [...fmLines, body].join('\n')
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

  try {
    args.onProgress?.({ phase: 'fetching', current: 0, label: 'Fetching' })
  } catch {
    void 0
  }
  const fetched = await fetchWorkspaceUrlContent(rawUrl, {
    mode: 'import',
    onProgress: (p) => {
      try {
        args.onProgress?.({ phase: 'fetching', current: p, total: 100, label: 'Fetching' })
      } catch {
        void 0
      }
    },
  })
  try {
    args.onProgress?.({ phase: 'writing', current: 0, label: 'Writing' })
  } catch {
    void 0
  }
  const createdPath = await args.fs.createFile({ parentPath, name: fetched.name, text: fetched.text })
  try {
    args.onProgress?.({ phase: 'writing', current: 1, total: 1, label: 'Writing' })
  } catch {
    void 0
  }
  const normalized = normalizeWorkspacePath(createdPath)
  return {
    createdPaths: [normalized],
    sources: [{ path: normalized, source: { kind: 'url', url: fetched.normalizedUrl } }],
    skipped: [],
    failed: [],
  }
}
