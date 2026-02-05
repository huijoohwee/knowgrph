import React from 'react'
import {
  Bold,
  Check,
  ChevronLeft,
  ChevronRight,
  Code,
  Columns,
  Edit3,
  Eye,
  FolderOpen,
  Heading2,
  Italic,
  LayoutGrid,
  LayoutPanelTop,
  Link,
  List,
  ListOrdered,
  Maximize2,
  Quote,
  Strikethrough,
  Upload,
  WrapText,
} from 'lucide-react'
import type { MarkdownWorkspaceLayoutMode } from '@/features/markdown-explorer/workspaceUi'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import type { MarkdownFormatAction } from 'grph-shared/markdown/formatting'
import { SOURCE_FILES_COPY, SOURCE_FILES_FORMATS } from '@/lib/config-copy/importExportCopy'
import type { MarkdownPresentationApi } from './markdownWorkspace/markdownWorkspaceTypes'
import { usePanelTypography } from '@/lib/ui/panelTypography'

export type MarkdownWorkspaceToolbarProps = {
  layoutMode: MarkdownWorkspaceLayoutMode
  setLayoutMode: (mode: MarkdownWorkspaceLayoutMode) => void
  markdownWordWrap: boolean
  setMarkdownWordWrap: (next: boolean) => void
  markdownTextHighlight: boolean
  setMarkdownTextHighlight: (next: boolean) => void
  onApply: () => void
  applyStatusLabel?: string
  onToggleFullscreen: () => void
  presentationApiRef: React.MutableRefObject<MarkdownPresentationApi | null>

  isEditing: boolean
  isMarkdown: boolean
  onFormatAction: (action: MarkdownFormatAction) => void
  onImportLocalFiles: (files: FileList | null) => void
  onImportLocalFolder: (files: FileList | null) => void
  onImportUrl: (url: string) => void
}

const TOOLBAR_BUTTON_CLASSNAME = `h-7 w-7 inline-flex items-center justify-center rounded ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`
const WORKSPACE_IMPORT_ACCEPT = [...SOURCE_FILES_FORMATS.import, '.mdx'].join(',')

