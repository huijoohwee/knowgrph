import StatusBadge from '@/features/panels/ui/StatusBadge'
import { useGraphStore } from '@/hooks/useGraphStore'
import { pickDirectoryForWrite, isDirectoryPickerWriteSupported } from '@/lib/fsAccess/writeTextFileToDirectory'
import { openSaveFilePickerHandle } from '@/lib/graph/save'
import { getPublishCapabilities } from '@/lib/fsAccess/publishCapabilities'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'

type WorkflowExportActionsProps = {
  exportedThisSession: boolean
  exportedAt: string | null
  onExportAll: () => void
  onExportGraphJsonLd: () => void
  onExportGraphJson: () => void
  onExportGraphCsvCombined: () => void
  onExportGraphMl: () => void
  onExportGraphCypher: () => void
  onExportSettingsJsonLd: () => void
  onExportHistoryJsonLd: () => void
  onExportGraphFieldSettingsJsonLd: () => void
  onExportGraphRagWorkflowJsonLd?: () => void
  onExportParsers?: () => void
  onExportSvgSnapshot: () => void
  onExportPngSnapshot: () => void
  onExportHtmlViewer?: () => void
  onExportHtmlCanvas?: () => void
  onCopyGraphJsonLd: () => void
  onCopyGraphJson: () => void
  onExportValidationJson: () => void
  onExportValidationMarkdown: () => void
  onExportSelectionValidationJson?: () => void
  onExportSelectionValidationMarkdown?: () => void
  onExportSchemaJson: () => void
  onExportSchemaJsonLd: () => void
  onExportSchemaCsv: () => void
  onCopySchemaJsonLd?: () => void
  onCopySchemaJson?: () => void
  graphHeading?: string
  schemaHeading?: string
  hasSelection: boolean
  selectionSummary?: string
  onExportSelectionJsonLd?: () => void
  onExportSelectionJson?: () => void
  onExportSelectionCsvCombined?: () => void
  onExportSelectionGraphMl?: () => void
  onExportSelectionCypher?: () => void
}

