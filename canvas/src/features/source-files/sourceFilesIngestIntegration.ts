import { useGraphStore } from '@/hooks/useGraphStore'
import { createId } from '@/lib/id'
import { pickFileWithExtensions } from '@/lib/graph/filePicker'
import { SOURCE_FILES_FORMATS } from '@/lib/config.copy'
import { decodeCodebasePathFromUrl, deriveFilenameFromUrl, normalizeGitHubBlobLikeUrl, unwrapUserProvidedText } from '@/lib/url'
import { fetchRemoteTextDetailed } from '@/lib/net/fetchRemoteText'
import { describeFetchRemoteTextFailure } from '@/lib/net/fetchRemoteTextFailure'
import { downloadBlob } from '@/lib/graph/save'
import { exportAsCombinedCsvBlob, exportAsJsonLdBlob, exportAsRawJsonBlob } from '@/lib/graph/io/adapter'
import { exportAsGeoJsonBlob } from '@/lib/graph/io/geojson'
import { normalizeMermaidMmdToMarkdown } from 'grph-shared/markdown/mermaidInput'
import { runImportFlow } from '@/features/toolbar/importFlow'
import { applyImportedCsvToStore, applyImportedJsonToStore } from '@/features/toolbar/importSideEffects'
import { scheduleApplyComposedGraphFromSourceFiles } from '@/features/source-files/applyComposedGraphFromSourceFiles'
import { findNextSourceFileIndex } from '@/features/source-files/sourceFileNaming'
import { writeLocalMarkdownFileText } from '@/features/source-files/localMarkdownFolder'
import { getMostRecentCachedMarkdownFolderId, writeCachedMarkdownText } from '@/features/source-files/markdownFsCache'
import { useGympgrphStore } from '@/lib/gympgrph/api'
import type { MarkdownSourceFilesIngestIntegration } from '@/features/markdown/ui/MarkdownSourceFilesIngestIntegration'
import { convertPdfFileToMarkdown, convertPdfUrlToMarkdown, fetchYouTubeTranscriptMarkdown, fetchWebpageMarkdown } from '@/lib/net/remoteMarkdownConversions'
import { sanitizeImportedMarkdownText } from '@/lib/markdown/sanitizeImportedMarkdown'
import { buildGrabMapsProxyRequestHeaders } from 'grph-shared/geospatial/grabMapsAuth'
import { toGrabMapsProxyUrl } from 'grph-shared/geospatial/grabMapsProxy'
import { buildSourceFileParseIdentityHash } from '@/features/source-files/sourceFileParseIdentity'
import { buildSourceFileLifecycleState, buildSourceFileRecord } from '@/features/source-files/sourceFileParsedState'
import { mapLimit } from '@/lib/async/mapLimit'
import { SOURCE_FILES_REPARSE_CONCURRENCY } from '@/lib/config'
import { openMarkdownWorkspaceEditorPane } from '@/features/workspace-table/workspaceTableSsot'
import { adaptFeishuBaseRecordsToSourceDocument } from '@/features/source-files/feishuBaseSourceAdapter'
import type { FeishuBaseSourceImportRequest, FeishuBaseSourceImportResult } from '@/features/source-files/feishuBaseSourceImportContract'

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

const isSameOriginCodebaseFileUrl = (rawUrl: string): boolean => {
  if (typeof window === 'undefined') return false
  const text = String(rawUrl || '').trim()
  if (!text) return false
  try {
    const parsed = new URL(text, window.location.href)
    if (parsed.origin !== window.location.origin) return false
    return parsed.pathname === '/__codebase_file' && !!decodeCodebasePathFromUrl(parsed.toString())
  } catch {
    return false
  }
}

const coerceGrabMapsHttpsUrl = (rawUrl: string): string | null => {
  const text = String(rawUrl || '').trim()
  if (!text) return null
  try {
    const u = new URL(text)
    if (u.protocol !== 'https:') return null
    if (u.hostname.toLowerCase() !== 'maps.grab.com') return null
    return u.toString()
  } catch {
    return null
  }
}

