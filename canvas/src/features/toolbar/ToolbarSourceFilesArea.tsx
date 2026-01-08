import React from 'react'
import StatusBadge from '@/features/panels/ui/StatusBadge'
import { useGraphStore } from '@/hooks/useGraphStore'
import { EXPORT_UI_LABELS, UI_COPY, UI_LABELS } from '@/lib/config'
import type { ToolbarToolMenuAreasProps } from '@/features/toolbar/ToolbarToolMenuAreas.registry'
import { ToolbarMarkdownArea } from './ToolbarMarkdownArea'
import { ToolbarHtmlArea } from './ToolbarHtmlArea'
import { ToolbarPdfArea } from './ToolbarPdfArea'

type JsonImportAreaProps = {
  format: 'json' | 'jsonld'
  isOpen: boolean
  setIsOpen: (open: boolean) => void
  onToolMenuAction: ToolbarToolMenuAreasProps['onToolMenuAction']
}

function JsonImportArea({ format, isOpen, setIsOpen, onToolMenuAction }: JsonImportAreaProps) {
  const uiPanelKeyValueTextSizeClass = useGraphStore(
    s => s.uiPanelKeyValueTextSizeClass || 'text-xs',
  )
  const uiPanelTextFontClass = useGraphStore(
    s => s.uiPanelTextFontClass || 'font-sans',
  )
  const buttonClassName = `App-toolbar__btn ${uiPanelKeyValueTextSizeClass} bg-gray-50 text-gray-700 px-1 py-0.5`
  const [isUrlInputOpen, setIsUrlInputOpen] = React.useState(false)
  const [urlInputValue, setUrlInputValue] = React.useState('')
  const urlInputRef = React.useRef<HTMLInputElement | null>(null)

  React.useEffect(() => {
    if (!isOpen) {
      setIsUrlInputOpen(false)
      setUrlInputValue('')
    }
  }, [isOpen])

  React.useEffect(() => {
    if (isUrlInputOpen) {
      urlInputRef.current?.focus()
    }
  }, [isUrlInputOpen])

  if (!isOpen) return null

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-col gap-1 px-1">
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            className={buttonClassName}
            onClick={() => {
              setIsOpen(false)
              onToolMenuAction('sourceFiles', 'importLocal', { format })
            }}
          >
            {UI_COPY.toolbarMarkdownImportLocalDeviceButtonLabel}
          </button>
          <button
            type="button"
            className={buttonClassName}
            onClick={() => setIsUrlInputOpen(v => !v)}
          >
            {UI_COPY.toolbarJsonImportUrlButtonLabel}
          </button>
        </div>
        {isUrlInputOpen && (
          <form
            className="flex items-center justify-end"
            onSubmit={(e) => {
              e.preventDefault()
              const url = urlInputValue.trim()
              if (!url) return
              setIsOpen(false)
              setIsUrlInputOpen(false)
              setUrlInputValue('')
              onToolMenuAction('sourceFiles', 'importUrl', { format, url })
            }}
          >
            <input
              ref={urlInputRef}
              value={urlInputValue}
              onChange={e => setUrlInputValue(e.target.value)}
              placeholder={UI_COPY.jsonImportUrlPrompt}
              className={`w-full h-7 px-2 border border-gray-300 rounded bg-white text-gray-700 text-left ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass}`}
            />
          </form>
        )}
      </div>
    </div>
  )
}

