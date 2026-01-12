import React from 'react'
import CollapsibleSection from '@/features/panels/ui/CollapsibleSection'
import Tooltip from '@/features/panels/ui/Tooltip'
import { ORCHESTRATOR_AGENTIC_COPY, PARSER_STEP_COPY, PIPELINE_STAGE_COPY } from '@/features/panels/config'
import { noParserMatchMessage, firstWarningText } from '@/features/parsers/uiUtils'
import { useGraphStore } from '@/hooks/useGraphStore'
import { validateGraphDataWithSchema } from '@/lib/graph/validation'
import { getJsonLdGraphMappingSummary, getAgenticRagContextComparison } from '@/lib/graph/jsonld/index'
import type { GraphData, JSONValue, JsonLdGraphMappingConfig } from '@/lib/graph/types'
import type { ParserSelectionSectionProps, ParserDataSectionProps } from '@/features/panels/views/ParserSectionsModel'
import {
  AGENTIC_RAG_CONTEXT_URL,
  AGENTIC_RAG_EDGE_TYPE_IRI,
  AGENTIC_RAG_GRAPH_RAG_PATH_IRI,
  AGENTIC_RAG_NODE_TYPE_IRI,
  AGENTIC_RAG_SCHEMA_URL,
} from '@/lib/agenticrag'
import {
  PARSER_JSONLD_EDGE_MAPPING_PIPELINE_DESCRIPTION,
} from '@/lib/config'
import { getPillClass, getChipClass } from '@/lib/ui'
import {
  uiPrimaryToggleActiveClassName,
  uiPrimaryIconInactiveClassName,
} from '@/features/graph-data-table/ui/GraphDataTableToolbarStyles'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)

export function ParserSelectionSection({
  parsersCollapsed,
  onParsersCollapsedChange,
  detection,
  embedded,
}: ParserSelectionSectionProps) {
  const parserMessage = noParserMatchMessage(detection.attemptedAutoDetect, detection.inputText)
  const warningText = firstWarningText(detection.warnings)
  const hasSelectedSpec = detection.hasSelectedSpec

  const copy = PARSER_STEP_COPY.parserSelection
  const uiPanelKeyValueTextSizeClass = useGraphStore(
    s => s.uiPanelKeyValueTextSizeClass || 'text-sm',
  )
  const uiPanelTextFontClass = useGraphStore(
    s => s.uiPanelTextFontClass || 'font-sans',
  )

  const info = (
    <>
      {!hasSelectedSpec && parserMessage && (
        <div className="text-xs mb-2 px-2 py-1 rounded bg-amber-50 border border-amber-200 text-amber-800">
          {parserMessage}
        </div>
      )}
      {warningText && <div className="text-xs text-amber-700">{warningText}</div>}
    </>
  )

  if (embedded) {
    return (
      <div className="mt-1">
        <div className="mt-2">{info}</div>
      </div>
    )
  }

  return (
    <CollapsibleSection
      title={
        <div className="flex flex-col">
          <span className="inline-flex items-center gap-2">
            <span
              className={[
                uiPanelKeyValueTextSizeClass,
                uiPanelTextFontClass,
                'font-semibold text-gray-500',
              ].join(' ')}
            >
              {copy.badge}
            </span>
            {copy.tooltip ? (
              <Tooltip
                content={copy.tooltip}
                maxWidthPx={260}
                contentClassName="bg-gray-800/90"
              >
                <span className="text-xs font-semibold text-gray-800">
                  {copy.title}
                </span>
              </Tooltip>
            ) : (
              <span className="text-xs font-semibold text-gray-800">
                {copy.title}
              </span>
            )}
          </span>
          {copy.descriptionShort && (
            <span
              className={[
                uiPanelKeyValueTextSizeClass,
                uiPanelTextFontClass,
                'text-gray-600',
              ].join(' ')}
            >
              {copy.descriptionShort}
            </span>
          )}
        </div>
      }
      collapsed={parsersCollapsed}
      onToggle={v => onParsersCollapsedChange(v)}
    >
      {info}
    </CollapsibleSection>
  )
}

