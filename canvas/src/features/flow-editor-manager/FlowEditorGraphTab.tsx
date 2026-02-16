import React from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Trash2 } from 'lucide-react'

import { useGraphStore } from '@/hooks/useGraphStore'
import { UI_COPY, UI_LABELS } from '@/lib/config'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { usePanelTypography } from '@/lib/ui/panelTypography'
import type { GraphData, GraphEdge, GraphNode } from '@/lib/graph/types'
import { deriveGraphGroups } from '@/components/GraphCanvas/layout/graphGroups'
import { cn } from '@/lib/utils'
import { CANVAS_2D_RENDERER_ORDER, getCanvas2dRendererLabel } from '@/lib/renderer/canvas2dRendererRegistry'
import type { Canvas2dRendererId } from '@/lib/config'
import { emitDesignLayersPanelOpen } from '@/features/canvas/utils'

type Row = { id: string; label: string; sublabel?: string }

const normId = (v: unknown): string => String(v || '').trim()

function coerceRowsFromNodes(data: GraphData | null): Row[] {
  const nodes = data && Array.isArray(data.nodes) ? (data.nodes as GraphNode[]) : []
  const out: Row[] = []
  for (let i = 0; i < nodes.length; i += 1) {
    const n = nodes[i]
    const id = normId(n?.id)
    if (!id) continue
    const label = String(n?.label || id).trim() || id
    const type = String(n?.type || '').trim()
    out.push({ id, label, ...(type ? { sublabel: type } : {}) })
  }
  out.sort((a, b) => a.label.localeCompare(b.label))
  return out
}

function coerceRowsFromEdges(data: GraphData | null): Row[] {
  const edges = data && Array.isArray(data.edges) ? (data.edges as GraphEdge[]) : []
  const out: Row[] = []
  for (let i = 0; i < edges.length; i += 1) {
    const e = edges[i]
    const id = normId(e?.id)
    if (!id) continue
    const label = String(e?.label || id).trim() || id
    const source = normId((e as unknown as { source?: unknown }).source)
    const target = normId((e as unknown as { target?: unknown }).target)
    const sublabel = source && target ? `${source} → ${target}` : undefined
    out.push({ id, label, ...(sublabel ? { sublabel } : {}) })
  }
  out.sort((a, b) => a.label.localeCompare(b.label))
  return out
}

function matchesQuery(row: Row, q: string): boolean {
  if (!q) return true
  const hay = `${row.label} ${row.id} ${row.sublabel || ''}`.toLowerCase()
  return hay.includes(q)
}

