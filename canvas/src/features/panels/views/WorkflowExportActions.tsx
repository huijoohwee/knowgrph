import StatusBadge from '@/features/panels/ui/StatusBadge'
import { useGraphStore } from '@/hooks/useGraphStore'

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
  const uiPanelKeyValueTextSizeClass = useGraphStore(
    s => s.uiPanelKeyValueTextSizeClass || 'text-sm',
  )
  const uiPanelTextFontClass = useGraphStore(
    s => s.uiPanelTextFontClass || 'font-sans',
  )
  return (
    <>
      <div className="flex items-center gap-2 mb-2">
        <button
          type="button"
          className={`App-toolbar__btn ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} bg-gray-100 text-gray-700`}
          onClick={onExportAll}
        >
          Export All
        </button>
        <div className="ml-auto">
          <StatusBadge
            label="Export"
            ok={exportedThisSession ? true : null}
            msg={exportedThisSession && exportedAt ? `Exported at ${exportedAt}` : ''}
            below
          />
        </div>
      </div>
      {graphHeading && (
        <div className={`${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} text-gray-600 mb-1`}>
          {graphHeading}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <button
          type="button"
          className={`App-toolbar__btn ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} bg-gray-100 text-gray-700`}
          onClick={onExportGraphJsonLd}
        >
          Export Graph JSON-LD (AgenticRAG)
        </button>
        <button
          type="button"
          className={`App-toolbar__btn ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} bg-gray-100 text-gray-700`}
          onClick={onExportGraphJson}
        >
          Export Graph JSON
        </button>
        <button
          type="button"
          className={`App-toolbar__btn ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} bg-gray-100 text-gray-700`}
          onClick={onExportGraphCsvCombined}
        >
          Export Graph CSV Combined
        </button>
        <button
          type="button"
          className={`App-toolbar__btn ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} bg-gray-100 text-gray-700`}
          onClick={onExportGraphMl}
        >
          Export GraphML
        </button>
        <button
          type="button"
          className={`App-toolbar__btn ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} bg-gray-100 text-gray-700`}
          onClick={onExportGraphCypher}
        >
          Export Graph Cypher
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <button
          type="button"
          className={`App-toolbar__btn ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} bg-gray-100 text-gray-700`}
          onClick={onExportSettingsJsonLd}
        >
          Export Settings JSON-LD (AgenticRAG)
        </button>
        <button
          type="button"
          className={`App-toolbar__btn ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} bg-gray-100 text-gray-700`}
          onClick={onExportHistoryJsonLd}
        >
          Export History JSON-LD (AgenticRAG)
        </button>
        <button
          type="button"
          className={`App-toolbar__btn ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} bg-gray-100 text-gray-700`}
          onClick={onExportGraphFieldSettingsJsonLd}
        >
          Export Graph Field Settings JSON-LD (AgenticRAG)
        </button>
        {onExportGraphRagWorkflowJsonLd && (
          <button
            type="button"
            className={`App-toolbar__btn ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} bg-gray-100 text-gray-700`}
            onClick={onExportGraphRagWorkflowJsonLd}
          >
            Export GraphRAG Workflow JSON-LD
          </button>
        )}
        {onExportParsers && (
          <button
            type="button"
            className={`App-toolbar__btn ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} bg-gray-100 text-gray-700`}
            onClick={onExportParsers}
          >
            Export Parsers
          </button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <button
          type="button"
          className={`App-toolbar__btn ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} bg-gray-100 text-gray-700`}
          onClick={onExportSvgSnapshot}
        >
          Export Graph SVG Snapshot
        </button>
        <button
          type="button"
          className={`App-toolbar__btn ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} bg-gray-100 text-gray-700`}
          onClick={onExportPngSnapshot}
        >
          Export Graph PNG Snapshot
        </button>
        {onExportHtmlViewer ? (
          <button
            type="button"
            className={`App-toolbar__btn ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} bg-gray-100 text-gray-700`}
            onClick={onExportHtmlViewer}
          >
            Export Graph HTML Viewer
          </button>
        ) : null}
        <button
          type="button"
          className={`App-toolbar__btn ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} bg-gray-100 text-gray-700`}
          onClick={onCopyGraphJsonLd}
        >
          Copy Graph JSON-LD (AgenticRAG)
        </button>
        <button
          type="button"
          className={`App-toolbar__btn ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} bg-gray-100 text-gray-700`}
          onClick={onCopyGraphJson}
        >
          Copy Graph JSON
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2 mb-1">
        <button
          type="button"
          className={`App-toolbar__btn ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} bg-gray-100 text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed`}
          onClick={onExportSelectionJsonLd}
          disabled={!hasSelection || !onExportSelectionJsonLd}
        >
          Export Selection JSON-LD (AgenticRAG)
        </button>
        <button
          type="button"
          className={`App-toolbar__btn ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} bg-gray-100 text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed`}
          onClick={onExportSelectionJson}
          disabled={!hasSelection || !onExportSelectionJson}
        >
          Export Selection JSON
        </button>
        <button
          type="button"
          className={`App-toolbar__btn ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} bg-gray-100 text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed`}
          onClick={onExportSelectionCsvCombined}
          disabled={!hasSelection || !onExportSelectionCsvCombined}
        >
          Export Selection CSV Combined
        </button>
        <button
          type="button"
          className={`App-toolbar__btn ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} bg-gray-100 text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed`}
          onClick={onExportSelectionGraphMl}
          disabled={!hasSelection || !onExportSelectionGraphMl}
        >
          Export Selection GraphML
        </button>
        <button
          type="button"
          className={`App-toolbar__btn ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} bg-gray-100 text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed`}
          onClick={onExportSelectionCypher}
          disabled={!hasSelection || !onExportSelectionCypher}
        >
          Export Selection Cypher
        </button>
      </div>
      {selectionSummary && (
        <div className={`${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} text-gray-500 mb-2`}>
          {selectionSummary}
        </div>
      )}
      {schemaHeading && (
        <div className={`${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} text-gray-600 mb-1`}>
          {schemaHeading}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <button
          type="button"
          className={`App-toolbar__btn ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} bg-gray-100 text-gray-700`}
          onClick={onExportSchemaJson}
        >
          Export Schema JSON
        </button>
        <button
          type="button"
          className={`App-toolbar__btn ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} bg-gray-100 text-gray-700`}
          onClick={onExportSchemaJsonLd}
        >
          Export Schema JSON-LD (AgenticRAG)
        </button>
        <button
          type="button"
          className={`App-toolbar__btn ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} bg-gray-100 text-gray-700`}
          onClick={onExportSchemaCsv}
        >
          Export Schema CSV
        </button>
        {onCopySchemaJsonLd && (
          <button
            type="button"
            className={`App-toolbar__btn ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} bg-gray-100 text-gray-700`}
            onClick={onCopySchemaJsonLd}
          >
            Copy Schema JSON-LD (AgenticRAG)
          </button>
        )}
        {onCopySchemaJson && (
          <button
            type="button"
            className={`App-toolbar__btn ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} bg-gray-100 text-gray-700`}
            onClick={onCopySchemaJson}
          >
            Copy Schema JSON
          </button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={`App-toolbar__btn ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} bg-gray-100 text-gray-700`}
          onClick={onExportValidationJson}
        >
          Export Validation JSON
        </button>
        <button
          type="button"
          className={`App-toolbar__btn ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} bg-gray-100 text-gray-700`}
          onClick={onExportValidationMarkdown}
        >
          Export Validation Markdown
        </button>
        <button
          type="button"
          className={`App-toolbar__btn ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} bg-gray-100 text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed`}
          onClick={onExportSelectionValidationJson}
          disabled={!hasSelection || !onExportSelectionValidationJson}
        >
          Export Selection Validation JSON
        </button>
        <button
          type="button"
          className={`App-toolbar__btn ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} bg-gray-100 text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed`}
          onClick={onExportSelectionValidationMarkdown}
          disabled={!hasSelection || !onExportSelectionValidationMarkdown}
        >
          Export Selection Validation Markdown
        </button>
      </div>
    </>
  )
}