const fetchSameOriginCodebaseFileText = async (url: string): Promise<{ ok: true; text: string } | { ok: false; error: string }> => {
  const target = String(url || '').trim()
  if (!target) return { ok: false, error: 'Request failed' }
  const attempts = 2
  for (let i = 0; i < attempts; i += 1) {
    try {
      const res = await fetch(target, { method: 'GET', cache: 'no-store' })
      if (!res.ok) return { ok: false, error: `Request failed (${res.status})` }
      const text = await res.text()
      return { ok: true, text }
    } catch {
      if (i + 1 < attempts) {
        await new Promise(resolve => setTimeout(resolve, 40))
        continue
      }
      return { ok: false, error: 'Request failed' }
    }
  }
  return { ok: false, error: 'Request failed' }
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
  store.addSourceFile(buildSourceFileRecord({
    id,
    name: nextName,
    text: '',
    enabled: true,
    source: { kind: 'local', path: nextName },
  }))
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
        applyToGraph: opts?.applyToGraph ?? true,
      })
      return
    }

    const trimmed = text.trim()
    const fencedLang = lower.endsWith('.yml') || lower.endsWith('.yaml') ? 'yaml' : 'text'
    const markdown = trimmed ? ['```' + fencedLang, trimmed, '```', ''].join('\n') : text
    if (!baselineLocked) {
      try {
        openMarkdownWorkspaceEditorPane(store)
      } catch {
        void 0
      }
    }
    void store.setActiveMarkdownDocument({
      name, text: markdown, normalizeMermaidMmd: false,
      sourceUrl: sourceUrl || null, jsonSourceText: null, autoEnableFrontmatter: false,
      applyViewPreset: false,
    })
    return
  }
  const normalized = normalizeMermaidMmdToMarkdown(name, text)
  if (!baselineLocked) {
    try {
      openMarkdownWorkspaceEditorPane(store)
    } catch {
      void 0
    }
  }
  void store.setActiveMarkdownDocument({
    name, text: normalized, normalizeMermaidMmd: false,
    sourceUrl: sourceUrl || null, autoEnableFrontmatter: false,
    applyViewPreset: opts?.applyToGraph === true,
    applyToGraph: opts?.applyToGraph ?? true,
    forceApplyToGraph: opts?.applyToGraph === true,
  })
}

const buildSourceFileIdleReset = () => buildSourceFileLifecycleState({ status: 'idle' })

const parseJobBySourceFileId = new Map<string, number>()
const pendingParseTextHashBySourceFileId = new Map<string, string>()

async function applyImportedTextToSourceFile(args: {
  id: string
  name: string
  text: string
  source: { kind: 'url' | 'local'; url?: string; path?: string }
}): Promise<void> {
  const store = useGraphStore.getState()
  store.updateSourceFile(args.id, {
    name: args.name,
    text: args.text,
    ...buildSourceFileIdleReset(),
    source: args.source,
    enabled: true,
  })
  syncDocumentViewFromSourceFile({ name: args.name, text: args.text, source: args.source }, { applyToGraph: false })
  await parseAndApplySourceFile(args.id)
}

export async function importFeishuBaseSnapshotIntoSourceFile(
  args: FeishuBaseSourceImportRequest,
): Promise<FeishuBaseSourceImportResult> {
  const adapted = adaptFeishuBaseRecordsToSourceDocument(args.snapshot)
  if (!adapted.ok) {
    return {
      ok: false,
      error: 'error' in adapted ? adapted.error : 'Import failed',
      warnings: adapted.warnings,
    }
  }
  const targetId = ensureTargetSourceFileId({
    fileId: args.fileId,
    suggestedName: adapted.document.name,
  })
  await applyImportedTextToSourceFile({
    id: targetId,
    name: adapted.document.name,
    text: adapted.document.text,
    source: { kind: 'local', path: adapted.document.name },
  })
  return {
    ok: true,
    fileId: targetId,
    name: adapted.document.name,
    warnings: adapted.warnings,
  }
}