export default function FlowEditorGraphTab({ searchQuery }: { searchQuery: string }) {
  const panelTypography = usePanelTypography()
  const q = String(searchQuery || '').trim().toLowerCase()

  const {
    graphData,
    graphDataRevision,
    selectedNodeId,
    selectedEdgeId,
    selectedGroupId,
    collapsedGroupIds,
    canvas2dRenderer,
    setCanvas2dRenderer,
    setSelectionSource,
    selectNode,
    selectEdge,
    selectGroup,
    toggleGroupCollapsed,
    requestZoom,
    removeNode,
    removeEdge,
    clearAllDesignFramePos,
  } = useGraphStore(
    useShallow(s => ({
      graphData: s.graphData,
      graphDataRevision: s.graphDataRevision,
      selectedNodeId: s.selectedNodeId,
      selectedEdgeId: s.selectedEdgeId,
      selectedGroupId: s.selectedGroupId,
      collapsedGroupIds: s.collapsedGroupIds,
      canvas2dRenderer: s.canvas2dRenderer,
      setCanvas2dRenderer: s.setCanvas2dRenderer,
      setSelectionSource: s.setSelectionSource,
      selectNode: s.selectNode,
      selectEdge: s.selectEdge,
      selectGroup: s.selectGroup,
      toggleGroupCollapsed: s.toggleGroupCollapsed,
      requestZoom: s.requestZoom,
      removeNode: s.removeNode,
      removeEdge: s.removeEdge,
      clearAllDesignFramePos: s.clearAllDesignFramePos,
    })),
  )

  const nodes = React.useMemo(() => coerceRowsFromNodes(graphData), [graphData, graphDataRevision])
  const edges = React.useMemo(() => coerceRowsFromEdges(graphData), [graphData, graphDataRevision])

  const layers = React.useMemo(() => {
    if (!graphData) return []
    const groups = deriveGraphGroups(graphData)
    return groups.map(g => {
      const id = normId(g.id)
      const label = String(g.label || id)
      const depth = typeof g.depth === 'number' && Number.isFinite(g.depth) ? g.depth : 0
      const count = Array.isArray(g.memberNodeIds) ? g.memberNodeIds.length : 0
      return { id, label, depth, count }
    })
  }, [graphData, graphDataRevision])

  const collapsedSet = React.useMemo(() => new Set((collapsedGroupIds || []).map(x => String(x || '').trim()).filter(Boolean)), [collapsedGroupIds])

  const filteredNodes = React.useMemo(() => nodes.filter(r => matchesQuery(r, q)), [nodes, q])
  const filteredEdges = React.useMemo(() => edges.filter(r => matchesQuery(r, q)), [edges, q])
  const filteredLayers = React.useMemo(
    () => layers.filter(r => matchesQuery({ id: r.id, label: r.label, sublabel: `depth=${r.depth} nodes=${r.count}` }, q)),
    [layers, q],
  )

  return (
    <section className="h-full min-h-0 flex flex-col" aria-label={UI_LABELS.flowEditorGraph}>
      <header className={cn('px-3 py-2 border-b flex items-center justify-between gap-3', UI_THEME_TOKENS.panel.border)}>
        <section className="min-w-0" aria-label="Summary">
          <section className={cn(panelTypography.microLabelClass, UI_THEME_TOKENS.text.secondary)}>{UI_LABELS.status}</section>
          <section className={cn('text-xs font-semibold truncate', UI_THEME_TOKENS.text.primary)}>
            {UI_LABELS.nodesLabel} {nodes.length} · {UI_LABELS.edgesLabel} {edges.length} · {UI_LABELS.graphLayersMode} {layers.length}
          </section>
        </section>
        <section className="flex items-center gap-2" aria-label="Actions">
          <button
            type="button"
            className={cn('App-toolbar__btn text-xs', UI_THEME_TOKENS.button.text, UI_THEME_TOKENS.button.hoverBg)}
            onClick={() => clearAllDesignFramePos()}
            aria-label={UI_LABELS.reset}
            title="Clear Design frame positions"
          >
            {UI_LABELS.reset}
          </button>
        </section>
      </header>

      <main className="flex-1 min-h-0 overflow-auto" aria-label="Graph content">
        <section className="p-3 space-y-4" aria-label="Graph manager">
          <section aria-label="Renderer">
            <header className={cn('text-xs font-semibold mb-2', UI_THEME_TOKENS.text.primary)}>Renderer</header>
            <div className={cn('flex items-center gap-1 rounded border p-1', UI_THEME_TOKENS.panel.border)} role="tablist" aria-label="2D renderers">
              {CANVAS_2D_RENDERER_ORDER.map(id => {
                const selected = canvas2dRenderer === id
                return (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    className={cn(
                      'px-2 py-1 text-xs rounded',
                      selected ? `${UI_THEME_TOKENS.button.activeBg} ${UI_THEME_TOKENS.button.activeText}` : `${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`,
                    )}
                    onClick={() => setCanvas2dRenderer(id as Canvas2dRendererId)}
                  >
                    {getCanvas2dRendererLabel(id)}
                  </button>
                )
              })}
            </div>
          </section>

          <section aria-label={UI_LABELS.node}>
            <header className={cn('text-xs font-semibold mb-2', UI_THEME_TOKENS.text.primary)}>{UI_LABELS.node}</header>
            <ul className="m-0 p-0 list-none rounded border overflow-hidden" aria-label="Nodes list">
              {filteredNodes.length === 0 ? (
                <li className={cn('px-3 py-2 text-xs', UI_THEME_TOKENS.text.tertiary)}>{UI_COPY.noGraphLoaded}</li>
              ) : (
                filteredNodes.slice(0, 200).map(r => {
                  const selected = selectedNodeId === r.id
                  return (
                    <li key={r.id} className={cn('border-b last:border-b-0', UI_THEME_TOKENS.panel.border)}>
                      <div className="flex items-stretch">
                        <button
                          type="button"
                          className={cn('flex-1 text-left px-3 py-2', selected ? 'bg-blue-50 dark:bg-blue-900/20' : '', UI_THEME_TOKENS.button.hoverBg)}
                          onClick={() => {
                            setSelectionSource('menu')
                            selectNode(r.id)
                            requestZoom('selection')
                          }}
                          aria-label={r.label}
                        >
                          <section className={cn('text-xs font-semibold truncate', UI_THEME_TOKENS.text.primary)}>{r.label}</section>
                          <section className={cn('text-[10px] font-mono truncate', UI_THEME_TOKENS.text.tertiary)}>
                            {r.sublabel ? `${r.sublabel} · ${r.id}` : r.id}
                          </section>
                        </button>
                        <button
                          type="button"
                          className={cn('px-3 py-2 text-xs border-l', UI_THEME_TOKENS.panel.border, UI_THEME_TOKENS.button.text, UI_THEME_TOKENS.button.hoverBg)}
                          onClick={e => {
                            e.stopPropagation()
                            removeNode(r.id)
                          }}
                          aria-label={`Delete node ${r.label}`}
                          title="Delete node"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </li>
                  )
                })
              )}
            </ul>
          </section>

          <section aria-label={UI_LABELS.edgesLabel}>
            <header className={cn('text-xs font-semibold mb-2', UI_THEME_TOKENS.text.primary)}>{UI_LABELS.edgesLabel}</header>
            <ul className="m-0 p-0 list-none rounded border overflow-hidden" aria-label="Edges list">
              {filteredEdges.length === 0 ? (
                <li className={cn('px-3 py-2 text-xs', UI_THEME_TOKENS.text.tertiary)}>{UI_COPY.noGraphLoaded}</li>
              ) : (
                filteredEdges.slice(0, 200).map(r => {
                  const selected = selectedEdgeId === r.id
                  return (
                    <li key={r.id} className={cn('border-b last:border-b-0', UI_THEME_TOKENS.panel.border)}>
                      <div className="flex items-stretch">
                        <button
                          type="button"
                          className={cn('flex-1 text-left px-3 py-2', selected ? 'bg-blue-50 dark:bg-blue-900/20' : '', UI_THEME_TOKENS.button.hoverBg)}
                          onClick={() => {
                            setSelectionSource('menu')
                            selectEdge(r.id)
                            requestZoom('selection')
                          }}
                          aria-label={r.label}
                        >
                          <section className={cn('text-xs font-semibold truncate', UI_THEME_TOKENS.text.primary)}>{r.label}</section>
                          <section className={cn('text-[10px] font-mono truncate', UI_THEME_TOKENS.text.tertiary)}>
                            {r.sublabel ? `${r.sublabel} · ${r.id}` : r.id}
                          </section>
                        </button>
                        <button
                          type="button"
                          className={cn('px-3 py-2 text-xs border-l', UI_THEME_TOKENS.panel.border, UI_THEME_TOKENS.button.text, UI_THEME_TOKENS.button.hoverBg)}
                          onClick={e => {
                            e.stopPropagation()
                            removeEdge(r.id)
                          }}
                          aria-label={`Delete edge ${r.label}`}
                          title="Delete edge"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </li>
                  )
                })
              )}
            </ul>
          </section>

          <section aria-label={UI_LABELS.graphLayersMode}>
            <header className={cn('text-xs font-semibold mb-2', UI_THEME_TOKENS.text.primary)}>{UI_LABELS.graphLayersMode}</header>
            <ul className="m-0 p-0 list-none rounded border overflow-hidden" aria-label="Layers list">
              {filteredLayers.length === 0 ? (
                <li className={cn('px-3 py-2 text-xs', UI_THEME_TOKENS.text.tertiary)}>{UI_COPY.noGraphLoaded}</li>
              ) : (
                filteredLayers.slice(0, 200).map(r => {
                  const selected = selectedGroupId === r.id
                  const collapsed = collapsedSet.has(r.id)
                  return (
                    <li key={r.id} className={cn('border-b last:border-b-0', UI_THEME_TOKENS.panel.border)}>
                      <section className="flex items-stretch" aria-label="Layer row">
                        <button
                          type="button"
                          className={cn(
                            'flex-1 text-left px-3 py-2',
                            selected ? 'bg-blue-50 dark:bg-blue-900/20' : '',
                            UI_THEME_TOKENS.button.hoverBg,
                          )}
                          onClick={() => {
                            setSelectionSource('menu')
                            selectGroup(r.id)
                            requestZoom('selection')
                          }}
                          aria-label={r.label}
                        >
                          <section className={cn('text-xs font-semibold truncate', UI_THEME_TOKENS.text.primary)}>{r.label}</section>
                          <section className={cn('text-[10px] font-mono truncate', UI_THEME_TOKENS.text.tertiary)}>
                            depth={r.depth} · nodes={r.count} · {r.id}
                          </section>
                        </button>
                        <button
                          type="button"
                          className={cn('px-3 py-2 text-xs border-l', UI_THEME_TOKENS.panel.border, UI_THEME_TOKENS.button.text, UI_THEME_TOKENS.button.hoverBg)}
                          onClick={() => toggleGroupCollapsed(r.id)}
                          aria-label={collapsed ? UI_LABELS.expandAll : UI_LABELS.collapseAll}
                          title={collapsed ? 'Expand group' : 'Collapse group'}
                        >
                          {collapsed ? UI_LABELS.expandAll : UI_LABELS.collapseAll}
                        </button>
                      </section>
                    </li>
                  )
                })
              )}
            </ul>
          </section>

          <section aria-label="Design layers">
            <header className={cn('text-xs font-semibold mb-2', UI_THEME_TOKENS.text.primary)}>{UI_LABELS.layerMode}</header>
            <button
              type="button"
              className={cn(
                'w-full text-left rounded border px-3 py-2',
                UI_THEME_TOKENS.panel.border,
                UI_THEME_TOKENS.button.text,
                UI_THEME_TOKENS.button.hoverBg,
              )}
              onClick={() => emitDesignLayersPanelOpen()}
              aria-label={UI_LABELS.layerMode}
              title={UI_LABELS.layerMode}
            >
              <section className={cn('text-xs font-semibold', UI_THEME_TOKENS.text.primary)}>{UI_LABELS.layerMode}</section>
              <section className={cn('text-[10px]', UI_THEME_TOKENS.text.tertiary)}>{UI_LABELS.floatingPanel}</section>
            </button>
          </section>
        </section>
      </main>
    </section>
  )
}
