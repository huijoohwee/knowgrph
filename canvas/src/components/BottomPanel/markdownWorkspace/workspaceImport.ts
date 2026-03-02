import type { WorkspaceFs, WorkspacePath } from '@/features/workspace-fs/types'
import { WORKSPACE_ROOT_PATH, normalizeWorkspacePath } from '@/features/workspace-fs/path'
import { parseWebkitRelativePath } from '@/features/source-files/webkitRelativePath'
import { buildRepoFilePath, deriveFilenameFromUrl, isYouTubeUrl, normalizeGitHubBlobLikeUrl, unwrapUserProvidedText } from '@/lib/url'
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
import { fetchWebpageHtmlAuto } from '@/lib/websites/webpageIframeSrcdoc'
import { exportWebpageDomViaHiddenIframe } from '@/lib/websites/webpageDomExport'
import { convertHtmlToMarkdownUnified } from '@/lib/markdown/htmlToMarkdownUnified'
import { postprocessWebpageMarkdownSsot } from '@/lib/markdown/webpageMarkdownPostprocess'
import { plainTextToMarkdown } from '@/lib/markdown/plainTextToMarkdown'
import { runInIdle } from '@/features/panels/utils/idle'
import { createProgressTicker } from '@/lib/progress/progressTicker'
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

function yamlQuote(value: string): string {
  return `"${String(value || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

function yamlBlockScalar(key: string, value: string): string[] {
  const v = String(value || '').replace(/\r/g, '').trim()
  if (!v) return []
  const lines = v.split('\n')
  return [`${key}: |`, ...lines.map(line => `  ${line}`)]
}

function decodeHtmlEntitiesBasic(text: string): string {
  const src = String(text || '')
  if (!src.includes('&')) return src
  return src
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
}

function htmlFallbackToMarkdownAllText(html: string): string {
  const src = String(html || '').replace(/\r/g, '')
  const stripTags = (s: string) => decodeHtmlEntitiesBasic(String(s || '').replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim()

  let out = src
  out = out.replace(/<script\b[\s\S]*?<\/script>/gi, '')
  out = out.replace(/<style\b[\s\S]*?<\/style>/gi, '')
  out = out.replace(/<!--[\s\S]*?-->/g, '')
  out = out.replace(/<br\s*\/?>/gi, '\n')
  out = out.replace(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi, (_, inner) => `\n# ${stripTags(String(inner || ''))}\n`)
  out = out.replace(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi, (_, inner) => `\n## ${stripTags(String(inner || ''))}\n`)
  out = out.replace(/<h3\b[^>]*>([\s\S]*?)<\/h3>/gi, (_, inner) => `\n### ${stripTags(String(inner || ''))}\n`)
  out = out.replace(/<p\b[^>]*>([\s\S]*?)<\/p>/gi, (_, inner) => `\n\n${stripTags(String(inner || ''))}\n\n`)
  out = decodeHtmlEntitiesBasic(out.replace(/<[^>]+>/g, ''))
  out = out.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
  return out
}

function normalizeWebpageCardAndListBlocks(markdown: string): string {
  try {
    return postprocessWebpageMarkdownSsot(String(markdown || ''))
  } catch {
    return String(markdown || '')
  }
}

function buildPdfWorkspaceFrontmatter(args: { docId: string; outputDirRel: string }): string {
  return `---\nkgPdfWorkspaceDocId: ${yamlQuote(args.docId)}\nkgPdfWorkspaceOutputDirRel: ${yamlQuote(args.outputDirRel)}\n---\n\n`
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
  const outputDirRel = readPdfWorkspaceOutputDirRel()
  const imported = await importPdfToWorkspace({ file: args.file, outputDirRel })
  if (!imported) throw new Error('PDF import failed')
  if (imported.ok !== true) throw new Error(imported.error || 'PDF import failed')
  const fetched = await fetchPdfWorkspaceDoc({ docId: imported.docId, outputDirRel })
  if (!fetched) throw new Error('PDF import failed')
  if (fetched.ok !== true) throw new Error(fetched.error || 'PDF import failed')
  const markdownRaw = String(fetched.markdown || '')
  const stripped = stripEmbeddedBase64ImageSrc(markdownRaw)
  const notice = stripped.changed ? `> Embedded base64 image data omitted for editor readability.\n\n` : ''
  const text = `${buildPdfWorkspaceFrontmatter({ docId: imported.docId, outputDirRel })}${notice}${stripped.text}`
  return args.fs.createFile({ parentPath: args.parentPath, name: String(imported.name || 'document.md'), text })
}

