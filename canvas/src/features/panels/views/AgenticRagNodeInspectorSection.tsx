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

  return (
    <div className="mt-2 border border-gray-200 rounded px-2 py-1">
      <div className="flex items-center justify-between mb-1">
        <Tooltip
          content={ORCHESTRATOR_AGENTIC_COPY.nodeInspectorTooltip}
          maxWidthPx={260}
          contentClassName={`${UI_THEME_TOKENS.tooltip.bg} ${UI_THEME_TOKENS.tooltip.text}`}
        >
          <div className="flex items-center gap-1">
            <div
              className={[
                uiPanelKeyValueTextSizeClass,
                uiPanelTextFontClass,
                'font-semibold uppercase tracking-wide text-gray-500',
              ].join(' ')}
            >
              {ORCHESTRATOR_AGENTIC_COPY.nodeInspectorTitle}
            </div>
          </div>
        </Tooltip>
        {selectedAgenticNode && (
          <button
            type="button"
            className={[
              'App-toolbar__btn bg-gray-100 text-gray-700',
              uiPanelKeyValueTextSizeClass,
              uiPanelTextFontClass,
            ].join(' ')}
            onClick={onCopyAgenticRagNodeJson}
          >
            {AGENTIC_RAG_NODE_JSON_COPY_LABEL}
          </button>
        )}
      </div>
      {agenticCopyStatus && selectedAgenticNode && (
        <div
          className={[
            uiPanelKeyValueTextSizeClass,
            uiPanelTextFontClass,
            'text-gray-500 mb-1',
          ].join(' ')}
        >
          {agenticCopyStatus}
        </div>
      )}
      {!selectedAgenticNode && (
        <div className="text-xs text-gray-500 space-y-[2px]">
          <div>
            {ORCHESTRATOR_AGENTIC_COPY.nodeInspectorEmptyIntro}
          </div>
          <div>
            {ORCHESTRATOR_AGENTIC_COPY.nodeInspectorEmptyExample}
          </div>
          <div>
            {ORCHESTRATOR_AGENTIC_COPY.nodeInspectorEmptyProvenance}
          </div>
        </div>
      )}
      {selectedAgenticNode && (
        <div className="text-xs text-gray-700 space-y-1">
          <div className="grid grid-cols-2 gap-1">
            <SimpleKeyValueRow
              density="compact"
              label={<span className="text-gray-600">Id</span>}
            >
              <span className={`${uiPanelMonospaceTextClass} break-all`}>
                {selectedAgenticNode.id}
              </span>
            </SimpleKeyValueRow>
            <SimpleKeyValueRow
              density="compact"
              label={<span className="text-gray-600">Labels</span>}
            >
              <span className={`${uiPanelMonospaceTextClass} break-words`}>
                {selectedAgenticNode.labels.join(', ')}
              </span>
            </SimpleKeyValueRow>
          </div>
          <div className="grid grid-cols-2 gap-1">
            {selectedAgenticNode.chunkText && (
              <SimpleKeyValueRow
                density="compact"
                align="start"
                label={<span className="text-gray-600">chunk_text</span>}
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
                label={<span className="text-gray-600">embedding</span>}
              >
                <span className={`${uiPanelMonospaceTextClass} break-words`}>
                  [{selectedAgenticNode.embedding.length} values]
                </span>
              </SimpleKeyValueRow>
            )}
            {selectedAgenticNode.geo && (
              <SimpleKeyValueRow
                density="compact"
                label={<span className="text-gray-600">geo</span>}
              >
                <span className={`${uiPanelMonospaceTextClass} break-words`}>
                  lat={selectedAgenticNode.geo.lat}, lng={selectedAgenticNode.geo.lng}
                </span>
              </SimpleKeyValueRow>
            )}
            {selectedAgenticNode.mediaKind && (
              <SimpleKeyValueRow
                density="compact"
                label={<span className="text-gray-600">media.kind</span>}
              >
                <span className={`${uiPanelMonospaceTextClass} break-words`}>
                  {selectedAgenticNode.mediaKind}
                </span>
              </SimpleKeyValueRow>
            )}
            {selectedAgenticNode.mediaUrl && (
              <SimpleKeyValueRow
                density="compact"
                label={<span className="text-gray-600">media.url</span>}
              >
                <span className={`${uiPanelMonospaceTextClass} break-all`}>
                  {selectedAgenticNode.mediaUrl}
                </span>
              </SimpleKeyValueRow>
            )}
          </div>
          {selectedAgenticNode.provenance && (
            <div className="grid grid-cols-2 gap-1">
              {Object.entries(selectedAgenticNode.provenance).map(([key, value]) => {
                return (
                  <SimpleKeyValueRow
                    key={key}
                    density="compact"
                    align="start"
                    label={(
                      <span className="text-gray-600">
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
            </div>
          )}
          <div className="grid grid-cols-2 gap-1">
            {selectedAgenticNode.graphRAGPath && (
              <SimpleKeyValueRow
                density="compact"
                align="start"
                label={<span className="text-gray-600">graphRAGPath</span>}
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
                  label={<span className="text-gray-600">graphRAGPath type</span>}
                >
                  <span
                    className={getChipClass('selected', {
                      textSizeClass: uiIconPillBadgeTextSizeClass,
                      textColorClass: 'text-blue-700',
                    })}
                  >
                    {agenticPathInfo.pathType}
                  </span>
                </SimpleKeyValueRow>
                {agenticPathInfo.query && (
                  <SimpleKeyValueRow
                    density="compact"
                    align="start"
                    label={<span className="text-gray-600">query</span>}
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
                    label={<span className="text-gray-600">example</span>}
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
                    label={<span className="text-gray-600">traverse</span>}
                  >
                    <span className="flex flex-wrap gap-1 mt-[1px]">
                      {agenticPathInfo.traverse.map(id => (
                        <span
                          key={`traverse-${String(id)}`}
                          className={getChipClass('default', {
                            textSizeClass: uiIconPillBadgeTextSizeClass,
                            textColorClass: 'text-gray-700',
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
                    label={<span className="text-gray-600">hops</span>}
                  >
                    <span className="flex flex-wrap gap-1 mt-[1px]">
                      {agenticPathInfo.hops.map((hop, index) => (
                        <span
                          key={`hop-${index}-${hop}`}
                          className={getChipClass('default', {
                            textSizeClass: uiIconPillBadgeTextSizeClass,
                            textColorClass: 'text-gray-700',
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
                    label={<span className="text-gray-600">multiHop</span>}
                  >
                    <span className="flex flex-wrap gap-1 mt-[1px]">
                      {agenticPathInfo.multiHop.map((hop, index) => (
                        <span
                          key={`multiHop-${index}-${hop}`}
                          className={getChipClass('default', {
                            textSizeClass: uiIconPillBadgeTextSizeClass,
                            textColorClass: 'text-gray-700',
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
          </div>
          <div className="grid grid-cols-2 gap-1">
            <SimpleKeyValueRow
              density="compact"
              align="start"
              label={(
                <span className="text-gray-600">
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
                <span className="text-gray-600">
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
                <span className="text-gray-600">
                  {GRAPHRAG_PATH_IRI_LABEL}
                </span>
              )}
            >
              <span className={`${uiPanelMonospaceTextClass} break-all`}>
                {AGENTIC_RAG_GRAPH_RAG_PATH_IRI}
              </span>
            </SimpleKeyValueRow>
          </div>
        </div>
      )}
    </div>
  )
}
