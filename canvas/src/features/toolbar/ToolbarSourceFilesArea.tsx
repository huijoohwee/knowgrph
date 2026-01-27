import React from 'react'
import { Download, Eraser, FileText, Link, Upload } from 'lucide-react'
import { addGeospatialDatasetUrls } from 'gympgrph'
import { useGraphStore } from '@/hooks/useGraphStore'
import type { ToolbarToolMenuAreasProps } from '@/features/toolbar/ToolbarToolMenuAreas.registry'
import { getIconSizeClass } from '@/lib/ui'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { GripDotsIcon, VisibilityIcon } from '@/features/graph-fields/ui/graphFieldIcons'
import { pickFileWithExtensions } from '@/lib/graph/filePicker'
import { deriveFilenameFromUrl, normalizeGitHubBlobLikeUrl, unwrapUserProvidedText } from '@/lib/url'
import { fetchRemoteTextDetailed } from '@/lib/net/fetchRemoteText'
import { downloadBlob } from '@/lib/graph/save'
import { runImportFlow } from '@/features/toolbar/importFlow'
import { openBottomPanel } from '@/features/bottom-panel/open'
import { hashStringToHex } from '@/lib/hash/stringHash'
import { exportAsCombinedCsvBlob, exportAsJsonLdBlob, exportAsRawJsonBlob } from '@/lib/graph/io/adapter'
import { exportAsGeoJsonBlob } from '@/lib/graph/io/geojson'
import type { GraphData } from '@/lib/graph/types'
import { SOURCE_FILES_COPY, SOURCE_FILES_FORMATS } from '@/lib/config.copy'
import { deriveMarkdownNameFromPdfFilename } from '@/features/toolbar/ingestUtils'
import { applyComposedGraphFromSourceFiles } from '@/features/source-files/applyComposedGraphFromSourceFiles'
import {
  buildEmbeddedGeoJsonUploadName,
  extractEmbeddedGeoJsonFeatureCollections,
} from '@/lib/markdown/embeddedGeoJson'
import { uploadGeoJsonTextToLocalStore } from '@/features/geospatial/localGeoUpload'
import { useGympgrphExternalStore } from '@/lib/gympgrph/externalStore'

type GeoDatasetFormat = 'auto' | 'geojson' | 'records'

const SUPPORTED_SOURCE_FILE_IMPORT_EXTENSIONS = [...SOURCE_FILES_FORMATS.import]
const SUPPORTED_SOURCE_EXPORT_FORMATS = SOURCE_FILES_FORMATS.export

