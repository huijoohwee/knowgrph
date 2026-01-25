import React from 'react'
import StatusBadge from '@/features/panels/ui/StatusBadge'
import { useGraphStore } from '@/hooks/useGraphStore'
import { EXPORT_UI_LABELS, UI_COPY, UI_LABELS } from '@/lib/config'
import type { ToolbarToolMenuAreasProps } from '@/features/toolbar/ToolbarToolMenuAreas.registry'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { ToolbarMarkdownArea } from './ToolbarMarkdownArea'
import { ToolbarHtmlArea } from './ToolbarHtmlArea'
import { ToolbarPdfArea } from './ToolbarPdfArea'
import { ToolbarYouTubeArea } from './ToolbarYouTubeArea'
import { ToolbarSourceFilesImportPanel } from './ToolbarSourceFilesImportPanel'
import { normalizeGitHubBlobLikeUrl, splitUserProvidedTextList } from '@/lib/url'

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
  const uiPanelTextFontClass = useGraphStore(
    s => s.uiPanelTextFontClass || 'font-sans',
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
    isYouTubeImportMenuOpen,
    setIsYouTubeImportMenuOpen,
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
    setIsYouTubeImportMenuOpen(false)
    setIsJsonImportMenuOpen(false)
    setIsJsonLdImportMenuOpen(false)
  }

  const [quickImportFormat, setQuickImportFormat] = React.useState<
    'markdown' | 'html' | 'pdf' | 'youtube' | 'jsonld' | 'json' | 'csv'
  >('markdown')
  const [quickImportUrlsText, setQuickImportUrlsText] = React.useState('')

  const quickImportUrls = React.useMemo(() => {
    const list = splitUserProvidedTextList(quickImportUrlsText)
    if (!list || list.length === 0) return []
    if (quickImportFormat === 'youtube') return list
    return list.map(u => normalizeGitHubBlobLikeUrl(u) || u)
  }, [quickImportUrlsText, quickImportFormat])

  const canQuickImportLocal = quickImportFormat !== 'youtube'
  const canQuickImportUrl = quickImportFormat !== 'csv'

  const openAdvancedForFormat = React.useCallback(
    (format: typeof quickImportFormat) => {
      const toFlag = (f: typeof quickImportFormat) => {
        if (f === 'markdown') return setIsMarkdownImportMenuOpen
        if (f === 'html') return setIsHtmlImportMenuOpen
        if (f === 'pdf') return setIsPdfImportMenuOpen
        if (f === 'youtube') return setIsYouTubeImportMenuOpen
        if (f === 'jsonld') return setIsJsonLdImportMenuOpen
        if (f === 'json') return setIsJsonImportMenuOpen
        return null
      }
      const setter = toFlag(format)
      if (!setter) return
      closeAllImportMenus()
      setter(true)
    },
    [
      closeAllImportMenus,
      setIsHtmlImportMenuOpen,
      setIsJsonImportMenuOpen,
      setIsJsonLdImportMenuOpen,
      setIsMarkdownImportMenuOpen,
      setIsPdfImportMenuOpen,
      setIsYouTubeImportMenuOpen,
    ],
  )

  return (
    <div className="flex flex-col gap-1">
      {/* Import Menu */}
      {isSourceFilesImportMenuOpen && (
        <div className="flex flex-col gap-1 px-1">
          <ToolbarSourceFilesImportPanel />

          <div className={`grid grid-cols-1 gap-2 px-1 ${uiPanelTextFontClass}`}>
            <div className="flex items-center justify-end gap-2">
              <div className={`${uiPanelKeyValueTextSizeClass} ${UI_THEME_TOKENS.text.secondary}`}>{UI_COPY.sourceFilesQuickImportFormatLabel}</div>
              <select
                className={`rounded border px-2 py-1 ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.input.bg} ${UI_THEME_TOKENS.input.text} ${uiPanelKeyValueTextSizeClass}`}
                value={quickImportFormat}
                onChange={e => setQuickImportFormat(e.target.value as typeof quickImportFormat)}
              >
                <option value="markdown">{UI_LABELS.markdown}</option>
                <option value="html">{UI_LABELS.html}</option>
                <option value="pdf">{UI_LABELS.pdf}</option>
                <option value="youtube">{UI_LABELS.youtube}</option>
                <option value="jsonld">{UI_LABELS.jsonLd}</option>
                <option value="json">{UI_LABELS.json}</option>
                <option value="csv">{UI_LABELS.csv}</option>
              </select>

              <button
                type="button"
                className={buttonClassName}
                onClick={() => {
                  closeAllImportMenus()
                  if (!canQuickImportLocal) return
                  onToolMenuAction('sourceFiles', 'importLocal', { format: quickImportFormat })
                }}
                disabled={!canQuickImportLocal}
              >
                {UI_COPY.toolbarMarkdownImportLocalDeviceButtonLabel}
              </button>
            </div>

            <form
              className="flex items-center justify-end gap-2"
              onSubmit={e => {
                e.preventDefault()
                if (!canQuickImportUrl) return
                if (!quickImportUrls || quickImportUrls.length === 0) return
                closeAllImportMenus()
                for (const url of quickImportUrls) {
                  onToolMenuAction('sourceFiles', 'importUrl', { format: quickImportFormat, url })
                }
                setQuickImportUrlsText('')
              }}
            >
              <textarea
                className={`flex-1 rounded border px-2 py-1 ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.input.bg} ${UI_THEME_TOKENS.input.text} resize-y min-h-[34px] ${uiPanelKeyValueTextSizeClass}`}
                placeholder={UI_COPY.sourceFilesQuickImportUrlsPlaceholder}
                value={quickImportUrlsText}
                onChange={e => setQuickImportUrlsText(e.target.value)}
                rows={1}
                disabled={!canQuickImportUrl}
              />
              <button
                type="submit"
                className={`${buttonClassName} px-2 py-1 ${quickImportUrls.length === 0 || !canQuickImportUrl ? UI_THEME_TOKENS.button.disabledText : ''}`}
                disabled={quickImportUrls.length === 0 || !canQuickImportUrl}
              >
                {UI_COPY.toolbarJsonImportUrlButtonLabel}
              </button>

              <button
                type="button"
                className={buttonClassName}
                onClick={() => openAdvancedForFormat(quickImportFormat)}
                disabled={quickImportFormat === 'csv'}
              >
                {UI_COPY.sourceFilesQuickImportAdvancedLabel}
              </button>
            </form>
          </div>

          {/* Render active import area */}
          {isMarkdownImportMenuOpen && <ToolbarMarkdownArea {...props} />}
          {isHtmlImportMenuOpen && <ToolbarHtmlArea {...props} />}
          {isPdfImportMenuOpen && <ToolbarPdfArea {...props} />}
          {isYouTubeImportMenuOpen && <ToolbarYouTubeArea {...props} />}
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