export default function WorkflowExportActions({
  exportedThisSession,
  exportedAt,
  onExportAll,
  onExportGraphJsonLd,
  onExportGraphJson,
  onExportGraphCsvCombined,
  onExportGraphMl,
  onExportGraphCypher,
  onExportSettingsJsonLd,
  onExportHistoryJsonLd,
  onExportGraphFieldSettingsJsonLd,
  onExportGraphRagWorkflowJsonLd,
  onExportParsers,
  onExportSvgSnapshot,
  onExportPngSnapshot,
  onExportHtmlViewer,
  onExportHtmlCanvas,
  onCopyGraphJsonLd,
  onCopyGraphJson,
  onExportValidationJson,
  onExportValidationMarkdown,
  onExportSelectionValidationJson,
  onExportSelectionValidationMarkdown,
  onExportSchemaJson,
  onExportSchemaJsonLd,
  onExportSchemaCsv,
  onCopySchemaJsonLd,
  onCopySchemaJson,
  graphHeading,
  schemaHeading,
  hasSelection,
  selectionSummary,
  onExportSelectionJsonLd,
  onExportSelectionJson,
  onExportSelectionCsvCombined,
  onExportSelectionGraphMl,
  onExportSelectionCypher,
}: WorkflowExportActionsProps) {
  const publishCaps = getPublishCapabilities()
  const uiPanelKeyValueTextSizeClass = useGraphStore(
    s => s.uiPanelKeyValueTextSizeClass || 'text-sm',
  )
  const uiPanelTextFontClass = useGraphStore(
    s => s.uiPanelTextFontClass || 'font-sans',
  )
  const uiPanelKeyValueInputClass = useGraphStore(
    s => s.uiPanelKeyValueInputClass,
  )
  const neutralActionButtonClassName = `App-toolbar__btn ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} ${UI_THEME_TOKENS.button.neutralMuted} ${UI_THEME_TOKENS.button.hoverBg}`
  const neutralActionButtonDisabledClassName = `${neutralActionButtonClassName} disabled:opacity-40 disabled:cursor-not-allowed`
  const secondaryTextClassName = `${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} ${UI_THEME_TOKENS.text.secondary}`
  const tertiaryTextClassName = `${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} ${UI_THEME_TOKENS.text.tertiary}`

  const htmlCanvasPublishFolderName = useGraphStore(s => s.htmlCanvasPublishFolderName)
  const htmlCanvasPublishFileName = useGraphStore(s => s.htmlCanvasPublishFileName)
  const htmlCanvasPublishPath = useGraphStore(s => s.htmlCanvasPublishPath)
  const setHtmlCanvasPublishFolder = useGraphStore(s => s.setHtmlCanvasPublishFolder)
  const setHtmlCanvasPublishFile = useGraphStore(s => s.setHtmlCanvasPublishFile)
  const clearHtmlCanvasPublishTarget = useGraphStore(s => s.clearHtmlCanvasPublishTarget)
  const setHtmlCanvasPublishPath = useGraphStore(s => s.setHtmlCanvasPublishPath)
  const pushUiToast = useGraphStore(s => s.pushUiToast)

  const openHtmlCanvasPublishFolder = async () => {
    if (!publishCaps.isSecureContext) {
      pushUiToast({
        id: 'export-html-canvas-publish-not-secure',
        kind: 'warning',
        message: 'Folder publishing requires a secure context (https or localhost).',
      })
      return
    }
    if (!publishCaps.isTopLevel) {
      pushUiToast({
        id: 'export-html-canvas-publish-embedded',
        kind: 'warning',
        message: 'Folder publishing may be blocked when running inside an iframe.',
      })
    }

    const handle = await pickDirectoryForWrite()
    if (handle === '') return
    if (!handle) {
      await openHtmlCanvasPublishFile()
      return
    }
    setHtmlCanvasPublishFolder(handle)
    pushUiToast({
      id: 'export-html-canvas-publish-folder-set',
      kind: 'success',
      message: `Publish folder set: ${String(handle.name || '').trim() || 'Local folder'}`,
    })
  }

  const openHtmlCanvasPublishFile = async () => {
    if (!publishCaps.isSecureContext) {
      pushUiToast({
        id: 'export-html-canvas-publish-file-not-secure',
        kind: 'warning',
        message: 'Publishing requires a secure context (https or localhost).',
      })
      return
    }
    if (!publishCaps.isTopLevel) {
      pushUiToast({
        id: 'export-html-canvas-publish-file-embedded',
        kind: 'warning',
        message: 'Publishing may be blocked when running inside an iframe.',
      })
    }
    const suggestedName = String(htmlCanvasPublishPath || 'index.html').replace(/\{mode\}/g, '3d')
    const handle = await openSaveFilePickerHandle(suggestedName, {
      description: 'HTML Files',
      accept: { 'text/html': ['.html', '.htm'] },
    })
    if (handle === '') return
    if (!handle) {
      pushUiToast({
        id: 'export-html-canvas-publish-file-unsupported',
        kind: 'warning',
        message: 'Publish-to-file is not supported in this browser. Use the normal download export.',
      })
      return
    }
    setHtmlCanvasPublishFile(handle, handle.name || suggestedName)
    pushUiToast({
      id: 'export-html-canvas-publish-file-set',
      kind: 'success',
      message: `Publish file set: ${String(handle.name || suggestedName).trim() || 'Selected file'}`,
    })
  }
  return (
    <>
      <section className="flex items-center gap-2 mb-2">
        <button
          type="button"
          className={neutralActionButtonClassName}
          onClick={onExportAll}
        >
          Export All
        </button>
        <section className="ml-auto">
          <StatusBadge
            label="Export"
            ok={exportedThisSession ? true : null}
            msg={exportedThisSession && exportedAt ? `Exported at ${exportedAt}` : ''}
            below
          />
        </section>
      </section>
      {graphHeading && (
        <section className={`${secondaryTextClassName} mb-1`}>
          {graphHeading}
        </section>
      )}
      <section className="flex flex-wrap items-center gap-2 mb-2">
        <button
          type="button"
          className={neutralActionButtonClassName}
          onClick={onExportGraphJsonLd}
        >
          Export Graph JSON-LD (AgenticRAG)
        </button>
        <button
          type="button"
          className={neutralActionButtonClassName}
          onClick={onExportGraphJson}
        >
          Export Graph JSON
        </button>
        <button
          type="button"
          className={neutralActionButtonClassName}
          onClick={onExportGraphCsvCombined}
        >
          Export Graph CSV Combined
        </button>
        <button
          type="button"
          className={neutralActionButtonClassName}
          onClick={onExportGraphMl}
        >
          Export GraphML
        </button>
        <button
          type="button"
          className={neutralActionButtonClassName}
          onClick={onExportGraphCypher}
        >
          Export Graph Cypher
        </button>
      </section>
      <section className="flex flex-wrap items-center gap-2 mb-2">
        <button
          type="button"
          className={neutralActionButtonClassName}
          onClick={onExportSettingsJsonLd}
        >
          Export Settings JSON-LD (AgenticRAG)
        </button>
        <button
          type="button"
          className={neutralActionButtonClassName}
          onClick={onExportHistoryJsonLd}
        >
          Export History JSON-LD (AgenticRAG)
        </button>
        <button
          type="button"
          className={neutralActionButtonClassName}
          onClick={onExportGraphFieldSettingsJsonLd}
        >
          Export Graph Field Settings JSON-LD (AgenticRAG)
        </button>
        {onExportGraphRagWorkflowJsonLd && (
          <button
            type="button"
            className={neutralActionButtonClassName}
            onClick={onExportGraphRagWorkflowJsonLd}
          >
            Export GraphRAG Workflow JSON-LD
          </button>
        )}
        {onExportParsers && (
          <button
            type="button"
            className={neutralActionButtonClassName}
            onClick={onExportParsers}
          >
            Export Parsers
          </button>
        )}
      </section>
      <section className="flex flex-wrap items-center gap-2 mb-2">
        <button
          type="button"
          className={neutralActionButtonClassName}
          onClick={onExportSvgSnapshot}
        >
          Export Graph SVG Snapshot
        </button>
        <button
          type="button"
          className={neutralActionButtonClassName}
          onClick={onExportPngSnapshot}
        >
          Export Graph PNG Snapshot
        </button>
        {onExportHtmlViewer ? (
          <button
            type="button"
            className={neutralActionButtonClassName}
            onClick={onExportHtmlViewer}
          >
            Export Graph HTML Viewer
          </button>
        ) : null}
        {onExportHtmlCanvas ? (
          <button
            type="button"
            className={neutralActionButtonClassName}
            onClick={onExportHtmlCanvas}
          >
            Export HTML Canvas
          </button>
        ) : null}
        {onExportHtmlCanvas ? (
          <section className="w-full flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={neutralActionButtonClassName}
              onClick={openHtmlCanvasPublishFolder}
            >
              Set Publish Folder
            </button>
            <button
              type="button"
              className={neutralActionButtonClassName}
              onClick={openHtmlCanvasPublishFile}
            >
              Set Publish File
            </button>
            <button
              type="button"
              className={neutralActionButtonClassName}
              onClick={() => clearHtmlCanvasPublishTarget()}
            >
              Clear
            </button>
            <input
              className={uiPanelKeyValueInputClass}
              value={String(htmlCanvasPublishPath || '')}
              onChange={e => setHtmlCanvasPublishPath(e.target.value)}
              placeholder="index.html or data/canvas-{mode}.html"
            />
            {!publishCaps.isSecureContext ? (
              <span className={secondaryTextClassName}>
                Publishing disabled on `file://`; use `http://localhost` or `https://`.
              </span>
            ) : !publishCaps.isTopLevel ? (
              <span className={secondaryTextClassName}>
                Running in iframe; pickers may be blocked.
              </span>
            ) : null}
            {htmlCanvasPublishFolderName ? (
              <span className={secondaryTextClassName}>
                {isDirectoryPickerWriteSupported() ? htmlCanvasPublishFolderName : `${htmlCanvasPublishFolderName} (folder picker unsupported)`}
              </span>
            ) : htmlCanvasPublishFileName ? (
              <span className={secondaryTextClassName}>
                {htmlCanvasPublishFileName}
              </span>
            ) : !isDirectoryPickerWriteSupported() ? (
              <span className={secondaryTextClassName}>
                Folder picker not supported; use “Set Publish File” or save via download.
              </span>
            ) : null}
          </section>
        ) : null}
        <button
          type="button"
          className={neutralActionButtonClassName}
          onClick={onCopyGraphJsonLd}
        >
          Copy Graph JSON-LD (AgenticRAG)
        </button>
        <button
          type="button"
          className={neutralActionButtonClassName}
          onClick={onCopyGraphJson}
        >
          Copy Graph JSON
        </button>
      </section>
      <section className="flex flex-wrap items-center gap-2 mb-1">
        <button
          type="button"
          className={neutralActionButtonDisabledClassName}
          onClick={onExportSelectionJsonLd}
          disabled={!hasSelection || !onExportSelectionJsonLd}
        >
          Export Selection JSON-LD (AgenticRAG)
        </button>
        <button
          type="button"
          className={neutralActionButtonDisabledClassName}
          onClick={onExportSelectionJson}
          disabled={!hasSelection || !onExportSelectionJson}
        >
          Export Selection JSON
        </button>
        <button
          type="button"
          className={neutralActionButtonDisabledClassName}
          onClick={onExportSelectionCsvCombined}
          disabled={!hasSelection || !onExportSelectionCsvCombined}
        >
          Export Selection CSV Combined
        </button>
        <button
          type="button"
          className={neutralActionButtonDisabledClassName}
          onClick={onExportSelectionGraphMl}
          disabled={!hasSelection || !onExportSelectionGraphMl}
        >
          Export Selection GraphML
        </button>
        <button
          type="button"
          className={neutralActionButtonDisabledClassName}
          onClick={onExportSelectionCypher}
          disabled={!hasSelection || !onExportSelectionCypher}
        >
          Export Selection Cypher
        </button>
      </section>
      {selectionSummary && (
        <section className={`${tertiaryTextClassName} mb-2`}>
          {selectionSummary}
        </section>
      )}
      {schemaHeading && (
        <section className={`${secondaryTextClassName} mb-1`}>
          {schemaHeading}
        </section>
      )}
      <section className="flex flex-wrap items-center gap-2 mb-2">
        <button
          type="button"
          className={neutralActionButtonClassName}
          onClick={onExportSchemaJson}
        >
          Export Schema JSON
        </button>
        <button
          type="button"
          className={neutralActionButtonClassName}
          onClick={onExportSchemaJsonLd}
        >
          Export Schema JSON-LD (AgenticRAG)
        </button>
        <button
          type="button"
          className={neutralActionButtonClassName}
          onClick={onExportSchemaCsv}
        >
          Export Schema CSV
        </button>
        {onCopySchemaJsonLd && (
          <button
            type="button"
            className={neutralActionButtonClassName}
            onClick={onCopySchemaJsonLd}
          >
            Copy Schema JSON-LD (AgenticRAG)
          </button>
        )}
        {onCopySchemaJson && (
          <button
            type="button"
            className={neutralActionButtonClassName}
            onClick={onCopySchemaJson}
          >
            Copy Schema JSON
          </button>
        )}
      </section>
      <section className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={neutralActionButtonClassName}
          onClick={onExportValidationJson}
        >
          Export Validation JSON
        </button>
        <button
          type="button"
          className={neutralActionButtonClassName}
          onClick={onExportValidationMarkdown}
        >
          Export Validation Markdown
        </button>
        <button
          type="button"
          className={neutralActionButtonDisabledClassName}
          onClick={onExportSelectionValidationJson}
          disabled={!hasSelection || !onExportSelectionValidationJson}
        >
          Export Selection Validation JSON
        </button>
        <button
          type="button"
          className={neutralActionButtonDisabledClassName}
          onClick={onExportSelectionValidationMarkdown}
          disabled={!hasSelection || !onExportSelectionValidationMarkdown}
        >
          Export Selection Validation Markdown
        </button>
      </section>
    </>
  )
}
