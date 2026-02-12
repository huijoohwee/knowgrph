import { useGraphStore } from '@/hooks/useGraphStore'
import { createId } from '@/lib/id'
import { pickFileWithExtensions } from '@/lib/graph/filePicker'
import { SOURCE_FILES_FORMATS } from '@/lib/config.copy'
import { deriveFilenameFromUrl, normalizeGitHubBlobLikeUrl, unwrapUserProvidedText } from '@/lib/url'
import { fetchRemoteTextDetailed } from '@/lib/net/fetchRemoteText'
import { describeFetchRemoteTextFailure } from '@/lib/net/fetchRemoteTextFailure'
import { downloadBlob } from '@/lib/graph/save'
import { exportAsCombinedCsvBlob, exportAsJsonLdBlob, exportAsRawJsonBlob } from '@/lib/graph/io/adapter'
import { exportAsGeoJsonBlob } from '@/lib/graph/io/geojson'
import { normalizeMermaidMmdToMarkdown } from 'grph-shared/markdown/mermaidInput'
import { runImportFlow } from '@/features/toolbar/importFlow'
import { applyImportedCsvToStore, applyImportedJsonToStore } from '@/features/toolbar/importSideEffects'
import { hashStringToHex } from '@/lib/hash/stringHash'
import { applyComposedGraphFromSourceFiles } from '@/features/source-files/applyComposedGraphFromSourceFiles'
import { findNextSourceFileIndex } from '@/features/source-files/sourceFileNaming'
import { writeLocalMarkdownFileText } from '@/features/source-files/localMarkdownFolder'
import { getMostRecentCachedMarkdownFolderId, writeCachedMarkdownText } from '@/features/source-files/markdownFsCache'
import { useGympgrphStore } from 'gympgrph'
import type { MarkdownSourceFilesIngestIntegration } from 'curagrph/features/markdown/ui/MarkdownSourceFilesIngestIntegration.ts'
import { convertPdfFileToMarkdown, convertPdfUrlToMarkdown, fetchYouTubeTranscriptMarkdown, fetchWebpageMarkdown } from '@/lib/net/remoteMarkdownConversions'
import { sanitizeImportedMarkdownText } from '@/lib/markdown/sanitizeImportedMarkdown'

const SUPPORTED_SOURCE_FILE_IMPORT_EXTENSIONS = [...SOURCE_FILES_FORMATS.import]

const isJsonishName = (name: string): boolean => {
  const lower = String(name || '').trim().toLowerCase()
  return (
    lower.endsWith('.json') ||
    lower.endsWith('.jsonld') ||
    lower.endsWith('.geojson') ||
    lower.endsWith('.csv') ||
    lower.endsWith('.yaml') ||
    lower.endsWith('.yml')
  )
}

const inferExportFormatFromName = (name: string): (typeof SOURCE_FILES_FORMATS.export)[number] => {
  const lower = String(name || '').trim().toLowerCase()
  if (lower.endsWith('.jsonld')) return '.jsonld'
  if (lower.endsWith('.geojson')) return '.geojson'
  if (lower.endsWith('.json')) return '.json'
  if (lower.endsWith('.csv')) return '.csv'
  if (lower.endsWith('.html') || lower.endsWith('.htm')) return '.html'
  if (lower.endsWith('.yaml') || lower.endsWith('.yml')) return '.yaml'
  if (lower.endsWith('.txt')) return '.txt'
  return '.md'
}

const buildExportFilename = (rawName: string, ext: string) => {
  const base = String(rawName || '').trim() || 'source'
  const stem = base.replace(/\.(pdf|html|htm|jsonld|geojson|json|yaml|yml|md|markdown|txt|csv)$/i, '') || 'source'
  return `${stem}${ext}`
}

 

