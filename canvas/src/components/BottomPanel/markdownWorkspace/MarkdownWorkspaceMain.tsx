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
import { exportGraphAsJSON, saveGraphFile, type DatasetPath } from '@/lib/graph/file'
import { printElementToPdf } from '@/lib/print/printElementToPdf'

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
    next = next.replace(/\(\s*`(https?:\/\/[^`]+?)`\s*\)?/g, (_m, url) => {
      const u = cleanUrl(url)
      if (!u) return _m
      return `([source](<${u}>))`
    })
    next = next.replace(/\(\s*(https?:\/\/[^\s)]+)\s*\)/g, (_m, url) => {
      const u = cleanUrl(url)
      if (!u) return _m
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

  const viewerVisible = layoutMode === 'viewer' || layoutMode === 'split'

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

  const handleExportJson = React.useCallback(async () => {
    const data = graphData as unknown
    if (!data) {
      pushUiToast({ id: 'export-json-missing-graph', kind: 'warning', message: 'No graph to export.' })
      return
    }
    await exportGraphAsJSON(data as never, `${exportBaseName}.json` as unknown as DatasetPath)
  }, [exportBaseName, graphData, pushUiToast])

  const handleExportJsonLd = React.useCallback(async () => {
    const data = graphData as unknown
    if (!data) {
      pushUiToast({ id: 'export-jsonld-missing-graph', kind: 'warning', message: 'No graph to export.' })
      return
    }
    await saveGraphFile(data as never, `${exportBaseName}.jsonld` as unknown as DatasetPath)
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
        onExportMarkdown={handleExportMarkdown}
        onExportJson={handleExportJson}
        onExportJsonLd={handleExportJsonLd}
        onExportPdf={handleExportPdf}
        applyStatus={statusLabel}
        applyDisabled={!isEditing}
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
