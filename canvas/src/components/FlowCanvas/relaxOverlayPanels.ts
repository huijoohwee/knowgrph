import type { GraphNode } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import { createBboxCollideForce } from '@/components/GraphCanvas/layout/overlap'
import { integrateNodePositionWithVelocity, runRelaxSteps } from '@/lib/graph/collision/relaxRunner'

export function relaxOverlayPanelsWithCollision(args: {
  schema: GraphSchema
  items: Array<{
    id: string
    left: number
    top: number
    width: number
    height: number
    movable: boolean
  }>
  gapPx: number
  strength: number
  iterations: number
  steps: number
}): Array<{ id: string; left: number; top: number }> {
  const schema = args.schema
  const gapPx = Number.isFinite(args.gapPx) ? Math.max(0, args.gapPx) : 0
  const strength = Number.isFinite(args.strength) ? Math.max(0, args.strength) : 0.9
  const iterations = Number.isFinite(args.iterations) ? Math.max(1, Math.floor(args.iterations)) : 10
  const steps = Number.isFinite(args.steps) ? Math.max(1, Math.floor(args.steps)) : 12

  const proxyNodes: Array<GraphNode & { vx?: number; vy?: number; fx?: number; fy?: number }> = []
  for (let i = 0; i < args.items.length; i += 1) {
    const it = args.items[i]
    const id = String(it?.id || '').trim()
    if (!id) continue
    const width = Number.isFinite(it.width) ? Math.max(1, it.width) : 1
    const height = Number.isFinite(it.height) ? Math.max(1, it.height) : 1
    const left = Number.isFinite(it.left) ? it.left : 0
    const top = Number.isFinite(it.top) ? it.top : 0
    const cx = left + width * 0.5
    const cy = top + height * 0.5
    proxyNodes.push({
      id,
      type: 'OverlayPanel',
      label: '',
      properties: {
        'visual:shape': 'rect',
        'visual:width': width,
        'visual:height': height,
      } as unknown as GraphNode['properties'],
      x: cx,
      y: cy,
      vx: 0,
      vy: 0,
      ...(it.movable ? {} : { fx: cx, fy: cy }),
    })
  }

  if (proxyNodes.length < 2) {
    return args.items.map(it => ({ id: it.id, left: it.left, top: it.top }))
  }

  const force = createBboxCollideForce({
    schema,
    paddingX: gapPx,
    paddingY: gapPx,
    strength,
    iterations,
  })
  force.initialize(proxyNodes, Math.random)
  const applyForce = force as unknown as (alpha: number) => void

  runRelaxSteps({
    nodes: proxyNodes,
    steps,
    forces: [applyForce],
    integrate: node => integrateNodePositionWithVelocity(node, { damping: 0.25 }),
  })

  const out: Array<{ id: string; left: number; top: number }> = []
  for (let i = 0; i < proxyNodes.length; i += 1) {
    const n = proxyNodes[i]
    const id = String(n.id || '').trim()
    const it = args.items.find(x => x.id === id) || null
    if (!id || !it) continue
    const x = typeof n.x === 'number' && Number.isFinite(n.x) ? n.x : it.left + it.width * 0.5
    const y = typeof n.y === 'number' && Number.isFinite(n.y) ? n.y : it.top + it.height * 0.5
    out.push({ id, left: x - it.width * 0.5, top: y - it.height * 0.5 })
  }
  return out
}

