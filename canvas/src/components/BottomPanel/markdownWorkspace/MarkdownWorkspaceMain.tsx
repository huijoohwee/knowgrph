import React from 'react'
import MarkdownIt from 'markdown-it'
import anchor from 'markdown-it-anchor'
import footnote from 'markdown-it-footnote'
import mark from 'markdown-it-mark'
import sub from 'markdown-it-sub'
import sup from 'markdown-it-sup'
import hljs from 'highlight.js'
import type { MarkdownWorkspaceLayoutMode } from '@/features/markdown-explorer/workspaceUi'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { usePanelTypography, type PanelTypography } from '@/lib/ui/panelTypography'
import { MarkdownWorkspaceToolbar } from '../MarkdownWorkspaceToolbar'
import type { MarkdownFormatAction } from 'grph-shared/markdown/formatting'
import type { HighlightedLineRange, MarkdownPresentationApi } from './markdownWorkspaceTypes'
import { lexMarkdown, type TokenWithLines } from '@/features/markdown/ui/markdownPreviewLex'
import { MarkdownPreviewViewer } from '@/features/markdown/ui/MarkdownPreviewViewer'
import { splitMarkdownLines } from '@/lib/markdown'

export type MarkdownWorkspaceMainProps = {
  themeMode: 'light' | 'dark'
  uiPanelTextFontClass: string
  uiPanelMonospaceTextClass: string

  layoutMode: MarkdownWorkspaceLayoutMode
  setLayoutMode: (mode: MarkdownWorkspaceLayoutMode) => void
  markdownWordWrap: boolean
  setMarkdownWordWrap: (next: boolean) => void
  markdownTextHighlight: boolean
  setMarkdownTextHighlight: (next: boolean) => void

  statusLabel: string
  onApply: () => void
  onToggleFullscreen: () => void
  presentationApiRef: React.MutableRefObject<MarkdownPresentationApi | null>

  isEditing: boolean
  isMarkdown: boolean
  onFormatAction: (action: MarkdownFormatAction) => void
  onImportLocalFiles: (files: FileList | null) => void
  onImportLocalFolder: (files: FileList | null) => void
  onImportUrl: (url: string) => void

  contentMode?: 'document' | 'nodeQuickEditor'
  setContentMode?: (mode: 'document' | 'nodeQuickEditor') => void
  nodeQuickEditorAvailable?: boolean
  nodeQuickEditorFormat?: 'json' | 'markdown'
  setNodeQuickEditorFormat?: (format: 'json' | 'markdown') => void
  onCopyNodeQuickEditor?: () => void

  activeText: string
  setActiveText: (next: string) => void
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
  editorRef: React.MutableRefObject<HTMLTextAreaElement | null>
  onEditorCaretLine?: (line: number) => void
}

const md = (() => {
  const instance = new MarkdownIt({
    html: true,
    linkify: true,
    highlight: (code, lang) => {
      const raw = String(code || '')
      const language = String(lang || '').trim().toLowerCase()
      if (language && hljs.getLanguage(language)) {
        try {
          return hljs.highlight(raw, { language }).value
        } catch {
          return ''
        }
      }
      try {
        return hljs.highlightAuto(raw).value
      } catch {
        return ''
      }
    },
  })
  try {
    instance.use(anchor)
    instance.use(footnote)
    instance.use(mark)
    instance.use(sub)
    instance.use(sup)
  } catch {
    void 0
  }
  return instance
})()

type Slide = { index: number; markdown: string }

const splitSlides = (raw: string): Slide[] => {
  const text = String(raw || '')
  if (!text.trim()) return [{ index: 0, markdown: '' }]
  const lines = text.split('\n')
  const slides: Slide[] = []
  let buf: string[] = []
  const flush = () => {
    slides.push({ index: slides.length, markdown: buf.join('\n').trim() })
    buf = []
  }
  for (let i = 0; i < lines.length; i += 1) {
    const line = String(lines[i] || '')
    if (line.trim() === '---') {
      flush()
      continue
    }
    buf.push(line)
  }
  flush()
  return slides.length ? slides : [{ index: 0, markdown: '' }]
}

import { useSyncScroll } from './useSyncScroll'

