import * as d3 from 'd3'
import type { RefObject } from 'react'

import type { GraphNode, JSONValue } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'

import { getNodeRectDimensions2d, getNodeRenderShape2d } from '@/components/GraphCanvas/nodeSizing2d'
import { calcMouseGraphPosition } from '@/features/canvas/utils'
import { startPointerDrag } from 'grph-shared/dom/pointerDrag'

type GSelection = d3.Selection<SVGGElement, unknown, null, undefined>

type Corner = 'nw' | 'ne' | 'se' | 'sw'

const CORNERS: Corner[] = ['nw', 'ne', 'se', 'sw']

const minSize = 24

export function createResizeHandlesLayer(args: {
  g: GSelection
  svgRef: RefObject<SVGSVGElement>
  getSchema: () => GraphSchema
  nodes: GraphNode[]
  getSelectedNodeId: () => string | null
  enabled: boolean
  commitResize: (args: { id: string; width: number; height: number; properties: Record<string, JSONValue> }) => void
}) {
  const { g, svgRef, getSchema, nodes, getSelectedNodeId, enabled, commitResize } = args
  const layer = g.append('g').attr('data-kg-layer', 'resize-handles').style('display', 'none')
  const outline = layer
    .append('rect')
    .attr('data-kg-resize-outline', '1')
    .attr('fill', 'none')
    .attr('stroke', 'rgba(59, 130, 246, 0.9)')
    .attr('stroke-width', 1.25)
    .attr('stroke-dasharray', '4 3')
    .style('pointer-events', 'none')

  const handles = layer
    .selectAll<SVGRectElement, Corner>('rect[data-kg-resize-handle]')
    .data(CORNERS)
    .enter()
    .append('rect')
    .attr('data-kg-resize-handle', d => d)
    .attr('width', 10)
    .attr('height', 10)
    .attr('rx', 2)
    .attr('ry', 2)
    .attr('fill', 'rgba(59, 130, 246, 1)')
    .attr('stroke', 'rgba(255, 255, 255, 0.9)')
    .attr('stroke-width', 1)
    .style('cursor', d => (d === 'nw' || d === 'se' ? 'nwse-resize' : 'nesw-resize'))
    .style('pointer-events', 'all')

  let lastSize: { id: string; width: number; height: number; props: Record<string, JSONValue> } | null = null

  const update = () => {
    if (!enabled) {
      layer.style('display', 'none')
      return
    }
    const selectedId = getSelectedNodeId()
    if (!selectedId) {
      layer.style('display', 'none')
      return
    }
    const node = nodes.find(n => String(n.id || '') === selectedId) || null
    if (!node) {
      layer.style('display', 'none')
      return
    }
    const schema = getSchema()
    const shape = getNodeRenderShape2d(node, schema)
    if (shape === 'circle') {
      layer.style('display', 'none')
      return
    }
    const cx = typeof node.x === 'number' && Number.isFinite(node.x) ? node.x : 0
    const cy = typeof node.y === 'number' && Number.isFinite(node.y) ? node.y : 0
    const { width, height } = getNodeRectDimensions2d(node, schema)
    const x0 = cx - width / 2
    const y0 = cy - height / 2

    outline.attr('x', x0).attr('y', y0).attr('width', width).attr('height', height)

    const half = 5
    const positions: Record<Corner, { x: number; y: number }> = {
      nw: { x: x0 - half, y: y0 - half },
      ne: { x: x0 + width - half, y: y0 - half },
      se: { x: x0 + width - half, y: y0 + height - half },
      sw: { x: x0 - half, y: y0 + height - half },
    }
    handles.attr('x', d => positions[d].x).attr('y', d => positions[d].y)
    layer.style('display', null)
  }

  const onHandlePointerDown = (corner: Corner) => (ev: PointerEvent) => {
    if (!enabled) return
    const selectedId = getSelectedNodeId()
    if (!selectedId) return
    const node = nodes.find(n => String(n.id || '') === selectedId) || null
    if (!node) return
    const schema = getSchema()
    if (getNodeRenderShape2d(node, schema) === 'circle') return
    const cx = typeof node.x === 'number' && Number.isFinite(node.x) ? node.x : 0
    const cy = typeof node.y === 'number' && Number.isFinite(node.y) ? node.y : 0
    const start = getNodeRectDimensions2d(node, schema)
    const startW = start.width
    const startH = start.height
    const startProps = { ...(((node.properties || {}) as Record<string, JSONValue>) || {}) }
    lastSize = { id: selectedId, width: startW, height: startH, props: startProps }

    const applySize = (w: number, h: number) => {
      const nextW = Math.max(minSize, Math.round(w))
      const nextH = Math.max(minSize, Math.round(h))
      const nextProps: Record<string, JSONValue> = { ...startProps, 'visual:width': nextW, 'visual:height': nextH }
      node.properties = nextProps
      lastSize = { id: selectedId, width: nextW, height: nextH, props: nextProps }
      update()
    }

    startPointerDrag({
      ev,
      cursor: corner === 'nw' || corner === 'se' ? 'nwse-resize' : 'nesw-resize',
      onMove: mv => {
        const p = calcMouseGraphPosition(svgRef, mv as unknown as MouseEvent)
        if (!p) return
        const dx = Math.abs(p[0] - cx)
        const dy = Math.abs(p[1] - cy)
        applySize(dx * 2, dy * 2)
      },
      onEnd: () => {
        if (!lastSize || lastSize.id !== selectedId) return
        commitResize({ id: selectedId, width: lastSize.width, height: lastSize.height, properties: lastSize.props })
      },
      onCancel: () => {
        if (!lastSize || lastSize.id !== selectedId) return
        commitResize({ id: selectedId, width: lastSize.width, height: lastSize.height, properties: lastSize.props })
      },
    })
  }

  handles.each(function (d) {
    const handler = onHandlePointerDown(d)
    ;(this as SVGRectElement).addEventListener('pointerdown', handler)
    ;(this as unknown as { __kgResizeHandler?: (e: PointerEvent) => void }).__kgResizeHandler = handler
  })

  const destroy = () => {
    handles.each(function () {
      const el = this as unknown as { __kgResizeHandler?: (e: PointerEvent) => void }
      if (el.__kgResizeHandler) {
        try {
          ;(this as SVGRectElement).removeEventListener('pointerdown', el.__kgResizeHandler)
        } catch {
          void 0
        }
      }
    })
    layer.remove()
  }

  return { update, destroy }
}