async function importTextFile(args: { fs: WorkspaceFs; file: File; parentPath: WorkspacePath }): Promise<WorkspacePath> {
  const nameRaw = String(args.file.name || '').trim() || 'file'
  const lower = nameRaw.toLowerCase()
  const rawText = await args.file.text()
  if (lower.endsWith('.kgw')) {
    try {
      const parsed = JSON.parse(rawText) as unknown
      const rec = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null
      const kind = typeof rec?.kind === 'string' ? String(rec.kind || '').trim() : ''
      const version = typeof rec?.version === 'number' ? rec.version : NaN
      const doc = rec?.document && typeof rec.document === 'object' && !Array.isArray(rec.document) ? (rec.document as Record<string, unknown>) : null
      const docText = typeof doc?.text === 'string' ? String(doc.text || '') : null
      if (kind === 'kg:workspaceFile' && version === 1 && docText != null) {
        const docPathRaw = typeof doc?.path === 'string' ? String(doc.path || '').trim() : ''
        const leafRaw = (docPathRaw || nameRaw).replace(/\\/g, '/').split('/').filter(Boolean).pop() || 'document.md'
        const leaf = leafRaw.toLowerCase().endsWith('.md') ? leafRaw : `${leafRaw}.md`
        const safeName = leaf.length > 200 ? leaf.slice(0, 200) : leaf
        return args.fs.createFile({ parentPath: args.parentPath, name: safeName, text: docText })
      }
    } catch {
      void 0
    }
  }
  return args.fs.createFile({ parentPath: args.parentPath, name: nameRaw, text: rawText })
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
      const outputDirRel = readPdfWorkspaceOutputDirRel()
      const imported = await importPdfToWorkspace({ file: pending.file, outputDirRel })
      if (!imported) throw new Error('PDF import failed')
      if (imported.ok !== true) throw new Error(imported.error || 'PDF import failed')
      const fetched = await fetchPdfWorkspaceDoc({ docId: imported.docId, outputDirRel })
      if (!fetched) throw new Error('PDF import failed')
      if (fetched.ok !== true) throw new Error(fetched.error || 'PDF import failed')
      const markdownRaw = String(fetched.markdown || '')
      const stripped = stripEmbeddedBase64ImageSrc(markdownRaw)
      const notice = stripped.changed ? `> Embedded base64 image data omitted for editor readability.\n\n` : ''
      const text = `${buildPdfWorkspaceFrontmatter({ docId: imported.docId, outputDirRel })}${notice}${stripped.text}`
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
  exts.add('.kgw')
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
  const isFileUrl = /^file:\/\//i.test(normalizedUrl)
  const isLocalRepoPath = (!isHttpUrl && !/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(normalizedUrl)) || isFileUrl
  const localRepoPath = isLocalRepoPath
    ? normalizedUrl
        .replace(/^file:\/\//i, '')
        .replace(/\\/g, '/')
        .replace(/^\.+\//, '')
        .replace(/^\/+/, '')
    : ''
  const localSiteRootRel = isLocalRepoPath
    ? (() => {
        const parts = localRepoPath.split('/').filter(Boolean)
        if (parts.length <= 1) return ''
        return parts.slice(0, -1).join('/')
      })()
    : ''

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
    const ctrl = new AbortController()
    const ticker = opts?.onProgress
      ? createProgressTicker({ onProgress: opts.onProgress, intervalMs: 300, maxPercentage: 90, maxStepPercentage: 15 })
      : null
    let includeImages = true
    let defaultView: 'markdown' | 'json' | 'html' = 'html'
    let fidelityLevel: 1 | 2 | 3 | 4 = 4
    let lastFetchedHtml = ''
    let lastDomDiag = ''
    let lastDomTitle = ''
    try {
      ticker?.start()

      const store = useGraphStore.getState()
      includeImages = store.webpageImportIncludeImages !== false
      defaultView = opts?.mode === 'refresh' ? 'html' : store.webpageImportView
      fidelityLevel = (() => {
        const raw = store.webpageArtifactFidelityMaxLevel
        const n = Number.isFinite(raw) ? Math.floor(Number(raw)) : 4
        return n <= 1 ? 1 : n >= 4 ? 4 : (n as 1 | 2 | 3)
      })()

      const looksLikeSubstackUrl = (() => {
        try {
          const u = new URL(normalizedUrl)
          const p = String(u.pathname || '')
          if (/^\/p\/[^/]+\/?$/i.test(p)) return true
          return false
        } catch {
          return false
        }
      })()
      const preferProxyHtml = looksLikeSubstackUrl
      if (looksLikeSubstackUrl) {
        defaultView = 'markdown'
        includeImages = true
        fidelityLevel = 4
      }

      const autoTuneFromHtml = (html: string) => {
        const h = String(html || '')
        const isSubstackLike =
          /substackcdn\.com/i.test(h) ||
          /\bdata-page\s*=\s*["'][^"']+/i.test(h) ||
          /failed\s+to\s+load\s+posts/i.test(h) ||
          /enable-javascript\.com/i.test(h) ||
          /requires\s+java\s*script/i.test(h)
        const looksHuge = h.length > 5_000_000
        const tuned = {
          isSubstackLike,
          includeImages: isSubstackLike ? true : looksHuge ? false : includeImages,
          fidelityLevel: (isSubstackLike ? 4 : looksHuge ? 2 : fidelityLevel) as 1 | 2 | 3 | 4,
          defaultView: (isSubstackLike ? 'markdown' : defaultView) as 'markdown' | 'json' | 'html',
          shouldConvertToMarkdown: opts?.mode !== 'refresh' ? true : isSubstackLike,
        }
        return tuned
      }
      const looksLikeJsShellText = (text: string): boolean => {
        const t = String(text || '')
        if (!t.trim()) return false
        if (/failed\s+to\s+load\s+posts/i.test(t)) return true
        if (/enable-javascript\.com/i.test(t)) return true
        if (/requires\s+java\s*script/i.test(t)) return true
        if (/page not foundlatesttopdiscussions/i.test(t.replace(/\s+/g, ''))) return true
        return false
      }

      const upstreamMarkdown = await (async () => {
        if (opts?.mode !== 'refresh' && !preferProxyHtml) {
          try {
            const [textDom, htmlDom] = await Promise.all([
              exportWebpageDomViaHiddenIframe({
                url: normalizedUrl,
                mode: 'text',
                timeoutMs: 45_000,
                maxChars: 12_000_000,
                scrollCrawl: true,
                expandFaq: true,
                minWaitAfterLoadMs: 650,
                signal: ctrl.signal,
              }),
              exportWebpageDomViaHiddenIframe({
                url: normalizedUrl,
                mode: 'html',
                timeoutMs: 45_000,
                maxChars: 12_000_000,
                scrollCrawl: true,
                expandFaq: true,
                minWaitAfterLoadMs: 650,
                signal: ctrl.signal,
              }),
            ])
            const domDiag = String(htmlDom?.diag || textDom?.diag || '').trim()
            if (domDiag) lastDomDiag = domDiag
            const domTitle = String(htmlDom?.title || textDom?.title || '').trim()
            if (domTitle) lastDomTitle = domTitle

            const htmlText = String(htmlDom?.text || '')
            if (htmlText.trim()) {
              lastFetchedHtml = htmlText
              const tuned = autoTuneFromHtml(lastFetchedHtml)
              includeImages = tuned.includeImages
              fidelityLevel = tuned.fidelityLevel
              defaultView = tuned.defaultView
              opts?.onProgress?.(55)
              const converted = await convertHtmlToMarkdownUnified({
                html: htmlText,
                baseUrl: normalizedUrl,
                maxInputChars: 12_000_000,
                includeImages,
                fidelityLevel,
                includeHeadSection: false,
              })
              if (converted.ok === true && converted.markdown.trim()) {
                const processed = normalizeWebpageCardAndListBlocks(converted.markdown)
                const trimmed = processed.trim()
                const title = String(htmlDom?.title || textDom?.title || '').trim()
                if (trimmed.length >= 400) return trimmed
                if (title && trimmed && trimmed.length <= 120 && trimmed.replace(/\s+/g, ' ').trim() === title.replace(/\s+/g, ' ').trim()) {
                  void 0
                } else if (trimmed.length >= 220) {
                  return trimmed
                }
              }
            }

            const textOnly = String(textDom?.text || '').trim()
            const title = String(htmlDom?.title || textDom?.title || '').trim() || undefined
            if (textOnly.length >= 400) {
              if (!looksLikeJsShellText(textOnly)) {
                return plainTextToMarkdown(textOnly, title)
              }
            }
          } catch {
            void 0
          }
        }

        if (opts?.mode !== 'refresh' && !preferProxyHtml) {
          try {
            const converted = await fetchWebpageMarkdown(normalizedUrl, { includeImages })
            if (converted && converted.ok === true && typeof converted.markdown === 'string') {
              return String(converted.markdown || '')
            }
          } catch {
            void 0
          }
        }

        const fetchImpl = (globalThis as unknown as { fetch?: unknown }).fetch
        const rawHtml = await fetchWebpageHtmlAuto({
          url: normalizedUrl,
          signal: ctrl.signal,
          bypassCache: opts?.mode === 'refresh',
          fetchImpl: typeof fetchImpl === 'function' ? (fetchImpl as typeof fetch) : undefined,
        })
        const boundedHtml = rawHtml.length > 5_000_000 ? rawHtml.slice(0, 5_000_000) : rawHtml
        lastFetchedHtml = boundedHtml
        const tuned = autoTuneFromHtml(lastFetchedHtml)
        includeImages = tuned.includeImages
        fidelityLevel = tuned.fidelityLevel
        defaultView = tuned.defaultView
        opts?.onProgress?.(65)
        const markdown = tuned.shouldConvertToMarkdown
          ? await (async () => {
              try {
                const converted = await convertHtmlToMarkdownUnified({
                  html: boundedHtml,
                  baseUrl: normalizedUrl,
                  maxInputChars: 5_000_000,
                  includeImages,
                  fidelityLevel,
                  includeHeadSection: false,
                })
                if (converted.ok === true && converted.markdown.trim()) {
                  return normalizeWebpageCardAndListBlocks(converted.markdown)
                }
              } catch {
                void 0
              }
              return ''
            })()
          : ''
        opts?.onProgress?.(85)
        if (markdown.trim()) return markdown.trim()
        return htmlFallbackToMarkdownAllText(boundedHtml)
      })()

      ticker?.stop()
      opts?.onProgress?.(95)

      const text = await runInIdle(
        () =>
          buildWebpageWorkspaceEntryTextFromUpstreamMarkdown({
            upstreamMarkdown,
            url: normalizedUrl,
            view: defaultView,
            title: lastDomTitle,
            diag: lastDomDiag,
          }),
        { timeoutMs: 80 },
      )
      opts?.onProgress?.(100)
      if (text && text.trim() && !isFrontmatterOnlyDoc(text)) return { normalizedUrl, name, text }

      const minimal = [
        '---',
        `kgWebpageUrl: ${yamlQuote(normalizedUrl)}`,
        `kgWebpageView: ${yamlQuote(defaultView)}`,
        '---',
        '',
        String(upstreamMarkdown || '').trim(),
        '',
      ].join('\n')
      if (minimal.trim() && !isFrontmatterOnlyDoc(minimal)) return { normalizedUrl, name, text: minimal }
    } catch {
      if (opts?.mode === 'refresh') {
        const recoveredBody = lastFetchedHtml ? htmlFallbackToMarkdownAllText(lastFetchedHtml) : ''
        const recovered = [
          '---',
          `kgWebpageUrl: ${yamlQuote(normalizedUrl)}`,
          `kgWebpageView: ${yamlQuote(defaultView)}`,
          '---',
          '',
          recoveredBody.trim(),
          '',
        ].join('\n')
        if (recovered.trim() && !isFrontmatterOnlyDoc(recovered)) return { normalizedUrl, name, text: recovered }
      }
    } finally {
      ticker?.stop()
      try {
        ctrl.abort()
      } catch {
        void 0
      }
    }
    const text = [
      '---',
      `kgWebpageUrl: ${yamlQuote(normalizedUrl)}`,
      `kgWebpageView: ${yamlQuote('html')}`,
      '---',
      '',
    ].join('\n')
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
    const res = await fetch(buildRepoFilePath(localRepoPath), { headers: { Accept: '*/*' } })
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
  diag?: string
  scriptPolicy?: 'strip' | 'allow'
  fidelityLevel?: 1 | 2 | 3 | 4
  includeImages?: boolean
  websiteImportMeta?: { importId: string; nodeId: string; outputDirRel?: string } | null
}): string {
  const url = String(args.url || '').trim()
  const view = args.view === 'html' ? 'html' : args.view === 'json' ? 'json' : 'markdown'
  const scriptPolicy = args.scriptPolicy === 'allow' ? 'allow' : args.scriptPolicy === 'strip' ? 'strip' : ''
  const fidelityLevel =
    args.fidelityLevel === 1 || args.fidelityLevel === 2 || args.fidelityLevel === 3 || args.fidelityLevel === 4
      ? args.fidelityLevel
      : 0
  const includeImages = args.includeImages === true ? true : args.includeImages === false ? false : null
  const upstreamSanitized = sanitizeImportedMarkdownText(String(args.upstreamMarkdown || ''), { sourceUrl: url }).text
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
  if (scriptPolicy) fmLines.push(`kgWebpageScriptPolicy: ${yamlQuote(scriptPolicy)}`)
  if (fidelityLevel) fmLines.push(`kgWebpageFidelityLevel: ${yamlQuote(String(fidelityLevel))}`)
  if (includeImages != null) fmLines.push(`kgWebpageIncludeImages: ${yamlQuote(includeImages ? 'true' : 'false')}`)

  const importId = String(args.websiteImportMeta?.importId || '').trim()
  const nodeId = String(args.websiteImportMeta?.nodeId || '').trim()
  const outputDirRel = String(args.websiteImportMeta?.outputDirRel || '').trim()
  if (importId) fmLines.push(`kgWebsiteImportId: ${yamlQuote(importId)}`)
  if (nodeId) fmLines.push(`kgWebsiteNodeId: ${yamlQuote(nodeId)}`)
  if (outputDirRel) fmLines.push(`kgWebsiteOutputDirRel: ${yamlQuote(outputDirRel)}`)

  const withView = upsertWebpageFrontmatterMeta(strippedUpstream, { url, view })
  const body = (() => {
    const t = String(withView || '')
    if (!t.startsWith('---')) return t
    const end = t.indexOf('\n---')
    if (end < 0) return t
    return t.slice(end + 4).replace(/^\s*\n/, '')
  })()
  const normalizedBody = normalizeWebpageCardAndListBlocks(body)
  const title = String(args.title || '').replace(/\s+/g, ' ').trim()
  const diag = String(args.diag || '').trim()
  const bodyText = String(normalizedBody || '').trim()
  if (
    diag &&
    bodyText &&
    bodyText.length <= 140 &&
    (!title || bodyText.replace(/\s+/g, ' ').trim() === title)
  ) {
    fmLines.push(...yamlBlockScalar('kgWebpageDiagnostics', diag))
  }
  fmLines.push('---', '')
  return [...fmLines, bodyText].join('\n').trimEnd() + '\n'
}

export function buildWebsiteImportWebpageDocFromUpstreamMarkdown(args: {
  upstreamMarkdown: string
  url: string
  view: 'markdown' | 'json' | 'html'
  websiteImportMeta: { importId: string; nodeId: string; outputDirRel?: string }
}): string {
  const url = String(args.url || '').trim()
  const view = args.view === 'html' ? 'html' : args.view === 'json' ? 'json' : 'markdown'
  const upstreamSanitized = sanitizeImportedMarkdownText(String(args.upstreamMarkdown || ''), { sourceUrl: url }).text
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
  const normalizedBody = normalizeWebpageCardAndListBlocks(body)
  return [...fmLines, String(normalizedBody || '').trim()].join('\n').trimEnd() + '\n'
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
