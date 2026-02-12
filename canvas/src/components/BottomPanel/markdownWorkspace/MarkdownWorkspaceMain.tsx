import React from 'react'
import type { MarkdownWorkspaceLayoutMode } from '@/features/markdown-explorer/workspaceUi'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { usePanelTypography, type PanelTypography } from '@/lib/ui/panelTypography'
import { MarkdownWorkspaceToolbar } from '../MarkdownWorkspaceToolbar'
import type { MarkdownFormatAction } from 'grph-shared/markdown/formatting'
import type { HighlightedLineRange, MarkdownPresentationApi, MarkdownWorkspaceStatus } from './markdownWorkspaceTypes'
import { lexMarkdown, type TokenWithLines } from '@/features/markdown/ui/markdownPreviewLex'
import { MarkdownPreviewViewer } from '@/features/markdown/ui/MarkdownPreviewViewer'
import MarkdownPreview from '@/features/markdown/ui/MarkdownPreview'
import { splitMarkdownLines } from '@/lib/markdown'
import type { MarkdownGeoDatasetIntegration } from '@/features/markdown/ui/MarkdownRendererTypes'
import { parseWebpageFrontmatterMeta, parseWebsiteImportFrontmatterMeta } from '@/lib/markdown/frontmatter'
import {
  buildCodeViewerSrcdoc,
  buildWebpageHtmlSrcdoc,
  fetchWebpageHtmlViaProxy,
  fetchWebsiteImportArtifact,
} from '@/lib/websites/webpageIframeSrcdoc'

export type MarkdownWorkspaceMainProps = {
  themeMode: 'light' | 'dark'
  uiPanelTextFontClass: string
  uiPanelMonospaceTextClass: string
  geoDatasetIntegration?: MarkdownGeoDatasetIntegration

  layoutMode: MarkdownWorkspaceLayoutMode
  setLayoutMode: (mode: MarkdownWorkspaceLayoutMode) => void
  markdownWordWrap: boolean
  setMarkdownWordWrap: (next: boolean) => void
  markdownTextHighlight: boolean
  setMarkdownTextHighlight: (next: boolean) => void

  statusLabel: MarkdownWorkspaceStatus
  onApply: () => void
  onToggleFullscreen: () => void
  presentationApiRef: React.MutableRefObject<MarkdownPresentationApi | null>

  isEditing: boolean
  isMarkdown: boolean
  onFormatAction: (action: MarkdownFormatAction) => void
  onImportLocalFiles: (files: FileList | null) => void
  onImportLocalFolder: (files: FileList | null) => void
  onImportUrl: (url: string) => void
  onImportWebsite: (url: string) => void

  contentMode?: 'document' | 'nodeQuickEditor'
  setContentMode?: (mode: 'document' | 'nodeQuickEditor') => void
  nodeQuickEditorAvailable?: boolean
  nodeQuickEditorFormat?: 'json' | 'markdown'
  setNodeQuickEditorFormat?: (format: 'json' | 'markdown') => void
  onCopyNodeQuickEditor?: () => void

  activeText: string
  setActiveText: (next: string) => void
  editorTextOverride?: string | null
  disableEditorMutations?: boolean
  viewerTextOverride?: string | null
  disableViewerMutations?: boolean
  webpageHtmlIframeMode?: 'srcdoc' | 'src'
  activeDocumentKey: string
  highlightedLineRange: HighlightedLineRange
  revealLineInEditor: (line: number, endLine?: number) => void
  showInViewer: (line: number) => void
  showInPresentation: (line: number) => void
  showInSlidesGallery: (line: number) => void

  editorUri: string
  editorLanguage: string
  editorRef: React.MutableRefObject<HTMLTextAreaElement | null>
  onEditorCaretLine?: (line: number) => void
}

function sanitizeInvalidDataUrls(raw: string): string {
  const s = String(raw || '')
  if (!s.includes('data:image/') || !s.includes('<omitted>')) return s
  return s.replace(/data:image\/[a-zA-Z0-9.+-]+;base64,<omitted>/g, 'data:,')
}

import { useSyncScrollElements } from './useSyncScroll'

function clamp01(n: number) {
  if (n <= 0) return 0
  if (n >= 1) return 1
  return n
}

function getScrollRatio(el: HTMLElement) {
  const max = Math.max(1, el.scrollHeight - el.clientHeight)
  return clamp01(el.scrollTop / max)
}