export function ParserDataSection({
  inputCollapsed,
  onInputCollapsedChange,
  embedded,
  showMetrics = true,
}: ParserDataSectionProps) {
  const schema = useGraphStore(s => s.schema)
  const data = useGraphStore(s => s.graphData)
  const setGraphData = useGraphStore(s => s.setGraphData)
  const uiIconPillBadgeTextSizeClass = useGraphStore(s => s.uiIconPillBadgeTextSizeClass)
  const uiPanelMonospaceTextClass = useGraphStore(
    s => s.uiPanelMonospaceTextClass || 'font-mono text-xs',
  )
  const uiPanelKeyValueTextSizeClass = useGraphStore(
    s => s.uiPanelKeyValueTextSizeClass || 'text-sm',
  )
  const uiPanelTextFontClass = useGraphStore(
    s => s.uiPanelTextFontClass || 'font-sans',
  )

  const validation = React.useMemo(() => validateGraphDataWithSchema(data, schema), [data, schema])

  const jsonLdMapping = React.useMemo(
    () => getJsonLdGraphMappingSummary(data as GraphData | null),
    [data],
  )

  const agenticContext = React.useMemo(
    () => getAgenticRagContextComparison(data as GraphData | null),
    [data],
  )

  const handleToggleJsonLdEdgeProp = React.useCallback(
    (key: string, nextChecked: boolean) => {
      if (!data || data.type !== 'Graph') return
      if (!key || !key.trim()) return
      const current = data as GraphData
      const meta = isRecord(current.metadata)
        ? (current.metadata as Record<string, unknown>)
        : {}
      const rawCfg = meta.jsonLdMapping
      const cfg: JsonLdGraphMappingConfig = isRecord(rawCfg)
        ? (rawCfg as JsonLdGraphMappingConfig)
        : {}
      const existingList = Array.isArray(cfg.contextEdgeProperties)
        ? cfg.contextEdgeProperties.filter(entry => typeof entry === 'string')
        : []
      const nextList = (() => {
        if (nextChecked) {
          if (existingList.includes(key)) return existingList
          return [...existingList, key]
        }
        return existingList.filter(entry => entry !== key)
      })()
      const nextCfg: JsonLdGraphMappingConfig = {
        ...cfg,
        contextEdgeProperties: nextList,
      }
      const nextMeta: Record<string, JSONValue> = {
        ...meta,
        jsonLdMapping: nextCfg as JSONValue,
      }
      const nextData: GraphData = {
        ...current,
        metadata: nextMeta,
      }
      setGraphData(nextData)
    },
    [data, setGraphData],
  )

  const copy = PARSER_STEP_COPY.parserData

  const content = (
    <>
      <div className="mt-2">
        <div
          className={[
            'mt-1 text-gray-600 space-y-1',
            uiPanelKeyValueTextSizeClass,
            uiPanelTextFontClass,
          ].join(' ')}
        >
          {showMetrics && (
            <>
              <div>
                Metrics:
                {' '}
                {validation.metrics.nodeCount}
                {' '}
                nodes ·
                {' '}
                {validation.metrics.edgeCount}
                {' '}
                edges
                {validation.metrics.duplicateNodeIdCount > 0 && (
                  <>
                    {' · '}
                    {validation.metrics.duplicateNodeIdCount}
                    {' '}
                    duplicate IDs
                  </>
                )}
                {validation.metrics.danglingEdgeCount > 0 && (
                  <>
                    {' · '}
                    {validation.metrics.danglingEdgeCount}
                    {' '}
                    dangling edges
                  </>
                )}
                {validation.metrics.maxDegree > 0 && (
                  <>
                    {' · max degree '}
                    {validation.metrics.maxDegree}
                  </>
                )}
                {validation.metrics.nodesWithoutTypeCount > 0 && (
                  <>
                    {' · '}
                    {validation.metrics.nodesWithoutTypeCount}
                    {' '}
                    nodes without type
                  </>
                )}
                {validation.metrics.edgesWithoutLabelCount > 0 && (
                  <>
                    {' · '}
                    {validation.metrics.edgesWithoutLabelCount}
                    {' '}
                    edges without label
                  </>
                )}
              </div>
              {(Object.keys(validation.metrics.nodeTypeCounts || {}).length > 0 ||
                Object.keys(validation.metrics.edgeLabelCounts || {}).length > 0 ||
                (validation.metrics.degreeHistogram || []).length > 0) && (
                <div>
                  Distribution:
                  {' '}
                  {Object.keys(validation.metrics.nodeTypeCounts || {}).length}
                  {' '}
                  node types ·
                  {' '}
                  {Object.keys(validation.metrics.edgeLabelCounts || {}).length}
                  {' '}
                  edge labels
                  {Array.isArray(validation.metrics.degreeHistogram) && validation.metrics.degreeHistogram.length > 0 && (() => {
                    const entries = validation.metrics.degreeHistogram
                      .map((count, degree) => ({ degree, count }))
                      .filter(entry => entry.count && entry.degree >= 0)
                      .slice(0, 3)
                    if (!entries.length) return null
                    const text = entries
                      .map(entry => `${entry.degree}:${entry.count}`)
                      .join(', ')
                    return (
                      <>
                        {' · degree '}
                        {text}
                      </>
                    )
                  })()}
                </div>
              )}
            </>
          )}
          {jsonLdMapping && (
            <div className="mt-1 space-y-0.5 text-gray-600">
              <div>
                JSON-LD graph mapping:
                {' '}
                {jsonLdMapping.nodeCount}
                {' '}
                nodes ·
                {' '}
                {jsonLdMapping.edgeCount}
                {' '}
                edges
              </div>
              {jsonLdMapping.edgeProps.length > 0 && (
                <div className="space-y-0.5">
                  <div>
                    Edge properties from @context (@id):
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {jsonLdMapping.edgeProps.map(key => {
                      const checked = jsonLdMapping.selectedEdgeProps.includes(key)
                      const baseClass = 'focus:outline-none focus:ring-1'
                      const variantClassOptions = checked
                        ? {
                            textColorClass: 'text-blue-700',
                            extraClassName: uiPrimaryToggleActiveClassName,
                          }
                        : {
                            textColorClass: uiPrimaryIconInactiveClassName,
                            extraClassName: 'border-gray-300 bg-white',
                          }
                      return (
                        <button
                          key={key}
                          type="button"
                          className={getChipClass(checked ? 'selected' : 'default', {
                            baseClass,
                            textSizeClass: uiPanelKeyValueTextSizeClass,
                            ...variantClassOptions,
                          })}
                          onClick={() => handleToggleJsonLdEdgeProp(key, !checked)}
                        >
                          {checked ? '✓ ' : ''}
                          {key}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
              {jsonLdMapping.sampleNodes.length > 0 && (
                <div>
                  Sample node mapping:
                  {' '}
                  {jsonLdMapping.sampleNodes
                    .map(sample => `${sample.id} ⟶ type=${sample.type}, label=${sample.label}`)
                    .join(' · ')}
                </div>
              )}
                  {jsonLdMapping.edgeProps.length > 0 && (
                <>
                  <div className="mt-0.5 text-gray-500">
                    {PARSER_JSONLD_EDGE_MAPPING_PIPELINE_DESCRIPTION}
                  </div>
                  <div className="mt-0.5 text-gray-500">
                    {ORCHESTRATOR_AGENTIC_COPY.schemaLabel}
                    {' '}
                    <span className={`${uiPanelMonospaceTextClass} break-all`}>
                      {AGENTIC_RAG_SCHEMA_URL}
                    </span>
                  </div>
                  <div className="text-gray-500">
                    <span
                      className={getPillClass('badge', {
                        baseClass:
                          'inline-flex items-center px-1 py-[1px] mr-1 rounded border border-gray-300 bg-gray-50',
                        badgeTextSizeClass: uiIconPillBadgeTextSizeClass,
                        textColorClass: 'text-gray-600',
                      })}
                    >
                      {PIPELINE_STAGE_COPY.ingestValidate.badge}
                    </span>
                    AgenticRAG edge context:
                    {' '}
                    <span className={`${uiPanelMonospaceTextClass} break-all`}>
                      {AGENTIC_RAG_CONTEXT_URL}
                    </span>
                    {agenticContext && agenticContext.graphContextUrl && (
                      <>
                        {' '}
                        {ORCHESTRATOR_AGENTIC_COPY.datasetContextVocabLabel}
                        {' '}
                        <span className={`${uiPanelMonospaceTextClass} break-all`}>
                          {agenticContext.graphContextUrl}
                        </span>
                        {agenticContext.isCanonicalMatch === true && ' (matches)'}
                        {agenticContext.isCanonicalMatch === false && ' (differs)'}
                      </>
                    )}
                  </div>
                  <div className="text-gray-500">
                    {ORCHESTRATOR_AGENTIC_COPY.graphRagPathIriLabel}
                    {' '}
                    <span className={`${uiPanelMonospaceTextClass} break-all`}>
                      {AGENTIC_RAG_GRAPH_RAG_PATH_IRI}
                    </span>
                  </div>
                  <div className="text-gray-500">
                    Node type IRI:
                    {' '}
                    <span className={`${uiPanelMonospaceTextClass} break-all`}>
                      {AGENTIC_RAG_NODE_TYPE_IRI}
                    </span>
                  </div>
                  <div className="text-gray-500">
                    Edge type IRI:
                    {' '}
                    <span className={`${uiPanelMonospaceTextClass} break-all`}>
                      {AGENTIC_RAG_EDGE_TYPE_IRI}
                    </span>
                  </div>
                </>
              )}
            </div>
          )}
          {(validation.errors.length > 0 || validation.warnings.length > 0) && (
            <div className="space-y-0.5">
              {validation.errors.length > 0 && (
                <div
                  className={[
                    uiPanelKeyValueTextSizeClass,
                    uiPanelTextFontClass,
                    'text-red-600',
                  ].join(' ')}
                >
                  Errors:
                  {' '}
                  {validation.errors.slice(0, 3).join('; ')}
                  {validation.errors.length > 3 && '; …'}
                </div>
              )}
              {validation.warnings.length > 0 && (
                <div
                  className={[
                    uiPanelKeyValueTextSizeClass,
                    uiPanelTextFontClass,
                    'text-amber-700',
                  ].join(' ')}
                >
                  Warnings:
                  {' '}
                  {validation.warnings.slice(0, 3).join('; ')}
                  {validation.warnings.length > 3 && '; …'}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )

  if (embedded) {
    return <div className="mt-1">{content}</div>
  }

  return (
    <CollapsibleSection
      title={
        <div className="flex flex-col">
          <span className="inline-flex items-center gap-2">
            <span
              className={[
                uiPanelKeyValueTextSizeClass,
                uiPanelTextFontClass,
                'font-semibold text-gray-500',
              ].join(' ')}
            >
              {copy.badge}
            </span>
            {copy.tooltip ? (
              <Tooltip
                content={copy.tooltip}
                maxWidthPx={260}
                contentClassName="bg-gray-800/90"
              >
                <span className="text-xs font-semibold text-gray-800">
                  {copy.title}
                </span>
              </Tooltip>
            ) : (
              <span className="text-xs font-semibold text-gray-800">
                {copy.title}
              </span>
            )}
          </span>
          {copy.descriptionShort && (
            <span
              className={[
                uiPanelKeyValueTextSizeClass,
                uiPanelTextFontClass,
                'text-gray-600',
              ].join(' ')}
            >
              {copy.descriptionShort}
            </span>
          )}
        </div>
      }
      collapsed={inputCollapsed}
      onToggle={v => onInputCollapsedChange(v)}
    >
      {content}
    </CollapsibleSection>
  )
}