function ensureTargetSourceFileId(args: { fileId: string | null; suggestedName?: string | null }): string {
  const store = useGraphStore.getState()
  const existing = Array.isArray(store.sourceFiles) ? store.sourceFiles : []
  if (args.fileId) {
    const found = existing.find(f => f.id === args.fileId)
    if (found) return found.id
  }
  const suggested = String(args.suggestedName || '').trim()
  const nextName =
    suggested || (() => {
      const idx = findNextSourceFileIndex(existing.map(f => String(f.name || '')), '')
      return `source-${idx}.md`
    })()
  const id = createId('sf')
  store.addSourceFile({ id, name: nextName, text: '', enabled: true, status: 'idle', source: { kind: 'local', path: nextName } })
  return id
}

function syncDocumentViewFromSourceFile(
  file: { name: string; text: string; source?: { kind: 'url' | 'local'; url?: string } },
  opts?: { applyToGraph?: boolean },
) {
  const store = useGraphStore.getState()
  const baselineLocked = store.documentStructureBaselineLock === true
  const name = String(file.name || '').trim() || 'source.md'
  const text = String(file.text || '')
  const sourceUrl = file.source?.kind === 'url' ? String(file.source?.url || '').trim() : ''
  if (isJsonishName(name)) {
    const lower = name.toLowerCase()
    if (lower.endsWith('.csv')) {
      applyImportedCsvToStore({ name, text, sourceUrl: sourceUrl || null })
      return
    }
    if (lower.endsWith('.json') || lower.endsWith('.jsonld') || lower.endsWith('.geojson')) {
      applyImportedJsonToStore({
        name,
        text,
        fallbackFenceLang: lower.endsWith('.jsonld') ? 'jsonld' : 'json',
        sourceUrl: sourceUrl || null,
      })
      return
    }

    const trimmed = text.trim()
    const fencedLang = lower.endsWith('.yml') || lower.endsWith('.yaml') ? 'yaml' : 'text'
    const markdown = trimmed ? ['```' + fencedLang, trimmed, '```', ''].join('\n') : text
    store.setJsonSourceDocument(name, null)
    store.setMarkdownDocument(name, markdown)
    store.setMarkdownDocumentSourceUrl(sourceUrl || null)
    if (!baselineLocked) store.setWorkspaceViewMode('editor')
    return
  }
  const normalized = normalizeMermaidMmdToMarkdown(name, text)
  store.setMarkdownDocument(name, normalized)
  store.setMarkdownDocumentSourceUrl(sourceUrl || null)
  if (!baselineLocked) store.setWorkspaceViewMode('editor')
  if (opts?.applyToGraph ?? true) {
    void store.applyMarkdownDocumentToGraph(name, normalized, { force: true })
  }
}

async function parseAndApplySourceFile(fileId: string): Promise<void> {
  const before = useGraphStore.getState().sourceFiles.find(f => f.id === fileId)
  if (!before) return
  const text = String(before.text || '')
  if (!text.trim()) return

  const store = useGraphStore.getState()
  store.updateSourceFile(fileId, { status: 'loading', error: undefined })

  const res = await runImportFlow({ nameForParse: before.name, textForParse: text, applyToStore: false })
  const parsedOk = !!(res && res.graphData && res.parserId && res.counts && (res.counts.n > 0 || res.counts.e > 0))
  if (parsedOk) {
    store.updateSourceFile(fileId, {
      status: 'parsed',
      error: undefined,
      parsedParserId: res?.parserId,
      parsedTextHash: hashStringToHex(text),
      parsedGraphData: res?.graphData,
    })
    applyComposedGraphFromSourceFiles()
    return
  }

  const msg =
    res && Array.isArray(res.warnings) && typeof res.warnings[0] === 'string' && res.warnings[0].trim()
      ? res.warnings[0].trim()
      : 'Parse failed'
  store.updateSourceFile(fileId, { status: 'error', error: msg, parsedGraphData: undefined })
}

