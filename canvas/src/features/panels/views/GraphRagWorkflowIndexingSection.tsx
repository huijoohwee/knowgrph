import React from 'react'
import CollapsibleSection from '@/features/panels/ui/CollapsibleSection'
import Tooltip from '@/features/panels/ui/Tooltip'
import { KeyTypeValueRow, RightAlignedTooltipInput, RightAlignedValueCell } from '@/features/panels/ui/KeyTypeValueRow'
import type { GraphRagWorkflowJsonLd } from '@/features/panels/utils/graphragConfig'
import type { AgenticRagIgnoreFiltersSummary } from '@/lib/graph/jsonld/index'
import { AgenticRagIgnoreFiltersSummaryView } from '@/features/panels/views/AgenticRagContextSection'
import {
  IGNORE_CODEBASE_PATHS_LABEL,
  IGNORE_CODEBASE_PATHS_TOOLTIP,
  WORKFLOW_INDEXING_PARAMETERS_TOOLTIP,
  GRAPHRAG_DATASET_INPUT_DIR_KEY_TOOLTIP,
  GRAPHRAG_DATASET_OUTPUT_DIR_KEY_TOOLTIP,
  GRAPHRAG_CHUNK_METHOD_KEY_TOOLTIP,
  GRAPHRAG_CHUNK_SIZE_KEY_TOOLTIP,
  GRAPHRAG_MAX_HOPS_KEY_TOOLTIP,
  GRAPHRAG_EMBEDDING_PROVIDER_KEY_TOOLTIP,
  GRAPHRAG_EMBEDDING_MODEL_NAME_KEY_TOOLTIP,
  GRAPHRAG_IGNORE_PATTERNS_VALUE_TOOLTIP,
  buildNumericTooltip,
  buildDefaultTooltip,
  UI_COPY,
} from '@/lib/config'
import { emitGraphTraversalFloatingPanelOpen } from '@/features/panels/utils/graphTraversalFloatingPanel'
import { useGraphStore } from '@/hooks/useGraphStore'
import { MonacoTextEditor } from '@/features/monaco/MonacoTextEditor'
import { uiToolbarButtonNeutralClassName } from '@/features/toolbar/ui/toolbarStyles'

const DATASET_INPUT_DIR_TOOLTIP = buildDefaultTooltip({
  defaultValue: './data/raw',
  impact: UI_COPY.graphRagWorkflowDatasetInputDirImpact,
})

const DATASET_OUTPUT_DIR_TOOLTIP = buildDefaultTooltip({
  defaultValue: './data/graphrag',
  impact: UI_COPY.graphRagWorkflowDatasetOutputDirImpact,
})

const CHUNK_METHOD_TOOLTIP = buildDefaultTooltip({
  defaultValue: 'recursive_character',
  impact: UI_COPY.graphRagWorkflowChunkMethodImpact,
})

const CHUNK_SIZE_TOOLTIP = buildNumericTooltip({
  defaultValue: 1024,
  min: 128,
  max: 4096,
  interval: 128,
  impact: UI_COPY.graphRagWorkflowChunkSizeImpact,
});

const MAX_HOPS_TOOLTIP = buildNumericTooltip({
  defaultValue: 3,
  min: 1,
  max: 8,
  interval: 1,
  impact: UI_COPY.graphRagWorkflowMaxHopsImpact,
});

interface GraphRagWorkflowIndexingSectionProps {
  mode: 'floatingPanel' | 'bottomPanel'
  workflowDoc: GraphRagWorkflowJsonLd
  indexingCollapsed: boolean
  onToggleIndexingCollapsed: (next: boolean) => void
  ignoreFilters: AgenticRagIgnoreFiltersSummary | null
  invalidIgnorePrefixes: string[]
  onChangeIgnoreCodebasePathsInput: (value: string) => void
  onUpdateWorkflow: (updater: (current: GraphRagWorkflowJsonLd) => GraphRagWorkflowJsonLd) => void
}

