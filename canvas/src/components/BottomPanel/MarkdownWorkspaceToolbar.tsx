import React from 'react'
import {
  Columns,
  Code,
  Edit3,
  Eye,
  LayoutGrid,
  LayoutPanelTop,
  Copy,
  Maximize2,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Quote,
} from 'lucide-react'
import type { MarkdownWorkspaceLayoutMode } from '@/features/markdown-explorer/workspaceUi'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { WorkspaceHeader, WorkspaceHeaderRow } from '@/components/ui/WorkspaceHeader'
import IconButton from '@/components/IconButton'
import { CollapsibleToolbar } from '@/components/ui/CollapsibleToolbar'
import type { MarkdownFormatAction } from 'grph-shared/markdown/formatting'
import type { MarkdownPresentationApi } from './markdownWorkspace/markdownWorkspaceTypes'
import { usePanelTypography } from '@/lib/ui/panelTypography'
import { WorkspaceModeSelect } from './markdownWorkspace/WorkspaceModeSelect'
import type { WebpageFrontmatterMeta, WebpageViewMode } from '@/lib/markdown/frontmatter'
import { useGraphStore } from '@/hooks/useGraphStore'
import { UI_LABELS } from '@/lib/config'
import { UI_TEXT_TRUNCATE } from '@/lib/ui/textLayout'
import {
  MarkdownWorkspaceDisplayMenu,
  MarkdownWorkspaceFormattingMenu,
  MarkdownWorkspacePresentationNavMenu,
} from '@/components/BottomPanel/MarkdownWorkspaceToolbarInlineMenus'

export type MarkdownWorkspaceToolbarProps = {
  explorerOpen: boolean
  setExplorerOpen: (next: boolean) => void

  canvasOpen?: boolean
  setCanvasOpen?: (next: boolean) => void

  layoutMode: MarkdownWorkspaceLayoutMode
  setLayoutMode: (mode: MarkdownWorkspaceLayoutMode) => void
  markdownWordWrap: boolean
  setMarkdownWordWrap: (next: boolean) => void
  markdownTextHighlight: boolean
  setMarkdownTextHighlight: (next: boolean) => void

  viewerKind?: 'markdown' | 'html'
  setViewerKind?: (next: 'markdown' | 'html') => void
  viewerMode?: 'read' | 'kanban' | 'table'
  setViewerMode?: (next: 'read' | 'kanban' | 'table') => void
  onSaveAs?: () => void
  onExportWorkspaceFile?: () => void
  onExportMarkdown?: () => void
  onExportHtmlViewer?: () => void
  onExportHtmlCanvas?: () => void
  onExportJson?: () => void
  onExportSvg?: () => void
  onExportPdf?: () => void
  onToggleFullscreen: () => void
  presentationApiRef: React.MutableRefObject<MarkdownPresentationApi | null>

  contentMode?: 'document' | 'nodeQuickEditor'
  setContentMode?: (mode: 'document' | 'nodeQuickEditor') => void
  nodeQuickEditorAvailable?: boolean
  nodeQuickEditorFormat?: 'json' | 'markdown'
  setNodeQuickEditorFormat?: (format: 'json' | 'markdown') => void
  onCopyNodeQuickEditor?: () => void

  isEditing: boolean
  isMarkdown: boolean
  onFormatAction: (action: MarkdownFormatAction) => void

  webpageSignalSummary?: {
    nav: number
    cta: number
    price: number
    time: number
  } | null

  webpageWorkspaceMeta?: WebpageFrontmatterMeta | null
  onWebpageChangeView?: (view: WebpageViewMode) => void
  onWebpageUpdateMeta?: (patch: { fidelityLevel?: 1 | 2 | 3 | 4 }) => void
}

const TOOLBAR_BUTTON_CLASSNAME = `kg-toolbar-btn inline-flex items-center justify-center rounded ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`

