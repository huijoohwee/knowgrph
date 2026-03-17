import React from 'react'
import {
  ArrowLeftRight,
  Bold,
  Check,
  ChevronDown,
  Columns,
  Download,
  Edit3,
  Eraser,
  Eye,
  FileDown,
  FileText,
  FilePlus,
  FolderOpen,
  FolderPlus,
  Heading2,
  Italic,
  Link,
  LayoutGrid,
  LayoutPanelTop,
  List,
  ListOrdered,
  Maximize2,
  MonitorPlay,
  Quote,
  RefreshCw,
  Save,
  Strikethrough,
  Code,
  Upload,
  WrapText,
} from 'lucide-react'
import IconButton from '@/components/IconButton'
import { cn } from '@/lib/utils'
import { uiPrimaryIconActiveClassName, uiPrimaryIconInactiveClassName } from '@/features/graph-data-table/ui/GraphDataTableToolbarStyles'
import { emitMarkdownPanelMetric } from '@/features/metrics/uiMetrics'
import { useGraphStore } from '@/hooks/useGraphStore'

import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import type { MarkdownFormatAction } from 'grph-shared/markdown/formatting'
import type { MarkdownSourceFilesPanelIntegration } from '@/features/markdown/ui/MarkdownSourceFilesPanel'
import type { MarkdownSourceFilesIngestIntegration } from '@/features/markdown/ui/MarkdownSourceFilesIngestIntegration'

const MARKDOWN_TOOLBAR_GROUP_CLASSNAME = cn('flex items-center mr-1', UI_THEME_TOKENS.badge.toolbarGroup)
const MARKDOWN_TOOLBAR_MENU_CLASSNAME = cn(MARKDOWN_TOOLBAR_GROUP_CLASSNAME, 'list-none m-0')
const MARKDOWN_TOOLBAR_ICON_BUTTON_CLASSNAME = 'App-toolbar__btn'

const SOURCE_FILES_IMPORT_URL_WIDTH_CLASSNAME = 'w-64'
const SOURCE_FILES_IMPORT_URL_CONTAINER_BASE_CLASSNAME =
  'absolute right-full top-0 mr-1 overflow-hidden transition-all duration-200'
const SOURCE_FILES_IMPORT_URL_PLACEHOLDER = 'https://… (or YouTube)'

export type ViewerHeaderRowProps = {
  uiPanelKeyValueTextSizeClass: string
  uiPanelTextFontClass: string
  viewerTitle: string
  editorTitle?: string
  iconSizeClass: string
  uiIconStrokeWidth: number
  markdownTextHighlight: boolean
  setMarkdownTextHighlight: (next: boolean) => void
  markdownLayoutMode: 'split' | 'editor' | 'viewer' | 'presentation' | 'slides-gallery'
  setMarkdownLayoutMode: (mode: 'split' | 'editor' | 'viewer' | 'presentation' | 'slides-gallery') => void
  setMarkdownPresentationMode?: (next: boolean) => void
  markdownWordWrap: boolean
  setMarkdownWordWrap: (next: boolean) => void
  wordWrapToggleTitle: string
  wordWrapOnTooltip: string
  wordWrapOffTooltip: string
  annotateDisplayMode: 'inline' | 'beside' | 'render'
  setAnnotateDisplayMode: (mode: 'inline' | 'beside' | 'render') => void
  textHighlightToggleTitle: string
  textHighlightOnTooltip: string
  textHighlightOffTooltip: string
  applyButtonTitle: string
  onApplyMarkdown: () => void
  onSaveRequested?: () => void
  onSaveAsRequested?: () => void
  onFullscreenToggleRequested: () => void
  fullscreenToggleTitle: string
  fullscreenToggleTooltip: string
  editToggleTitle: string
  isEditing: boolean
  onToggleEdit: () => void
  onFormatAction?: (action: MarkdownFormatAction) => void
  onExpandAll?: () => void
  onCollapseAll?: () => void
  allCollapsed?: boolean
  showSidebar?: boolean
  onToggleSidebar?: () => void
  sourceFilesPanelIntegration?: MarkdownSourceFilesPanelIntegration
  sourceFilesIngestIntegration?: MarkdownSourceFilesIngestIntegration
}