import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'

export function GraphRagWorkflowIndexingSection({
  mode,
  workflowDoc,
  indexingCollapsed,
  onToggleIndexingCollapsed,
  ignoreFilters,
  invalidIgnorePrefixes,
  onChangeIgnoreCodebasePathsInput,
  onUpdateWorkflow,
}: GraphRagWorkflowIndexingSectionProps) {
  const updateChunkSize = React.useCallback(
    (raw: number) => {
      const size = Number.isFinite(raw)
        ? Math.max(128, Math.min(4096, Math.floor(raw)))
        : 1024
      onUpdateWorkflow(current => {
        const next: GraphRagWorkflowJsonLd = {
          ...current,
          chunking: {
            ...(current.chunking || { '@type': 'rag:ChunkingConfig' }),
            chunkSize: size,
          },
        }
        return next
      })
    },
    [onUpdateWorkflow],
  )
  const uiPanelKeyValueInputClass = useGraphStore(
    s =>
      s.uiPanelKeyValueInputClass ||
      `w-full h-6 px-2 text-sm border ${UI_THEME_TOKENS.input.border} rounded text-right`,
  )
  const uiPanelMonospaceTextClass = useGraphStore(
    s => s.uiPanelMonospaceTextClass || 'font-mono text-xs',
  )
  const uiPanelKeyValueTextSizeClass = useGraphStore(
    s => s.uiPanelKeyValueTextSizeClass || 'text-sm',
  )
  const uiPanelMicroLabelTextSizeClass = useGraphStore(
    s => s.uiPanelMicroLabelTextSizeClass || 'text-xs',
  )
  const uiPanelTextFontClass = useGraphStore(
    s => s.uiPanelTextFontClass || 'font-sans',
  )
  const sectionTextClassName = `${UI_THEME_TOKENS.text.primary} ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass}`

  return (
    <CollapsibleSection
      title={(
        <Tooltip
          content={WORKFLOW_INDEXING_PARAMETERS_TOOLTIP}
          maxWidthPx={260}
          contentClassName={`${UI_THEME_TOKENS.tooltip.bg} ${UI_THEME_TOKENS.tooltip.text}`}
        >
          <span>{UI_COPY.graphRagWorkflowIndexingParametersTitle}</span>
        </Tooltip>
      )}
      headerClassName="px-0"
      collapsed={indexingCollapsed}
      onToggle={onToggleIndexingCollapsed}
      stickyOffsetClassName="top-6"
    >
      <div
        className={[
          'space-y-1',
          sectionTextClassName,
        ].join(' ')}
      >
        <div className="space-y-0.5">
          <KeyTypeValueRow
            layout="keyIconValue"
            keyNode={(
              <Tooltip
                content={GRAPHRAG_DATASET_INPUT_DIR_KEY_TOOLTIP}
                maxWidthPx={260}
                contentClassName={`${UI_THEME_TOKENS.tooltip.bg} ${UI_THEME_TOKENS.tooltip.text}`}
                className="break-words"
              >
                dataset.inputDir
              </Tooltip>
            )}
            typeNode={null}
            valueNode={(
              <RightAlignedTooltipInput
                tooltip={DATASET_INPUT_DIR_TOOLTIP}
                type="text"
                value={workflowDoc.dataset?.inputDir || ''}
                onChange={e => {
                  const value = e.target.value
                  onUpdateWorkflow(current => {
                    const next: GraphRagWorkflowJsonLd = {
                      ...current,
                      dataset: {
                        ...(current.dataset || {}),
                        inputDir: value,
                      },
                    }
                    return next
                  })
                }}
                placeholder="./data/raw"
              />
            )}
          />
          <KeyTypeValueRow
            layout="keyIconValue"
            keyNode={(
              <Tooltip
                content={GRAPHRAG_DATASET_OUTPUT_DIR_KEY_TOOLTIP}
                maxWidthPx={260}
                contentClassName={`${UI_THEME_TOKENS.tooltip.bg} ${UI_THEME_TOKENS.tooltip.text}`}
                className="break-words"
              >
                dataset.outputDir
              </Tooltip>
            )}
            typeNode={null}
            valueNode={(
              <RightAlignedTooltipInput
                tooltip={DATASET_OUTPUT_DIR_TOOLTIP}
                type="text"
                value={workflowDoc.dataset?.outputDir || ''}
                onChange={e => {
                  const value = e.target.value
                  onUpdateWorkflow(current => {
                    const next: GraphRagWorkflowJsonLd = {
                      ...current,
                      dataset: {
                        ...(current.dataset || {}),
                        outputDir: value,
                      },
                    }
                    return next
                  })
                }}
                placeholder="./data/graphrag"
              />
            )}
          />
          <KeyTypeValueRow
            layout="keyIconValue"
            keyNode={(
              <Tooltip
                content={GRAPHRAG_CHUNK_METHOD_KEY_TOOLTIP}
                maxWidthPx={260}
                contentClassName={`${UI_THEME_TOKENS.tooltip.bg} ${UI_THEME_TOKENS.tooltip.text}`}
                className="break-words"
              >
                chunking.method
              </Tooltip>
            )}
            typeNode={null}
            valueNode={(
              <RightAlignedTooltipInput
                tooltip={CHUNK_METHOD_TOOLTIP}
                type="text"
                value={workflowDoc.chunking?.method || ''}
                onChange={e => {
                  const value = e.target.value
                  onUpdateWorkflow(current => {
                    const next: GraphRagWorkflowJsonLd = {
                      ...current,
                      chunking: {
                        ...(current.chunking || { '@type': 'rag:ChunkingConfig' }),
                        method: value,
                      },
                    }
                    return next
                  })
                }}
                placeholder="recursive_character"
              />
            )}
          />
          <KeyTypeValueRow
            layout="keyIconSliderInput"
            keyNode={(
              <Tooltip
                content={GRAPHRAG_CHUNK_SIZE_KEY_TOOLTIP}
                maxWidthPx={260}
                contentClassName={`${UI_THEME_TOKENS.tooltip.bg} ${UI_THEME_TOKENS.tooltip.text}`}
                className="break-words"
              >
                chunking.chunkSize
              </Tooltip>
            )}
            typeNode={(
              <Tooltip
                content={CHUNK_SIZE_TOOLTIP}
                maxWidthPx={260}
                contentClassName={`${UI_THEME_TOKENS.tooltip.bg} ${UI_THEME_TOKENS.tooltip.text}`}
                className="w-full h-full"
              >
                <input
                  type="range"
                  min={128}
                  max={4096}
                  step={128}
                  value={workflowDoc.chunking?.chunkSize ?? 1024}
                  onChange={e => {
                    const raw = Number(e.target.value)
                    updateChunkSize(raw)
                  }}
                  className="w-full h-full"
                />
              </Tooltip>
            )}
            valueNode={(
              <Tooltip
                content={CHUNK_SIZE_TOOLTIP}
                maxWidthPx={260}
                contentClassName={`${UI_THEME_TOKENS.tooltip.bg} ${UI_THEME_TOKENS.tooltip.text}`}
                className="w-full h-full"
              >
                <input
                  type="number"
                  min={128}
                  max={4096}
                  step={128}
                  value={workflowDoc.chunking?.chunkSize ?? 1024}
                  onChange={e => {
                    const raw = Number(e.target.value)
                    updateChunkSize(raw)
                  }}
                  className={uiPanelKeyValueInputClass}
                />
              </Tooltip>
            )}
          />
          <KeyTypeValueRow
            layout="keyIconValue"
            keyNode={(
              <Tooltip
                content={GRAPHRAG_EMBEDDING_PROVIDER_KEY_TOOLTIP}
                maxWidthPx={260}
                contentClassName={`${UI_THEME_TOKENS.tooltip.bg} ${UI_THEME_TOKENS.tooltip.text}`}
                className="break-words"
              >
                embeddingModel.provider
              </Tooltip>
            )}
            typeNode={null}
            valueNode={(
              <RightAlignedTooltipInput
                tooltip={buildDefaultTooltip({
                  defaultValue: 'openai',
                  impact: UI_COPY.graphRagWorkflowEmbeddingProviderImpact,
                })}
                type="text"
                value={workflowDoc.embeddingModel?.provider || ''}
                onChange={e => {
                  const value = e.target.value
                  onUpdateWorkflow(current => {
                    const next: GraphRagWorkflowJsonLd = {
                      ...current,
                      embeddingModel: {
                        ...(current.embeddingModel || { '@type': 'rag:EmbeddingModel' }),
                        provider: value,
                      },
                    }
                    return next
                  })
                }}
                placeholder="openai"
              />
            )}
          />
          <KeyTypeValueRow
            layout="keyIconValue"
            keyNode={(
              <Tooltip
                content={GRAPHRAG_EMBEDDING_MODEL_NAME_KEY_TOOLTIP}
                maxWidthPx={260}
                contentClassName={`${UI_THEME_TOKENS.tooltip.bg} ${UI_THEME_TOKENS.tooltip.text}`}
                className="break-words"
              >
                embeddingModel.modelName
              </Tooltip>
            )}
            typeNode={null}
            valueNode={(
              <RightAlignedTooltipInput
                tooltip={buildDefaultTooltip({
                  defaultValue: 'text-embedding-3-large',
                  impact: UI_COPY.graphRagWorkflowEmbeddingModelNameImpact,
                })}
                type="text"
                value={workflowDoc.embeddingModel?.modelName || ''}
                onChange={e => {
                  const value = e.target.value
                  onUpdateWorkflow(current => {
                    const next: GraphRagWorkflowJsonLd = {
                      ...current,
                      embeddingModel: {
                        ...(current.embeddingModel || { '@type': 'rag:EmbeddingModel' }),
                        modelName: value,
                      },
                    }
                    return next
                  })
                }}
                placeholder="text-embedding-3-large"
              />
            )}
          />
          <KeyTypeValueRow
            layout="keyIconSliderInput"
            keyNode={(
              <Tooltip
                content={GRAPHRAG_MAX_HOPS_KEY_TOOLTIP}
                maxWidthPx={260}
                contentClassName={`${UI_THEME_TOKENS.tooltip.bg} ${UI_THEME_TOKENS.tooltip.text}`}
                className="break-words"
              >
                maxHops
              </Tooltip>
            )}
            typeNode={(
              <Tooltip
                content={MAX_HOPS_TOOLTIP}
                maxWidthPx={260}
                contentClassName={`${UI_THEME_TOKENS.tooltip.bg} ${UI_THEME_TOKENS.tooltip.text}`}
                className="w-full h-full"
              >
                <input
                  type="range"
                  min={1}
                  max={8}
                  step={1}
                  value={workflowDoc.maxHops}
                  onChange={e => {
                    const raw = Number(e.target.value)
                    const hops = Number.isFinite(raw)
                      ? Math.max(1, Math.min(8, Math.floor(raw)))
                      : 3
                    onUpdateWorkflow(current => {
                      const next: GraphRagWorkflowJsonLd = {
                        ...current,
                        maxHops: hops,
                      }
                      return next
                    })
                  }}
                  className="w-full h-full"
                />
              </Tooltip>
            )}
            valueNode={(
              <Tooltip
                content={MAX_HOPS_TOOLTIP}
                maxWidthPx={260}
                contentClassName={`${UI_THEME_TOKENS.tooltip.bg} ${UI_THEME_TOKENS.tooltip.text}`}
                className="w-full h-full"
              >
                <input
                  type="number"
                  min={1}
                  max={8}
                  step={1}
                  value={workflowDoc.maxHops}
                  onChange={e => {
                    const raw = Number(e.target.value)
                    const hops = Number.isFinite(raw)
                      ? Math.max(1, Math.min(8, Math.floor(raw)))
                      : 3
                    onUpdateWorkflow(current => {
                      const next: GraphRagWorkflowJsonLd = {
                        ...current,
                        maxHops: hops,
                      }
                      return next
                    })
                  }}
                  className={uiPanelKeyValueInputClass}
                />
              </Tooltip>
            )}
          />
          <KeyTypeValueRow
            layout="keyIconValue"
            keyNode={(
              <Tooltip
                content={IGNORE_CODEBASE_PATHS_TOOLTIP}
                maxWidthPx={260}
                contentClassName={`${UI_THEME_TOKENS.tooltip.bg} ${UI_THEME_TOKENS.tooltip.text}`}
                className="break-words"
              >
                {IGNORE_CODEBASE_PATHS_LABEL}
              </Tooltip>
            )}
            typeNode={null}
            valueNode={(
              <div className="space-y-1 w-full">
                {mode === 'bottomPanel' && (
                  <>
                    {ignoreFilters ? (
                      <AgenticRagIgnoreFiltersSummaryView
                        ignoreFilters={ignoreFilters}
                        variant="summary"
                        className="mt-0.5"
                      />
                    ) : (
                      <div
                        className={[
                          `mt-0.5 ${UI_THEME_TOKENS.text.tertiary} text-left`,
                          uiPanelMicroLabelTextSizeClass,
                        ].join(' ')}
                      >
                        {UI_COPY.graphRagIgnoreFiltersEmpty}
                      </div>
                    )}
                    <RightAlignedValueCell className="mt-0.5">
                      <Tooltip
                        content={GRAPHRAG_IGNORE_PATTERNS_VALUE_TOOLTIP}
                        maxWidthPx={260}
                        contentClassName={`${UI_THEME_TOKENS.tooltip.bg} ${UI_THEME_TOKENS.tooltip.text}`}
                        className="w-full h-full"
                      >
                        <div className={`w-full border ${UI_THEME_TOKENS.input.border} rounded overflow-hidden bg-transparent min-h-[96px]`}>
                          <MonacoTextEditor
                            value={ignoreFilters ? ignoreFilters.rawPatterns.join(', ') : ''}
                            onChange={(val) => onChangeIgnoreCodebasePathsInput(val)}
                            language="text"
                            uri="inmemory://graphrag/ignore-patterns"
                            themeMode="light"
                            wordWrap
                            className={`w-full h-full ${uiPanelMonospaceTextClass} ${UI_THEME_TOKENS.input.text}`}
                          />
                        </div>
                      </Tooltip>
                    </RightAlignedValueCell>
                    {invalidIgnorePrefixes.length > 0 && (
                      <div className="mt-0.5 text-amber-700 text-left">
                        {UI_COPY.graphRagUnrecognizedIgnorePrefixesLabel}{' '}
                        <span className={uiPanelMonospaceTextClass}>
                          {invalidIgnorePrefixes.join(', ')}
                        </span>
                        {' '}
                        {UI_COPY.graphRagUnrecognizedIgnorePrefixesSupportedSuffix}
                      </div>
                    )}
                  </>
                )}
                {mode === 'floatingPanel' && (
                  <div className="flex items-center justify-start">
                    <button
                      type="button"
                      className={[
                        `App-toolbar__btn ${uiToolbarButtonNeutralClassName}`,
                        uiPanelKeyValueTextSizeClass,
                        uiPanelTextFontClass,
                      ].join(' ')}
                      onClick={() => {
                        try {
                          emitGraphTraversalFloatingPanelOpen()
                        } catch {
                          void 0
                        }
                      }}
                    >
                      {UI_COPY.graphRagOpenOrchestratorIgnorePathsButtonLabel}
                    </button>
                  </div>
                )}
              </div>
            )}
            align="start"
          />
        </div>
      </div>
    </CollapsibleSection>
  )
}