function MarkdownEditor(props: {
  value: string
  onChange: (next: string) => void
  wordWrap: boolean
  editorRef: React.MutableRefObject<HTMLTextAreaElement | null>
  onCaretLine?: (line: number) => void
  panelTypography: PanelTypography
}) {
  const emitCaretLine = React.useCallback(() => {
    const onCaretLine = props.onCaretLine
    if (!onCaretLine) return
    const el = props.editorRef.current
    if (!el) return
    const offsetRaw = typeof el.selectionStart === 'number' ? el.selectionStart : 0
    const offset = Math.max(0, Math.floor(offsetRaw))
    const text = String(el.value || '')
    let line = 1
    for (let i = 0; i < offset && i < text.length; i += 1) {
      if (text.charCodeAt(i) === 10) line += 1
    }
    onCaretLine(line)
  }, [props.editorRef, props.onCaretLine])

  return (
    <section className="flex-1 min-h-0 overflow-hidden flex flex-col" aria-label="Markdown Editor">
      <textarea
        ref={el => {
          props.editorRef.current = el
        }}
        className={`flex-1 min-h-0 w-full resize-none box-border px-4 py-3 ${props.panelTypography.panelTextClass} leading-5 ${UI_THEME_TOKENS.input.bg} ${UI_THEME_TOKENS.text.primary} ${UI_THEME_TOKENS.input.border} border outline-none ${props.wordWrap ? 'whitespace-pre-wrap' : 'whitespace-pre'} overflow-auto`}
        value={props.value}
        onChange={e => props.onChange(e.target.value)}
        spellCheck={false}
        wrap={props.wordWrap ? 'soft' : 'off'}
        aria-label="Markdown Editor Text"
        onKeyUp={() => emitCaretLine()}
        onClick={() => emitCaretLine()}
        onSelect={() => emitCaretLine()}
      />
    </section>
  )
}

function SlideCanvas(props: { html: string; scale: number; zoomLabel: string; panelTypography: PanelTypography }) {
  const scale = Number.isFinite(props.scale) && props.scale > 0 ? props.scale : 0.05
  return (
    <section className="w-full h-full flex items-center justify-center" aria-label="Slide Canvas Frame">
      <section
        className={`relative overflow-hidden rounded border ${UI_THEME_TOKENS.panel.border} shadow ${UI_THEME_TOKENS.panel.bg} text-[color:var(--kg-text-primary)] ${props.panelTypography.fontClass}`}
        style={{ width: 1920 * scale, height: 1080 * scale, touchAction: 'none' }}
        aria-label="Slide Canvas Preview"
      >
        <section className="w-full h-full flex items-center justify-center" aria-label="Slide Canvas Center">
          <section
            style={{ transform: `translate(0px, 0px) scale(${scale})`, transformOrigin: 'center center', willChange: 'transform' }}
            aria-label="Slide Canvas Scaled"
          >
            <section aria-label="Slide Canvas" style={{ width: 1920, height: 1080 }}>
              <article className="w-full h-full" aria-label="Slide Document">
                <section className="w-full h-full relative pb-14" aria-label="Slide Document Frame">
                  <section className="w-full h-full flex flex-col relative" aria-label="Slide Body">
                    <main className="flex-1 min-h-0 w-full px-16 py-12 overflow-y-auto pb-16" aria-label="Slide Content">
                      <article className="w-full" dangerouslySetInnerHTML={{ __html: props.html }} />
                    </main>
                  </section>
                </section>
              </article>
            </section>
          </section>
        </section>
        <output className={`absolute right-2 bottom-2 rounded bg-black/60 text-white px-1.5 py-0.5 pointer-events-none ${props.panelTypography.microLabelClass}`} aria-label="Slide zoom">
          {props.zoomLabel}
        </output>
      </section>
    </section>
  )
}

