import React from 'react'

import type { GraphEdge, GraphNode } from '@/lib/graph/types'
import { UI_COPY } from '@/lib/config'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { usePanelTypography } from '@/lib/ui/panelTypography'
import {
  UI_RESPONSIVE_CARD_MULTILINE_EDITOR_CLASSNAME,
  UI_RESPONSIVE_CARD_TITLE_EDITOR_CLASSNAME,
  UI_RESPONSIVE_PANEL_CODE_EDITOR_COMPACT_FRAME_CLASSNAME,
  UI_RESPONSIVE_PANEL_CODE_EDITOR_FRAME_CLASSNAME,
  UI_RESPONSIVE_PANEL_CODE_EDITOR_LARGE_FRAME_CLASSNAME,
} from '@/lib/ui/responsiveElementClasses'
import { cn } from '@/lib/utils'
import { readFlowEdgeDisplayLabel } from '@/lib/graph/flowPorts'
import type { UserSubgraph } from '@/lib/graph/subgraphs'
import { subgraphGroupId } from '@/lib/graph/subgraphs'
import { PlainTextInputEditor } from '@/components/ui/PlainTextInputEditor'
import { CardInlineTextEditor } from '@/lib/cards/CardInlineTextEditor'
import {
  GRAPH_NODE_CARD_TEXT_FIELDS,
  buildGraphNodeCanonicalTextPatch,
  readGraphNodeCanonicalTextProperty,
  readGraphNodeCardTitle,
  readGraphNodeProperties,
} from '@/lib/cards/graphNodeCardFields'
import { StoryboardWidgetInspectorTabs, type InspectorTab } from './StoryboardWidgetInspectorTabs'
import {
  StoryboardWidgetInspectorJsonButton,
  type StoryboardWidgetInspectorJsonTarget,
} from './StoryboardWidgetInspectorJsonButton'

export type { InspectorTab } from './StoryboardWidgetInspectorTabs'

