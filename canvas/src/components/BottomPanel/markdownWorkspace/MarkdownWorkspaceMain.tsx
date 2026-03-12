import React from 'react'
import type { MarkdownWorkspaceLayoutMode } from '@/features/markdown-explorer/workspaceUi'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { usePanelTypography, type PanelTypography } from '@/lib/ui/panelTypography'
import { MarkdownWorkspaceToolbar } from '../MarkdownWorkspaceToolbar'
import type { MarkdownFormatAction } from 'grph-shared/markdown/formatting'
import type { HighlightedLineRange, MarkdownPresentationApi, MarkdownWorkspaceStatus } from './markdownWorkspaceTypes'
import MarkdownPreview from '@/features/markdown/ui/MarkdownPreview'
import { splitMarkdownLines } from '@/lib/markdown'
import type { MarkdownGeoDatasetIntegration } from '@/features/markdown/ui/MarkdownRendererTypes'
import {
  extractYamlFrontmatterBlock,
  readYamlFrontmatterValue,
  type WebpageFrontmatterMeta,
  type WebpageViewMode,
  type WebsiteImportFrontmatterMeta,
} from '@/lib/markdown/frontmatter'
import { summarizeCategorizedSignalsFromMarkdown } from '@/lib/websites/signalTokens'
import { buildWebpageLayoutWireframeAsciiFromMarkdown } from '@/lib/websites/webpageLayoutWireframe'
import {
  buildCodeViewerSrcdoc,
  buildWebpageHtmlSrcdocAsync,
  fetchWebpageConversionJsonViaConvert,
  fetchWebpageHtmlAuto,
  fetchWebsiteImportArtifact,
} from '@/lib/websites/webpageIframeSrcdoc'
import { useGraphStore } from '@/hooks/useGraphStore'
import { MonacoTextEditor, type MonacoTextEditorHandle } from '@/features/monaco/MonacoTextEditor'
import { useDebouncedValue } from '@/features/hooks/useDebouncedValue'
import { runInIdle } from '@/features/panels/utils/idle'
import { saveBlobWithPicker, downloadBlob } from '@/lib/graph/save'
import { exportGraphAsJSON, exportSvgSnapshot, type DatasetPath } from '@/lib/graph/file'
import { buildStandaloneSvgMarkupFromElement, captureVisibleCanvasPngBlobFromDom, readCanvasViewportSizeFromDom, wrapPngBlobAsSvgMarkup } from '@/lib/graph/svgSnapshot'
import type { GraphNode } from '@/lib/graph/types'
import { printElementToPdf } from '@/lib/print/printElementToPdf'
import { buildWorkspaceFileJsonLdV1 } from './workspaceImport'
import { LS_KEYS } from '@/lib/config'
import { lsBool } from '@/lib/persistence'
import { exportGraphAsCenteredSvgMarkup } from '@/lib/graph/graphCenteredSvg'
import { buildGraphHtmlViewerMarkup } from '@/lib/graph/graphHtmlViewer'
import { renderGraphCanvasSvgForHtmlExport } from '@/lib/graph/htmlCanvasSvgExport'
import { defaultSchema } from '@/lib/graph/schema'
import { readZoomScaleExtent } from '@/lib/graph/layoutDefaults'
import { readPanSpeed, readWheelBehavior, readZoomSpeed } from '@/lib/canvas/camera-options-2d'
import { exportGraphAsCentered3dSvgMarkup } from '@/lib/graph/graphCenteredSvg3d'
import { getNodeBaseFill, getEdgeBaseStroke } from '@/lib/graph/visualStyles'
import { loadThreeOfflineModuleSources } from '@/lib/three/offlineModules'
import { getThreeConfig } from '@/lib/graph/schema'
import { deriveGraphGroups } from '@/components/GraphCanvas/layout/graphGroups'
import { computeNeighborIds, computeNodeVisual, computeEdgeVisual } from '@/components/GraphCanvas/highlight'
import { getNodeMediaSpec } from '@/components/GraphCanvas/helpers'
import { KG_TOKEN_DEFS, ensureKgTokensInstalled, resolveCssVarWithKgFallback, getKgThemeFromDom } from '@/lib/ui/tokens-ssot'

export type MarkdownWorkspaceMainProps = {
  themeMode: 'light' | 'dark'
  uiPanelTextFontClass: string
  uiPanelMonospaceTextClass: string
  geoDatasetIntegration?: MarkdownGeoDatasetIntegration

  explorerOpen: boolean
  setExplorerOpen: (next: boolean) => void

  layoutMode: MarkdownWorkspaceLayoutMode
  setLayoutMode: (mode: MarkdownWorkspaceLayoutMode) => void
  markdownWordWrap: boolean
  setMarkdownWordWrap: (next: boolean) => void
  markdownTextHighlight: boolean
  setMarkdownTextHighlight: (next: boolean) => void

  statusLabel: MarkdownWorkspaceStatus
  onStatusProgress?: (label: string, current?: number | null, total?: number | null, bytesCurrent?: number | null, bytesTotal?: number | null) => void
  onStatusWithAutoClear?: (label: string, ttlMs?: number) => void
  onApply: () => void
  onSave?: () => void
  onSaveAs?: () => void
  onToggleFullscreen: () => void
  presentationApiRef: React.MutableRefObject<MarkdownPresentationApi | null>

  isEditing: boolean
  isMarkdown: boolean
  onFormatAction: (action: MarkdownFormatAction) => void
  onImportLocalFiles: (files: FileList | null) => void
  onImportLocalFolder: (files: FileList | null) => void
  onImportUrl: (url: string) => void
  onImportWebsite: (url: string) => void

  webpageWorkspaceMeta?: WebpageFrontmatterMeta | null
  onWebpageChangeView?: (view: WebpageViewMode) => void
  onWebpageUpdateMeta?: (patch: { scriptPolicy?: 'strip' | 'allow'; includeImages?: boolean; fidelityLevel?: 1 | 2 | 3 | 4 }) => void
  onWebpageSyncMarkdownFromDom?: () => void

  contentMode?: 'document' | 'nodeQuickEditor'
  setContentMode?: (mode: 'document' | 'nodeQuickEditor') => void
  nodeQuickEditorAvailable?: boolean
  nodeQuickEditorFormat?: 'json' | 'markdown'
  setNodeQuickEditorFormat?: (format: 'json' | 'markdown') => void
  onCopyNodeQuickEditor?: () => void

  activeText: string
  setActiveText: (next: string) => void
  editorTextOverride?: string | null
  webpageHtmlOverride?: string | null
  disableEditorMutations?: boolean
  viewerTextOverride?: string | null
  disableViewerMutations?: boolean
  activeDocumentKey: string
  highlightedLineRange: HighlightedLineRange
  revealLineInEditor: (line: number, endLine?: number) => void
  showInViewer: (line: number) => void
  showInPresentation: (line: number) => void
  showInSlidesGallery: (line: number) => void

  editorUri: string
  editorLanguage: string
  editorRef: React.MutableRefObject<MonacoTextEditorHandle | null>
  onEditorCaretLine?: (line: number) => void
}

function sanitizeInvalidDataUrls(raw: string): string {
  const s = String(raw || '')
  if (!s.includes('data:image/') || !s.includes('<omitted>')) return s
  return s.replace(/data:image\/[a-zA-Z0-9.+-]+;base64,<omitted>/g, 'data:,')
}

function normalizeInlineSourceHints(raw: string): string {
  const text = String(raw || '')
  if (!text.includes('http')) return text
  const lines = text.split(/\r?\n/g)
  let inFence = false
  let fence = ''
  const out: string[] = []
  const cleanUrl = (candidate: string): string => {
    let u = String(candidate || '').trim()
    u = u.replace(/^<|>$/g, '')
    u = u.replace(/^`+|`+$/g, '')
    while (/[)\].,;:]$/.test(u) && u.includes('://')) {
      if (u.endsWith(')') && u.includes('(')) break
      u = u.slice(0, -1)
    }
    return u
  }
  const replaceLine = (line: string): string => {
    if (!line.includes('http')) return line
    if (/\[source\]\(/i.test(line)) return line
    let next = line
    next = next.replace(/\(\s*`(https?:\/\/[^`]+?)`\s*\)?/g, (m, url, offset, whole) => {
      const o = typeof offset === 'number' ? offset : -1
      const w = typeof whole === 'string' ? whole : next
      if (o > 0 && w[o - 1] === ']') return m
      const u = cleanUrl(url)
      if (!u) return m
      return `([source](<${u}>))`
    })
    next = next.replace(/\(\s*(https?:\/\/[^\s)]+)\s*\)/g, (m, url, offset, whole) => {
      const o = typeof offset === 'number' ? offset : -1
      const w = typeof whole === 'string' ? whole : next
      if (o > 0 && w[o - 1] === ']') return m
      const u = cleanUrl(url)
      if (!u) return m
      return `([source](<${u}>))`
    })
    return next
  }
  for (const line of lines) {
    const trimmed = line.trim()
    const m = trimmed.match(/^(```+|~~~+)(.*)$/)
    if (m) {
      if (!inFence) {
        inFence = true
        fence = m[1] || '```'
      } else if (trimmed.startsWith(fence)) {
        inFence = false
        fence = ''
      }
      out.push(line)
      continue
    }
    out.push(inFence ? line : replaceLine(line))
  }
  return out.join('\n')
}

import { useSyncScrollEditorHandleElements } from './useSyncScroll'

function clamp01(n: number) {
  if (n <= 0) return 0
  if (n >= 1) return 1
  return n
}

function getScrollRatio(el: HTMLElement) {
  const max = Math.max(1, el.scrollHeight - el.clientHeight)
  return clamp01(el.scrollTop / max)
}

function getEditorScrollRatio(h: MonacoTextEditorHandle) {
  const max = Math.max(1, h.getScrollHeight() - h.getClientHeight())
  return clamp01(h.getScrollTop() / max)
}

function setScrollRatio(el: HTMLElement, ratio: number) {
  const max = Math.max(0, el.scrollHeight - el.clientHeight)
  el.scrollTop = Math.round(clamp01(ratio) * max)
}

function setEditorScrollRatio(h: MonacoTextEditorHandle, ratio: number) {
  const max = Math.max(0, h.getScrollHeight() - h.getClientHeight())
  h.setScrollTop(Math.round(clamp01(ratio) * max))
}

function MarkdownEditor(props: {
  value: string
  onChange: (next: string) => void
  wordWrap: boolean
  editorRef: React.MutableRefObject<MonacoTextEditorHandle | null>
  onCaretLine?: (line: number) => void
  panelTypography: PanelTypography
  readOnly?: boolean
  themeMode: 'light' | 'dark'
  language: string
  uri: string
  onEditorHandle?: (h: MonacoTextEditorHandle | null) => void
}) {
  const rafIdRef = React.useRef<number | null>(null)
  const lastSelectionStartRef = React.useRef<number | null>(null)
  const lineStarts = React.useMemo(() => {
    const s = String(props.value || '')
    const out: number[] = [0]
    for (let i = 0; i < s.length; i += 1) {
      if (s.charCodeAt(i) === 10) out.push(i + 1)
    }
    return out
  }, [props.value])

  const scheduleEmitCaretLine = React.useCallback(
    (offsetRaw: number) => {
      const onCaretLine = props.onCaretLine
      if (!onCaretLine) return
      const offset = Math.max(0, Math.floor(offsetRaw || 0))
      if (lastSelectionStartRef.current === offset) return
      lastSelectionStartRef.current = offset
      if (rafIdRef.current !== null) return
      rafIdRef.current = requestAnimationFrame(() => {
        rafIdRef.current = null
        let lo = 0
        let hi = lineStarts.length - 1
        while (lo <= hi) {
          const mid = (lo + hi) >> 1
          const v = lineStarts[mid]
          if (v <= offset) lo = mid + 1
          else hi = mid - 1
        }
        const line = Math.max(1, Math.min(lineStarts.length, hi + 1))
        onCaretLine(line)
      })
    },
    [lineStarts, props.onCaretLine],
  )

  React.useEffect(() => {
    return () => {
      const id = rafIdRef.current
      if (id === null) return
      rafIdRef.current = null
      try {
        cancelAnimationFrame(id)
      } catch {
        void 0
      }
    }
  }, [])

  return (
    <section className="flex-1 min-h-0 overflow-hidden flex flex-col" aria-label="Markdown Editor">
      <MonacoTextEditor
        value={props.value}
        onChange={props.readOnly ? () => void 0 : props.onChange}
        language={props.language}
        uri={props.uri}
        themeMode={props.themeMode}
        wordWrap={props.wordWrap}
        readOnly={!!props.readOnly}
        paddingTopPx={12}
        paddingBottomPx={12}
        className="flex-1 min-h-0 w-full overflow-hidden"
        textareaClassName={`flex-1 min-h-0 w-full resize-none box-border px-4 py-3 ${props.panelTypography.panelTextClass} leading-5 ${UI_THEME_TOKENS.input.bg} ${UI_THEME_TOKENS.text.primary} ${UI_THEME_TOKENS.input.border} border outline-none ${props.wordWrap ? 'whitespace-pre-wrap' : 'whitespace-pre'} overflow-auto`}
        ariaLabel="Markdown Editor Text"
        editorRef={props.editorRef}
        onHandle={props.onEditorHandle}
        onSelectionChangeOffsets={({ startOffset }) => scheduleEmitCaretLine(startOffset)}
      />
    </section>
  )
}