export function MarkdownWorkspaceToolbar({
  layoutMode,
  setLayoutMode,
  markdownWordWrap,
  setMarkdownWordWrap,
  markdownTextHighlight,
  setMarkdownTextHighlight,
  onApply,
  applyStatusLabel,
  onToggleFullscreen,
  presentationApiRef,
  isEditing,
  isMarkdown,
  onFormatAction,
  onImportLocalFiles,
  onImportLocalFolder,
  onImportUrl,
}: MarkdownWorkspaceToolbarProps) {
  const panelTypography = usePanelTypography()
  const canNavigateSlides = layoutMode === 'presentation'

  const fileInputRef = React.useRef<HTMLInputElement | null>(null)
  const folderInputRef = React.useRef<HTMLInputElement | null>(null)
  const urlInputRef = React.useRef<HTMLInputElement | null>(null)
  const [urlDraft, setUrlDraft] = React.useState('')
  const [urlInputOpen, setUrlInputOpen] = React.useState(false)

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

  const openFilePicker = React.useCallback((el: HTMLInputElement | null) => {
    if (!el) return
    try {
      const anyEl = el as unknown as { showPicker?: () => void }
      if (typeof anyEl.showPicker === 'function') {
        anyEl.showPicker()
        return
      }
    } catch {
      void 0
    }
    try {
      el.click()
    } catch {
      void 0
    }
  }, [])

  return (
    <header
      className={`flex items-center justify-between gap-2 px-3 py-2 border-b ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg}`}
      aria-label="Markdown Toolbar"
    >
      <span className="min-w-0">
        <span className={`${panelTypography.microLabelClass} uppercase tracking-wide font-semibold ${UI_THEME_TOKENS.text.secondary}`}>Markdown</span>
        {applyStatusLabel ? (
          <output className={`ml-2 ${panelTypography.microLabelClass} ${UI_THEME_TOKENS.text.secondary}`} aria-label="Apply status">
            {applyStatusLabel}
          </output>
        ) : null}
      </span>
      <nav className="flex items-center gap-1 flex-wrap justify-end" aria-label="Markdown view controls">
        <input
          ref={el => {
            fileInputRef.current = el
          }}
          type="file"
          className="sr-only"
          accept={WORKSPACE_IMPORT_ACCEPT}
          multiple
          onChange={e => {
            onImportLocalFiles(e.target.files)
            try {
              e.currentTarget.value = ''
            } catch {
              void 0
            }
          }}
        />
        <input
          ref={el => {
            folderInputRef.current = el
            if (!el) return
            try {
              el.setAttribute('webkitdirectory', '')
              el.setAttribute('directory', '')
            } catch {
              void 0
            }
          }}
          type="file"
          className="sr-only"
          multiple
          onChange={e => {
            onImportLocalFolder(e.target.files)
            try {
              e.currentTarget.value = ''
            } catch {
              void 0
            }
          }}
        />
        <menu className="flex items-center gap-1 list-none m-0 p-0" aria-label="Import">
          <li className="list-none">
            <button
              type="button"
              className={TOOLBAR_BUTTON_CLASSNAME}
              title="Import local files"
              onClick={() => {
                openFilePicker(fileInputRef.current)
              }}
            >
              <Upload className="w-4 h-4" strokeWidth={1.6} />
            </button>
          </li>
          <li className="list-none">
            <button
              type="button"
              className={TOOLBAR_BUTTON_CLASSNAME}
              title="Import folder"
              onClick={() => {
                openFilePicker(folderInputRef.current)
              }}
            >
              <FolderOpen className="w-4 h-4" strokeWidth={1.6} />
            </button>
          </li>
          <li className="list-none relative">
            <button
              type="button"
              className={TOOLBAR_BUTTON_CLASSNAME}
              title="Import URL"
              onClick={() => {
                const draft = String(urlDraft || '').trim()
                if (urlInputOpen) {
                  if (!draft) {
                    setUrlInputOpen(false)
                    return
                  }
                  onImportUrl(draft)
                  setUrlInputOpen(false)
                  return
                }
                setUrlInputOpen(true)
              }}
            >
              <Link className="w-4 h-4" strokeWidth={1.6} />
            </button>
            <section
              className={
                urlInputOpen
                  ? 'absolute right-full top-0 mr-1 w-72 opacity-100'
                  : 'absolute right-full top-0 mr-1 w-0 opacity-0 pointer-events-none'
              }
              aria-label="Import URL input"
            >
              <input
                ref={urlInputRef}
                className={`w-72 h-[var(--kg-control-height,28px)] px-2 rounded border box-border ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.input.bg} ${UI_THEME_TOKENS.input.text} ${panelTypography.fontClass} ${panelTypography.textSizeClass}`}
                placeholder={SOURCE_FILES_COPY.urlPlaceholder}
                aria-label="Import URL"
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
                  onImportUrl(next)
                  setUrlInputOpen(false)
                }}
              />
            </section>
          </li>
        </menu>
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
        {canNavigateSlides ? (
          <menu className="flex items-center gap-1 list-none m-0 p-0" aria-label="Presentation navigation">
            <li className="list-none">
              <button
                type="button"
                className={TOOLBAR_BUTTON_CLASSNAME}
                title="Previous slide"
                onClick={() => presentationApiRef.current?.prev()}
              >
                <ChevronLeft className="w-4 h-4" strokeWidth={1.6} />
              </button>
            </li>
            <li className="list-none">
              <button
                type="button"
                className={TOOLBAR_BUTTON_CLASSNAME}
                title="Next slide"
                onClick={() => presentationApiRef.current?.next()}
              >
                <ChevronRight className="w-4 h-4" strokeWidth={1.6} />
              </button>
            </li>
          </menu>
        ) : null}
        <menu className="flex items-center gap-1 list-none m-0 p-0" aria-label="Formatting">
          <li className="list-none">
            <button
              type="button"
              className={TOOLBAR_BUTTON_CLASSNAME}
              title="Heading"
              disabled={!isEditing || !isMarkdown}
              onClick={() => onFormatAction('heading2')}
            >
              <Heading2 className="w-4 h-4" strokeWidth={1.6} />
            </button>
          </li>
          <li className="list-none">
            <button
              type="button"
              className={TOOLBAR_BUTTON_CLASSNAME}
              title="Bold"
              disabled={!isEditing || !isMarkdown}
              onClick={() => onFormatAction('bold')}
            >
              <Bold className="w-4 h-4" strokeWidth={1.6} />
            </button>
          </li>
          <li className="list-none">
            <button
              type="button"
              className={TOOLBAR_BUTTON_CLASSNAME}
              title="Italic"
              disabled={!isEditing || !isMarkdown}
              onClick={() => onFormatAction('italic')}
            >
              <Italic className="w-4 h-4" strokeWidth={1.6} />
            </button>
          </li>
          <li className="list-none">
            <button
              type="button"
              className={TOOLBAR_BUTTON_CLASSNAME}
              title="Strikethrough"
              disabled={!isEditing || !isMarkdown}
              onClick={() => onFormatAction('strike')}
            >
              <Strikethrough className="w-4 h-4" strokeWidth={1.6} />
            </button>
          </li>
          <li className="list-none">
            <button
              type="button"
              className={TOOLBAR_BUTTON_CLASSNAME}
              title="Inline code"
              disabled={!isEditing || !isMarkdown}
              onClick={() => onFormatAction('inlineCode')}
            >
              <Code className="w-4 h-4" strokeWidth={1.6} />
            </button>
          </li>
          <li className="list-none">
            <button
              type="button"
              className={TOOLBAR_BUTTON_CLASSNAME}
              title="Link"
              disabled={!isEditing || !isMarkdown}
              onClick={() => onFormatAction('link')}
            >
              <Link className="w-4 h-4" strokeWidth={1.6} />
            </button>
          </li>
          <li className="list-none">
            <button
              type="button"
              className={TOOLBAR_BUTTON_CLASSNAME}
              title="Bulleted list"
              disabled={!isEditing || !isMarkdown}
              onClick={() => onFormatAction('bulletList')}
            >
              <List className="w-4 h-4" strokeWidth={1.6} />
            </button>
          </li>
          <li className="list-none">
            <button
              type="button"
              className={TOOLBAR_BUTTON_CLASSNAME}
              title="Numbered list"
              disabled={!isEditing || !isMarkdown}
              onClick={() => onFormatAction('numberedList')}
            >
              <ListOrdered className="w-4 h-4" strokeWidth={1.6} />
            </button>
          </li>
          <li className="list-none">
            <button
              type="button"
              className={TOOLBAR_BUTTON_CLASSNAME}
              title="Quote"
              disabled={!isEditing || !isMarkdown}
              onClick={() => onFormatAction('blockquote')}
            >
              <Quote className="w-4 h-4" strokeWidth={1.6} />
            </button>
          </li>
        </menu>
        <menu className="flex items-center gap-1 list-none m-0 p-0" aria-label="Display">
          <li className="list-none">
            <button
              type="button"
              className={TOOLBAR_BUTTON_CLASSNAME}
              aria-pressed={markdownTextHighlight}
              title="Toggle text highlight"
              onClick={() => setMarkdownTextHighlight(!markdownTextHighlight)}
            >
              <Eye className="w-4 h-4" strokeWidth={1.6} />
            </button>
          </li>
          <li className="list-none">
            <button
              type="button"
              className={TOOLBAR_BUTTON_CLASSNAME}
              aria-pressed={markdownWordWrap}
              title="Toggle word wrap"
              onClick={() => setMarkdownWordWrap(!markdownWordWrap)}
            >
              <WrapText className="w-4 h-4" strokeWidth={1.6} />
            </button>
          </li>
        </menu>
        <menu className="flex items-center gap-1 list-none m-0 p-0" aria-label="Actions">
          <li className="list-none">
            <button type="button" className={TOOLBAR_BUTTON_CLASSNAME} title="Apply" onClick={onApply}>
              <Check className="w-4 h-4" strokeWidth={1.6} />
            </button>
          </li>
          <li className="list-none">
            <button type="button" className={TOOLBAR_BUTTON_CLASSNAME} title="Fullscreen" onClick={onToggleFullscreen}>
              <Maximize2 className="w-4 h-4" strokeWidth={1.6} />
            </button>
          </li>
        </menu>
      </nav>
    </header>
  )
}
