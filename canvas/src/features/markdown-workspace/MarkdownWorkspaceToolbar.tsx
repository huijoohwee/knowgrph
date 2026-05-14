import React from 'react'
import {
  LayoutGrid,
  LayoutPanelTop,
  Maximize2,
  X,
  Quote,
} from 'lucide-react'
import type { MarkdownWorkspaceLayoutMode } from '@/features/markdown-explorer/workspaceUi'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { WorkspaceHeaderRow } from '@/components/ui/WorkspaceHeader'
import { CollapsibleToolbar } from '@/components/ui/CollapsibleToolbar'
import type { MarkdownFormatAction } from 'grph-shared/markdown/formatting'
import type { MarkdownPresentationApi } from './markdownWorkspaceTypes'
import { usePanelTypography } from '@/lib/ui/panelTypography'
import { WorkspaceModeSelect } from './WorkspaceModeSelect'
import type { WebpageFrontmatterMeta, WebpageViewMode } from '@/lib/markdown/frontmatter'
import { useGraphStore } from '@/hooks/useGraphStore'
import { UI_LABELS } from '@/lib/config'
import { UI_TEXT_TRUNCATE } from '@/lib/ui/textLayout'
import { closeWorkspaceView } from '@/features/workspace-table/workspaceTableSsot'
import { DEFAULT_MARKDOWN_WORKSPACE_PANE_VISIBILITY, type MarkdownWorkspacePaneVisibility } from './main/types'
import type { MarkdownWorkspaceDerivedViewerMode } from './main/viewer/MarkdownWorkspaceDerivedViewer'
import {
  MarkdownWorkspaceDisplayMenu,
  MarkdownWorkspaceFormattingMenu,
  MarkdownWorkspacePresentationNavMenu,
} from '@/features/markdown-workspace/MarkdownWorkspaceToolbarInlineMenus'

