import React from 'react'
import CollapsibleSection from '@/features/panels/ui/CollapsibleSection'
import Tooltip from '@/features/panels/ui/Tooltip'
import { KeyTypeValueRow, RightAlignedValueCell } from '@/features/panels/ui/KeyTypeValueRow'
import {
  ORCHESTRATOR_TRAVERSAL_DELAY_DEFAULT_MS,
  ORCHESTRATOR_TRAVERSAL_DELAY_MAX_MS,
  ORCHESTRATOR_TRAVERSAL_DELAY_MIN_MS,
  ORCHESTRATOR_TRAVERSAL_DELAY_TOOLTIP,
} from '@/features/panels/utils/orchestratorTraversal'
import {
  AGENTIC_RAG_CONTEXT_IRI_TOOLTIP,
  GRAPHRAG_WORKFLOW_SUMMARY_TOOLTIP,
  ORCHESTRATOR_TRACING_OPTIONS_TOOLTIP,
  ORCHESTRATOR_TRAVERSAL_DELAY_ROW_TOOLTIP,
  UI_COPY,
  UI_ANCHORS,
} from '@/lib/config'
import type { GraphRagWorkflowJsonLd } from '@/features/panels/utils/graphragConfig'
import type { TraversalSummary } from '@/features/panels/utils/orchestratorTraversal'
import { type AgenticRagContextComparison, type AgenticRagIgnoreFiltersSummary } from '@/lib/graph/jsonld/index'
import { applyIgnoreCodebasePathsUpdate, computeInvalidIgnorePrefixes } from '@/features/panels/utils/agenticRagIgnoreFilters'
import { GraphRagWorkflowIndexingSection } from '@/features/panels/views/GraphRagWorkflowIndexingSection'
import { openBottomPanel } from '@/features/bottom-panel/open'
import { useGraphStore } from '@/hooks/useGraphStore'

export interface AgenticContextGraphContextUrlRowProps {
  agenticContext: AgenticRagContextComparison | null
  onChangeAgenticContextUrl: (value: string) => void
  mode: 'edit' | 'redirect'
}

import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'

export function AgenticContextGraphContextUrlRow({
  agenticContext,
  onChangeAgenticContextUrl,
  mode,
}: AgenticContextGraphContextUrlRowProps) {
  const uiPanelMonospaceTextClass = useGraphStore(
    s => s.uiPanelMonospaceTextClass || 'font-mono text-xs',
  )
  return (
    <KeyTypeValueRow
      layout="keyIconValue"
      keyNode={(
        <Tooltip
          content={AGENTIC_RAG_CONTEXT_IRI_TOOLTIP}
          maxWidthPx={260}
          contentClassName={UI_THEME_TOKENS.tooltip.bg}
        >
          <span className={`text-xs ${UI_THEME_TOKENS.text.primary} break-words`}>
            agenticContext.graphContextUrl
          </span>
        </Tooltip>
      )}
      typeNode={null}
      valueNode={(
        <div className="space-y-1 w-full">
          {mode === 'edit' ? (
            <RightAlignedValueCell className="mt-0.5">
              <Tooltip
                content={AGENTIC_RAG_CONTEXT_IRI_TOOLTIP}
                maxWidthPx={260}
                contentClassName={UI_THEME_TOKENS.tooltip.bg}
                className="w-full h-full"
              >
                <textarea
                  value={agenticContext?.graphContextUrl || ''}
                  onChange={e => onChangeAgenticContextUrl(e.target.value)}
                  placeholder={agenticContext?.canonicalContextUrl || 'https://...'}
                  className={`w-full border ${UI_THEME_TOKENS.input.border} rounded px-2 py-2 leading-[1rem] whitespace-pre-wrap break-words resize-y min-h-[96px] bg-transparent ${uiPanelMonospaceTextClass} ${UI_THEME_TOKENS.input.text}`}
                />
              </Tooltip>
            </RightAlignedValueCell>
          ) : (
            <div className="flex items-center justify-start">
              <button
                type="button"
                className={`App-toolbar__btn ${UI_THEME_TOKENS.button.hoverBg} ${UI_THEME_TOKENS.text.primary}`}
                onClick={() => {
                  try {
                    openBottomPanel('orchestrator')
                  } catch {
                    void 0
                  }
                }}
              >
                {UI_COPY.graphRagOpenOrchestratorAgenticContextButtonLabel}
              </button>
            </div>
          )}
        </div>
      )}
      align="start"
    />
  )
}

