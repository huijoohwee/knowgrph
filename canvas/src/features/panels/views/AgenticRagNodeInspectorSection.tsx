import React from 'react'
import Tooltip from '@/features/panels/ui/Tooltip'
import {
  AGENTIC_RAG_CONTEXT_URL,
  AGENTIC_RAG_SCHEMA_URL,
  AGENTIC_RAG_GRAPH_RAG_PATH_IRI,
} from '@/lib/agenticrag'
import type { AgenticRagNodeView } from '@/lib/graph/types'
import { ORCHESTRATOR_AGENTIC_COPY } from '@/features/panels/config'
import { type AgenticPathInfo } from '@/features/panels/views/AgenticRagNodeInspectorSectionModel'
import { SimpleKeyValueRow } from '@/features/panels/ui/KeyTypeValueRow'
import { useGraphStore } from '@/hooks/useGraphStore'
import { getChipClass } from '@/lib/ui'
import {
  AGENTIC_RAG_SCHEMA_LABEL,
  AGENTIC_RAG_CONTEXT_LABEL,
  GRAPHRAG_PATH_IRI_LABEL,
  AGENTIC_RAG_NODE_JSON_COPY_LABEL,
} from '@/lib/config'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'

const AGENTIC_RAG_NODE_INSPECTOR_DENSE_GRID_CLASS_NAME = 'grid min-w-0 grid-cols-1 gap-1 sm:grid-cols-2'

interface AgenticRagNodeInspectorSectionProps {
  selectedAgenticNode: AgenticRagNodeView | null
  agenticCopyStatus: string | null
  onCopyAgenticRagNodeJson: () => void
  agenticPathInfo: AgenticPathInfo | null
}

