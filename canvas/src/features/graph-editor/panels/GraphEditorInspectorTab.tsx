import React from 'react'
import { useShallow } from 'zustand/react/shallow'

import { useGraphStore } from '@/hooks/useGraphStore'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import type { GraphData, GraphEdge, GraphNode } from '@/lib/graph/types'
import { readSubgraphs, subgraphGroupId, writeSubgraphs } from '@/lib/graph/subgraphs'
import type { GraphSchema } from '@/lib/graph/schema'
import { readGroupBoundsOverrideSource } from '@/lib/canvas/groupBoundsOverrides'
import { resetGroupBoundsOverrideInStore } from '@/lib/canvas/groupBoundsOverridesStore'

export function GraphEditorInspectorTab() {
  const {
    graphData,
    schema,
    selectedNodeId,
    selectedEdgeId,
    selectedGroupId,
    updateNode,
    updateEdge,
    setGraphDataPreservingLayout,
    addHistory,
  } = useGraphStore(
    useShallow(s => ({
      graphData: s.graphData as GraphData | null,
      schema: s.schema as GraphSchema,
      selectedNodeId: (typeof s.selectedNodeId === 'string' ? s.selectedNodeId : null) as string | null,
      selectedEdgeId: (typeof s.selectedEdgeId === 'string' ? s.selectedEdgeId : null) as string | null,
      selectedGroupId: (typeof s.selectedGroupId === 'string' ? s.selectedGroupId : null) as string | null,
      updateNode: s.updateNode,
      updateEdge: s.updateEdge,
      setGraphDataPreservingLayout: s.setGraphDataPreservingLayout,
      addHistory: s.addHistory,
    })),
  )

  const subgraphs = React.useMemo(() => readSubgraphs(graphData), [graphData])

  const selectedNode: GraphNode | null = React.useMemo(() => {
    if (!graphData || !selectedNodeId) return null
    return (graphData.nodes || []).find(n => String(n.id || '') === selectedNodeId) || null
  }, [graphData, selectedNodeId])

  const selectedEdge: GraphEdge | null = React.useMemo(() => {
    if (!graphData || !selectedEdgeId) return null
    return (graphData.edges || []).find(e => String(e.id || '') === selectedEdgeId) || null
  }, [graphData, selectedEdgeId])

  const selectedSubgraph = React.useMemo(() => {
    if (!graphData || !selectedGroupId) return null
    const match = selectedGroupId.startsWith('subgraph:') ? selectedGroupId.slice('subgraph:'.length) : ''
    if (!match) return null
    return subgraphs.find(sg => sg.id === match) || null
  }, [graphData, selectedGroupId, subgraphs])

  const selectedGroupBoundsOverride = React.useMemo(() => {
    if (!graphData || !schema || !selectedGroupId) return { source: null, bounds: null } as { source: 'node' | 'schema' | null; bounds: unknown }
    const nodes = Array.isArray(graphData.nodes) ? (graphData.nodes as GraphNode[]) : ([] as GraphNode[])
    return readGroupBoundsOverrideSource({ groupId: selectedGroupId, graphNodes: nodes, schema })
  }, [graphData, schema, selectedGroupId])

  const nodeSubgraphId = React.useMemo(() => {
    if (!selectedNodeId) return ''
    const sg = subgraphs.find(s => s.memberNodeIds.includes(selectedNodeId))
    return sg ? sg.id : ''
  }, [selectedNodeId, subgraphs])

  const setNodeSubgraph = React.useCallback(
    (nextId: string) => {
      if (!graphData || !selectedNodeId) return
      const next = subgraphs.map(sg => {
        const has = sg.memberNodeIds.includes(selectedNodeId)
        if (sg.id === nextId) {
          if (has) return sg
          return { ...sg, memberNodeIds: Array.from(new Set([...sg.memberNodeIds, selectedNodeId])).sort((a, b) => a.localeCompare(b)) }
        }
        if (!has) return sg
        return { ...sg, memberNodeIds: sg.memberNodeIds.filter(id => id !== selectedNodeId) }
      })
      const nextData = writeSubgraphs(graphData, next)
      setGraphDataPreservingLayout(nextData)
      addHistory('Move Node to Subgraph')
    },
    [addHistory, graphData, selectedNodeId, setGraphDataPreservingLayout, subgraphs],
  )

  if (!graphData) {
    return <p className={`text-sm ${UI_THEME_TOKENS.text.secondary}`}>Select a node, edge, or subgraph.</p>
  }

  if (selectedNode) {
    return (
      <section className="space-y-3" aria-label="Inspector node">
        <section className={`text-xs font-medium ${UI_THEME_TOKENS.text.secondary}`}>Node</section>
        <section className={`font-mono text-xs ${UI_THEME_TOKENS.text.secondary}`}>{selectedNode.id}</section>
        <label className="block">
          <section className={`text-[10px] ${UI_THEME_TOKENS.text.tertiary}`}>Label</section>
          <input
            className={`mt-1 w-full rounded-md border px-2 py-1 text-sm ${UI_THEME_TOKENS.input.bg} ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.input.text}`}
            value={String(selectedNode.label || '')}
            onChange={e => updateNode(selectedNode.id, { label: e.target.value })}
            aria-label="Node label"
          />
        </label>
        <label className="block">
          <section className={`text-[10px] ${UI_THEME_TOKENS.text.tertiary}`}>Type</section>
          <input
            className={`mt-1 w-full rounded-md border px-2 py-1 text-sm ${UI_THEME_TOKENS.input.bg} ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.input.text}`}
            value={String(selectedNode.type || '')}
            onChange={e => updateNode(selectedNode.id, { type: e.target.value })}
            aria-label="Node type"
          />
        </label>
        <label className="block">
          <section className={`text-[10px] ${UI_THEME_TOKENS.text.tertiary}`}>Subgraph</section>
          <select
            className={`mt-1 w-full rounded-md border px-2 py-1 text-sm ${UI_THEME_TOKENS.input.bg} ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.input.text}`}
            value={nodeSubgraphId}
            onChange={e => setNodeSubgraph(e.target.value)}
            aria-label="Node subgraph"
          >
            <option value="">None</option>
            {subgraphs.map(sg => (
              <option key={sg.id} value={sg.id}>
                {sg.label}
              </option>
            ))}
          </select>
        </label>
      </section>
    )
  }

  if (selectedEdge) {
    return (
      <section className="space-y-3" aria-label="Inspector edge">
        <section className={`text-xs font-medium ${UI_THEME_TOKENS.text.secondary}`}>Edge</section>
        <section className={`font-mono text-xs ${UI_THEME_TOKENS.text.secondary}`}>{selectedEdge.id}</section>
        <label className="block">
          <section className={`text-[10px] ${UI_THEME_TOKENS.text.tertiary}`}>Label</section>
          <input
            className={`mt-1 w-full rounded-md border px-2 py-1 text-sm ${UI_THEME_TOKENS.input.bg} ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.input.text}`}
            value={String(selectedEdge.label || '')}
            onChange={e => updateEdge(selectedEdge.id, { label: e.target.value })}
            aria-label="Edge label"
          />
        </label>
        <section className="grid grid-cols-2 gap-2">
          <section>
            <section className={`text-[10px] ${UI_THEME_TOKENS.text.tertiary}`}>Source</section>
            <section className={`mt-0.5 font-mono text-xs ${UI_THEME_TOKENS.text.secondary}`}>{String(selectedEdge.source)}</section>
          </section>
          <section>
            <section className={`text-[10px] ${UI_THEME_TOKENS.text.tertiary}`}>Target</section>
            <section className={`mt-0.5 font-mono text-xs ${UI_THEME_TOKENS.text.secondary}`}>{String(selectedEdge.target)}</section>
          </section>
        </section>
      </section>
    )
  }

  if (selectedSubgraph) {
    return (
      <section className="space-y-3" aria-label="Inspector subgraph">
        <section className={`text-xs font-medium ${UI_THEME_TOKENS.text.secondary}`}>Subgraph</section>
        <section className={`font-mono text-xs ${UI_THEME_TOKENS.text.secondary}`}>{subgraphGroupId(selectedSubgraph.id)}</section>
        <section className={`text-sm ${UI_THEME_TOKENS.text.secondary}`}>{selectedSubgraph.memberNodeIds.length} nodes</section>
        {selectedGroupBoundsOverride.source ? (
          <section className="space-y-2" aria-label="Bounds override">
            <section className={`text-[10px] ${UI_THEME_TOKENS.text.tertiary}`}>Bounds override</section>
            <section className={`text-xs ${UI_THEME_TOKENS.text.secondary}`}>Source: {selectedGroupBoundsOverride.source}</section>
            <button
              type="button"
              className={`w-full rounded-md border px-2 py-1 text-xs ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`}
              onClick={() => {
                resetGroupBoundsOverrideInStore(subgraphGroupId(selectedSubgraph.id))
              }}
            >
              Reset bounds to auto
            </button>
          </section>
        ) : null}
      </section>
    )
  }

  if (selectedGroupId) {
    return (
      <section className="space-y-3" aria-label="Inspector group">
        <section className={`text-xs font-medium ${UI_THEME_TOKENS.text.secondary}`}>Group</section>
        <section className={`font-mono text-xs ${UI_THEME_TOKENS.text.secondary}`}>{selectedGroupId}</section>
        {selectedGroupBoundsOverride.source ? (
          <section className="space-y-2" aria-label="Bounds override">
            <section className={`text-[10px] ${UI_THEME_TOKENS.text.tertiary}`}>Bounds override</section>
            <section className={`text-xs ${UI_THEME_TOKENS.text.secondary}`}>Source: {selectedGroupBoundsOverride.source}</section>
            <button
              type="button"
              className={`w-full rounded-md border px-2 py-1 text-xs ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`}
              onClick={() => {
                resetGroupBoundsOverrideInStore(selectedGroupId)
              }}
            >
              Reset bounds to auto
            </button>
          </section>
        ) : (
          <section className={`text-xs ${UI_THEME_TOKENS.text.tertiary}`}>No bounds override set.</section>
        )}
      </section>
    )
  }

  return <p className={`text-sm ${UI_THEME_TOKENS.text.secondary}`}>Select a node, edge, or subgraph.</p>
}
