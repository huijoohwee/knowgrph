import React from 'react'

import type { GraphEdge, GraphNode } from '@/lib/graph/types'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { usePanelTypography } from '@/lib/ui/panelTypography'
import { cn } from '@/lib/utils'
import { readFlowEdgeDisplayLabel } from '@/lib/graph/flowPorts'

export type InspectorTab = 'node' | 'edge' | 'workflow'

export default function FlowEditorInspector({
  active,
  tab,
  setTab,
  selectedNode,
  selectedEdge,
  workflowNodes,
  workflowSelectedNodeId,
  onWorkflowSelectNode,
  onWorkflowRunNode,
  jsonError,
  nodePropsJson,
  setNodePropsJson,
  nodeMetaJson,
  setNodeMetaJson,
  edgePropsJson,
  setEdgePropsJson,
  edgeMetaJson,
  setEdgeMetaJson,
  workflowMetaJson,
  setWorkflowMetaJson,
  workflowContextJson,
  setWorkflowContextJson,
  onSetNodeLabel,
  onSetNodeType,
  onSetEdgeLabel,
  onApplyJson,
}: {
  active: boolean
  tab: InspectorTab
  setTab: (tab: InspectorTab) => void
  selectedNode: GraphNode | null
  selectedEdge: GraphEdge | null
  workflowNodes?: GraphNode[]
  workflowSelectedNodeId?: string | null
  onWorkflowSelectNode?: (nodeId: string) => void
  onWorkflowRunNode?: (nodeId: string) => void
  jsonError: string | null
  nodePropsJson: string
  setNodePropsJson: (v: string) => void
  nodeMetaJson: string
  setNodeMetaJson: (v: string) => void
  edgePropsJson: string
  setEdgePropsJson: (v: string) => void
  edgeMetaJson: string
  setEdgeMetaJson: (v: string) => void
  workflowMetaJson: string
  setWorkflowMetaJson: (v: string) => void
  workflowContextJson: string
  setWorkflowContextJson: (v: string) => void
  onSetNodeLabel: (label: string) => void
  onSetNodeType: (type: string) => void
  onSetEdgeLabel: (label: string) => void
  onApplyJson: (target: 'nodeProps' | 'nodeMeta' | 'edgeProps' | 'edgeMeta' | 'workflowMeta' | 'workflowContext') => void
}) {
  const { panelTextClass, microLabelClass, monospaceTextClass, keyValueInputClass, textSizeClass, keyLabelClass } = usePanelTypography()

  return (
    <section
      aria-label="Flow Editor Inspector"
      className={cn('h-full min-h-0 overflow-auto p-3', UI_THEME_TOKENS.panel.bg, UI_THEME_TOKENS.text.primary, panelTextClass)}
    >
      <header className="flex items-center justify-between gap-2">
        <h2 className={cn('font-semibold', UI_THEME_TOKENS.text.primary)}>Inspector</h2>
        <menu className="flex items-center gap-1" aria-label="Inspector tabs">
          <button
            type="button"
            className={`App-toolbar__btn ${tab === 'node' ? `${UI_THEME_TOKENS.button.activeBg} ${UI_THEME_TOKENS.button.activeText}` : `${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`}`}
            onClick={() => setTab('node')}
            disabled={!active}
          >
            Node
          </button>
          <button
            type="button"
            className={`App-toolbar__btn ${tab === 'edge' ? `${UI_THEME_TOKENS.button.activeBg} ${UI_THEME_TOKENS.button.activeText}` : `${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`}`}
            onClick={() => setTab('edge')}
            disabled={!active}
          >
            Edge
          </button>
          <button
            type="button"
            className={`App-toolbar__btn ${tab === 'workflow' ? `${UI_THEME_TOKENS.button.activeBg} ${UI_THEME_TOKENS.button.activeText}` : `${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`}`}
            onClick={() => setTab('workflow')}
            disabled={!active}
          >
            Workflow
          </button>
        </menu>
      </header>

      {jsonError && <p className={cn('mt-2 text-red-300', microLabelClass)}>{jsonError}</p>}

      {tab === 'node' && (
        <section aria-label="Node editor">
          {selectedNode ? (
            <>
              <p className={cn('mt-2', microLabelClass, UI_THEME_TOKENS.text.secondary)}>{selectedNode.id}</p>
              <label className={cn('mt-3 block', keyLabelClass, UI_THEME_TOKENS.text.secondary)} htmlFor="flow-editor-label">
                Label
              </label>
              <input
                id="flow-editor-label"
                className={cn(
                  'mt-1 w-full rounded-md',
                  keyValueInputClass,
                  textSizeClass,
                  UI_THEME_TOKENS.input.bg,
                  UI_THEME_TOKENS.input.border,
                  UI_THEME_TOKENS.input.text,
                )}
                value={String(selectedNode.label || '')}
                onChange={e => onSetNodeLabel(e.target.value)}
                disabled={!active}
              />
              <label className={cn('mt-3 block', keyLabelClass, UI_THEME_TOKENS.text.secondary)} htmlFor="flow-editor-type">
                Type
              </label>
              <input
                id="flow-editor-type"
                className={cn(
                  'mt-1 w-full rounded-md',
                  keyValueInputClass,
                  textSizeClass,
                  UI_THEME_TOKENS.input.bg,
                  UI_THEME_TOKENS.input.border,
                  UI_THEME_TOKENS.input.text,
                )}
                value={String(selectedNode.type || 'Node')}
                onChange={e => onSetNodeType(e.target.value)}
                disabled={!active}
              />
              <label
                className={cn('mt-3 block', keyLabelClass, UI_THEME_TOKENS.text.secondary)}
                htmlFor="flow-editor-node-props"
              >
                Properties (JSON)
              </label>
              <textarea
                id="flow-editor-node-props"
                className={cn(
                  'mt-1 w-full h-28 px-2 py-1 rounded-md border',
                  monospaceTextClass,
                  UI_THEME_TOKENS.input.bg,
                  UI_THEME_TOKENS.input.border,
                  UI_THEME_TOKENS.input.text,
                )}
                value={nodePropsJson}
                onChange={e => setNodePropsJson(e.target.value)}
                disabled={!active}
              />
              <button
                type="button"
                className={`mt-2 App-toolbar__btn ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`}
                onClick={() => onApplyJson('nodeProps')}
                disabled={!active}
              >
                Apply properties
              </button>
              <label
                className={cn('mt-3 block', keyLabelClass, UI_THEME_TOKENS.text.secondary)}
                htmlFor="flow-editor-node-meta"
              >
                Metadata (JSON)
              </label>
              <textarea
                id="flow-editor-node-meta"
                className={cn(
                  'mt-1 w-full h-24 px-2 py-1 rounded-md border',
                  monospaceTextClass,
                  UI_THEME_TOKENS.input.bg,
                  UI_THEME_TOKENS.input.border,
                  UI_THEME_TOKENS.input.text,
                )}
                value={nodeMetaJson}
                onChange={e => setNodeMetaJson(e.target.value)}
                disabled={!active}
              />
              <button
                type="button"
                className={`mt-2 App-toolbar__btn ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`}
                onClick={() => onApplyJson('nodeMeta')}
                disabled={!active}
              >
                Apply metadata
              </button>
            </>
          ) : (
            <p className={cn('mt-2', microLabelClass, UI_THEME_TOKENS.text.secondary)}>Select a node.</p>
          )}
        </section>
      )}

      {tab === 'edge' && (
        <section aria-label="Edge editor">
          {selectedEdge ? (
            <>
              {(() => {
                const displayLabel = readFlowEdgeDisplayLabel(selectedEdge)
                if (!displayLabel) return null
                if (displayLabel === String(selectedEdge.label || '').trim()) return null
                return (
                  <p className={cn('mt-2', microLabelClass, UI_THEME_TOKENS.text.secondary)}>
                    Display: {displayLabel}
                  </p>
                )
              })()}
              <p className={cn('mt-2', microLabelClass, UI_THEME_TOKENS.text.secondary)}>{selectedEdge.id}</p>
              <p className={cn('mt-1', microLabelClass, UI_THEME_TOKENS.text.secondary)}>
                {String(selectedEdge.source)} → {String(selectedEdge.target)}
              </p>
              <label
                className={cn('mt-3 block', keyLabelClass, UI_THEME_TOKENS.text.secondary)}
                htmlFor="flow-editor-edge-label"
              >
                Label
              </label>
              <input
                id="flow-editor-edge-label"
                className={cn(
                  'mt-1 w-full rounded-md',
                  keyValueInputClass,
                  textSizeClass,
                  UI_THEME_TOKENS.input.bg,
                  UI_THEME_TOKENS.input.border,
                  UI_THEME_TOKENS.input.text,
                )}
                value={String(selectedEdge.label || '')}
                onChange={e => onSetEdgeLabel(e.target.value)}
                disabled={!active}
              />
              <label
                className={cn('mt-3 block', keyLabelClass, UI_THEME_TOKENS.text.secondary)}
                htmlFor="flow-editor-edge-props"
              >
                Properties (JSON)
              </label>
              <textarea
                id="flow-editor-edge-props"
                className={cn(
                  'mt-1 w-full h-24 px-2 py-1 rounded-md border',
                  monospaceTextClass,
                  UI_THEME_TOKENS.input.bg,
                  UI_THEME_TOKENS.input.border,
                  UI_THEME_TOKENS.input.text,
                )}
                value={edgePropsJson}
                onChange={e => setEdgePropsJson(e.target.value)}
                disabled={!active}
              />
              <button
                type="button"
                className={`mt-2 App-toolbar__btn ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`}
                onClick={() => onApplyJson('edgeProps')}
                disabled={!active}
              >
                Apply properties
              </button>
              <label
                className={cn('mt-3 block', keyLabelClass, UI_THEME_TOKENS.text.secondary)}
                htmlFor="flow-editor-edge-meta"
              >
                Metadata (JSON)
              </label>
              <textarea
                id="flow-editor-edge-meta"
                className={cn(
                  'mt-1 w-full h-20 px-2 py-1 rounded-md border',
                  monospaceTextClass,
                  UI_THEME_TOKENS.input.bg,
                  UI_THEME_TOKENS.input.border,
                  UI_THEME_TOKENS.input.text,
                )}
                value={edgeMetaJson}
                onChange={e => setEdgeMetaJson(e.target.value)}
                disabled={!active}
              />
              <button
                type="button"
                className={`mt-2 App-toolbar__btn ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`}
                onClick={() => onApplyJson('edgeMeta')}
                disabled={!active}
              >
                Apply metadata
              </button>
            </>
          ) : (
            <p className={cn('mt-2', microLabelClass, UI_THEME_TOKENS.text.secondary)}>Select an edge.</p>
          )}
        </section>
      )}

      {tab === 'workflow' && (
        <section aria-label="Workflow editor">
          {Array.isArray(workflowNodes) && workflowNodes.length > 0 && (
            <nav className="mt-2" aria-label="Workflow node list">
              <ul className="flex flex-col gap-2">
                {workflowNodes.map(n => {
                  const id = String(n.id || '')
                  const isSelected = !!id && id === String(workflowSelectedNodeId || '')
                  return (
                    <li key={id}>
                      <article
                        className={`w-full rounded-lg border px-2 py-2 ${isSelected ? `${UI_THEME_TOKENS.button.activeBg} ${UI_THEME_TOKENS.input.border}` : `${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.input.border}`}`}
                      >
                        <header className="flex items-center justify-between gap-2">
                          <button
                            type="button"
                            className={`min-w-0 flex-1 text-left ${UI_THEME_TOKENS.text.primary}`}
                            onClick={() => onWorkflowSelectNode?.(id)}
                            disabled={!active || !onWorkflowSelectNode}
                          >
                            <span className="block truncate">{String(n.label || id)}</span>
                            <span className={cn('block truncate', microLabelClass, UI_THEME_TOKENS.text.secondary)}>
                              {String(n.type || 'Node')}
                            </span>
                          </button>
                          <button
                            type="button"
                            className={`App-toolbar__btn ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`}
                            onClick={() => onWorkflowRunNode?.(id)}
                            aria-label={`Run node ${id}`}
                            disabled={!active || !onWorkflowRunNode}
                          >
                            ▶
                          </button>
                        </header>
                      </article>
                    </li>
                  )
                })}
              </ul>
            </nav>
          )}

          <p className={cn('mt-3', microLabelClass, UI_THEME_TOKENS.text.secondary)}>Draft graph</p>
          <label
            className={cn('mt-3 block', keyLabelClass, UI_THEME_TOKENS.text.secondary)}
            htmlFor="flow-editor-workflow-meta"
          >
            Metadata (JSON)
          </label>
          <textarea
            id="flow-editor-workflow-meta"
            className={cn(
              'mt-1 w-full h-24 px-2 py-1 rounded-md border',
              monospaceTextClass,
              UI_THEME_TOKENS.input.bg,
              UI_THEME_TOKENS.input.border,
              UI_THEME_TOKENS.input.text,
            )}
            value={workflowMetaJson}
            onChange={e => setWorkflowMetaJson(e.target.value)}
            disabled={!active}
          />
          <button
            type="button"
            className={`mt-2 App-toolbar__btn ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`}
            onClick={() => onApplyJson('workflowMeta')}
            disabled={!active}
          >
            Apply workflow metadata
          </button>
          <label
            className={cn('mt-3 block', keyLabelClass, UI_THEME_TOKENS.text.secondary)}
            htmlFor="flow-editor-workflow-context"
          >
            Context (JSON)
          </label>
          <textarea
            id="flow-editor-workflow-context"
            className={cn(
              'mt-1 w-full h-24 px-2 py-1 rounded-md border',
              monospaceTextClass,
              UI_THEME_TOKENS.input.bg,
              UI_THEME_TOKENS.input.border,
              UI_THEME_TOKENS.input.text,
            )}
            value={workflowContextJson}
            onChange={e => setWorkflowContextJson(e.target.value)}
            disabled={!active}
          />
          <button
            type="button"
            className={`mt-2 App-toolbar__btn ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`}
            onClick={() => onApplyJson('workflowContext')}
            disabled={!active}
          >
            Apply workflow context
          </button>
        </section>
      )}
    </section>
  )
}