export const MarkdownWorkspaceMain = React.memo(function MarkdownWorkspaceMain(props: MarkdownWorkspaceMainProps) {
  const panelTypography = usePanelTypography()
  const {
    themeMode,
    uiPanelTextFontClass,
    uiPanelMonospaceTextClass,
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
    contentMode,
    setContentMode,
    nodeQuickEditorAvailable,
    nodeQuickEditorFormat,
    setNodeQuickEditorFormat,
    onCopyNodeQuickEditor,
    activeText,
    setActiveText,
    viewerTextOverride,
    disableViewerMutations,
    activeDocumentKey,
    highlightedLineRange,
    revealLineInEditor,
    editorRef,
    onEditorCaretLine,
  } = props

  const slides = React.useMemo(() => splitSlides(activeText), [activeText])
  const [slideIndex, setSlideIndex] = React.useState(0)
  const activeSlide = slides[Math.min(slides.length - 1, Math.max(0, slideIndex))] || { index: 0, markdown: '' }
  const slideHtml = React.useMemo(() => md.render(String(activeSlide.markdown || '')), [activeSlide.markdown])
  const slideCanvasOuterRef = React.useRef<HTMLElement | null>(null)
  const [scale, setScale] = React.useState(0.05)
  const viewerRef = React.useRef<HTMLElement | null>(null)

  useSyncScroll(editorRef, viewerRef, layoutMode === 'split')

  React.useEffect(() => {
    if (layoutMode !== 'presentation') {
      presentationApiRef.current = null
      return
    }
    const api: MarkdownPresentationApi = {
      prev: () => setSlideIndex(i => Math.max(0, i - 1)),
      next: () => setSlideIndex(i => Math.min(slides.length - 1, i + 1)),
    }
    presentationApiRef.current = api
    return () => {
      if (presentationApiRef.current === api) presentationApiRef.current = null
    }
  }, [layoutMode, presentationApiRef, slides.length])

  React.useEffect(() => {
    setSlideIndex(i => Math.min(Math.max(0, i), Math.max(0, slides.length - 1)))
  }, [slides.length])

  React.useEffect(() => {
    const el = slideCanvasOuterRef.current
    if (!el) return
    const w = window as unknown as { ResizeObserver?: unknown }
    if (typeof w.ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => {
      const rect = el.getBoundingClientRect()
      const next = Math.max(0.02, Math.min(1, Math.min(rect.width / 1920, rect.height / 1080)))
      setScale(next)
    })
    ro.observe(el)
    return () => {
      try {
        ro.disconnect()
      } catch {
        void 0
      }
    }
  }, [])

  const zoomLabel = `${Math.round(scale * 100)}%`

  const viewerVisible = layoutMode === 'viewer' || layoutMode === 'split'
  const viewerText = typeof viewerTextOverride === 'string' ? viewerTextOverride : activeText

  const lexed = React.useMemo(() => {
    if (!viewerVisible) return { tokens: [] as TokenWithLines[], startLineOffset: 0, meta: {} as never }
    try {
      return lexMarkdown(viewerText)
    } catch {
      return { tokens: [] as TokenWithLines[], startLineOffset: 0, meta: {} as never }
    }
  }, [viewerText, viewerVisible])

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

  const viewer = (
    <MarkdownPreviewViewer
      rootRef={el => {
        viewerRef.current = el
      }}
      tokens={tokens}
      activeDocumentPath={activeDocumentKey}
      highlightedLineRange={highlightedLineRange}
      markdownWordWrap={markdownWordWrap}
      markdownTextHighlight={markdownTextHighlight}
      selectionKind={null}
      uiPanelTextFontClass={uiPanelTextFontClass}
      uiPanelMonospaceTextClass={uiPanelMonospaceTextClass}
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
        applyStatusLabel={statusLabel}
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
      />

      {layoutMode === 'editor' ? (
        <MarkdownEditor
          value={activeText}
          onChange={setActiveText}
          wordWrap={markdownWordWrap}
          editorRef={editorRef}
          onCaretLine={onEditorCaretLine}
          panelTypography={panelTypography}
        />
      ) : layoutMode === 'viewer' ? (
        viewer
      ) : layoutMode === 'presentation' ? (
        <main className="flex-1 min-h-0 flex flex-col items-center justify-center p-4" aria-label="Presentation Surface">
          <section
            ref={el => {
              slideCanvasOuterRef.current = el
            }}
            className="w-full h-full flex flex-col"
            aria-label="Presentation Viewport"
          >
            <SlideCanvas html={slideHtml} scale={scale} zoomLabel={zoomLabel} panelTypography={panelTypography} />
            <footer className="mt-3 w-full max-w-4xl" aria-label="Presentation footer">
              <output className={`${panelTypography.microLabelClass} ${UI_THEME_TOKENS.text.secondary}`} aria-label="Slide index">
                Slide {Math.min(slides.length, slideIndex + 1)} / {Math.max(1, slides.length)}
              </output>
            </footer>
          </section>
        </main>
      ) : layoutMode === 'slides-gallery' ? (
        <main className="flex-1 min-h-0 overflow-auto p-4" aria-label="Slides Gallery">
          <header className="max-w-5xl mx-auto w-full" aria-label="Slides Gallery header">
            <h3 className={`font-semibold ${UI_THEME_TOKENS.text.primary} ${panelTypography.panelTextClass}`}>Slides</h3>
            <p className={`${panelTypography.microLabelClass} ${UI_THEME_TOKENS.text.secondary}`}>Click a slide to open presentation.</p>
          </header>
          <section className="max-w-5xl mx-auto w-full mt-3" aria-label="Slides Gallery grid">
            <ul className="grid grid-cols-3 gap-3 list-none m-0 p-0" aria-label="Slides list">
              {slides.map(s => {
                const thumbHtml = md.render(String(s.markdown || ''))
                return (
                  <li key={s.index} className="list-none">
                    <button
                      type="button"
                      className={`w-full text-left rounded border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} overflow-hidden`}
                      aria-label={`Open slide ${s.index + 1}`}
                      onClick={() => {
                        setSlideIndex(s.index)
                        setLayoutMode('presentation')
                      }}
                    >
                      <section className="w-full aspect-video" aria-label={`Slide ${s.index + 1} thumbnail`}>
                        <article className="w-full h-full overflow-hidden" aria-label="Slide thumbnail body">
                          <section className="w-full h-full px-4 py-3" dangerouslySetInnerHTML={{ __html: thumbHtml }} />
                        </article>
                      </section>
                      <footer className="px-3 py-2 border-t border-[color:var(--kg-border)]" aria-label="Slide thumbnail footer">
                        <span className={`${panelTypography.microLabelClass} ${UI_THEME_TOKENS.text.secondary}`}>Slide {s.index + 1}</span>
                      </footer>
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        </main>
      ) : (
        <section className="flex-1 min-h-0 flex" aria-label="Split view">
          <section className="flex-1 min-w-0 min-h-0 flex flex-col" aria-label="Editor">
            <MarkdownEditor
              value={activeText}
              onChange={setActiveText}
              wordWrap={markdownWordWrap}
              editorRef={editorRef}
              onCaretLine={onEditorCaretLine}
              panelTypography={panelTypography}
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