export function ViewerHeaderRow(props: ViewerHeaderRowProps) {
  const {
    uiPanelKeyValueTextSizeClass,
    uiPanelTextFontClass,
    iconSizeClass,
    uiIconStrokeWidth,
    markdownTextHighlight,
    setMarkdownTextHighlight,
    markdownLayoutMode,
    setMarkdownLayoutMode,
    setMarkdownPresentationMode,
    markdownWordWrap,
    setMarkdownWordWrap,
    wordWrapToggleTitle,
    wordWrapOnTooltip,
    wordWrapOffTooltip,
    annotateDisplayMode,
    setAnnotateDisplayMode,
    textHighlightToggleTitle,
    textHighlightOnTooltip,
    textHighlightOffTooltip,
    applyButtonTitle,
    onApplyMarkdown,
    onSaveRequested,
    onSaveAsRequested,
    onFullscreenToggleRequested,
    fullscreenToggleTitle,
    fullscreenToggleTooltip,
    editToggleTitle,
    isEditing,
    onToggleEdit,
    onFormatAction,
    onExpandAll,
    onCollapseAll,
    allCollapsed,
    showSidebar,
    onToggleSidebar,
    sourceFilesPanelIntegration,
    sourceFilesIngestIntegration,
  } = props

  const frontmatterModeEnabled = useGraphStore(s => s.frontmatterModeEnabled || false)
  const setFrontmatterModeEnabled = useGraphStore(s => s.setFrontmatterModeEnabled)
  const markdownDocumentText = useGraphStore(s => s.markdownDocumentText)

  const sourceFiles = useGraphStore(s => s.sourceFiles)
  const markdownDocumentName = useGraphStore(s => s.markdownDocumentName)

  const activeSourceFile = React.useMemo(() => {
    const name = String(markdownDocumentName || '').trim()
    if (!name) return null
    const list = Array.isArray(sourceFiles) ? sourceFiles : []
    return list.find(f => String(f.name || '').trim() === name) || null
  }, [markdownDocumentName, sourceFiles])

  const [urlDraft, setUrlDraft] = React.useState('')
  const [urlInputOpen, setUrlInputOpen] = React.useState(false)
  const [importFormat, setImportFormat] = React.useState<'markdown' | 'json'>('markdown')
  const urlInputRef = React.useRef<HTMLInputElement | null>(null)

  React.useEffect(() => {
    if (!urlInputOpen) return
    const id = requestAnimationFrame(() => {
      try {
        urlInputRef.current?.focus()
      } catch {
        void 0
      }
    })
    return () => cancelAnimationFrame(id)
  }, [urlInputOpen])

  const statusPill = React.useMemo(() => {
    const file = activeSourceFile
    if (!file) return null
    if (file.status === 'parsed') return { text: 'Parsed', classes: UI_THEME_TOKENS.status.success, title: 'Parsed' }
    if (file.status === 'loading') return { text: 'Loading', classes: UI_THEME_TOKENS.status.warning, title: 'Loading' }
    if (file.status === 'error') {
      const msg = file.error ? `Error: ${file.error}` : 'Error'
      return { text: msg, classes: UI_THEME_TOKENS.status.error, title: msg }
    }
    return { text: 'Idle', classes: UI_THEME_TOKENS.status.neutral, title: 'Idle' }
  }, [activeSourceFile])

  const hasTopFrontmatter = React.useMemo(() => {
    const raw = String(markdownDocumentText || '')
    if (!raw.trim()) return false
    const firstLine = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')[0]
    return String(firstLine || '').trim() === '---'
  }, [markdownDocumentText])

  React.useEffect(() => {
    if (props.annotateDisplayMode !== 'render') return
    if (frontmatterModeEnabled) return
    if (!hasTopFrontmatter) return
    setFrontmatterModeEnabled(true)
  }, [frontmatterModeEnabled, hasTopFrontmatter, props.annotateDisplayMode, setFrontmatterModeEnabled])

  return (
    <section
      className={['flex items-center justify-between gap-2', uiPanelKeyValueTextSizeClass, uiPanelTextFontClass].join(' ')}
      title={isEditing ? (props.editorTitle || 'Markdown Editor') : props.viewerTitle}
    >
      <span className="flex items-center gap-2 min-w-0">
        <span className={`flex items-center gap-1.5 ${UI_THEME_TOKENS.text.secondary} select-none`}>
          {onToggleSidebar && (
            <IconButton
              className={cn(
                MARKDOWN_TOOLBAR_ICON_BUTTON_CLASSNAME,
                showSidebar ? uiPrimaryIconActiveClassName : uiPrimaryIconInactiveClassName,
              )}
              onClick={onToggleSidebar}
              title={showSidebar ? 'Close Sidebar' : 'Open Sidebar'}
              tooltipContent={showSidebar ? 'Close Sidebar' : 'Open Sidebar'}
              showTooltip
            >
              <LayoutPanelTop className={`${iconSizeClass} rotate-90`} strokeWidth={uiIconStrokeWidth} />
            </IconButton>
          )}
          <Edit3 className="w-4 h-4" strokeWidth={1.5} aria-hidden="true" />
        </span>
      </span>
      <nav className="flex items-center gap-1 flex-wrap justify-end" aria-label="Markdown Toolbar">
        {sourceFilesIngestIntegration ? (
          <menu className={MARKDOWN_TOOLBAR_MENU_CLASSNAME} aria-label="Source Files ingest">
            <li className="list-none">
              <IconButton
                className={MARKDOWN_TOOLBAR_ICON_BUTTON_CLASSNAME}
                title="Import local"
                tooltipContent="Import local"
                onClick={() => void sourceFilesIngestIntegration.onImportLocal({ fileId: activeSourceFile?.id || null })}
                showTooltip
              >
                <Upload className={iconSizeClass} strokeWidth={uiIconStrokeWidth} aria-hidden="true" />
              </IconButton>
            </li>
            <li className="list-none relative">
              <IconButton
                className={MARKDOWN_TOOLBAR_ICON_BUTTON_CLASSNAME}
                title="Import URL"
                tooltipContent="Import URL"
                onClick={() => {
                  const draft = String(urlDraft || '').trim()
                  if (urlInputOpen) {
                    if (!draft) {
                      setUrlInputOpen(false)
                      return
                    }
                    void sourceFilesIngestIntegration.onImportUrl({ fileId: activeSourceFile?.id || null, url: draft, format: importFormat })
                    setUrlInputOpen(false)
                    return
                  }
                  setUrlInputOpen(true)
                }}
                showTooltip
              >
                <Link className={iconSizeClass} strokeWidth={uiIconStrokeWidth} aria-hidden="true" />
              </IconButton>
              <section
                className={[
                  SOURCE_FILES_IMPORT_URL_CONTAINER_BASE_CLASSNAME,
                  urlInputOpen ? 'w-auto opacity-100 flex items-center' : 'w-0 opacity-0 pointer-events-none',
                ].join(' ')}
                aria-label="Import URL input"
              >
                <select
                  className={`h-[var(--kg-control-height,28px)] rounded border px-1 text-[11px] ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.input.bg} ${UI_THEME_TOKENS.input.text} mr-1`}
                  value={importFormat}
                  onChange={e => setImportFormat(e.target.value as any)}
                  aria-label="Import format"
                >
                  <option value="markdown">Markdown</option>
                  <option value="json">JSON</option>
                </select>
                <input
                  ref={urlInputRef}
                  className={`${SOURCE_FILES_IMPORT_URL_WIDTH_CLASSNAME} h-[var(--kg-control-height,28px)] px-2 rounded border box-border ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.input.bg} ${UI_THEME_TOKENS.input.text} font-sans text-sm`}
                  placeholder={SOURCE_FILES_IMPORT_URL_PLACEHOLDER}
                  aria-label="Import URL input"
                  value={urlDraft}
                  onChange={e => setUrlDraft(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Escape') {
                      e.preventDefault()
                      setUrlInputOpen(false)
                      return
                    }
                    if (e.key !== 'Enter') return
                    e.preventDefault()
                    const next = String(urlDraft || '').trim()
                    if (!next) return
                    void sourceFilesIngestIntegration.onImportUrl({ fileId: activeSourceFile?.id || null, url: next, format: importFormat })
                    setUrlInputOpen(false)
                  }}
                />
              </section>
            </li>
            <li className="list-none">
              <IconButton
                className={MARKDOWN_TOOLBAR_ICON_BUTTON_CLASSNAME}
                title="Open in editor"
                tooltipContent="Open in editor"
                onClick={() => {
                  setMarkdownPresentationMode?.(false)
                  setMarkdownLayoutMode('editor')
                }}
                disabled={!activeSourceFile}
                showTooltip
              >
                <FileText className={iconSizeClass} strokeWidth={uiIconStrokeWidth} aria-hidden="true" />
              </IconButton>
            </li>
            <li className="list-none">
              <IconButton
                className={MARKDOWN_TOOLBAR_ICON_BUTTON_CLASSNAME}
                title="Export"
                tooltipContent="Export"
                onClick={() => sourceFilesIngestIntegration.onExport({ fileId: activeSourceFile?.id || null })}
                disabled={!activeSourceFile}
                showTooltip
              >
                <Download className={iconSizeClass} strokeWidth={uiIconStrokeWidth} aria-hidden="true" />
              </IconButton>
            </li>
            <li className="list-none">
              <IconButton
                className={MARKDOWN_TOOLBAR_ICON_BUTTON_CLASSNAME}
                title="Clear Source File"
                tooltipContent="Clear Source File"
                onClick={() => sourceFilesIngestIntegration.onClear({ fileId: activeSourceFile?.id || null })}
                disabled={!activeSourceFile}
                showTooltip
              >
                <Eraser className={iconSizeClass} strokeWidth={uiIconStrokeWidth} aria-hidden="true" />
              </IconButton>
            </li>
            {statusPill ? (
              <li className="list-none">
                <span
                  className={`inline-flex items-center h-[var(--kg-status-pill-height,24px)] box-border rounded border px-2 text-[10px] ${statusPill.classes}`}
                  title={statusPill.title}
                  role="status"
                  aria-label="Source file status"
                >
                  <span className="truncate overflow-hidden whitespace-nowrap max-w-[6rem]">{statusPill.text}</span>
                </span>
              </li>
            ) : null}
          </menu>
        ) : null}
        {onFormatAction ? (
          <menu className={MARKDOWN_TOOLBAR_MENU_CLASSNAME} aria-label="Formatting">
            <li className="list-none">
              <IconButton
                className={MARKDOWN_TOOLBAR_ICON_BUTTON_CLASSNAME}
                title="Bold"
                tooltipContent="Bold"
                disabled={!isEditing}
                onClick={() => onFormatAction('bold')}
                showTooltip
              >
                <Bold className={iconSizeClass} strokeWidth={uiIconStrokeWidth} />
              </IconButton>
            </li>
            <li className="list-none">
              <IconButton
                className={MARKDOWN_TOOLBAR_ICON_BUTTON_CLASSNAME}
                title="Italic"
                tooltipContent="Italic"
                disabled={!isEditing}
                onClick={() => onFormatAction('italic')}
                showTooltip
              >
                <Italic className={iconSizeClass} strokeWidth={uiIconStrokeWidth} />
              </IconButton>
            </li>
            <li className="list-none">
              <IconButton
                className={MARKDOWN_TOOLBAR_ICON_BUTTON_CLASSNAME}
                title="Strikethrough"
                tooltipContent="Strike"
                disabled={!isEditing}
                onClick={() => onFormatAction('strike')}
                showTooltip
              >
                <Strikethrough className={iconSizeClass} strokeWidth={uiIconStrokeWidth} />
              </IconButton>
            </li>
            <li className="list-none">
              <IconButton
                className={MARKDOWN_TOOLBAR_ICON_BUTTON_CLASSNAME}
                title="Inline code"
                tooltipContent="Inline code"
                disabled={!isEditing}
                onClick={() => onFormatAction('inlineCode')}
                showTooltip
              >
                <Code className={iconSizeClass} strokeWidth={uiIconStrokeWidth} />
              </IconButton>
            </li>
            <li className="list-none">
              <IconButton
                className={MARKDOWN_TOOLBAR_ICON_BUTTON_CLASSNAME}
                title="Link"
                tooltipContent="Link"
                disabled={!isEditing}
                onClick={() => onFormatAction('link')}
                showTooltip
              >
                <Link className={iconSizeClass} strokeWidth={uiIconStrokeWidth} />
              </IconButton>
            </li>
            <li className="list-none">
              <IconButton
                className={MARKDOWN_TOOLBAR_ICON_BUTTON_CLASSNAME}
                title="Heading"
                tooltipContent="Heading"
                disabled={!isEditing}
                onClick={() => onFormatAction('heading2')}
                showTooltip
              >
                <Heading2 className={iconSizeClass} strokeWidth={uiIconStrokeWidth} />
              </IconButton>
            </li>
            <li className="list-none">
              <IconButton
                className={MARKDOWN_TOOLBAR_ICON_BUTTON_CLASSNAME}
                title="Bulleted list"
                tooltipContent="Bulleted list"
                disabled={!isEditing}
                onClick={() => onFormatAction('bulletList')}
                showTooltip
              >
                <List className={iconSizeClass} strokeWidth={uiIconStrokeWidth} />
              </IconButton>
            </li>
            <li className="list-none">
              <IconButton
                className={MARKDOWN_TOOLBAR_ICON_BUTTON_CLASSNAME}
                title="Numbered list"
                tooltipContent="Numbered list"
                disabled={!isEditing}
                onClick={() => onFormatAction('numberedList')}
                showTooltip
              >
                <ListOrdered className={iconSizeClass} strokeWidth={uiIconStrokeWidth} />
              </IconButton>
            </li>
            <li className="list-none">
              <IconButton
                className={MARKDOWN_TOOLBAR_ICON_BUTTON_CLASSNAME}
                title="Quote"
                tooltipContent="Quote"
                disabled={!isEditing}
                onClick={() => onFormatAction('blockquote')}
                showTooltip
              >
                <Quote className={iconSizeClass} strokeWidth={uiIconStrokeWidth} />
              </IconButton>
            </li>
            <li className="list-none">
              <IconButton
                className={MARKDOWN_TOOLBAR_ICON_BUTTON_CLASSNAME}
                title="Normalize ASCII blocks"
                tooltipContent="Normalize ASCII blocks"
                disabled={!isEditing}
                onClick={() => onFormatAction('normalizeAsciiBlocks')}
                showTooltip
              >
                <span className="text-[10px] font-semibold">ASCII</span>
              </IconButton>
            </li>
          </menu>
        ) : null}
        <span className={MARKDOWN_TOOLBAR_GROUP_CLASSNAME}>
          <IconButton
            name="annotate-display"
            value="beside"
            aria-current={annotateDisplayMode === 'beside' ? 'true' : undefined}
            className={cn(
              MARKDOWN_TOOLBAR_ICON_BUTTON_CLASSNAME,
              annotateDisplayMode === 'beside' ? uiPrimaryIconActiveClassName : uiPrimaryIconInactiveClassName,
            )}
            title="Beside"
            tooltipContent="Show annotations beside"
            onClick={() => setAnnotateDisplayMode('beside')}
            showTooltip
          >
            <Columns className={iconSizeClass} strokeWidth={uiIconStrokeWidth} />
          </IconButton>
          <IconButton
            name="annotate-display"
            value="inline"
            aria-current={annotateDisplayMode === 'inline' ? 'true' : undefined}
            className={cn(
              MARKDOWN_TOOLBAR_ICON_BUTTON_CLASSNAME,
              annotateDisplayMode === 'inline' ? uiPrimaryIconActiveClassName : uiPrimaryIconInactiveClassName,
            )}
            title="Inline"
            tooltipContent="Show annotations inline"
            onClick={() => setAnnotateDisplayMode('inline')}
            showTooltip
          >
            <LayoutPanelTop className={iconSizeClass} strokeWidth={uiIconStrokeWidth} />
          </IconButton>
          <IconButton
            name="annotate-display"
            value="render"
            aria-current={annotateDisplayMode === 'render' ? 'true' : undefined}
            className={cn(
              MARKDOWN_TOOLBAR_ICON_BUTTON_CLASSNAME,
              annotateDisplayMode === 'render' ? uiPrimaryIconActiveClassName : uiPrimaryIconInactiveClassName,
            )}
            title="Render"
            tooltipContent="Render code output"
            onClick={() => {
              setAnnotateDisplayMode('render')
              try {
                if (useGraphStore.getState().frontmatterModeEnabled) return
                const raw = String(useGraphStore.getState().markdownDocumentText || '')
                const firstLine = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')[0]
                if (String(firstLine || '').trim() === '---') {
                  setFrontmatterModeEnabled(true)
                }
              } catch {
                void 0
              }
            }}
            showTooltip
          >
            <Eye className={iconSizeClass} strokeWidth={uiIconStrokeWidth} />
          </IconButton>
        </span>
        {sourceFilesPanelIntegration ? (
          <menu className={MARKDOWN_TOOLBAR_MENU_CLASSNAME} aria-label="Source Files actions">
            <li className="list-none">
              <IconButton
                className={MARKDOWN_TOOLBAR_ICON_BUTTON_CLASSNAME}
                title={
                  sourceFilesPanelIntegration.folderName
                    ? `Open folder (current: ${sourceFilesPanelIntegration.folderName})`
                    : 'Open folder'
                }
                tooltipContent="Open folder"
                onClick={() => void sourceFilesPanelIntegration.onOpenFolder()}
                showTooltip
              >
                <FolderOpen className={iconSizeClass} strokeWidth={uiIconStrokeWidth} aria-hidden="true" />
              </IconButton>
            </li>
            {sourceFilesPanelIntegration.onRefreshFiles ? (
              <li className="list-none">
                <IconButton
                  className={MARKDOWN_TOOLBAR_ICON_BUTTON_CLASSNAME}
                  title="Refresh files"
                  tooltipContent="Refresh files"
                  onClick={() => void sourceFilesPanelIntegration.onRefreshFiles?.()}
                  showTooltip
                >
                  <RefreshCw className={iconSizeClass} strokeWidth={uiIconStrokeWidth} aria-hidden="true" />
                </IconButton>
              </li>
            ) : null}
            <li className="list-none">
              <IconButton
                className={MARKDOWN_TOOLBAR_ICON_BUTTON_CLASSNAME}
                title={
                  sourceFilesPanelIntegration.canWrite
                    ? 'New folder'
                    : sourceFilesPanelIntegration.accessMode
                      ? 'New folder (requires write support)'
                      : 'New folder'
                }
                tooltipContent="New folder"
                disabled={!sourceFilesPanelIntegration.canWrite}
                onClick={() => {
                  if (!sourceFilesPanelIntegration.canWrite || !sourceFilesPanelIntegration.onCreateFolder) return
                  void Promise.resolve(sourceFilesPanelIntegration.onCreateFolder(null))
                }}
                showTooltip
              >
                <FolderPlus className={iconSizeClass} strokeWidth={uiIconStrokeWidth} aria-hidden="true" />
              </IconButton>
            </li>
            <li className="list-none">
              <IconButton
                className={MARKDOWN_TOOLBAR_ICON_BUTTON_CLASSNAME}
                title={
                  sourceFilesPanelIntegration.canWrite
                    ? 'New source file'
                    : sourceFilesPanelIntegration.accessMode
                      ? 'New source file (requires write support)'
                      : 'New source file'
                }
                tooltipContent="New source file"
                disabled={!sourceFilesPanelIntegration.canWrite}
                onClick={() => {
                  if (!sourceFilesPanelIntegration.canWrite || !sourceFilesPanelIntegration.onCreateFile) return
                  sourceFilesPanelIntegration.onCreateFile(null)
                }}
                showTooltip
              >
                <FilePlus className={iconSizeClass} strokeWidth={uiIconStrokeWidth} aria-hidden="true" />
              </IconButton>
            </li>
          </menu>
        ) : null}
        <IconButton
          className={MARKDOWN_TOOLBAR_ICON_BUTTON_CLASSNAME}
          title={applyButtonTitle}
          tooltipContent={applyButtonTitle}
          disabled={!isEditing}
          onClick={() => {
            void onApplyMarkdown()
          }}
          showTooltip
        >
          <Check className={iconSizeClass} strokeWidth={uiIconStrokeWidth} />
        </IconButton>
        {onSaveRequested || onSaveAsRequested ? (
          <>
            <IconButton
              className={MARKDOWN_TOOLBAR_ICON_BUTTON_CLASSNAME}
              title="Save"
              tooltipContent="Save"
              onClick={() => onSaveRequested?.()}
              disabled={!isEditing || !onSaveRequested}
              showTooltip
            >
              <Save className={iconSizeClass} strokeWidth={uiIconStrokeWidth} />
            </IconButton>
            <IconButton
              className={MARKDOWN_TOOLBAR_ICON_BUTTON_CLASSNAME}
              title="Save As..."
              tooltipContent="Save As..."
              onClick={() => onSaveAsRequested?.()}
              disabled={!isEditing || !onSaveAsRequested}
              showTooltip
            >
              <FileDown className={iconSizeClass} strokeWidth={uiIconStrokeWidth} />
            </IconButton>
          </>
        ) : null}
        <IconButton
          className={cn(
            MARKDOWN_TOOLBAR_ICON_BUTTON_CLASSNAME,
            markdownTextHighlight ? uiPrimaryIconActiveClassName : uiPrimaryIconInactiveClassName,
          )}
          title={textHighlightToggleTitle}
          tooltipContent={markdownTextHighlight ? textHighlightOnTooltip : textHighlightOffTooltip}
          onClick={() => {
            const next = !markdownTextHighlight
            setMarkdownTextHighlight(next)
            emitMarkdownPanelMetric('markdownTextHighlightToggled', {
              enabled: next,
            })
          }}
          showTooltip
        >
          <MonitorPlay className={iconSizeClass} strokeWidth={uiIconStrokeWidth} />
        </IconButton>
        <IconButton
          className={cn(MARKDOWN_TOOLBAR_ICON_BUTTON_CLASSNAME, markdownWordWrap ? uiPrimaryIconActiveClassName : uiPrimaryIconInactiveClassName)}
          title={wordWrapToggleTitle}
          tooltipContent={markdownWordWrap ? wordWrapOnTooltip : wordWrapOffTooltip}
          onClick={() => setMarkdownWordWrap(!markdownWordWrap)}
          showTooltip
        >
          <WrapText className={iconSizeClass} strokeWidth={uiIconStrokeWidth} />
        </IconButton>
        <IconButton
          className={cn(
            MARKDOWN_TOOLBAR_ICON_BUTTON_CLASSNAME,
            frontmatterModeEnabled ? uiPrimaryIconActiveClassName : uiPrimaryIconInactiveClassName,
          )}
          title={frontmatterModeEnabled ? 'Hide Frontmatter' : 'Show Frontmatter'}
          tooltipContent={frontmatterModeEnabled ? 'Hide Frontmatter' : 'Show Frontmatter'}
          onClick={() => setFrontmatterModeEnabled(!frontmatterModeEnabled)}
          showTooltip
        >
          <FileText className={iconSizeClass} strokeWidth={uiIconStrokeWidth} />
        </IconButton>
        {markdownLayoutMode !== 'presentation' && markdownLayoutMode !== 'slides-gallery' && (onExpandAll || onCollapseAll) && typeof allCollapsed === 'boolean' && (
          <IconButton
            className={cn(MARKDOWN_TOOLBAR_ICON_BUTTON_CLASSNAME, uiPrimaryIconInactiveClassName)}
            title={allCollapsed ? 'Expand all sections' : 'Collapse all sections'}
            tooltipContent={allCollapsed ? 'Expand all sections' : 'Collapse all sections'}
            onClick={() => {
              if (allCollapsed) {
                onExpandAll?.()
              } else {
                onCollapseAll?.()
              }
            }}
            showTooltip
          >
            <ChevronDown
              className={`${iconSizeClass} transition-transform ${allCollapsed ? '' : 'rotate-180'}`}
              strokeWidth={uiIconStrokeWidth}
            />
          </IconButton>
        )}
        <IconButton
          className={cn(MARKDOWN_TOOLBAR_ICON_BUTTON_CLASSNAME, isEditing ? uiPrimaryIconActiveClassName : uiPrimaryIconInactiveClassName)}
          title={editToggleTitle}
          tooltipContent={props.editorTitle || 'Markdown Editor'}
          onClick={onToggleEdit}
          showTooltip
        >
          <ArrowLeftRight className={iconSizeClass} strokeWidth={uiIconStrokeWidth} />
        </IconButton>
        <IconButton
          className={cn(
            MARKDOWN_TOOLBAR_ICON_BUTTON_CLASSNAME,
            markdownLayoutMode === 'presentation' ? uiPrimaryIconActiveClassName : uiPrimaryIconInactiveClassName,
          )}
          title="Markdown Presentation"
          tooltipContent="Markdown Presentation"
          onClick={() => {
            setMarkdownPresentationMode?.(false)
            setMarkdownLayoutMode('presentation')
          }}
          showTooltip
        >
          <LayoutPanelTop className={iconSizeClass} strokeWidth={uiIconStrokeWidth} />
        </IconButton>
        <IconButton
          className={cn(
            MARKDOWN_TOOLBAR_ICON_BUTTON_CLASSNAME,
            markdownLayoutMode === 'slides-gallery' ? uiPrimaryIconActiveClassName : uiPrimaryIconInactiveClassName,
          )}
          title="Gallery"
          tooltipContent="Gallery"
          onClick={() => {
            setMarkdownPresentationMode?.(false)
            setMarkdownLayoutMode('slides-gallery')
          }}
          showTooltip
        >
          <LayoutGrid className={iconSizeClass} strokeWidth={uiIconStrokeWidth} />
        </IconButton>
        <IconButton
          className={cn(MARKDOWN_TOOLBAR_ICON_BUTTON_CLASSNAME, uiPrimaryIconInactiveClassName)}
          title={fullscreenToggleTitle}
          tooltipContent={fullscreenToggleTooltip}
          onClick={onFullscreenToggleRequested}
          showTooltip
        >
          <Maximize2 className={iconSizeClass} strokeWidth={uiIconStrokeWidth} />
        </IconButton>
      </nav>
    </section>
  )
}