function setScrollRatio(el: HTMLElement, ratio: number) {
  const max = Math.max(0, el.scrollHeight - el.clientHeight)
  el.scrollTop = Math.round(clamp01(ratio) * max)
}

function MarkdownEditor(props: {
  value: string
  onChange: (next: string) => void
  wordWrap: boolean
  editorRef: React.MutableRefObject<HTMLTextAreaElement | null>
  onCaretLine?: (line: number) => void
  panelTypography: PanelTypography
  readOnly?: boolean
  onEditorEl?: (el: HTMLTextAreaElement | null) => void
}) {
  const rafIdRef = React.useRef<number | null>(null)
  const lastSelectionStartRef = React.useRef<number | null>(null)

  const scheduleEmitCaretLine = React.useCallback(() => {
    const onCaretLine = props.onCaretLine
    if (!onCaretLine) return
    if (rafIdRef.current !== null) return
    rafIdRef.current = requestAnimationFrame(() => {
      rafIdRef.current = null
      const el = props.editorRef.current
      if (!el) return
      const offsetRaw = typeof el.selectionStart === 'number' ? el.selectionStart : 0
      const offset = Math.max(0, Math.floor(offsetRaw))
      if (lastSelectionStartRef.current === offset) return
      lastSelectionStartRef.current = offset
      const text = String(el.value || '')
      let line = 1
      for (let i = 0; i < offset && i < text.length; i += 1) {
        if (text.charCodeAt(i) === 10) line += 1
      }
      onCaretLine(line)
    })
  }, [props.editorRef, props.onCaretLine])

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
      <textarea
        ref={el => {
          props.editorRef.current = el
          props.onEditorEl?.(el)
        }}
        className={`flex-1 min-h-0 w-full resize-none box-border px-4 py-3 ${props.panelTypography.panelTextClass} leading-5 ${UI_THEME_TOKENS.input.bg} ${UI_THEME_TOKENS.text.primary} ${UI_THEME_TOKENS.input.border} border outline-none ${props.wordWrap ? 'whitespace-pre-wrap' : 'whitespace-pre'} overflow-auto`}
        value={props.value}
        onChange={e => props.onChange(e.target.value)}
        readOnly={!!props.readOnly}
        spellCheck={false}
        wrap={props.wordWrap ? 'soft' : 'off'}
        aria-label="Markdown Editor Text"
        onKeyUp={() => scheduleEmitCaretLine()}
        onClick={() => scheduleEmitCaretLine()}
        onSelect={() => scheduleEmitCaretLine()}
      />
    </section>
  )
}

function useWebpageIframeSrcdoc(args: {
  enabled: boolean
  url: string
  websiteImportMeta: { importId: string; nodeId: string; outputDirRel?: string } | null
}): { srcDoc: string | null; error: string | null } {
  const [state, setState] = React.useState<{ srcDoc: string | null; error: string | null }>({ srcDoc: null, error: null })

  React.useEffect(() => {
    if (!args.enabled) {
      setState({ srcDoc: null, error: null })
      return
    }
    const url = String(args.url || '').trim()
    if (!url) {
      setState({ srcDoc: null, error: null })
      return
    }

    let cancelled = false
    const ctrl = new AbortController()
    void (async () => {
      const raw = args.websiteImportMeta
        ? await fetchWebsiteImportArtifact({
            importId: args.websiteImportMeta.importId,
            nodeId: args.websiteImportMeta.nodeId,
            outputDirRel: args.websiteImportMeta.outputDirRel,
            kind: 'rawHtml',
            signal: ctrl.signal,
          })
        : await fetchWebpageHtmlViaProxy({ url, signal: ctrl.signal })
      return buildWebpageHtmlSrcdoc({ html: raw, baseHref: url })
    })()
      .then((srcDoc) => {
        if (cancelled) return
        setState({ srcDoc, error: null })
      })
      .catch((err) => {
        if (cancelled) return
        const msg = err && typeof err === 'object' && 'message' in err ? String((err as { message?: unknown }).message || '') : ''
        const fallback = buildCodeViewerSrcdoc({ baseHref: url, title: url, mode: 'wireframe', text: msg || 'Request failed' })
        setState({ srcDoc: fallback, error: msg || 'Request failed' })
      })

    return () => {
      cancelled = true
      try {
        ctrl.abort()
      } catch {
        void 0
      }
    }
  }, [args.enabled, args.url, args.websiteImportMeta?.importId, args.websiteImportMeta?.nodeId, args.websiteImportMeta?.outputDirRel])

  return state
}