export type MarkdownWorkspaceToolbarProps = {
  explorerOpen: boolean
  setExplorerOpen: (next: boolean) => void

  canvasOpen: boolean
  setCanvasOpen: (next: boolean) => void

  layoutMode: MarkdownWorkspaceLayoutMode
  setLayoutMode: (mode: MarkdownWorkspaceLayoutMode) => void
  markdownWordWrap: boolean
  setMarkdownWordWrap: (next: boolean) => void
  markdownTextHighlight: boolean
  setMarkdownTextHighlight: (next: boolean) => void

  viewerKind?: 'markdown' | 'html' | 'json'
  viewerMode?: MarkdownWorkspaceDerivedViewerMode
  setViewerMode?: (next: MarkdownWorkspaceDerivedViewerMode) => void
  splitPaneVisibility?: MarkdownWorkspacePaneVisibility
  setSplitPaneVisibility?: (next: MarkdownWorkspacePaneVisibility) => void
  onSaveAs?: () => void
  onExportWorkspaceFile?: () => void
  onExportMarkdown?: () => void
  onExportHtmlViewer?: () => void
  onExportHtmlCanvas?: () => void
  onExportJson?: () => void
  onExportSvg?: () => void
  onToggleFullscreen: () => void
  presentationApiRef: React.MutableRefObject<MarkdownPresentationApi | null>

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
  viewerMode,
  setViewerMode,
  splitPaneVisibility,
  setSplitPaneVisibility,
  onSaveAs,
  onExportWorkspaceFile,
  onExportMarkdown,
  onExportHtmlViewer,
  onExportHtmlCanvas,
  onExportJson,
  onExportSvg,
  onToggleFullscreen,
  presentationApiRef,
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
  const setWorkspaceViewState = useGraphStore(s => s.setWorkspaceViewState)
  const workspaceViewMode = useGraphStore(s => s.workspaceViewMode)
  const canNavigateSlides = layoutMode === 'presentation'
  const effectiveSplitPanes = React.useMemo(
    () => splitPaneVisibility || DEFAULT_MARKDOWN_WORKSPACE_PANE_VISIBILITY,
    [splitPaneVisibility],
  )
  const inlineFloatingFormattingOwnsViewerSurface =
    (layoutMode === 'viewer'
      || (layoutMode === 'split' && Boolean(effectiveSplitPanes.viewer)))
    && viewerKind === 'markdown'
    && viewerMode === 'read'
  const showWorkspaceFormattingMenu =
    layoutMode !== 'split'
    && !inlineFloatingFormattingOwnsViewerSurface
    && isEditing
    && isMarkdown
  const showMarkdownDisplayMenu = viewerKind === 'markdown' && (viewerMode === 'read' || !viewerMode)
  const workspacePanesControlId = React.useId()
  const toggleSplitPane = React.useCallback((key: 'json' | 'markdown' | 'viewer') => {
    if (!setSplitPaneVisibility) return
    const current = effectiveSplitPanes
    const enabledCount = Number(current.json) + Number(current.markdown) + Number(current.viewer)
    if (current[key] && enabledCount <= 1) return
    setSplitPaneVisibility({ ...current, [key]: !current[key] })
  }, [effectiveSplitPanes, setSplitPaneVisibility])
  const ensureSplitPaneEnabled = React.useCallback((key: 'json' | 'markdown' | 'viewer') => {
    if (!setSplitPaneVisibility) return
    const current = effectiveSplitPanes
    if (current[key]) return
    setSplitPaneVisibility({ ...current, [key]: true })
  }, [effectiveSplitPanes, setSplitPaneVisibility])
  const handleSplitPaneToggle = React.useCallback((key: 'json' | 'markdown' | 'viewer') => {
    if (!setSplitPaneVisibility) return
    if (layoutMode !== 'split') {
      setLayoutMode('split')
    }
    toggleSplitPane(key)
  }, [layoutMode, setLayoutMode, setSplitPaneVisibility, toggleSplitPane])

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
        className="inline-flex gap-1 flex-wrap"
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
      <WorkspaceHeaderRow className="kg-toolbar h-[calc(var(--kg-control-height,28px)+0.5rem+2px)] !py-0" ariaLabel="Markdown toolbar row">
        {webpageSignalsNode ? (
          <span className="min-w-0 flex items-center">
            <span className="sr-only">Workspace editor</span>
            {webpageSignalsNode}
          </span>
        ) : (
          <span className="sr-only">Workspace editor</span>
        )}
        <CollapsibleToolbar className="kg-toolbar kg-workspace-toolbar-controls flex items-center justify-end" ariaLabel="Markdown view controls">
          {webpageControls && onWebpageChangeView && onWebpageUpdateMeta ? (
            <menu className="flex items-center gap-1 list-none m-0 p-0" aria-label="Webpage">
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

        <menu className="flex items-center gap-1 list-none m-0 p-0" aria-label="Layout mode">
          <li className="list-none">
            <fieldset
              id={workspacePanesControlId}
              className={`inline-flex items-center gap-2 rounded border px-2 py-1 ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg}`}
              aria-label="Workspace panes"
              title="Workspace panes"
            >
              <label className="inline-flex items-center gap-1 text-xs cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={explorerOpen}
                  onChange={() => setExplorerOpen(!explorerOpen)}
                />
                <span>Explorer</span>
              </label>
              <label className="inline-flex items-center gap-1 text-xs cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={effectiveSplitPanes.json}
                  onChange={() => {
                    if (!effectiveSplitPanes.json && webpageControls) onWebpageChangeView?.('json')
                    handleSplitPaneToggle('json')
                  }}
                />
                <span>JSON</span>
              </label>
              <label className="inline-flex items-center gap-1 text-xs cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={effectiveSplitPanes.markdown}
                  onChange={() => {
                    if (!effectiveSplitPanes.markdown && webpageControls) onWebpageChangeView?.('markdown')
                    handleSplitPaneToggle('markdown')
                  }}
                />
                <span>Markdown</span>
              </label>
              {webpageControls && onWebpageChangeView ? (
                <label className="inline-flex items-center gap-1 text-xs cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={webpageControls.view === 'html'}
                    onChange={() => {
                      onWebpageChangeView('html')
                      if (layoutMode === 'split') ensureSplitPaneEnabled('viewer')
                    }}
                  />
                  <span>HTML</span>
                </label>
              ) : null}
              <label className="inline-flex items-center gap-1 text-xs cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={effectiveSplitPanes.viewer}
                  onChange={() => handleSplitPaneToggle('viewer')}
                />
                <span>Viewer</span>
              </label>
              {typeof canvasOpen === 'boolean' && typeof setCanvasOpen === 'function' ? (
                <label className="inline-flex items-center gap-1 text-xs cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={canvasOpen}
                    onChange={() => setCanvasOpen(!canvasOpen)}
                  />
                  <span>Canvas</span>
                </label>
              ) : null}
            </fieldset>
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
        {showWorkspaceFormattingMenu ? (
          <MarkdownWorkspaceFormattingMenu
            toolbarButtonClassName={TOOLBAR_BUTTON_CLASSNAME}
            isEditing={isEditing}
            isMarkdown={isMarkdown}
            onFormatAction={onFormatAction}
          />
        ) : null}
        {showMarkdownDisplayMenu ? (
          <MarkdownWorkspaceDisplayMenu
            toolbarButtonClassName={TOOLBAR_BUTTON_CLASSNAME}
            markdownTextHighlight={markdownTextHighlight}
            setMarkdownTextHighlight={setMarkdownTextHighlight}
            markdownWordWrap={markdownWordWrap}
            setMarkdownWordWrap={setMarkdownWordWrap}
          />
        ) : null}
        <menu className="flex items-center gap-1 list-none m-0 p-0" aria-label="Actions">
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
              onClick={() => {
                closeWorkspaceView({
                  workspaceViewMode: workspaceViewMode === 'editor' ? 'editor' : 'canvas',
                  workspaceCanvasPaneOpen: canvasOpen,
                  setWorkspaceViewMode,
                  setWorkspaceViewState,
                  setWorkspaceCanvasPaneOpen: setCanvasOpen,
                })
              }}
            >
              <X className="w-4 h-4" strokeWidth={1.6} />
            </button>
          </li>
        </menu>
        </CollapsibleToolbar>
      </WorkspaceHeaderRow>
  )
}