function useWebpageIframeSrcdoc(args: {
  enabled: boolean
  url: string
  view: 'html' | 'json' | 'raw' | 'dom'
  websiteImportMeta: { importId: string; nodeId: string; outputDirRel?: string } | null
  htmlOverride?: string | null
  scriptPolicyOverride?: 'strip' | 'allow' | null
  siteRootRel?: string | null
  onStatusProgress?: (label: string, current?: number | null, total?: number | null, bytesCurrent?: number | null, bytesTotal?: number | null) => void
  onStatusWithAutoClear?: (label: string, ttlMs?: number) => void
}): { srcDoc: string | null; error: string | null } {
  const [state, setState] = React.useState<{ srcDoc: string | null; error: string | null }>({ srcDoc: null, error: null })

  const onStatusProgressRef = React.useRef(args.onStatusProgress)
  const onStatusWithAutoClearRef = React.useRef(args.onStatusWithAutoClear)
  React.useEffect(() => {
    onStatusProgressRef.current = args.onStatusProgress
    onStatusWithAutoClearRef.current = args.onStatusWithAutoClear
  }, [args.onStatusProgress, args.onStatusWithAutoClear])

  const debouncedUrl = useDebouncedValue(args.url, 120, args.enabled)
  const debouncedHtmlOverride = useDebouncedValue(args.htmlOverride ?? null, 250, args.enabled)

  React.useEffect(() => {
    if (!args.enabled) {
      setState({ srcDoc: null, error: null })
      return
    }
    const url = String(debouncedUrl || '').trim()
    if (!url) {
      setState({ srcDoc: null, error: null })
      return
    }

    let cancelled = false
    const ctrl = new AbortController()

    void (async () => {
      onStatusProgressRef.current?.('Updating view')
      if (args.view === 'json') {
        onStatusProgressRef.current?.('Loading JSON')
        const rawJson = await (async () => {
          if (args.websiteImportMeta) {
            try {
              const t = await fetchWebsiteImportArtifact({
                importId: args.websiteImportMeta.importId,
                nodeId: args.websiteImportMeta.nodeId,
                outputDirRel: args.websiteImportMeta.outputDirRel,
                kind: 'conversionJson',
                signal: ctrl.signal,
              })
              if (t && t.trim()) return t
            } catch {
              void 0
            }
          }
          return await fetchWebpageConversionJsonViaConvert({
            url,
            includeImages: useGraphStore.getState().webpageImportIncludeImages ?? true,
            signal: ctrl.signal,
          })
        })()

        onStatusProgressRef.current?.('Rendering JSON')
        const pretty = await runInIdle(() => {
          const t = String(rawJson || '')
          if (t.length > 900_000) {
            return `${t.slice(0, 900_000)}\n\n…(clipped ${t.length - 900_000} chars)…`
          }
          try {
            const parsed = JSON.parse(t) as unknown
            return JSON.stringify(parsed, null, 2)
          } catch {
            return t
          }
        }, { timeoutMs: 50 })
        return buildCodeViewerSrcdoc({ baseHref: url, title: url, mode: 'json', text: pretty })
      }

      const override = typeof debouncedHtmlOverride === 'string' && debouncedHtmlOverride.trim() ? debouncedHtmlOverride : null

      onStatusProgressRef.current?.('Loading HTML')
      const rawHtml = await (async () => {
        if (override) return override
        if (args.websiteImportMeta) {
          try {
            return await fetchWebsiteImportArtifact({
              importId: args.websiteImportMeta.importId,
              nodeId: args.websiteImportMeta.nodeId,
              outputDirRel: args.websiteImportMeta.outputDirRel,
              kind: 'rawHtml',
              signal: ctrl.signal,
            })
          } catch {
            void 0
          }
        }
        return await fetchWebpageHtmlAuto({
          url,
          signal: ctrl.signal,
          onProgress: (bytes, bytesTotal) => {
            try {
              onStatusProgressRef.current?.('Loading HTML', null, null, bytes, bytesTotal ?? null)
            } catch {
              void 0
            }
          },
        })
      })()

      const scriptPolicy =
        args.scriptPolicyOverride === 'allow'
          ? 'allow'
          : args.scriptPolicyOverride === 'strip'
            ? 'strip'
            : useGraphStore.getState().webpageViewerScriptPolicy === 'allow'
              ? 'allow'
              : 'strip'
      const siteRootRel = String(args.siteRootRel || '').trim().replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '')
      const localDirRel = (() => {
        const normalized = url.split(/[?#]/)[0].replace(/\\/g, '/').replace(/^\/+/, '')
        const parts = normalized.split('/').filter(Boolean)
        if (parts.length <= 1) return ''
        return parts.slice(0, -1).join('/')
      })()
      const encodePathForUrl = (rel: string): string =>
        String(rel || '')
          .replace(/\\/g, '/')
          .split('/')
          .filter(Boolean)
          .map(seg => encodeURIComponent(seg))
          .join('/')
      const origin = (() => {
        try {
          return typeof window !== 'undefined' && window.location && typeof window.location.origin === 'string' ? window.location.origin : ''
        } catch {
          return ''
        }
      })()
      const baseHref = /^https?:\/\//i.test(url)
        ? url
        : origin
          ? `${origin}/__repo_file/${encodePathForUrl(localDirRel || siteRootRel || '')}${(localDirRel || siteRootRel) ? '/' : ''}`
          : 'https://example.invalid/'

      const htmlPreprocessed = (() => {
        if (!origin) return rawHtml
        if (/^https?:\/\//i.test(url)) return rawHtml
        const root = siteRootRel || localDirRel
        if (!root) return rawHtml
        if (!/(\b(src|href)\s*=\s*(["'])\s*\/(?!\/))|url\(\s*\/(?!\/)/i.test(rawHtml)) return rawHtml
        const rootBase = `${origin}/__repo_file/${encodePathForUrl(root)}/`
        let next = rawHtml
        next = next.replace(/\b(src|href)\s*=\s*(["'])\s*\/(?!\/)/gi, (_m, a: string, q: string) => `${a}=${q}${rootBase}`)
        next = next.replace(/url\(\s*\/(?!\/)/gi, `url(${rootBase}`)
        return next
      })()

      onStatusProgressRef.current?.('Rendering HTML')
      const built = await runInIdle(
        () => buildWebpageHtmlSrcdocAsync({
          html: htmlPreprocessed,
          baseHref,
          scriptPolicy,
          onProgress: (step) => {
            try {
              onStatusProgressRef.current?.(`Sanitizing HTML: ${step}`)
            } catch {
              void 0
            }
          },
        }),
        { timeoutMs: 50 },
      )
      return built
    })()
      .then((res) => {
        if (cancelled) return
        const srcDoc = res
        setState(prev => (prev.srcDoc === srcDoc && prev.error === null ? prev : { srcDoc, error: null }))
        onStatusWithAutoClearRef.current?.('Updated', 1200)
      })
      .catch((err) => {
        if (cancelled) return
        const msg = err && typeof err === 'object' && 'message' in err ? String((err as { message?: unknown }).message || '') : ''
        const name = err && typeof err === 'object' && 'name' in err ? String((err as { name?: unknown }).name || '') : ''
        const abortLike = ctrl.signal.aborted || name === 'AbortError' || /aborted/i.test(msg)
        if (abortLike) {
          onStatusWithAutoClearRef.current?.('Cancelled', 800)
          return
        }
        const fallback = buildCodeViewerSrcdoc({ baseHref: url, title: url, mode: 'text', text: msg || 'Request failed' })
        setState(prev => (prev.srcDoc === fallback && prev.error === (msg || 'Request failed') ? prev : { srcDoc: fallback, error: msg || 'Request failed' }))
      })

    return () => {
      cancelled = true
      try {
        ctrl.abort()
      } catch {
        void 0
      }
    }
  }, [
    args.enabled,
    debouncedHtmlOverride,
    debouncedUrl,
    args.scriptPolicyOverride,
    args.view,
    args.siteRootRel,
    args.websiteImportMeta,
    args.websiteImportMeta?.importId,
    args.websiteImportMeta?.nodeId,
    args.websiteImportMeta?.outputDirRel,
  ])

  return state
}

export const MarkdownWorkspaceMain = React.memo(function MarkdownWorkspaceMain(props: MarkdownWorkspaceMainProps) {
  const panelTypography = usePanelTypography()
  const [editorHandle, setEditorHandle] = React.useState<MonacoTextEditorHandle | null>(null)
  const [viewerEl, setViewerEl] = React.useState<HTMLElement | null>(null)
  const iframeRef = React.useRef<HTMLIFrameElement | null>(null)
  const workspaceCanvasPaneOpen = useGraphStore(s => s.workspaceCanvasPaneOpen)
  const setWorkspaceCanvasPaneOpen = useGraphStore(s => s.setWorkspaceCanvasPaneOpen)
  const graphData = useGraphStore(s => s.graphData)
  const pushUiToast = useGraphStore(s => s.pushUiToast)
  const {
    themeMode,
    uiPanelTextFontClass,
    uiPanelMonospaceTextClass,
    geoDatasetIntegration,
    explorerOpen,
    setExplorerOpen,
    layoutMode,
    setLayoutMode,
    markdownWordWrap,
    setMarkdownWordWrap,
    markdownTextHighlight,
    setMarkdownTextHighlight,
    statusLabel,
    onStatusProgress,
    onStatusWithAutoClear,
    onApply,
    onSave,
    onSaveAs,
    onToggleFullscreen,
    presentationApiRef,
    isEditing,
    isMarkdown,
    onFormatAction,
    onImportLocalFiles,
    onImportLocalFolder,
    onImportUrl,
    onImportWebsite,
    webpageWorkspaceMeta,
    onWebpageChangeView,
    onWebpageUpdateMeta,
    onWebpageSyncMarkdownFromDom,
    contentMode,
    setContentMode,
    nodeQuickEditorAvailable,
    nodeQuickEditorFormat,
    setNodeQuickEditorFormat,
    onCopyNodeQuickEditor,
    activeText,
    setActiveText,
    editorTextOverride,
    webpageHtmlOverride,
    disableEditorMutations,
    viewerTextOverride,
    disableViewerMutations,
    activeDocumentKey,
    highlightedLineRange,
    revealLineInEditor,
    showInViewer,
    showInPresentation,
    showInSlidesGallery,
    editorUri,
    editorLanguage,
    editorRef,
    onEditorCaretLine,
  } = props
  const viewerRef = React.useRef<HTMLElement | null>(null)

  const frontmatterBlock = React.useMemo(() => extractYamlFrontmatterBlock(activeText), [activeText])
  const webpageMeta = React.useMemo((): WebpageFrontmatterMeta | null => {
    if (!frontmatterBlock) return null
    const url = readYamlFrontmatterValue(frontmatterBlock.rawBlock, 'kgWebpageUrl')
    const viewRaw = readYamlFrontmatterValue(frontmatterBlock.rawBlock, 'kgWebpageView')
    const view = viewRaw === 'html' ? 'html' : viewRaw === 'json' ? 'json' : 'markdown'
    const siteRootRelRaw = readYamlFrontmatterValue(frontmatterBlock.rawBlock, 'kgWebpageSiteRootRel')
    const siteRootRel = siteRootRelRaw && siteRootRelRaw.trim() ? siteRootRelRaw.trim() : undefined
    const scriptRaw = readYamlFrontmatterValue(frontmatterBlock.rawBlock, 'kgWebpageScriptPolicy')
    const scriptPolicy = scriptRaw === 'allow' ? 'allow' : scriptRaw === 'strip' ? 'strip' : undefined
    const fidelityRaw = readYamlFrontmatterValue(frontmatterBlock.rawBlock, 'kgWebpageFidelityLevel')
    const fidelityParsed = fidelityRaw ? Number.parseInt(fidelityRaw, 10) : NaN
    const fidelityLevel =
      fidelityParsed === 1 || fidelityParsed === 2 || fidelityParsed === 3 || fidelityParsed === 4 ? fidelityParsed : undefined
    const includeImagesRaw = readYamlFrontmatterValue(frontmatterBlock.rawBlock, 'kgWebpageIncludeImages')
    const includeImages = includeImagesRaw === 'true' ? true : includeImagesRaw === 'false' ? false : undefined
    if (!url) return null
    return { url, view, siteRootRel, scriptPolicy, fidelityLevel, includeImages }
  }, [frontmatterBlock])
  const websiteImportMeta = React.useMemo((): WebsiteImportFrontmatterMeta | null => {
    if (!frontmatterBlock) return null
    const importId = readYamlFrontmatterValue(frontmatterBlock.rawBlock, 'kgWebsiteImportId')
    const nodeId = readYamlFrontmatterValue(frontmatterBlock.rawBlock, 'kgWebsiteNodeId')
    if (!importId || !nodeId) return null
    const outputDirRelRaw = readYamlFrontmatterValue(frontmatterBlock.rawBlock, 'kgWebsiteOutputDirRel')
    const outputDirRel = outputDirRelRaw && outputDirRelRaw.trim() ? outputDirRelRaw.trim() : undefined
    return { importId, nodeId, outputDirRel }
  }, [frontmatterBlock])

  const showWebpageHtml = !!(
    webpageMeta &&
    (webpageMeta.view === 'html' || webpageMeta.view === 'json' || webpageMeta.view === 'raw' || webpageMeta.view === 'dom') &&
    webpageMeta.url
  )

  const needsMarkdownViewerText = !showWebpageHtml && layoutMode !== 'editor'
  const viewerTextRaw = needsMarkdownViewerText ? (typeof viewerTextOverride === 'string' ? viewerTextOverride : activeText) : ''
  const viewerText = React.useMemo(
    () => (needsMarkdownViewerText ? sanitizeInvalidDataUrls(normalizeInlineSourceHints(viewerTextRaw)) : ''),
    [needsMarkdownViewerText, viewerTextRaw],
  )

  const webpageLayoutWireframeAscii = React.useMemo(() => {
    if (!webpageMeta?.url) return null
    const ascii = buildWebpageLayoutWireframeAsciiFromMarkdown(viewerText)
    return ascii && ascii.trim() ? ascii : null
  }, [viewerText, webpageMeta?.url])

  const debouncedSignalText = useDebouncedValue(activeText, 450, webpageMeta?.url)
  const webpageSignalSummary = React.useMemo(() => {
    if (!webpageMeta?.url) return null
    const signals = summarizeCategorizedSignalsFromMarkdown(debouncedSignalText, { maxLines: 8000, maxPerKind: 24 })
    return {
      nav: signals.nav.length,
      cta: signals.cta.length,
      price: signals.price.length,
      time: signals.time.length,
    }
  }, [debouncedSignalText, webpageMeta?.url])

  const handleViewerRootRef = React.useCallback((el: HTMLDivElement | null) => {
    viewerRef.current = el
    setViewerEl(prev => (prev === el ? prev : el))
  }, [])

  const handleIframeRef = React.useCallback((el: HTMLIFrameElement | null) => {
    iframeRef.current = el
  }, [])

  const { srcDoc: iframeSrcDoc } = useWebpageIframeSrcdoc({
    enabled: showWebpageHtml,
    url: String(webpageMeta?.url || ''),
    view: webpageMeta?.view === 'json' ? 'json' : webpageMeta?.view === 'raw' ? 'raw' : webpageMeta?.view === 'dom' ? 'dom' : 'html',
    websiteImportMeta: websiteImportMeta && websiteImportMeta.importId && websiteImportMeta.nodeId ? websiteImportMeta : null,
    htmlOverride: webpageMeta?.view === 'html' ? webpageHtmlOverride : null,
    scriptPolicyOverride: webpageMeta?.scriptPolicy ?? null,
    siteRootRel: webpageMeta?.siteRootRel || null,
    onStatusProgress,
    onStatusWithAutoClear,
  })

  const scrollRatioByDocRef = React.useRef<Map<string, number>>(new Map())
  const docKey = String(activeDocumentKey || '')

  const setSavedRatio = React.useCallback(
    (ratio: number) => {
      if (!docKey) return
      const r = clamp01(ratio)
      const prev = scrollRatioByDocRef.current.get(docKey)
      if (prev === r) return
      scrollRatioByDocRef.current.set(docKey, r)
    },
    [docKey],
  )

  const getSavedRatio = React.useCallback(() => {
    if (!docKey) return 0
    const v = scrollRatioByDocRef.current.get(docKey)
    return typeof v === 'number' && Number.isFinite(v) ? clamp01(v) : 0
  }, [docKey])

  React.useEffect(() => {
    if (showWebpageHtml) setViewerEl(null)
  }, [showWebpageHtml])

  React.useEffect(() => {
    if (!editorHandle) return
    const sub = editorHandle.onDidScrollChange(() => {
      setSavedRatio(getEditorScrollRatio(editorHandle))
    })
    return () => {
      try {
        sub.dispose()
      } catch {
        void 0
      }
    }
  }, [editorHandle, setSavedRatio])

  React.useEffect(() => {
    if (!viewerEl) return
    const handleScroll = () => {
      setSavedRatio(getScrollRatio(viewerEl))
    }
    viewerEl.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      viewerEl.removeEventListener('scroll', handleScroll)
    }
  }, [setSavedRatio, viewerEl])

  React.useEffect(() => {
    const ratio = getSavedRatio()
    if (!showWebpageHtml) {
      if (viewerEl) {
        setScrollRatio(viewerEl, ratio)
      }
      if (editorHandle && (layoutMode === 'editor' || layoutMode === 'split')) {
        setEditorScrollRatio(editorHandle, ratio)
      }
      return
    }
    const iframe = iframeRef.current
    if (!iframe) return
    if (editorHandle && (layoutMode === 'editor' || layoutMode === 'split')) {
      setEditorScrollRatio(editorHandle, ratio)
    }
    const sendRatioToIframe = (r: number) => {
      try {
        iframe.contentWindow?.postMessage({ kind: 'kg-scroll-sync', ratio: r }, '*')
      } catch {
        void 0
      }
    }
    const handleLoad = () => {
      sendRatioToIframe(ratio)
    }
    iframe.addEventListener('load', handleLoad)
    sendRatioToIframe(ratio)
    return () => {
      iframe.removeEventListener('load', handleLoad)
    }
  }, [editorHandle, getSavedRatio, layoutMode, showWebpageHtml, viewerEl])

  useSyncScrollEditorHandleElements(editorHandle, viewerEl, layoutMode === 'split' && !showWebpageHtml)

  React.useEffect(() => {
    if (!showWebpageHtml) return
    const iframe = iframeRef.current
    if (!iframe) return
    if (!editorHandle) return

    const lockRef = { owner: null as 'editor' | 'iframe' | null, until: 0 }
    const canSync = (owner: 'editor' | 'iframe') => {
      const now = Date.now()
      if (!lockRef.owner || now > lockRef.until) {
        lockRef.owner = null
        lockRef.until = 0
        return true
      }
      return lockRef.owner === owner
    }

    const sendRatioToIframe = (ratio: number) => {
      try {
        iframe.contentWindow?.postMessage({ kind: 'kg-scroll-sync', ratio }, '*')
      } catch {
        void 0
      }
    }

    const handleEditorScroll = () => {
      if (!canSync('editor')) return
      lockRef.owner = 'editor'
      lockRef.until = Date.now() + 180
      const ratio = getEditorScrollRatio(editorHandle)
      setSavedRatio(ratio)
      sendRatioToIframe(ratio)
    }

    const handleMessage = (e: MessageEvent) => {
      if (e.source !== iframe.contentWindow) return
      const d = e.data as { kind?: unknown; ratio?: unknown } | null
      if (!d || d.kind !== 'kg-scroll-sync') return
      const ratio = typeof d.ratio === 'number' ? d.ratio : NaN
      if (!Number.isFinite(ratio)) return
      setSavedRatio(ratio)
      if (layoutMode !== 'split') return
      if (!canSync('iframe')) return
      lockRef.owner = 'iframe'
      lockRef.until = Date.now() + 180
      setEditorScrollRatio(editorHandle, ratio)
    }

    const sub = editorHandle.onDidScrollChange(() => {
      if (layoutMode !== 'split') return
      handleEditorScroll()
    })
    window.addEventListener('message', handleMessage)
    return () => {
      try {
        sub.dispose()
      } catch {
        void 0
      }
      window.removeEventListener('message', handleMessage)
    }
  }, [editorHandle, layoutMode, setSavedRatio, showWebpageHtml])

  React.useEffect(() => {
    if (layoutMode !== 'presentation') {
      presentationApiRef.current = null
    }
  }, [layoutMode, presentationApiRef])

  const handleInsertLineAfter = React.useCallback(
    (afterLine: number) => {
      if (disableViewerMutations) return
      const line = Math.max(1, Math.floor(afterLine))
      const lines = splitMarkdownLines(activeText)
      const idx = Math.min(lines.length, line)
      const next = [...lines.slice(0, idx), '', ...lines.slice(idx)].join('\n')
      setActiveText(next)
      try {
        revealLineInEditor(line + 1)
      } catch {
        void 0
      }
    },
    [activeText, disableViewerMutations, revealLineInEditor, setActiveText],
  )

  const handleReorderLineBlock = React.useCallback(
    (
      source: { startLine: number; endLine: number },
      target: { startLine: number; endLine: number },
      position: 'before' | 'after',
    ) => {
      if (disableViewerMutations) return
      const srcStart = Math.max(1, Math.floor(source.startLine))
      const srcEnd = Math.max(srcStart, Math.floor(source.endLine))
      const tgtStart = Math.max(1, Math.floor(target.startLine))
      const tgtEnd = Math.max(tgtStart, Math.floor(target.endLine))
      if (srcStart === tgtStart && srcEnd === tgtEnd) return

      const lines = splitMarkdownLines(activeText)
      if (srcStart > lines.length) return

      const safeSrcEnd = Math.min(lines.length, srcEnd)
      const srcChunk = lines.slice(srcStart - 1, safeSrcEnd)
      const rest = [...lines.slice(0, srcStart - 1), ...lines.slice(safeSrcEnd)]

      const insertionLine = position === 'before' ? tgtStart : tgtEnd + 1
      const insertionIndex = Math.max(0, Math.min(rest.length, insertionLine - 1))

      const next = [...rest.slice(0, insertionIndex), ...srcChunk, ...rest.slice(insertionIndex)].join('\n')
      setActiveText(next)
    },
    [activeText, disableViewerMutations, setActiveText],
  )

  const viewer = showWebpageHtml ? (
    <section
      ref={el => {
        viewerRef.current = el
      }}
      className="flex-1 min-h-0 flex"
      aria-label="Webpage Viewer"
    >
      <iframe
        className="flex-1 min-h-0 w-full border-0"
        ref={handleIframeRef}
        title={webpageMeta?.url || 'Webpage'}
        srcDoc={iframeSrcDoc || ''}
        sandbox="allow-scripts"
        loading="lazy"
        allow="geolocation 'none'; microphone 'none'; camera 'none'; payment 'none'; usb 'none'; clipboard-read 'none'; clipboard-write 'none'"
        referrerPolicy="no-referrer"
      />
    </section>
  ) : (
    <MarkdownPreview
      ref={handleViewerRootRef}
      markdownText={viewerText}
      activeDocumentPath={activeDocumentKey}
      highlightedLineRange={highlightedLineRange}
      markdownWordWrap={markdownWordWrap}
      markdownPresentationMode={false}
      markdownTextHighlight={markdownTextHighlight}
      selectionKind={null}
      uiPanelTextFontClass={uiPanelTextFontClass}
      uiPanelMonospaceTextClass={uiPanelMonospaceTextClass}
      webpageLayoutWireframeAscii={webpageLayoutWireframeAscii}
      geoDatasetIntegration={geoDatasetIntegration}
      previewOverlayScope="container"
      previewOverlayPortalTarget={null}
      previewScrollable={true}
      showSidebar={false}
      viewMode="viewer"
      onInsertLineAfter={handleInsertLineAfter}
      onReorderLineBlock={handleReorderLineBlock}
    />
  )

  const exportBaseName = React.useMemo(() => {
    const raw = String(activeDocumentKey || '').trim() || 'document'
    const base = raw.split('/').filter(Boolean).pop() || raw
    return base.replace(/\.[a-z0-9]+$/i, '') || 'document'
  }, [activeDocumentKey])

  const handleExportWorkspaceFile = React.useCallback(async () => {
    try {
      const text = String(typeof viewerTextOverride === 'string' ? viewerTextOverride : activeText)
      const payload = buildWorkspaceFileJsonLdV1({
        path: String(activeDocumentKey || '').trim() || `${exportBaseName}.md`,
        text,
      })
      const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], { type: 'application/ld+json;charset=utf-8' })
      const name = `${exportBaseName}.workspace.jsonld`
      const saved = await saveBlobWithPicker(blob, name, {
        description: 'Workspace Files',
        accept: { 'application/ld+json': ['.workspace.jsonld', '.jsonld', '.json-ld'] },
      })
      if (saved === '') return
      if (!saved) downloadBlob(blob, name)
    } catch {
      void 0
    }
  }, [activeDocumentKey, activeText, exportBaseName, viewerTextOverride])

  const handleExportMarkdown = React.useCallback(async () => {
    try {
      const text = String(typeof viewerTextOverride === 'string' ? viewerTextOverride : activeText)
      const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' })
      const name = `${exportBaseName}.md`
      const saved = await saveBlobWithPicker(blob, name, { description: 'Markdown Files', accept: { 'text/markdown': ['.md'] } })
      if (saved === '') return
      if (!saved) downloadBlob(blob, name)
    } catch {
      void 0
    }
  }, [activeText, exportBaseName, viewerTextOverride])

  const handleExportHtmlViewer = React.useCallback(async () => {
    try {
      const MAX_INLINE_ASSET_BYTES = 25 * 1024 * 1024
      const assetCache = new Map<string, string | null>()

      const blobToDataUrl = async (blob: Blob): Promise<string> => {
        return await new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(String(reader.result || ''))
          reader.onerror = () => reject(new Error('Failed to read blob.'))
          reader.readAsDataURL(blob)
        })
      }

      const tryInlineUrlAsData = async (url: string): Promise<string | null> => {
        try {
          const cached = assetCache.get(url)
          if (cached !== undefined) return cached
          const resp = await fetch(url)
          if (!resp.ok) {
            assetCache.set(url, null)
            return null
          }
          const len = Number(resp.headers.get('content-length') || '')
          if (Number.isFinite(len) && len > 0 && len > MAX_INLINE_ASSET_BYTES) {
            assetCache.set(url, null)
            return null
          }
          const blob = await resp.blob()
          if (blob.size > MAX_INLINE_ASSET_BYTES) {
            assetCache.set(url, null)
            return null
          }
          const dataUrl = await blobToDataUrl(blob)
          if (!dataUrl.startsWith('data:')) return null
          assetCache.set(url, dataUrl)
          return dataUrl
        } catch {
          return null
        }
      }

      const inlineUrlString = async (rawUrl: string, baseUrl: string): Promise<string | null> => {
        try {
          const u = String(rawUrl || '').trim()
          if (!u) return null
          if (u.startsWith('data:') || u.startsWith('blob:')) return null
          if (u.startsWith('#')) return null
          if (/^javascript:/i.test(u)) return null
          const abs = new URL(u, baseUrl).toString()
          return await tryInlineUrlAsData(abs)
        } catch {
          return null
        }
      }

      const inlineImagesInElement = async (root: HTMLElement): Promise<void> => {
        const imgs = Array.from(root.querySelectorAll('img[src]')) as HTMLImageElement[]
        for (const img of imgs) {
          try {
            const src = String(img.getAttribute('src') || '').trim()
            if (!src) continue
            if (src.startsWith('data:') || src.startsWith('blob:')) continue
            const dataUrl = await inlineUrlString(src, window.location.href)
            if (!dataUrl) continue
            img.setAttribute('src', dataUrl)
            img.removeAttribute('srcset')
            img.removeAttribute('sizes')
          } catch {
            void 0
          }
        }
      }

      const inlineMediaInElement = async (root: HTMLElement): Promise<void> => {
        const media = Array.from(root.querySelectorAll('video,audio')) as Array<HTMLVideoElement | HTMLAudioElement>
        for (const el of media) {
          try {
            const src = String(el.getAttribute('src') || '').trim()
            if (src) {
              const dataUrl = await inlineUrlString(src, window.location.href)
              if (dataUrl) el.setAttribute('src', dataUrl)
            }
          } catch {
            void 0
          }
        }

        const sources = Array.from(root.querySelectorAll('source[src]')) as HTMLSourceElement[]
        for (const s of sources) {
          try {
            const src = String(s.getAttribute('src') || '').trim()
            if (!src) continue
            const dataUrl = await inlineUrlString(src, window.location.href)
            if (!dataUrl) continue
            s.setAttribute('src', dataUrl)
          } catch {
            void 0
          }
        }

        const videos = Array.from(root.querySelectorAll('video[poster]')) as HTMLVideoElement[]
        for (const v of videos) {
          try {
            const poster = String(v.getAttribute('poster') || '').trim()
            if (!poster) continue
            const dataUrl = await inlineUrlString(poster, window.location.href)
            if (!dataUrl) continue
            v.setAttribute('poster', dataUrl)
          } catch {
            void 0
          }
        }
      }

      const rewriteCssUrls = async (cssText: string, baseUrl: string): Promise<string> => {
        const raw = String(cssText || '')
        if (!raw.trim()) return raw
        const re = /url\(\s*(['"]?)([^'")]+)\1\s*\)/gi
        const unique = new Set<string>()
        let m: RegExpExecArray | null = null
        while ((m = re.exec(raw))) {
          const u = String(m[2] || '').trim()
          if (!u) continue
          if (u.startsWith('data:') || u.startsWith('blob:')) continue
          if (u.startsWith('#')) continue
          if (/^javascript:/i.test(u)) continue
          try {
            unique.add(new URL(u, baseUrl).toString())
          } catch {
            void 0
          }
        }
        if (!unique.size) return raw
        const mapping = new Map<string, string>()
        for (const abs of unique) {
          const dataUrl = await tryInlineUrlAsData(abs)
          if (!dataUrl) continue
          mapping.set(abs, dataUrl)
        }
        if (!mapping.size) return raw
        return raw.replace(re, (_whole, quote: string, u: string) => {
          try {
            const abs = new URL(String(u || '').trim(), baseUrl).toString()
            const rep = mapping.get(abs)
            if (!rep) return _whole
            const q = quote || '"'
            return `url(${q}${rep}${q})`
          } catch {
            return _whole
          }
        })
      }

      const inlineCssInElement = async (root: HTMLElement): Promise<void> => {
        const styles = Array.from(root.querySelectorAll('style')) as HTMLStyleElement[]
        for (const s of styles) {
          try {
            const t = String(s.textContent || '')
            if (!t.trim()) continue
            const next = await rewriteCssUrls(t, window.location.href)
            if (next !== t) s.textContent = next
          } catch {
            void 0
          }
        }
        const styled = Array.from(root.querySelectorAll('[style]')) as HTMLElement[]
        for (const el of styled) {
          try {
            const style = String(el.getAttribute('style') || '')
            if (!style.includes('url(')) continue
            const next = await rewriteCssUrls(style, window.location.href)
            if (next !== style) el.setAttribute('style', next)
          } catch {
            void 0
          }
        }
      }

      const inlineScriptsInElement = async (root: HTMLElement): Promise<void> => {
        const scripts = Array.from(root.querySelectorAll('script[src]')) as HTMLScriptElement[]
        for (const s of scripts) {
          try {
            const src = String(s.getAttribute('src') || '').trim()
            if (!src) continue
            const abs = new URL(src, window.location.href)
            if (abs.origin !== window.location.origin) continue
            const resp = await fetch(abs.toString())
            if (!resp.ok) continue
            const len = Number(resp.headers.get('content-length') || '')
            if (Number.isFinite(len) && len > 0 && len > MAX_INLINE_ASSET_BYTES) continue
            const js = String(await resp.text())
            if (!js.trim()) continue
            s.removeAttribute('src')
            s.textContent = js
          } catch {
            void 0
          }
        }
      }

      const buildCssVarsStyle = (prefixes: string[]): string => {
        try {
          const cs = window.getComputedStyle(document.documentElement)
          const out: string[] = []
          for (let i = 0; i < cs.length; i++) {
            const k = cs.item(i)
            if (!k || !k.startsWith('--')) continue
            if (!prefixes.some(p => k.startsWith(p))) continue
            const v = cs.getPropertyValue(k)
            if (!v || !v.trim()) continue
            out.push(`${k}:${v.trim()}`)
          }
          if (!out.length) return ''
          return `:root{${out.join(';')}}`
        } catch {
          return ''
        }
      }

      const collectDocumentCss = (): {
        inlineCssChunks: Array<{ cssText: string; baseUrl: string }>
        externalLinks: Array<{ href: string; outerHtml: string }>
      } => {
        const inlineCssChunks: Array<{ cssText: string; baseUrl: string }> = []
        for (const sheet of Array.from(document.styleSheets)) {
          try {
            const rules = sheet.cssRules
            const parts: string[] = []
            for (const rule of Array.from(rules)) parts.push(rule.cssText)
            const cssText = parts.join('\n')
            if (!cssText.trim()) continue
            const baseUrl = sheet.href ? new URL(sheet.href, window.location.href).toString() : window.location.href
            inlineCssChunks.push({ cssText, baseUrl })
          } catch {
            void 0
          }
        }

        const links = Array.from(document.head.querySelectorAll('link[rel="stylesheet"][href]')) as HTMLLinkElement[]
        const externalLinks = links
          .filter(link => {
            try {
              const sheet = link.sheet as CSSStyleSheet | null
              if (!sheet) return true
              void sheet.cssRules
              return false
            } catch {
              return true
            }
          })
          .map(link => ({ href: String(link.getAttribute('href') || ''), outerHtml: link.outerHTML }))

        return { inlineCssChunks, externalLinks }
      }

      if (showWebpageHtml) {
        const s = String(iframeSrcDoc || '').trim()
        if (!s) {
          pushUiToast({ id: 'export-html-missing-view', kind: 'warning', message: 'Open the Viewer to export HTML.' })
          return
        }
        const isFullDoc = /<html[\s>]/i.test(s) || /<!doctype[\s>]/i.test(s)
        const html =
          isFullDoc && s.trim()
            ? s
            : [
                '<!doctype html>',
                '<html lang="en">',
                '<head>',
                '  <meta charset="utf-8" />',
                '  <meta name="viewport" content="width=device-width, initial-scale=1.0" />',
                `  <title>${exportBaseName}</title>`,
                '</head>',
                '<body>',
                s,
                '</body>',
                '</html>',
                '',
              ].join('\n')
        const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
        const name = `${exportBaseName}.html`
        const saved = await saveBlobWithPicker(blob, name, { description: 'HTML Files', accept: { 'text/html': ['.html'] } })
        if (saved === '') return
        if (!saved) downloadBlob(blob, name)
        return
      }

      const root = viewerEl || viewerRef.current
      if (!root) {
        pushUiToast({ id: 'export-html-missing-view', kind: 'warning', message: 'Open the Viewer to export HTML.' })
        return
      }
      const previewRoot = (root.querySelector('[data-testid="markdown-preview-root"]') as HTMLElement | null) || root
      const article = (previewRoot.querySelector('article') as HTMLElement | null) || previewRoot
      const cloned = article.cloneNode(true) as HTMLElement
      await inlineImagesInElement(cloned)
      await inlineMediaInElement(cloned)
      await inlineCssInElement(cloned)
      await inlineScriptsInElement(cloned)
      const bodyHtml = cloned.outerHTML

      const htmlClass = String(document.documentElement.className || '').trim()
      const { inlineCssChunks, externalLinks } = collectDocumentCss()
      const fetchedExternalCss: Array<{ cssText: string; baseUrl: string }> = []
      const externalLinkTags: string[] = []
      for (const link of externalLinks) {
        try {
          const href = String(link.href || '').trim()
          if (!href) continue
          const abs = new URL(href, window.location.href)
          const sameOrigin = abs.origin === window.location.origin
          if (!sameOrigin) {
            externalLinkTags.push(link.outerHtml)
            continue
          }
          const resp = await fetch(abs.toString())
          if (!resp.ok) {
            externalLinkTags.push(link.outerHtml)
            continue
          }
          const css = String(await resp.text())
          if (!css.trim()) continue
          fetchedExternalCss.push({ cssText: css, baseUrl: abs.toString() })
        } catch {
          externalLinkTags.push(link.outerHtml)
        }
      }

      const varsCss = buildCssVarsStyle(['--kg-'])
      const rewrittenExternal: string[] = []
      for (const chunk of fetchedExternalCss) {
        rewrittenExternal.push(await rewriteCssUrls(chunk.cssText, chunk.baseUrl))
      }
      const rewrittenInline: string[] = []
      for (const chunk of inlineCssChunks) {
        rewrittenInline.push(await rewriteCssUrls(chunk.cssText, chunk.baseUrl))
      }
      const combinedCss = [varsCss, ...rewrittenExternal, ...rewrittenInline].filter(Boolean).join('\n')
      const baseHref = (() => {
        try {
          const u = new URL(window.location.href)
          u.hash = ''
          return u.toString()
        } catch {
          return ''
        }
      })()

      const html = [
        '<!doctype html>',
        `<html lang="en"${htmlClass ? ` class="${htmlClass.replace(/"/g, '&quot;')}"` : ''}>`,
        '<head>',
        '  <meta charset="utf-8" />',
        '  <meta name="viewport" content="width=device-width, initial-scale=1.0" />',
        `  <title>${exportBaseName}</title>`,
        baseHref ? `  <base href="${baseHref.replace(/"/g, '&quot;')}" />` : '',
        externalLinkTags.length ? `  ${externalLinkTags.join('\n  ')}` : '',
        combinedCss ? '  <style>' + combinedCss.replace(/<\/style>/g, '<\\/style>') + '</style>' : '',
        '</head>',
        '<body>',
        bodyHtml,
        '</body>',
        '</html>',
        '',
      ].join('\n')

      const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
      const name = `${exportBaseName}.html`
      const saved = await saveBlobWithPicker(blob, name, { description: 'HTML Files', accept: { 'text/html': ['.html'] } })
      if (saved === '') return
      if (!saved) downloadBlob(blob, name)
    } catch {
      void 0
    }
  }, [exportBaseName, iframeSrcDoc, pushUiToast, showWebpageHtml, viewerEl, viewerRef])

  const handleExportHtmlCanvas = React.useCallback(async () => {
    try {
      const waitFrames = async (n: number) => {
        let left = Math.max(0, Math.floor(n))
        while (left > 0) {
          await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
          left -= 1
        }
      }

      const blobToDataUrl = async (blob: Blob): Promise<string> => {
        return await new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(String(reader.result || ''))
          reader.onerror = () => reject(new Error('Failed to read blob.'))
          reader.readAsDataURL(blob)
        })
      }

      const buildKgVarsStyle = (theme: 'light' | 'dark'): string => {
        try {
          ensureKgTokensInstalled(theme)
        } catch {
          void 0
        }
        try {
          const out: string[] = []
          for (let i = 0; i < KG_TOKEN_DEFS.length; i += 1) {
            const def = KG_TOKEN_DEFS[i]
            const v = resolveCssVarWithKgFallback(def.cssVar, theme)
            if (!v || !String(v).trim()) continue
            out.push(`${def.cssVar}:${String(v).trim()}`)
          }
          if (!out.length) return ''
          return `:root{${out.join(';')}}`
        } catch {
          return ''
        }
      }

      const fallbackSize = readCanvasViewportSizeFromDom()
      const store = useGraphStore.getState()
      const themeAttr = (() => {
        try {
          return getKgThemeFromDom()
        } catch {
          return 'light'
        }
      })()
      const canvasBgToken = (() => {
        try {
          return resolveCssVarWithKgFallback('--kg-canvas-bg', themeAttr)
        } catch {
          return themeAttr === 'dark' ? '#020617' : '#f3f4f6'
        }
      })()
      const textPrimaryToken = (() => {
        try {
          return resolveCssVarWithKgFallback('--kg-text-primary', themeAttr)
        } catch {
          return themeAttr === 'dark' ? '#f3f4f6' : '#111827'
        }
      })()
      const tooltipBgToken = (() => {
        try {
          return resolveCssVarWithKgFallback('--kg-tooltip-bg', themeAttr)
        } catch {
          return themeAttr === 'dark' ? '#0b1220' : '#111827'
        }
      })()
      const tooltipTextToken = (() => {
        try {
          return resolveCssVarWithKgFallback('--kg-tooltip-text', themeAttr)
        } catch {
          return themeAttr === 'dark' ? '#f3f4f6' : '#ffffff'
        }
      })()
      const normalizeExportColor = (value: string, fallback: string): string => {
        const v = String(value || '').trim().toLowerCase()
        if (!v || v === 'none' || v === 'transparent' || v === 'rgba(0, 0, 0, 0)' || v === 'rgb(0, 0, 0, 0)') return fallback
        return value
      }
      const resolveExportPaint = (value: string, fallback: string): string => {
        let raw = String(value || '').trim()
        if (!raw) return fallback
        const m = raw.match(/^var\(\s*(--[a-z0-9-]+)\s*(?:,\s*([^)]+))?\)$/i)
        if (m) {
          const varName = String(m[1] || '').trim()
          const inlineFallback = String(m[2] || '').trim()
          try {
            raw = String(resolveCssVarWithKgFallback(varName as `--kg-${string}`, themeAttr) || '').trim() || inlineFallback || fallback
          } catch {
            raw = inlineFallback || fallback
          }
        }
        return normalizeExportColor(raw, fallback)
      }
      const normalizeExportOpacity = (value: unknown, fallback: number | null = null): number | null => {
        const n = typeof value === 'number' ? value : Number(value)
        if (!Number.isFinite(n)) return fallback
        return Math.max(0, Math.min(1, n))
      }
      const canvasLabelFillToken = (() => {
        try {
          return normalizeExportColor(resolveCssVarWithKgFallback('--kg-canvas-label-fill', themeAttr), textPrimaryToken)
        } catch {
          return textPrimaryToken
        }
      })()
      const canvasLabelHaloToken = (() => {
        try {
          return normalizeExportColor(resolveCssVarWithKgFallback('--kg-canvas-label-halo', themeAttr), themeAttr === 'dark' ? '#000000' : '#ffffff')
        } catch {
          return themeAttr === 'dark' ? '#000000' : '#ffffff'
        }
      })()
      const labelsForExport = (() => {
        try {
          const gd = store.graphData as unknown as { nodes?: Array<{ id?: unknown; label?: unknown }>; edges?: Array<{ id?: unknown; label?: unknown }> } | null
          const out: { nodes: Record<string, string>; edges: Record<string, string>; groups: Record<string, string> } = { nodes: {}, edges: {}, groups: {} }
          if (!gd || !Array.isArray(gd.nodes) || !Array.isArray(gd.edges)) return out
          for (let i = 0; i < gd.nodes.length; i += 1) {
            const n = gd.nodes[i]
            const id = String(n?.id ?? '').trim()
            if (!id) continue
            const label = String(n?.label ?? '').trim()
            out.nodes[id] = label
          }
          for (let i = 0; i < gd.edges.length; i += 1) {
            const e = gd.edges[i]
            const id = String(e?.id ?? '').trim()
            if (!id) continue
            const label = String(e?.label ?? '').trim()
            out.edges[id] = label
          }
          return out
        } catch {
          return { nodes: {}, edges: {}, groups: {} }
        }
      })()

      const edgeEndpointsForExport = (() => {
        try {
          const gd = store.graphData as unknown as { edges?: Array<{ id?: unknown; source?: unknown; target?: unknown }> } | null
          const out: Record<string, { s: string; t: string }> = {}
          if (!gd || !Array.isArray(gd.edges)) return out
          for (let i = 0; i < gd.edges.length; i += 1) {
            const e = gd.edges[i]
            const id = String(e?.id ?? '').trim()
            const s = String(e?.source ?? '').trim()
            const t = String(e?.target ?? '').trim()
            if (!id || !s || !t) continue
            out[id] = { s, t }
          }
          return out
        } catch {
          return {}
        }
      })()
      const labelColorsForExport: { nodes: Record<string, string>; edges: Record<string, string>; groups: Record<string, string> } = {
        nodes: {},
        edges: {},
        groups: {},
      }
      const shapeColorsForExport: { nodes: Record<string, string>; edges: Record<string, string>; groups: Record<string, string> } = {
        nodes: {},
        edges: {},
        groups: {},
      }
      const shapeOpacityForExport: { nodes: Record<string, number>; edges: Record<string, number>; groups: Record<string, number> } = {
        nodes: {},
        edges: {},
        groups: {},
      }
      try {
        const gd = store.graphData as unknown as { nodes?: Array<{ id?: unknown; label?: unknown; type?: unknown; properties?: Record<string, unknown> }>; edges?: Array<{ id?: unknown; source?: unknown; target?: unknown; label?: unknown; properties?: Record<string, unknown> }> } | null
        if (gd && Array.isArray(gd.nodes) && Array.isArray(gd.edges)) {
          const selectionParams = {
            data: store.graphData,
            schema: store.schema,
            selectedNodeId: store.selectedNodeId,
            selectedEdgeId: store.selectedEdgeId,
            selectedNodeIds: store.selectedNodeIds,
            selectedEdgeIds: store.selectedEdgeIds,
            renderMediaAsNodes: store.renderMediaAsNodes === true,
            mediaNodeOpacity: typeof store.mediaNodeOpacity === 'number' ? store.mediaNodeOpacity : undefined,
          }
          const neighborIds = computeNeighborIds(selectionParams)
          for (let i = 0; i < gd.nodes.length; i += 1) {
            const n = gd.nodes[i]
            const id = String(n?.id ?? '').trim()
            if (!id) continue
            let c = ''
            let o: number | null = null
            try {
              const vis = computeNodeVisual(n as never, { ...selectionParams, neighborIds })
              c = String(vis?.fill || '').trim()
              o = normalizeExportOpacity(vis?.opacity, null)
            } catch {
              c = String(getNodeBaseFill(n as never, store.schema) || '').trim()
            }
            c = resolveExportPaint(c, '')
            if (c) shapeColorsForExport.nodes[id] = c
            if (o != null) shapeOpacityForExport.nodes[id] = o
          }
          for (let i = 0; i < gd.edges.length; i += 1) {
            const e = gd.edges[i]
            const id = String(e?.id ?? '').trim()
            if (!id) continue
            let c = ''
            let o: number | null = null
            try {
              const vis = computeEdgeVisual(e as never, selectionParams as never)
              c = String(vis?.stroke || '').trim()
              o = normalizeExportOpacity(vis?.opacity, null)
            } catch {
              c = String(getEdgeBaseStroke(e as never, store.schema) || '').trim()
            }
            c = resolveExportPaint(c, '')
            if (c) shapeColorsForExport.edges[id] = c
            if (o != null) shapeOpacityForExport.edges[id] = o
          }
          const groups = deriveGraphGroups(store.graphData)
          for (let i = 0; i < groups.length; i += 1) {
            const g = groups[i]
            const id = String(g?.id || '').trim()
            if (!id) continue
            const c = resolveExportPaint(String(g?.style?.stroke || g?.style?.fill || '').trim(), '')
            if (c) shapeColorsForExport.groups[id] = c
            const o = normalizeExportOpacity((g as unknown as { style?: Record<string, unknown> })?.style?.opacity, null)
            if (o != null) shapeOpacityForExport.groups[id] = o
          }
        }
      } catch {
        void 0
      }
      let labelsForExportB64 = ''

      const geospatialEnabled = (() => {
        try {
          return lsBool(LS_KEYS.geospatialOverlayEnabled, false)
        } catch {
          return false
        }
      })()
      const wants3dExport =
        store.canvasRenderMode === '3d' ||
        (store.canvasRenderModeIsAuto === true && store.canvasRenderModeLastFree === '3d')

      let svgMarkup: string | null = null
      if (wants3dExport && !geospatialEnabled) {
        try {
          const graphData = store.graphData
          const schema = store.schema
          if (graphData && schema) {
            const centered3d = exportGraphAsCentered3dSvgMarkup({
              graphData,
              schema,
              widthPx: Math.max(800, fallbackSize.w || 0),
              heightPx: Math.max(600, fallbackSize.h || 0),
              paddingPx: 96,
              includeXmlDeclaration: false,
              animated: true,
              exportAutoRotate: true,
              exportAutoRotateSpeed: 0.85,
              exportMotionIntensityMultiplier: 1.75,
              threeEdgeRenderer: store.threeEdgeRenderer,
            })
            const trimmed = String(centered3d || '').trim()
            if (trimmed) svgMarkup = trimmed
          }
        } catch {
          void 0
        }
      }
      const canvasViewportEl = document.querySelector('section[aria-label="Canvas viewport"]') as HTMLElement | null
      const bg = (() => {
        try {
          const isTransparent = (s: string) => {
            const v = String(s || '').trim().toLowerCase()
            return !v || v === 'transparent' || v === 'rgba(0, 0, 0, 0)' || v === 'rgb(0, 0, 0, 0)'
          }
          const read = (el: Element | null) => {
            if (!el) return ''
            const v = window.getComputedStyle(el as Element).backgroundColor
            return typeof v === 'string' && !isTransparent(v) ? v.trim() : ''
          }
          return (
            read(canvasViewportEl) ||
            read(document.querySelector('[data-testid="app-root"]')) ||
            read(document.body) ||
            read(document.documentElement) ||
            ''
          )
        } catch {
          return ''
        }
      })()
      const fg = (() => {
        try {
          const read = (el: Element | null) => {
            if (!el) return ''
            const v = window.getComputedStyle(el as Element).color
            return typeof v === 'string' && v.trim() ? v.trim() : ''
          }
          return read(canvasViewportEl) || read(document.querySelector('[data-testid="app-root"]')) || read(document.body) || read(document.documentElement) || ''
        } catch {
          return ''
        }
      })()
      const exportBg = bg || canvasBgToken
      const exportFg = fg || textPrimaryToken
      const svgEl =
        (canvasViewportEl?.querySelector('svg[data-kg-canvas-interactive="1"]') as SVGSVGElement | null) ||
        (canvasViewportEl?.querySelector('svg[aria-label="Design renderer"]') as SVGSVGElement | null)
      if (svgEl) {
        try {
          const readPaint = (el: Element): string => {
            try {
              const attrFill = String(el.getAttribute('fill') || '').trim()
              if (attrFill && attrFill !== 'none' && attrFill !== 'transparent') return attrFill
            } catch {
              void 0
            }
            try {
              const inline = String(el.getAttribute('style') || '')
              const m = inline.match(/(?:^|;)\s*fill\s*:\s*([^;]+)/i)
              if (m && m[1]) {
                const v = String(m[1]).trim()
                if (v && v !== 'none' && v !== 'transparent') return v
              }
            } catch {
              void 0
            }
            try {
              const cs = window.getComputedStyle(el as Element).fill
              const v = String(cs || '').trim()
              if (v && v !== 'none' && v !== 'transparent') return v
            } catch {
              void 0
            }
            return ''
          }
          const readStroke = (el: Element): string => {
            try {
              const attrStroke = String(el.getAttribute('stroke') || '').trim()
              if (attrStroke && attrStroke !== 'none' && attrStroke !== 'transparent') return attrStroke
            } catch {
              void 0
            }
            try {
              const inline = String(el.getAttribute('style') || '')
              const m = inline.match(/(?:^|;)\s*stroke\s*:\s*([^;]+)/i)
              if (m && m[1]) {
                const v = String(m[1]).trim()
                if (v && v !== 'none' && v !== 'transparent') return v
              }
            } catch {
              void 0
            }
            try {
              const cs = window.getComputedStyle(el as Element).stroke
              const v = String(cs || '').trim()
              if (v && v !== 'none' && v !== 'transparent') return v
            } catch {
              void 0
            }
            return ''
          }
          const readOpacity = (el: Element): number | null => {
            try {
              const attr = normalizeExportOpacity(el.getAttribute('opacity'), null)
              if (attr != null) return attr
            } catch {
              void 0
            }
            try {
              const inline = String(el.getAttribute('style') || '')
              const m = inline.match(/(?:^|;)\s*opacity\s*:\s*([^;]+)/i)
              if (m && m[1]) {
                const v = normalizeExportOpacity(m[1], null)
                if (v != null) return v
              }
            } catch {
              void 0
            }
            try {
              const cs = normalizeExportOpacity(window.getComputedStyle(el as Element).opacity, null)
              if (cs != null) return cs
            } catch {
              void 0
            }
            return null
          }
          for (const el of Array.from(svgEl.querySelectorAll('g[data-kg-layer="labels"] text[data-node-id]'))) {
            const id = String(el.getAttribute('data-node-id') || '').trim()
            if (!id) continue
            const text = String(el.textContent || '').trim()
            if (text) labelsForExport.nodes[id] = text
            const color = readPaint(el)
            if (color) labelColorsForExport.nodes[id] = resolveExportPaint(color, '')
          }
          for (const el of Array.from(svgEl.querySelectorAll('circle[data-node-id],rect[data-node-id],path[data-node-id],g.media-node-panel[data-node-id]'))) {
            const id = String(el.getAttribute('data-node-id') || '').trim()
            if (!id) continue
            const color = readPaint(el)
            if (color) shapeColorsForExport.nodes[id] = resolveExportPaint(color, '')
            const opacity = readOpacity(el)
            if (opacity != null) shapeOpacityForExport.nodes[id] = opacity
          }
          for (const el of Array.from(svgEl.querySelectorAll('g[data-kg-layer="edge-labels"] text[data-edge-id]'))) {
            const id = String(el.getAttribute('data-edge-id') || '').trim()
            if (!id) continue
            const text = String(el.textContent || '').trim()
            if (text) labelsForExport.edges[id] = text
            const color = readPaint(el)
            if (color) labelColorsForExport.edges[id] = resolveExportPaint(color, '')
          }
          for (const el of Array.from(svgEl.querySelectorAll('[data-edge-id]'))) {
            const id = String(el.getAttribute('data-edge-id') || '').trim()
            if (!id) continue
            const color = readStroke(el) || readPaint(el)
            if (color) shapeColorsForExport.edges[id] = resolveExportPaint(color, '')
            const opacity = readOpacity(el)
            if (opacity != null) shapeOpacityForExport.edges[id] = opacity
          }
          for (const el of Array.from(svgEl.querySelectorAll('g[data-kg-layer="group-labels"] text[data-kg-group-id], text[data-kg-group-label="1"][data-kg-group-id]'))) {
            const id = String(el.getAttribute('data-kg-group-id') || '').trim()
            if (!id) continue
            const text = String(el.textContent || '').trim()
            if (text) labelsForExport.groups[id] = text
            const color = readPaint(el)
            if (color) labelColorsForExport.groups[id] = resolveExportPaint(color, '')
          }
          for (const el of Array.from(svgEl.querySelectorAll('[data-kg-shape="group-rect"][data-kg-group-id], [data-kg-shape="group-geo"][data-kg-group-id], [data-kg-group-chevron="1"][data-kg-group-id], g[data-kg-group-id]'))) {
            const id = String(el.getAttribute('data-kg-group-id') || '').trim()
            if (!id) continue
            const color = readStroke(el) || readPaint(el)
            if (color) shapeColorsForExport.groups[id] = resolveExportPaint(color, '')
            const opacity = readOpacity(el)
            if (opacity != null) shapeOpacityForExport.groups[id] = opacity
          }
        } catch {
          void 0
        }
      }
      if (wants3dExport && !svgEl) {
        try {
          const captured2d = String((await store.captureCanvasSvgSnapshot('2d')) || '').trim()
          if (captured2d) {
            const parser = new DOMParser()
            const doc = parser.parseFromString(captured2d, 'image/svg+xml')
            const root = doc.documentElement
            if (root && String(root.nodeName || '').toLowerCase() === 'svg') {
              const readPaint = (el: Element): string => {
                try {
                  const attrFill = String(el.getAttribute('fill') || '').trim()
                  if (attrFill && attrFill !== 'none' && attrFill !== 'transparent') return attrFill
                } catch {
                  void 0
                }
                try {
                  const inline = String(el.getAttribute('style') || '')
                  const m = inline.match(/(?:^|;)\s*fill\s*:\s*([^;]+)/i)
                  if (m && m[1]) {
                    const v = String(m[1]).trim()
                    if (v && v !== 'none' && v !== 'transparent') return v
                  }
                } catch {
                  void 0
                }
                return ''
              }
              const readStroke = (el: Element): string => {
                try {
                  const attrStroke = String(el.getAttribute('stroke') || '').trim()
                  if (attrStroke && attrStroke !== 'none' && attrStroke !== 'transparent') return attrStroke
                } catch {
                  void 0
                }
                try {
                  const inline = String(el.getAttribute('style') || '')
                  const m = inline.match(/(?:^|;)\s*stroke\s*:\s*([^;]+)/i)
                  if (m && m[1]) {
                    const v = String(m[1]).trim()
                    if (v && v !== 'none' && v !== 'transparent') return v
                  }
                } catch {
                  void 0
                }
                return ''
              }
              const readOpacity = (el: Element): number | null => {
                try {
                  const attr = normalizeExportOpacity(el.getAttribute('opacity'), null)
                  if (attr != null) return attr
                } catch {
                  void 0
                }
                try {
                  const inline = String(el.getAttribute('style') || '')
                  const m = inline.match(/(?:^|;)\s*opacity\s*:\s*([^;]+)/i)
                  if (m && m[1]) {
                    const v = normalizeExportOpacity(m[1], null)
                    if (v != null) return v
                  }
                } catch {
                  void 0
                }
                return null
              }
              for (const el of Array.from(root.querySelectorAll('g[data-kg-layer="labels"] text[data-node-id]'))) {
                const id = String(el.getAttribute('data-node-id') || '').trim()
                if (!id) continue
                const text = String(el.textContent || '').trim()
                if (text) labelsForExport.nodes[id] = text
                const color = readPaint(el)
                if (color) labelColorsForExport.nodes[id] = resolveExportPaint(color, '')
              }
              for (const el of Array.from(root.querySelectorAll('circle[data-node-id],rect[data-node-id],path[data-node-id],g.media-node-panel[data-node-id]'))) {
                const id = String(el.getAttribute('data-node-id') || '').trim()
                if (!id) continue
                const color = readPaint(el)
                if (color) shapeColorsForExport.nodes[id] = resolveExportPaint(color, '')
                const opacity = readOpacity(el)
                if (opacity != null) shapeOpacityForExport.nodes[id] = opacity
              }
              for (const el of Array.from(root.querySelectorAll('g[data-kg-layer="edge-labels"] text[data-edge-id]'))) {
                const id = String(el.getAttribute('data-edge-id') || '').trim()
                if (!id) continue
                const text = String(el.textContent || '').trim()
                if (text) labelsForExport.edges[id] = text
                const color = readPaint(el)
                if (color) labelColorsForExport.edges[id] = resolveExportPaint(color, '')
              }
              for (const el of Array.from(root.querySelectorAll('[data-edge-id]'))) {
                const id = String(el.getAttribute('data-edge-id') || '').trim()
                if (!id) continue
                const color = readStroke(el) || readPaint(el)
                if (color) shapeColorsForExport.edges[id] = resolveExportPaint(color, '')
                const opacity = readOpacity(el)
                if (opacity != null) shapeOpacityForExport.edges[id] = opacity
              }
              for (const el of Array.from(root.querySelectorAll('g[data-kg-layer="group-labels"] text[data-kg-group-id], text[data-kg-group-label="1"][data-kg-group-id]'))) {
                const id = String(el.getAttribute('data-kg-group-id') || '').trim()
                if (!id) continue
                const text = String(el.textContent || '').trim()
                if (text) labelsForExport.groups[id] = text
                const color = readPaint(el)
                if (color) labelColorsForExport.groups[id] = resolveExportPaint(color, '')
              }
              for (const el of Array.from(root.querySelectorAll('[data-kg-shape="group-rect"][data-kg-group-id], [data-kg-shape="group-geo"][data-kg-group-id], [data-kg-group-chevron="1"][data-kg-group-id], g[data-kg-group-id]'))) {
                const id = String(el.getAttribute('data-kg-group-id') || '').trim()
                if (!id) continue
                const color = readStroke(el) || readPaint(el)
                if (color) shapeColorsForExport.groups[id] = resolveExportPaint(color, '')
                const opacity = readOpacity(el)
                if (opacity != null) shapeOpacityForExport.groups[id] = opacity
              }
            }
          }
        } catch {
          void 0
        }
      }
      if (svgEl && !geospatialEnabled && !wants3dExport) {
        const s = buildStandaloneSvgMarkupFromElement(svgEl, {
          paddingPx: 96,
          includeXmlDeclaration: false,
          inlineComputedStyles: true,
          removeCssClasses: false,
          removeDataAttributes: false,
          removeZoomTransformOnFirstGroup: true,
        })
        if (s && s.trim()) {
          const enhance = (raw: string): string => {
            try {
              const parser = new DOMParser()
              const doc = parser.parseFromString(raw, 'image/svg+xml')
              const root = doc.documentElement
              if (!root || String(root.nodeName || '').toLowerCase() !== 'svg') return raw
              const attachTitle = (el: Element, text: string) => {
                const t = String(text || '').trim()
                if (!t) return
                try {
                  const existing = el.querySelector('title')
                  if (existing) return
                } catch {
                  void 0
                }
                const title = doc.createElementNS('http://www.w3.org/2000/svg', 'title')
                title.textContent = t
                try {
                  el.insertBefore(title, el.firstChild)
                } catch {
                  try {
                    el.appendChild(title)
                  } catch {
                    void 0
                  }
                }
              }
              const normalizeStyle = (el: Element, extra?: string) => {
                const prev = String(el.getAttribute('style') || '')
                const cleaned = prev
                  .replace(/(?:^|;)\s*display\s*:\s*none\s*;?/gi, ';')
                  .replace(/(?:^|;)\s*visibility\s*:\s*hidden\s*;?/gi, ';')
                  .replace(/(?:^|;)\s*opacity\s*:\s*0(?:\.0+)?\s*;?/gi, ';')
                  .replace(/;{2,}/g, ';')
                  .trim()
                const suffix = String(extra || '').trim()
                el.setAttribute('style', `${cleaned ? cleaned.replace(/;?\s*$/, ';') : ''}${suffix}`)
              }
              const ensureVisibleText = (el: Element, opts?: { forceLabelColor?: boolean }) => {
                try {
                  el.setAttribute('data-lod-hidden', '0')
                  el.setAttribute('data-zoom-lod-hidden', '0')
                  el.removeAttribute('hidden')
                  const layer = el.closest('g[data-kg-layer]')
                  if (layer) {
                    layer.removeAttribute('hidden')
                    layer.setAttribute('display', 'inline')
                    layer.setAttribute('visibility', 'visible')
                    layer.setAttribute('opacity', '1')
                    normalizeStyle(layer, 'display:inline;visibility:visible;opacity:1;')
                  }
                  el.setAttribute('display', 'inline')
                  el.setAttribute('visibility', 'visible')
                  el.setAttribute('opacity', '1')
                  if (opts?.forceLabelColor) {
                    const fill = String(el.getAttribute('fill') || '').trim().toLowerCase()
                    const stroke = String(el.getAttribute('stroke') || '').trim().toLowerCase()
                    if (!fill || fill === 'none' || fill === 'transparent') el.setAttribute('fill', canvasLabelFillToken)
                    if (!stroke || stroke === 'none' || stroke === 'transparent') el.setAttribute('stroke', canvasLabelHaloToken)
                  }
                  normalizeStyle(el, 'display:inline;visibility:visible;opacity:1;pointer-events:all;')
                } catch {
                  void 0
                }
              }
              const hash01 = (s: string) => {
                let h = 2166136261
                for (let i = 0; i < s.length; i += 1) {
                  h ^= s.charCodeAt(i)
                  h = Math.imul(h, 16777619)
                }
                return ((h >>> 0) % 1000) / 1000
              }
              const nodeSel = 'circle[data-node-id],rect[data-node-id],path[data-node-id],g.media-node-panel[data-node-id]'
              for (const el of Array.from(root.querySelectorAll(nodeSel))) {
                const id = String(el.getAttribute('data-node-id') || '').trim()
                if (!id) continue
                attachTitle(el, labelsForExport.nodes[id] || id)
                const d = 2.8 + hash01(id) * 1.6
                const delay = hash01(id + ':d') * 1.2
                const amp = 1.5 + hash01(id + ':a') * 1.8
                const prev = String(el.getAttribute('style') || '')
                const next = `${prev ? prev.replace(/;?\s*$/, ';') : ''}pointer-events:all;transform-box:fill-box;transform-origin:center;animation:kgNodeBob ${d.toFixed(2)}s ease-in-out ${delay.toFixed(2)}s infinite;--kg-bob-amp:${amp.toFixed(2)}px;`
                el.setAttribute('style', next)
                try {
                  const existing = el.querySelector('animateTransform[data-kg-anim="1"]')
                  if (!existing) {
                    const anim = doc.createElementNS('http://www.w3.org/2000/svg', 'animateTransform')
                    anim.setAttribute('data-kg-anim', '1')
                    anim.setAttribute('attributeName', 'transform')
                    anim.setAttribute('attributeType', 'XML')
                    anim.setAttribute('type', 'translate')
                    anim.setAttribute('additive', 'sum')
                    anim.setAttribute('dur', `${d.toFixed(2)}s`)
                    anim.setAttribute('begin', `${delay.toFixed(2)}s`)
                    anim.setAttribute('repeatCount', 'indefinite')
                    anim.setAttribute('values', `0 0;0 ${(-amp).toFixed(2)};0 0`)
                    el.appendChild(anim)
                  }
                } catch {
                  void 0
                }
              }
              const edgeSel = '[data-edge-id]'
              for (const el of Array.from(root.querySelectorAll(edgeSel))) {
                const id = String(el.getAttribute('data-edge-id') || '').trim()
                if (!id) continue
                attachTitle(el, labelsForExport.edges[id] || id)
                try {
                  const prev = String(el.getAttribute('style') || '')
                  if (!/\bpointer-events\s*:/i.test(prev)) {
                    el.setAttribute('style', `${prev ? prev.replace(/;?\s*$/, ';') : ''}pointer-events:all;`)
                  }
                } catch {
                  void 0
                }
              }
              for (const el of Array.from(root.querySelectorAll('g[data-kg-layer="labels"] text[data-node-id]'))) {
                ensureVisibleText(el, { forceLabelColor: true })
              }
              for (const el of Array.from(root.querySelectorAll('g[data-kg-layer="edge-labels"] text[data-edge-id]'))) {
                ensureVisibleText(el, { forceLabelColor: true })
              }
              for (const el of Array.from(root.querySelectorAll('g[data-kg-layer="labels"], g[data-kg-layer="edge-labels"], g[data-kg-layer="group-labels"]'))) {
                normalizeStyle(el, 'display:inline;visibility:visible;opacity:1;')
              }
              for (const el of Array.from(root.querySelectorAll('g[data-kg-layer="group-labels"] text[data-kg-group-id], text[data-kg-group-label="1"][data-kg-group-id]'))) {
                const gid = String(el.getAttribute('data-kg-group-id') || '').trim()
                const text = String(el.textContent || '').trim()
                if (gid && text) labelsForExport.groups[gid] = text
                attachTitle(el, labelsForExport.groups[gid] || gid)
                ensureVisibleText(el, { forceLabelColor: true })
              }
              for (const el of Array.from(root.querySelectorAll('[data-kg-shape="group-rect"][data-kg-group-id], [data-kg-shape="group-geo"][data-kg-group-id], [data-kg-group-chevron="1"][data-kg-group-id]'))) {
                const gid = String(el.getAttribute('data-kg-group-id') || '').trim()
                if (!gid) continue
                const text = labelsForExport.groups[gid] || gid
                attachTitle(el, text)
                normalizeStyle(el, 'pointer-events:all;')
              }
              try {
                const tokenMap = new Map<string, string>()
                for (let i = 0; i < KG_TOKEN_DEFS.length; i += 1) {
                  const def = KG_TOKEN_DEFS[i]
                  const v = resolveCssVarWithKgFallback(def.cssVar, themeAttr)
                  if (v && String(v).trim()) tokenMap.set(def.cssVar, String(v).trim())
                }
                const svgOut = new XMLSerializer().serializeToString(root)
                return svgOut.replace(/var\(\s*(--kg-[a-z0-9-]+)\s*(?:,\s*[^)]+)?\)/gi, (_m, name: string) => {
                  const v = tokenMap.get(String(name || '').trim())
                  return v || _m
                })
              } catch {
                return new XMLSerializer().serializeToString(root)
              }
            } catch {
              return raw
            }
          }
          svgMarkup = enhance(s.trim()).trim()
        }
      }
      if (!svgMarkup && !geospatialEnabled && !wants3dExport) {
        try {
          const captured = await store.captureCanvasSvgSnapshot()
          const trimmed = String(captured || '').trim()
          if (trimmed) svgMarkup = trimmed
        } catch {
          void 0
        }
      }

      let bodyHtml = ''
      let threeModuleScript: string | null = null

      const mediaOverlayHtml = (() => {
        if (store.renderMediaAsNodes !== true) return ''
        const nodes = Array.isArray((store.graphData as { nodes?: unknown[] } | null)?.nodes)
          ? ((store.graphData as unknown as { nodes: GraphNode[] }).nodes as GraphNode[])
          : []
        if (!nodes.length) return ''
        const poolMax = (() => {
          const raw = (store as unknown as { threeIframeOverlayPoolMax?: unknown }).threeIframeOverlayPoolMax
          const n = typeof raw === 'number' ? raw : Number(raw)
          if (!Number.isFinite(n)) return 24
          const v = Math.floor(n)
          if (v <= 0) return 0
          return Math.min(200, Math.max(0, v))
        })()
        const escapeAttr = (v: string): string =>
          String(v || '')
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
        const escapeText = (v: string): string =>
          String(v || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
        const parts: string[] = []
        let picked = 0
        for (let i = 0; i < nodes.length; i += 1) {
          if (poolMax > 0 && picked >= poolMax) break
          const n = nodes[i]
          const id = String(n?.id ?? '').trim()
          if (!id) continue
          const spec = getNodeMediaSpec(n)
          if (!spec) continue
          const titleRaw = String(n?.label ?? n?.id ?? '').trim() || 'Media node'
          const title = escapeText(titleRaw)
          const url = escapeAttr(String(spec.url || '').trim())
          const interactive = spec.interactive !== false ? '1' : '0'
          const kind = spec.kind === 'image' || spec.kind === 'svg' || spec.kind === 'video' ? spec.kind : 'iframe'
          const content =
            kind === 'iframe'
              ? `<iframe title="${escapeAttr(titleRaw)}" src="${url}" loading="eager" referrerpolicy="no-referrer" allow="fullscreen; autoplay; clipboard-read; clipboard-write; geolocation" style="display:block;width:100%;height:100%;border:0;border-radius:calc(var(--kg-media-panel-radius, 10px) * 0.8);background:transparent;"></iframe>`
              : kind === 'video'
                ? `<video src="${url}" playsinline muted controls preload="metadata" style="display:block;width:100%;height:100%;border:0;border-radius:calc(var(--kg-media-panel-radius, 10px) * 0.8);object-fit:cover;background:transparent;"></video>`
                : `<img src="${url}" alt="${escapeAttr(titleRaw)}" loading="eager" style="display:block;width:100%;height:100%;border:0;border-radius:calc(var(--kg-media-panel-radius, 10px) * 0.8);object-fit:cover;background:transparent;" />`
          parts.push(
            `<div class="kgExportMediaPanel" data-node-id="${escapeAttr(id)}" data-kg-media-kind="${escapeAttr(kind)}" data-kg-media-interactive="${interactive}">` +
              `<header class="kgExportMediaHeader" title="${escapeAttr(titleRaw)}">${title}</header>` +
              `<section class="kgExportMediaBody">${content}</section>` +
            `</div>`,
          )
          picked += 1
        }
        if (!parts.length) return ''
        return `<div class="kgExportMediaOverlayRoot">${parts.join('')}</div>`
      })()

      if (svgMarkup) {
        const stripped = svgMarkup.replace(/^\s*<\?xml[^>]*>\s*/i, '')
        bodyHtml = `<div class="kgExportCanvasRoot"><div class="kgExportCanvasStage">${stripped}${mediaOverlayHtml}</div></div>`
      } else {
        const shouldTry3dFit = !geospatialEnabled && wants3dExport
        const shouldTry2dFit =
          !geospatialEnabled &&
          store.canvasRenderMode === '2d' &&
          (store.canvas2dRenderer === 'flow' || store.canvas2dRenderer === 'flowEditor')

        const prev3d = shouldTry3dFit ? store.captureThreeCameraPose() : null
        let poseForExport = prev3d
        const prev2d = shouldTry2dFit ? store.zoomState : null

        if (shouldTry3dFit && prev3d) {
          try {
            store.requestThreeCamera('fit')
            await waitFrames(2)
            poseForExport = store.captureThreeCameraPose() || prev3d
          } catch {
            void 0
          }
        } else if (shouldTry2dFit && prev2d) {
          try {
            store.requestZoom('fit', { intent: 'fitToView' })
            await waitFrames(2)
          } catch {
            void 0
          }
        }

        const glbForThree = await (async () => {
          if (!shouldTry3dFit) return null
          try {
            return await store.captureThreeGlbSnapshot()
          } catch {
            return null
          }
        })()

        if (glbForThree) {
          const clamp01 = (v: number) => Math.max(0, Math.min(1, v))
          const threeCfg = getThreeConfig(store.schema)
          const fogColor =
            typeof threeCfg.fogColor === 'string' && threeCfg.fogColor.trim() !== ''
              ? threeCfg.fogColor.trim()
              : null
          const fogNearRaw = typeof threeCfg.fogNear === 'number' ? threeCfg.fogNear : 180
          const fogFarRaw = typeof threeCfg.fogFar === 'number' ? threeCfg.fogFar : 360
          const fogNear = Math.max(1, Math.min(fogNearRaw, fogFarRaw - 1))
          const fogFar = Math.max(fogNear + 1, fogFarRaw)
          const dampingFactor = clamp01(typeof threeCfg.cameraDampingFactor === 'number' ? threeCfg.cameraDampingFactor : 0.06)
          const rotateSpeed = typeof threeCfg.cameraRotateSpeed === 'number' ? threeCfg.cameraRotateSpeed : 0.6
          const zoomSpeed = typeof threeCfg.cameraZoomSpeed === 'number' ? threeCfg.cameraZoomSpeed : 0.8
          const panSpeed = typeof threeCfg.cameraPanSpeed === 'number' ? threeCfg.cameraPanSpeed : 0.5
          const autoRotate = !!threeCfg.cameraAutoRotate
          const autoRotateSpeed = typeof threeCfg.cameraAutoRotateSpeed === 'number' ? threeCfg.cameraAutoRotateSpeed : 0.4
          const nodeMotionIntensity = typeof threeCfg.nodeMotionIntensity === 'number' ? Math.max(0, Math.min(2, threeCfg.nodeMotionIntensity)) : 1
          const offlineModules = await (async () => {
            try {
              return await loadThreeOfflineModuleSources()
            } catch {
              return null
            }
          })()
          const glbDataUrl = await blobToDataUrl(glbForThree)
          const glbJs = JSON.stringify(glbDataUrl)
          const poseJs = JSON.stringify(poseForExport || null)
          const offlineJs = JSON.stringify(offlineModules)
          const labelsJs = JSON.stringify(labelsForExport)
          const labelColorsJs = JSON.stringify(labelColorsForExport)
          const shapeColorsJs = JSON.stringify(shapeColorsForExport)
          const shapeOpacityJs = JSON.stringify(shapeOpacityForExport)
          const edgeEndpointsJs = JSON.stringify(edgeEndpointsForExport)
          const threeCfgJs = JSON.stringify({
            fogColor,
            fogNear,
            fogFar,
            dampingFactor,
            rotateSpeed,
            zoomSpeed,
            panSpeed,
            autoRotate,
            autoRotateSpeed,
            nodeMotionIntensity,
            bg: exportBg,
          })
          const mediaCfgForThreeJs = (() => {
            const density = store.mediaPanelDensity === 'compact' ? 'compact' : 'default'
            const num = (v: unknown, fallback: number) => {
              const n = typeof v === 'number' ? v : Number(v)
              return Number.isFinite(n) ? n : fallback
            }
            return JSON.stringify({
              density,
              widthRatioDefault: num((store as unknown as { threeIframeOverlayBaseWidthRatioDefault?: unknown }).threeIframeOverlayBaseWidthRatioDefault, 0.2),
              widthRatioCompact: num((store as unknown as { threeIframeOverlayBaseWidthRatioCompact?: unknown }).threeIframeOverlayBaseWidthRatioCompact, 0.16),
              widthMinDefault: num((store as unknown as { threeIframeOverlayBaseWidthMinPxDefault?: unknown }).threeIframeOverlayBaseWidthMinPxDefault, 210),
              widthMinCompact: num((store as unknown as { threeIframeOverlayBaseWidthMinPxCompact?: unknown }).threeIframeOverlayBaseWidthMinPxCompact, 180),
              widthMaxDefault: num((store as unknown as { threeIframeOverlayBaseWidthMaxPxDefault?: unknown }).threeIframeOverlayBaseWidthMaxPxDefault, 360),
              widthMaxCompact: num((store as unknown as { threeIframeOverlayBaseWidthMaxPxCompact?: unknown }).threeIframeOverlayBaseWidthMaxPxCompact, 300),
              maxVisibleDefault: num((store as unknown as { threeIframeOverlayMaxVisibleDefault?: unknown }).threeIframeOverlayMaxVisibleDefault, 10),
              maxVisibleCompact: num((store as unknown as { threeIframeOverlayMaxVisibleCompact?: unknown }).threeIframeOverlayMaxVisibleCompact, 8),
              maxDistanceDefault: num((store as unknown as { threeIframeOverlayMaxDistanceDefault?: unknown }).threeIframeOverlayMaxDistanceDefault, 380),
              maxDistanceCompact: num((store as unknown as { threeIframeOverlayMaxDistanceCompact?: unknown }).threeIframeOverlayMaxDistanceCompact, 320),
              sizeScaleFactor: num((store as unknown as { threeIframeOverlaySizeScaleFactor?: unknown }).threeIframeOverlaySizeScaleFactor, 260),
            })
          })()
          bodyHtml = `<div class="kgExportCanvasRoot kgExportThreeRoot"><canvas id="kgExportThreeCanvas"></canvas>${mediaOverlayHtml}</div>`
          threeModuleScript = [
            'const PREFER_CDN = false;',
            `const GLB_URL = ${glbJs};`,
            `const CAMERA_POSE = ${poseJs};`,
            `const OFFLINE = ${offlineJs};`,
            `const LABELS = ${labelsJs};`,
            `const LABEL_COLORS = ${labelColorsJs};`,
            `const SHAPE_COLORS = ${shapeColorsJs};`,
            `const SHAPE_OPACITY = ${shapeOpacityJs};`,
            `const EDGE_ENDPOINTS = ${edgeEndpointsJs};`,
            `const THREE_CFG = ${threeCfgJs};`,
            `const MEDIA_CFG = ${mediaCfgForThreeJs};`,
            'const loadThree = async () => {',
            '  const cdnBase = "https://unpkg.com/three@0.170.0/";',
            '  const loadCdn = async () => {',
            '    const THREE = await import(cdnBase + "build/three.module.js");',
            '    const { OrbitControls } = await import(cdnBase + "examples/jsm/controls/OrbitControls.js");',
            '    const { GLTFLoader } = await import(cdnBase + "examples/jsm/loaders/GLTFLoader.js");',
            '    return { THREE, OrbitControls, GLTFLoader };',
            '  };',
            '  const loadEmbedded = async () => {',
            '    if (!OFFLINE) throw new Error("Missing offline modules");',
            '    const mkUrl = (src) => URL.createObjectURL(new Blob([String(src || "")], { type: "text/javascript" }));',
            '    const threeUrl = mkUrl(OFFLINE.three);',
            '    const fixThreeImport = (src) => String(src || "").replace(/from\\s+[\\\'\\"]three[\\\'\\"]/g, `from "${threeUrl}"`);',
            '    const bufUrl = mkUrl(fixThreeImport(OFFLINE.bufferGeometryUtils));',
            '    const orbitUrl = mkUrl(fixThreeImport(OFFLINE.orbitControls));',
            '    const gltfSrc = fixThreeImport(OFFLINE.gltfLoader).replace("../utils/BufferGeometryUtils.js", bufUrl);',
            '    const gltfUrl = mkUrl(gltfSrc);',
            '    const THREE = await import(threeUrl);',
            '    const { OrbitControls } = await import(orbitUrl);',
            '    const { GLTFLoader } = await import(gltfUrl);',
            '    return { THREE, OrbitControls, GLTFLoader };',
            '  };',
            '  if (PREFER_CDN) return await loadCdn();',
            '  try {',
            '    return await loadEmbedded();',
            '  } catch {',
            '    return await loadCdn();',
            '  }',
            '};',
            'const { THREE, OrbitControls, GLTFLoader } = await loadThree();',
            'const canvas = document.getElementById("kgExportThreeCanvas");',
            'if (!(canvas instanceof HTMLCanvasElement)) throw new Error("Missing canvas");',
            'const root = document.querySelector(".kgExportThreeRoot");',
            'const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });',
            'try {',
            '  const bg = THREE_CFG && typeof THREE_CFG.bg === "string" ? String(THREE_CFG.bg).trim() : "";',
            '  if (bg && bg !== "transparent" && bg !== "rgba(0, 0, 0, 0)") {',
            '    renderer.setClearColor(new THREE.Color(bg), 1);',
            '  } else {',
            '    renderer.setClearColor(0x000000, 0);',
            '  }',
            '} catch {',
            '  renderer.setClearColor(0x000000, 0);',
            '}',
            'renderer.outputColorSpace = THREE.SRGBColorSpace;',
            'const scene = new THREE.Scene();',
            'try {',
            '  if (THREE_CFG && THREE_CFG.fogColor) {',
            '    scene.fog = new THREE.Fog(String(THREE_CFG.fogColor), Number(THREE_CFG.fogNear) || 180, Number(THREE_CFG.fogFar) || 360);',
            '  }',
            '} catch { }',
            'const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 10000);',
            'const controls = new OrbitControls(camera, renderer.domElement);',
            'controls.enableDamping = !!(THREE_CFG && typeof THREE_CFG.dampingFactor === "number" && THREE_CFG.dampingFactor > 0);',
            'controls.dampingFactor = (THREE_CFG && typeof THREE_CFG.dampingFactor === "number") ? THREE_CFG.dampingFactor : 0.06;',
            'controls.screenSpacePanning = true;',
            'controls.enablePan = true;',
            'controls.enableRotate = true;',
            'controls.enableZoom = true;',
            'controls.rotateSpeed = (THREE_CFG && typeof THREE_CFG.rotateSpeed === "number") ? THREE_CFG.rotateSpeed : 0.6;',
            'controls.zoomSpeed = (THREE_CFG && typeof THREE_CFG.zoomSpeed === "number") ? THREE_CFG.zoomSpeed : 0.8;',
            'controls.panSpeed = (THREE_CFG && typeof THREE_CFG.panSpeed === "number") ? THREE_CFG.panSpeed : 0.5;',
            'controls.autoRotate = !!(THREE_CFG && THREE_CFG.autoRotate);',
            'controls.autoRotateSpeed = (THREE_CFG && typeof THREE_CFG.autoRotateSpeed === "number") ? THREE_CFG.autoRotateSpeed : 0.4;',
            'const setSize = () => {',
            '  const w = (root && (root instanceof HTMLElement) ? root.clientWidth : window.innerWidth) || 1;',
            '  const h = (root && (root instanceof HTMLElement) ? root.clientHeight : window.innerHeight) || 1;',
            '  camera.aspect = w / h;',
            '  camera.updateProjectionMatrix();',
            '  const dpr = window.devicePixelRatio || 1;',
            '  renderer.setPixelRatio((Number.isFinite(dpr) && dpr > 0) ? dpr : 1);',
            '  renderer.setSize(w, h, false);',
            '};',
            'let needsRender = true;',
            'let __kgSnapshotHidden = false;',
            'const render = () => { needsRender = true; };',
            'controls.addEventListener("change", render);',
            'window.addEventListener("resize", () => { setSize(); render(); });',
            'setSize();',
            'const loader = new GLTFLoader();',
            'const buf = await (await fetch(GLB_URL)).arrayBuffer();',
            'const gltf = await new Promise((resolve, reject) => {',
            '  loader.parse(buf, "", (g) => resolve(g), (e) => reject(e));',
            '});',
            'scene.add(gltf.scene);',
            'const labelLayer = document.createElement("div");',
            'labelLayer.style.position = "absolute";',
            'labelLayer.style.inset = "0";',
            'labelLayer.style.pointerEvents = "none";',
            'labelLayer.style.zIndex = "4";',
            'if (root && (root instanceof HTMLElement)) {',
            '  try { if (getComputedStyle(root).position === "static") root.style.position = "relative"; } catch { }',
            '  root.appendChild(labelLayer);',
            '}',
            'const getOverlayColor = (kind, id) => {',
            '  const fallback = kind === "group" ? "#a5f3fc" : kind === "edge" ? "#cbd5e1" : "#e5e7eb";',
            '  if (!id) return fallback;',
            '  const maps = LABEL_COLORS && typeof LABEL_COLORS === "object" ? LABEL_COLORS : null;',
            '  if (!maps) return fallback;',
            '  const table = kind === "group" ? maps.groups : kind === "edge" ? maps.edges : maps.nodes;',
            '  const v = table && typeof table === "object" ? String(table[id] || "").trim() : "";',
            '  return v || fallback;',
            '};',
            'const mkOverlayLabel = (text, kind, id) => {',
            '  const el = document.createElement("div");',
            '  el.textContent = String(text || "");',
            '  el.style.position = "absolute";',
            '  el.style.left = "0";',
            '  el.style.top = "0";',
            '  el.style.transform = "translate(-10000px,-10000px)";',
            '  el.style.whiteSpace = "nowrap";',
            '  el.style.font = kind === "edge" ? "500 11px/1.2 system-ui, sans-serif" : "600 12px/1.2 system-ui, sans-serif";',
            '  el.style.color = getOverlayColor(kind, id);',
            '  el.style.textShadow = "0 1px 0 rgba(2,6,23,0.95), 0 -1px 0 rgba(2,6,23,0.95), 1px 0 0 rgba(2,6,23,0.95), -1px 0 0 rgba(2,6,23,0.95)";',
            '  el.style.opacity = kind === "edge" ? "0.95" : "1";',
            '  el.style.display = "none";',
            '  labelLayer.appendChild(el);',
            '  return el;',
            '};',
            'const labelEntries = [];',
            'const addLabelEntries = (kind, map, includeWhenEmpty) => {',
            '  if (!map || typeof map !== "object") return;',
            '  for (const id of Object.keys(map)) {',
            '    const raw = map[id];',
            '    const label = typeof raw === "string" ? raw.trim() : "";',
            '    if (!label && !includeWhenEmpty) continue;',
            '    const text = label || String(id || "");',
            '    labelEntries.push({ kind, id: String(id || ""), el: mkOverlayLabel(text, kind, String(id || "")), obj: null, box: new THREE.Box3(), center: new THREE.Vector3(), screen: new THREE.Vector3(), sx: 0, sy: 0, visible: false });',
            '  }',
            '};',
            'addLabelEntries("node", LABELS && LABELS.nodes ? LABELS.nodes : null, true);',
            'addLabelEntries("edge", LABELS && LABELS.edges ? LABELS.edges : null, false);',
            'addLabelEntries("group", LABELS && LABELS.groups ? LABELS.groups : null, true);',
            'const taggedObjects = new Map();',
            'const namedObjects = [];',
            'gltf.scene.traverse(o => {',
            '  const name = String(o && o.name ? o.name : "");',
            '  if (!name) return;',
            '  namedObjects.push({ name, obj: o });',
            '  if (name.startsWith("kg_node:") || name.startsWith("kg_edge:") || name.startsWith("kg_group:") || name.startsWith("kg_cluster:")) taggedObjects.set(name, o);',
            '});',
            'const canonicalId = (value) => String(value || "").trim().replace(/^ws:[^:]+::/, "");',
            'const idCandidates = (value) => {',
            '  const raw = String(value || "").trim();',
            '  const out = [];',
            '  const seen = new Set();',
            '  const add = (v) => {',
            '    const s = String(v || "").trim();',
            '    if (!s || seen.has(s)) return;',
            '    seen.add(s);',
            '    out.push(s);',
            '  };',
            '  add(raw);',
            '  add(canonicalId(raw));',
            '  if (raw.includes("::")) add(raw.split("::").pop());',
            '  if (raw.includes(":")) add(raw.split(":").pop());',
            '  return out;',
            '};',
            'const getShapeColor = (kind, id) => {',
            '  if (!id) return "";',
            '  const maps = SHAPE_COLORS && typeof SHAPE_COLORS === "object" ? SHAPE_COLORS : null;',
            '  if (!maps) return "";',
            '  const table = kind === "group" ? maps.groups : kind === "edge" ? maps.edges : maps.nodes;',
            '  if (!table || typeof table !== "object") return "";',
            '  const ids = idCandidates(id);',
            '  for (let i = 0; i < ids.length; i += 1) {',
            '    const v = String(table[ids[i]] || "").trim();',
            '    if (v) return v;',
            '  }',
            '  const canonSet = new Set(ids.map(canonicalId).filter(Boolean));',
            '  for (const k of Object.keys(table)) {',
            '    const ck = canonicalId(k);',
            '    if (!ck || !canonSet.has(ck)) continue;',
            '    const v = String(table[k] || "").trim();',
            '    if (v) return v;',
            '  }',
            '  return "";',
            '};',
            'const getShapeOpacity = (kind, id) => {',
            '  if (!id) return null;',
            '  const maps = SHAPE_OPACITY && typeof SHAPE_OPACITY === "object" ? SHAPE_OPACITY : null;',
            '  if (!maps) return null;',
            '  const table = kind === "group" ? maps.groups : kind === "edge" ? maps.edges : maps.nodes;',
            '  if (!table || typeof table !== "object") return null;',
            '  const ids = idCandidates(id);',
            '  for (let i = 0; i < ids.length; i += 1) {',
            '    const raw = Number(table[ids[i]]);',
            '    if (Number.isFinite(raw)) return Math.max(0, Math.min(1, raw));',
            '  }',
            '  const canonSet = new Set(ids.map(canonicalId).filter(Boolean));',
            '  for (const k of Object.keys(table)) {',
            '    const ck = canonicalId(k);',
            '    if (!ck || !canonSet.has(ck)) continue;',
            '    const raw = Number(table[k]);',
            '    if (Number.isFinite(raw)) return Math.max(0, Math.min(1, raw));',
            '  }',
            '  return null;',
            '};',
            'const resolveRuntimeColor = (value) => {',
            '  let v = String(value || "").trim();',
            '  if (!v) return "";',
            '  const m = v.match(/^var\\(\\s*(--[a-z0-9-]+)\\s*(?:,\\s*([^)]+))?\\)$/i);',
            '  if (m) {',
            '    const cssName = String(m[1] || "").trim();',
            '    const fb = String(m[2] || "").trim();',
            '    let resolved = "";',
            '    try { resolved = String(getComputedStyle(document.documentElement).getPropertyValue(cssName) || "").trim(); } catch { }',
            '    v = resolved || fb;',
            '  }',
            '  return String(v || "").trim();',
            '};',
            'const parseAlpha = (value) => {',
            '  const s = String(value || "").trim();',
            '  const rgba = s.match(/^rgba\\(\\s*[^,]+\\s*,\\s*[^,]+\\s*,\\s*[^,]+\\s*,\\s*([0-9]*\\.?[0-9]+)\\s*\\)$/i);',
            '  if (rgba && rgba[1]) return Math.max(0, Math.min(1, Number(rgba[1])));',
            '  const hsla = s.match(/^hsla\\(\\s*[^,]+\\s*,\\s*[^,]+\\s*,\\s*[^,]+\\s*,\\s*([0-9]*\\.?[0-9]+)\\s*\\)$/i);',
            '  if (hsla && hsla[1]) return Math.max(0, Math.min(1, Number(hsla[1])));',
            '  return null;',
            '};',
            'const applyMaterialColor = (mat, color, kind, opacityOverride) => {',
            '  if (!mat || !color) return;',
            '  try {',
            '    const resolved = resolveRuntimeColor(color);',
            '    if (!resolved) return;',
            '    if (mat.color && mat.color.isColor) mat.color.setStyle(resolved);',
            '    if (mat.emissive && mat.emissive.isColor) {',
            '      mat.emissive.setStyle(resolved);',
            '      if (typeof mat.emissiveIntensity === "number") mat.emissiveIntensity = kind === "edge" ? 0.3 : 0.22;',
            '    }',
            '    if (typeof mat.vertexColors === "boolean" && mat.vertexColors) mat.vertexColors = false;',
            '    if (typeof mat.toneMapped === "boolean") mat.toneMapped = false;',
            '    if (typeof mat.metalness === "number") mat.metalness = 0;',
            '    if (typeof mat.roughness === "number") mat.roughness = 1;',
            '    const alpha = opacityOverride != null && Number.isFinite(opacityOverride) ? Math.max(0, Math.min(1, Number(opacityOverride))) : parseAlpha(resolved);',
            '    if (alpha != null && Number.isFinite(alpha) && typeof mat.opacity === "number") {',
            '      mat.opacity = alpha;',
            '      if (typeof mat.transparent === "boolean") mat.transparent = alpha < 0.999;',
            '    }',
            '    mat.needsUpdate = true;',
            '  } catch { }',
            '};',
            'const applyObjectColor = (obj, color, kind, opacityOverride) => {',
            '  if (!obj || !color) return;',
            '  try {',
            '    obj.traverse((o) => {',
            '      const m = o && o.material ? o.material : null;',
            '      if (!m) return;',
            '      if (Array.isArray(m)) {',
            '        for (let i = 0; i < m.length; i += 1) applyMaterialColor(m[i], color, kind, opacityOverride);',
            '      } else {',
            '        applyMaterialColor(m, color, kind, opacityOverride);',
            '      }',
            '    });',
            '  } catch { }',
            '};',
            'for (const [name, obj] of taggedObjects.entries()) {',
            '  const s = String(name || "");',
            '  const kind = s.startsWith("kg_node:") ? "node" : s.startsWith("kg_edge:") ? "edge" : (s.startsWith("kg_group:") || s.startsWith("kg_cluster:")) ? "group" : "";',
            '  if (!kind) continue;',
            '  const id = s.replace(/^kg_(?:node|edge|group|cluster):/, "");',
            '  const color = getShapeColor(kind, id);',
            '  const opacity = getShapeOpacity(kind, id);',
            '  if (color) applyObjectColor(obj, color, kind, opacity);',
            '}',
            'const taggedList = Array.from(taggedObjects.entries());',
            'const findBestTaggedObject = (kind, id) => {',
            '  const safeId = String(id || "").trim();',
            '  if (!safeId) return null;',
            '  const ids = idCandidates(safeId);',
            '  const canonSet = new Set(ids.map(canonicalId).filter(Boolean));',
            '  for (let i = 0; i < ids.length; i += 1) {',
            '    const cur = ids[i];',
            '    const key = kind === "node" ? `kg_node:${cur}` : kind === "edge" ? `kg_edge:${cur}` : `kg_group:${cur}`;',
            '    const alt = kind === "group" ? `kg_cluster:${cur}` : "";',
            '    const exact = taggedObjects.get(key) || (alt ? taggedObjects.get(alt) : null);',
            '    if (exact) return exact;',
            '  }',
            '  for (let i = 0; i < taggedList.length; i += 1) {',
            '    const [name, obj] = taggedList[i];',
            '    if (!name || !obj) continue;',
            '    if (kind === "node" && !name.startsWith("kg_node:")) continue;',
            '    if (kind === "edge" && !name.startsWith("kg_edge:")) continue;',
            '    if (kind === "group" && !name.startsWith("kg_group:") && !name.startsWith("kg_cluster:")) continue;',
            '    const nameId = String(name).replace(/^kg_(?:node|edge|group|cluster):/, "");',
            '    const nameCanon = canonicalId(nameId);',
            '    if ((nameCanon && canonSet.has(nameCanon)) || ids.some(v => name.includes(v) || name.endsWith(`:${v}`) || name.endsWith(v))) return obj;',
            '  }',
            '  for (let i = 0; i < namedObjects.length; i += 1) {',
            '    const it = namedObjects[i];',
            '    if (!it || !it.name || !it.obj) continue;',
            '    const nameCanon = canonicalId(String(it.name).replace(/^kg_(?:node|edge|group|cluster):/, ""));',
            '    if ((nameCanon && canonSet.has(nameCanon)) || ids.some(v => it.name.includes(v))) return it.obj;',
            '  }',
            '  return null;',
            '};',
            'const applyColorTable = (kind, map) => {',
            '  if (!map || typeof map !== "object") return;',
            '  for (const id of Object.keys(map)) {',
            '    const color = getShapeColor(kind, id);',
            '    if (!color) continue;',
            '    const opacity = getShapeOpacity(kind, id);',
            '    const obj = findBestTaggedObject(kind, id);',
            '    if (!obj) continue;',
            '    applyObjectColor(obj, color, kind, opacity);',
            '  }',
            '};',
            'applyColorTable("node", SHAPE_COLORS && SHAPE_COLORS.nodes ? SHAPE_COLORS.nodes : null);',
            'applyColorTable("edge", SHAPE_COLORS && SHAPE_COLORS.edges ? SHAPE_COLORS.edges : null);',
            'applyColorTable("group", SHAPE_COLORS && SHAPE_COLORS.groups ? SHAPE_COLORS.groups : null);',
            'const fallbackMeshes = [];',
            'gltf.scene.traverse(o => {',
            '  if (!o || !o.isMesh) return;',
            '  const n = String(o.name || "").toLowerCase();',
            '  if (n.includes("starfield") || n.includes("grid") || n.includes("background")) return;',
            '  fallbackMeshes.push(o);',
            '});',
            'let fallbackNodeCursor = 0;',
            'for (let i = 0; i < labelEntries.length; i += 1) {',
            '  const it = labelEntries[i];',
            '  it.obj = findBestTaggedObject(it.kind, it.id);',
            '  if (!it.obj && it.kind === "node" && fallbackNodeCursor < fallbackMeshes.length) {',
            '    it.obj = fallbackMeshes[fallbackNodeCursor++] || null;',
            '  }',
            '}',
            'const mediaRoot = root && root.querySelector ? root.querySelector(".kgExportMediaOverlayRoot") : null;',
            'const mediaPanels = mediaRoot ? Array.from(mediaRoot.querySelectorAll(".kgExportMediaPanel[data-node-id]")) : [];',
            'const mediaEntries = [];',
            'for (let i = 0; i < mediaPanels.length; i += 1) {',
            '  const el = mediaPanels[i];',
            '  if (!el || !(el instanceof HTMLElement)) continue;',
            '  const id = String(el.getAttribute("data-node-id") || "");',
            '  if (!id) continue;',
            '  mediaEntries.push({ id, el, obj: null, box: new THREE.Box3(), center: new THREE.Vector3(), screen: new THREE.Vector3(), dist: 0, sx: 0, sy: 0, sizeScale: 1, visible: false });',
            '}',
            'for (let i = 0; i < mediaEntries.length; i += 1) {',
            '  const it = mediaEntries[i];',
            '  it.obj = findBestTaggedObject("node", it.id);',
            '}',
            'const mediaCandidates = [];',
            'const computeMediaVars = (density, sizeScale) => {',
            '  const s = Number.isFinite(sizeScale) ? Math.max(0.001, Number(sizeScale)) : 1;',
            '  const d = density === "compact" ? "compact" : "default";',
            '  const headerBase = d === "compact" ? 22 : 28;',
            '  const paddingBase = d === "compact" ? 6 : 8;',
            '  const radiusBase = d === "compact" ? 9 : 10;',
            '  const borderBase = 1;',
            '  const titleBase = d === "compact" ? 11 : 12;',
            '  const headerH = Math.max(14, Math.round(headerBase * s));',
            '  const padding = Math.max(2, Math.round(paddingBase * s));',
            '  const radius = Math.max(3, Math.round(radiusBase * s));',
            '  const borderW = Math.max(1, Math.round(borderBase * s));',
            '  const titleSize = Math.max(10, Math.round(titleBase * s));',
            '  const metrics = { headerH, padding, radius, borderW, titleSize };',
            '  const vars = {',
            '    "--kg-media-panel-header-h": `${headerH}px`,',
            '    "--kg-media-panel-border-w": `${borderW}px`,',
            '    "--kg-media-panel-radius": `${radius}px`,',
            '    "--kg-media-panel-padding": `${padding}px`,',
            '    "--kg-media-panel-title-size": `${titleSize}px`,',
            '  };',
            '  return { metrics, vars };',
            '};',
            'const computePanelSize16x9 = (contentW, headerH, padding) => {',
            '  const cw = Math.max(2, Number(contentW) || 2);',
            '  const ch = Math.max(2, (cw * 9) / 16);',
            '  const p = Math.max(0, Number(padding) || 0);',
            '  const hh = Math.max(0, Number(headerH) || 0);',
            '  const panelW = Math.max(2, cw + p * 2);',
            '  const panelH = Math.max(2, ch + hh + p * 2);',
            '  return { panelW, panelH, contentW: cw, contentH: ch };',
            '};',
            'const updateOverlayMedia = () => {',
            '  if (!mediaEntries.length) return;',
            '  const rect = renderer.domElement.getBoundingClientRect();',
            '  const w = Math.max(1, rect.width || 0);',
            '  const h = Math.max(1, rect.height || 0);',
            '  const density = MEDIA_CFG && MEDIA_CFG.density === "compact" ? "compact" : "default";',
            '  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));',
            '  const maxCountRaw = density === "compact" ? Number(MEDIA_CFG.maxVisibleCompact || 0) : Number(MEDIA_CFG.maxVisibleDefault || 0);',
            '  const maxDistanceRaw = density === "compact" ? Number(MEDIA_CFG.maxDistanceCompact || 0) : Number(MEDIA_CFG.maxDistanceDefault || 0);',
            '  const maxCount = Number.isFinite(maxCountRaw) ? Math.max(0, Math.floor(maxCountRaw)) : mediaEntries.length;',
            '  const maxDistance = Number.isFinite(maxDistanceRaw) ? Math.max(0, Number(maxDistanceRaw)) : 0;',
            '  if (maxCount <= 0 || maxDistance <= 0) {',
            '    for (let i = 0; i < mediaEntries.length; i += 1) {',
            '      const it = mediaEntries[i];',
            '      it.visible = false;',
            '      it.el.style.visibility = "hidden";',
            '      it.el.style.opacity = "0";',
            '    }',
            '    return;',
            '  }',
            '  const widthRatio = density === "compact" ? Number(MEDIA_CFG.widthRatioCompact || 0.16) : Number(MEDIA_CFG.widthRatioDefault || 0.2);',
            '  const widthMin = density === "compact" ? Number(MEDIA_CFG.widthMinCompact || 180) : Number(MEDIA_CFG.widthMinDefault || 210);',
            '  const widthMax = density === "compact" ? Number(MEDIA_CFG.widthMaxCompact || 300) : Number(MEDIA_CFG.widthMaxDefault || 360);',
            '  const baseW = clamp(w * Math.max(0.001, Math.min(0.9, widthRatio)), Math.max(1, widthMin), Math.max(1, widthMax));',
            '  const sizeFactorRaw = Number(MEDIA_CFG.sizeScaleFactor || 260);',
            '  const sizeFactor = Number.isFinite(sizeFactorRaw) && sizeFactorRaw > 0 ? sizeFactorRaw : 260;',
            '  const MAX_PANEL_PX = 2048;',
            '  const STEP_PX = 16;',
            '  const quantize = (px) => Math.round(px / STEP_PX) * STEP_PX;',
            '  mediaCandidates.length = 0;',
            '  for (let i = 0; i < mediaEntries.length; i += 1) {',
            '    const it = mediaEntries[i];',
            '    it.visible = false;',
            '    if (!it.obj) { it.el.style.visibility = "hidden"; it.el.style.opacity = "0"; continue; }',
            '    try {',
            '      it.box.setFromObject(it.obj);',
            '      if (it.box.isEmpty()) { it.el.style.visibility = "hidden"; it.el.style.opacity = "0"; continue; }',
            '      it.box.getCenter(it.center);',
            '      it.dist = camera.position.distanceTo(it.center);',
            '      if (!Number.isFinite(it.dist) || it.dist > maxDistance) { it.el.style.visibility = "hidden"; it.el.style.opacity = "0"; continue; }',
            '      it.screen.copy(it.center).project(camera);',
            '      if (!Number.isFinite(it.screen.x) || !Number.isFinite(it.screen.y) || !Number.isFinite(it.screen.z) || it.screen.z <= -1 || it.screen.z >= 1) { it.el.style.visibility = "hidden"; it.el.style.opacity = "0"; continue; }',
            '      it.sx = (it.screen.x * 0.5 + 0.5) * w;',
            '      it.sy = (-it.screen.y * 0.5 + 0.5) * h;',
            '      it.sizeScale = clamp(sizeFactor / Math.max(0.001, it.dist), 0.001, 256);',
            '      mediaCandidates.push(it);',
            '    } catch {',
            '      it.el.style.visibility = "hidden";',
            '      it.el.style.opacity = "0";',
            '    }',
            '  }',
            '  mediaCandidates.sort((a, b) => (a.dist - b.dist) || String(a.id).localeCompare(String(b.id)));',
            '  const count = Math.min(maxCount, mediaCandidates.length);',
            '  for (let i = 0; i < count; i += 1) {',
            '    mediaCandidates[i].visible = true;',
            '  }',
            '  const margin = 12;',
            '  for (let i = 0; i < mediaEntries.length; i += 1) {',
            '    const it = mediaEntries[i];',
            '    if (!it.visible) {',
            '      it.el.style.visibility = "hidden";',
            '      it.el.style.opacity = "0";',
            '      continue;',
            '    }',
            '    const contentW0 = clamp(quantize(baseW * it.sizeScale), 2, MAX_PANEL_PX);',
            '    const sizeScale2 = Math.max(0.001, contentW0 / Math.max(1, baseW));',
            '    const varsKey = `${density}|${Math.round(contentW0)}`;',
            '    const prevKey = it.el.dataset ? it.el.dataset.kgVarsKey : "";',
            '    let metrics = null;',
            '    if (prevKey !== varsKey) {',
            '      const computed = computeMediaVars(density, sizeScale2);',
            '      metrics = computed.metrics;',
            '      if (it.el.dataset) it.el.dataset.kgVarsKey = varsKey;',
            '      const keys = Object.keys(computed.vars);',
            '      for (let k = 0; k < keys.length; k += 1) it.el.style.setProperty(keys[k], String(computed.vars[keys[k]]));',
            '    } else {',
            '      metrics = computeMediaVars(density, sizeScale2).metrics;',
            '    }',
            '    const panel = computePanelSize16x9(contentW0, metrics.headerH, metrics.padding);',
            '    const panelW = panel.panelW;',
            '    const panelH = panel.panelH;',
            '    const left = clamp(Math.round(it.sx - panelW / 2), margin, Math.max(margin, w - margin - panelW));',
            '    const top = clamp(Math.round(it.sy - panelH / 2), margin, Math.max(margin, h - margin - panelH));',
            '    const z = String(2000 - Math.max(0, Math.min(1500, Math.floor(it.dist))));',
            '    const sig = `${left}|${top}|${Math.round(panelW)}|${Math.round(panelH)}|${z}`;',
            '    const prevSig = it.el.dataset ? it.el.dataset.kgBoxSig : "";',
            '    if (prevSig !== sig) {',
            '      if (it.el.dataset) it.el.dataset.kgBoxSig = sig;',
            '      it.el.style.width = `${Math.round(panelW)}px`;',
            '      it.el.style.height = `${Math.round(panelH)}px`;',
            '      it.el.style.transform = `translate3d(${left}px, ${top}px, 0px)`;',
            '      it.el.style.zIndex = z;',
            '    }',
            '    if (it.el.dataset && !it.el.dataset.kgMediaEagerApplied) {',
            '      try {',
            '        const iframe = it.el.querySelector("iframe");',
            '        if (iframe) { try { iframe.loading = "eager"; } catch { } try { iframe.setAttribute("loading", "eager"); } catch { } }',
            '        const img = it.el.querySelector("img");',
            '        if (img) { try { img.loading = "eager"; } catch { } try { img.setAttribute("loading", "eager"); } catch { } }',
            '      } catch { }',
            '      try { it.el.dataset.kgMediaEagerApplied = "1"; } catch { }',
            '    }',
            '    it.el.style.visibility = "visible";',
            '    it.el.style.opacity = "1";',
            '  }',
            '};',
            'const tooltip = document.createElement("div");',
            'tooltip.className = "kgExportTooltip";',
            'tooltip.style.display = "none";',
            'document.body.appendChild(tooltip);',
            'const showTip = (text, x, y) => {',
            '  tooltip.textContent = String(text || "");',
            '  tooltip.style.left = `${Math.round(x + 12)}px`;',
            '  tooltip.style.top = `${Math.round(y + 12)}px`;',
            '  tooltip.style.display = "";',
            '};',
            'const hideTip = () => { tooltip.style.display = "none"; };',
            'const findTagged = (obj) => {',
            '  let o = obj;',
            '  while (o) {',
            '    const name = String(o.name || "");',
            '    if (name.startsWith("kg_node:") || name.startsWith("kg_edge:") || name.startsWith("kg_group:") || name.startsWith("kg_cluster:")) return name;',
            '    o = o.parent;',
            '  }',
            '  return "";',
            '};',
            'const raycaster = new THREE.Raycaster();',
            'const mouse = new THREE.Vector2();',
            'let lastTipKey = "";',
            'const onPointerMove = (e) => {',
            '  const rect = renderer.domElement.getBoundingClientRect();',
            '  const cx = e.clientX - rect.left;',
            '  const cy = e.clientY - rect.top;',
            '  mouse.x = (cx / rect.width) * 2 - 1;',
            '  mouse.y = -(cy / rect.height) * 2 + 1;',
            '  raycaster.setFromCamera(mouse, camera);',
            '  const hits = raycaster.intersectObject(gltf.scene, true);',
            '  const tag = hits && hits.length ? findTagged(hits[0].object) : "";',
            '  if (!tag) {',
            '    let nearest = null;',
            '    let nearestDist = 1e9;',
            '    for (let i = 0; i < labelEntries.length; i += 1) {',
            '      const it = labelEntries[i];',
            '      if (!it || !it.visible) continue;',
            '      const dx = it.sx - cx;',
            '      const dy = it.sy - cy;',
            '      const d2 = dx * dx + dy * dy;',
            '      if (d2 < nearestDist) { nearestDist = d2; nearest = it; }',
            '    }',
            '    if (nearest && nearestDist <= 40 * 40) {',
            '      const key = `overlay:${nearest.kind}:${nearest.id}`;',
            '      const txt = String((nearest.el && nearest.el.textContent) || nearest.id || "");',
            '      lastTipKey = key;',
            '      showTip(txt, e.clientX, e.clientY);',
            '      return;',
            '    }',
            '    if (lastTipKey) { hideTip(); lastTipKey = ""; }',
            '    return;',
            '  }',
            '  if (tag === lastTipKey) {',
            '    showTip(tooltip.textContent || "", e.clientX, e.clientY);',
            '    return;',
            '  }',
            '  lastTipKey = tag;',
            '  const parts = tag.split(":");',
            '  const kind = parts[0] || "";',
            '  const id = parts.slice(1).join(":");',
            '  const label = kind === "kg_node" ? (LABELS && LABELS.nodes ? LABELS.nodes[id] : "") : kind === "kg_edge" ? (LABELS && LABELS.edges ? LABELS.edges[id] : "") : (LABELS && LABELS.groups ? LABELS.groups[id] : "");',
            '  const text = label ? `${label}` : id;',
            '  showTip(text, e.clientX, e.clientY);',
            '  needsRender = true;',
            '};',
            'renderer.domElement.addEventListener("pointermove", onPointerMove);',
            'renderer.domElement.addEventListener("pointerleave", () => { hideTip(); lastTipKey = ""; });',
            'const nodeBases = [];',
            'gltf.scene.traverse(o => {',
            '  const name = String(o.name || "");',
            '  if (!name.startsWith("kg_node:")) return;',
            '  const id = name.slice("kg_node:".length);',
            '  const seed = id ? id.length : 0;',
            '  nodeBases.push({ id, o, base: o.position.clone(), seed });',
            '});',
            'if (!nodeBases.length) {',
            '  let i = 0;',
            '  gltf.scene.traverse(o => {',
            '    if (i > 200) return;',
            '    if (!o || !o.isMesh) return;',
            '    nodeBases.push({ id: "", o, base: o.position.clone(), seed: i });',
            '    i += 1;',
            '  });',
            '}',
            'const nodeById = new Map();',
            'for (let i = 0; i < nodeBases.length; i += 1) {',
            '  const p = nodeBases[i];',
            '  if (p && p.id) nodeById.set(String(p.id), p);',
            '}',
            'try {',
            '  gltf.scene.traverse(o => {',
            '    const n = String(o && o.name ? o.name : "");',
            '    if (n.startsWith("kg_edge:")) o.visible = false;',
            '  });',
            '} catch { }',
            'const dynEdgeGroup = new THREE.Group();',
            'dynEdgeGroup.name = "kg_dyn_edges";',
            'scene.add(dynEdgeGroup);',
            'const dynEdges = [];',
            'const readEdgeColor = (id) => {',
            '  try {',
            '    const v = SHAPE_COLORS && SHAPE_COLORS.edges ? String(SHAPE_COLORS.edges[id] || "").trim() : "";',
            '    if (!v) return null;',
            '    const c = new THREE.Color(v);',
            '    return c;',
            '  } catch {',
            '    return null;',
            '  }',
            '};',
            'const readEdgeOpacity = (id) => {',
            '  try {',
            '    const raw = SHAPE_OPACITY && SHAPE_OPACITY.edges ? Number(SHAPE_OPACITY.edges[id]) : NaN;',
            '    if (!Number.isFinite(raw)) return 0.9;',
            '    return Math.max(0, Math.min(1, raw));',
            '  } catch {',
            '    return 0.9;',
            '  }',
            '};',
            'for (const id of Object.keys(EDGE_ENDPOINTS || {})) {',
            '  const ep = EDGE_ENDPOINTS[id];',
            '  if (!ep || !ep.s || !ep.t) continue;',
            '  const geo = new THREE.BufferGeometry();',
            '  const arr = new Float32Array(6);',
            '  geo.setAttribute("position", new THREE.BufferAttribute(arr, 3));',
            '  const col = readEdgeColor(id) || new THREE.Color(0x94a3b8);',
            '  const op = readEdgeOpacity(id);',
            '  const mat = new THREE.LineBasicMaterial({ color: col, transparent: op < 0.999, opacity: op });',
            '  const line = new THREE.Line(geo, mat);',
            '  line.name = `kg_dyn_edge:${id}`;',
            '  dynEdgeGroup.add(line);',
            '  dynEdges.push({ id, s: String(ep.s), t: String(ep.t), line, arr });',
            '}',
            'const __tmpW0 = new THREE.Vector3();',
            'const __tmpW1 = new THREE.Vector3();',
            'const updateDynamicEdges = () => {',
            '  if (!dynEdges.length) return;',
            '  for (let i = 0; i < dynEdges.length; i += 1) {',
            '    const it = dynEdges[i];',
            '    const a = nodeById.get(it.s);',
            '    const b = nodeById.get(it.t);',
            '    if (!a || !b || !a.o || !b.o) { it.line.visible = false; continue; }',
            '    it.line.visible = true;',
            '    a.o.getWorldPosition(__tmpW0);',
            '    b.o.getWorldPosition(__tmpW1);',
            '    it.arr[0] = __tmpW0.x; it.arr[1] = __tmpW0.y; it.arr[2] = __tmpW0.z;',
            '    it.arr[3] = __tmpW1.x; it.arr[4] = __tmpW1.y; it.arr[5] = __tmpW1.z;',
            '    const pos = it.line.geometry.getAttribute("position");',
            '    if (pos) pos.needsUpdate = true;',
            '  }',
            '};',
            'let mediaDrag = null;',
            'const __tmpDragWorld = new THREE.Vector3();',
            'const __tmpDragLocal = new THREE.Vector3();',
            'const __tmpDragNdc = new THREE.Vector3();',
            'const __tmpDragProj = new THREE.Vector3();',
            'const beginMediaDrag = (panelEl, pointerId, clientX, clientY) => {',
            '  if (!panelEl) return;',
            '  const id = String(panelEl.getAttribute("data-node-id") || "").trim();',
            '  if (!id) return;',
            '  const entry = nodeById.get(id);',
            '  if (!entry || !entry.o) return;',
            '  entry.o.getWorldPosition(__tmpDragWorld);',
            '  __tmpDragProj.copy(__tmpDragWorld).project(camera);',
            '  const rect = renderer.domElement.getBoundingClientRect();',
            '  mediaDrag = { id, pointerId, ndcZ: __tmpDragProj.z, rectW: Math.max(1, rect.width), rectH: Math.max(1, rect.height) };',
            '  try { panelEl.setPointerCapture(pointerId); } catch { }',
            '};',
            'const moveMediaDrag = (pointerId, clientX, clientY) => {',
            '  if (!mediaDrag || mediaDrag.pointerId !== pointerId) return;',
            '  const entry = nodeById.get(mediaDrag.id);',
            '  if (!entry || !entry.o) return;',
            '  const rect = renderer.domElement.getBoundingClientRect();',
            '  const w = Math.max(1, rect.width);',
            '  const h = Math.max(1, rect.height);',
            '  const cx = clientX - rect.left;',
            '  const cy = clientY - rect.top;',
            '  const ndcX = (cx / w) * 2 - 1;',
            '  const ndcY = -(cy / h) * 2 + 1;',
            '  __tmpDragNdc.set(ndcX, ndcY, mediaDrag.ndcZ);',
            '  __tmpDragLocal.copy(__tmpDragNdc).unproject(camera);',
            '  if (entry.o.parent) {',
            '    __tmpDragWorld.copy(__tmpDragLocal);',
            '    entry.o.parent.worldToLocal(__tmpDragWorld);',
            '    entry.o.position.copy(__tmpDragWorld);',
            '    entry.base.copy(entry.o.position);',
            '  } else {',
            '    entry.o.position.copy(__tmpDragLocal);',
            '    entry.base.copy(entry.o.position);',
            '  }',
            '  needsRender = true;',
            '};',
            'const endMediaDrag = (pointerId) => {',
            '  if (!mediaDrag || mediaDrag.pointerId !== pointerId) return;',
            '  mediaDrag = null;',
            '};',
            'if (mediaRoot && mediaRoot.addEventListener) {',
            '  mediaRoot.addEventListener("pointerdown", (e) => {',
            '    if (!e || typeof e.pointerId !== "number") return;',
            '    const t = e.target instanceof Element ? e.target : null;',
            '    const panel = t ? t.closest(".kgExportMediaPanel[data-node-id]") : null;',
            '    if (!panel) return;',
            '    beginMediaDrag(panel, e.pointerId, e.clientX, e.clientY);',
            '    try { e.preventDefault(); } catch { }',
            '    try { e.stopPropagation(); } catch { }',
            '  }, { passive: false, capture: true });',
            '  mediaRoot.addEventListener("pointermove", (e) => {',
            '    if (!e || typeof e.pointerId !== "number") return;',
            '    if (!mediaDrag || e.pointerId !== mediaDrag.pointerId) return;',
            '    moveMediaDrag(e.pointerId, e.clientX, e.clientY);',
            '    try { e.preventDefault(); } catch { }',
            '    try { e.stopPropagation(); } catch { }',
            '  }, { passive: false, capture: true });',
            '  mediaRoot.addEventListener("pointerup", (e) => {',
            '    if (!e || typeof e.pointerId !== "number") return;',
            '    if (!mediaDrag || e.pointerId !== mediaDrag.pointerId) return;',
            '    endMediaDrag(e.pointerId);',
            '    try { e.preventDefault(); } catch { }',
            '    try { e.stopPropagation(); } catch { }',
            '  }, { passive: false, capture: true });',
            '  mediaRoot.addEventListener("pointercancel", (e) => {',
            '    if (!e || typeof e.pointerId !== "number") return;',
            '    if (!mediaDrag || e.pointerId !== mediaDrag.pointerId) return;',
            '    endMediaDrag(e.pointerId);',
            '  }, { passive: true, capture: true });',
            '}',
            'const starfield = gltf.scene.getObjectByName("kg_starfield");',
            'try {',
            '  const hasLights = (() => {',
            '    let found = false;',
            '    scene.traverse(o => {',
            '      if (found) return;',
            '      if (o && o.isLight) found = true;',
            '    });',
            '    return found;',
            '  })();',
            '  if (!hasLights) {',
            '    scene.add(new THREE.AmbientLight(0xffffff, 0.9));',
            '    scene.add(new THREE.HemisphereLight(0xffffff, 0xcbd5e1, 0.6));',
            '    const p = new THREE.PointLight(0xffffff, 0.9);',
            '    p.position.set(120, 120, 120);',
            '    scene.add(p);',
            '  }',
            '} catch { }',
            'const applyPose = (pose) => {',
            '  if (!pose || !pose.position || !pose.quaternion || !pose.target) return false;',
            '  camera.position.set(pose.position.x, pose.position.y, pose.position.z);',
            '  camera.quaternion.set(pose.quaternion.x, pose.quaternion.y, pose.quaternion.z, pose.quaternion.w);',
            '  if (typeof pose.fov === "number" && Number.isFinite(pose.fov)) camera.fov = pose.fov;',
            '  if (typeof pose.zoom === "number" && Number.isFinite(pose.zoom)) camera.zoom = pose.zoom;',
            '  camera.updateProjectionMatrix();',
            '  controls.target.set(pose.target.x, pose.target.y, pose.target.z);',
            '  controls.update();',
            '  return true;',
            '};',
            'const fitToObject = (obj) => {',
            '  const box = new THREE.Box3().setFromObject(obj);',
            '  if (!box.isEmpty()) {',
            '    const center = box.getCenter(new THREE.Vector3());',
            '    const size = box.getSize(new THREE.Vector3());',
            '    const maxDim = Math.max(1e-6, size.x, size.y, size.z);',
            '    const fov = (camera.fov * Math.PI) / 180;',
            '    const dist = (maxDim * 0.6) / Math.tan(fov / 2);',
            '    controls.target.copy(center);',
            '    camera.position.copy(center).add(new THREE.Vector3(0, 0, dist * 1.25));',
            '    camera.near = Math.max(0.01, dist / 2000);',
            '    camera.far = Math.max(1000, dist * 200);',
            '    camera.updateProjectionMatrix();',
            '    controls.update();',
            '  }',
            '};',
            'if (!applyPose(CAMERA_POSE)) {',
            '  fitToObject(gltf.scene);',
            '}',
            'const updateOverlayLabels = () => {',
            '  if (!labelEntries.length) return;',
            '  const rect = renderer.domElement.getBoundingClientRect();',
            '  const w = Math.max(1, rect.width || 0);',
            '  const h = Math.max(1, rect.height || 0);',
            '  for (let i = 0; i < labelEntries.length; i += 1) {',
            '    const it = labelEntries[i];',
            '    if (!it || !it.obj) { if (it && it.el) { it.el.style.display = "none"; it.visible = false; } continue; }',
            '    try {',
            '      it.box.setFromObject(it.obj);',
            '      if (it.box.isEmpty()) { it.el.style.display = "none"; it.visible = false; continue; }',
            '      it.box.getCenter(it.center);',
            '      it.screen.copy(it.center).project(camera);',
            '      if (!Number.isFinite(it.screen.x) || !Number.isFinite(it.screen.y) || !Number.isFinite(it.screen.z) || it.screen.z <= -1 || it.screen.z >= 1) {',
            '        it.el.style.display = "none";',
            '        it.visible = false;',
            '        continue;',
            '      }',
            '      const sx = (it.screen.x * 0.5 + 0.5) * w;',
            '      const sy = (-it.screen.y * 0.5 + 0.5) * h;',
            '      it.sx = sx;',
            '      it.sy = sy;',
            '      it.visible = true;',
            '      it.el.style.display = "";',
            '      it.el.style.transform = `translate(-50%, -50%) translate(${Math.round(sx)}px, ${Math.round(sy)}px)`;',
            '    } catch {',
            '      it.el.style.display = "none";',
            '      it.visible = false;',
            '    }',
            '  }',
            '};',
            'const sceneBase = gltf.scene.position.clone();',
            'const tick = () => {',
            '  const t = performance.now() * 0.001;',
            '  const motion = THREE_CFG && typeof THREE_CFG.nodeMotionIntensity === "number" ? Math.max(0, Math.min(2, THREE_CFG.nodeMotionIntensity)) : 1;',
            '  if (motion > 1e-6) {',
            '    const globalAmp = 0.8 * motion;',
            '    gltf.scene.position.x = sceneBase.x + Math.sin(t * 0.12) * globalAmp * 0.08;',
            '    gltf.scene.position.y = sceneBase.y + Math.cos(t * 0.14) * globalAmp * 0.08;',
            '    gltf.scene.position.z = sceneBase.z;',
            '    if (nodeBases.length) {',
            '      const amp = 0.9 * motion;',
            '      for (let i = 0; i < nodeBases.length; i += 1) {',
            '        const p = nodeBases[i];',
            '        const o = p.o;',
            '        const b = p.base;',
            '        const seed = (p.seed || 0) * 0.77;',
            '        o.position.x = b.x + Math.sin(t * 0.65 + seed) * amp;',
            '        o.position.y = b.y + Math.cos(t * 0.72 + seed * 1.31) * amp;',
            '        o.position.z = b.z + Math.sin(t * 0.48 + seed * 2.17) * (amp * 0.35);',
            '      }',
            '    }',
            '    needsRender = true;',
            '  }',
            '  if (starfield && starfield.position && camera && camera.position) {',
            '    try { starfield.position.copy(camera.position); } catch { }',
            '  }',
            '  if (controls.enableDamping || controls.autoRotate) {',
            '    controls.update();',
            '    needsRender = true;',
            '  }',
            '  if (needsRender) {',
            '    needsRender = false;',
            '    try { updateDynamicEdges(); } catch { }',
            '    updateOverlayLabels();',
            '    try { updateOverlayMedia(); } catch { }',
            '    renderer.render(scene, camera);',
            '    if (!__kgSnapshotHidden) { __kgSnapshotHidden = true; }',
            '  }',
            '  requestAnimationFrame(tick);',
            '};',
            'tick();',
          ].join('\n')
        }

        const allowRasterFallback = false

        const png = !allowRasterFallback || threeModuleScript
          ? null
          : await (async () => {
              if (geospatialEnabled) {
                try {
                  const gm = (await import('gympgrph')) as unknown as { captureGeospatialPngSnapshot?: (opts?: { fit?: 'data' | 'selection' | 'none' }) => Promise<Blob | null> }
                  const b = await gm.captureGeospatialPngSnapshot?.({ fit: 'data' })
                  if (b) return b
                } catch {
                  void 0
                }
                return await captureVisibleCanvasPngBlobFromDom()
              }

              if (store.canvasRenderMode === '3d') {
                return null
              }

              const pr = (() => {
                try {
                  const dpr = window.devicePixelRatio || 1
                  if (!Number.isFinite(dpr) || dpr <= 0) return 1
                  return Math.max(1, Math.min(4, dpr))
                } catch {
                  return 1
                }
              })()
              return (await store.captureCanvasPngSnapshot('2d', pr)) || (await captureVisibleCanvasPngBlobFromDom())
            })()
        if (!threeModuleScript && !geospatialEnabled && wants3dExport && !bodyHtml) {
          try {
            const centered3d = exportGraphAsCentered3dSvgMarkup({
              graphData: store.graphData,
              schema: store.schema,
              widthPx: Math.max(800, fallbackSize.w || 0),
              heightPx: Math.max(600, fallbackSize.h || 0),
              paddingPx: 96,
              includeXmlDeclaration: false,
              animated: true,
              threeEdgeRenderer: store.threeEdgeRenderer,
            })
            if (centered3d && centered3d.trim()) {
              svgMarkup = centered3d.trim()
              const stripped = svgMarkup.replace(/^\s*<\?xml[^>]*>\s*/i, '')
              bodyHtml = `<div class="kgExportCanvasRoot">${stripped}</div>`
            }
          } catch {
            void 0
          }
        }

        if (!threeModuleScript && !geospatialEnabled && !wants3dExport && !bodyHtml) {
          try {
            const centered = exportGraphAsCenteredSvgMarkup({
              graphData: store.graphData,
              schema: store.schema,
              widthPx: Math.max(800, fallbackSize.w || 0),
              heightPx: Math.max(600, fallbackSize.h || 0),
              paddingPx: 96,
              includeXmlDeclaration: false,
              animated: true,
            })
            if (centered && centered.trim()) {
              svgMarkup = centered.trim()
              const stripped = svgMarkup.replace(/^\s*<\?xml[^>]*>\s*/i, '')
              bodyHtml = `<div class="kgExportCanvasRoot">${stripped}</div>`
            }
          } catch {
            void 0
          }
        }
        if (!bodyHtml && !png && !threeModuleScript) {
          pushUiToast({ id: 'export-html-missing-canvas', kind: 'warning', message: 'No canvas snapshot available.' })
          return
        }
        if (!bodyHtml && png && !threeModuleScript) {
          pushUiToast({ id: 'export-html-raster-disabled', kind: 'warning', message: 'Raster fallback disabled; export requires inline SVG.' })
          return
        }

        if (shouldTry3dFit && prev3d) {
          try {
            store.restoreThreeCameraPose(prev3d)
            await waitFrames(1)
          } catch {
            void 0
          }
        } else if (shouldTry2dFit && prev2d) {
          try {
            store.requestZoomTransform({ k: prev2d.k, x: prev2d.x, y: prev2d.y })
            await waitFrames(1)
          } catch {
            void 0
          }
        }
      }

      labelsForExportB64 = (() => {
        try {
          const json = JSON.stringify(labelsForExport)
          return btoa(unescape(encodeURIComponent(json)))
        } catch {
          return ''
        }
      })()

      const htmlClass = String(document.documentElement.className || '').trim()
      const exportHtmlClass = (() => {
        const base = String(htmlClass || '').trim()
        const cleaned = base.replace(/\bdark\b/g, '').trim()
        return themeAttr === 'dark' ? (cleaned ? `${cleaned} dark` : 'dark') : cleaned
      })()
      const varsCss = buildKgVarsStyle(themeAttr)
      const mediaCfgJson = (() => {
        const density = store.mediaPanelDensity === 'compact' ? 'compact' : 'default'
        const num = (v: unknown, fallback: number) => {
          const n = typeof v === 'number' ? v : Number(v)
          return Number.isFinite(n) ? n : fallback
        }
        return JSON.stringify({
          density,
          widthRatioDefault: num((store as unknown as { threeIframeOverlayBaseWidthRatioDefault?: unknown }).threeIframeOverlayBaseWidthRatioDefault, 0.2),
          widthRatioCompact: num((store as unknown as { threeIframeOverlayBaseWidthRatioCompact?: unknown }).threeIframeOverlayBaseWidthRatioCompact, 0.16),
          widthMinDefault: num((store as unknown as { threeIframeOverlayBaseWidthMinPxDefault?: unknown }).threeIframeOverlayBaseWidthMinPxDefault, 210),
          widthMinCompact: num((store as unknown as { threeIframeOverlayBaseWidthMinPxCompact?: unknown }).threeIframeOverlayBaseWidthMinPxCompact, 180),
          widthMaxDefault: num((store as unknown as { threeIframeOverlayBaseWidthMaxPxDefault?: unknown }).threeIframeOverlayBaseWidthMaxPxDefault, 360),
          widthMaxCompact: num((store as unknown as { threeIframeOverlayBaseWidthMaxPxCompact?: unknown }).threeIframeOverlayBaseWidthMaxPxCompact, 300),
        })
      })()

      const groupMembersJson = (() => {
        try {
          const gd = store.graphData as unknown as { nodes?: Array<{ id?: unknown; properties?: Record<string, unknown> }> } | null
          const out: Record<string, string[]> = {}
          if (!gd || !Array.isArray(gd.nodes)) return JSON.stringify(out)
          for (let i = 0; i < gd.nodes.length; i += 1) {
            const n = gd.nodes[i]
            const id = String(n?.id ?? '').trim()
            if (!id) continue
            const p = n?.properties
            const gid = typeof p?.['kg:groupId'] === 'string' ? String(p['kg:groupId'] || '').trim() : ''
            if (!gid) continue
            const arr = out[gid] || (out[gid] = [])
            arr.push(id)
          }
          return JSON.stringify(out)
        } catch {
          return JSON.stringify({})
        }
      })()

      try {
        const svgOnly = await (async () => {
          if (!geospatialEnabled) {
            const graphData = store.graphData
            const schema = store.schema
            if (graphData && schema) {
              if (wants3dExport) {
                const centered3d = exportGraphAsCentered3dSvgMarkup({
                  graphData,
                  schema,
                  widthPx: 1920,
                  heightPx: 1080,
                  paddingPx: 96,
                  includeXmlDeclaration: false,
                  animated: true,
                  exportAutoRotate: true,
                  exportAutoRotateSpeed: 0.85,
                  exportMotionIntensityMultiplier: 1.75,
                  threeEdgeRenderer: store.threeEdgeRenderer,
                })
                const trimmed = String(centered3d || '').trim()
                if (trimmed) return trimmed
              } else {
                const viewportControlsPreset =
                  (store as unknown as { viewportControlsPreset?: 'map' | 'design' }).viewportControlsPreset === 'design' ? 'design' : 'map'
                const mediaPanelDensity = store.mediaPanelDensity === 'compact' ? 'compact' : 'default'
                const rendered = await renderGraphCanvasSvgForHtmlExport({
                  graphData,
                  schema,
                  widthPx: 1920,
                  heightPx: 1080,
                  viewportControlsPreset,
                  renderMediaAsNodes: false,
                  mediaPanelDensity,
                })
                if (rendered) return rendered
                const centered = exportGraphAsCenteredSvgMarkup({
                  graphData,
                  schema,
                  widthPx: 1920,
                  heightPx: 1080,
                  paddingPx: 96,
                  includeXmlDeclaration: false,
                  animated: true,
                })
                const trimmed = String(centered || '').trim()
                if (trimmed) return trimmed
              }
            }
          }
          return String(svgMarkup || '').replace(/^\s*<\?xml[^>]*>\s*/i, '').trim()
        })()
        if (!svgOnly) {
          pushUiToast({ id: 'export-html-missing-canvas', kind: 'warning', message: 'No inline SVG canvas snapshot available.' })
          return
        }
        const htmlViewer = await buildGraphHtmlViewerMarkup({
          title: `${exportBaseName} (Canvas)`,
          svgMarkup: svgOnly,
          graphData: store.graphData,
          includeRichMediaOverlays: true,
          mediaPanelDensity: store.mediaPanelDensity === 'compact' ? 'compact' : 'default',
          viewportWidthPx: 1920,
          viewportHeightPx: 1080,
          viewportScaleToFit: true,
          enableDecorativeAnimation: true,
          threeIframeOverlayBaseWidthRatioDefault: (store as unknown as { threeIframeOverlayBaseWidthRatioDefault?: number }).threeIframeOverlayBaseWidthRatioDefault,
          threeIframeOverlayBaseWidthRatioCompact: (store as unknown as { threeIframeOverlayBaseWidthRatioCompact?: number }).threeIframeOverlayBaseWidthRatioCompact,
          threeIframeOverlayBaseWidthMinPxDefault: (store as unknown as { threeIframeOverlayBaseWidthMinPxDefault?: number }).threeIframeOverlayBaseWidthMinPxDefault,
          threeIframeOverlayBaseWidthMinPxCompact: (store as unknown as { threeIframeOverlayBaseWidthMinPxCompact?: number }).threeIframeOverlayBaseWidthMinPxCompact,
          threeIframeOverlayBaseWidthMaxPxDefault: (store as unknown as { threeIframeOverlayBaseWidthMaxPxDefault?: number }).threeIframeOverlayBaseWidthMaxPxDefault,
          threeIframeOverlayBaseWidthMaxPxCompact: (store as unknown as { threeIframeOverlayBaseWidthMaxPxCompact?: number }).threeIframeOverlayBaseWidthMaxPxCompact,
          zoomMinK: readZoomScaleExtent(store.schema || defaultSchema)[0],
          zoomMaxK: readZoomScaleExtent(store.schema || defaultSchema)[1],
          wheelBehavior: readWheelBehavior(store.schema || defaultSchema),
          viewportControlsPreset: (store as unknown as { viewportControlsPreset?: 'map' | 'design' }).viewportControlsPreset === 'design' ? 'design' : 'map',
          panSpeed: readPanSpeed(store.schema || defaultSchema),
          zoomSpeed: readZoomSpeed(store.schema || defaultSchema),
          flowWheelZoomSpeedMultiplier: (store as unknown as { flowWheelZoomSpeedMultiplier?: number }).flowWheelZoomSpeedMultiplier,
          flowWheelZoomIncrementMultiplier: (store as unknown as { flowWheelZoomIncrementMultiplier?: number }).flowWheelZoomIncrementMultiplier,
          flowWheelZoomSmoothMinDurationMs: (store as unknown as { flowWheelZoomSmoothMinDurationMs?: number }).flowWheelZoomSmoothMinDurationMs,
          flowWheelZoomSmoothMaxDurationMs: (store as unknown as { flowWheelZoomSmoothMaxDurationMs?: number }).flowWheelZoomSmoothMaxDurationMs,
          wheelZoomCtrlMetaBoostMultiplier: (store as unknown as { wheelZoomCtrlMetaBoostMultiplier?: number }).wheelZoomCtrlMetaBoostMultiplier,
          canvasInteractionSpeedMultiplier: (store as unknown as { canvasInteractionSpeedMultiplier?: number }).canvasInteractionSpeedMultiplier,
          canvasPanSpeedMultiplier: (store as unknown as { canvasPanSpeedMultiplier?: number }).canvasPanSpeedMultiplier,
          snapGridEnabled: !!store.schema?.behavior?.snapGrid?.enabled,
          snapGridSize: store.schema?.behavior?.snapGrid?.size,
          dragConstraint: (store.schema?.behavior?.dragConstraint as any) || 'free',
          allowNodeDrag: (store.schema?.behavior as any)?.allowNodeDrag !== false,
          allowEdgeDrag: (store.schema?.behavior as any)?.allowNodeDrag !== false,
          allowGroupDrag: (store.schema?.behavior as any)?.allowGroupDrag !== false,
        })
        if (!htmlViewer || !htmlViewer.trim()) {
          pushUiToast({ id: 'export-html-missing-canvas', kind: 'warning', message: 'Failed to build HTML canvas export.' })
          return
        }
        const blob = new Blob([htmlViewer], { type: 'text/html;charset=utf-8' })
        const name = `${exportBaseName}.canvas-${wants3dExport ? '3d' : '2d'}.html`
        const saved = await saveBlobWithPicker(blob, name, { description: 'HTML Files', accept: { 'text/html': ['.html'] } })
        if (saved === '') return
        if (!saved) downloadBlob(blob, name)
        return
      } catch {
        void 0
      }

      const html = [
        '<!doctype html>',
        `<html lang="en" data-theme="${themeAttr}"${exportHtmlClass ? ` class="${exportHtmlClass.replace(/"/g, '&quot;')}"` : ''}>`,
        '<head>',
        '  <meta charset="utf-8" />',
        '  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />',
        `  <title>${exportBaseName} (Canvas)</title>`,
        '  <style>',
        varsCss || '',
        '    :root{--kg-export-media-pointer-events:none;--kg-export-media-panel-pointer-events:none}',
        `    html { height: 100%; color-scheme: ${themeAttr}; }`,
        '    body { height: 100%; }',
        `    body { margin: 0; background: ${exportBg}; color: ${exportFg}; }`,
        '    .kgExportCanvasRoot { width: 100vw; height: 100vh; display: grid; place-items: center; overflow: hidden; }',
        '    .kgExportCanvasStage { width: 100%; height: 100%; position: relative; }',
        '    .kgExportCanvasStage > svg { position: absolute; inset: 0; }',
        '    .kgExportMediaOverlayRoot { position: absolute; inset: 0; z-index: 3; pointer-events: none; }',
        '    .kgExportMediaPanel { position: absolute; left: 0; top: 0; box-sizing: border-box; overflow: hidden; contain: layout paint; isolation: isolate; border-radius: var(--kg-media-panel-radius, 10px); border: var(--kg-media-panel-border-w, 1px) solid var(--kg-border); background: var(--kg-media-panel-bg, var(--kg-panel-bg, rgba(255,255,255,0.92))); box-shadow: 0 10px 30px rgba(0,0,0,0.18); backface-visibility: hidden; -webkit-backface-visibility: hidden; will-change: transform, width, height; pointer-events: auto; display: flex; flex-direction: column; visibility: hidden; opacity: 0; touch-action: none; }',
        '    .kgExportMediaHeader { height: var(--kg-media-panel-header-h, 28px); min-height: var(--kg-media-panel-header-h, 28px); box-sizing: border-box; display: flex; align-items: center; justify-content: center; padding-left: var(--kg-media-panel-padding, 6px); padding-right: var(--kg-media-panel-padding, 6px); background: var(--kg-media-panel-header-bg, var(--kg-media-panel-bg, var(--kg-panel-bg, rgba(255,255,255,0.96)))); border-bottom: var(--kg-media-panel-border-w, 1px) solid var(--kg-border); color: var(--kg-text-primary, var(--kg-text)); font-size: var(--kg-media-panel-title-size, 12px); font-weight: 600; line-height: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: grab; touch-action: none; pointer-events: auto; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; }',
        '    .kgExportMediaBody { flex: 1; padding: var(--kg-media-panel-padding, 6px); box-sizing: border-box; min-height: 0; }',
        '    .kgExportMediaBody iframe,.kgExportMediaBody img,.kgExportMediaBody video { pointer-events: var(--kg-export-media-pointer-events, none); }',
        '    .kgExportThreeRoot { place-items: stretch; position: relative; }',
        '    #kgExportThreeCanvas { width: 100%; height: 100%; display: block; }',
        '    .kgExportThreeRoot canvas { position: relative; z-index: 2; }',
        `    .kgExportTooltip { position: fixed; z-index: 2147483647; padding: 6px 8px; border-radius: 8px; font-size: 12px; line-height: 1.2; max-width: min(560px, 70vw); white-space: pre-wrap; pointer-events: none; user-select: none; background: ${tooltipBgToken}; color: ${tooltipTextToken}; border: 1px solid rgba(255,255,255,0.18); box-shadow: 0 10px 30px rgba(0,0,0,0.35); }`,
        '    @keyframes kgNodeBob { 0% { translate: 0 0; } 50% { translate: 0 calc(var(--kg-bob-amp, 2px) * -1); } 100% { translate: 0 0; } }',
        '    .kgExportCanvasRoot svg { width: 100%; height: 100%; display: block; touch-action: none; }',
        '    .kgExportCanvasRoot g[data-kg-layer="labels"], .kgExportCanvasRoot g[data-kg-layer="edge-labels"], .kgExportCanvasRoot g[data-kg-layer="group-labels"] { display: inline !important; visibility: visible !important; opacity: 1 !important; }',
        `    .kgExportCanvasRoot [data-kg-layer="labels"] text, .kgExportCanvasRoot [data-kg-layer="edge-labels"] text, .kgExportCanvasRoot [data-kg-layer="group-labels"] text { fill: ${canvasLabelFillToken}; stroke: ${canvasLabelHaloToken}; paint-order: stroke; visibility: visible !important; opacity: 1 !important; }`,
        '    .kgExportCanvasRoot [data-lod-hidden="1"], .kgExportCanvasRoot [data-zoom-lod-hidden="1"] { visibility: visible !important; opacity: 1 !important; }',
        '    .kgExportCanvasRoot [data-node-id] { cursor: grab; }',
        '    .kgExportCanvasRoot [data-node-id]:active { cursor: grabbing; }',
        '    .kgExportCanvasImg { max-width: none; max-height: none; display: block; transform-origin: 0 0; touch-action: none; }',
        '  </style>',
        '</head>',
        '<body>',
        bodyHtml,
        threeModuleScript
          ? '  <script type="module">\n' +
            'window.__KG_EXPORT_THREE_STATUS = "init";\n' +
            'const __kgMarkThreeStatus = (kind, detail) => {\n' +
            '  try {\n' +
            '    window.__KG_EXPORT_THREE_STATUS = String(kind || "unknown");\n' +
            '    if (!detail) return;\n' +
            '    const el = document.createElement("div");\n' +
            '    el.textContent = String(detail);\n' +
            '    el.style.position = "fixed";\n' +
            '    el.style.right = "10px";\n' +
            '    el.style.bottom = "10px";\n' +
            '    el.style.maxWidth = "60vw";\n' +
            '    el.style.padding = "6px 8px";\n' +
            '    el.style.borderRadius = "8px";\n' +
            '    el.style.font = "12px/1.2 system-ui, sans-serif";\n' +
            '    el.style.color = "#f8fafc";\n' +
            '    el.style.background = "rgba(15,23,42,0.86)";\n' +
            '    el.style.border = "1px solid rgba(248,250,252,0.22)";\n' +
            '    el.style.zIndex = "2147483647";\n' +
            '    el.style.pointerEvents = "none";\n' +
            '    document.body.appendChild(el);\n' +
            '  } catch {}\n' +
            '};\n' +
            'try {\n' +
            threeModuleScript.replace(/<\/script>/g, '<\\/script>') +
            '\n__kgMarkThreeStatus("ok", "");\n' +
            '\n} catch (e) {\n' +
            '  try { console.error(e); } catch {}\n' +
            '  __kgMarkThreeStatus("error", `3D export error: ${e && e.message ? e.message : e}`);\n' +
            '}\n' +
            '  </script>'
          : '',
        '  <script>',
        '    (() => { try {',
        '      const root = document.querySelector(".kgExportCanvasRoot");',
        '      if (!root) return;',
        '      const svg = root.querySelector("svg");',
        '      const img = root.querySelector("img.kgExportCanvasImg");',
        '      const clamp = (v, a, b) => Math.max(a, Math.min(b, v));',
        `      const MEDIA_CFG = ${mediaCfgJson};`,
        `      const GROUP_MEMBERS = ${groupMembersJson};`,
        `      const LABELS = (() => {`,
        `        try {`,
        `          const raw = "${labelsForExportB64}";`,
        `          if (!raw) return { nodes: {}, edges: {}, groups: {} };`,
        `          const json = decodeURIComponent(escape(atob(raw)));`,
        `          const parsed = JSON.parse(json);`,
        `          if (!parsed || typeof parsed !== "object") return { nodes: {}, edges: {}, groups: {} };`,
        `          if (!parsed.groups || typeof parsed.groups !== "object") parsed.groups = {};`,
        `          return parsed;`,
        `        } catch {`,
        `          return { nodes: {}, edges: {}, groups: {} };`,
        `        }`,
        `      })();`,
        '      const parseVb = (s) => {',
        '        const p = String(s || "").trim().split(/[ ,]+/).filter(Boolean).map(Number);',
        '        if (p.length === 4 && p.every(n => Number.isFinite(n))) return { x: p[0], y: p[1], w: p[2], h: p[3] };',
        '        return null;',
        '      };',
        '      const applyVb = (vb) => {',
        '        if (!svg) return;',
        '        svg.setAttribute("viewBox", `${vb.x} ${vb.y} ${vb.w} ${vb.h}`);',
        '      };',
        '      const svgPoint = (clientX, clientY) => {',
        '        if (!svg) return null;',
        '        const pt = svg.createSVGPoint();',
        '        pt.x = clientX;',
        '        pt.y = clientY;',
        '        const ctm = svg.getScreenCTM();',
        '        if (!ctm) return null;',
        '        const inv = ctm.inverse();',
        '        return pt.matrixTransform(inv);',
        '      };',
        '      const parseTranslate = (s) => {',
        '        const m = String(s || "").match(/translate\\(([-0-9.]+)[ ,]([-0-9.]+)\\)/);',
        '        if (!m) return null;',
        '        const x = Number(m[1]);',
        '        const y = Number(m[2]);',
        '        if (!Number.isFinite(x) || !Number.isFinite(y)) return null;',
        '        return { x, y };',
        '      };',
        '      const getNodeCenter = (el) => {',
        '        const tag = String(el.tagName || "").toLowerCase();',
        '        if (tag === "circle") {',
        '          const x = Number(el.getAttribute("cx"));',
        '          const y = Number(el.getAttribute("cy"));',
        '          if (Number.isFinite(x) && Number.isFinite(y)) return { x, y };',
        '        }',
        '        if (tag === "rect") {',
        '          const x = Number(el.getAttribute("x"));',
        '          const y = Number(el.getAttribute("y"));',
        '          const w = Number(el.getAttribute("width"));',
        '          const h = Number(el.getAttribute("height"));',
        '          if ([x,y,w,h].every(n => Number.isFinite(n))) return { x: x + w / 2, y: y + h / 2 };',
        '        }',
        '        if (tag === "path") {',
        '          const t = parseTranslate(el.getAttribute("transform"));',
        '          if (t) return t;',
        '        }',
        '        if (tag === "g") {',
        '          const t = parseTranslate(el.getAttribute("transform"));',
        '          let base = null;',
        '          try {',
        '            const c = el.querySelector && el.querySelector("circle[data-role=\\"node-circle\\"],circle[cx][cy]");',
        '            if (c) {',
        '              const cx = Number(c.getAttribute("cx"));',
        '              const cy = Number(c.getAttribute("cy"));',
        '              if (Number.isFinite(cx) && Number.isFinite(cy)) base = { x: cx, y: cy };',
        '            }',
        '            if (!base) {',
        '              const r = el.querySelector && el.querySelector("rect[x][y][width][height]");',
        '              if (r) {',
        '                const x = Number(r.getAttribute("x"));',
        '                const y = Number(r.getAttribute("y"));',
        '                const w = Number(r.getAttribute("width"));',
        '                const h = Number(r.getAttribute("height"));',
        '                if ([x,y,w,h].every(n => Number.isFinite(n))) base = { x: x + w / 2, y: y + h / 2 };',
        '              }',
        '            }',
        '          } catch { }',
        '          if (base && t) return { x: base.x + t.x, y: base.y + t.y };',
        '          if (base) return base;',
        '          if (t) return t;',
        '        }',
        '        return null;',
        '      };',
        '      const setNodeCenter = (el, x, y) => {',
        '        const tag = String(el.tagName || "").toLowerCase();',
        '        if (tag === "circle") {',
        '          el.setAttribute("cx", String(x));',
        '          el.setAttribute("cy", String(y));',
        '          return;',
        '        }',
        '        if (tag === "rect") {',
        '          const w = Number(el.getAttribute("width"));',
        '          const h = Number(el.getAttribute("height"));',
        '          const ww = Number.isFinite(w) ? w : 0;',
        '          const hh = Number.isFinite(h) ? h : 0;',
        '          el.setAttribute("x", String(x - ww / 2));',
        '          el.setAttribute("y", String(y - hh / 2));',
        '          return;',
        '        }',
        '        if (tag === "path" || tag === "g") {',
        '          el.setAttribute("transform", `translate(${x},${y})`);',
        '        }',
        '      };',
        '      if (svg) {',
        '        const vb0 = parseVb(svg.getAttribute("viewBox")) || { x: 0, y: 0, w: 1000, h: 800 };',
        '        let vb = { ...vb0 };',
        '        applyVb(vb);',
        '        const tooltip = document.createElement("div");',
        '        tooltip.className = "kgExportTooltip";',
        '        tooltip.style.display = "none";',
        '        document.body.appendChild(tooltip);',
        '        const forceVisibleText = (el) => {',
        '          if (!(el instanceof Element)) return;',
        '          el.setAttribute("data-lod-hidden", "0");',
        '          el.setAttribute("data-zoom-lod-hidden", "0");',
        '          try { el.removeAttribute("hidden"); } catch { }',
        '          const layer = el.closest("g[data-kg-layer]");',
        '          if (layer instanceof Element) {',
        '            try { layer.removeAttribute("hidden"); } catch { }',
        '            layer.setAttribute("display", "inline");',
        '            layer.setAttribute("visibility", "visible");',
        '            layer.setAttribute("opacity", "1");',
        '          }',
        '          const prev = String(el.getAttribute("style") || "");',
        '          const cleaned = prev.replace(/(?:^|;)\\s*display\\s*:\\s*none\\s*;?/gi, ";").replace(/(?:^|;)\\s*visibility\\s*:\\s*hidden\\s*;?/gi, ";").replace(/(?:^|;)\\s*opacity\\s*:\\s*0(?:\\.0+)?\\s*;?/gi, ";").replace(/;{2,}/g, ";");',
        '          el.setAttribute("style", `${cleaned ? cleaned.replace(/;?\\s*$/, ";") : ""}display:inline;visibility:visible;opacity:1;pointer-events:all;`);',
        '          el.setAttribute("display", "inline");',
        '          el.setAttribute("visibility", "visible");',
        '          el.setAttribute("opacity", "1");',
        '        };',
        '        for (const layer of Array.from(svg.querySelectorAll(\'g[data-kg-layer="labels"], g[data-kg-layer="edge-labels"], g[data-kg-layer="group-labels"]\'))) {',
        '          if (!(layer instanceof Element)) continue;',
        '          try { layer.removeAttribute("hidden"); } catch { }',
        '          layer.setAttribute("display", "inline");',
        '          layer.setAttribute("visibility", "visible");',
        '          layer.setAttribute("opacity", "1");',
        '        }',
        '        for (const el of Array.from(svg.querySelectorAll(\'g[data-kg-layer="labels"] text[data-node-id], g[data-kg-layer="edge-labels"] text[data-edge-id], g[data-kg-layer="group-labels"] text[data-kg-group-id], text[data-kg-group-label="1"][data-kg-group-id]\'))) forceVisibleText(el);',
        '        const showTip = (text, x, y) => {',
        '          tooltip.textContent = String(text || "");',
        '          tooltip.style.left = `${Math.round(x + 12)}px`;',
        '          tooltip.style.top = `${Math.round(y + 12)}px`;',
        '          tooltip.style.display = "";',
        '        };',
        '        const hideTip = () => { tooltip.style.display = "none"; };',
        '        const clearSelection = () => {',
        '          try {',
        '            const s = (window.getSelection && window.getSelection()) || null;',
        '            if (s && s.removeAllRanges) s.removeAllRanges();',
        '          } catch { }',
        '        };',
        '        const resolveHitElement = (clientX, clientY, fallback) => {',
        '          try {',
        '            const list = typeof document.elementsFromPoint === "function" ? document.elementsFromPoint(clientX, clientY) : null;',
        '            if (list && list.length) {',
        '              for (let i = 0; i < list.length; i += 1) {',
        '                const el = list[i];',
        '                if (!(el instanceof Element)) continue;',
        '                if (el.classList && el.classList.contains("kgExportMediaOverlayRoot")) continue;',
        '                return el;',
        '              }',
        '            }',
        '          } catch { }',
        '          try {',
        '            if (fallback && fallback instanceof Element) return fallback;',
        '            if (fallback && fallback.parentElement) return fallback.parentElement;',
        '          } catch { }',
        '          return null;',
        '        };',
        '        let pan = null;',
        '        const isMediaHeaderTarget = (t) => {',
        '          try { return (t instanceof Element) ? !!t.closest(".kgExportMediaHeader") : false; } catch { return false; }',
        '        };',
        '        const isMediaBodyTarget = (t) => {',
        '          try { return (t instanceof Element) ? !!t.closest(".kgExportMediaBody") : false; } catch { return false; }',
        '        };',
        '        root.addEventListener("pointerdown", (e) => {',
        '          if (!e) return;',
        '          try {',
        '            const hid = hitHeaderNodeId(e.clientX, e.clientY);',
        '            if (hid) { startHeaderDrag(e, hid); return; }',
        '          } catch { }',
        '          if (e.defaultPrevented) return;',
        '          if (typeof e.button === "number" && e.button !== 0) return;',
        '          const t = resolveHitElement(e.clientX, e.clientY, e.target);',
        '          if (isMediaHeaderTarget(t)) return;',
        '          try { clearSelection(); } catch { }',
        '          if (getComputedStyle(document.documentElement).getPropertyValue("--kg-export-media-pointer-events").trim() === "auto" && isMediaBodyTarget(t)) return;',
        '          const p = svgPoint(e.clientX, e.clientY);',
        '          if (!p) return;',
        '          try { root.setPointerCapture(e.pointerId); } catch { }',
        '          pan = { sx: p.x, sy: p.y, vb: { ...vb }, pointerId: e.pointerId };',
        '          hideTip();',
        '          try { e.preventDefault(); } catch { }',
        '        }, { passive: false });',
        '        root.addEventListener("pointermove", (e) => {',
        '          if (!e) return;',
        '          if (e.defaultPrevented) return;',
        '          if (!pan || e.pointerId !== pan.pointerId) return;',
        '          const p = svgPoint(e.clientX, e.clientY);',
        '          if (!p) return;',
        '          vb = { ...pan.vb, x: pan.vb.x - (p.x - pan.sx), y: pan.vb.y - (p.y - pan.sy) };',
        '          applyVb(vb);',
        '          try { updateMediaOverlays(); } catch { }',
        '          try { e.preventDefault(); } catch { }',
        '        }, { passive: false });',
        '        root.addEventListener("pointerup", (e) => {',
        '          if (!e) return;',
        '          if (!pan || e.pointerId !== pan.pointerId) return;',
        '          pan = null;',
        '        }, { passive: false });',
        '        root.addEventListener("pointercancel", (e) => {',
        '          if (!e) return;',
        '          if (!pan || e.pointerId !== pan.pointerId) return;',
        '          pan = null;',
        '        }, { passive: false });',
        '        svg.addEventListener("wheel", (e) => {',
        '          const p = svgPoint(e.clientX, e.clientY);',
        '          if (!p) return;',
        '          const k = Math.pow(1.0015, e.deltaY);',
        '          const nextW = clamp(vb.w * k, vb0.w * 0.05, vb0.w * 80);',
        '          const nextH = clamp(vb.h * k, vb0.h * 0.05, vb0.h * 80);',
        '          const sx = (p.x - vb.x) / vb.w;',
        '          const sy = (p.y - vb.y) / vb.h;',
        '          vb = { x: p.x - sx * nextW, y: p.y - sy * nextH, w: nextW, h: nextH };',
        '          applyVb(vb);',
        '          try { updateMediaOverlays(); } catch { }',
        '          try { e.preventDefault(); } catch { }',
        '        }, { passive: false });',
        '        const pushMap = (m, k, v) => {',
        '          if (!k) return;',
        '          const cur = m.get(k);',
        '          if (cur) cur.push(v); else m.set(k, [v]);',
        '        };',
        '        const nodeShapeSelector = \'circle[data-node-id],rect[data-node-id],path[data-node-id][data-kg-node-shape],g.media-node-panel[data-node-id],g[data-node-id]\';',
        '        const nodeShapesById = new Map();',
        '        for (const el of Array.from(svg.querySelectorAll(nodeShapeSelector))) {',
        '          const id = String(el.getAttribute("data-node-id") || "");',
        '          pushMap(nodeShapesById, id, el);',
        '        }',
        '        try {',
        '          for (const g of Array.from(svg.querySelectorAll("g[data-node-id]"))) {',
        '            if (!(g instanceof Element)) continue;',
        '            const id = String(g.getAttribute("data-node-id") || "");',
        '            if (!id) continue;',
        '            const derived = g.querySelectorAll ? g.querySelectorAll("circle[cx][cy],rect[x][y][width][height],text[x][y]") : [];',
        '            for (const el of Array.from(derived)) {',
        '              if (!(el instanceof Element)) continue;',
        '              pushMap(nodeShapesById, id, el);',
        '            }',
        '          }',
        '        } catch { }',
        '        const mediaRoot = root.querySelector(".kgExportMediaOverlayRoot");',
        '        const mediaPanels = mediaRoot ? Array.from(mediaRoot.querySelectorAll(".kgExportMediaPanel[data-node-id]")) : [];',
        '        let lastMediaVarsKey = "";',
        '        let lastMediaVars = null;',
        '        let lastMediaPanelW = 0;',
        '        let lastMediaPanelH = 0;',
        '        const computeMediaVars = (density, sizeScale) => {',
        '          const s = Number.isFinite(sizeScale) ? Math.max(0.001, Number(sizeScale)) : 1;',
        '          const d = density === "compact" ? "compact" : "default";',
        '          const headerBase = d === "compact" ? 22 : 28;',
        '          const paddingBase = d === "compact" ? 6 : 8;',
        '          const radiusBase = d === "compact" ? 9 : 10;',
        '          const borderBase = 1;',
        '          const titleBase = d === "compact" ? 11 : 12;',
        '          const headerH = Math.max(14, Math.round(headerBase * s));',
        '          const padding = Math.max(2, Math.round(paddingBase * s));',
        '          const radius = Math.max(3, Math.round(radiusBase * s));',
        '          const borderW = Math.max(1, Math.round(borderBase * s));',
        '          const titleSize = Math.max(10, Math.round(titleBase * s));',
        '          const metrics = { headerH, padding, radius, borderW, titleSize };',
        '          const vars = {',
        '            "--kg-media-panel-header-h": `${headerH}px`,',
        '            "--kg-media-panel-border-w": `${borderW}px`,',
        '            "--kg-media-panel-radius": `${radius}px`,',
        '            "--kg-media-panel-padding": `${padding}px`,',
        '            "--kg-media-panel-title-size": `${titleSize}px`,',
        '          };',
        '          return { metrics, vars };',
        '        };',
        '        const computePanelSize16x9 = (contentW, headerH, padding) => {',
        '          const cw = Math.max(2, Number(contentW) || 2);',
        '          const ch = Math.max(2, (cw * 9) / 16);',
        '          const p = Math.max(0, Number(padding) || 0);',
        '          const hh = Math.max(0, Number(headerH) || 0);',
        '          const panelW = Math.max(2, cw + p * 2);',
        '          const panelH = Math.max(2, ch + hh + p * 2);',
        '          return { panelW, panelH, contentW: cw, contentH: ch };',
        '        };',
        '        const applyVars = (el, vars) => {',
        '          if (!(el instanceof HTMLElement) || !vars) return;',
        '          for (const k of Object.keys(vars)) el.style.setProperty(k, String(vars[k] || ""));',
        '        };',
        '        const svgToClient = (x, y) => {',
        '          if (!svg) return null;',
        '          const ctm = svg.getScreenCTM();',
        '          if (!ctm) return null;',
        '          const pt = svg.createSVGPoint();',
        '          pt.x = x;',
        '          pt.y = y;',
        '          const out = pt.matrixTransform(ctm);',
        '          return { x: out.x, y: out.y };',
        '        };',
        '        const updateMediaOverlays = () => {',
        '          if (!mediaPanels.length) return;',
        '          const rect = root.getBoundingClientRect();',
        '          const vw = Math.max(1, rect.width);',
        '          const vh = Math.max(1, rect.height);',
        '          const ctm = svg ? svg.getScreenCTM() : null;',
        '          const kRaw = ctm && Number.isFinite(ctm.a) ? Math.abs(ctm.a) : 1;',
        '          const k = Math.max(0.001, kRaw);',
        '          const density = MEDIA_CFG && MEDIA_CFG.density === "compact" ? "compact" : "default";',
        '          const widthRatio = density === "compact" ? Number(MEDIA_CFG.widthRatioCompact || 0.16) : Number(MEDIA_CFG.widthRatioDefault || 0.2);',
        '          const widthMin = density === "compact" ? Number(MEDIA_CFG.widthMinCompact || 180) : Number(MEDIA_CFG.widthMinDefault || 210);',
        '          const widthMax = density === "compact" ? Number(MEDIA_CFG.widthMaxCompact || 300) : Number(MEDIA_CFG.widthMaxDefault || 360);',
        '          const clampW = (px) => Math.max(Math.max(1, widthMin), Math.min(Math.max(1, widthMax), Number(px) || 0));',
        '          const baseW = clampW(vw * Math.max(0.001, Math.min(0.9, widthRatio)));',
        '          const MAX_PANEL_PX = 2048;',
        '          const STEP_PX = 16;',
        '          const quantize = (px) => Math.round(px / STEP_PX) * STEP_PX;',
        '          const contentW = Math.max(2, Math.min(MAX_PANEL_PX, quantize(baseW * k)));',
        '          const sizeScale = Math.max(0.001, contentW / Math.max(1, baseW));',
        '          let varsChanged = false;',
        '          const varsKey = `${density}|${Math.round(contentW)}`;',
        '          if (varsKey !== lastMediaVarsKey || !lastMediaVars) {',
        '            const computed = computeMediaVars(density, sizeScale);',
        '            const panel = computePanelSize16x9(contentW, computed.metrics.headerH, computed.metrics.padding);',
        '            lastMediaVars = computed.vars;',
        '            lastMediaPanelW = panel.panelW;',
        '            lastMediaPanelH = panel.panelH;',
        '            lastMediaVarsKey = varsKey;',
        '            varsChanged = true;',
        '          }',
        '          for (const panelEl of mediaPanels) {',
        '            const id = String(panelEl.getAttribute("data-node-id") || "");',
        '            if (!id) continue;',
        '            const list = nodeShapesById.get(id);',
        '            let shapeEl = null;',
        '            if (list && list.length) {',
        '              for (let i = 0; i < list.length; i += 1) {',
        '                const el = list[i];',
        '                if (!(el instanceof Element)) continue;',
        '                if ((el.hasAttribute("cx") && el.hasAttribute("cy")) || (el.hasAttribute("x") && el.hasAttribute("y"))) { shapeEl = el; break; }',
        '              }',
        '              if (!shapeEl) shapeEl = list[0];',
        '            }',
        '            const center = shapeEl ? getNodeCenter(shapeEl) : null;',
        '            if (!center) {',
        '              panelEl.style.visibility = "hidden";',
        '              panelEl.style.opacity = "0";',
        '              continue;',
        '            }',
        '            const client = svgToClient(center.x, center.y);',
        '            if (!client) {',
        '              panelEl.style.visibility = "hidden";',
        '              panelEl.style.opacity = "0";',
        '              continue;',
        '            }',
        '            const cx = client.x - rect.left;',
        '            const cy = client.y - rect.top;',
        '            let left = Math.round(cx - lastMediaPanelW / 2);',
        '            let top = Math.round(cy - lastMediaPanelH / 2);',
        '            if (varsChanged) applyVars(panelEl, lastMediaVars);',
        '            panelEl.style.width = `${Math.round(lastMediaPanelW)}px`;',
        '            panelEl.style.height = `${Math.round(lastMediaPanelH)}px`;',
        '            panelEl.style.transform = `translate3d(${left}px, ${top}px, 0px)`;',
        '            panelEl.style.visibility = "visible";',
        '            panelEl.style.opacity = "1";',
        '          }',
        '        };',
        '        try { updateMediaOverlays(); } catch { }',
        '        try { window.addEventListener("resize", () => { try { updateMediaOverlays(); } catch { } }); } catch { }',
        '        let headerDrag = null;',
        '        let prevUserSelect = "";',
        '        let prevBodyUserSelect = "";',
        '        const lockUserSelect = () => {',
        '          try { prevUserSelect = document.documentElement.style.userSelect || ""; document.documentElement.style.userSelect = "none"; } catch { }',
        '          try { prevBodyUserSelect = document.body.style.userSelect || ""; document.body.style.userSelect = "none"; } catch { }',
        '        };',
        '        const unlockUserSelect = () => {',
        '          try { document.documentElement.style.userSelect = prevUserSelect || ""; } catch { }',
        '          try { document.body.style.userSelect = prevBodyUserSelect || ""; } catch { }',
        '        };',
        '        const hitHeaderNodeId = (clientX, clientY) => {',
        '          try {',
        '            const list = typeof document.elementsFromPoint === "function" ? document.elementsFromPoint(clientX, clientY) : null;',
        '            if (list && list.length) {',
        '              for (let i = 0; i < list.length; i += 1) {',
        '                const el = list[i];',
        '                if (!(el instanceof Element)) continue;',
        '                const header = el.closest ? el.closest(".kgExportMediaHeader") : null;',
        '                if (!header) continue;',
        '                const panel = header.closest ? header.closest(".kgExportMediaPanel[data-node-id]") : null;',
        '                if (!panel) continue;',
        '                const id = String(panel.getAttribute("data-node-id") || "");',
        '                if (id) return id;',
        '              }',
        '            }',
        '          } catch { }',
        '          try {',
        '            if (!mediaPanels || !mediaPanels.length) return "";',
        '            for (let i = 0; i < mediaPanels.length; i += 1) {',
        '              const panelEl = mediaPanels[i];',
        '              if (!(panelEl instanceof Element)) continue;',
        '              const id = String(panelEl.getAttribute("data-node-id") || "");',
        '              if (!id) continue;',
        '              const r = panelEl.getBoundingClientRect();',
        '              if (!r || !Number.isFinite(r.left) || !Number.isFinite(r.top)) continue;',
        '              if (clientX < r.left || clientX > r.right || clientY < r.top || clientY > r.bottom) continue;',
        '              let hh = 0;',
        '              try {',
        '                const header = panelEl.querySelector && panelEl.querySelector(".kgExportMediaHeader");',
        '                if (header && header.getBoundingClientRect) {',
        '                  const hr = header.getBoundingClientRect();',
        '                  if (hr && Number.isFinite(hr.height)) hh = hr.height;',
        '                }',
        '              } catch { }',
        '              if (!(hh > 0)) {',
        '                try {',
        '                  const v = parseFloat(String(getComputedStyle(panelEl).getPropertyValue("--kg-media-panel-header-h") || "").trim() || "NaN");',
        '                  if (Number.isFinite(v) && v > 0) hh = v;',
        '                } catch { }',
        '              }',
        '              const headerH = Math.max(8, Number.isFinite(hh) && hh > 0 ? hh : 28);',
        '              if (clientY <= r.top + headerH) return id;',
        '            }',
        '          } catch { }',
        '          return "";',
        '        };',
        '        const onHeaderMove = (ev) => {',
        '          const s = headerDrag;',
        '          if (!s || !ev || ev.pointerId !== s.pointerId) return;',
        '          const p = svgPoint(ev.clientX, ev.clientY);',
        '          if (!p) return;',
        '          const dx = p.x - s.px;',
        '          const dy = p.y - s.py;',
        '          s.px = p.x;',
        '          s.py = p.y;',
        '          if (!Number.isFinite(dx) || !Number.isFinite(dy)) return;',
        '          translateNodeByDelta(s.id, dx, dy);',
        '          try { updateMediaOverlays(); } catch { }',
        '        };',
        '        const endHeaderDrag = (ev) => {',
        '          const s = headerDrag;',
        '          if (!s || !ev || ev.pointerId !== s.pointerId) return;',
        '          headerDrag = null;',
        '          unlockUserSelect();',
        '          try { window.removeEventListener("pointermove", onHeaderMove, true); } catch { }',
        '          try { window.removeEventListener("pointerup", endHeaderDrag, true); } catch { }',
        '          try { window.removeEventListener("pointercancel", endHeaderDrag, true); } catch { }',
        '        };',
        '        const onHeaderMouseMove = (ev) => {',
        '          const s = headerDrag;',
        '          if (!s || s.pointerId !== -1) return;',
        '          const p = svgPoint(ev.clientX, ev.clientY);',
        '          if (!p) return;',
        '          const dx = p.x - s.px;',
        '          const dy = p.y - s.py;',
        '          s.px = p.x;',
        '          s.py = p.y;',
        '          if (!Number.isFinite(dx) || !Number.isFinite(dy)) return;',
        '          translateNodeByDelta(s.id, dx, dy);',
        '          try { updateMediaOverlays(); } catch { }',
        '        };',
        '        const endHeaderMouseDrag = () => {',
        '          const s = headerDrag;',
        '          if (!s || s.pointerId !== -1) return;',
        '          headerDrag = null;',
        '          unlockUserSelect();',
        '          try { window.removeEventListener("mousemove", onHeaderMouseMove, true); } catch { }',
        '          try { window.removeEventListener("mouseup", endHeaderMouseDrag, true); } catch { }',
        '        };',
        '        const startHeaderDrag = (e, id) => {',
        '          if (!e || !id) return false;',
        '          if (headerDrag) return false;',
        '          try {',
        '            const p0 = svgPoint(e.clientX, e.clientY);',
        '            if (!p0) return false;',
        '            lockUserSelect();',
        '            headerDrag = { id, pointerId: e.pointerId, px: p0.x, py: p0.y };',
        '            try { e.preventDefault(); } catch { }',
        '            try { e.stopPropagation(); } catch { }',
        '            try { window.addEventListener("pointermove", onHeaderMove, { passive: true, capture: true }); } catch { }',
        '            try { window.addEventListener("pointerup", endHeaderDrag, { passive: true, capture: true }); } catch { }',
        '            try { window.addEventListener("pointercancel", endHeaderDrag, { passive: true, capture: true }); } catch { }',
        '            return true;',
        '          } catch {',
        '            return false;',
        '          }',
        '        };',
        '        const startHeaderMouseDrag = (e, id) => {',
        '          if (!e || !id) return false;',
        '          if (headerDrag) return false;',
        '          try {',
        '            const p0 = svgPoint(e.clientX, e.clientY);',
        '            if (!p0) return false;',
        '            lockUserSelect();',
        '            headerDrag = { id, pointerId: -1, px: p0.x, py: p0.y };',
        '            try { e.preventDefault(); } catch { }',
        '            try { e.stopPropagation(); } catch { }',
        '            try { window.addEventListener("mousemove", onHeaderMouseMove, { passive: true, capture: true }); } catch { }',
        '            try { window.addEventListener("mouseup", endHeaderMouseDrag, { passive: true, capture: true }); } catch { }',
        '            return true;',
        '          } catch {',
        '            return false;',
        '          }',
        '        };',
        '        try {',
        '          window.addEventListener("pointerdown", (e) => {',
        '            if (!e) return;',
        '            if (typeof e.button === "number" && e.button !== 0) return;',
        '            if (e.defaultPrevented) return;',
        '            const hid = hitHeaderNodeId(e.clientX, e.clientY);',
        '            if (!hid) return;',
        '            startHeaderDrag(e, hid);',
        '          }, { passive: false, capture: true });',
        '          window.addEventListener("mousedown", (e) => {',
        '            if (!e) return;',
        '            if (typeof e.button === "number" && e.button !== 0) return;',
        '            if (e.defaultPrevented) return;',
        '            const hid = hitHeaderNodeId(e.clientX, e.clientY);',
        '            if (!hid) return;',
        '            startHeaderMouseDrag(e, hid);',
        '          }, { passive: false, capture: true });',
        '        } catch { }',
        '        try {',
        '          for (const panelEl of mediaPanels) {',
        '            const id = String(panelEl.getAttribute("data-node-id") || "");',
        '            if (!id) continue;',
        '            const headerEl = panelEl.querySelector && panelEl.querySelector(".kgExportMediaHeader");',
        '            if (!(headerEl instanceof Element)) continue;',
        '            headerEl.addEventListener("pointerdown", (e) => {',
        '              if (!e) return;',
        '              if (typeof e.button === "number" && e.button !== 0) return;',
        '              if (e.defaultPrevented) return;',
              '              startHeaderDrag(e, id);',
        '            }, { passive: false, capture: true });',
        '          }',
        '        } catch { }',
        '        const nodeLabelsById = new Map();',
        '        for (const el of Array.from(svg.querySelectorAll(\'g[data-kg-layer="labels"] text[data-node-id]\'))) {',
        '          const id = String(el.getAttribute("data-node-id") || "");',
        '          pushMap(nodeLabelsById, id, el);',
        '        }',
        '        const nodeChevronsById = new Map();',
        '        for (const el of Array.from(svg.querySelectorAll(\'path[data-kg-node-chevron="1"][data-node-id]\'))) {',
        '          const id = String(el.getAttribute("data-node-id") || "");',
        '          pushMap(nodeChevronsById, id, el);',
        '        }',
        '        const portHandlesById = new Map();',
        '        for (const el of Array.from(svg.querySelectorAll(\'g[data-kg-layer="port-handles"] circle[data-node-id][data-port-side]\'))) {',
        '          const id = String(el.getAttribute("data-node-id") || "");',
        '          pushMap(portHandlesById, id, el);',
        '        }',
        '        const edgeEls = Array.from(svg.querySelectorAll("line[data-source-id][data-target-id],line[data-source][data-target]"));',
        '        const edgeRefsByNode = new Map();',
        '        for (const el of edgeEls) {',
        '          const s = String(el.getAttribute("data-source-id") || el.getAttribute("data-source") || "");',
        '          const t = String(el.getAttribute("data-target-id") || el.getAttribute("data-target") || "");',
        '          if (!s || !t) continue;',
        '          pushMap(edgeRefsByNode, s, { el, end: "s" });',
        '          pushMap(edgeRefsByNode, t, { el, end: "t" });',
        '        }',
        '        const edgeLabelsById = new Map();',
        '        for (const el of Array.from(svg.querySelectorAll(\'g[data-kg-layer="edge-labels"] text[data-edge-id]\'))) {',
        '          const id = String(el.getAttribute("data-edge-id") || "");',
        '          if (!id) continue;',
        '          edgeLabelsById.set(id, el);',
        '        }',
        '        const groupElsById = new Map();',
        '        for (const el of Array.from(svg.querySelectorAll("[data-kg-group-id]"))) {',
        '          const gid = String(el.getAttribute("data-kg-group-id") || "");',
        '          if (!gid) continue;',
        '          pushMap(groupElsById, gid, el);',
        '        }',
        '        const addDeltaToEl = (el, dx, dy) => {',
        '          if (!(el instanceof Element)) return;',
        '          const tag = String(el.tagName || "").toLowerCase();',
        '          if (el.hasAttribute("cx") && el.hasAttribute("cy")) {',
        '            const cx = Number(el.getAttribute("cx"));',
        '            const cy = Number(el.getAttribute("cy"));',
        '            if (Number.isFinite(cx) && Number.isFinite(cy)) {',
        '              el.setAttribute("cx", String(cx + dx));',
        '              el.setAttribute("cy", String(cy + dy));',
        '              return;',
        '            }',
        '          }',
        '          if (el.hasAttribute("x") && el.hasAttribute("y")) {',
        '            const x = Number(el.getAttribute("x"));',
        '            const y = Number(el.getAttribute("y"));',
        '            if (Number.isFinite(x) && Number.isFinite(y)) {',
        '              el.setAttribute("x", String(x + dx));',
        '              el.setAttribute("y", String(y + dy));',
        '              return;',
        '            }',
        '          }',
        '          const tr = String(el.getAttribute("transform") || "");',
        '          const m = tr.match(/translate\\(\\s*([-0-9.]+)\\s*[ ,]\\s*([-0-9.]+)\\s*\\)/);',
        '          if (m) {',
        '            const tx = Number(m[1]);',
        '            const ty = Number(m[2]);',
        '            if (Number.isFinite(tx) && Number.isFinite(ty)) {',
        '              el.setAttribute("transform", tr.replace(m[0], `translate(${tx + dx},${ty + dy})`));',
        '              return;',
        '            }',
        '          }',
        '          if (tag === "path" || tag === "g") {',
        '            try {',
        '              const base = el.dataset && typeof el.dataset.kgBaseTransform === "string" ? String(el.dataset.kgBaseTransform || "") : tr;',
        '              if (el.dataset && typeof el.dataset.kgBaseTransform !== "string") el.dataset.kgBaseTransform = base;',
        '              const ox = el.dataset && Number.isFinite(Number(el.dataset.kgTx)) ? Number(el.dataset.kgTx) : 0;',
        '              const oy = el.dataset && Number.isFinite(Number(el.dataset.kgTy)) ? Number(el.dataset.kgTy) : 0;',
        '              const nx = ox + dx;',
        '              const ny = oy + dy;',
        '              if (el.dataset) { el.dataset.kgTx = String(nx); el.dataset.kgTy = String(ny); }',
        '              el.setAttribute("transform", (`translate(${nx},${ny}) ${base}`).trim());',
        '            } catch { }',
        '          }',
        '        };',
        '        const addDeltaToEdgeEnd = (el, end, dx, dy) => {',
        '          if (!(el instanceof Element)) return;',
        '          const ax = end === "s" ? "x1" : "x2";',
        '          const ay = end === "s" ? "y1" : "y2";',
        '          if (!el.hasAttribute(ax) || !el.hasAttribute(ay)) return;',
        '          const x = Number(el.getAttribute(ax) || "NaN");',
        '          const y = Number(el.getAttribute(ay) || "NaN");',
        '          if (!Number.isFinite(x) || !Number.isFinite(y)) return;',
        '          el.setAttribute(ax, String(x + dx));',
        '          el.setAttribute(ay, String(y + dy));',
        '        };',
        '        const translateNodeByDelta = (id, dx, dy) => {',
        '          const s = String(id || "");',
        '          if (!s) return;',
        '          const lists = [nodeShapesById.get(s), nodeLabelsById.get(s), nodeChevronsById.get(s), portHandlesById.get(s)];',
        '          for (let i = 0; i < lists.length; i += 1) {',
        '            const arr = lists[i];',
        '            if (!arr || !arr.length) continue;',
        '            for (let j = 0; j < arr.length; j += 1) addDeltaToEl(arr[j], dx, dy);',
        '          }',
        '          const refs = edgeRefsByNode.get(s);',
        '          if (refs && refs.length) {',
        '            for (let i = 0; i < refs.length; i += 1) {',
        '              const r = refs[i];',
        '              if (!r || !r.el) continue;',
        '              addDeltaToEdgeEnd(r.el, r.end, dx, dy);',
        '            }',
        '          }',
        '        };',
        '        const translateGroupByDelta = (gid, dx, dy) => {',
        '          const g = String(gid || "");',
        '          if (!g) return;',
        '          const gels = groupElsById.get(g);',
        '          if (gels && gels.length) {',
        '            for (let i = 0; i < gels.length; i += 1) addDeltaToEl(gels[i], dx, dy);',
        '          }',
        '          const members = GROUP_MEMBERS && typeof GROUP_MEMBERS === "object" ? GROUP_MEMBERS[g] : null;',
        '          if (Array.isArray(members) && members.length) {',
        '            for (let i = 0; i < members.length; i += 1) translateNodeByDelta(members[i], dx, dy);',
        '          }',
        '        };',
        '        let nodeDrag = null;',
        '        let groupDrag = null;',
        '        let edgeDrag = null;',
        '        root.addEventListener("pointerdown", (e) => {',
        '          if (!e) return;',
        '          try {',
        '            const hid = hitHeaderNodeId(e.clientX, e.clientY);',
        '            if (hid) { startHeaderDrag(e, hid); return; }',
        '          } catch { }',
        '          if (typeof e.button === "number" && e.button !== 0) return;',
        '          const t = resolveHitElement(e.clientX, e.clientY, e.target);',
        '          if (!(t instanceof Element)) return;',
        '          if (t.closest && t.closest(".kgExportMediaHeader")) return;',
        '          try {',
        '            const path = typeof e.composedPath === "function" ? e.composedPath() : null;',
        '            let panelFromPath = null;',
        '            if (Array.isArray(path)) {',
        '              for (let i = 0; i < path.length; i += 1) {',
        '                const it = path[i];',
        '                if (!(it instanceof Element)) continue;',
        '                const p = it.closest ? it.closest(".kgExportMediaPanel[data-node-id]") : null;',
        '                if (p) { panelFromPath = p; break; }',
        '              }',
        '            }',
        '            const panel = panelFromPath || (t.closest ? t.closest(".kgExportMediaPanel[data-node-id]") : null);',
        '            if (panel) {',
        '              const pid = String(panel.getAttribute("data-node-id") || "");',
        '              if (pid) {',
        '                const p0 = svgPoint(e.clientX, e.clientY);',
        '                if (p0) {',
        '                  nodeDrag = { id: pid, pointerId: e.pointerId, x: p0.x, y: p0.y };',
        '                  try { root.setPointerCapture(e.pointerId); } catch { }',
        '                  try { clearSelection(); } catch { }',
        '                  try { e.preventDefault(); } catch { }',
        '                  try { e.stopPropagation(); } catch { }',
        '                  return;',
        '                }',
        '              }',
        '            }',
        '          } catch { }',
        '          const mediaBody = t.closest(".kgExportMediaBody");',
        '          if (mediaBody) {',
        '            const panel = mediaBody.closest(".kgExportMediaPanel");',
        '            const kind = panel ? String(panel.getAttribute("data-kg-media-kind") || "") : "";',
        '            if (kind === "iframe") return;',
        '          }',
        '          const p = svgPoint(e.clientX, e.clientY);',
        '          if (!p) return;',
        '          const edgeEl = t.closest("line[data-edge-id]");',
        '          if (edgeEl) {',
        '            const sid = String(edgeEl.getAttribute("data-source-id") || edgeEl.getAttribute("data-source") || "");',
        '            const tid = String(edgeEl.getAttribute("data-target-id") || edgeEl.getAttribute("data-target") || "");',
        '            if (sid && tid) {',
        '              edgeDrag = { s: sid, t: tid, pointerId: e.pointerId, x: p.x, y: p.y };',
        '              try { root.setPointerCapture(e.pointerId); } catch { }',
        '              try { clearSelection(); } catch { }',
        '              try { e.preventDefault(); } catch { }',
        '              try { e.stopPropagation(); } catch { }',
        '              return;',
        '            }',
        '          }',
        '          const gEl = t.closest("[data-kg-group-id]");',
        '          if (gEl) {',
        '            const gid = String(gEl.getAttribute("data-kg-group-id") || "");',
        '            if (gid) { groupDrag = { id: gid, pointerId: e.pointerId, x: p.x, y: p.y }; try { root.setPointerCapture(e.pointerId); } catch { } try { clearSelection(); } catch { } try { e.preventDefault(); } catch { } try { e.stopPropagation(); } catch { } return; }',
        '          }',
        '          const nEl = t.closest("[data-node-id]");',
        '          if (nEl) {',
        '            const id = String(nEl.getAttribute("data-node-id") || "");',
        '            if (id) { nodeDrag = { id, pointerId: e.pointerId, x: p.x, y: p.y }; try { root.setPointerCapture(e.pointerId); } catch { } try { clearSelection(); } catch { } try { e.preventDefault(); } catch { } try { e.stopPropagation(); } catch { } }',
        '          }',
        '        }, { passive: false, capture: true });',
        '        root.addEventListener("pointermove", (e) => {',
        '          if (!e) return;',
        '          if (edgeDrag && e.pointerId === edgeDrag.pointerId) {',
        '            const p = svgPoint(e.clientX, e.clientY);',
        '            if (!p) return;',
        '            const dx = p.x - edgeDrag.x;',
        '            const dy = p.y - edgeDrag.y;',
        '            edgeDrag.x = p.x;',
        '            edgeDrag.y = p.y;',
        '            translateNodeByDelta(edgeDrag.s, dx, dy);',
        '            translateNodeByDelta(edgeDrag.t, dx, dy);',
        '            try { updateMediaOverlays(); } catch { }',
        '            try { e.preventDefault(); } catch { }',
        '            try { e.stopPropagation(); } catch { }',
        '            return;',
        '          }',
        '          if (nodeDrag && e.pointerId === nodeDrag.pointerId) {',
        '            const p = svgPoint(e.clientX, e.clientY);',
        '            if (!p) return;',
        '            const dx = p.x - nodeDrag.x;',
        '            const dy = p.y - nodeDrag.y;',
        '            nodeDrag.x = p.x;',
        '            nodeDrag.y = p.y;',
        '            translateNodeByDelta(nodeDrag.id, dx, dy);',
        '            try { updateMediaOverlays(); } catch { }',
        '            try { e.preventDefault(); } catch { }',
        '            try { e.stopPropagation(); } catch { }',
        '            return;',
        '          }',
        '          if (groupDrag && e.pointerId === groupDrag.pointerId) {',
        '            const p = svgPoint(e.clientX, e.clientY);',
        '            if (!p) return;',
        '            const dx = p.x - groupDrag.x;',
        '            const dy = p.y - groupDrag.y;',
        '            groupDrag.x = p.x;',
        '            groupDrag.y = p.y;',
        '            translateGroupByDelta(groupDrag.id, dx, dy);',
        '            try { updateMediaOverlays(); } catch { }',
        '            try { e.preventDefault(); } catch { }',
        '            try { e.stopPropagation(); } catch { }',
        '          }',
        '        }, { passive: false, capture: true });',
        '        root.addEventListener("pointerup", (e) => {',
        '          if (!e) return;',
        '          if (edgeDrag && e.pointerId === edgeDrag.pointerId) { edgeDrag = null; try { e.preventDefault(); } catch { } try { e.stopPropagation(); } catch { } }',
        '          if (nodeDrag && e.pointerId === nodeDrag.pointerId) { nodeDrag = null; try { e.preventDefault(); } catch { } try { e.stopPropagation(); } catch { } }',
        '          if (groupDrag && e.pointerId === groupDrag.pointerId) { groupDrag = null; try { e.preventDefault(); } catch { } try { e.stopPropagation(); } catch { } }',
        '        }, { passive: false, capture: true });',
        '        root.addEventListener("pointercancel", (e) => {',
        '          if (!e) return;',
        '          if (edgeDrag && e.pointerId === edgeDrag.pointerId) edgeDrag = null;',
        '          if (nodeDrag && e.pointerId === nodeDrag.pointerId) nodeDrag = null;',
        '          if (groupDrag && e.pointerId === groupDrag.pointerId) groupDrag = null;',
        '        }, { passive: true, capture: true });',
        '        let lastTipKey = "";',
        '        const tipForNode = (id) => {',
        '          const s = String(id || "");',
        '          const label = LABELS && LABELS.nodes ? String(LABELS.nodes[s] || "") : "";',
        '          if (label) return label;',
        '          const list = nodeLabelsById.get(s);',
        '          if (list && list.length) return String(list[0].textContent || "");',
        '          return s;',
        '        };',
        '        const tipForEdge = (id) => {',
        '          const s = String(id || "");',
        '          const label = LABELS && LABELS.edges ? String(LABELS.edges[s] || "") : "";',
        '          if (label) return label;',
        '          const el = edgeLabelsById.get(s);',
        '          if (el) return String(el.textContent || "");',
        '          return s;',
        '        };',
        '        const tipForGroup = (id, fallbackLabel) => {',
        '          const s = String(id || "");',
        '          const label = LABELS && LABELS.groups ? String(LABELS.groups[s] || "") : "";',
        '          const fb = String(fallbackLabel || "").trim();',
        '          if (label) return label;',
        '          if (fb) return fb;',
        '          return s;',
        '        };',
        '        root.addEventListener("pointermove", (e) => {',
        '          if (pan) return;',
        '          const t = (() => {',
        '            try { return document.elementFromPoint(e.clientX, e.clientY); } catch { return e.target; }',
        '          })();',
        '          if (!(t instanceof Element)) {',
        '            if (lastTipKey) { hideTip(); lastTipKey = ""; }',
        '            return;',
        '          }',
        '          const nodeEl = t.closest("[data-node-id]");',
        '          if (nodeEl instanceof Element) {',
        '            const id = String(nodeEl.getAttribute("data-node-id") || "");',
        '            if (!id) return;',
        '            const key = `n:${id}`;',
        '            if (key !== lastTipKey) lastTipKey = key;',
        '            showTip(tipForNode(id), e.clientX, e.clientY);',
        '            return;',
        '          }',
        '          const edgeEl = t.closest("[data-edge-id]");',
        '          if (edgeEl instanceof Element) {',
        '            const id = String(edgeEl.getAttribute("data-edge-id") || "");',
        '            if (!id) return;',
        '            const key = `e:${id}`;',
        '            if (key !== lastTipKey) lastTipKey = key;',
        '            showTip(tipForEdge(id), e.clientX, e.clientY);',
        '            return;',
        '          }',
        '          const groupEl = t.closest("[data-kg-group-id]");',
        '          if (groupEl instanceof Element) {',
        '            const id = String(groupEl.getAttribute("data-kg-group-id") || "");',
        '            if (!id) return;',
        '            const key = `g:${id}`;',
        '            if (key !== lastTipKey) lastTipKey = key;',
        '            const textEl = groupEl.closest(\'g[data-kg-layer="group-labels"]\') ? groupEl : svg.querySelector(`text[data-kg-group-id="${id}"]`);',
        '            const fallbackLabel = textEl instanceof Element ? String(textEl.textContent || "") : "";',
        '            showTip(tipForGroup(id, fallbackLabel), e.clientX, e.clientY);',
        '            return;',
        '          }',
        '          if (lastTipKey) { hideTip(); lastTipKey = ""; }',
        '        }, { passive: true });',
        '        svg.addEventListener("pointerleave", () => { hideTip(); lastTipKey = ""; });',
        '        const getPrimaryNodeEl = (id) => {',
        '          const list = nodeShapesById.get(id);',
        '          return Array.isArray(list) && list.length ? list[0] : null;',
        '        };',
        '        const getNodeBBox = (id) => {',
        '          const el = getPrimaryNodeEl(id);',
        '          if (!el || typeof el.getBBox !== "function") return null;',
        '          try { return el.getBBox(); } catch { return null; }',
        '        };',
        '        const updateChevron = (id) => {',
        '          const list = nodeChevronsById.get(id);',
        '          if (!list || !list.length) return;',
        '          const bbox = getNodeBBox(id);',
        '          const el0 = getPrimaryNodeEl(id);',
        '          if (!bbox || !el0) return;',
        '          const c = getNodeCenter(el0);',
        '          if (!c) return;',
        '          const r = Math.max(1, Math.min(bbox.width, bbox.height) / 2);',
        '          const pad = clamp(r * 0.35, 6, 12);',
        '          const cx = c.x + bbox.width / 2 - pad;',
        '          const cy = c.y - bbox.height / 2 + pad;',
        '          const size = clamp(r * 0.9, 8, 14);',
        '          const x0 = cx - size * 0.45;',
        '          const y0 = cy - size * 0.35;',
        '          const x1 = cx + size * 0.45;',
        '          const y1 = cy;',
        '          const x2 = cx - size * 0.45;',
        '          const y2 = cy + size * 0.35;',
        '          const d = `M ${x0} ${y0} L ${x1} ${y1} L ${x2} ${y2}`;',
        '          for (const el of list) el.setAttribute("d", d);',
        '        };',
        '        const updatePortHandles = (id) => {',
        '          const list = portHandlesById.get(id);',
        '          if (!list || !list.length) return;',
        '          const bbox = getNodeBBox(id);',
        '          const el0 = getPrimaryNodeEl(id);',
        '          if (!bbox || !el0) return;',
        '          const c = getNodeCenter(el0);',
        '          if (!c) return;',
        '          const r = Math.max(1, Math.min(bbox.width, bbox.height) / 2);',
        '          const offset = clamp(r * 0.28, 6, 16);',
        '          for (const el of list) {',
        '            const side = String(el.getAttribute("data-port-side") || "");',
        '            let x = c.x, y = c.y;',
        '            if (side === "left") x = c.x - bbox.width / 2 - offset;',
        '            else if (side === "right") x = c.x + bbox.width / 2 + offset;',
        '            else if (side === "top") y = c.y - bbox.height / 2 - offset;',
        '            else if (side === "bottom") y = c.y + bbox.height / 2 + offset;',
        '            el.setAttribute("cx", String(x));',
        '            el.setAttribute("cy", String(y));',
        '          }',
        '        };',
        '        const updateNodeLabels = (id, x, y) => {',
        '          const list = nodeLabelsById.get(id);',
        '          if (!list || !list.length) return;',
        '          for (const el of list) {',
        '            el.setAttribute("x", String(x));',
        '            el.setAttribute("y", String(y));',
        '          }',
        '        };',
        '        const updateEdge = (el) => {',
        '          const s = String(el.getAttribute("data-source-id") || "");',
        '          const t = String(el.getAttribute("data-target-id") || "");',
        '          const a = s ? getPrimaryNodeEl(s) : null;',
        '          const b = t ? getPrimaryNodeEl(t) : null;',
        '          if (!a || !b) return;',
        '          const pa = getNodeCenter(a);',
        '          const pb = getNodeCenter(b);',
        '          if (!pa || !pb) return;',
        '          el.setAttribute("x1", String(pa.x));',
        '          el.setAttribute("y1", String(pa.y));',
        '          el.setAttribute("x2", String(pb.x));',
        '          el.setAttribute("y2", String(pb.y));',
        '          const edgeId = String(el.getAttribute("data-edge-id") || "");',
        '          const lbl = edgeId ? edgeLabelsById.get(edgeId) : null;',
        '          if (lbl) {',
        '            lbl.setAttribute("x", String((pa.x + pb.x) / 2));',
        '            lbl.setAttribute("y", String((pa.y + pb.y) / 2));',
        '            lbl.style.display = "";',
        '          }',
        '        };',
        '        let drag = null;',
        '        if (window.__KG_EXPORT_WOBBLE__ === true) {',
        '          const nodeBases = [];',
        '          for (const [id, list] of nodeShapesById.entries()) {',
        '            if (!id) continue;',
        '            if (!list || !list.length) continue;',
        '            const c = getNodeCenter(list[0]);',
        '            if (!c) continue;',
        '            nodeBases.push({ id, base: { x: c.x, y: c.y }, seed: id.length });',
        '          }',
        '          let lastMediaOverlayTs = 0;',
        '          const tickNodes = () => {',
        '            if (!drag && !pan && nodeBases.length) {',
        '              const t = performance.now() * 0.001;',
        '              const amp = 0.25;',
        '              for (let i = 0; i < nodeBases.length; i += 1) {',
        '                const p = nodeBases[i];',
        '                const nx = p.base.x + Math.sin(t * 0.2 + p.seed) * amp;',
        '                const ny = p.base.y + Math.cos(t * 0.25 + p.seed) * amp;',
        '                const shapes = nodeShapesById.get(p.id) || [];',
        '                for (const el of shapes) setNodeCenter(el, nx, ny);',
        '                updateNodeLabels(p.id, nx, ny);',
        '                updatePortHandles(p.id);',
        '                updateChevron(p.id);',
        '                const list = edgeByNode.get(p.id) || [];',
        '                for (const el of list) updateEdge(el);',
        '              }',
        '              try {',
        '                if (mediaPanels.length) {',
        '                  const now = performance.now();',
        '                  if (now - lastMediaOverlayTs > 90) {',
        '                    lastMediaOverlayTs = now;',
        '                    updateMediaOverlays();',
        '                  }',
        '                }',
        '              } catch { }',
        '            }',
        '            requestAnimationFrame(tickNodes);',
        '          };',
        '          tickNodes();',
        '        }',
        '        svg.addEventListener("pointerdown", (e) => {',
        '          if (e.button !== 0) return;',
        '          const t = e.target;',
        '          if (!(t instanceof Element)) return;',
        '          const hit = t.closest("[data-node-id]");',
        '          if (!(hit instanceof Element)) return;',
        '          const id = String(hit.getAttribute("data-node-id") || "");',
        '          if (!id) return;',
        '          const shapes = nodeShapesById.get(id);',
        '          if (!shapes || !shapes.length) return;',
        '          const primary = shapes[0];',
        '          const p0 = svgPoint(e.clientX, e.clientY);',
        '          if (!p0) return;',
        '          const c0 = getNodeCenter(primary);',
        '          if (!c0) return;',
        '          try { svg.setPointerCapture(e.pointerId); } catch { }',
        '          drag = { id, p0, c0, pointerId: e.pointerId };',
        '          hideTip();',
        '          try { e.preventDefault(); } catch { }',
        '        }, { passive: false });',
        '        svg.addEventListener("pointermove", (e) => {',
        '          if (!drag || e.pointerId !== drag.pointerId) return;',
        '          const p = svgPoint(e.clientX, e.clientY);',
        '          if (!p) return;',
        '          const nx = drag.c0.x + (p.x - drag.p0.x);',
        '          const ny = drag.c0.y + (p.y - drag.p0.y);',
        '          const shapes = nodeShapesById.get(drag.id) || [];',
        '          for (const el of shapes) setNodeCenter(el, nx, ny);',
        '          updateNodeLabels(drag.id, nx, ny);',
        '          updatePortHandles(drag.id);',
        '          updateChevron(drag.id);',
        '          const list = edgeByNode.get(drag.id) || [];',
        '          for (const el of list) updateEdge(el);',
        '          try { updateMediaOverlays(); } catch { }',
        '        });',
        '        svg.addEventListener("pointerup", (e) => {',
        '          if (!drag || e.pointerId !== drag.pointerId) return;',
        '          try {',
        '            const id = drag.id;',
        '            const shapes = nodeShapesById.get(id);',
        '            if (shapes && shapes.length) {',
        '              const c = getNodeCenter(shapes[0]);',
        '              if (c) {',
        '                for (let i = 0; i < nodeBases.length; i += 1) {',
        '                  if (nodeBases[i].id === id) {',
        '                    nodeBases[i].base = { x: c.x, y: c.y };',
        '                    break;',
        '                  }',
        '                }',
        '              }',
        '            }',
        '          } catch { }',
        '          drag = null;',
        '          try { updateMediaOverlays(); } catch { }',
        '        });',
        '      }',
        '      if (img) {',
        '        let state = { k: 1, x: 0, y: 0 };',
        '        const apply = () => { img.style.transform = `translate(${state.x}px, ${state.y}px) scale(${state.k})`; };',
        '        apply();',
        '        const fit = () => {',
        '          try {',
        '            const vw = root.clientWidth || window.innerWidth || 0;',
        '            const vh = root.clientHeight || window.innerHeight || 0;',
        '            const iw = img.naturalWidth || 0;',
        '            const ih = img.naturalHeight || 0;',
        '            if (!vw || !vh || !iw || !ih) return;',
        '            const k = Math.min(vw / iw, vh / ih);',
        '            state.k = Number.isFinite(k) && k > 0 ? k : 1;',
        '            state.x = (vw - iw * state.k) / 2;',
        '            state.y = (vh - ih * state.k) / 2;',
        '            apply();',
        '          } catch { }',
        '        };',
        '        if (img.complete) fit(); else img.addEventListener("load", fit, { once: true });',
        '        let pan = null;',
        '        root.addEventListener("pointerdown", (e) => {',
        '          if (e.button !== 0) return;',
        '          if (e.target !== img && e.target !== root) return;',
        '          try { root.setPointerCapture(e.pointerId); } catch { }',
        '          pan = { sx: e.clientX, sy: e.clientY, x: state.x, y: state.y, pointerId: e.pointerId };',
        '          try { e.preventDefault(); } catch { }',
        '        }, { passive: false });',
        '        root.addEventListener("pointermove", (e) => {',
        '          if (!pan || e.pointerId !== pan.pointerId) return;',
        '          state.x = pan.x + (e.clientX - pan.sx);',
        '          state.y = pan.y + (e.clientY - pan.sy);',
        '          apply();',
        '        });',
        '        root.addEventListener("pointerup", (e) => {',
        '          if (!pan || e.pointerId !== pan.pointerId) return;',
        '          pan = null;',
        '        });',
        '        root.addEventListener("wheel", (e) => {',
        '          const rect = root.getBoundingClientRect();',
        '          const cx = e.clientX - rect.left;',
        '          const cy = e.clientY - rect.top;',
        '          const k = Math.pow(1.0015, e.deltaY);',
        '          const nextK = clamp(state.k * (1 / k), 0.05, 80);',
        '          const s = nextK / state.k;',
        '          state.x = cx - (cx - state.x) * s;',
        '          state.y = cy - (cy - state.y) * s;',
        '          state.k = nextK;',
        '          apply();',
        '          try { e.preventDefault(); } catch { }',
        '        }, { passive: false });',
        '      }',
        '    } catch { } })();',
        '  </script>',
        '</body>',
        '</html>',
        '',
      ].join('\n')

      const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
      const name = `${exportBaseName}.canvas-${wants3dExport ? '3d' : '2d'}.html`
      const saved = await saveBlobWithPicker(blob, name, { description: 'HTML Files', accept: { 'text/html': ['.html'] } })
      if (saved === '') return
      if (!saved) downloadBlob(blob, name)
    } catch {
      void 0
    }
  }, [exportBaseName, pushUiToast])

  const handleExportSvg = React.useCallback(async () => {
    try {
      const normalizeSvgMarkup = (raw: string, fallback: { w: number; h: number }): string => {
        const s = String(raw || '').trim()
        if (!s) return ''
        try {
          const parser = new DOMParser()
          const doc = parser.parseFromString(s, 'image/svg+xml')
          const root = doc.documentElement
          if (!root || String(root.nodeName || '').toLowerCase() !== 'svg') {
            return `<?xml version="1.0" encoding="UTF-8"?>\n${s}\n`
          }
          if (!root.getAttribute('xmlns')) root.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
          if (!root.getAttribute('xmlns:xlink')) root.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink')
          if (!root.getAttribute('width') || !root.getAttribute('height')) {
            const vb = String(root.getAttribute('viewBox') || '').trim()
            const parts = vb.split(/[ ,]+/).filter(Boolean)
            const w = parts.length === 4 ? Number(parts[2]) : NaN
            const h = parts.length === 4 ? Number(parts[3]) : NaN
            const width = Number.isFinite(w) && w > 0 ? Math.floor(w) : fallback.w
            const height = Number.isFinite(h) && h > 0 ? Math.floor(h) : fallback.h
            root.setAttribute('width', String(width))
            root.setAttribute('height', String(height))
            if (!vb || parts.length !== 4) root.setAttribute('viewBox', `0 0 ${width} ${height}`)
          }
          const out = new XMLSerializer().serializeToString(root)
          return `<?xml version="1.0" encoding="UTF-8"?>\n${out}\n`
        } catch {
          return `<?xml version="1.0" encoding="UTF-8"?>\n${s}\n`
        }
      }

      const suggested = `${exportBaseName}.svg`
      const fallbackSize = readCanvasViewportSizeFromDom()
      const store = useGraphStore.getState()
      const geospatialEnabled = (() => {
        try {
          return lsBool(LS_KEYS.geospatialOverlayEnabled, false)
        } catch {
          return false
        }
      })()
      const workspaceEditorEnabled = store.workspaceViewMode === 'editor'
      const wants3dExport =
        store.canvasRenderMode === '3d' ||
        (store.canvasRenderModeIsAuto === true && store.canvasRenderModeLastFree === '3d')

      if (wants3dExport) {
        const graphData = store.graphData
        const schema = store.schema
        if (graphData && schema) {
          const centered3d = exportGraphAsCentered3dSvgMarkup({
            graphData,
            schema,
            widthPx: fallbackSize.w,
            heightPx: fallbackSize.h,
            paddingPx: 96,
            includeXmlDeclaration: true,
            animated: true,
            exportAutoRotate: true,
            exportAutoRotateSpeed: 0.85,
            exportMotionIntensityMultiplier: 1.75,
            threeEdgeRenderer: store.threeEdgeRenderer,
          })
          if (centered3d && centered3d.trim()) {
            await exportSvgSnapshot(centered3d, suggested)
            return
          }
        }
      }

      if (geospatialEnabled || workspaceEditorEnabled) {
        const graphData = store.graphData
        const schema = store.schema
        if (graphData && schema) {
          const centered = exportGraphAsCenteredSvgMarkup({
            graphData,
            schema,
            widthPx: fallbackSize.w,
            heightPx: fallbackSize.h,
            paddingPx: 96,
            includeXmlDeclaration: true,
            animated: workspaceEditorEnabled,
          })
          if (centered && centered.trim()) {
            await exportSvgSnapshot(centered, suggested)
            return
          }
        }
      }

      if (!geospatialEnabled) {
        const svg = await store.captureCanvasSvgSnapshot()
        const trimmedSvg = normalizeSvgMarkup(svg || '', fallbackSize).trim()
        if (trimmedSvg) {
          await exportSvgSnapshot(trimmedSvg, suggested)
          return
        }
      }

      const png =
        (geospatialEnabled ? null : await store.captureCanvasPngSnapshot()) || (await captureVisibleCanvasPngBlobFromDom())

      if (png) {
        const wrapped = await wrapPngBlobAsSvgMarkup(png, { includeXmlDeclaration: true, width: fallbackSize.w, height: fallbackSize.h })
        if (!wrapped || !wrapped.trim()) {
          pushUiToast({ id: 'export-svg-missing-canvas-wrap', kind: 'warning', message: 'Failed to wrap canvas PNG into SVG.' })
          return
        }
        await exportSvgSnapshot(wrapped, suggested)
        return
      }

      pushUiToast({ id: 'export-svg-missing-canvas', kind: 'warning', message: 'No canvas snapshot available.' })
    } catch {
      void 0
    }
  }, [exportBaseName, pushUiToast])

  const handleExportJson = React.useCallback(async () => {
    const data = graphData as unknown
    if (!data) {
      pushUiToast({ id: 'export-json-missing-graph', kind: 'warning', message: 'No graph to export.' })
      return
    }
    await exportGraphAsJSON(data as never, `${exportBaseName}.json` as unknown as DatasetPath)
  }, [exportBaseName, graphData, pushUiToast])

  const handleExportPdf = React.useCallback(async () => {
    const root = viewerEl || viewerRef.current
    if (!root) {
      pushUiToast({ id: 'export-pdf-missing-view', kind: 'warning', message: 'Open the Viewer to export PDF.' })
      return
    }
    const previewRoot = (root.querySelector('[data-testid="markdown-preview-root"]') as HTMLElement | null) || root
    const target = (previewRoot.querySelector('article') as HTMLElement | null) || previewRoot
    await printElementToPdf(target, { title: exportBaseName })
  }, [exportBaseName, pushUiToast, viewerEl])

  const presentation = showWebpageHtml ? (
    <section className="flex-1 min-h-0 flex" aria-label="Webpage Presentation Surface">
      <iframe
        className="flex-1 min-h-0 w-full border-0"
        title={webpageMeta?.url || 'Webpage'}
        srcDoc={iframeSrcDoc || ''}
        sandbox="allow-scripts"
        loading="lazy"
        allow="geolocation 'none'; microphone 'none'; camera 'none'; payment 'none'; usb 'none'; clipboard-read 'none'; clipboard-write 'none'"
        referrerPolicy="no-referrer"
      />
    </section>
  ) : (
    <section className="flex-1 min-h-0 flex" aria-label="Presentation Surface">
      <MarkdownPreview
        markdownText={viewerText}
        activeDocumentPath={activeDocumentKey}
        highlightedLineRange={highlightedLineRange}
        markdownWordWrap={markdownWordWrap}
        markdownPresentationMode={true}
        markdownTextHighlight={markdownTextHighlight}
        selectionKind={null}
        uiPanelTextFontClass={uiPanelTextFontClass}
        uiPanelMonospaceTextClass={uiPanelMonospaceTextClass}
        webpageLayoutWireframeAscii={webpageLayoutWireframeAscii}
        geoDatasetIntegration={geoDatasetIntegration}
        previewOverlayScope="container"
        previewOverlayPortalTarget={null}
        previewScrollable={true}
        presentationApiRef={presentationApiRef as unknown as React.MutableRefObject<MarkdownPresentationApi | null>}
        viewMode="presentation"
        showSidebar={false}
        onShowInViewer={showInViewer}
        onShowInEditor={(line: number) => revealLineInEditor(line)}
        onShowInPresentation={showInPresentation}
        onShowInSlidesGallery={showInSlidesGallery}
      />
    </section>
  )

  const slidesGallery = showWebpageHtml ? (
    <section className="flex-1 min-h-0 flex" aria-label="Webpage Slides Gallery">
      <iframe
        className="flex-1 min-h-0 w-full border-0"
        title={webpageMeta?.url || 'Webpage'}
        srcDoc={iframeSrcDoc || ''}
        sandbox="allow-scripts"
        loading="lazy"
        allow="geolocation 'none'; microphone 'none'; camera 'none'; payment 'none'; usb 'none'; clipboard-read 'none'; clipboard-write 'none'"
        referrerPolicy="no-referrer"
      />
    </section>
  ) : (
    <section className="flex-1 min-h-0 flex" aria-label="Slides Gallery">
      <MarkdownPreview
        markdownText={viewerText}
        activeDocumentPath={activeDocumentKey}
        highlightedLineRange={highlightedLineRange}
        markdownWordWrap={markdownWordWrap}
        markdownPresentationMode={false}
        markdownTextHighlight={markdownTextHighlight}
        selectionKind={null}
        uiPanelTextFontClass={uiPanelTextFontClass}
        uiPanelMonospaceTextClass={uiPanelMonospaceTextClass}
        webpageLayoutWireframeAscii={webpageLayoutWireframeAscii}
        geoDatasetIntegration={geoDatasetIntegration}
        previewOverlayScope="container"
        previewOverlayPortalTarget={null}
        previewScrollable={true}
        presentationApiRef={presentationApiRef as unknown as React.MutableRefObject<MarkdownPresentationApi | null>}
        viewMode="gallery"
        showSidebar={false}
        onShowInViewer={showInViewer}
        onShowInEditor={(line: number) => revealLineInEditor(line)}
        onShowInPresentation={showInPresentation}
        onShowInSlidesGallery={showInSlidesGallery}
      />
    </section>
  )

  return (
    <main className="flex-1 min-w-0 min-h-0 flex flex-col" aria-label="Markdown Editor and Viewer">
      <MarkdownWorkspaceToolbar
        explorerOpen={explorerOpen}
        setExplorerOpen={setExplorerOpen}
        canvasOpen={workspaceCanvasPaneOpen}
        setCanvasOpen={setWorkspaceCanvasPaneOpen}
        layoutMode={layoutMode}
        setLayoutMode={setLayoutMode}
        markdownWordWrap={markdownWordWrap}
        setMarkdownWordWrap={setMarkdownWordWrap}
        markdownTextHighlight={markdownTextHighlight}
        setMarkdownTextHighlight={setMarkdownTextHighlight}
        onApply={onApply}
        onSave={onSave}
        onSaveAs={onSaveAs}
        onExportWorkspaceFile={handleExportWorkspaceFile}
        onExportMarkdown={handleExportMarkdown}
        onExportHtmlViewer={handleExportHtmlViewer}
        onExportHtmlCanvas={handleExportHtmlCanvas}
        onExportJson={handleExportJson}
        onExportSvg={handleExportSvg}
        onExportPdf={handleExportPdf}
        applyStatus={statusLabel}
        applyDisabled={!isEditing || !String(activeDocumentKey || '').trim()}
        onToggleFullscreen={onToggleFullscreen}
        presentationApiRef={presentationApiRef}
        contentMode={contentMode}
        setContentMode={setContentMode}
        nodeQuickEditorAvailable={nodeQuickEditorAvailable}
        nodeQuickEditorFormat={nodeQuickEditorFormat}
        setNodeQuickEditorFormat={setNodeQuickEditorFormat}
        onCopyNodeQuickEditor={onCopyNodeQuickEditor}
        isEditing={isEditing}
        isMarkdown={isMarkdown}
        onFormatAction={onFormatAction}
        onImportLocalFiles={onImportLocalFiles}
        onImportLocalFolder={onImportLocalFolder}
        onImportUrl={onImportUrl}
        onImportWebsite={onImportWebsite}
        webpageSignalSummary={webpageSignalSummary}
        webpageWorkspaceMeta={webpageWorkspaceMeta}
        onWebpageChangeView={onWebpageChangeView}
        onWebpageUpdateMeta={onWebpageUpdateMeta}
        onWebpageSyncMarkdownFromDom={onWebpageSyncMarkdownFromDom}
      />

      {layoutMode === 'editor' ? (
        <MarkdownEditor
          value={typeof editorTextOverride === 'string' ? editorTextOverride : activeText}
          onChange={disableEditorMutations ? () => void 0 : setActiveText}
          wordWrap={markdownWordWrap}
          editorRef={editorRef}
          onCaretLine={onEditorCaretLine}
          panelTypography={panelTypography}
          readOnly={disableEditorMutations}
          themeMode={themeMode}
          language={editorLanguage}
          uri={editorUri}
          onEditorHandle={setEditorHandle}
        />
      ) : layoutMode === 'viewer' ? (
        viewer
      ) : layoutMode === 'presentation' ? (
        presentation
      ) : layoutMode === 'slides-gallery' ? (
        slidesGallery
      ) : (
        <section className="flex-1 min-h-0 flex" aria-label="Split view">
          <section className="flex-1 min-w-0 min-h-0 flex flex-col" aria-label="Editor">
            <MarkdownEditor
              value={typeof editorTextOverride === 'string' ? editorTextOverride : activeText}
              onChange={disableEditorMutations ? () => void 0 : setActiveText}
              wordWrap={markdownWordWrap}
              editorRef={editorRef}
              onCaretLine={onEditorCaretLine}
              panelTypography={panelTypography}
              readOnly={disableEditorMutations}
              themeMode={themeMode}
              language={editorLanguage}
              uri={editorUri}
              onEditorHandle={setEditorHandle}
            />
          </section>
          <hr className="w-px self-stretch bg-[color:var(--kg-border)] border-0" aria-hidden="true" />
          <section className="flex-1 min-w-0 min-h-0 flex flex-col" aria-label="Viewer">
            {viewer}
          </section>
        </section>
      )}
    </main>
  )
})