export function ToolbarSourceFilesArea(props: ToolbarToolMenuAreasProps) {
  const uiPanelKeyValueTextSizeClass = useGraphStore(
    s => s.uiPanelKeyValueTextSizeClass || 'text-xs',
  )
  const buttonClassName = `App-toolbar__btn ${uiPanelKeyValueTextSizeClass} bg-gray-50 text-gray-700`
  const activeClassName = `App-toolbar__btn ${uiPanelKeyValueTextSizeClass} bg-blue-600 text-white`

  const {
    isSourceFilesImportMenuOpen,
    isSourceFilesExportMenuOpen,
    setIsSourceFilesExportMenuOpen,
    onExportGraphJson,
    onExportGraphJsonLd,
    onExportGraphCsvCombined,
    onCopyGraphJsonLd,
    onCopyGraphJson,
    onToolMenuAction,
    isMarkdownImportMenuOpen,
    setIsMarkdownImportMenuOpen,
    isHtmlImportMenuOpen,
    setIsHtmlImportMenuOpen,
    isPdfImportMenuOpen,
    setIsPdfImportMenuOpen,
    isJsonImportMenuOpen,
    setIsJsonImportMenuOpen,
    isJsonLdImportMenuOpen,
    setIsJsonLdImportMenuOpen,
  } = props

  // Helper to close all import sub-menus
  const closeAllImportMenus = () => {
    setIsMarkdownImportMenuOpen(false)
    setIsHtmlImportMenuOpen(false)
    setIsPdfImportMenuOpen(false)
    setIsJsonImportMenuOpen(false)
    setIsJsonLdImportMenuOpen(false)
  }

  return (
    <div className="flex flex-col gap-1">
      {/* Import Menu */}
      {isSourceFilesImportMenuOpen && (
        <div className="flex flex-col gap-1 px-1">
          <div className="flex flex-wrap items-center justify-end gap-1">
            <button
              type="button"
              className={isMarkdownImportMenuOpen ? activeClassName : buttonClassName}
              onClick={() => {
                const wasOpen = isMarkdownImportMenuOpen
                closeAllImportMenus()
                if (!wasOpen) setIsMarkdownImportMenuOpen(true)
              }}
            >
              {UI_LABELS.markdown}
            </button>
            <button
              type="button"
              className={isHtmlImportMenuOpen ? activeClassName : buttonClassName}
              onClick={() => {
                const wasOpen = isHtmlImportMenuOpen
                closeAllImportMenus()
                if (!wasOpen) setIsHtmlImportMenuOpen(true)
              }}
            >
              {UI_LABELS.html}
            </button>
            <button
              type="button"
              className={isPdfImportMenuOpen ? activeClassName : buttonClassName}
              onClick={() => {
                const wasOpen = isPdfImportMenuOpen
                closeAllImportMenus()
                if (!wasOpen) setIsPdfImportMenuOpen(true)
              }}
            >
              {UI_LABELS.pdf}
            </button>
            <button
              type="button"
              className={isJsonLdImportMenuOpen ? activeClassName : buttonClassName}
              onClick={() => {
                const wasOpen = isJsonLdImportMenuOpen
                closeAllImportMenus()
                if (!wasOpen) setIsJsonLdImportMenuOpen(true)
              }}
            >
              {UI_LABELS.jsonLd}
            </button>
            <button
              type="button"
              className={isJsonImportMenuOpen ? activeClassName : buttonClassName}
              onClick={() => {
                const wasOpen = isJsonImportMenuOpen
                closeAllImportMenus()
                if (!wasOpen) setIsJsonImportMenuOpen(true)
              }}
            >
              {EXPORT_UI_LABELS.exportGraphJson}
            </button>
          </div>

          {/* Render active import area */}
          {isMarkdownImportMenuOpen && <ToolbarMarkdownArea {...props} />}
          {isHtmlImportMenuOpen && <ToolbarHtmlArea {...props} />}
          {isPdfImportMenuOpen && <ToolbarPdfArea {...props} />}
          {isJsonLdImportMenuOpen && (
            <JsonImportArea
              format="jsonld"
              isOpen={isJsonLdImportMenuOpen}
              setIsOpen={setIsJsonLdImportMenuOpen}
              onToolMenuAction={onToolMenuAction}
            />
          )}
          {isJsonImportMenuOpen && (
            <JsonImportArea
              format="json"
              isOpen={isJsonImportMenuOpen}
              setIsOpen={setIsJsonImportMenuOpen}
              onToolMenuAction={onToolMenuAction}
            />
          )}
        </div>
      )}

      {/* Export Menu (consolidated from Curator) */}
      {isSourceFilesExportMenuOpen && (
        <div className="flex flex-col gap-1 px-1">
          <div className="flex flex-wrap items-center justify-end gap-1">
            <button
              type="button"
              className={activeClassName}
              onClick={() => {
                onExportGraphJson()
                setIsSourceFilesExportMenuOpen(false)
              }}
            >
              {UI_LABELS.json}
            </button>
            <button
              type="button"
              className={buttonClassName}
              onClick={() => {
                onToolMenuAction('sourceFiles', 'export', { format: 'markdown' })
                setIsSourceFilesExportMenuOpen(false)
              }}
            >
              {EXPORT_UI_LABELS.exportDocumentMarkdown}
            </button>
            <button
              type="button"
              className={buttonClassName}
              onClick={() => {
                onToolMenuAction('sourceFiles', 'export', { format: 'html' })
                setIsSourceFilesExportMenuOpen(false)
              }}
            >
              {EXPORT_UI_LABELS.exportDocumentHtml}
            </button>
            <button
              type="button"
              className={buttonClassName}
              onClick={() => {
                onToolMenuAction('sourceFiles', 'export', { format: 'pdf' })
                setIsSourceFilesExportMenuOpen(false)
              }}
            >
              {EXPORT_UI_LABELS.exportDocumentPdf}
            </button>
            <button
              type="button"
              className={buttonClassName}
              onClick={() => {
                onExportGraphJsonLd()
                setIsSourceFilesExportMenuOpen(false)
              }}
            >
              {EXPORT_UI_LABELS.exportGraphJsonLd}
            </button>
            {onCopyGraphJsonLd && (
              <button
                type="button"
                className={buttonClassName}
                onClick={() => {
                  onCopyGraphJsonLd()
                  setIsSourceFilesExportMenuOpen(false)
                }}
              >
                {EXPORT_UI_LABELS.copyGraphJsonLd}
              </button>
            )}
            <button
              type="button"
              className={buttonClassName}
              onClick={() => {
                onExportGraphCsvCombined()
                setIsSourceFilesExportMenuOpen(false)
              }}
            >
              {EXPORT_UI_LABELS.exportGraphCsvCombined}
            </button>
            {onCopyGraphJson && (
              <button
                type="button"
                className={buttonClassName}
                onClick={() => {
                  onCopyGraphJson()
                  setIsSourceFilesExportMenuOpen(false)
                }}
              >
                {EXPORT_UI_LABELS.copyGraphJson}
              </button>
            )}
          </div>
        </div>
      )}

      <div className="flex items-center justify-end gap-2">
        <StatusBadge label={UI_LABELS.sourceFiles} ok={props.dataLoadOk} msg={props.dataLoadMsg} />
      </div>
    </div>
  )
}