export const MarkdownWorkspaceMain = React.memo(function MarkdownWorkspaceMain(props: MarkdownWorkspaceMainProps) {
  const panelTypography = usePanelTypography()
  const [editorEl, setEditorEl] = React.useState<HTMLTextAreaElement | null>(null)
  const [viewerEl, setViewerEl] = React.useState<HTMLElement | null>(null)
  const iframeRef = React.useRef<HTMLIFrameElement | null>(null)
  const {
    themeMode,
    uiPanelTextFontClass,
    uiPanelMonospaceTextClass,
    geoDatasetIntegration,
    layoutMode,
    setLayoutMode,
    markdownWordWrap,
    setMarkdownWordWrap,
    markdownTextHighlight,
    setMarkdownTextHighlight,
    statusLabel,
    onApply,
    onToggleFullscreen,
    presentationApiRef,
    isEditing,
    isMarkdown,
    onFormatAction,
    onImportLocalFiles,
    onImportLocalFolder,
    onImportUrl,
    onImportWebsite,
    contentMode,
    setContentMode,
    nodeQuickEditorAvailable,
    nodeQuickEditorFormat,
    setNodeQuickEditorFormat,
    onCopyNodeQuickEditor,
    activeText,
    setActiveText,
    editorTextOverride,
    disableEditorMutations,
    viewerTextOverride,
    disableViewerMutations,
    webpageHtmlIframeMode,
    activeDocumentKey,
    highlightedLineRange,
    revealLineInEditor,
    showInViewer,
    showInPresentation,
    showInSlidesGallery,
    editorRef,
    onEditorCaretLine,
  } = props
  const viewerRef = React.useRef<HTMLElement | null>(null)

  const viewerVisible = layoutMode === 'viewer' || layoutMode === 'split'
  const viewerTextRaw = typeof viewerTextOverride === 'string' ? viewerTextOverride : activeText
  const viewerText = React.useMemo(() => sanitizeInvalidDataUrls(viewerTextRaw), [viewerTextRaw])

  const webpageMeta = React.useMemo(() => parseWebpageFrontmatterMeta(activeText), [activeText])
  const websiteImportMeta = React.useMemo(() => parseWebsiteImportFrontmatterMeta(activeText), [activeText])
  const showWebpageHtml = !!(
    webpageMeta &&
    (webpageMeta.view === 'html' || webpageMeta.view === 'json' || webpageMeta.view === 'wireframe') &&
    webpageMeta.url
  )

  const iframeMode: 'srcdoc' | 'src' = webpageHtmlIframeMode === 'src' ? 'src' : 'srcdoc'
  const iframeSrcUrl = React.useMemo(() => {
    const u = String(webpageMeta?.url || '').trim()
    if (!u) return ''
    return `/__webpage_proxy?url=${encodeURIComponent(u)}`
  }, [webpageMeta?.url])
  const { srcDoc: iframeSrcDoc } = useWebpageIframeSrcdoc({
    enabled: showWebpageHtml && iframeMode === 'srcdoc',
    url: String(webpageMeta?.url || ''),
    websiteImportMeta: websiteImportMeta && websiteImportMeta.importId && websiteImportMeta.nodeId ? websiteImportMeta : null,
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
    if (!editorEl) return
    const handleScroll = () => {
      setSavedRatio(getScrollRatio(editorEl))
    }
    editorEl.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      editorEl.removeEventListener('scroll', handleScroll)
    }
  }, [editorEl, setSavedRatio])

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
      if (editorEl && layoutMode === 'editor') {
        setScrollRatio(editorEl, ratio)
      }
      return
    }
    const iframe = iframeRef.current
    if (!iframe) return
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
  }, [editorEl, getSavedRatio, layoutMode, showWebpageHtml, viewerEl])

  useSyncScrollElements(editorEl, viewerEl, layoutMode === 'split' && !showWebpageHtml)

  React.useEffect(() => {
    if (!showWebpageHtml) return
    const iframe = iframeRef.current
    if (!iframe) return

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
      if (!editorEl) return
      if (!canSync('editor')) return
      lockRef.owner = 'editor'
      lockRef.until = Date.now() + 180
      const ratio = getScrollRatio(editorEl)
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
      if (!editorEl) return
      if (layoutMode !== 'split') return
      if (!canSync('iframe')) return
      lockRef.owner = 'iframe'
      lockRef.until = Date.now() + 180
      setScrollRatio(editorEl, ratio)
    }

    if (layoutMode === 'split') {
      editorEl?.addEventListener('scroll', handleEditorScroll, { passive: true })
    }
    window.addEventListener('message', handleMessage)
    return () => {
      editorEl?.removeEventListener('scroll', handleEditorScroll)
      window.removeEventListener('message', handleMessage)
    }
  }, [editorEl, layoutMode, setSavedRatio, showWebpageHtml])

  React.useEffect(() => {
    if (layoutMode !== 'presentation') {
      presentationApiRef.current = null
    }
  }, [layoutMode, presentationApiRef])

  const lexed = React.useMemo(() => {
    if (!viewerVisible) return { tokens: [] as TokenWithLines[], startLineOffset: 0, meta: {} as never }
    if (showWebpageHtml) return { tokens: [] as TokenWithLines[], startLineOffset: 0, meta: {} as never }
    try {
      return lexMarkdown(viewerText)
    } catch {
      return { tokens: [] as TokenWithLines[], startLineOffset: 0, meta: {} as never }
    }
  }, [showWebpageHtml, viewerText, viewerVisible])

  const tokens = lexed.tokens
  void lexed.startLineOffset
  void lexed.meta

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
        ref={el => {
          iframeRef.current = el
        }}
        title={webpageMeta?.url || 'Webpage'}
        src={iframeMode === 'src' ? iframeSrcUrl : undefined}
        srcDoc={iframeMode === 'srcdoc' ? iframeSrcDoc || '' : undefined}
        sandbox="allow-scripts allow-forms allow-popups allow-downloads allow-modals allow-pointer-lock allow-presentation"
        referrerPolicy="no-referrer"
      />
    </section>
  ) : (
    <MarkdownPreviewViewer
      rootRef={el => {
        viewerRef.current = el
        setViewerEl(el)
      }}
      tokens={tokens}
      activeDocumentPath={activeDocumentKey}
      highlightedLineRange={highlightedLineRange}
      markdownWordWrap={markdownWordWrap}
      markdownTextHighlight={markdownTextHighlight}
      selectionKind={null}
      uiPanelTextFontClass={uiPanelTextFontClass}
      uiPanelMonospaceTextClass={uiPanelMonospaceTextClass}
      geoDatasetIntegration={geoDatasetIntegration}
      mermaidFrontmatterConfig={null}
      rootThemeMode={themeMode}
      previewOverlayScope="container"
      previewOverlayPortalTarget={null}
      effectiveHighlightBackgroundColor={null}
      effectiveHighlightUnderlineColor={null}
      scrollClass="overflow-auto"
      showSidebar={false}
      onContextMenu={() => void 0}
      onClick={() => void 0}
      onInsertLineAfter={handleInsertLineAfter}
      onReorderLineBlock={handleReorderLineBlock}
    />
  )

  const presentation = showWebpageHtml ? (
    <section className="flex-1 min-h-0 flex" aria-label="Webpage Presentation Surface">
      <iframe
        className="flex-1 min-h-0 w-full border-0"
        title={webpageMeta?.url || 'Webpage'}
        src={iframeMode === 'src' ? iframeSrcUrl : undefined}
        srcDoc={iframeMode === 'srcdoc' ? iframeSrcDoc || '' : undefined}
        sandbox="allow-scripts allow-forms allow-popups allow-downloads allow-modals allow-pointer-lock allow-presentation"
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
        src={iframeMode === 'src' ? iframeSrcUrl : undefined}
        srcDoc={iframeMode === 'srcdoc' ? iframeSrcDoc || '' : undefined}
        sandbox="allow-scripts allow-forms allow-popups allow-downloads allow-modals allow-pointer-lock allow-presentation"
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
        layoutMode={layoutMode}
        setLayoutMode={setLayoutMode}
        markdownWordWrap={markdownWordWrap}
        setMarkdownWordWrap={setMarkdownWordWrap}
        markdownTextHighlight={markdownTextHighlight}
        setMarkdownTextHighlight={setMarkdownTextHighlight}
        onApply={onApply}
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
          onEditorEl={setEditorEl}
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
              onEditorEl={setEditorEl}
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
