import React from 'react'
import { Download, Eraser, FileText, Upload } from 'lucide-react'
import { useGraphStore } from '@/hooks/useGraphStore'
import type { ToolbarToolMenuAreasProps } from '@/features/toolbar/ToolbarToolMenuAreas.registry'
import { getIconSizeClass } from '@/lib/ui'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { GripDotsIcon, VisibilityIcon } from '@/features/graph-fields/ui/graphFieldIcons'
import { pickTextFilesWithExtensions } from '@/lib/graph/file'
import { deriveFilenameFromUrl, normalizeGitHubBlobLikeUrl } from '@/lib/url'
import { fetchRemoteTextDetailed } from '@/lib/net/fetchRemoteText'
import { downloadBlob } from '@/lib/graph/save'
import { runImportFlow } from '@/features/toolbar/importFlow'
import { openBottomPanel } from '@/features/bottom-panel/open'

type GeoDatasetFormat = 'auto' | 'geojson' | 'records'

const SUPPORTED_SOURCE_FILE_EXTENSIONS = ['.md', '.markdown', '.txt', '.json', '.jsonld', '.csv', '.html', '.htm', '.yaml', '.yml']

export function ToolbarSourceFilesArea(_props: ToolbarToolMenuAreasProps) {
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
  const removeSourceFile = useGraphStore(s => s.removeSourceFile)
  const setSourceFileName = useGraphStore(s => s.setSourceFileName)
  const setSourceFileGeoLayerEnabled = useGraphStore(s => s.setSourceFileGeoLayerEnabled)
  const reorderSourceFiles = useGraphStore(s => s.reorderSourceFiles)

  const [draggingSourceFileId, setDraggingSourceFileId] = React.useState<string | null>(null)
  const [dragOverSourceFileId, setDragOverSourceFileId] = React.useState<string | null>(null)
  const [geoLayerFormat] = React.useState<GeoDatasetFormat>('auto')

  const controlHeightClassName = 'h-[var(--kg-control-height,28px)]'
  const rowHeightClassName = 'h-[var(--kg-table-row-height,44px)]'

  const resolveFetchFailure = React.useCallback((res: { kind?: unknown; status?: unknown }) => {
    const kind = typeof res?.kind === 'string' ? res.kind : ''
    const status = typeof res?.status === 'number' ? res.status : null
    if (kind === 'http' && status !== null) return `HTTP ${status}`
    if (kind === 'timeout') return 'Timeout'
    if (kind === 'too_large') return 'Too large'
    return 'Network error'
  }, [])

  const handleToggleFileGeoLayer = React.useCallback(
    async (args: { fileId: string; next: boolean; url?: string; label?: string }) => {
      setSourceFileGeoLayerEnabled(args.fileId, args.next)
      if (!args.next) return
      const url = String(args.url || '').trim()
      if (!url) return
      try {
        const m = await import('gympgrph')
        if (typeof m.addGeospatialDatasetUrls !== 'function') return
        m.addGeospatialDatasetUrls([{ label: args.label, url, format: geoLayerFormat }])
      } catch {
        void 0
      }
    },
    [geoLayerFormat, setSourceFileGeoLayerEnabled],
  )

  const handleImportSourceFile = React.useCallback(
    async (file: { id: string; name: string; source?: { kind: 'url' | 'local'; url?: string; path?: string } }) => {
      const preferredUrl = file.source?.kind === 'url' ? String(file.source?.url || '').trim() : ''
      const labelAsUrl = /^https?:\/\//i.test(String(file.name || '').trim()) ? String(file.name || '').trim() : ''
      const rawUrl = preferredUrl || labelAsUrl
      if (rawUrl) {
        const normalizedUrl = normalizeGitHubBlobLikeUrl(rawUrl) || rawUrl
        updateSourceFile(file.id, { status: 'loading', error: undefined })
        try {
          const res = await fetchRemoteTextDetailed(normalizedUrl, { preflightHead: true })
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
            source: { kind: 'url', url: normalizedUrl },
          })
          return
        } catch {
          updateSourceFile(file.id, { status: 'error', error: 'Request failed' })
          return
        }
      }

      const files = await pickTextFilesWithExtensions([
        ...SUPPORTED_SOURCE_FILE_EXTENSIONS,
      ])
      const first = files[0]
      if (!first) return
      updateSourceFile(file.id, {
        name: first.name,
        text: first.text,
        status: 'idle',
        error: undefined,
        source: { kind: 'local', path: first.name },
      })
    },
    [resolveFetchFailure, updateSourceFile],
  )

  const openMarkdownViewerForSourceFile = React.useCallback(
    async (fileId: string) => {
      const before = useGraphStore.getState().sourceFiles.find(f => f.id === fileId)
      if (!before) return
      const beforeText = String(before.text || '')
      if (!beforeText.trim()) {
        await handleImportSourceFile(before)
      }
      const after = useGraphStore.getState().sourceFiles.find(f => f.id === fileId)
      if (!after) return
      const text = String(after.text || '')
      if (!text.trim()) return
      const sourceUrl = after.source?.kind === 'url' ? String(after.source?.url || '').trim() : ''
      try {
        const store = useGraphStore.getState()
        store.setMarkdownDocument(after.name, text)
        store.setMarkdownDocumentSourceUrl(sourceUrl || null)
        store.setBottomPanelCurationView('markdown')
      } catch {
        void 0
      }
      openBottomPanel('curation')
    },
    [handleImportSourceFile],
  )

  const importSourceFileToCanvas = React.useCallback(
    async (fileId: string) => {
      const before = useGraphStore.getState().sourceFiles.find(f => f.id === fileId)
      if (!before) return
      const beforeText = String(before.text || '')
      if (!beforeText.trim()) {
        await handleImportSourceFile(before)
      }
      const file = useGraphStore.getState().sourceFiles.find(f => f.id === fileId)
      if (!file) return
      const text = String(file.text || '')
      if (!text.trim()) return

      updateSourceFile(fileId, { status: 'loading', error: undefined })
      const sourceUrl = file.source?.kind === 'url' ? String(file.source?.url || '').trim() : ''
      try {
        const store = useGraphStore.getState()
        store.setMarkdownDocument(file.name, text)
        store.setMarkdownDocumentSourceUrl(sourceUrl || null)
      } catch {
        void 0
      }

      const res = await runImportFlow({ nameForParse: file.name, textForParse: text })
      const parsedOk = !!(res && res.parserId && res.counts && (res.counts.n > 0 || res.counts.e > 0))
      if (parsedOk) {
        updateSourceFile(fileId, { status: 'parsed', error: undefined })
        return
      }
      const msg =
        res && Array.isArray(res.warnings) && typeof res.warnings[0] === 'string' && res.warnings[0].trim()
          ? res.warnings[0].trim()
          : 'Parse failed'
      updateSourceFile(fileId, { status: 'error', error: msg })
    },
    [handleImportSourceFile, updateSourceFile],
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

  return (
    <div className="flex flex-col gap-1">
      <section aria-label="Source Files Management">
        <div className={`rounded border ${UI_THEME_TOKENS.panel.border} overflow-hidden`}>
          <table className="w-full table-fixed">
            <colgroup>
              <col style={{ width: '2%' }} />
              <col style={{ width: '2%' }} />
              <col style={{ width: '25%' }} />
              <col style={{ width: '45%' }} />
              <col style={{ width: '5%' }} />
              <col style={{ width: '5%' }} />
              <col style={{ width: '16%' }} />
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
                    Geo Layer
                  </div>
                </th>
                <th className="font-normal text-left px-2 py-2">
                  <div className={`${uiPanelKeyValueTextSizeClass} leading-4 ${UI_THEME_TOKENS.text.secondary} whitespace-nowrap overflow-hidden text-ellipsis`}>
                    Status
                  </div>
                </th>
                <th className="font-normal text-left px-2 py-2">
                  <div className={`${uiPanelKeyValueTextSizeClass} leading-4 ${UI_THEME_TOKENS.text.secondary} whitespace-nowrap overflow-hidden text-ellipsis`}>
                    Action
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
                const sourceUrl = file.source?.kind === 'url' ? String(file.source?.url || '').trim() : ''
                return (
                  <tr
                    key={file.id}
                    className={[
                      `border-b ${UI_THEME_TOKENS.panel.divider} last:border-b-0`,
                      rowHeightClassName,
                      isDragOver ? 'bg-black/5 dark:bg-white/5' : '',
                    ].join(' ')}
                    onDragOver={e => {
                      if (!draggingSourceFileId) return
                      e.preventDefault()
                      setDragOverSourceFileId(file.id)
                    }}
                    onDragLeave={() => {
                      if (dragOverSourceFileId === file.id) setDragOverSourceFileId(null)
                    }}
                    onDrop={e => {
                      e.preventDefault()
                      const src = draggingSourceFileId || e.dataTransfer.getData('text/plain')
                      if (!src || src === file.id) return
                      reorderSourceFiles(src, file.id)
                      setDraggingSourceFileId(null)
                      setDragOverSourceFileId(null)
                    }}
                  >
                    <td className="px-2 py-2 align-middle">
                      <button
                        type="button"
                        className={`App-toolbar__btn ${uiPanelKeyValueTextSizeClass} ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg} mx-auto block`}
                        draggable
                        onDragStart={e => {
                          setDraggingSourceFileId(file.id)
                          setDragOverSourceFileId(null)
                          try {
                            e.dataTransfer.setData('text/plain', file.id)
                            e.dataTransfer.effectAllowed = 'move'
                          } catch {
                            void 0
                          }
                        }}
                        onDragEnd={() => {
                          setDraggingSourceFileId(null)
                          setDragOverSourceFileId(null)
                        }}
                        aria-label="Move source file"
                        title="Move source file"
                      >
                        <GripDotsIcon className="w-4 h-4 text-[color:var(--kg-text-tertiary)]" />
                      </button>
                    </td>
                    <td className="px-2 py-2 align-middle">
                      <button
                        type="button"
                        className={`App-toolbar__btn ${uiPanelKeyValueTextSizeClass} ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg} mx-auto block`}
                        onClick={() => toggleSourceFile(file.id)}
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
                      <input
                        type="checkbox"
                        checked={file.geoLayerEnabled === true}
                        onChange={e => {
                          void handleToggleFileGeoLayer({
                            fileId: file.id,
                            next: e.target.checked,
                            url: sourceUrl,
                            label: file.name,
                          })
                        }}
                        className="w-4 h-4 mx-auto block"
                        aria-label="Geo layer"
                      />
                    </td>
                    <td className="px-2 py-2 align-middle">
                      <div
                        className={`inline-flex items-center h-[var(--kg-status-pill-height,24px)] box-border rounded border px-2 text-[10px] ${status.classes}`}
                        title={status.text}
                      >
                        <span className="truncate overflow-hidden whitespace-nowrap max-w-[6rem]">{status.text}</span>
                      </div>
                    </td>
                    <td className="px-2 py-2 align-middle">
                      <button
                        type="button"
                        className={`App-toolbar__btn ${uiPanelKeyValueTextSizeClass} ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg} mr-1`}
                        onClick={() => {
                          void importSourceFileToCanvas(file.id)
                        }}
                        aria-label="Import"
                        title="Import"
                      >
                        <Upload className={iconSizeClass} strokeWidth={uiIconStrokeWidth} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className={`App-toolbar__btn ${uiPanelKeyValueTextSizeClass} ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg} mr-1`}
                        onClick={() => void openMarkdownViewerForSourceFile(file.id)}
                        aria-label="Open Markdown Viewer"
                        title="Open Markdown Viewer"
                      >
                        <FileText className={iconSizeClass} strokeWidth={uiIconStrokeWidth} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className={`App-toolbar__btn ${uiPanelKeyValueTextSizeClass} ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg} mr-1`}
                        onClick={() => {
                          const content = String(file.text || '')
                          if (!content.trim()) return
                          const name = (file.name || 'source.txt').trim() || 'source.txt'
                          const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
                          downloadBlob(blob, name)
                        }}
                        aria-label="Export"
                        title="Export"
                      >
                        <Download className={iconSizeClass} strokeWidth={uiIconStrokeWidth} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className={`App-toolbar__btn ${uiPanelKeyValueTextSizeClass} ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`}
                        onClick={() => removeSourceFile(file.id)}
                        aria-label="Clear Source File"
                        title="Clear Source File"
                      >
                        <Eraser className={iconSizeClass} strokeWidth={uiIconStrokeWidth} aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                )
              })}

              {sourceFiles.length === 0 ? (
                <tr className={`border-b ${UI_THEME_TOKENS.panel.divider} last:border-b-0 ${rowHeightClassName}`}>
                  <td colSpan={7} className="px-2 py-2 align-middle">
                    <div className={`${uiPanelKeyValueTextSizeClass} ${UI_THEME_TOKENS.text.tertiary}`}>
                      No source files yet.
                    </div>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className={`px-2 py-1 ${uiPanelKeyValueTextSizeClass} ${UI_THEME_TOKENS.text.tertiary}`}>
          Supports import/export: {SUPPORTED_SOURCE_FILE_EXTENSIONS.join(' ')}; URL sources: https://…; YouTube: use the YouTube importer.
        </div>
      </section>
    </div>
  )
}
