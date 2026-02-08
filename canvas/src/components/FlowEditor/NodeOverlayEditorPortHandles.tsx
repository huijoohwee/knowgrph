import React from 'react'

import type { GraphEdge } from '@/lib/graph/types'
import type { GraphNode } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import type { NodeQuickEditorRegistryEntry } from '@/features/flow-editor-manager/nodeQuickEditorRegistryTypes'
import { computeFlowHandlesByNode, ensureFlowHandlesHaveDefaults, parseFlowHandleKey } from '@/components/FlowCanvas/handles'
import { shouldInjectDefaultFlowHandles } from '@/lib/graph/portHandlesBehavior'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { cn } from '@/lib/utils'
import { PORT_HANDLE_STROKE_CLASS, readPortHandleUiMetrics } from '@/components/FlowEditor/portHandleUi'

type FlowEditorToolMode = 'select' | 'addEdge'

function coerceEdgeEndpoints(raw: ReadonlyArray<GraphEdge>): Array<{ id: string; source: string; target: string; properties?: unknown }> {
  const out: Array<{ id: string; source: string; target: string; properties?: unknown }> = []
  for (let i = 0; i < raw.length; i += 1) {
    const e = raw[i] as unknown as { id?: unknown; source?: unknown; target?: unknown; properties?: unknown }
    const id = String(e?.id || '').trim()
    const source = String(e?.source || '').trim()
    const target = String(e?.target || '').trim()
    if (!id || !source || !target) continue
    out.push({ id, source, target, properties: e.properties })
  }
  return out
}

export const NodeOverlayEditorPortHandles = React.memo(function NodeOverlayEditorPortHandles(args: {
  active: boolean
  node: Pick<GraphNode, 'id' | 'type' | 'properties'>
  schema: GraphSchema | null
  registryEntries?: ReadonlyArray<NodeQuickEditorRegistryEntry>
  edges: ReadonlyArray<GraphEdge>
  minimized: boolean
  toolMode?: FlowEditorToolMode
  pendingEdgeSourceId?: string | null
  onBeginAddEdgeFromNode?: (nodeId: string, portKey?: string | null) => void
  onFinalizeAddEdgeToNode?: (nodeId: string, portKey?: string | null) => void
}) {
  const edges = React.useMemo(() => coerceEdgeEndpoints(args.edges), [args.edges])

  const nodeId = React.useMemo(() => String(args.node?.id || '').trim(), [args.node?.id])

  const handles = React.useMemo(() => {
    if (!nodeId) return { in: [], out: [] }
    const byNode = computeFlowHandlesByNode({
      nodes: [{ id: nodeId, type: args.node?.type, properties: args.node?.properties }],
      edges,
      nodeQuickEditorRegistry: args.registryEntries || null,
    })
    const base = byNode[nodeId] || { in: [], out: [] }
    if (!shouldInjectDefaultFlowHandles(args.schema)) return base
    return ensureFlowHandlesHaveDefaults(base)
  }, [args.node?.properties, args.node?.type, args.registryEntries, args.schema, edges, nodeId])

  const enabled = Boolean(args.schema?.behavior?.portHandles?.enabled)
  if (!enabled) return null
  if (args.minimized) return null
  if (!nodeId) return null

  const { sizePx, hitSizePx, railWidthPx } = readPortHandleUiMetrics(args.schema)

  const isAddEdge = args.toolMode === 'addEdge'
  const isSource = isAddEdge && args.pendingEdgeSourceId === nodeId
  const canInteract = args.active && isAddEdge

  const handleClick = (dir: 'in' | 'out', portKey: string) => {
    if (!args.active) return
    const pk = String(portKey || '').trim()
    if (!pk) return
    if (args.toolMode !== 'addEdge') {
      if (dir !== 'out') return
      args.onBeginAddEdgeFromNode?.(nodeId, pk)
      return
    }

    if (!args.pendingEdgeSourceId) {
      if (dir !== 'out') return
      args.onBeginAddEdgeFromNode?.(nodeId, pk)
      return
    }

    if (args.pendingEdgeSourceId === nodeId) {
      if (dir === 'in') return
      args.onBeginAddEdgeFromNode?.(nodeId, pk)
      return
    }

    if (dir !== 'in') {
      args.onBeginAddEdgeFromNode?.(nodeId, pk)
      return
    }

    args.onFinalizeAddEdgeToNode?.(nodeId, pk)
  }

  const Dot = (p: { handleId: string; dir: 'in' | 'out'; idx: number; topPct: number }) => {
    const isIn = p.dir === 'in'
    const aria = isIn ? `Input handle ${p.idx + 1}` : `Output handle ${p.idx + 1}`
    const ringClass = isSource ? `ring-2 ring-inset ${UI_THEME_TOKENS.button.ring}` : ''
    const hoverClass = canInteract ? 'hover:opacity-100' : 'opacity-90'
    const cursorClass = canInteract ? 'cursor-pointer' : 'cursor-default'

    return (
      <button
        type="button"
        aria-label={aria}
        title={aria}
        className={cn('absolute pointer-events-auto', cursorClass)}
        style={{
          top: `${Math.max(0, Math.min(100, p.topPct))}%`,
          width: `${railWidthPx}px`,
          height: `${hitSizePx}px`,
          transform: 'translateY(-50%)',
          ...(isIn ? { left: 0 } : { right: 0 }),
        }}
        onPointerDown={e => {
          try {
            e.stopPropagation()
          } catch {
            void 0
          }
        }}
        onClick={e => {
          try {
            e.stopPropagation()
          } catch {
            void 0
          }
          handleClick(p.dir, parseFlowHandleKey(p.handleId as never))
        }}
        disabled={!canInteract}
      >
        <span
          aria-hidden={true}
          className={cn(
            'absolute top-1/2 rounded-full border',
            UI_THEME_TOKENS.panel.bg,
            PORT_HANDLE_STROKE_CLASS,
            ringClass,
            hoverClass,
          )}
          style={{
            width: `${sizePx}px`,
            height: `${sizePx}px`,
            transform: isIn ? 'translate(-50%, -50%)' : 'translate(50%, -50%)',
            ...(isIn ? { left: 0 } : { right: 0 }),
          }}
        />
      </button>
    )
  }

  const hasAny = (handles.in?.length || 0) + (handles.out?.length || 0) > 0
  if (!hasAny) return null

  return (
    <nav className="absolute inset-0 pointer-events-none" aria-label="Node port handles">
      <section className={cn('absolute inset-y-0 left-0', isSource ? 'opacity-100' : 'opacity-90')} style={{ width: `${railWidthPx}px` }}>
        {(handles.in || []).map((h, idx) => (
          <Dot key={h.id} handleId={h.id} dir="in" idx={idx} topPct={h.topPct} />
        ))}
      </section>
      <section className={cn('absolute inset-y-0 right-0', isSource ? 'opacity-100' : 'opacity-90')} style={{ width: `${railWidthPx}px` }}>
        {(handles.out || []).map((h, idx) => (
          <Dot key={h.id} handleId={h.id} dir="out" idx={idx} topPct={h.topPct} />
        ))}
      </section>
    </nav>
  )
})