function exportActiveSourceFile(args: { fileId: string | null }) {
  const store = useGraphStore.getState()
  const file = args.fileId ? store.sourceFiles.find(f => f.id === args.fileId) : null
  if (!file) return
  const format = inferExportFormatFromName(file.name)
  const filename = buildExportFilename(file.name, format)
  if (format === '.jsonld' && file.parsedGraphData) {
    downloadBlob(exportAsJsonLdBlob(file.parsedGraphData), filename)
    return
  }
  if (format === '.json' && file.parsedGraphData) {
    downloadBlob(exportAsRawJsonBlob(file.parsedGraphData), filename)
    return
  }
  if (format === '.csv' && file.parsedGraphData) {
    downloadBlob(exportAsCombinedCsvBlob(file.parsedGraphData), filename)
    return
  }
  if (format === '.geojson' && file.parsedGraphData) {
    downloadBlob(exportAsGeoJsonBlob(file.parsedGraphData), filename)
    return
  }
  const content = String(file.text || '')
  if (!content.trim()) return
  const mime =
    format === '.md'
      ? 'text/markdown;charset=utf-8'
      : format === '.html'
        ? 'text/html;charset=utf-8'
        : format === '.yaml'
          ? 'text/yaml;charset=utf-8'
          : 'text/plain;charset=utf-8'
  const blob = new Blob([content], { type: mime })
  downloadBlob(blob, filename)
}

function clearActiveSourceFile(args: { fileId: string | null }) {
  const store = useGraphStore.getState()
  const file = args.fileId ? store.sourceFiles.find(f => f.id === args.fileId) : null
  if (!file) return
  store.updateSourceFile(file.id, {
    text: '',
    status: 'idle',
    error: undefined,
    parsedParserId: undefined,
    parsedTextHash: undefined,
    parsedGraphData: undefined,
  })
  syncDocumentViewFromSourceFile(
    {
      name: file.name,
      text: '',
      source: file.source?.kind === 'url' ? { kind: 'url', url: String(file.source.url || '').trim() } : { kind: 'local' },
    },
    { applyToGraph: false },
  )

  if (file.source?.kind === 'local') {
    const relativePath = String(file.source?.path || file.name || '').trim()
    if (relativePath) {
      void (async () => {
        try {
          if (store.localMarkdownFolderHandle) {
            await writeLocalMarkdownFileText(relativePath, '')
            return
          }
          const cacheId =
            String(store.localMarkdownFolderCacheId || '').trim() || (await getMostRecentCachedMarkdownFolderId())
          if (cacheId) {
            await writeCachedMarkdownText(cacheId, relativePath, '')
          }
        } catch {
          store.pushUiToast({
            id: 'source-file-clear-local-failed',
            kind: 'warning',
            message: `Cleared in-app copy only: ${String(file.name || '').trim() || 'local file'}`,
          })
        }
      })()
    }
  }
  if (file.enabled) applyComposedGraphFromSourceFiles()
}