export function AgenticRagNodeInspectorSection({
  selectedAgenticNode,
  agenticCopyStatus,
  onCopyAgenticRagNodeJson,
  agenticPathInfo,
}: AgenticRagNodeInspectorSectionProps) {
  const uiPanelKeyValueTextSizeClass = useGraphStore(
    s => s.uiPanelKeyValueTextSizeClass || 'text-xs',
  )
  const uiPanelTextFontClass = useGraphStore(
    s => s.uiPanelTextFontClass || 'font-sans',
  )
  const uiIconPillBadgeTextSizeClass = useGraphStore(s => s.uiIconPillBadgeTextSizeClass)
  const uiPanelMonospaceTextClass = useGraphStore(
    s => s.uiPanelMonospaceTextClass || 'font-mono text-xs',
  )
  const inspectorPanelClassName = `mt-2 border ${UI_THEME_TOKENS.panel.border} rounded px-2 py-1`
  const inspectorHeadingClassName = `${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} font-semibold uppercase tracking-wide ${UI_THEME_TOKENS.text.tertiary}`
  const inspectorMutedTextClassName = `${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} ${UI_THEME_TOKENS.text.tertiary}`
  const inspectorBodyClassName = `text-xs ${UI_THEME_TOKENS.text.primary} space-y-1`
  const inspectorLabelClassName = UI_THEME_TOKENS.text.secondary

  return (
    <section className={inspectorPanelClassName}>
      <section className="flex items-center justify-between mb-1">
        <Tooltip
          content={ORCHESTRATOR_AGENTIC_COPY.nodeInspectorTooltip}
          maxWidthPx={260}
          contentClassName={`${UI_THEME_TOKENS.tooltip.bg} ${UI_THEME_TOKENS.tooltip.text}`}
        >
          <section className="flex items-center gap-1">
            <section
              className={inspectorHeadingClassName}
            >
              {ORCHESTRATOR_AGENTIC_COPY.nodeInspectorTitle}
            </section>
          </section>
        </Tooltip>
        {selectedAgenticNode && (
          <button
            type="button"
            className={[
              'App-toolbar__btn',
              UI_THEME_TOKENS.button.neutralMuted,
              UI_THEME_TOKENS.button.hoverBg,
              uiPanelKeyValueTextSizeClass,
              uiPanelTextFontClass,
            ].join(' ')}
            onClick={onCopyAgenticRagNodeJson}
          >
            {AGENTIC_RAG_NODE_JSON_COPY_LABEL}
          </button>
        )}
      </section>
      {agenticCopyStatus && selectedAgenticNode && (
        <section
          className={`${inspectorMutedTextClassName} mb-1`}
        >
          {agenticCopyStatus}
        </section>
      )}
      {!selectedAgenticNode && (
        <section className={`text-xs ${UI_THEME_TOKENS.text.tertiary} space-y-[2px]`}>
          <section>
            {ORCHESTRATOR_AGENTIC_COPY.nodeInspectorEmptyIntro}
          </section>
          <section>
            {ORCHESTRATOR_AGENTIC_COPY.nodeInspectorEmptyExample}
          </section>
          <section>
            {ORCHESTRATOR_AGENTIC_COPY.nodeInspectorEmptyProvenance}
          </section>
        </section>
      )}
      {selectedAgenticNode && (
        <section className={inspectorBodyClassName}>
          <section className={AGENTIC_RAG_NODE_INSPECTOR_DENSE_GRID_CLASS_NAME}>
            <SimpleKeyValueRow
              density="compact"
              label={<span className={inspectorLabelClassName}>Id</span>}
            >
              <span className={`${uiPanelMonospaceTextClass} break-all`}>
                {selectedAgenticNode.id}
              </span>
            </SimpleKeyValueRow>
            <SimpleKeyValueRow
              density="compact"
              label={<span className={inspectorLabelClassName}>Labels</span>}
            >
              <span className={`${uiPanelMonospaceTextClass} break-words`}>
                {selectedAgenticNode.labels.join(', ')}
              </span>
            </SimpleKeyValueRow>
          </section>
          <section className={AGENTIC_RAG_NODE_INSPECTOR_DENSE_GRID_CLASS_NAME}>
            {selectedAgenticNode.chunkText && (
              <SimpleKeyValueRow
                density="compact"
                align="start"
                label={<span className={inspectorLabelClassName}>chunk_text</span>}
              >
                <span className={`${uiPanelMonospaceTextClass} break-words`}>
                  {String(selectedAgenticNode.chunkText).slice(0, 240)}
                  {String(selectedAgenticNode.chunkText).length > 240 ? '…' : ''}
                </span>
              </SimpleKeyValueRow>
            )}
            {selectedAgenticNode.embedding && (
              <SimpleKeyValueRow
                density="compact"
                label={<span className={inspectorLabelClassName}>embedding</span>}
              >
                <span className={`${uiPanelMonospaceTextClass} break-words`}>
                  [{selectedAgenticNode.embedding.length} values]
                </span>
              </SimpleKeyValueRow>
            )}
            {selectedAgenticNode.geo && (
              <SimpleKeyValueRow
                density="compact"
                label={<span className={inspectorLabelClassName}>geo</span>}
              >
                <span className={`${uiPanelMonospaceTextClass} break-words`}>
                  lat={selectedAgenticNode.geo.lat}, lng={selectedAgenticNode.geo.lng}
                </span>
              </SimpleKeyValueRow>
            )}
            {selectedAgenticNode.mediaKind && (
              <SimpleKeyValueRow
                density="compact"
                label={<span className={inspectorLabelClassName}>media.kind</span>}
              >
                <span className={`${uiPanelMonospaceTextClass} break-words`}>
                  {selectedAgenticNode.mediaKind}
                </span>
              </SimpleKeyValueRow>
            )}
            {selectedAgenticNode.mediaUrl && (
              <SimpleKeyValueRow
                density="compact"
                label={<span className={inspectorLabelClassName}>media.url</span>}
              >
                <span className={`${uiPanelMonospaceTextClass} break-all`}>
                  {selectedAgenticNode.mediaUrl}
                </span>
              </SimpleKeyValueRow>
            )}
          </section>
          {selectedAgenticNode.provenance && (
            <section className={AGENTIC_RAG_NODE_INSPECTOR_DENSE_GRID_CLASS_NAME}>
              {Object.entries(selectedAgenticNode.provenance).map(([key, value]) => {
                return (
                  <SimpleKeyValueRow
                    key={key}
                    density="compact"
                    align="start"
                    label={(
                      <span className={inspectorLabelClassName}>
                        provenance.{key}
                      </span>
                    )}
                  >
                    <span className={`${uiPanelMonospaceTextClass} break-all`}>
                      {typeof value === 'string' ? value : JSON.stringify(value)}
                    </span>
                  </SimpleKeyValueRow>
                )
              })}
            </section>
          )}
          <section className={AGENTIC_RAG_NODE_INSPECTOR_DENSE_GRID_CLASS_NAME}>
            {selectedAgenticNode.graphRAGPath && (
              <SimpleKeyValueRow
                density="compact"
                align="start"
                label={<span className={inspectorLabelClassName}>graphRAGPath</span>}
              >
                <span className={`${uiPanelMonospaceTextClass} break-words`}>
                  {JSON.stringify(selectedAgenticNode.graphRAGPath)}
                </span>
              </SimpleKeyValueRow>
            )}
            {agenticPathInfo && (
              <>
                <SimpleKeyValueRow
                  density="compact"
                  label={<span className={inspectorLabelClassName}>graphRAGPath type</span>}
                >
                  <span
                    className={getChipClass('selected', {
                      textSizeClass: uiIconPillBadgeTextSizeClass,
                      textColorClass: UI_THEME_TOKENS.status.info,
                    })}
                  >
                    {agenticPathInfo.pathType}
                  </span>
                </SimpleKeyValueRow>
                {agenticPathInfo.query && (
                  <SimpleKeyValueRow
                    density="compact"
                    align="start"
                    label={<span className={inspectorLabelClassName}>query</span>}
                  >
                    <span className={`${uiPanelMonospaceTextClass} break-words`}>
                      {agenticPathInfo.query}
                    </span>
                  </SimpleKeyValueRow>
                )}
                {agenticPathInfo.example && (
                  <SimpleKeyValueRow
                    density="compact"
                    align="start"
                    label={<span className={inspectorLabelClassName}>example</span>}
                  >
                    <span className={`${uiPanelMonospaceTextClass} break-words`}>
                      {agenticPathInfo.example}
                    </span>
                  </SimpleKeyValueRow>
                )}
                {agenticPathInfo.traverse.length > 0 && (
                  <SimpleKeyValueRow
                    density="compact"
                    align="start"
                    label={<span className={inspectorLabelClassName}>traverse</span>}
                  >
                    <span className="flex flex-wrap gap-1 mt-[1px]">
                      {agenticPathInfo.traverse.map(id => (
                        <span
                          key={`traverse-${String(id)}`}
                          className={getChipClass('default', {
                            textSizeClass: uiIconPillBadgeTextSizeClass,
                            textColorClass: UI_THEME_TOKENS.text.primary,
                            extraClassName: uiPanelMonospaceTextClass,
                          })}
                        >
                          {String(id)}
                        </span>
                      ))}
                    </span>
                  </SimpleKeyValueRow>
                )}
                {agenticPathInfo.hops.length > 0 && (
                  <SimpleKeyValueRow
                    density="compact"
                    align="start"
                    label={<span className={inspectorLabelClassName}>hops</span>}
                  >
                    <span className="flex flex-wrap gap-1 mt-[1px]">
                      {agenticPathInfo.hops.map((hop, index) => (
                        <span
                          key={`hop-${index}-${hop}`}
                          className={getChipClass('default', {
                            textSizeClass: uiIconPillBadgeTextSizeClass,
                            textColorClass: UI_THEME_TOKENS.text.primary,
                            extraClassName: uiPanelMonospaceTextClass,
                          })}
                        >
                          {hop}
                        </span>
                      ))}
                    </span>
                  </SimpleKeyValueRow>
                )}
                {agenticPathInfo.multiHop.length > 0 && (
                  <SimpleKeyValueRow
                    density="compact"
                    align="start"
                    label={<span className={inspectorLabelClassName}>multiHop</span>}
                  >
                    <span className="flex flex-wrap gap-1 mt-[1px]">
                      {agenticPathInfo.multiHop.map((hop, index) => (
                        <span
                          key={`multiHop-${index}-${hop}`}
                          className={getChipClass('default', {
                            textSizeClass: uiIconPillBadgeTextSizeClass,
                            textColorClass: UI_THEME_TOKENS.text.primary,
                            extraClassName: uiPanelMonospaceTextClass,
                          })}
                        >
                          {hop}
                        </span>
                      ))}
                    </span>
                  </SimpleKeyValueRow>
                )}
              </>
            )}
          </section>
          <section className={AGENTIC_RAG_NODE_INSPECTOR_DENSE_GRID_CLASS_NAME}>
            <SimpleKeyValueRow
              density="compact"
              align="start"
              label={(
                <span className={inspectorLabelClassName}>
                  {AGENTIC_RAG_SCHEMA_LABEL}
                </span>
              )}
            >
              <span className={`${uiPanelMonospaceTextClass} break-all`}>
                {AGENTIC_RAG_SCHEMA_URL}
              </span>
            </SimpleKeyValueRow>
            <SimpleKeyValueRow
              density="compact"
              align="start"
              label={(
                <span className={inspectorLabelClassName}>
                  {AGENTIC_RAG_CONTEXT_LABEL}
                </span>
              )}
            >
              <span className={`${uiPanelMonospaceTextClass} break-all`}>
                {AGENTIC_RAG_CONTEXT_URL}
              </span>
            </SimpleKeyValueRow>
            <SimpleKeyValueRow
              density="compact"
              align="start"
              label={(
                <span className={inspectorLabelClassName}>
                  {GRAPHRAG_PATH_IRI_LABEL}
                </span>
              )}
            >
              <span className={`${uiPanelMonospaceTextClass} break-all`}>
                {AGENTIC_RAG_GRAPH_RAG_PATH_IRI}
              </span>
            </SimpleKeyValueRow>
          </section>
        </section>
      )}
    </section>
  )
}
