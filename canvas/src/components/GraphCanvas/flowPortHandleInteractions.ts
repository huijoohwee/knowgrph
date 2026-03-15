import type * as d3 from 'd3'

import type { GraphData, GraphEdge, GraphNode } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'

import { startEdgeFromNode, finalizePendingEdge, type PendingLink, type TempLinkSelection } from '@/features/edge-creation'
import { getFlowPortHandlePosition2d, type FlowPortHandleDatum2d } from '@/components/GraphCanvas/flowPortHandles2d'

export function bindGraphCanvasFlowPortHandleInteractions(args: {
  selection: d3.Selection<SVGCircleElement, FlowPortHandleDatum2d, SVGGElement, unknown>
  nodeById: Map<string, GraphNode>
  graphData: GraphData
  schema: GraphSchema
  enableEditorGestures: boolean
  allowEdgeCreation: boolean
  tempLinkSelRef: { current: TempLinkSelection }
  linkDragRef: { current: PendingLink | null }
  getSelectedEdgeId: () => string | null
  addEdge: (e: GraphEdge) => void
  updateEdge: (id: string, u: Partial<GraphEdge>) => void
  selectEdge: (id: string | null) => void
  selectNode: (id: string | null) => void
  setSelectionSource: (src: 'menu' | 'canvas' | 'toolbar' | 'editor' | 'unknown') => void
}) {
  const s = args.selection

  const handleClick = (event: MouseEvent, d: FlowPortHandleDatum2d) => {
    const btn = (event as unknown as { button?: unknown }).button
    if (typeof btn === 'number' && btn !== 0) return
    try {
      event.stopPropagation()
    } catch {
      void 0
    }
    if (!args.enableEditorGestures || !args.allowEdgeCreation) return

    const nodeId = String(d.nodeId || '').trim()
    if (!nodeId) return
    const node = args.nodeById.get(nodeId) || null
    if (!node) return
    const portKey = String(d.portKey || '').trim() || null

    if (args.linkDragRef.current) {
      if (nodeId === String(args.linkDragRef.current.fromId || '').trim()) {
        if (d.dir === 'out') {
          const pos = getFlowPortHandlePosition2d({ node, schema: args.schema, datum: d })
          args.setSelectionSource('editor')
          args.selectEdge(null)
          args.selectNode(nodeId)
          startEdgeFromNode(node, args.tempLinkSelRef, args.linkDragRef, { portKey, start: pos })
        }
        return
      }

      if (d.dir === 'in') {
        finalizePendingEdge(
          nodeId,
          portKey,
          args.graphData,
          args.getSelectedEdgeId(),
          args.tempLinkSelRef,
          args.linkDragRef,
          args.addEdge,
          args.updateEdge,
          (id) => args.selectEdge(id),
          (src) => args.setSelectionSource(src),
          args.schema,
          { label: 'link' },
        )
      } else {
        const pos = getFlowPortHandlePosition2d({ node, schema: args.schema, datum: d })
        args.setSelectionSource('editor')
        args.selectEdge(null)
        args.selectNode(nodeId)
        startEdgeFromNode(node, args.tempLinkSelRef, args.linkDragRef, { portKey, start: pos })
      }
      return
    }

    if (d.dir !== 'out') return
    const pos = getFlowPortHandlePosition2d({ node, schema: args.schema, datum: d })
    args.setSelectionSource('editor')
    args.selectEdge(null)
    args.selectNode(nodeId)
    startEdgeFromNode(node, args.tempLinkSelRef, args.linkDragRef, { portKey, start: pos })
  }

  s.on('click', handleClick)
  s.on('pointerdown', (event: PointerEvent) => {
    try {
      event.stopPropagation()
    } catch {
      void 0
    }
  })
}