export async function parseAndApplySourceFile(fileId: string): Promise<void> {
  const before = useGraphStore.getState().sourceFiles.find(f => f.id === fileId)
  if (!before) return
  const name = String(before.name || '')
  const text = String(before.text || '')
  if (!text.trim()) return
  const textHash = buildSourceFileParseIdentityHash({
    cacheNamespace: `source-file:${fileId}`,
    name,
    text,
  })
  if (before.status === 'loading' && pendingParseTextHashBySourceFileId.get(fileId) === textHash) {
    return
  }
  if (before.parsedGraphData && before.parsedTextHash === textHash) {
    useGraphStore.getState().updateSourceFile(fileId, {
      ...buildSourceFileLifecycleState({
        status: 'parsed',
        parserId: before.parsedParserId,
        textHash: before.parsedTextHash,
        graphData: before.parsedGraphData,
        previousState: before,
        preserveExistingRevision: true,
      }),
    })
    scheduleApplyComposedGraphFromSourceFiles()
    return
  }

  const store = useGraphStore.getState()
  store.updateSourceFile(
    fileId,
    buildSourceFileLifecycleState({
      status: 'loading',
      previousState: before,
      preserveParsedState: true,
    }),
  )
  const parseJobToken = (parseJobBySourceFileId.get(fileId) || 0) + 1
  parseJobBySourceFileId.set(fileId, parseJobToken)
  pendingParseTextHashBySourceFileId.set(fileId, textHash)

  const clearPendingParseForJob = () => {
    if (parseJobBySourceFileId.get(fileId) !== parseJobToken) return
    pendingParseTextHashBySourceFileId.delete(fileId)
  }

  try {
    const res = await runImportFlow({ nameForParse: before.name, textForParse: text, applyToStore: false, sideEffects: false })
    if (parseJobBySourceFileId.get(fileId) !== parseJobToken) return
    const latest = useGraphStore.getState().sourceFiles.find(f => f.id === fileId)
    if (!latest) return
    if (buildSourceFileParseIdentityHash({
      cacheNamespace: `source-file:${fileId}`,
      name: String(latest.name || ''),
      text: String(latest.text || ''),
    }) !== textHash) return
    const parsedOk = !!(res && res.graphData && res.parserId && res.counts && (res.counts.n > 0 || res.counts.e > 0))
    if (parsedOk) {
      store.updateSourceFile(fileId, {
        ...buildSourceFileLifecycleState({
          status: 'parsed',
          parserId: res?.parserId,
          textHash,
          graphData: res?.graphData,
        }),
      })
      scheduleApplyComposedGraphFromSourceFiles()
      return
    }

    const msg =
      res && Array.isArray(res.warnings) && typeof res.warnings[0] === 'string' && res.warnings[0].trim()
        ? res.warnings[0].trim()
        : 'Parse failed'
    store.updateSourceFile(fileId, {
      ...buildSourceFileLifecycleState({
        status: 'error',
        error: msg,
        parserId: res?.parserId,
        textHash,
        graphData: undefined,
      }),
    })
  } finally {
    clearPendingParseForJob()
  }
}

export async function refreshPersistedSourceFilesForCurrentParseIdentity(): Promise<void> {
  const files = Array.isArray(useGraphStore.getState().sourceFiles) ? useGraphStore.getState().sourceFiles.slice() : []
  const idsToReparse: string[] = []
  for (let i = 0; i < files.length; i += 1) {
    const file = files[i]
    if (!file) continue
    const id = String(file.id || '').trim()
    const name = String(file.name || '')
    const text = String(file.text || '')
    if (!id || !text.trim()) continue
    const nextHash = buildSourceFileParseIdentityHash({
      cacheNamespace: `source-file:${id}`,
      name,
      text,
    })
    if (String(file.parsedTextHash || '') === nextHash) continue
    idsToReparse.push(id)
  }
  if (idsToReparse.length === 0) return
  await mapLimit(idsToReparse, SOURCE_FILES_REPARSE_CONCURRENCY, async id => {
    await parseAndApplySourceFile(id)
  })
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
    ...buildSourceFileIdleReset(),
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
  if (file.enabled) scheduleApplyComposedGraphFromSourceFiles()
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
    const previous = store.sourceFiles.find(file => file.id === id)
    store.updateSourceFile(
      id,
      buildSourceFileLifecycleState({
        status: 'error',
        error: `Too large (${mb} MB > ${limitMb} MB)`,
        previousState: previous,
        preserveParsedState: true,
      }),
    )
    return
  }

  const lower = String(picked.name || '').toLowerCase()
  const id = ensureTargetSourceFileId({ fileId: args.fileId, suggestedName: picked.name })
  const previous = store.sourceFiles.find(file => file.id === id)
  store.updateSourceFile(id, {
    ...buildSourceFileLifecycleState({
      status: 'loading',
      previousState: previous,
      preserveParsedState: true,
    }),
    enabled: true,
  })

  if (/\.(pdf)(\?|#|$)/i.test(lower)) {
    const converted = await convertPdfFileToMarkdown(picked)
    if (!converted) {
      store.updateSourceFile(
        id,
        buildSourceFileLifecycleState({
          status: 'error',
          error: 'Request failed',
          previousState: previous,
          preserveParsedState: true,
        }),
      )
      return
    }
    if (converted.ok === false) {
      store.updateSourceFile(
        id,
        buildSourceFileLifecycleState({
          status: 'error',
          error: converted.error,
          previousState: previous,
          preserveParsedState: true,
        }),
      )
      return
    }
    await applyImportedTextToSourceFile({
      id,
      name: converted.name,
      text: converted.markdown,
      source: { kind: 'local', path: picked.name },
    })
    return
  }

  const text = await picked.text()
  await applyImportedTextToSourceFile({
    id,
    name: picked.name,
    text,
    source: { kind: 'local', path: picked.name },
  })
}

