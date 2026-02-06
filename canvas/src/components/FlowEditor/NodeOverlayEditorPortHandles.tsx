import React from 'react'

import type { GraphEdge } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import { computeFlowNodeHandles, ensureFlowHandlesHaveDefaults, parseFlowHandleKey } from '@/components/FlowCanvas/handles'
import { shouldInjectDefaultFlowHandles } from '@/lib/graph/portHandlesBehavior'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { cn } from '@/lib/utils'

type FlowEditorToolMode = 'select' | 'addEdge'

function coerceEdgeEndpoints(raw: ReadonlyArray<GraphEdge>): Array<{ id: string; source: string; target: string }> {
  const out: Array<{ id: string; source: string; target: string }> = []
  for (let i = 0; i < raw.length; i += 1) {
    const e = raw[i] as unknown as { id?: unknown; source?: unknown; target?: unknown }
    const id = String(e?.id || '').trim()
    const source = String(e?.source || '').trim()
    const target = String(e?.target || '').trim()
    if (!id || !source || !target) continue
    out.push({ id, source, target })
  }
  return out
}

export const NodeOverlayEditorPortHandles = React.memo(function NodeOverlayEditorPortHandles(args: {
  active: boolean
  nodeId: string
  schema: GraphSchema | null
  edges: ReadonlyArray<GraphEdge>
  minimized: boolean
  toolMode?: FlowEditorToolMode
  pendingEdgeSourceId?: string | null
  onBeginAddEdgeFromNode?: (nodeId: string, portKey?: string | null) => void
  onFinalizeAddEdgeToNode?: (nodeId: string, portKey?: string | null) => void
}) {
  const enabled = Boolean(args.schema?.behavior?.portHandles?.enabled)
  if (!enabled) return null
  if (args.minimized) return null
  if (!args.nodeId) return null

  const edges = React.useMemo(() => coerceEdgeEndpoints(args.edges), [args.edges])

  const handles = React.useMemo(() => {
    const base = computeFlowNodeHandles({ nodeId: args.nodeId, edges })
    if (!shouldInjectDefaultFlowHandles(args.schema)) return base
    return ensureFlowHandlesHaveDefaults(base)
  }, [args.nodeId, edges, args.schema])

  const rawSize = args.schema?.behavior?.portHandles?.size
  const sizePx = typeof rawSize === 'number' && Number.isFinite(rawSize) ? Math.max(8, Math.floor(rawSize * 2 + 4)) : 12
  const hitSizePx = Math.max(18, sizePx + 6)
  const offsetPx = Math.max(2, Math.floor(sizePx / 4))
  const railWidthPx = Math.max(hitSizePx, hitSizePx + offsetPx)

  const isAddEdge = args.toolMode === 'addEdge'
  const isSource = isAddEdge && args.pendingEdgeSourceId === args.nodeId
  const canInteract = args.active && isAddEdge

  const handleClick = (dir: 'in' | 'out', portKey: string) => {
    if (!args.active) return
    const pk = String(portKey || '').trim()
    if (!pk) return
    if (args.toolMode !== 'addEdge') {
      if (dir !== 'out') return
      args.onBeginAddEdgeFromNode?.(args.nodeId, pk)
      return
    }

    if (!args.pendingEdgeSourceId) {
      if (dir !== 'out') return
      args.onBeginAddEdgeFromNode?.(args.nodeId, pk)
      return
    }

    if (args.pendingEdgeSourceId === args.nodeId) {
      if (dir === 'in') return
      args.onBeginAddEdgeFromNode?.(args.nodeId, pk)
      return
    }

    if (dir !== 'in') {
      args.onBeginAddEdgeFromNode?.(args.nodeId, pk)
      return
    }

    args.onFinalizeAddEdgeToNode?.(args.nodeId, pk)
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
            UI_THEME_TOKENS.input.border,
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
        <span
          aria-hidden={true}
          className={cn('absolute top-1/2 h-px', UI_THEME_TOKENS.input.border, hoverClass)}
          style={{
            width: `${Math.max(6, Math.floor(sizePx / 2))}px`,
            transform: 'translateY(-50%)',
            ...(isIn ? { left: `${Math.max(1, Math.floor(sizePx / 2))}px` } : { right: `${Math.max(1, Math.floor(sizePx / 2))}px` }),
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
