import React from 'react'
import { CheckCircle, AlertTriangle } from 'lucide-react'
import { useGraphStore } from '@/hooks/useGraphStore'
import { useParserUIState } from '@/features/parsers/uiState'
import { useSpotlightAnchor } from '@/features/spotlight/useSpotlightAnchor'
import { getSpotlightCardStyle } from '@/features/spotlight/positioning'
import StatusBadge from '@/features/panels/ui/StatusBadge'
import SchemaSummary from '@/features/panels/ui/SchemaSummary'
import { UI_LABELS } from '@/lib/config'
import { getIconSizeClass } from '@/lib/ui'
import { openBottomPanel } from '@/features/bottom-panel/open'

type LaunchSpotlightStatusCardProps = {
  dismissed: boolean
  ready: boolean
  minimized: boolean
  setMinimized: (next: boolean) => void
}

export function LaunchSpotlightStatusCard({
  dismissed,
  ready,
  minimized,
  setMinimized,
}: LaunchSpotlightStatusCardProps) {
  const enableSpotlight = useGraphStore(s => s.enableLaunchSpotlight)
  const graphData = useGraphStore(s => s.graphData)
  const selectedNodeId = useGraphStore(s => s.selectedNodeId)
  const schema = useGraphStore(s => s.schema)
  const schemaImportLabel = useGraphStore(s => s.schemaImportLabel)
  const schemaOpOk = useGraphStore(s => s.schemaOpOk)
  const schemaOpMsg = useGraphStore(s => s.schemaOpMsg)
  const schemaLintCount = useGraphStore(s => s.schemaLintCount)
  const graphFieldsOpOk = useGraphStore(s => s.graphFieldsOpOk)
  const graphFieldsOpMsg = useGraphStore(s => s.graphFieldsOpMsg)
  const orchestratorOpOk = useGraphStore(s => s.orchestratorOpOk)
  const orchestratorOpMsg = useGraphStore(s => s.orchestratorOpMsg)
  const renderOpOk = useGraphStore(s => s.renderOpOk)
  const renderOpMsg = useGraphStore(s => s.renderOpMsg)
  const graphValidationStatus = useGraphStore(s => s.graphValidationStatus)
  const graphValidationTimestamp = useGraphStore(s => s.graphValidationTimestamp)
  const setEnableLaunchSpotlight = useGraphStore(s => s.setEnableLaunchSpotlight)
  const parserLoadOk = useParserUIState(s => s.parserLoadOk)
  const parserLoadMsg = useParserUIState(s => s.parserLoadMsg)
  const dataLoadOk = useParserUIState(s => s.dataLoadOk)
  const dataLoadMsg = useParserUIState(s => s.dataLoadMsg)

  const uiIconScale = useGraphStore(s => s.uiIconScale)
  const iconSizeClass = getIconSizeClass(uiIconScale)
  const uiPanelKeyValueTextSizeClass = useGraphStore(
    s => s.uiPanelKeyValueTextSizeClass || 'text-xs',
  )

  const graphValidationStatusText = React.useMemo(() => {
    const status = graphValidationStatus
    const ts = graphValidationTimestamp
    if (!ts || !graphData) {
      return 'Graph validation not run'
    }
    const now = Date.now()
    const diffMs = now - ts
    const safeDiffMs = Number.isFinite(diffMs) && diffMs > 0 ? diffMs : 0
    const diffMinutes = Math.floor(safeDiffMs / 60000)
    const diffSeconds = Math.floor(safeDiffMs / 1000)
    const timePhrase = diffMinutes > 0 ? `${diffMinutes}m ago` : diffSeconds <= 5 ? 'just now' : `${diffSeconds}s ago`
    const statusPhrase = status === 'invalid' ? 'completed with errors' : 'completed'
    return `Graph validation ${statusPhrase} ${timePhrase}`
  }, [graphValidationStatus, graphValidationTimestamp, graphData])

  const { anchor, dragPos, cardRef, handleCardPointerDown } = useSpotlightAnchor({
    enabled: enableSpotlight,
    dismissed,
    ready,
    selector: null,
  })

  if (!enableSpotlight || dismissed || !ready) return null

  const selectedLabel = (() => {
    if (!graphData || !Array.isArray(graphData.nodes) || !selectedNodeId) return 'None'
    const found = graphData.nodes.find(n => n.id === selectedNodeId)
    return found && typeof found.label === 'string' && found.label.trim() ? found.label : selectedNodeId
  })()

  const catalog = schema && schema.catalog
  const catalogNodeTypes = catalog && Array.isArray(catalog.nodeTypes) ? catalog.nodeTypes.length : 0
  const catalogEdgeLabels = catalog && Array.isArray(catalog.edgeLabels) ? catalog.edgeLabels.length : 0
  const fallbackNodeTypes =
    schema && schema.nodeStyles && typeof schema.nodeStyles === 'object' ? Object.keys(schema.nodeStyles).length : 0
  const fallbackEdgeLabels =
    schema && schema.edgeStyles && typeof schema.edgeStyles === 'object' ? Object.keys(schema.edgeStyles).length : 0
  const nodeTypes = catalogNodeTypes > 0 ? catalogNodeTypes : fallbackNodeTypes
  const edgeLabels = catalogEdgeLabels > 0 ? catalogEdgeLabels : fallbackEdgeLabels
  const nodesCount = graphData && Array.isArray(graphData.nodes) ? graphData.nodes.length : 0
  const edgesCount = graphData && Array.isArray(graphData.edges) ? graphData.edges.length : 0
  const hasValidationRun = !!graphValidationTimestamp && !!graphData
  const validationIcon = hasValidationRun
    ? graphValidationStatus === 'invalid'
      ? <AlertTriangle className={`${iconSizeClass} text-red-500`} aria-hidden="true" />
      : <CheckCircle className={`${iconSizeClass} text-green-500`} aria-hidden="true" />
    : null
  const validationTextClass =
    !hasValidationRun ? 'text-gray-700' : graphValidationStatus === 'invalid' ? 'text-red-700' : 'text-green-700'

  const handleClose = () => {
    setEnableLaunchSpotlight(false)
  }

  const handleMinimizeStatus = () => {
    setMinimized(true)
  }

  const handleReopenStatus = () => {
    setMinimized(false)
  }

  const cardStyle = getSpotlightCardStyle(anchor, dragPos, minimized)
  const schemaImport = typeof schemaImportLabel === 'string' ? schemaImportLabel.trim() : ''
  const schemaDetails = `${nodeTypes} node types · ${edgeLabels} edge labels`

  return (
    <div className="fixed inset-0 z-[2000] pointer-events-none">
      <div
        ref={cardRef}
        className={`pointer-events-auto rounded-xl border bg-white/95 shadow-lg px-4 py-3 max-w-xs w-80 ${
          minimized ? 'cursor-default' : 'cursor-move'
        } border-gray-200 shadow-gray-200/60`}
        onPointerDown={minimized ? undefined : handleCardPointerDown}
        style={cardStyle}
      >
        {minimized ? (
          <div className="flex items-center justify-between">
            <span className={`${uiPanelKeyValueTextSizeClass} text-gray-600`}>Status</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className={`${uiPanelKeyValueTextSizeClass} px-2 py-1 rounded border border-transparent text-gray-500 hover:bg-gray-100`}
                onClick={handleClose}
              >
                Close
              </button>
              <button
                type="button"
                className={`${uiPanelKeyValueTextSizeClass} px-2 py-1 rounded border border-blue-600 text-blue-600 hover:bg-blue-50`}
                onClick={handleReopenStatus}
              >
                Reopen
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between mb-2">
              <div className="flex flex-col gap-0.5">
                <span className={`${uiPanelKeyValueTextSizeClass} font-medium uppercase tracking-wide text-gray-500`}>Status Panel</span>
                <div className="text-sm font-semibold text-gray-900">Status</div>
              </div>
              <button
                type="button"
                className={`${uiPanelKeyValueTextSizeClass} px-2 py-1 rounded border border-transparent text-gray-500 hover:bg-gray-100`}
                onClick={handleMinimizeStatus}
              >
                Minimize
              </button>
            </div>
            <div className="space-y-2">
              <div className="flex flex-wrap items-start gap-2">
                <StatusBadge label={UI_LABELS.data} ok={dataLoadOk} msg={dataLoadMsg} />
                <StatusBadge label={UI_LABELS.parser} ok={parserLoadOk} msg={parserLoadMsg} />
                <StatusBadge
                  label="Schema Configurator"
                  ok={schemaOpOk}
                  msg={schemaOpMsg}
                  details={schemaDetails}
                  below
                />
                <StatusBadge label={UI_LABELS.graphFields} ok={graphFieldsOpOk} msg={graphFieldsOpMsg} />
                <StatusBadge label={UI_LABELS.orchestrator} ok={orchestratorOpOk} msg={orchestratorOpMsg} />
                <StatusBadge label={UI_LABELS.renderer} ok={renderOpOk} msg={renderOpMsg} />
              </div>
              <div className="text-xs text-gray-700 space-y-2">
                <div>
                  <div className={`${uiPanelKeyValueTextSizeClass} font-medium uppercase tracking-wide text-gray-500 mb-0.5`}>
                    Graph state
                  </div>
                  <div>
                    GraphData: {nodesCount.toLocaleString()} nodes · {edgesCount.toLocaleString()} edges
                  </div>
                  <div>Selected: {selectedLabel}</div>
                  {schemaImport ? <div>Import: {schemaImport}</div> : null}
                </div>
                <div>
                  <div className={`${uiPanelKeyValueTextSizeClass} font-medium uppercase tracking-wide text-gray-500 mb-0.5`}>
                    Validation
                  </div>
                  <div className="flex items-center gap-1 mb-1">
                    {validationIcon}
                    <span className={validationTextClass}>{graphValidationStatusText}</span>
                  </div>
                  <div className={`${uiPanelKeyValueTextSizeClass} text-gray-600`}>
                    <SchemaSummary
                      variant="full"
                      showTitle={false}
                      showSchemaSummary={false}
                      showDataSummary={false}
                      showLintSummary
                      onOpenSchemaUiEditor={() => openBottomPanel('schema')}
                    />
                  </div>
                  {typeof schemaLintCount === 'number' && schemaLintCount > 0 && (
                    <div className={`mt-1 ${uiPanelKeyValueTextSizeClass} text-gray-600`}>
                      {schemaLintCount.toLocaleString()} schema lint issue{schemaLintCount === 1 ? '' : 's'} detected
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-end gap-2">
              <button
                type="button"
                className={`${uiPanelKeyValueTextSizeClass} px-3 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-100`}
                onClick={handleClose}
              >
                Close
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