interface GraphRagWorkflowSectionProps {
  mode: 'floatingPanel' | 'bottomPanel'
  workflowDoc: GraphRagWorkflowJsonLd
  workflowSource: 'loaded' | 'generated' | 'invalid' | 'parse-error'
  workflowError: string | null
  workflowValidationErrors: string[]
  traversalDelayMs: number
  onChangeTraversalDelayMs: (value: number) => void
  lastTraversal: TraversalSummary | null
  onUpdateWorkflow: (updater: (current: GraphRagWorkflowJsonLd) => GraphRagWorkflowJsonLd) => void
  indexingCollapsed: boolean
  onToggleIndexingCollapsed: (next: boolean) => void
  tracingCollapsed: boolean
  onToggleTracingCollapsed: (next: boolean) => void
  agenticContext: AgenticRagContextComparison | null
  ignoreFilters: AgenticRagIgnoreFiltersSummary | null
  onChangeAgenticContextUrl: (value: string) => void
  onChangeIgnoreCodebasePaths: (value: string) => void
}

export function GraphRagWorkflowSection({
  mode,
  workflowDoc,
  workflowSource,
  workflowError,
  workflowValidationErrors,
  traversalDelayMs,
  onChangeTraversalDelayMs,
  lastTraversal,
  onUpdateWorkflow,
  indexingCollapsed,
  onToggleIndexingCollapsed,
  tracingCollapsed,
  onToggleTracingCollapsed,
  agenticContext,
  ignoreFilters,
  onChangeAgenticContextUrl,
  onChangeIgnoreCodebasePaths,
}: GraphRagWorkflowSectionProps) {
  const uiPanelMonospaceTextClass = useGraphStore(
    s => s.uiPanelMonospaceTextClass || 'font-mono text-xs',
  )
  const invalidIgnorePrefixes = React.useMemo(
    () => computeInvalidIgnorePrefixes(ignoreFilters),
    [ignoreFilters],
  )
  const uiPanelKeyValueInputClass = useGraphStore(
    s =>
      s.uiPanelKeyValueInputClass ||
      'w-full h-6 px-2 text-sm border border-gray-300 rounded text-right',
  )

  const handleChangeIgnoreCodebasePaths = React.useCallback(
    (value: string) => {
      onChangeIgnoreCodebasePaths(value)
      onUpdateWorkflow(current => {
        const next: GraphRagWorkflowJsonLd = applyIgnoreCodebasePathsUpdate(current, value)
        return next
      })
    },
    [onChangeIgnoreCodebasePaths, onUpdateWorkflow],
  )

  return (
    <div
      data-kg-anchor={UI_ANCHORS.ragGraphRAGWorkflow}
      className="space-y-0.5 text-xs text-gray-700"
    >
      <KeyTypeValueRow
        layout="keyValue"
        className="border-b border-gray-100"
        keyNode={<span className="break-words">{UI_COPY.graphRagWorkflowRowLabel}</span>}
        valueNode={(
          <div
            className="flex min-w-0 flex-wrap items-center gap-1 text-xs text-gray-700 w-full"
            title={GRAPHRAG_WORKFLOW_SUMMARY_TOOLTIP}
          >
            <span className="whitespace-nowrap">
              {UI_COPY.graphRagWorkflowGraphIdLabel}
            </span>
            <span
              className={`${uiPanelMonospaceTextClass} max-w-[120px] truncate`}
              title={workflowDoc.graphId}
            >
              {workflowDoc.graphId}
            </span>
            <span className="text-gray-400">
              ·
            </span>
            <span className="whitespace-nowrap">
              {UI_COPY.graphRagWorkflowRetrievalLabel}
            </span>
            <span
              className={`${uiPanelMonospaceTextClass} max-w-[100px] truncate`}
              title={workflowDoc.retrievalMethod}
            >
              {workflowDoc.retrievalMethod}
            </span>
            <span className="text-gray-400">
              ·
            </span>
            <span className="text-gray-500">
              {workflowSource === 'loaded' && UI_COPY.graphRagWorkflowSourceLoadedLabel}
              {workflowSource === 'generated' && UI_COPY.graphRagWorkflowSourceGeneratedLabel}
              {workflowSource === 'invalid' && UI_COPY.graphRagWorkflowSourceInvalidLabel}
              {workflowSource === 'parse-error' && UI_COPY.graphRagWorkflowSourceParseErrorLabel}
            </span>
          </div>
        )}
      />
      <KeyTypeValueRow
        layout="keyIconSliderInput"
        keyNode={(
          <Tooltip
            content={ORCHESTRATOR_TRAVERSAL_DELAY_ROW_TOOLTIP}
            maxWidthPx={260}
            contentClassName="bg-gray-800/90"
          >
            <div className="flex min-w-0 w-full items-center gap-1">
              <span className="break-words">orchestratorTraversalDelayMs</span>
            </div>
          </Tooltip>
        )}
        typeNode={(
          <Tooltip
            content={ORCHESTRATOR_TRAVERSAL_DELAY_TOOLTIP}
            maxWidthPx={260}
            contentClassName="bg-gray-800/90"
            className="w-full h-full"
          >
            <input
              type="range"
              min={ORCHESTRATOR_TRAVERSAL_DELAY_MIN_MS}
              max={ORCHESTRATOR_TRAVERSAL_DELAY_MAX_MS}
              step={50}
              value={Number(traversalDelayMs)}
              onChange={e => {
                const raw = Number(e.target.value)
                const next = Number.isFinite(raw)
                  ? Math.max(
                      ORCHESTRATOR_TRAVERSAL_DELAY_MIN_MS,
                      Math.min(ORCHESTRATOR_TRAVERSAL_DELAY_MAX_MS, raw),
                    )
                  : ORCHESTRATOR_TRAVERSAL_DELAY_DEFAULT_MS
                onChangeTraversalDelayMs(next)
              }}
              className="w-full h-full"
            />
          </Tooltip>
        )}
        valueNode={(
          <Tooltip
            content={ORCHESTRATOR_TRAVERSAL_DELAY_TOOLTIP}
            maxWidthPx={260}
            contentClassName="bg-gray-800/90"
            className="w-full h-full"
          >
              <input
                type="number"
                min={ORCHESTRATOR_TRAVERSAL_DELAY_MIN_MS}
                max={ORCHESTRATOR_TRAVERSAL_DELAY_MAX_MS}
                step={50}
                value={Number(traversalDelayMs)}
                onChange={e => {
                  const raw = Number(e.target.value)
                  const next = Number.isFinite(raw)
                    ? Math.max(
                        ORCHESTRATOR_TRAVERSAL_DELAY_MIN_MS,
                        Math.min(
                          ORCHESTRATOR_TRAVERSAL_DELAY_MAX_MS,
                          Math.round(raw / 50) * 50,
                        ),
                      )
                    : ORCHESTRATOR_TRAVERSAL_DELAY_DEFAULT_MS
                  onChangeTraversalDelayMs(next)
                }}
                className={uiPanelKeyValueInputClass}
              />
          </Tooltip>
        )}
      />
      <AgenticContextGraphContextUrlRow
        agenticContext={agenticContext}
        onChangeAgenticContextUrl={onChangeAgenticContextUrl}
        mode={mode === 'bottomPanel' ? 'edit' : 'redirect'}
      />
      {workflowError && (
        <div className="mt-1 text-red-600">
          {workflowError}
        </div>
      )}
      {workflowValidationErrors && workflowValidationErrors.length > 0 && (
        <div className="mt-1 text-amber-700">
          {workflowValidationErrors.slice(0, 3).join('; ')}
          {workflowValidationErrors.length > 3 && '; …'}
        </div>
      )}
      <GraphRagWorkflowIndexingSection
        mode={mode}
        workflowDoc={workflowDoc}
        indexingCollapsed={indexingCollapsed}
        onToggleIndexingCollapsed={onToggleIndexingCollapsed}
        ignoreFilters={ignoreFilters}
        invalidIgnorePrefixes={invalidIgnorePrefixes}
        onChangeIgnoreCodebasePathsInput={handleChangeIgnoreCodebasePaths}
        onUpdateWorkflow={onUpdateWorkflow}
      />
      <CollapsibleSection
        title={(
          <Tooltip
            content={ORCHESTRATOR_TRACING_OPTIONS_TOOLTIP}
            maxWidthPx={260}
            contentClassName="bg-gray-800/90"
          >
            <span className="inline-flex items-center gap-1">
              <span>{UI_COPY.graphRagWorkflowTracingOptionsTitle}</span>
            </span>
          </Tooltip>
        )}
        headerClassName="px-0"
        collapsed={tracingCollapsed}
        onToggle={onToggleTracingCollapsed}
        stickyOffsetClassName="top-6"
      >
        <div className="space-y-2 text-xs text-gray-700">
          <div>
            {UI_COPY.graphRagWorkflowLastTraversalLabel}{' '}
            {lastTraversal
              ? `${lastTraversal.edgeIds.length} ${UI_COPY.graphRagWorkflowEdgesUnitLabel} · ${
                  lastTraversal.mode === 'graphRag'
                    ? `${lastTraversal.traverseNodeIds.length} ${UI_COPY.graphRagWorkflowTraverseNodesUnitLabel} · ${lastTraversal.hops.length} ${UI_COPY.graphRagWorkflowHopsUnitLabel}`
                    : `${UI_COPY.graphRagWorkflowMaxDepthLabel} ${lastTraversal.maxDepth}`
                }`
              : UI_COPY.graphRagWorkflowNoTraversalYetLabel}
          </div>
        </div>
      </CollapsibleSection>
    </div>
  )
}