export function ToolbarSourceFilesArea(_props: Partial<ToolbarToolMenuAreasProps> = {}) {
  void _props
  const uiIconScale = useGraphStore(s => s.uiIconScale)
  const uiIconStrokeWidth = useGraphStore(s => s.uiIconStrokeWidth)
  const iconSizeClass = getIconSizeClass(uiIconScale)
  const uiPanelKeyValueTextSizeClass = useGraphStore(
    s => s.uiPanelKeyValueTextSizeClass || 'text-xs',
  )
  const uiPanelTextFontClass = useGraphStore(
    s => s.uiPanelTextFontClass || 'font-sans',
  )
  const sourceFiles = useGraphStore(s => s.sourceFiles)
  const updateSourceFile = useGraphStore(s => s.updateSourceFile)
  const toggleSourceFile = useGraphStore(s => s.toggleSourceFile)
  const setSourceFileName = useGraphStore(s => s.setSourceFileName)
  const setSourceFileGeoLayerEnabled = useGraphStore(s => s.setSourceFileGeoLayerEnabled)
  const reorderSourceFiles = useGraphStore(s => s.reorderSourceFiles)

  const [draggingSourceFileId, setDraggingSourceFileId] = React.useState<string | null>(null)
  const [dragOverSourceFileId, setDragOverSourceFileId] = React.useState<string | null>(null)
  const [urlDraftBySourceFileId, setUrlDraftBySourceFileId] = React.useState<Record<string, string>>({})
  const [openUrlInputForFileId, setOpenUrlInputForFileId] = React.useState<string | null>(null)
  const urlInputRootRef = React.useRef<HTMLDivElement | null>(null)
  const urlInputRef = React.useRef<HTMLInputElement | null>(null)
  const [openExportMenuForFileId, setOpenExportMenuForFileId] = React.useState<string | null>(null)
  const exportMenuRef = React.useRef<HTMLDivElement | null>(null)
  const [geoLayerFormat] = React.useState<GeoDatasetFormat>('auto')
  const [exportFormatBySourceFileId, setExportFormatBySourceFileId] = React.useState<
    Record<string, (typeof SUPPORTED_SOURCE_EXPORT_FORMATS)[number]>
  >({})

  const controlHeightClassName = 'h-[var(--kg-control-height,28px)]'
  const rowHeightClassName = 'h-[var(--kg-table-row-height,44px)]'
  const squareIconButtonClassName = React.useMemo(() => {
    return [
      `App-toolbar__btn ${uiPanelKeyValueTextSizeClass}`,
      UI_THEME_TOKENS.panel.bg,
      UI_THEME_TOKENS.button.text,
      UI_THEME_TOKENS.button.hoverBg,
      UI_THEME_TOKENS.button.square,
    ].join(' ')
  }, [uiPanelKeyValueTextSizeClass])

  const { datasetTimeoutMs, datasetMaxBytes, geospatialOverlayEnabled } = useGympgrphExternalStore(s => ({
    datasetTimeoutMs: s.geospatialDatasetTimeoutMs,
    datasetMaxBytes: s.geospatialDatasetMaxBytes,
    geospatialOverlayEnabled: s.geospatialOverlayEnabled,
  }))
  const showGeoColumn = geospatialOverlayEnabled === true

  const inferGeoLayerFromText = React.useCallback((name: string, text: string): boolean => {
    const lower = String(name || '').trim().toLowerCase()
    if (lower.endsWith('.geojson')) return true
    if (!(lower.endsWith('.json') || lower.endsWith('.jsonld'))) return false
    const trimmed = String(text || '').trim()
    if (!trimmed) return false
    const head = trimmed.slice(0, 30_000).toLowerCase()
    if (head.includes('"featurecollection"') && head.includes('"features"')) return true
    if (head.includes('"geometry"') && head.includes('"coordinates"')) return true
    const hasLat = head.includes('"lat"') || head.includes('"latitude"') || head.includes('lat":') || head.includes('latitude":')
    const hasLng = head.includes('"lng"') || head.includes('"lon"') || head.includes('"longitude"') || head.includes('lng":') || head.includes('lon":') || head.includes('longitude":')
    return hasLat && hasLng
  }, [])

  const resolveFetchFailure = React.useCallback(
    (res: { kind?: unknown; status?: unknown; contentLength?: unknown }) => {
      const kind = typeof res?.kind === 'string' ? res.kind : ''
      const status = typeof res?.status === 'number' ? res.status : null
      const contentLength = typeof res?.contentLength === 'number' ? res.contentLength : null
      if (kind === 'http' && status !== null) return `HTTP ${status}`
      if (kind === 'timeout') return 'Timeout'
      if (kind === 'too_large') {
        if (contentLength !== null && Number.isFinite(contentLength)) {
          const mb = (contentLength / (1024 * 1024)).toFixed(1)
          const limitMb = (datasetMaxBytes / (1024 * 1024)).toFixed(1)
          return `Too large (${mb} MB > ${limitMb} MB)`
        }
        return 'Too large'
      }
      return 'Network error'
    },
    [datasetMaxBytes],
  )

  React.useEffect(() => {
    if (!openExportMenuForFileId) return
    const onPointerDown = (e: PointerEvent) => {
      const root = exportMenuRef.current
      if (!root) return
      const t = e.target as Node | null
      if (t && root.contains(t)) return
      setOpenExportMenuForFileId(null)
    }
    window.addEventListener('pointerdown', onPointerDown, true)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true)
    }
  }, [openExportMenuForFileId])

  React.useEffect(() => {
    if (!openUrlInputForFileId) return
    const onPointerDown = (e: PointerEvent) => {
      const root = urlInputRootRef.current
      if (!root) return
      const t = e.target as Node | null
      if (t && root.contains(t)) return
      setOpenUrlInputForFileId(null)
    }
    window.addEventListener('pointerdown', onPointerDown, true)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true)
    }
  }, [openUrlInputForFileId])

  React.useEffect(() => {
    if (!openUrlInputForFileId) return
    const id = requestAnimationFrame(() => {
      try {
        urlInputRef.current?.focus()
      } catch {
        void 0
      }
    })
    return () => cancelAnimationFrame(id)
  }, [openUrlInputForFileId])

  const convertPdfUrlToMarkdown = React.useCallback(async (rawUrl: string) => {
    const url = String(rawUrl || '').trim()
    if (!url) return null
    try {
      const res = await fetch(`/__convert_pdf?url=${encodeURIComponent(url)}`, {
        method: 'POST',
        headers: { Accept: 'application/json' },
      })
      const json = (await res.json()) as { ok?: unknown; markdown?: unknown; error?: unknown; name?: unknown }
      if (json && json.ok === true && typeof json.markdown === 'string') {
        const name =
          typeof json.name === 'string' && json.name.trim()
            ? json.name.trim()
            : (() => {
                try {
                  const u = new URL(url)
                  const parts = u.pathname.split('/').filter(Boolean)
                  const last = parts[parts.length - 1] || ''
                  return deriveMarkdownNameFromPdfFilename(last)
                } catch {
                  return 'document.md'
                }
              })()
        return { ok: true as const, name, markdown: json.markdown }
      }
      const err = typeof json?.error === 'string' && json.error.trim() ? json.error.trim() : ''
      if (err) return { ok: false as const, error: err }
      if (!res.ok) return { ok: false as const, error: `HTTP ${res.status}` }
      return { ok: false as const, error: 'PDF conversion failed' }
    } catch {
      return null
    }
  }, [])

  const convertPdfFileToMarkdown = React.useCallback(async (file: File) => {
    try {
      const buf = await file.arrayBuffer()
      const res = await fetch('/__convert_pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/pdf',
          Accept: 'application/json',
          'X-Import-Filename': file.name || '',
        },
        body: buf,
      })
      const json = (await res.json()) as { ok?: unknown; markdown?: unknown; error?: unknown; name?: unknown }
      if (json && json.ok === true && typeof json.markdown === 'string') {
        const name =
          typeof json.name === 'string' && json.name.trim() ? json.name.trim() : deriveMarkdownNameFromPdfFilename(file.name)
        return { ok: true as const, name, markdown: json.markdown }
      }
      const err = typeof json?.error === 'string' && json.error.trim() ? json.error.trim() : ''
      if (err) return { ok: false as const, error: err }
      if (!res.ok) return { ok: false as const, error: `HTTP ${res.status}` }
      return { ok: false as const, error: 'PDF conversion failed' }
    } catch {
      return null
    }
  }, [])

  const fetchYouTubeTranscriptMarkdown = React.useCallback(async (rawUrl: string) => {
    const cleaned = unwrapUserProvidedText(String(rawUrl || '').trim()) || String(rawUrl || '').trim()
    if (!cleaned) return null
    try {
      const qs = new URLSearchParams({ url: cleaned })
      const res = await fetch(`/__youtube_transcript?${qs.toString()}`, {
        method: 'POST',
        headers: { Accept: 'application/json' },
      })
      const json = (await res.json()) as { ok?: unknown; markdown?: unknown; error?: unknown; name?: unknown }
      if (json && json.ok === true && typeof json.markdown === 'string') {
        const name = typeof json.name === 'string' && json.name.trim() ? json.name.trim() : 'youtube-transcript.md'
        return { ok: true as const, name, markdown: json.markdown }
      }
      const err = typeof json?.error === 'string' && json.error.trim() ? json.error.trim() : ''
      if (err) return { ok: false as const, error: err }
      if (!res.ok) return { ok: false as const, error: `HTTP ${res.status}` }
      return { ok: false as const, error: 'YouTube conversion failed' }
    } catch {
      return null
    }
  }, [])

  const handleToggleFileGeoLayer = React.useCallback(
    async (args: { fileId: string; next: boolean }) => {
      setSourceFileGeoLayerEnabled(args.fileId, args.next)
      if (!args.next) return
      const file = useGraphStore.getState().sourceFiles.find(f => f.id === args.fileId)
      if (!file) return

      const currentUrlFromSource = typeof file.source?.url === 'string' ? file.source.url.trim() : ''
      const urlFromKind = file.source?.kind === 'url' ? String(file.source?.url || '').trim() : ''
      let url = urlFromKind || currentUrlFromSource
      const nameLower = String(file.name || '').toLowerCase()

      if (!url && file.source?.kind === 'local' && nameLower.endsWith('.geojson')) {
        const text = String(file.text || '')
        const trimmed = text.trim()
        if (!trimmed) return
        try {
          const parsed = JSON.parse(trimmed) as unknown
          if (!parsed || typeof parsed !== 'object') return
          if ((parsed as { type?: unknown }).type !== 'FeatureCollection') return
        } catch {
          return
        }
        const uploaded = await uploadGeoJsonTextToLocalStore({ name: file.name, text })
        if (uploaded.ok) {
          url = uploaded.url
          updateSourceFile(file.id, { source: { ...(file.source || { kind: 'local' }), url } })
        }
      }

      if (!url && file.source?.kind === 'local' && (nameLower.endsWith('.md') || nameLower.endsWith('.markdown'))) {
        const markdownText = String(file.text || '')
        const embedded = extractEmbeddedGeoJsonFeatureCollections(markdownText)
        if (embedded.length === 0) {
          updateSourceFile(file.id, { status: 'error', error: SOURCE_FILES_COPY.geoLayerEmbeddedGeojsonNotFound })
          setSourceFileGeoLayerEnabled(file.id, false)
          return
        }

        updateSourceFile(file.id, { status: 'loading', error: undefined })
        const uploadedUrls: string[] = []
        for (let idx = 0; idx < embedded.length; idx += 1) {
          const block = embedded[idx]
          const uploadName = buildEmbeddedGeoJsonUploadName(file.name, idx)
          try {
            const uploaded = await uploadGeoJsonTextToLocalStore({ name: uploadName, text: block.geojsonText })
            if (uploaded.ok) {
              uploadedUrls.push(uploaded.url)
              continue
            }
            updateSourceFile(file.id, { status: 'error', error: SOURCE_FILES_COPY.geoLayerEmbeddedGeojsonUploadFailed })
            setSourceFileGeoLayerEnabled(file.id, false)
            return
          } catch {
            updateSourceFile(file.id, {
              status: 'error',
              error: SOURCE_FILES_COPY.geoLayerEmbeddedGeojsonUploadFailed,
            })
            setSourceFileGeoLayerEnabled(file.id, false)
            return
          }
        }

        if (uploadedUrls.length > 0) {
          try {
            addGeospatialDatasetUrls(
              uploadedUrls.map((u, i) => ({
                label: `${file.name} · Embedded GeoJSON #${i + 1}`,
                url: u,
                format: 'geojson' as const,
              })),
            )
          } catch {
            void 0
          }
        }
        updateSourceFile(file.id, { status: 'idle', error: undefined })
        return
      }

      if (!url) return
      try {
        addGeospatialDatasetUrls([{ label: file.name, url, format: geoLayerFormat }])
      } catch {
        void 0
      }
    },
    [geoLayerFormat, setSourceFileGeoLayerEnabled, updateSourceFile],
  )

  const handleImportSourceFile = React.useCallback(
    async (
      file: { id: string; name: string; geoLayerEnabled?: boolean; source?: { kind: 'url' | 'local'; url?: string; path?: string } },
      opts?: { kind?: 'local' | 'url'; url?: string; fetchText?: boolean },
    ) => {
      const forceKind = opts?.kind || null
      const providedUrl = typeof opts?.url === 'string' ? opts.url.trim() : ''
      const fetchText = opts?.fetchText !== false
      const preferredUrl = file.source?.kind === 'url' ? String(file.source?.url || '').trim() : ''
      const labelAsUrl = /^https?:\/\//i.test(String(file.name || '').trim()) ? String(file.name || '').trim() : ''
      const rawUrl = providedUrl || (forceKind === 'url' ? '' : preferredUrl || labelAsUrl)
      if (forceKind === 'url' || (rawUrl && forceKind !== 'local')) {
        const normalizedUrl = normalizeGitHubBlobLikeUrl(rawUrl) || rawUrl
        updateSourceFile(file.id, { status: 'loading', error: undefined, enabled: true })
        try {
          const lower = normalizedUrl.toLowerCase()
          const isYouTube = lower.includes('youtube.com') || lower.includes('youtu.be')
          if (isYouTube) {
            const yt = await fetchYouTubeTranscriptMarkdown(normalizedUrl)
            if (!yt) {
              updateSourceFile(file.id, { status: 'error', error: 'Request failed' })
              return
            }
            if (!yt.ok) {
              updateSourceFile(file.id, { status: 'error', error: yt.error })
              return
            }
            updateSourceFile(file.id, {
              name: yt.name,
              text: yt.markdown,
              status: 'idle',
              error: undefined,
              parsedParserId: undefined,
              parsedTextHash: undefined,
              parsedGraphData: undefined,
              source: { kind: 'url', url: normalizedUrl },
              enabled: true,
            })
            return
          }
          if (/\.(pdf)(\?|#|$)/i.test(lower)) {
            const converted = await convertPdfUrlToMarkdown(normalizedUrl)
            if (!converted) {
              updateSourceFile(file.id, { status: 'error', error: 'Request failed' })
              return
            }
            if (!converted.ok) {
              updateSourceFile(file.id, { status: 'error', error: converted.error })
              return
            }
            updateSourceFile(file.id, {
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
            return
          }

          if (file.geoLayerEnabled && !fetchText) {
            const nextName = labelAsUrl
              ? deriveFilenameFromUrl(normalizedUrl, 'source.txt')
              : (file.name || deriveFilenameFromUrl(normalizedUrl, 'source.txt'))
            updateSourceFile(file.id, {
              name: nextName,
              status: 'idle',
              error: undefined,
              parsedParserId: undefined,
              parsedTextHash: undefined,
              parsedGraphData: undefined,
              source: { kind: 'url', url: normalizedUrl },
              enabled: true,
            })
            try {
              addGeospatialDatasetUrls([{ label: nextName, url: normalizedUrl, format: geoLayerFormat }])
            } catch {
              void 0
            }
            return
          }

          const res = await fetchRemoteTextDetailed(normalizedUrl, {
            preflightHead: true,
            timeoutMs: datasetTimeoutMs,
            maxBytes: datasetMaxBytes,
          })
          if (res.ok === false) {
            const msg = resolveFetchFailure(res)
            updateSourceFile(file.id, { status: 'error', error: msg })
            return
          }
          const nextName = labelAsUrl ? deriveFilenameFromUrl(normalizedUrl, 'source.txt') : (file.name || deriveFilenameFromUrl(normalizedUrl, 'source.txt'))
          updateSourceFile(file.id, {
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
          try {
            if (inferGeoLayerFromText(nextName, res.text)) {
              setSourceFileGeoLayerEnabled(file.id, true)
              addGeospatialDatasetUrls([{ label: nextName, url: normalizedUrl, format: geoLayerFormat }])
            }
          } catch {
            void 0
          }
          return
        } catch {
          updateSourceFile(file.id, { status: 'error', error: 'Request failed' })
          return
        }
      }

      const picked = await pickFileWithExtensions([...SUPPORTED_SOURCE_FILE_IMPORT_EXTENSIONS])
      if (!picked) return
      if (typeof picked.size === 'number' && Number.isFinite(picked.size) && picked.size > datasetMaxBytes) {
        const mb = (picked.size / (1024 * 1024)).toFixed(1)
        const limitMb = (datasetMaxBytes / (1024 * 1024)).toFixed(1)
        updateSourceFile(file.id, { status: 'error', error: `Too large (${mb} MB > ${limitMb} MB)` })
        return
      }
      const lower = (picked.name || '').toLowerCase()
      if (/\.(pdf)(\?|#|$)/i.test(lower)) {
        updateSourceFile(file.id, { status: 'loading', error: undefined, enabled: true })
        const converted = await convertPdfFileToMarkdown(picked)
        if (!converted) {
          updateSourceFile(file.id, { status: 'error', error: 'Request failed' })
          return
        }
        if (!converted.ok) {
          updateSourceFile(file.id, { status: 'error', error: converted.error })
          return
        }
        updateSourceFile(file.id, {
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
        return
      }
      const text = await picked.text()
      updateSourceFile(file.id, {
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
      try {
        if (inferGeoLayerFromText(picked.name, text)) {
          void handleToggleFileGeoLayer({ fileId: file.id, next: true })
        }
      } catch {
        void 0
      }
    },
    [
      convertPdfFileToMarkdown,
      convertPdfUrlToMarkdown,
      fetchYouTubeTranscriptMarkdown,
      resolveFetchFailure,
      updateSourceFile,
      datasetTimeoutMs,
      datasetMaxBytes,
      inferGeoLayerFromText,
      geoLayerFormat,
      setSourceFileGeoLayerEnabled,
      handleToggleFileGeoLayer,
    ],
  )

  const clearSourceFile = React.useCallback(
    (fileId: string) => {
      const before = useGraphStore.getState().sourceFiles.find(f => f.id === fileId)
      if (!before) return
      updateSourceFile(fileId, {
        text: '',
        status: 'idle',
        error: undefined,
        parsedParserId: undefined,
        parsedTextHash: undefined,
        parsedGraphData: undefined,
      })
      setUrlDraftBySourceFileId(s => {
        if (!s[fileId]) return s
        const next = { ...s }
        delete next[fileId]
        return next
      })
      setExportFormatBySourceFileId(s => {
        if (!s[fileId]) return s
        const next = { ...s }
        delete next[fileId]
        return next
      })
      setOpenUrlInputForFileId(prev => (prev === fileId ? null : prev))
      setOpenExportMenuForFileId(prev => (prev === fileId ? null : prev))
      if (before.enabled) applyComposedGraphFromSourceFiles()
    },
    [updateSourceFile],
  )

  const openMarkdownViewerForSourceFile = React.useCallback(
    async (fileId: string) => {
      const before = useGraphStore.getState().sourceFiles.find(f => f.id === fileId)
      if (!before) return
      const beforeText = String(before.text || '')
      const draftUrl = String(urlDraftBySourceFileId[fileId] ?? '').trim()
      const urlFromSource = before.source?.kind === 'url' ? String(before.source?.url || '').trim() : ''
      const labelAsUrl = /^https?:\/\//i.test(String(before.name || '').trim()) ? String(before.name || '').trim() : ''
      const rawUrl = draftUrl || urlFromSource || labelAsUrl
      const url = rawUrl ? (normalizeGitHubBlobLikeUrl(rawUrl) || rawUrl) : ''
      if (!beforeText.trim() && url) {
        await handleImportSourceFile(before, { kind: 'url', url, fetchText: true })
      }
      const after = useGraphStore.getState().sourceFiles.find(f => f.id === fileId)
      if (!after) return
      const text = String(after.text || '')
      if (!text.trim()) {
        try {
          const store = useGraphStore.getState()
          store.setMarkdownDocument(after.name || 'source.md', '')
          store.setMarkdownDocumentSourceUrl(null)
          store.setBottomPanelCurationView('markdown')
          openBottomPanel('curation')
        } catch {
          void 0
        }
        return
      }
      const sourceUrl = after.source?.kind === 'url' ? String(after.source?.url || '').trim() : ''
      try {
        const store = useGraphStore.getState()
        const lower = String(after.name || '').toLowerCase()
        const isJsonish =
          lower.endsWith('.json') || lower.endsWith('.jsonld') || lower.endsWith('.geojson') || lower.endsWith('.csv') || lower.endsWith('.yaml') || lower.endsWith('.yml')
        if (isJsonish) {
          store.setJsonSourceDocument(after.name, text)
          store.setBottomPanelCurationView('json')
        } else {
          store.setMarkdownDocument(after.name, text)
          store.setMarkdownDocumentSourceUrl(sourceUrl || null)
          store.setBottomPanelCurationView('markdown')
        }
      } catch {
        void 0
      }
      openBottomPanel('curation')
    },
    [handleImportSourceFile, urlDraftBySourceFileId],
  )

  const importSourceFileToCanvas = React.useCallback(
    async (fileId: string) => {
      const before = useGraphStore.getState().sourceFiles.find(f => f.id === fileId)
      if (!before) return
      const beforeText = String(before.text || '')
      if (!beforeText.trim()) return
      const file = useGraphStore.getState().sourceFiles.find(f => f.id === fileId)
      if (!file) return
      const text = String(file.text || '')
      if (!text.trim()) return

      updateSourceFile(fileId, { status: 'loading', error: undefined })
      const sourceUrl = file.source?.kind === 'url' ? String(file.source?.url || '').trim() : ''
      try {
        const store = useGraphStore.getState()
        const lower = String(file.name || '').toLowerCase()
        const isJsonish =
          lower.endsWith('.json') || lower.endsWith('.jsonld') || lower.endsWith('.geojson') || lower.endsWith('.csv') || lower.endsWith('.yaml') || lower.endsWith('.yml')
        if (isJsonish) {
          store.setJsonSourceDocument(file.name, text)
        } else {
          store.setMarkdownDocument(file.name, text)
          store.setMarkdownDocumentSourceUrl(sourceUrl || null)
        }
      } catch {
        void 0
      }

      const res = await runImportFlow({ nameForParse: file.name, textForParse: text, applyToStore: false })
      const parsedOk = !!(res && res.graphData && res.parserId && res.counts && (res.counts.n > 0 || res.counts.e > 0))
      if (parsedOk) {
        updateSourceFile(fileId, {
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
      updateSourceFile(fileId, { status: 'error', error: msg, parsedGraphData: undefined })
    },
    [updateSourceFile],
  )

  const resolveSourceUrlText = React.useCallback((file: { source?: { kind: 'url' | 'local'; url?: string; path?: string }; name: string }) => {
    const url = file.source?.kind === 'url' ? String(file.source?.url || '').trim() : ''
    if (url) return url
    const raw = String(file.name || '').trim()
    if (/^https?:\/\//i.test(raw)) return raw
    const path = file.source?.kind === 'local' ? String(file.source?.path || '').trim() : ''
    return path || 'Local device'
  }, [])

  const resolveStatusPill = React.useCallback((file: { status: string; error?: string }) => {
    if (file.status === 'parsed') return { text: 'Parsed', classes: UI_THEME_TOKENS.status.success }
    if (file.status === 'loading') return { text: 'Loading', classes: UI_THEME_TOKENS.status.warning }
    if (file.status === 'error') return { text: file.error ? `Error: ${file.error}` : 'Error', classes: UI_THEME_TOKENS.status.error }
    return { text: 'Idle', classes: UI_THEME_TOKENS.status.neutral }
  }, [])

  const inferExportFormatFromName = React.useCallback((name: string): (typeof SUPPORTED_SOURCE_EXPORT_FORMATS)[number] => {
    const lower = String(name || '').trim().toLowerCase()
    if (lower.endsWith('.jsonld')) return '.jsonld'
    if (lower.endsWith('.geojson')) return '.geojson'
    if (lower.endsWith('.json')) return '.json'
    if (lower.endsWith('.csv')) return '.csv'
    if (lower.endsWith('.html') || lower.endsWith('.htm')) return '.html'
    if (lower.endsWith('.yaml') || lower.endsWith('.yml')) return '.yaml'
    if (lower.endsWith('.txt')) return '.txt'
    return '.md'
  }, [])

  const resolveExportFormat = React.useCallback((file: { id: string; name: string }) => {
    const picked = exportFormatBySourceFileId[file.id]
    return picked || inferExportFormatFromName(file.name)
  }, [exportFormatBySourceFileId, inferExportFormatFromName])

  const buildExportFilename = React.useCallback((rawName: string, ext: string) => {
    const base = String(rawName || '').trim() || 'source'
    const stem = base.replace(/\.(pdf|html|htm|jsonld|geojson|json|yaml|yml|md|markdown|txt|csv)$/i, '') || 'source'
    return `${stem}${ext}`
  }, [])

  const exportSourceFile = React.useCallback((file: { id: string; name: string; text?: string; parsedGraphData?: GraphData }, formatOverride?: (typeof SUPPORTED_SOURCE_EXPORT_FORMATS)[number]) => {
    const format = formatOverride || resolveExportFormat(file)
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
      format === '.md' ? 'text/markdown;charset=utf-8'
      : format === '.html' ? 'text/html;charset=utf-8'
      : format === '.yaml' ? 'text/yaml;charset=utf-8'
      : 'text/plain;charset=utf-8'
    const blob = new Blob([content], { type: mime })
    downloadBlob(blob, filename)
  }, [buildExportFilename, resolveExportFormat])

  return (
    <div className="flex flex-col gap-1">
      <section aria-label="Source Files Management">
        <div className={`rounded border ${UI_THEME_TOKENS.panel.border} overflow-hidden`}>
          <table className="w-full table-fixed">
            <colgroup>
              <col style={{ width: '2%' }} />
              <col style={{ width: '2%' }} />
              <col style={{ width: '22%' }} />
              <col style={{ width: '28%' }} />
              <col style={{ width: showGeoColumn ? '32%' : '38%' }} />
              {showGeoColumn ? <col style={{ width: '6%' }} /> : null}
              <col style={{ width: showGeoColumn ? '10%' : '10%' }} />
            </colgroup>
            <thead className={UI_THEME_TOKENS.panel.bg}>
              <tr className={`border-b ${UI_THEME_TOKENS.panel.divider}`}>
                <th className="font-normal text-left px-2 py-2">
                  <div className={`${uiPanelKeyValueTextSizeClass} leading-4 ${UI_THEME_TOKENS.text.secondary} whitespace-nowrap overflow-hidden text-ellipsis`}>
                    Move
                  </div>
                </th>
                <th className="font-normal text-left px-2 py-2">
                  <div className={`${uiPanelKeyValueTextSizeClass} leading-4 ${UI_THEME_TOKENS.text.secondary} whitespace-nowrap overflow-hidden text-ellipsis`}>
                    Show
                  </div>
                </th>
                <th className="font-normal text-left px-2 py-2">
                  <div className={`${uiPanelKeyValueTextSizeClass} leading-4 ${UI_THEME_TOKENS.text.secondary} whitespace-nowrap overflow-hidden text-ellipsis`}>
                    Label
                  </div>
                </th>
                <th className="font-normal text-left px-2 py-2">
                  <div className={`${uiPanelKeyValueTextSizeClass} leading-4 ${UI_THEME_TOKENS.text.secondary} whitespace-nowrap overflow-hidden text-ellipsis`}>
                    Local/URL
                  </div>
                </th>
                <th className="font-normal text-left px-2 py-2">
                  <div className={`${uiPanelKeyValueTextSizeClass} leading-4 ${UI_THEME_TOKENS.text.secondary} whitespace-nowrap overflow-hidden text-ellipsis`}>
                    Action
                  </div>
                </th>
                {showGeoColumn ? (
                  <th className="font-normal text-left px-2 py-2">
                    <div className={`${uiPanelKeyValueTextSizeClass} leading-4 ${UI_THEME_TOKENS.text.secondary} whitespace-nowrap overflow-hidden text-ellipsis`}>
                      Geo
                    </div>
                  </th>
                ) : null}
                <th className="font-normal text-left px-2 py-2">
                  <div className={`${uiPanelKeyValueTextSizeClass} leading-4 ${UI_THEME_TOKENS.text.secondary} whitespace-nowrap overflow-hidden text-ellipsis`}>
                    Status
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {sourceFiles.map(file => {
                const sourceText = resolveSourceUrlText(file)
                const status = resolveStatusPill(file)
                const isUrl = /^https?:\/\//i.test(sourceText)
                const isDragOver = dragOverSourceFileId === file.id
                return (
                  <tr
                    key={file.id}
                    className={[
                      `border-b ${UI_THEME_TOKENS.panel.divider} last:border-b-0`,
                      rowHeightClassName,
                        'border-l-2',
                        UI_THEME_TOKENS.table.rowHoverAmber,
                        isDragOver ? UI_THEME_TOKENS.table.rowSelectedBorder : '',
                    ].join(' ')}
                      draggable
                    onDragOver={e => {
                      e.preventDefault()
                      if (!draggingSourceFileId) return
                      setDragOverSourceFileId(file.id)
                    }}
                    onDragLeave={() => {
                      if (dragOverSourceFileId === file.id) setDragOverSourceFileId(null)
                    }}
                      onDragStart={e => {
                        const t = e.target as HTMLElement | null
                        if (t?.tagName && ['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON', 'A', 'LABEL'].includes(t.tagName)) {
                          e.preventDefault()
                          return
                        }
                        setDraggingSourceFileId(file.id)
                        setDragOverSourceFileId(file.id)
                        try {
                          e.dataTransfer.effectAllowed = 'move'
                          e.dataTransfer.setData('text/plain', file.id)
                        } catch {
                          void 0
                        }
                      }}
                    onDrop={e => {
                      e.preventDefault()
                      const src = draggingSourceFileId || e.dataTransfer.getData('text/plain')
                      if (!src || src === file.id) return
                      reorderSourceFiles(src, file.id)
                        applyComposedGraphFromSourceFiles()
                      setDraggingSourceFileId(null)
                      setDragOverSourceFileId(null)
                    }}
                      onDragEnd={() => {
                        setDraggingSourceFileId(null)
                        setDragOverSourceFileId(null)
                      }}
                  >
                    <td className="px-2 py-2 align-middle">
                      <div className="mx-auto flex items-center justify-center">
                        <GripDotsIcon className={`${iconSizeClass} text-[color:var(--kg-text-tertiary)]`} />
                      </div>
                    </td>
                    <td className="px-2 py-2 align-middle">
                      <button
                        type="button"
                        className={`${squareIconButtonClassName} mx-auto`}
                        onClick={() => {
                          const wasEnabled = Boolean(file.enabled)
                          toggleSourceFile(file.id)
                          if (wasEnabled) {
                            applyComposedGraphFromSourceFiles()
                            return
                          }
                          if (file.geoLayerEnabled) return
                          if (file.parsedGraphData) {
                            applyComposedGraphFromSourceFiles()
                            return
                          }
                          void importSourceFileToCanvas(file.id)
                        }}
                        aria-label={file.enabled ? 'Hide source file' : 'Show source file'}
                        title={file.enabled ? 'Hide source file' : 'Show source file'}
                      >
                        <VisibilityIcon hidden={!file.enabled} iconClassName={iconSizeClass} strokeWidth={uiIconStrokeWidth} />
                      </button>
                    </td>
                    <td className="px-2 py-2 align-middle">
                      <input
                        className={`w-full min-w-0 ${controlHeightClassName} px-2 rounded border box-border ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.input.bg} ${UI_THEME_TOKENS.input.text} ${uiPanelTextFontClass} ${uiPanelKeyValueTextSizeClass}`}
                        value={file.name}
                        onChange={e => setSourceFileName(file.id, e.target.value)}
                        aria-label="Source file label"
                      />
                    </td>
                    <td className="px-2 py-2 align-middle">
                      <div
                        className={`block ${uiPanelKeyValueTextSizeClass} ${isUrl ? UI_THEME_TOKENS.text.primary : UI_THEME_TOKENS.text.secondary} whitespace-nowrap overflow-hidden text-ellipsis`}
                        title={sourceText}
                      >
                        {sourceText}
                      </div>
                    </td>
                    <td className="px-2 py-2 align-middle">
                      <div className="flex items-center gap-1 min-w-0">
                        <button
                          type="button"
                          className={squareIconButtonClassName}
                          onClick={async () => {
                            await handleImportSourceFile(file, { kind: 'local' })
                            const after = useGraphStore.getState().sourceFiles.find(f => f.id === file.id)
                            if (!after) return
                            if (after.geoLayerEnabled) return
                            void importSourceFileToCanvas(file.id)
                          }}
                          aria-label="Import local"
                          title="Import local"
                        >
                          <Upload className={iconSizeClass} strokeWidth={uiIconStrokeWidth} aria-hidden="true" />
                        </button>
                        <div
                          className="relative"
                          ref={node => {
                            if (openUrlInputForFileId === file.id) urlInputRootRef.current = node
                          }}
                        >
                          <button
                            type="button"
                            className={squareIconButtonClassName}
                            onClick={async () => {
                              const draft = String(urlDraftBySourceFileId[file.id] ?? '').trim()
                              if (openUrlInputForFileId === file.id) {
                                if (!draft) {
                                  setOpenUrlInputForFileId(null)
                                  return
                                }
                                await handleImportSourceFile(file, { kind: 'url', url: draft, fetchText: !file.geoLayerEnabled })
                                const after = useGraphStore.getState().sourceFiles.find(f => f.id === file.id)
                                if (after && !after.geoLayerEnabled) void importSourceFileToCanvas(file.id)
                                setOpenUrlInputForFileId(null)
                                return
                              }
                              setOpenUrlInputForFileId(file.id)
                            }}
                            aria-label="Import URL"
                            title="Import URL"
                          >
                            <Link className={iconSizeClass} strokeWidth={uiIconStrokeWidth} aria-hidden="true" />
                          </button>
                          <div
                            className={[
                              'absolute right-full top-0 mr-1 overflow-hidden transition-all duration-200',
                              openUrlInputForFileId === file.id ? 'w-64 opacity-100' : 'w-0 opacity-0 pointer-events-none',
                            ].join(' ')}
                          >
                            <input
                              className={`w-64 ${controlHeightClassName} px-2 rounded border box-border ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.input.bg} ${UI_THEME_TOKENS.input.text} ${uiPanelTextFontClass} ${uiPanelKeyValueTextSizeClass}`}
                              value={urlDraftBySourceFileId[file.id] ?? ''}
                              onChange={e => setUrlDraftBySourceFileId(s => ({ ...s, [file.id]: e.target.value }))}
                              placeholder={SOURCE_FILES_COPY.urlPlaceholder}
                              aria-label="Import URL input"
                              ref={node => {
                                if (openUrlInputForFileId === file.id) urlInputRef.current = node
                              }}
                              onKeyDown={e => {
                                if (e.key === 'Escape') {
                                  e.preventDefault()
                                  setOpenUrlInputForFileId(null)
                                  return
                                }
                                if (e.key !== 'Enter') return
                                e.preventDefault()
                                const next = String(urlDraftBySourceFileId[file.id] ?? '').trim()
                                if (!next) return
                                void (async () => {
                                  await handleImportSourceFile(file, { kind: 'url', url: next, fetchText: !file.geoLayerEnabled })
                                  const after = useGraphStore.getState().sourceFiles.find(f => f.id === file.id)
                                  if (after && !after.geoLayerEnabled) void importSourceFileToCanvas(file.id)
                                  setOpenUrlInputForFileId(null)
                                })()
                              }}
                            />
                          </div>
                        </div>
                        <button
                          type="button"
                          className={squareIconButtonClassName}
                          onClick={() => void openMarkdownViewerForSourceFile(file.id)}
                          aria-label="Open in editor"
                          title="Open in editor"
                        >
                          <FileText className={iconSizeClass} strokeWidth={uiIconStrokeWidth} aria-hidden="true" />
                        </button>
                        <div
                          className="relative inline-block"
                          ref={node => {
                            if (openExportMenuForFileId === file.id) exportMenuRef.current = node
                          }}
                        >
                          <button
                            type="button"
                            className={squareIconButtonClassName}
                            onClick={() => setOpenExportMenuForFileId(prev => (prev === file.id ? null : file.id))}
                            aria-label="Export"
                            title="Export"
                          >
                            <Download className={iconSizeClass} strokeWidth={uiIconStrokeWidth} aria-hidden="true" />
                          </button>
                          {openExportMenuForFileId === file.id ? (
                            <div
                              className={`absolute right-0 mt-1 z-50 rounded border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} shadow-lg min-w-[9rem] overflow-hidden`}
                              role="menu"
                              aria-label="Export format"
                            >
                              <button
                                type="button"
                                className={`w-full text-left px-3 py-2 ${uiPanelKeyValueTextSizeClass} ${UI_THEME_TOKENS.text.primary} ${UI_THEME_TOKENS.table.rowHover}`}
                                onClick={() => {
                                  setOpenExportMenuForFileId(null)
                                  exportSourceFile(file)
                                }}
                                role="menuitem"
                              >
                                Export ({resolveExportFormat(file)})
                              </button>
                              <div className={`border-t ${UI_THEME_TOKENS.panel.divider}`} />
                              {SUPPORTED_SOURCE_EXPORT_FORMATS.map(fmt => (
                                <button
                                  key={fmt}
                                  type="button"
                                  className={`w-full text-left px-3 py-2 ${uiPanelKeyValueTextSizeClass} ${UI_THEME_TOKENS.text.primary} ${UI_THEME_TOKENS.table.rowHover}`}
                                  onClick={() => {
                                    setExportFormatBySourceFileId(s => ({ ...s, [file.id]: fmt }))
                                    setOpenExportMenuForFileId(null)
                                    exportSourceFile(file, fmt)
                                  }}
                                  role="menuitem"
                                >
                                  {fmt}
                                </button>
                              ))}
                            </div>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          className={squareIconButtonClassName}
                          onClick={() => clearSourceFile(file.id)}
                          aria-label="Clear Source File"
                          title="Clear Source File"
                        >
                          <Eraser className={iconSizeClass} strokeWidth={uiIconStrokeWidth} aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                    {showGeoColumn ? (
                      <td className="px-2 py-2 align-middle">
                        <input
                          type="checkbox"
                          checked={file.geoLayerEnabled === true}
                          onChange={e => {
                            void handleToggleFileGeoLayer({ fileId: file.id, next: e.target.checked })
                          }}
                          className="w-4 h-4 mx-auto block"
                          aria-label="Geo layer"
                        />
                      </td>
                    ) : null}
                    <td className="px-2 py-2 align-middle">
                      <div
                        className={`inline-flex items-center h-[var(--kg-status-pill-height,24px)] box-border rounded border px-2 text-[10px] ${status.classes}`}
                        title={status.text}
                      >
                        <span className="truncate overflow-hidden whitespace-nowrap max-w-[6rem]">{status.text}</span>
                      </div>
                    </td>
                  </tr>
                )
              })}

              {sourceFiles.length === 0 ? (
                <tr className={`border-b ${UI_THEME_TOKENS.panel.divider} last:border-b-0 ${rowHeightClassName}`}>
                  <td colSpan={showGeoColumn ? 7 : 6} className="px-2 py-2 align-middle">
                    <div className={`${uiPanelKeyValueTextSizeClass} ${UI_THEME_TOKENS.text.tertiary}`}>
                      No source files yet.
                    </div>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <p className={`px-2 py-1 ${uiPanelKeyValueTextSizeClass} ${UI_THEME_TOKENS.text.tertiary}`}>
          {SOURCE_FILES_COPY.supports}
        </p>
      </section>
    </div>
  )
}
