import {
  computeFlowHandlesByNode,
  buildFlowHandleId,
  ensureFlowHandlesHaveDefaults,
  type FlowHandleId,
} from '@/components/FlowCanvas/handles'
import { coerceFlowNativeNodeShape } from '@/components/FlowCanvas/shape'
import { setFlowNativeScene, setFlowNativeRankdir, type FlowNativeRuntime, type FlowNativeScene } from '@/components/FlowCanvas/nativeRuntime'
import { getNodeRenderShape2d } from '@/components/GraphCanvas/nodeSizing2d'
import type { GraphData, GraphNode } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import { shouldInjectDefaultFlowHandles } from '@/lib/graph/portHandlesBehavior'
import { readFlowEdgePortKey } from '@/lib/graph/flowPorts'
import { buildFlowEdgeDisplayLabelFromPorts, readFlowEdgeDisplayLabel } from '@/lib/graph/flowPorts'
import type { FlowConfig } from '@/components/FlowCanvas/config'
import type { GraphGroup } from '@/components/GraphCanvas/layout/graphGroupsTypes'
import type { NodeQuickEditorRegistryEntry } from '@/features/flow-editor-manager/nodeQuickEditorRegistryTypes'

export function buildAndSetFlowNativeScene(args: {
  runtime: FlowNativeRuntime
  graphData: GraphData | null
  positions: Record<string, { x: number; y: number }> | null
  schema: GraphSchema | null
  forbidCircleNodes: boolean
  flowConfig: FlowConfig
  sceneGroups: GraphGroup[]
  rankdir: 'TB' | 'LR'
  nodeQuickEditorRegistry?: ReadonlyArray<NodeQuickEditorRegistryEntry> | null
}): { nodeCount: number; graphKeyParts: { nodeCount: number; edgeCount: number } } {
  const g = args.graphData
  const nodeList = Array.isArray(g?.nodes) ? g?.nodes : []
  const edgeList = Array.isArray(g?.edges) ? g?.edges : []
  const pos = args.positions || null
  const useVisualNodeSize = String((g as unknown as { context?: unknown })?.context || '') === 'webpageLayout'

  setFlowNativeRankdir(args.runtime, args.rankdir)

  const handlesByNode = computeFlowHandlesByNode({
    nodes: nodeList as ReadonlyArray<{ id: unknown; type?: unknown; properties?: unknown }>,
    edges: edgeList as ReadonlyArray<{ id: unknown; source: unknown; target: unknown }>,
    nodeQuickEditorRegistry: args.nodeQuickEditorRegistry || null,
  })

  const nodeById = new Map<string, NonNullable<FlowNativeScene['nodes']>[number]>()
  const inputNodeById = new Map<string, unknown>()
  const nodes: NonNullable<FlowNativeScene['nodes']> = []
  for (let i = 0; i < nodeList.length; i += 1) {
    const n = nodeList[i]
    const id = String(n?.id || '').trim()
    if (!id) continue
    const props = ((n as unknown as { properties?: unknown })?.properties || {}) as Record<string, unknown>
    const visualLabel = typeof props['visual:label'] === 'string' ? String(props['visual:label'] || '').trim() : ''
    const label = visualLabel || String((n as { label?: unknown })?.label || id)
    const rawShape = args.schema ? getNodeRenderShape2d(n as GraphNode, args.schema) : 'rect'
    const shape = coerceFlowNativeNodeShape({ shape: rawShape, forbidCircle: args.forbidCircleNodes })
    const baseHandles = handlesByNode[id] || { in: [], out: [] }
    const handles = shouldInjectDefaultFlowHandles(args.schema) ? ensureFlowHandlesHaveDefaults(baseHandles) : baseHandles
    const p = pos ? pos[id] : null
    const x = p && Number.isFinite(p.x) ? p.x : 0
    const y = p && Number.isFinite(p.y) ? p.y : 0
    const w0 = typeof props['visual:width'] === 'number' && Number.isFinite(props['visual:width']) ? (props['visual:width'] as number) : null
    const h0 = typeof props['visual:height'] === 'number' && Number.isFinite(props['visual:height']) ? (props['visual:height'] as number) : null
    const width =
      useVisualNodeSize && w0 != null && w0 > 0 ? Math.max(24, Math.min(1400, Math.floor(w0))) : args.flowConfig.node.widthPx
    const height =
      useVisualNodeSize && h0 != null && h0 > 0 ? Math.max(16, Math.min(900, Math.floor(h0))) : args.flowConfig.node.heightPx
    const zIndex = (() => {
      const raw = props['visual:zIndex'] ?? props['visual:depth'] ?? props['visual:layer']
      const n =
        typeof raw === 'number'
          ? raw
          : typeof raw === 'string'
            ? Number(raw)
            : null
      if (typeof n === 'number' && Number.isFinite(n)) return Math.floor(n)
      return 0
    })()
    const opacity = (() => {
      const raw = props['visual:opacity']
      const n =
        typeof raw === 'number'
          ? raw
          : typeof raw === 'string'
            ? Number(raw)
            : null
      if (typeof n === 'number' && Number.isFinite(n)) return Math.max(0, Math.min(1, n))
      return 1
    })()
    const inHandleTopPctById: Partial<Record<FlowHandleId, number>> = {}
    const outHandleTopPctById: Partial<Record<FlowHandleId, number>> = {}
    for (let j = 0; j < handles.in.length; j += 1) {
      const h = handles.in[j]
      inHandleTopPctById[h.id] = h.topPct
    }
    for (let j = 0; j < handles.out.length; j += 1) {
      const h = handles.out[j]
      outHandleTopPctById[h.id] = h.topPct
    }
    const node = {
      id,
      label,
      x,
      y,
      width,
      height,
      zIndex,
      opacity,
      shape,
      handles,
      inHandleTopPctById,
      outHandleTopPctById,
    }
    nodes.push(node)
    nodeById.set(id, node)
    inputNodeById.set(id, n)
  }
  nodes.sort((a, b) => {
    const az = typeof (a as unknown as { zIndex?: unknown }).zIndex === 'number' ? ((a as unknown as { zIndex: number }).zIndex) : 0
    const bz = typeof (b as unknown as { zIndex?: unknown }).zIndex === 'number' ? ((b as unknown as { zIndex: number }).zIndex) : 0
    if (az !== bz) return az - bz
    return a.id.localeCompare(b.id)
  })

  const edges: NonNullable<FlowNativeScene['edges']> = []
  for (let i = 0; i < edgeList.length; i += 1) {
    const e = edgeList[i] as { id?: unknown; source?: unknown; target?: unknown; properties?: unknown }
    const edgeId = String(e?.id || '').trim()
    const source = String(e?.source || '').trim()
    const target = String(e?.target || '').trim()
    if (!edgeId || !source || !target) continue
    if (!nodeById.has(source) || !nodeById.has(target)) continue

    const sourcePortKey = readFlowEdgePortKey({ properties: e.properties as never } as never, 'source') || ''
    const targetPortKey = readFlowEdgePortKey({ properties: e.properties as never } as never, 'target') || ''
    const explicitLabel = readFlowEdgeDisplayLabel({ properties: e.properties as never } as never) || ''
    const computedLabel =
      explicitLabel ||
      ((sourcePortKey || targetPortKey) &&
        (buildFlowEdgeDisplayLabelFromPorts({
          sourceNode: inputNodeById.get(source) as never,
          targetNode: inputNodeById.get(target) as never,
          sourcePortKey,
          targetPortKey,
        }) ||
          '')) ||
      ''
    const label = computedLabel.trim()

    edges.push({
      id: edgeId,
      source,
      target,
      outHandleId: buildFlowHandleId({ dir: 'out', edgeId: sourcePortKey || edgeId }),
      inHandleId: buildFlowHandleId({ dir: 'in', edgeId: targetPortKey || edgeId }),
      ...(label ? { label } : {}),
    })
  }

  const groups = args.sceneGroups
  const groupIdsByNodeId = (() => {
    if (!groups || groups.length === 0) return new Map<string, string[]>()
    const m = new Map<string, string[]>()
    for (let i = 0; i < groups.length; i += 1) {
      const g = groups[i] as { id?: unknown; memberNodeIds?: unknown }
      const gid = String(g.id || '').trim()
      if (!gid) continue
      const members = Array.isArray(g.memberNodeIds) ? g.memberNodeIds : []
      for (let j = 0; j < members.length; j += 1) {
        const id = String(members[j] || '').trim()
        if (!id) continue
        const arr = m.get(id) || []
        if (!arr.includes(gid)) arr.push(gid)
        m.set(id, arr)
      }
    }
    return m
  })()

  setFlowNativeScene(args.runtime, { nodes, edges, nodeById, groups, groupIdsByNodeId })
  return { nodeCount: nodes.length, graphKeyParts: { nodeCount: nodeList.length, edgeCount: edgeList.length } }
}