async function importLocalIntoActive(args: { fileId: string | null }): Promise<void> {
  const store = useGraphStore.getState()
  const { geospatialDatasetMaxBytes } = useGympgrphStore.getState()
  const picked = await pickFileWithExtensions([...SUPPORTED_SOURCE_FILE_IMPORT_EXTENSIONS])
  if (!picked) return
  if (typeof picked.size === 'number' && Number.isFinite(picked.size) && picked.size > geospatialDatasetMaxBytes) {
    const mb = (picked.size / (1024 * 1024)).toFixed(1)
    const limitMb = (geospatialDatasetMaxBytes / (1024 * 1024)).toFixed(1)
    const id = ensureTargetSourceFileId({ fileId: args.fileId, suggestedName: picked.name })
    store.updateSourceFile(id, { status: 'error', error: `Too large (${mb} MB > ${limitMb} MB)` })
    return
  }

  const lower = String(picked.name || '').toLowerCase()
  const id = ensureTargetSourceFileId({ fileId: args.fileId, suggestedName: picked.name })
  store.updateSourceFile(id, { status: 'loading', error: undefined, enabled: true })

  if (/\.(pdf)(\?|#|$)/i.test(lower)) {
    const converted = await convertPdfFileToMarkdown(picked)
    if (!converted) {
      store.updateSourceFile(id, { status: 'error', error: 'Request failed' })
      return
    }
    if (converted.ok === false) {
      store.updateSourceFile(id, { status: 'error', error: converted.error })
      return
    }
    store.updateSourceFile(id, {
      name: converted.name,
      text: converted.markdown,
      status: 'idle',
      error: undefined,
      parsedParserId: undefined,
      parsedTextHash: undefined,
      parsedGraphData: undefined,
      source: { kind: 'local', path: picked.name },
      enabled: true,
    })
    syncDocumentViewFromSourceFile({ name: converted.name, text: converted.markdown, source: { kind: 'local' } })
    await parseAndApplySourceFile(id)
    return
  }

  const text = await picked.text()
  store.updateSourceFile(id, {
    name: picked.name,
    text,
    status: 'idle',
    error: undefined,
    parsedParserId: undefined,
    parsedTextHash: undefined,
    parsedGraphData: undefined,
    source: { kind: 'local', path: picked.name },
    enabled: true,
  })
  syncDocumentViewFromSourceFile({ name: picked.name, text, source: { kind: 'local' } })
  await parseAndApplySourceFile(id)
}

async function importUrlIntoActive(args: { fileId: string | null; url: string; format?: 'markdown' | 'json' }): Promise<void> {
  const store = useGraphStore.getState()
  const { geospatialDatasetTimeoutMs, geospatialDatasetMaxBytes } = useGympgrphStore.getState()
  const rawUrl = unwrapUserProvidedText(String(args.url || '').trim()) || String(args.url || '').trim()
  if (!rawUrl) return
  const normalizedUrl = normalizeGitHubBlobLikeUrl(rawUrl) || rawUrl
  const lower = normalizedUrl.toLowerCase()

  const id = ensureTargetSourceFileId({ fileId: args.fileId, suggestedName: deriveFilenameFromUrl(normalizedUrl, 'source.txt') })
  store.updateSourceFile(id, { status: 'loading', error: undefined, enabled: true, source: { kind: 'url', url: normalizedUrl } })

  try {
    const isYouTube = lower.includes('youtube.com') || lower.includes('youtu.be')
    if (isYouTube) {
      const yt = await fetchYouTubeTranscriptMarkdown(normalizedUrl)
      if (!yt) {
        store.updateSourceFile(id, { status: 'error', error: 'Request failed' })
        return
      }
      if (yt.ok === false) {
        store.updateSourceFile(id, { status: 'error', error: yt.error })
        return
      }

      let videoId = ''
      try {
        if (yt.transcriptJsonText) {
          const parsed = JSON.parse(yt.transcriptJsonText)
          if (parsed && typeof parsed.video_id === 'string') {
            videoId = parsed.video_id
          }
        }
      } catch {
        void 0
      }

      const effectiveFormat = args.format === 'json' ? 'json' : 'markdown'
      const frontmatter = videoId
        ? `---\nkgYoutubeVideoId: "${videoId}"\nkgYoutubeFormat: "${effectiveFormat}"\n---\n\n`
        : ''

      // Handle JSON format preference
      if (effectiveFormat === 'json' && yt.transcriptJsonText) {
        // Keep .md extension so it opens in Markdown Workspace
        const content = `${frontmatter}\`\`\`json\n${yt.transcriptJsonText}\n\`\`\`\n`
        store.updateSourceFile(id, {
          name: yt.name,
          text: content,
          status: 'idle',
          error: undefined,
          parsedParserId: undefined,
          parsedTextHash: undefined,
          parsedGraphData: undefined,
          source: { kind: 'url', url: normalizedUrl },
          enabled: true,
        })
        syncDocumentViewFromSourceFile({ name: yt.name, text: content, source: { kind: 'url', url: normalizedUrl } })
        await parseAndApplySourceFile(id)
        return
      }

      const content = `${frontmatter}${yt.markdown}`
      store.updateSourceFile(id, {
        name: yt.name,
        text: content,
        status: 'idle',
        error: undefined,
        parsedParserId: undefined,
        parsedTextHash: undefined,
        parsedGraphData: undefined,
        source: { kind: 'url', url: normalizedUrl },
        enabled: true,
      })

      syncDocumentViewFromSourceFile({ name: yt.name, text: content, source: { kind: 'url', url: normalizedUrl } })
      await parseAndApplySourceFile(id)
      return
    }

    if (/\.(pdf)(\?|#|$)/i.test(lower)) {
      const converted = await convertPdfUrlToMarkdown(normalizedUrl)
      if (!converted) {
        store.updateSourceFile(id, { status: 'error', error: 'Request failed' })
        return
      }
      if (converted.ok === false) {
        store.updateSourceFile(id, { status: 'error', error: converted.error })
        return
      }
      store.updateSourceFile(id, {
        name: converted.name,
        text: converted.markdown,
        status: 'idle',
        error: undefined,
        parsedParserId: undefined,
        parsedTextHash: undefined,
        parsedGraphData: undefined,
        source: { kind: 'url', url: normalizedUrl },
        enabled: true,
      })
      syncDocumentViewFromSourceFile({ name: converted.name, text: converted.markdown, source: { kind: 'url', url: normalizedUrl } })
      await parseAndApplySourceFile(id)
      return
    }

    const looksLikeCodeOrData = /\.(json|jsonld|geojson|csv|yaml|yml|txt|js|ts|py)(\?|#|$)/i.test(lower)
    if (!looksLikeCodeOrData) {
      const includeImages = useGraphStore.getState().webpageImportIncludeImages ?? true
      const view = (() => {
        const v = useGraphStore.getState().webpageImportView
        if (v === 'html') return 'html'
        if (v === 'json') return 'json'
        if (v === 'wireframe') return 'wireframe'
        return 'markdown'
      })()
      const webpage = await fetchWebpageMarkdown(normalizedUrl, { includeImages })
      if (webpage && webpage.ok) {
        const frontmatter = `---\nkgWebpageUrl: "${normalizedUrl}"\nkgWebpageView: "${view}"\n---\n\n`
        const content = sanitizeImportedMarkdownText(`${frontmatter}${webpage.markdown}`).text
        store.updateSourceFile(id, {
          name: webpage.name,
          text: content,
          status: 'idle',
          error: undefined,
          parsedParserId: undefined,
          parsedTextHash: undefined,
          parsedGraphData: undefined,
          source: { kind: 'url', url: normalizedUrl },
          enabled: true,
        })
        syncDocumentViewFromSourceFile({ name: webpage.name, text: content, source: { kind: 'url', url: normalizedUrl } })
        await parseAndApplySourceFile(id)
        return
      }
    }

    const res = await fetchRemoteTextDetailed(normalizedUrl, {
      preflightHead: true,
      timeoutMs: geospatialDatasetTimeoutMs,
      maxBytes: geospatialDatasetMaxBytes,
    })
    if (res.ok === false) {
      store.updateSourceFile(id, { status: 'error', error: describeFetchRemoteTextFailure(res) })
      return
    }

    const nextName = deriveFilenameFromUrl(normalizedUrl, 'source.txt')
    store.updateSourceFile(id, {
      name: nextName,
      text: res.text,
      status: 'idle',
      error: undefined,
      parsedParserId: undefined,
      parsedTextHash: undefined,
      parsedGraphData: undefined,
      source: { kind: 'url', url: normalizedUrl },
      enabled: true,
    })
    syncDocumentViewFromSourceFile({ name: nextName, text: res.text, source: { kind: 'url', url: normalizedUrl } })
    await parseAndApplySourceFile(id)
  } catch {
    store.updateSourceFile(id, { status: 'error', error: 'Request failed' })
  }
}

export function createMarkdownSourceFilesIngestIntegration(): MarkdownSourceFilesIngestIntegration {
  return {
    onImportLocal: args => void importLocalIntoActive(args),
    onImportUrl: args => void importUrlIntoActive(args),
    onExport: args => exportActiveSourceFile(args),
    onClear: args => clearActiveSourceFile(args),
  }
}