async function importUrlIntoActive(args: { fileId: string | null; url: string; format?: 'markdown' | 'json' }): Promise<void> {
  const store = useGraphStore.getState()
  const { geospatialDatasetTimeoutMs, geospatialDatasetMaxBytes } = useGympgrphStore.getState()
  const rawUrl = unwrapUserProvidedText(String(args.url || '').trim()) || String(args.url || '').trim()
  if (!rawUrl) return
  const normalizedUrl = normalizeGitHubBlobLikeUrl(rawUrl) || rawUrl
  const lower = normalizedUrl.toLowerCase()

  const id = ensureTargetSourceFileId({ fileId: args.fileId, suggestedName: deriveFilenameFromUrl(normalizedUrl, 'source.txt') })
  const previous = store.sourceFiles.find(file => file.id === id)
  store.updateSourceFile(id, {
    ...buildSourceFileLifecycleState({
      status: 'loading',
      previousState: previous,
      preserveParsedState: true,
    }),
    enabled: true,
    source: { kind: 'url', url: normalizedUrl },
  })

  try {
    const isYouTube = lower.includes('youtube.com') || lower.includes('youtu.be')
    if (isYouTube) {
      const yt = await fetchYouTubeTranscriptMarkdown(normalizedUrl)
      if (!yt) {
        store.updateSourceFile(
          id,
          buildSourceFileLifecycleState({
            status: 'error',
            error: 'Request failed',
            previousState: previous,
            preserveParsedState: true,
          }),
        )
        return
      }
      if (yt.ok === false) {
        store.updateSourceFile(
          id,
          buildSourceFileLifecycleState({
            status: 'error',
            error: yt.error,
            previousState: previous,
            preserveParsedState: true,
          }),
        )
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
        await applyImportedTextToSourceFile({
          id,
          name: yt.name,
          text: content,
          source: { kind: 'url', url: normalizedUrl },
        })
        return
      }

      const content = `${frontmatter}${yt.markdown}`
      await applyImportedTextToSourceFile({
        id,
        name: yt.name,
        text: content,
        source: { kind: 'url', url: normalizedUrl },
      })
      return
    }

    if (/\.(pdf)(\?|#|$)/i.test(lower)) {
      const converted = await convertPdfUrlToMarkdown(normalizedUrl)
      if (!converted) {
        store.updateSourceFile(
          id,
          buildSourceFileLifecycleState({
            status: 'error',
            error: 'Request failed',
            previousState: previous,
            preserveParsedState: true,
          }),
        )
        return
      }
      if (converted.ok === false) {
        store.updateSourceFile(
          id,
          buildSourceFileLifecycleState({
            status: 'error',
            error: converted.error,
            previousState: previous,
            preserveParsedState: true,
          }),
        )
        return
      }
      await applyImportedTextToSourceFile({
        id,
        name: converted.name,
        text: converted.markdown,
        source: { kind: 'url', url: normalizedUrl },
      })
      return
    }

    const looksLikeCodeOrData = /\.(json|jsonld|geojson|csv|yaml|yml|txt|js|ts|py|md|markdown|mdx|svg)(\?|#|$)/i.test(lower)
    if (!looksLikeCodeOrData) {
      const includeImages = useGraphStore.getState().webpageImportIncludeImages ?? true
      const view = (() => {
        const v = useGraphStore.getState().webpageImportView
        if (v === 'html') return 'html'
        if (v === 'json') return 'json'
        return 'markdown'
      })()
      const webpage = await fetchWebpageMarkdown(normalizedUrl, { includeImages })
      if (webpage && webpage.ok) {
        const frontmatter = `---\nkgWebpageUrl: "${normalizedUrl}"\nkgWebpageView: "${view}"\n---\n\n`
        const content = sanitizeImportedMarkdownText(`${frontmatter}${webpage.markdown}`, { sourceUrl: normalizedUrl }).text
        await applyImportedTextToSourceFile({
          id,
          name: webpage.name,
          text: content,
          source: { kind: 'url', url: normalizedUrl },
        })
        return
      }
    }

    if (isSameOriginCodebaseFileUrl(normalizedUrl)) {
      const direct = await fetchSameOriginCodebaseFileText(normalizedUrl)
      if (direct.ok === false) {
        store.updateSourceFile(
          id,
          buildSourceFileLifecycleState({
            status: 'error',
            error: direct.error,
            previousState: previous,
            preserveParsedState: true,
          }),
        )
        return
      }
      const nextName = deriveFilenameFromUrl(normalizedUrl, 'source.txt')
      await applyImportedTextToSourceFile({
        id,
        name: nextName,
        text: direct.text,
        source: { kind: 'url', url: normalizedUrl },
      })
      return
    }

    const grabMapsProxyUrl = (() => {
      const grabMapsHttpsUrl = coerceGrabMapsHttpsUrl(normalizedUrl)
      if (!grabMapsHttpsUrl) return null
      return toGrabMapsProxyUrl(grabMapsHttpsUrl)
    })()
    const isGrabMapsProxyRequest = !!grabMapsProxyUrl
    const res = await fetchRemoteTextDetailed(grabMapsProxyUrl || normalizedUrl, {
      preflightHead: true,
      preferProxy: !isGrabMapsProxyRequest,
      useProxy: isGrabMapsProxyRequest ? 'never' : 'auto',
      headers: isGrabMapsProxyRequest ? buildGrabMapsProxyRequestHeaders() : undefined,
      timeoutMs: geospatialDatasetTimeoutMs,
      maxBytes: geospatialDatasetMaxBytes,
    })
    if (res.ok === false) {
      store.updateSourceFile(
        id,
        buildSourceFileLifecycleState({
          status: 'error',
          error: describeFetchRemoteTextFailure(res),
          previousState: previous,
          preserveParsedState: true,
        }),
      )
      return
    }

    const nextName = deriveFilenameFromUrl(normalizedUrl, 'source.txt')
    await applyImportedTextToSourceFile({
      id,
      name: nextName,
      text: res.text,
      source: { kind: 'url', url: normalizedUrl },
    })
  } catch {
    store.updateSourceFile(
      id,
      buildSourceFileLifecycleState({
        status: 'error',
        error: 'Request failed',
        previousState: previous,
        preserveParsedState: true,
      }),
    )
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

export async function hydratePendingUrlSourceFiles(): Promise<void> {
  const store = useGraphStore.getState()
  const sourceFiles = Array.isArray(store.sourceFiles) ? store.sourceFiles : []
  const pending = sourceFiles.filter(file => {
    if (!file?.enabled) return false
    const source = file.source
    if (!source || source.kind !== 'url') return false
    const url = String(source.url || '').trim()
    if (!url) return false
    if (String(file.text || '').trim()) return false
    if (file.parsedGraphData) return false
    if (file.status === 'loading') return false
    return true
  })
  for (let i = 0; i < pending.length; i += 1) {
    const file = pending[i]!
    const source = file.source
    const url = source && source.kind === 'url' ? String(source.url || '').trim() : ''
    if (!url) continue
    await importUrlIntoActive({ fileId: file.id, url, format: 'markdown' })
  }
}