export function MarkdownWorkspaceToolbar({
  explorerOpen,
  setExplorerOpen,
  canvasOpen,
  setCanvasOpen,
  layoutMode,
  setLayoutMode,
  markdownWordWrap,
  setMarkdownWordWrap,
  markdownTextHighlight,
  setMarkdownTextHighlight,
  viewerKind,
  setViewerKind,
  viewerMode,
  setViewerMode,
  onSaveAs,
  onExportWorkspaceFile,
  onExportMarkdown,
  onExportHtmlViewer,
  onExportHtmlCanvas,
  onExportJson,
  onExportSvg,
  onExportPdf,
  onToggleFullscreen,
  presentationApiRef,
  contentMode = 'document',
  setContentMode,
  nodeQuickEditorAvailable,
  nodeQuickEditorFormat = 'json',
  setNodeQuickEditorFormat,
  onCopyNodeQuickEditor,
  isEditing,
  isMarkdown,
  onFormatAction,
  webpageSignalSummary,
  webpageWorkspaceMeta,
  onWebpageChangeView,
  onWebpageUpdateMeta,
}: MarkdownWorkspaceToolbarProps) {
  const panelTypography = usePanelTypography()
  const setWorkspaceViewMode = useGraphStore(s => s.setWorkspaceViewMode)
  const canNavigateSlides = layoutMode === 'presentation'

  const saveAsWrapRef = React.useRef<HTMLLIElement | null>(null)
  const [saveAsOpen, setSaveAsOpen] = React.useState(false)
  const canExport = !!(
    onSaveAs ||
    onExportWorkspaceFile ||
    onExportMarkdown ||
    onExportHtmlViewer ||
    onExportHtmlCanvas ||
    onExportJson ||
    onExportSvg ||
    onExportPdf
  )

  React.useEffect(() => {
    if (!saveAsOpen) return
    const onDown = (event: MouseEvent | TouchEvent) => {
      try {
        const target = event.target as Node | null
        const wrap = saveAsWrapRef.current
        if (!wrap || !target) return
        if (wrap.contains(target)) return
        setSaveAsOpen(false)
      } catch {
        void 0
      }
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSaveAsOpen(false)
    }
    document.addEventListener('mousedown', onDown, true)
    document.addEventListener('touchstart', onDown, true)
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('mousedown', onDown, true)
      document.removeEventListener('touchstart', onDown, true)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [saveAsOpen])

  const webpageControls = React.useMemo(() => {
    const meta = webpageWorkspaceMeta
    if (!meta || !meta.url) return null
    const view = meta.view
    const fidelityMode: 'inherit' | '1' | '2' | '3' | '4' =
      meta.fidelityLevel === 1
        ? '1'
        : meta.fidelityLevel === 2
          ? '2'
          : meta.fidelityLevel === 3
            ? '3'
            : meta.fidelityLevel === 4
              ? '4'
              : 'inherit'
    return { view, fidelityMode }
  }, [webpageWorkspaceMeta])

  const webpageSignalsNode = React.useMemo(() => {
    const s = webpageSignalSummary
    if (!s) return null
    const allItems: Array<{ label: string; value: number; tone: 'nav' | 'cta' | 'price' | 'time' }> = [
      { label: 'NAV', value: s.nav, tone: 'nav' },
      { label: 'CTA', value: s.cta, tone: 'cta' },
      { label: 'PRICE', value: s.price, tone: 'price' },
      { label: 'TIME', value: s.time, tone: 'time' },
    ]
    const items = allItems.filter(it => it.value > 0)
    if (!items.length) return null

    const pillClass = `inline-flex items-center gap-1 h-6 rounded-full border px-2 ${panelTypography.microLabelClass}`
    const toneClass = (tone: 'nav' | 'cta' | 'price' | 'time') => {
      if (tone === 'cta') return 'border-emerald-200 bg-emerald-50 text-emerald-700'
      if (tone === 'nav') return 'border-blue-200 bg-blue-50 text-blue-700'
      if (tone === 'price') return 'border-amber-200 bg-amber-50 text-amber-700'
      if (tone === 'time') return 'border-violet-200 bg-violet-50 text-violet-700'
      return `${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.text.secondary}`
    }

    return (
      <span
        className="ml-2 inline-flex gap-1 flex-wrap"
        aria-label="Webpage signals"
        title="Derived from the current markdown: link labels (NAV/CTA) plus detected price/time tokens."
      >
        {items.map(it => (
          <span key={it.label} className={`${pillClass} ${toneClass(it.tone)}`}>
            <span className="font-semibold">[{it.label}]</span>
            <span>{it.value}</span>
          </span>
        ))}
      </span>
    )
  }, [panelTypography.microLabelClass, webpageSignalSummary])


  return (
    <WorkspaceHeader ariaLabel="Markdown Toolbar" border="border">
      <WorkspaceHeaderRow className="gap-2 kg-toolbar" ariaLabel="Markdown toolbar row">
        <span className="min-w-0">
          <span className={`${panelTypography.microLabelClass} uppercase tracking-wide font-semibold ${UI_THEME_TOKENS.text.secondary} ${UI_TEXT_TRUNCATE}`}>Workspace editor</span>
          {webpageSignalsNode}
        </span>
        <CollapsibleToolbar className="kg-toolbar flex items-center gap-1 justify-end" ariaLabel="Markdown view controls">
          <IconButton
            title={explorerOpen ? 'Hide Explorer' : 'Show Explorer'}
            onClick={() => setExplorerOpen(!explorerOpen)}
            className={UI_THEME_TOKENS.button.square}
            showTooltip={false}
          >
            {explorerOpen ? <PanelLeftClose className="w-4 h-4" aria-hidden="true" /> : <PanelLeftOpen className="w-4 h-4" aria-hidden="true" />}
          </IconButton>
          {typeof canvasOpen === 'boolean' && typeof setCanvasOpen === 'function' ? (
            <IconButton
              title={canvasOpen ? 'Hide Canvas' : 'Show Canvas'}
              onClick={() => setCanvasOpen(!canvasOpen)}
              className={UI_THEME_TOKENS.button.square}
              showTooltip={false}
            >
              {canvasOpen ? <PanelRightClose className="w-4 h-4" aria-hidden="true" /> : <PanelRightOpen className="w-4 h-4" aria-hidden="true" />}
            </IconButton>
          ) : null}
          {webpageControls && onWebpageChangeView && onWebpageUpdateMeta ? (
            <menu className="flex items-center gap-1 list-none m-0 p-0" aria-label="Webpage">
            <li className="list-none">
              <WorkspaceModeSelect<WebpageViewMode>
                ariaLabel="Webpage view mode"
                value={webpageControls.view}
                isActive={true}
                options={[
                  { value: 'markdown', label: 'Markdown' },
                  { value: 'html', label: 'HTML' },
                  { value: 'json', label: 'JSON' },
                ]}
                onChange={next => onWebpageChangeView(next)}
              />
            </li>
            <li className="list-none">
              <WorkspaceModeSelect<'inherit' | '1' | '2' | '3' | '4'>
                ariaLabel="Webpage fidelity level"
                value={webpageControls.fidelityMode}
                isActive={true}
                options={[
                  { value: 'inherit', label: 'Fid: Auto' },
                  { value: '1', label: 'Fid: 1' },
                  { value: '2', label: 'Fid: 2' },
                  { value: '3', label: 'Fid: 3' },
                  { value: '4', label: 'Fid: 4' },
                ]}
                onChange={next => {
                  const level = next === 'inherit' ? undefined : (Number.parseInt(next, 10) as 1 | 2 | 3 | 4)
                  onWebpageUpdateMeta({ fidelityLevel: level })
                }}
              />
            </li>
          </menu>
        ) : null}

        {!webpageControls && viewerKind && setViewerKind ? (
          <menu className="flex items-center gap-1 list-none m-0 p-0" aria-label="Derived views">
            <li className="list-none">
              <WorkspaceModeSelect<'markdown' | 'html'>
                ariaLabel="Viewer content"
                value={viewerKind}
                options={[
                  { value: 'markdown', label: 'Markdown' },
                  { value: 'html', label: 'HTML' },
                ]}
                onChange={setViewerKind}
              />
            </li>
          </menu>
        ) : null}
        {typeof setContentMode === 'function' ? (
          <menu className="flex items-center gap-1 list-none m-0 p-0" aria-label="Content">
            <li className="list-none">
              <button
                type="button"
                className={TOOLBAR_BUTTON_CLASSNAME}
                aria-pressed={contentMode === 'document'}
                title="Document"
                onClick={() => setContentMode('document')}
              >
                <Edit3 className="w-4 h-4" strokeWidth={1.6} />
              </button>
            </li>
            <li className="list-none">
              <button
                type="button"
                className={TOOLBAR_BUTTON_CLASSNAME}
                aria-pressed={contentMode === 'nodeQuickEditor'}
                title="Node Quick Editor"
                disabled={!nodeQuickEditorAvailable}
                onClick={() => {
                  if (!nodeQuickEditorAvailable) return
                  setContentMode('nodeQuickEditor')
                }}
              >
                <Code className="w-4 h-4" strokeWidth={1.6} />
              </button>
            </li>
            </menu>
          ) : null}
        {contentMode === 'nodeQuickEditor' ? (
          <menu className="flex items-center gap-1 list-none m-0 p-0" aria-label="Node Quick Editor format">
            <li className="list-none">
              <button
                type="button"
                className={TOOLBAR_BUTTON_CLASSNAME}
                aria-pressed={nodeQuickEditorFormat === 'json'}
                title="JSON"
                onClick={() => setNodeQuickEditorFormat?.('json')}
              >
                <span className={panelTypography.microLabelClass}>JSON</span>
              </button>
            </li>
            <li className="list-none">
              <button
                type="button"
                className={TOOLBAR_BUTTON_CLASSNAME}
                aria-pressed={nodeQuickEditorFormat === 'markdown'}
                title="Markdown"
                onClick={() => setNodeQuickEditorFormat?.('markdown')}
              >
                <span className={panelTypography.microLabelClass}>MD</span>
              </button>
            </li>
            <li className="list-none">
              <button
                type="button"
                className={TOOLBAR_BUTTON_CLASSNAME}
                title="Copy"
                onClick={() => onCopyNodeQuickEditor?.()}
              >
                <span className={panelTypography.microLabelClass}>Copy</span>
              </button>
            </li>
          </menu>
        ) : null}
        <menu className="flex items-center gap-1 list-none m-0 p-0" aria-label="Layout mode">
          <li className="list-none">
            <button
              type="button"
              className={TOOLBAR_BUTTON_CLASSNAME}
              aria-pressed={layoutMode === 'split'}
              title="Split"
              onClick={() => setLayoutMode('split')}
            >
              <Columns className="w-4 h-4" strokeWidth={1.6} />
            </button>
          </li>
          <li className="list-none">
            <button
              type="button"
              className={TOOLBAR_BUTTON_CLASSNAME}
              aria-pressed={layoutMode === 'editor'}
              title="Editor"
              onClick={() => setLayoutMode('editor')}
            >
              <Edit3 className="w-4 h-4" strokeWidth={1.6} />
            </button>
          </li>
          <li className="list-none">
            <button
              type="button"
              className={TOOLBAR_BUTTON_CLASSNAME}
              aria-pressed={layoutMode === 'viewer'}
              title="Viewer"
              onClick={() => setLayoutMode('viewer')}
            >
              <Eye className="w-4 h-4" strokeWidth={1.6} />
            </button>
          </li>
          <li className="list-none">
            <button
              type="button"
              className={TOOLBAR_BUTTON_CLASSNAME}
              aria-pressed={layoutMode === 'presentation'}
              title="Presentation"
              onClick={() => setLayoutMode('presentation')}
            >
              <LayoutPanelTop className="w-4 h-4" strokeWidth={1.6} />
            </button>
          </li>
          <li className="list-none">
            <button
              type="button"
              className={TOOLBAR_BUTTON_CLASSNAME}
              aria-pressed={layoutMode === 'slides-gallery'}
              title="Slides Gallery"
              onClick={() => setLayoutMode('slides-gallery')}
            >
              <LayoutGrid className="w-4 h-4" strokeWidth={1.6} />
            </button>
          </li>
        </menu>
        <MarkdownWorkspacePresentationNavMenu
          canNavigateSlides={canNavigateSlides}
          toolbarButtonClassName={TOOLBAR_BUTTON_CLASSNAME}
          presentationApiRef={presentationApiRef}
        />
        <MarkdownWorkspaceFormattingMenu
          toolbarButtonClassName={TOOLBAR_BUTTON_CLASSNAME}
          isEditing={isEditing}
          isMarkdown={isMarkdown}
          onFormatAction={onFormatAction}
        />
        <MarkdownWorkspaceDisplayMenu
          toolbarButtonClassName={TOOLBAR_BUTTON_CLASSNAME}
          markdownTextHighlight={markdownTextHighlight}
          setMarkdownTextHighlight={setMarkdownTextHighlight}
          markdownWordWrap={markdownWordWrap}
          setMarkdownWordWrap={setMarkdownWordWrap}
        />
        <menu className="flex items-center gap-1 list-none m-0 p-0" aria-label="Actions">
          <li
            ref={el => {
              saveAsWrapRef.current = el
            }}
            className="list-none relative"
          >
            <button
              type="button"
              className={TOOLBAR_BUTTON_CLASSNAME}
              title="Export"
              aria-label="Export"
              onClick={() => setSaveAsOpen(v => !v)}
              disabled={!canExport}
            >
              <Copy className="w-4 h-4" strokeWidth={1.6} />
            </button>
            {saveAsOpen ? (
              <div
                className={`absolute right-0 top-full mt-1 z-[300] min-w-[220px] rounded border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} shadow-lg p-1`}
                role="menu"
                aria-label="Export menu"
              >
                {onSaveAs ? (
                  <button
                    type="button"
                    className={`w-full text-left px-2 py-1.5 rounded text-sm ${UI_THEME_TOKENS.button.hoverBg}`}
                    onClick={() => {
                      setSaveAsOpen(false)
                      onSaveAs()
                    }}
                  >
                    Duplicate in workspace
                  </button>
                ) : null}
                {onExportWorkspaceFile ? (
                  <button
                    type="button"
                    className={`w-full text-left px-2 py-1.5 rounded text-sm ${UI_THEME_TOKENS.button.hoverBg}`}
                    onClick={() => {
                      setSaveAsOpen(false)
                      onExportWorkspaceFile()
                    }}
                  >
                    Workspace file (.jsonld)
                  </button>
                ) : null}
                {onExportMarkdown ? (
                  <button
                    type="button"
                    className={`w-full text-left px-2 py-1.5 rounded text-sm ${UI_THEME_TOKENS.button.hoverBg}`}
                    onClick={() => {
                      setSaveAsOpen(false)
                      onExportMarkdown()
                    }}
                  >
                    Markdown (.md)
                  </button>
                ) : null}
                {onExportHtmlViewer ? (
                  <button
                    type="button"
                    className={`w-full text-left px-2 py-1.5 rounded text-sm ${UI_THEME_TOKENS.button.hoverBg}`}
                    onClick={() => {
                      setSaveAsOpen(false)
                      onExportHtmlViewer()
                    }}
                  >
                    HTML (.html) — Viewer
                  </button>
                ) : null}
                {onExportHtmlCanvas ? (
                  <button
                    type="button"
                    className={`w-full text-left px-2 py-1.5 rounded text-sm ${UI_THEME_TOKENS.button.hoverBg}`}
                    onClick={() => {
                      setSaveAsOpen(false)
                      onExportHtmlCanvas()
                    }}
                  >
                    HTML (.html) — Canvas
                  </button>
                ) : null}
                {onExportJson ? (
                  <button
                    type="button"
                    className={`w-full text-left px-2 py-1.5 rounded text-sm ${UI_THEME_TOKENS.button.hoverBg}`}
                    onClick={() => {
                      setSaveAsOpen(false)
                      onExportJson()
                    }}
                  >
                    JSON (.json)
                  </button>
                ) : null}
                {onExportSvg ? (
                  <button
                    type="button"
                    className={`w-full text-left px-2 py-1.5 rounded text-sm ${UI_THEME_TOKENS.button.hoverBg}`}
                    onClick={() => {
                      setSaveAsOpen(false)
                      onExportSvg()
                    }}
                  >
                    SVG (.svg)
                  </button>
                ) : null}
                {onExportPdf ? (
                  <button
                    type="button"
                    className={`w-full text-left px-2 py-1.5 rounded text-sm ${UI_THEME_TOKENS.button.hoverBg}`}
                    onClick={() => {
                      setSaveAsOpen(false)
                      onExportPdf()
                    }}
                  >
                    PDF (Print…)
                  </button>
                ) : null}
              </div>
            ) : null}
          </li>
          <li className="list-none">
            <button type="button" className={TOOLBAR_BUTTON_CLASSNAME} title="Fullscreen" onClick={onToggleFullscreen}>
              <Maximize2 className="w-4 h-4" strokeWidth={1.6} />
            </button>
          </li>
          <li className="list-none">
            <button
              type="button"
              className={TOOLBAR_BUTTON_CLASSNAME}
              title={UI_LABELS.close}
              onClick={() => setWorkspaceViewMode('canvas')}
            >
              <X className="w-4 h-4" strokeWidth={1.6} />
            </button>
          </li>
        </menu>
        </CollapsibleToolbar>
      </WorkspaceHeaderRow>
    </WorkspaceHeader>
  )
}
