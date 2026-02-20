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
import { convertWebpageHtmlToMarkdownArtifactAsync } from '@/lib/websites/webpageHtmlToMarkdownArtifact'
import { exportWebpageDomViaHiddenIframe } from '@/lib/websites/webpageDomExport'
import { convertHtmlToMarkdownUnified } from '@/lib/markdown/htmlToMarkdownUnified'
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

type PdfWorkspaceImportMode = 'text-only' | 'image-heavy' | 'scan-ocr'

function coercePdfWorkspaceImportMode(raw: unknown): PdfWorkspaceImportMode {
  return raw === 'image-heavy' ? 'image-heavy' : raw === 'scan-ocr' ? 'scan-ocr' : 'text-only'
}

function yamlQuote(value: string): string {
  return `"${String(value || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}



function normalizeWebpageCardAndListBlocks(markdown: string): string {
  const src = String(markdown || '')
  if (!src.trim()) return src
  const lines = src.replace(/\r/g, '').split('\n')
  const out: string[] = []

  const isHeading = (l: string) => /^#{1,6}\s+/.test(String(l || '').trim())
  const isDivider = (l: string) => /^---\s*$/.test(String(l || '').trim())
  const isAlreadyStructured = (l: string) => /^\s*(?:[-*+]\s+|\d+\.\s+|\|)/.test(String(l || ''))

  const flushGroup = (group: string[]) => {
    const parts = group.map(s => String(s || '').trim()).filter(Boolean)
    if (parts.length < 6) {
      out.push(...group)
      return
    }
    const tooLong = parts.some(p => p.length > 96)
    const punct = parts.some(p => /[.!?:;]$/.test(p))
    if (tooLong || punct) {
      out.push(...group)
      return
    }

    const cards: Array<{ title: string; items: string[] }> = []
    let cur: { title: string; items: string[] } | null = null
    let i = 0
    while (i < parts.length) {
      const p = parts[i] || ''
      const next = i + 1 < parts.length ? (parts[i + 1] || '') : ''
      const isForLine = /^For\s+/i.test(p)
      if (isForLine && next) {
        if (cur) cards.push(cur)
        cur = { title: next, items: [p] }
        i += 2
        continue
      }
      if (!cur) {
        cur = { title: '', items: [] }
      }
      cur.items.push(p)
      i += 1
    }
    if (cur) cards.push(cur)

    const usableCards = cards.filter(c => c.title.trim() && c.items.length >= 3)
    if (usableCards.length >= 2 && usableCards.length <= 4) {
      const headers = usableCards.map(c => c.title.trim().replace(/\|/g, '\\|'))
      out.push(`| ${headers.join(' | ')} |`)
      out.push(`| ${headers.map(() => '---').join(' | ')} |`)
      const rowCells = usableCards.map(c => c.items.map(it => `- ${it.trim().replace(/\|/g, '\\|')}`).join('<br>'))
      out.push(`| ${rowCells.join(' | ')} |`)
      out.push('')
      return
    }

    out.push(...parts.map(p => `- ${p}`))
    out.push('')
  }

  const pending: string[] = []
  const pendingRaw: string[] = []
  const flushPendingRaw = () => {
    if (!pendingRaw.length) return
    flushGroup(pendingRaw)
    pendingRaw.length = 0
  }

  for (let idx = 0; idx < lines.length; idx += 1) {
    const line = lines[idx] || ''
    const trimmed = line.trim()
    if (!trimmed) {
      pending.push(line)
      if (pendingRaw.length) pendingRaw.push('')
      continue
    }
    if (isHeading(line) || isDivider(line) || isAlreadyStructured(line)) {
      flushPendingRaw()
      out.push(...pending)
      pending.length = 0
      out.push(line)
      continue
    }
    if (pending.length && pending.every(l => !String(l || '').trim())) {
      out.push(...pending)
      pending.length = 0
    }
    pendingRaw.push(trimmed)
  }

  if (pendingRaw.length) flushPendingRaw()
  if (pending.length) out.push(...pending)
  return out.join('\n')
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
    const mode = opts?.mode === 'refresh' ? 'refresh' : 'import'
    if (mode === 'import') {
      const store = useGraphStore.getState()
      const includeImages = store.webpageImportIncludeImages !== false
      const fidelityLevel = (() => {
        const raw = store.webpageArtifactFidelityMaxLevel
        const n = Number.isFinite(raw) ? Math.floor(Number(raw)) : 4
        return n <= 1 ? 1 : n >= 4 ? 4 : (n as 1 | 2 | 3)
      })()
      const text = [
        '---',
        `kgWebpageUrl: ${yamlQuote(normalizedUrl)}`,
        `kgWebpageView: ${yamlQuote('html')}`,
        `kgWebpageScriptPolicy: ${yamlQuote('allow')}`,
        `kgWebpageIncludeImages: ${yamlQuote(includeImages ? 'true' : 'false')}`,
        `kgWebpageFidelityLevel: ${yamlQuote(String(fidelityLevel))}`,
        '---',
        '',
      ].join('\n')
      return { normalizedUrl, name, text }
    }
    const ctrl = new AbortController()
    const ticker = opts?.onProgress
      ? createProgressTicker({ onProgress: opts.onProgress, intervalMs: 300, maxPercentage: 90, maxStepPercentage: 15 })
      : null
    try {
      ticker?.start()

      const store = useGraphStore.getState()
      const includeImages = store.webpageImportIncludeImages !== false
      const defaultView = store.webpageImportView
      const fidelityLevel = (() => {
        const raw = store.webpageArtifactFidelityMaxLevel
        const n = Number.isFinite(raw) ? Math.floor(Number(raw)) : 4
        return n <= 1 ? 1 : n >= 4 ? 4 : (n as 1 | 2 | 3)
      })()

      const upstreamMarkdown = await (async () => {
        try {
          const dom = await exportWebpageDomViaHiddenIframe({
            url: normalizedUrl,
            mode: 'html',
            timeoutMs: 30_000,
            maxChars: 10_000_000,
            scrollCrawl: true,
            expandFaq: true,
          })
          if (dom && dom.text && dom.text.trim()) {
            opts?.onProgress?.(55)
            const converted = await convertHtmlToMarkdownUnified({
              html: dom.text,
              baseUrl: normalizedUrl,
              maxInputChars: 10_000_000,
              includeImages,
              fidelityLevel,
            })
            if (converted.ok === true && converted.markdown.trim()) return converted.markdown.trim()
          }
        } catch {
          void 0
        }

        try {
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
        try {
          const unified = await convertHtmlToMarkdownUnified({
            html: boundedHtml,
            baseUrl: normalizedUrl,
            maxInputChars: 5_000_000,
            includeImages,
            fidelityLevel,
          })
          if (unified.ok === true && unified.markdown.trim()) return unified.markdown.trim()
        } catch {
          void 0
        }

        const converted = await convertWebpageHtmlToMarkdownArtifactAsync({ html: boundedHtml, url: normalizedUrl })
        opts?.onProgress?.(85)
        return converted
      })()

      ticker?.stop()
      opts?.onProgress?.(95)

      const text = await runInIdle(
        () =>
          buildWebpageWorkspaceEntryTextFromUpstreamMarkdown({
            upstreamMarkdown,
            url: normalizedUrl,
            view: defaultView,
            scriptPolicy: 'allow',
            fidelityLevel,
            includeImages,
          }),
        { timeoutMs: 80 },
      )
      opts?.onProgress?.(100)
      if (text && text.trim() && !isFrontmatterOnlyDoc(text)) return { normalizedUrl, name, text }
    } catch {
      void 0
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
      `kgWebpageScriptPolicy: ${yamlQuote('allow')}`,
      `kgWebpageIncludeImages: ${yamlQuote('true')}`,
      `kgWebpageFidelityLevel: ${yamlQuote('4')}`,
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
        `kgWebpageScriptPolicy: ${yamlQuote('allow')}`,
        `kgWebpageIncludeImages: ${yamlQuote('true')}`,
        `kgWebpageFidelityLevel: ${yamlQuote('4')}`,
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
  if (scriptPolicy) fmLines.push(`kgWebpageScriptPolicy: ${yamlQuote(scriptPolicy)}`)
  if (fidelityLevel) fmLines.push(`kgWebpageFidelityLevel: ${yamlQuote(String(fidelityLevel))}`)
  if (includeImages != null) fmLines.push(`kgWebpageIncludeImages: ${yamlQuote(includeImages ? 'true' : 'false')}`)

  const importId = String(args.websiteImportMeta?.importId || '').trim()
  const nodeId = String(args.websiteImportMeta?.nodeId || '').trim()
  const outputDirRel = String(args.websiteImportMeta?.outputDirRel || '').trim()
  if (importId) fmLines.push(`kgWebsiteImportId: ${yamlQuote(importId)}`)
  if (nodeId) fmLines.push(`kgWebsiteNodeId: ${yamlQuote(nodeId)}`)
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
  return [...fmLines, normalizedBody].join('\n')
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