export default function StoryboardWidgetInspector({
  active,
  tab,
  setTab,
  selectedNode,
  selectedEdge,
  subgraphs,
  selectedNodeIds,
  collapsedGroupIds,
  onCreateSubgraphFromSelection,
  onSetSubgraphKind,
  onRenameSubgraph,
  onDeleteSubgraph,
  onSetSubgraphParent,
  onAddSelectionToSubgraph,
  onRemoveSelectionFromSubgraph,
  onToggleSubgraphCollapsed,
  onSelectSubgraph,
  workflowNodes,
  workflowSelectedNodeId,
  onWorkflowSelectNode,
  onWorkflowRunNode,
  onWorkflowExportBundle,
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
  onPatchSelectedNodeProperties,
  onSetNodeType,
  onSetEdgeLabel,
  onApplyJson,
}: {
  active: boolean
  tab: InspectorTab
  setTab: (tab: InspectorTab) => void
  selectedNode: GraphNode | null
  selectedEdge: GraphEdge | null
  subgraphs: UserSubgraph[]
  selectedNodeIds: string[]
  collapsedGroupIds: string[]
  onCreateSubgraphFromSelection: (args: { label?: string; kind?: 'subgraph' | 'cluster' }) => void
  onSetSubgraphKind: (id: string, kind: 'subgraph' | 'cluster') => void
  onRenameSubgraph: (id: string, label: string) => void
  onDeleteSubgraph: (id: string) => void
  onSetSubgraphParent: (id: string, parentId: string | null) => void
  onAddSelectionToSubgraph: (id: string) => void
  onRemoveSelectionFromSubgraph: (id: string) => void
  onToggleSubgraphCollapsed: (id: string) => void
  onSelectSubgraph: (id: string) => void
  workflowNodes?: GraphNode[]
  workflowSelectedNodeId?: string | null
  onWorkflowSelectNode?: (nodeId: string) => void
  onWorkflowRunNode?: (nodeId: string) => void
  onWorkflowExportBundle?: () => void
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
  onPatchSelectedNodeProperties: (patch: Record<string, unknown>) => void
  onSetNodeType: (type: string) => void
  onSetEdgeLabel: (label: string) => void
  onApplyJson: (target: StoryboardWidgetInspectorJsonTarget) => void
}) {
  const { panelTextClass, microLabelClass, monospaceTextClass, keyValueInputClass, textSizeClass, keyLabelClass } = usePanelTypography()
  const [newSubgraphLabel, setNewSubgraphLabel] = React.useState('')
  const [newSubgraphKind, setNewSubgraphKind] = React.useState<'subgraph' | 'cluster'>('subgraph')
  const selectedNodeProperties = React.useMemo(() => readGraphNodeProperties(selectedNode), [selectedNode])
  const selectedNodeCardTitle = React.useMemo(() => readGraphNodeCardTitle(selectedNode), [selectedNode])
  const selectedNodeCardFields = React.useMemo(
    () => GRAPH_NODE_CARD_TEXT_FIELDS.map(field => ({
      ...field,
      value: readGraphNodeCanonicalTextProperty(selectedNodeProperties, field.propertyKeys),
    })),
    [selectedNodeProperties],
  )
  const canEditSelectedNodeCard = active && !!selectedNode

  return (
    <section
      aria-label="Storyboard Widget Inspector"
      className={cn('h-full min-h-0 overflow-auto p-3', UI_THEME_TOKENS.panel.bg, UI_THEME_TOKENS.text.primary, panelTextClass)}
    >
      <header className="flex items-center justify-between gap-2">
        <h2 className={cn('font-semibold', UI_THEME_TOKENS.text.primary)}>Inspector</h2>
        <StoryboardWidgetInspectorTabs active={active} tab={tab} setTab={setTab} />
      </header>

      {jsonError && <p className={cn('mt-2 text-red-300', microLabelClass)}>{jsonError}</p>}

      {tab === 'node' && (
        <section aria-label="Node editor">
          <p className={cn('mt-2', microLabelClass, UI_THEME_TOKENS.text.secondary)}>
            {selectedNode ? selectedNode.id : 'No selection'}
          </p>
          <section
            className={cn(
              'mt-3 rounded-lg border p-3',
              UI_THEME_TOKENS.panel.border,
              UI_THEME_TOKENS.panel.bg,
            )}
            aria-label="Shared card editor"
          >
            <p className={cn(microLabelClass, UI_THEME_TOKENS.text.tertiary)}>Card</p>
            <CardInlineTextEditor
              value={selectedNodeCardTitle}
              ariaLabel={selectedNode ? `Card title for ${selectedNode.id}` : 'Card title'}
              placeholder="Add title"
              canEdit={canEditSelectedNodeCard}
              editActivation="click"
              onCommit={onSetNodeLabel}
              displayClassName={cn('mt-2 text-sm font-semibold leading-5', UI_THEME_TOKENS.text.primary)}
              editorClassName={`mt-2 ${UI_RESPONSIVE_CARD_TITLE_EDITOR_CLASSNAME} text-sm font-semibold leading-5`}
            />
            <section className="mt-3 flex flex-col gap-2">
              {selectedNodeCardFields.map(field => (
                <section key={field.id} className="rounded-md border border-black/5 bg-black/[0.025] px-2.5 py-2">
                  <p className={cn('m-0 text-[10px] font-semibold uppercase tracking-[0.08em]', UI_THEME_TOKENS.text.tertiary)}>
                    {field.label}
                  </p>
                  <CardInlineTextEditor
                    value={field.value}
                    ariaLabel={selectedNode ? `${field.label} for ${selectedNode.id}` : field.label}
                    placeholder={field.placeholder}
                    canEdit={canEditSelectedNodeCard}
                    editActivation="click"
                    multiline
                    rows={3}
                    onCommit={nextValue => {
                      onPatchSelectedNodeProperties(
                        buildGraphNodeCanonicalTextPatch({
                          currentProperties: selectedNodeProperties,
                          propertyKeys: field.propertyKeys,
                          canonicalKey: field.canonicalKey,
                          nextValue,
                        }),
                      )
                    }}
                    displayClassName={cn('m-0 mt-1 text-xs leading-5', UI_THEME_TOKENS.text.secondary)}
                    editorClassName={`mt-1 ${UI_RESPONSIVE_CARD_MULTILINE_EDITOR_CLASSNAME} text-xs leading-5`}
                  />
                </section>
              ))}
            </section>
          </section>
          <label className={cn('mt-3 block', keyLabelClass, UI_THEME_TOKENS.text.secondary)} htmlFor="storyboard-widget-type">
            Type
          </label>
          <PlainTextInputEditor
            id="storyboard-widget-type"
            className={cn(
              'mt-1 w-full rounded-md',
              keyValueInputClass,
              textSizeClass,
              UI_THEME_TOKENS.input.bg,
              UI_THEME_TOKENS.input.border,
              UI_THEME_TOKENS.input.text,
            )}
            value={String(selectedNode?.type || 'Node')}
            onChange={onSetNodeType}
            disabled={!active || !selectedNode}
          />
          <label
            className={cn('mt-3 block', keyLabelClass, UI_THEME_TOKENS.text.secondary)}
            htmlFor="storyboard-widget-node-props"
          >
            Properties (JSON)
          </label>
          <PlainTextInputEditor
            id="storyboard-widget-node-props"
            className={cn(
              'mt-1 px-2 py-1 rounded-md border',
              UI_RESPONSIVE_PANEL_CODE_EDITOR_LARGE_FRAME_CLASSNAME,
              monospaceTextClass,
              UI_THEME_TOKENS.input.bg,
              UI_THEME_TOKENS.input.border,
              UI_THEME_TOKENS.input.text,
            )}
            value={nodePropsJson}
            onChange={setNodePropsJson}
            multiline
            disabled={!active || !selectedNode}
          />
          <StoryboardWidgetInspectorJsonButton label="Apply properties" target="nodeProps" disabled={!active || !selectedNode} onApplyJson={onApplyJson} />
          <label
            className={cn('mt-3 block', keyLabelClass, UI_THEME_TOKENS.text.secondary)}
            htmlFor="storyboard-widget-node-meta"
          >
            Metadata (JSON)
          </label>
          <PlainTextInputEditor
            id="storyboard-widget-node-meta"
            className={cn(
              'mt-1 px-2 py-1 rounded-md border',
              UI_RESPONSIVE_PANEL_CODE_EDITOR_FRAME_CLASSNAME,
              monospaceTextClass,
              UI_THEME_TOKENS.input.bg,
              UI_THEME_TOKENS.input.border,
              UI_THEME_TOKENS.input.text,
            )}
            value={nodeMetaJson}
            onChange={setNodeMetaJson}
            multiline
            disabled={!active || !selectedNode}
          />
          <StoryboardWidgetInspectorJsonButton label="Apply metadata" target="nodeMeta" disabled={!active || !selectedNode} onApplyJson={onApplyJson} />
        </section>
      )}

      {tab === 'edge' && (
        <section aria-label="Edge editor">
          {(() => {
            const displayLabel = selectedEdge ? readFlowEdgeDisplayLabel(selectedEdge) : null
            if (!displayLabel) return null
            if (displayLabel === String(selectedEdge?.label || '').trim()) return null
            return (
              <p className={cn('mt-2', microLabelClass, UI_THEME_TOKENS.text.secondary)}>
                Display: {displayLabel}
              </p>
            )
          })()}
          <p className={cn('mt-2', microLabelClass, UI_THEME_TOKENS.text.secondary)}>
            {selectedEdge ? selectedEdge.id : 'No selection'}
          </p>
          <p className={cn('mt-1', microLabelClass, UI_THEME_TOKENS.text.secondary)}>
            {selectedEdge ? `${String(selectedEdge.source)} → ${String(selectedEdge.target)}` : '—'}
          </p>
          <label
            className={cn('mt-3 block', keyLabelClass, UI_THEME_TOKENS.text.secondary)}
            htmlFor="storyboard-widget-edge-label"
          >
            Label
          </label>
          <PlainTextInputEditor
            id="storyboard-widget-edge-label"
            className={cn(
              'mt-1 w-full rounded-md',
              keyValueInputClass,
              textSizeClass,
              UI_THEME_TOKENS.input.bg,
              UI_THEME_TOKENS.input.border,
              UI_THEME_TOKENS.input.text,
            )}
            value={String(selectedEdge?.label || '')}
            onChange={onSetEdgeLabel}
            disabled={!active || !selectedEdge}
          />
          <label
            className={cn('mt-3 block', keyLabelClass, UI_THEME_TOKENS.text.secondary)}
            htmlFor="storyboard-widget-edge-props"
          >
            Properties (JSON)
          </label>
          <PlainTextInputEditor
            id="storyboard-widget-edge-props"
            className={cn(
              'mt-1 px-2 py-1 rounded-md border',
              UI_RESPONSIVE_PANEL_CODE_EDITOR_FRAME_CLASSNAME,
              monospaceTextClass,
              UI_THEME_TOKENS.input.bg,
              UI_THEME_TOKENS.input.border,
              UI_THEME_TOKENS.input.text,
            )}
            value={edgePropsJson}
            onChange={setEdgePropsJson}
            multiline
            disabled={!active || !selectedEdge}
          />
          <StoryboardWidgetInspectorJsonButton label="Apply properties" target="edgeProps" disabled={!active || !selectedEdge} onApplyJson={onApplyJson} />
          <label
            className={cn('mt-3 block', keyLabelClass, UI_THEME_TOKENS.text.secondary)}
            htmlFor="storyboard-widget-edge-meta"
          >
            Metadata (JSON)
          </label>
          <PlainTextInputEditor
            id="storyboard-widget-edge-meta"
            className={cn(
              'mt-1 px-2 py-1 rounded-md border',
              UI_RESPONSIVE_PANEL_CODE_EDITOR_COMPACT_FRAME_CLASSNAME,
              monospaceTextClass,
              UI_THEME_TOKENS.input.bg,
              UI_THEME_TOKENS.input.border,
              UI_THEME_TOKENS.input.text,
            )}
            value={edgeMetaJson}
            onChange={setEdgeMetaJson}
            multiline
            disabled={!active || !selectedEdge}
          />
          <StoryboardWidgetInspectorJsonButton label="Apply metadata" target="edgeMeta" disabled={!active || !selectedEdge} onApplyJson={onApplyJson} />
        </section>
      )}

      {tab === 'workflow' && (
        <section aria-label="Workflow editor">
          <menu className="mt-2 flex items-center gap-2" aria-label="Workflow actions">
            <button
              type="button"
              className={`App-toolbar__btn ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`}
              onClick={() => onWorkflowExportBundle?.()}
              disabled={!active || !onWorkflowExportBundle}
            >
              {UI_COPY.storyboardWidgetExportBundleButton}
            </button>
          </menu>
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
            htmlFor="storyboard-widget-workflow-meta"
          >
            Metadata (JSON)
          </label>
          <PlainTextInputEditor
            id="storyboard-widget-workflow-meta"
            className={cn(
              'mt-1 px-2 py-1 rounded-md border',
              UI_RESPONSIVE_PANEL_CODE_EDITOR_FRAME_CLASSNAME,
              monospaceTextClass,
              UI_THEME_TOKENS.input.bg,
              UI_THEME_TOKENS.input.border,
              UI_THEME_TOKENS.input.text,
            )}
            value={workflowMetaJson}
            onChange={setWorkflowMetaJson}
            multiline
            disabled={!active}
          />
          <StoryboardWidgetInspectorJsonButton label="Apply workflow metadata" target="workflowMeta" disabled={!active} onApplyJson={onApplyJson} />
          <label
            className={cn('mt-3 block', keyLabelClass, UI_THEME_TOKENS.text.secondary)}
            htmlFor="storyboard-widget-workflow-context"
          >
            Context (JSON)
          </label>
          <PlainTextInputEditor
            id="storyboard-widget-workflow-context"
            className={cn(
              'mt-1 px-2 py-1 rounded-md border',
              UI_RESPONSIVE_PANEL_CODE_EDITOR_FRAME_CLASSNAME,
              monospaceTextClass,
              UI_THEME_TOKENS.input.bg,
              UI_THEME_TOKENS.input.border,
              UI_THEME_TOKENS.input.text,
            )}
            value={workflowContextJson}
            onChange={setWorkflowContextJson}
            multiline
            disabled={!active}
          />
          <StoryboardWidgetInspectorJsonButton label="Apply workflow context" target="workflowContext" disabled={!active} onApplyJson={onApplyJson} />
        </section>
      )}

      {tab === 'groups' && (
        <section aria-label="Groups editor">
          <p className={cn('mt-2', microLabelClass, UI_THEME_TOKENS.text.secondary)}>
            Selection: {selectedNodeIds.length} node{selectedNodeIds.length === 1 ? '' : 's'}
          </p>
          <label className={cn('mt-3 block', keyLabelClass, UI_THEME_TOKENS.text.secondary)} htmlFor="storyboard-widget-new-subgraph-label">
            New group label
          </label>
          <PlainTextInputEditor
            id="storyboard-widget-new-subgraph-label"
            className={cn(
              'mt-1 w-full rounded-md',
              keyValueInputClass,
              textSizeClass,
              UI_THEME_TOKENS.input.bg,
              UI_THEME_TOKENS.input.border,
              UI_THEME_TOKENS.input.text,
            )}
            value={newSubgraphLabel}
            onChange={setNewSubgraphLabel}
            disabled={!active}
            placeholder="Subgraph label"
          />
          <label className={cn('mt-3 block', keyLabelClass, UI_THEME_TOKENS.text.secondary)} htmlFor="storyboard-widget-new-subgraph-kind">
            Kind
          </label>
          <select
            id="storyboard-widget-new-subgraph-kind"
            className={cn(
              'mt-1 w-full rounded-md',
              keyValueInputClass,
              textSizeClass,
              UI_THEME_TOKENS.input.bg,
              UI_THEME_TOKENS.input.border,
              UI_THEME_TOKENS.input.text,
            )}
            value={newSubgraphKind}
            onChange={e => setNewSubgraphKind(e.target.value === 'cluster' ? 'cluster' : 'subgraph')}
            disabled={!active}
          >
            <option value="subgraph">Subgraph</option>
            <option value="cluster">Cluster</option>
          </select>
          <button
            type="button"
            className={`mt-2 App-toolbar__btn ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`}
            onClick={() => {
              const label = String(newSubgraphLabel || '').trim()
              onCreateSubgraphFromSelection({ label: label ? label : undefined, kind: newSubgraphKind })
              setNewSubgraphLabel('')
            }}
            disabled={!active || selectedNodeIds.length === 0}
          >
            Create group from selection
          </button>

          {subgraphs.length === 0 ? (
            <p className={cn('mt-3', microLabelClass, UI_THEME_TOKENS.text.secondary)}>No groups yet.</p>
          ) : (
            <nav className="mt-3" aria-label="Groups list">
              <ul className="flex flex-col gap-2">
                {subgraphs.map(sg => {
                  const gid = subgraphGroupId(sg.id)
                  const isCollapsed = gid ? collapsedGroupIds.includes(gid) : false
                  return (
                    <li key={sg.id}>
                      <article className={`w-full rounded-lg border px-2 py-2 ${UI_THEME_TOKENS.input.border}`}>
                        <header className="flex items-start justify-between gap-2">
                          <section className="min-w-0 flex-1">
                            <p className={cn(microLabelClass, UI_THEME_TOKENS.text.tertiary)}>{sg.id}</p>
                            <PlainTextInputEditor
                              className={cn(
                                'mt-1 w-full rounded-md',
                                keyValueInputClass,
                                textSizeClass,
                                UI_THEME_TOKENS.input.bg,
                                UI_THEME_TOKENS.input.border,
                                UI_THEME_TOKENS.input.text,
                              )}
                              defaultValue={sg.label}
                              onBlur={e => onRenameSubgraph(sg.id, e.target.value)}
                              disabled={!active}
                            />
                            <p className={cn('mt-1', microLabelClass, UI_THEME_TOKENS.text.secondary)}>
                              Members: {(sg.memberNodeIds || []).length}
                            </p>
                          </section>
                          <menu className="flex flex-col items-end gap-1" aria-label={`Group actions ${sg.id}`}>
                            <button
                              type="button"
                              className={`App-toolbar__btn ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`}
                              onClick={() => onSelectSubgraph(sg.id)}
                              disabled={!active}
                            >
                              Select
                            </button>
                            <button
                              type="button"
                              className={`App-toolbar__btn ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`}
                              onClick={() => onToggleSubgraphCollapsed(sg.id)}
                              disabled={!active || !gid}
                            >
                              {isCollapsed ? 'Expand' : 'Collapse'}
                            </button>
                            <button
                              type="button"
                              className={`App-toolbar__btn ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`}
                              onClick={() => onAddSelectionToSubgraph(sg.id)}
                              disabled={!active || selectedNodeIds.length === 0}
                            >
                              Add selection
                            </button>
                            <button
                              type="button"
                              className={`App-toolbar__btn ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`}
                              onClick={() => onRemoveSelectionFromSubgraph(sg.id)}
                              disabled={!active || selectedNodeIds.length === 0}
                            >
                              Remove selection
                            </button>
                            <button
                              type="button"
                              className={`App-toolbar__btn ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`}
                              onClick={() => onDeleteSubgraph(sg.id)}
                              disabled={!active}
                            >
                              Delete
                            </button>
                          </menu>
                        </header>

                        <label className={cn('mt-2 block', keyLabelClass, UI_THEME_TOKENS.text.secondary)} htmlFor={`storyboard-widget-subgraph-kind-${sg.id}`}>
                          Kind
                        </label>
                        <select
                          id={`storyboard-widget-subgraph-kind-${sg.id}`}
                          className={cn(
                            'mt-1 w-full rounded-md',
                            keyValueInputClass,
                            textSizeClass,
                            UI_THEME_TOKENS.input.bg,
                            UI_THEME_TOKENS.input.border,
                            UI_THEME_TOKENS.input.text,
                          )}
                          value={sg.kind === 'cluster' ? 'cluster' : 'subgraph'}
                          onChange={e => onSetSubgraphKind(sg.id, e.target.value === 'cluster' ? 'cluster' : 'subgraph')}
                          disabled={!active}
                        >
                          <option value="subgraph">Subgraph</option>
                          <option value="cluster">Cluster</option>
                        </select>
                        <label className={cn('mt-2 block', keyLabelClass, UI_THEME_TOKENS.text.secondary)} htmlFor={`storyboard-widget-subgraph-parent-${sg.id}`}>
                          Parent
                        </label>
                        <select
                          id={`storyboard-widget-subgraph-parent-${sg.id}`}
                          className={cn(
                            'mt-1 w-full rounded-md',
                            keyValueInputClass,
                            textSizeClass,
                            UI_THEME_TOKENS.input.bg,
                            UI_THEME_TOKENS.input.border,
                            UI_THEME_TOKENS.input.text,
                          )}
                          value={sg.parentId == null ? '' : String(sg.parentId)}
                          onChange={e => onSetSubgraphParent(sg.id, e.target.value ? e.target.value : null)}
                          disabled={!active}
                        >
                          <option value="">(none)</option>
                          {subgraphs
                            .filter(parent => parent.id !== sg.id)
                            .map(parent => (
                              <option key={parent.id} value={parent.id}>
                                {parent.label}
                              </option>
                            ))}
                        </select>
                      </article>
                    </li>
                  )
                })}
              </ul>
            </nav>
          )}
        </section>
      )}
    </section>
  )
}
