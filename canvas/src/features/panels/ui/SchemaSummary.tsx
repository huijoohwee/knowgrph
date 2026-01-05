import { useGraphStore } from '@/hooks/useGraphStore'
import Tooltip from '@/features/panels/ui/Tooltip'
import { getBottomTabLabel } from '@/features/panels/config'
import { toSchemaImportFileName } from '@/features/schema-editor/utils'

interface SchemaSummaryProps {
  className?: string
  variant?: 'full' | 'inline'
  showTitle?: boolean
  showSchemaSummary?: boolean
  showDataSummary?: boolean
  showLintSummary?: boolean
  onOpenSchemaUiEditor?: () => void
}

export default function SchemaSummary({
  className,
  variant = 'full',
  showTitle,
  showSchemaSummary,
  showDataSummary,
  showLintSummary,
  onOpenSchemaUiEditor,
}: SchemaSummaryProps) {
  const schema = useGraphStore(s => s.schema)
  const data = useGraphStore(s => s.graphData)
  const schemaImportLabel = useGraphStore(s => s.schemaImportLabel)
  const schemaOpOk = useGraphStore(s => s.schemaOpOk)
  const schemaOpMsg = useGraphStore(s => s.schemaOpMsg)
  const lintCount = useGraphStore(s => s.schemaLintCount)
  const lintExamplePath = useGraphStore(s => s.schemaLintExamplePath)
  const lintExamplePaths = useGraphStore(s => s.schemaLintExamplePaths)
  const setSchemaLintActivePath = useGraphStore(s => s.setSchemaLintActivePath)
  const uiPanelMicroLabelTextSizeClass = useGraphStore(
    s => s.uiPanelMicroLabelTextSizeClass || 'text-xs',
  )

  const resolvedShowTitle = showTitle ?? variant === 'full'
  const resolvedShowSchemaSummary = showSchemaSummary ?? true
  const resolvedShowDataSummary = showDataSummary ?? variant === 'full'
  const resolvedShowLintSummary = showLintSummary ?? variant === 'inline'

  const catalog = schema && schema.catalog
  const catalogNodeTypes = catalog && Array.isArray(catalog.nodeTypes) ? catalog.nodeTypes.length : 0
  const catalogEdgeLabels = catalog && Array.isArray(catalog.edgeLabels) ? catalog.edgeLabels.length : 0

  const fallbackNodeTypes =
    schema && schema.nodeStyles && typeof schema.nodeStyles === 'object'
      ? Object.keys(schema.nodeStyles).length
      : 0
  const fallbackEdgeLabels =
    schema && schema.edgeStyles && typeof schema.edgeStyles === 'object'
      ? Object.keys(schema.edgeStyles).length
      : 0

  const nodeTypes = catalogNodeTypes > 0 ? catalogNodeTypes : fallbackNodeTypes
  const edgeLabels = catalogEdgeLabels > 0 ? catalogEdgeLabels : fallbackEdgeLabels
  const nodesCount = data && Array.isArray(data.nodes) ? data.nodes.length : 0
  const edgesCount = data && Array.isArray(data.edges) ? data.edges.length : 0

  const hasSchema = nodeTypes > 0 || edgeLabels > 0
  const hasData = nodesCount > 0 || edgesCount > 0

  const schemaImportFileName = toSchemaImportFileName(schemaImportLabel)

  const schemaOpClass =
    schemaOpOk === true
      ? 'text-green-700'
      : schemaOpOk === false
        ? 'text-red-700'
        : ''

  let lintContent: JSX.Element | string = 'Lint: not run'
  if (lintCount != null) {
    if (lintCount === 0) {
      lintContent = 'Lint: 0 metadata warnings'
    } else {
      const label = lintCount === 1 ? 'warning' : 'warnings'
      const hasMultipleExamples = Array.isArray(lintExamplePaths) && lintExamplePaths.length > 1
      if (hasMultipleExamples) {
        const currentValue =
          lintExamplePath && lintExamplePaths.includes(lintExamplePath) ? lintExamplePath : ''
        lintContent = (
          <>
            Lint: {lintCount} metadata {label}{' '}
            <select
              className="ml-1 px-1 py-0.5 text-xs border border-gray-300 rounded bg-white"
              value={currentValue}
              onChange={e => {
                const nextPath = e.target.value
                if (!nextPath) return
                setSchemaLintActivePath(nextPath)
                if (onOpenSchemaUiEditor) {
                  onOpenSchemaUiEditor()
                }
              }}
            >
              <option value="">(examples)</option>
              {lintExamplePaths.map(path => (
                <option key={path} value={path}>
                  {path}
                </option>
              ))}
            </select>
          </>
        )
      } else if (lintExamplePath) {
        lintContent = (
          <>
            Lint: {lintCount} metadata {label}{' '}
            (e.g.,{' '}
            <button
              type="button"
              className="underline text-blue-600 hover:text-blue-800 focus:outline-none"
              onClick={() => {
                if (onOpenSchemaUiEditor) {
                  onOpenSchemaUiEditor()
                }
              }}
            >
              {lintExamplePath}
            </button>
            )
          </>
        )
      } else {
        lintContent = `Lint: ${lintCount} metadata ${label}`
      }
    }
  }

  const sections: Array<JSX.Element> = []
  if (resolvedShowTitle) {
    sections.push(<div key="title" className="font-semibold uppercase tracking-wide text-gray-500">SCHEMA SUMMARY</div>)
  }
  if (resolvedShowSchemaSummary) {
    sections.push(
      <Tooltip
        key="schema"
        content={
          hasSchema
            ? 'Counts of node types and edge labels in the active schema.'
            : 'No schema is currently applied. Use the Schema Configurator tab to load or edit a schema.'
        }
        maxWidthPx={260}
        contentClassName="bg-gray-800/90"
      >
        <span className={hasSchema ? '' : 'text-amber-700 font-medium'}>
          {hasSchema ? (
            <>
              Schema: {nodeTypes} node types · {edgeLabels} edge labels · Import: {schemaImportFileName || 'none'}
              {schemaOpMsg ? (
                <> · <span className={schemaOpClass}>Status: {schemaOpMsg}</span></>
              ) : null}
            </>
          ) : (
            <>
              Schema: none (no schema applied) · Import: {schemaImportFileName || 'none'}
              {schemaOpMsg ? (
                <> · <span className={schemaOpClass}>Status: {schemaOpMsg}</span></>
              ) : null}
            </>
          )}
        </span>
      </Tooltip>,
    )
  }
  if (resolvedShowDataSummary) {
    sections.push(
      <Tooltip
        key="data"
        content={
          hasData
            ? 'Counts of nodes and edges in the loaded graph data.'
            : `No graph data is currently loaded. Use Load Data or the bottom panel ${getBottomTabLabel('data')} tab to load a dataset.`
        }
        maxWidthPx={260}
        contentClassName="bg-gray-800/90"
      >
        <span className={hasData ? '' : 'text-amber-700 font-medium'}>
          {hasData ? (
            <>Data: {nodesCount} nodes · {edgesCount} edges</>
          ) : (
            'Data: none loaded'
          )}
        </span>
      </Tooltip>,
    )
  }
  if (resolvedShowLintSummary) {
    sections.push(<span key="lint">{lintContent}</span>)
  }

  return (
    <div className={className ?? (variant === 'full' ? 'mb-1' : undefined)}>
      <div
        className={[
          'inline-flex items-center gap-2 text-gray-600',
          uiPanelMicroLabelTextSizeClass,
        ].join(' ')}
      >
        {sections.map((section, i) => (
          <span key={i} className="inline-flex items-center gap-2">
            {i > 0 ? <span className="text-gray-300">|</span> : null}
            {section}
          </span>
        ))}
      </div>
    </div>
  )
}
