import React from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'
import {
  getJsonLdGraphMappingSummary,
  getAgenticRagContextComparison,
  getAgenticRagIgnoreFiltersSummary,
} from '@/lib/graph/jsonld'
import type {
  GraphData,
} from '@/lib/graph/types'
import {
  AGENTIC_RAG_CONTEXT_URL,
  AGENTIC_RAG_SCHEMA_URL,
  AGENTIC_RAG_GRAPH_RAG_PATH_IRI,
} from '@/lib/agenticrag'
import { ORCHESTRATOR_AGENTIC_COPY, RENDER_PANEL_SECTION_COPY } from '@/features/panels/config'
import { AgenticRagIgnoreFiltersSummaryView } from '@/features/panels/views/AgenticRagContextSection'
import { lsInt, lsSetInt } from '@/lib/persistence'
import {
  LS_KEYS,
  UI_COPY,
  UI_LABELS,
} from '@/lib/config'
import { getPillClass, getChipClass } from '@/lib/ui'
import {
  applyOrchestratorPathDraft,
  buildOrchestratorPathEditorText,
  buildOrchestratorPathLegend,
  buildTraversalStepLegend,
} from './OrchestratorTextEditorSection.model'

export default function OrchestratorTextEditorSection() {
  const data = useGraphStore(s => s.graphData) as GraphData | null
  const selectedNodeId = useGraphStore(s => s.selectedNodeId)
  const setGraphData = useGraphStore(s => s.setGraphData)
  const lastTraversal = useGraphStore(s => s.lastTraversalSummary)
  const uiIconPillBadgeTextSizeClass = useGraphStore(s => s.uiIconPillBadgeTextSizeClass)
  const uiPanelKeyValueInputClass = useGraphStore(
    s =>
      s.uiPanelKeyValueInputClass ||
      'w-full h-6 px-2 text-sm border border-gray-300 rounded text-right',
  )
  const uiPanelMonospaceTextClass = useGraphStore(
    s => s.uiPanelMonospaceTextClass || 'font-mono text-xs',
  )
  const uiPanelKeyValueTextSizeClass = useGraphStore(
    s => s.uiPanelKeyValueTextSizeClass || 'text-sm',
  )
  const uiPanelTextFontClass = useGraphStore(
    s => s.uiPanelTextFontClass || 'font-sans',
  )

  const jsonLdMapping = React.useMemo(
    () => getJsonLdGraphMappingSummary(data as GraphData | null),
    [data],
  )
  const agenticContext = React.useMemo(
    () => getAgenticRagContextComparison(data),
    [data],
  )
  const ignoreFilters = React.useMemo(
    () => getAgenticRagIgnoreFiltersSummary(data),
    [data],
  )

  const text = React.useMemo(() => {
    return buildOrchestratorPathEditorText(data as GraphData | null, selectedNodeId)
  }, [data, selectedNodeId])

  const [draftText, setDraftText] = React.useState(text)
  const [hasUserEdited, setHasUserEdited] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [graphRagMaxFullSteps, setGraphRagMaxFullSteps] = React.useState(() =>
    lsInt(LS_KEYS.orchestratorTraversalLegendGraphRagMaxFull, 8),
  )
  const [graphRagHeadWhenTruncated, setGraphRagHeadWhenTruncated] = React.useState(() =>
    lsInt(LS_KEYS.orchestratorTraversalLegendGraphRagHead, 5),
  )
  const [genericMaxFullSteps, setGenericMaxFullSteps] = React.useState(() =>
    lsInt(LS_KEYS.orchestratorTraversalLegendGenericMaxFull, 4),
  )
  const [genericHeadWhenTruncated, setGenericHeadWhenTruncated] = React.useState(() =>
    lsInt(LS_KEYS.orchestratorTraversalLegendGenericHead, 2),
  )
  const [tailStepsWhenTruncated, setTailStepsWhenTruncated] = React.useState(() =>
    lsInt(LS_KEYS.orchestratorTraversalLegendTail, 1),
  )

  React.useEffect(() => {
    if (!hasUserEdited) {
      setDraftText(text)
      setError(null)
    }
  }, [text, hasUserEdited])

  const legend = React.useMemo(() => buildOrchestratorPathLegend(draftText), [draftText])

  const traversalStepLegend = React.useMemo(() => {
    return buildTraversalStepLegend(
      data as GraphData | null,
      lastTraversal,
      {
        graphRagMaxFullSteps,
        graphRagHeadWhenTruncated,
        genericMaxFullSteps,
        genericHeadWhenTruncated,
        tailStepsWhenTruncated,
      },
    )
  }, [
    data,
    lastTraversal,
    graphRagMaxFullSteps,
    graphRagHeadWhenTruncated,
    genericMaxFullSteps,
    genericHeadWhenTruncated,
    tailStepsWhenTruncated,
  ])

  const handleChange = React.useCallback((event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDraftText(event.target.value)
    setHasUserEdited(true)
  }, [])

  const handleReset = React.useCallback(() => {
    setDraftText(text)
    setHasUserEdited(false)
    setError(null)
  }, [text])

  const handleApply = React.useCallback(() => {
    const result = applyOrchestratorPathDraft(data as GraphData | null, draftText)
    if (result.ok === false) {
      setError(result.error)
      return
    }
    setGraphData(result.nextGraph)
    setError(null)
    setHasUserEdited(false)
  }, [data, draftText, setGraphData])

  return (
    <div className="h-full min-h-0 flex flex-col">
      <div
        className={[
          'mt-2 mb-1 text-gray-600',
          uiPanelKeyValueTextSizeClass,
          uiPanelTextFontClass,
        ].join(' ')}
      >
        {ORCHESTRATOR_AGENTIC_COPY.pathEditorIntroText}
      </div>
      <div
        className={[
          'mb-1 text-gray-500',
          uiPanelKeyValueTextSizeClass,
          uiPanelTextFontClass,
        ].join(' ')}
      >
        {legend}
      </div>
      {traversalStepLegend && (
        <>
          <div
            className={[
              'mb-1 text-gray-500',
              uiPanelKeyValueTextSizeClass,
              uiPanelTextFontClass,
            ].join(' ')}
          >
            {traversalStepLegend}
          </div>
          <div
            className={[
              'mb-1 text-gray-500 flex flex-wrap items-center gap-2',
              uiPanelKeyValueTextSizeClass,
              uiPanelTextFontClass,
            ].join(' ')}
          >
            <span
              className={getPillClass('badge', {
                baseClass:
                  'inline-flex items-center px-1 py-[1px] rounded border border-gray-300 bg-gray-50',
                badgeTextSizeClass: uiIconPillBadgeTextSizeClass,
                textColorClass: 'text-gray-600',
              })}
            >
              Traversal legend settings
            </span>
            <span>{UI_COPY.orchestratorGraphRagFullLabel}</span>
            <input
              className={uiPanelKeyValueInputClass}
              type="number"
              min={1}
              value={graphRagMaxFullSteps}
              onChange={e => {
                const raw = Number.parseInt(e.target.value || '1', 10)
                const clamped = Number.isFinite(raw) && raw > 0 ? raw : 1
                setGraphRagMaxFullSteps(clamped)
                lsSetInt(LS_KEYS.orchestratorTraversalLegendGraphRagMaxFull, clamped, {
                  min: 1,
                  max: 999,
                })
              }}
            />
            <span>{UI_COPY.orchestratorGraphRagHeadLabel}</span>
            <input
              className={uiPanelKeyValueInputClass}
              type="number"
              min={1}
              value={graphRagHeadWhenTruncated}
              onChange={e => {
                const raw = Number.parseInt(e.target.value || '1', 10)
                const clamped = Number.isFinite(raw) && raw > 0 ? raw : 1
                setGraphRagHeadWhenTruncated(clamped)
                lsSetInt(LS_KEYS.orchestratorTraversalLegendGraphRagHead, clamped, {
                  min: 1,
                  max: 999,
                })
              }}
            />
            <span>{UI_COPY.orchestratorGenericFullLabel}</span>
            <input
              className={uiPanelKeyValueInputClass}
              type="number"
              min={1}
              value={genericMaxFullSteps}
              onChange={e => {
                const raw = Number.parseInt(e.target.value || '1', 10)
                const clamped = Number.isFinite(raw) && raw > 0 ? raw : 1
                setGenericMaxFullSteps(clamped)
                lsSetInt(LS_KEYS.orchestratorTraversalLegendGenericMaxFull, clamped, {
                  min: 1,
                  max: 999,
                })
              }}
            />
            <span>{UI_COPY.orchestratorGenericHeadLabel}</span>
            <input
              className={uiPanelKeyValueInputClass}
              type="number"
              min={1}
              value={genericHeadWhenTruncated}
              onChange={e => {
                const raw = Number.parseInt(e.target.value || '1', 10)
                const clamped = Number.isFinite(raw) && raw > 0 ? raw : 1
                setGenericHeadWhenTruncated(clamped)
                lsSetInt(LS_KEYS.orchestratorTraversalLegendGenericHead, clamped, {
                  min: 1,
                  max: 999,
                })
              }}
            />
            <span>{UI_COPY.orchestratorTailLabel}</span>
            <input
              className={uiPanelKeyValueInputClass}
              type="number"
              min={1}
              value={tailStepsWhenTruncated}
              onChange={e => {
                const raw = Number.parseInt(e.target.value || '1', 10)
                const clamped = Number.isFinite(raw) && raw > 0 ? raw : 1
                setTailStepsWhenTruncated(clamped)
                lsSetInt(LS_KEYS.orchestratorTraversalLegendTail, clamped, {
                  min: 1,
                  max: 999,
                })
              }}
            />
          </div>
        </>
      )}
      <div
        className={[
          'mb-1 text-gray-500',
          uiPanelKeyValueTextSizeClass,
          uiPanelTextFontClass,
        ].join(' ')}
      >
        {ORCHESTRATOR_AGENTIC_COPY.schemaLabel}
        {' '}
        <span className={`${uiPanelMonospaceTextClass} break-all`}>{AGENTIC_RAG_SCHEMA_URL}</span>
      </div>
      <div
        className={[
          'mb-1 text-gray-500',
          uiPanelKeyValueTextSizeClass,
          uiPanelTextFontClass,
        ].join(' ')}
      >
        <span
          className={getPillClass('badge', {
            baseClass:
              'inline-flex items-center px-1 py-[1px] mr-1 rounded border border-gray-300 bg-gray-50',
            badgeTextSizeClass: uiIconPillBadgeTextSizeClass,
            textColorClass: 'text-gray-600',
          })}
        >
          {RENDER_PANEL_SECTION_COPY.presetsAndTuning.badge}
        </span>
        {ORCHESTRATOR_AGENTIC_COPY.contextLabel}
        {' '}
        <span className={`${uiPanelMonospaceTextClass} break-all`}>{AGENTIC_RAG_CONTEXT_URL}</span>
        {agenticContext && agenticContext.graphContextUrl && (
          <>
            {' '}
            {ORCHESTRATOR_AGENTIC_COPY.datasetContextVocabLabel}
            {' '}
            <span className={`${uiPanelMonospaceTextClass} break-all`}>
              {agenticContext.graphContextUrl}
            </span>
            {agenticContext.isCanonicalMatch === true && UI_COPY.orchestratorMatchesSuffix}
            {agenticContext.isCanonicalMatch === false && UI_COPY.orchestratorDiffersSuffix}
          </>
        )}
      </div>
      <AgenticRagIgnoreFiltersSummaryView
        ignoreFilters={ignoreFilters}
        className="mb-1"
        variant="debug"
      />
      <div
        className={[
          'mb-1 text-gray-500',
          uiPanelKeyValueTextSizeClass,
          uiPanelTextFontClass,
        ].join(' ')}
      >
        {ORCHESTRATOR_AGENTIC_COPY.graphRagPathIriLabel}
        {' '}
        <span className={`${uiPanelMonospaceTextClass} break-all`}>
          {AGENTIC_RAG_GRAPH_RAG_PATH_IRI}
        </span>
      </div>
      {jsonLdMapping && jsonLdMapping.selectedEdgeProps.length > 0 && (
        <div className="mb-1 border border-gray-100 rounded px-1.5 py-1 bg-gray-50">
          <div
            className={[
              'font-semibold uppercase tracking-wide text-gray-500',
              uiPanelKeyValueTextSizeClass,
              uiPanelTextFontClass,
            ].join(' ')}
          >
            {UI_COPY.orchestratorJsonLdContextEdgesLabel}
          </div>
          <div className="mt-0.5 flex flex-wrap gap-1">
            {jsonLdMapping.selectedEdgeProps.map(key => (
              <span
                key={key}
                className={getChipClass('default', {
                  textSizeClass: uiIconPillBadgeTextSizeClass,
                  textColorClass: 'text-gray-700',
                  extraClassName: 'border-gray-300 bg-white',
                })}
              >
                {key}
              </span>
            ))}
          </div>
        </div>
      )}
      {error && (
        <div
          className={[
            'mb-1 text-red-600',
            uiPanelKeyValueTextSizeClass,
            uiPanelTextFontClass,
          ].join(' ')}
        >
          {error}
        </div>
      )}
      <div className="mb-1 flex items-center gap-1">
        <button
          type="button"
          className={[
            'App-toolbar__btn bg-gray-100 text-gray-700',
            uiPanelKeyValueTextSizeClass,
            uiPanelTextFontClass,
          ].join(' ')}
          onClick={handleApply}
        >
          {UI_COPY.orchestratorApplyChangesLabel}
        </button>
        <button
          type="button"
          className={[
            'App-toolbar__btn bg-gray-100 text-gray-700',
            uiPanelKeyValueTextSizeClass,
            uiPanelTextFontClass,
          ].join(' ')}
          onClick={handleReset}
          disabled={!hasUserEdited}
        >
          {UI_LABELS.reset}
        </button>
      </div>
      <textarea
        value={draftText}
        onChange={handleChange}
        className={`w-full flex-1 min-h-0 px-2 py-2 border border-gray-300 rounded resize-none bg-transparent ${uiPanelMonospaceTextClass}`}
      />
    </div>
  )
}
