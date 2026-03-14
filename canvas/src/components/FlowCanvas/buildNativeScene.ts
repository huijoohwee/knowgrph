import {
  computeFlowHandlesByNode,
  buildFlowHandleId,
  ensureFlowHandlesHaveDefaults,
  type FlowHandleId,
} from '@/components/FlowCanvas/handles'
import { parseFlowHandleKey } from '@/components/FlowCanvas/handles'
import { coerceFlowNativeNodeShape } from '@/components/FlowCanvas/shape'
import { setFlowNativeScene, setFlowNativeRankdir, type FlowNativeRuntime, type FlowNativeScene } from '@/components/FlowCanvas/nativeRuntime'
import { getNodeRenderShape2d } from '@/components/GraphCanvas/nodeSizing2d'
import type { GraphData, GraphNode } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import { shouldInjectDefaultFlowHandles } from '@/lib/graph/portHandlesBehavior'
import { parseSchemaFieldPortKey, readFlowEdgePortKey, readSchemaFieldSpecs } from '@/lib/graph/flowPorts'
import { buildFlowEdgeDisplayLabelFromPorts, readFlowEdgeDisplayLabel } from '@/lib/graph/flowPorts'
import type { FlowConfig } from '@/components/FlowCanvas/config'
import type { GraphGroup } from '@/components/GraphCanvas/layout/graphGroupsTypes'
import type { NodeQuickEditorRegistryEntry } from '@/features/flow-editor-manager/nodeQuickEditorRegistryTypes'
import { buildBestGroupInfoByNodeId } from '@/lib/canvas/groupZOrder'

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
  const context = String((g as unknown as { context?: unknown })?.context || '')
  const useVisualNodeSize = context === 'webpageLayout' || context === 'frontmatter-flow' || context === 'frontmatter-mermaid'

  const socketStyleByType = (() => {
    const meta = (g?.metadata && typeof g.metadata === 'object' && !Array.isArray(g.metadata))
      ? (g.metadata as Record<string, unknown>)
      : null
    const raw = meta && meta.socketTypes && typeof meta.socketTypes === 'object' && !Array.isArray(meta.socketTypes)
      ? (meta.socketTypes as Record<string, unknown>)
      : null
    const out = new Map<string, { color?: string; edgeWidthPx?: number; handleStrokeWidthPx?: number }>()
    if (!raw) return out
    const readNum = (v: unknown): number | null => {
      if (typeof v === 'number' && Number.isFinite(v)) return v
      if (typeof v === 'string' && v.trim()) {
        const n = Number(v)
        if (Number.isFinite(n)) return n
      }
      return null
    }
    for (const k of Object.keys(raw)) {
      const t = String(k || '').trim()
      if (!t) continue
      const row = raw[t]
      if (!row || typeof row !== 'object' || Array.isArray(row)) continue
      const r = row as Record<string, unknown>
      const color = typeof r.color === 'string' ? String(r.color || '').trim() : ''
      const edgeWidthPx = readNum(r.edgeWidthPx ?? r.edgeWidth)
      const handleStrokeWidthPx = readNum(r.handleStrokeWidthPx ?? r.handleStrokeWidth)
      if (!color && edgeWidthPx == null && handleStrokeWidthPx == null) continue
      out.set(t, {
        ...(color ? { color } : {}),
        ...(edgeWidthPx != null ? { edgeWidthPx } : {}),
        ...(handleStrokeWidthPx != null ? { handleStrokeWidthPx } : {}),
      })
    }
    return out
  })()

  const readPortTypeMap = (props: Record<string, unknown>): { in: Record<string, string>; out: Record<string, string> } | null => {
    const raw = props['flow:portTypes']
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
    const rec = raw as Record<string, unknown>
    const inRec = rec.in && typeof rec.in === 'object' && !Array.isArray(rec.in) ? (rec.in as Record<string, unknown>) : null
    const outRec = rec.out && typeof rec.out === 'object' && !Array.isArray(rec.out) ? (rec.out as Record<string, unknown>) : null
    const normalize = (r: Record<string, unknown> | null): Record<string, string> => {
      const m: Record<string, string> = {}
      if (!r) return m
      for (const k of Object.keys(r)) {
        const key = String(k || '').trim()
        const v = typeof r[k] === 'string' ? String(r[k] || '').trim() : ''
        if (!key || !v) continue
        m[key] = v
      }
      return m
    }
    return { in: normalize(inRec), out: normalize(outRec) }
  }

  setFlowNativeRankdir(args.runtime, args.rankdir)

  const handlesByNode = computeFlowHandlesByNode({
    nodes: nodeList as ReadonlyArray<{ id: unknown; type?: unknown; properties?: unknown }>,
    edges: edgeList as ReadonlyArray<{ id: unknown; source: unknown; target: unknown }>,
    nodeQuickEditorRegistry: args.nodeQuickEditorRegistry || null,
  })

  const nodeById = new Map<string, NonNullable<FlowNativeScene['nodes']>[number]>()
  const inputNodeById = new Map<string, unknown>()
  const nodes: NonNullable<FlowNativeScene['nodes']> = []
  const bestGroupByNodeId = buildBestGroupInfoByNodeId(args.sceneGroups || [])
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
    const yIndex = (() => {
      const raw = props['visual:yIndex']
      const n = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : null
      if (typeof n === 'number' && Number.isFinite(n)) return n
      return 0
    })()
    const xIndex = (() => {
      const raw = props['visual:xIndex']
      const n = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : null
      if (typeof n === 'number' && Number.isFinite(n)) return n
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

    const handleColorById = (() => {
      if (socketStyleByType.size === 0) return null
      const pt = readPortTypeMap(props)
      const fieldTypeById = new Map<string, string>()
      const fields = readSchemaFieldSpecs(n as unknown as GraphNode)
      for (let f = 0; f < fields.length; f += 1) {
        const id = String(fields[f]?.id || '').trim()
        const t = String(fields[f]?.type || '').trim()
        if (!id || !t) continue
        fieldTypeById.set(id, t)
      }
      const out: Partial<Record<FlowHandleId, string>> = {}
      const apply = (dir: 'in' | 'out', handleId: FlowHandleId) => {
        const portKey = parseFlowHandleKey(handleId)
        const explicit = pt ? (dir === 'in' ? pt.in[portKey] : pt.out[portKey]) : ''
        const schemaFieldId = parseSchemaFieldPortKey(portKey)
        const inferred = !explicit && schemaFieldId ? (fieldTypeById.get(schemaFieldId) || '') : ''
        const socketType = explicit || inferred
        if (!socketType) return
        const color = socketStyleByType.get(socketType)?.color || ''
        if (!color) return
        out[handleId] = color
        ;(out as unknown as Record<string, string>)[portKey] = color
      }
      for (let j = 0; j < handles.in.length; j += 1) apply('in', handles.in[j].id)
      for (let j = 0; j < handles.out.length; j += 1) apply('out', handles.out[j].id)
      return Object.keys(out as Record<string, unknown>).length > 0 ? out : null
    })()

    const handleStrokeWidthById = (() => {
      if (socketStyleByType.size === 0) return null
      const pt = readPortTypeMap(props)
      const fieldTypeById = new Map<string, string>()
      const fields = readSchemaFieldSpecs(n as unknown as GraphNode)
      for (let f = 0; f < fields.length; f += 1) {
        const id = String(fields[f]?.id || '').trim()
        const t = String(fields[f]?.type || '').trim()
        if (!id || !t) continue
        fieldTypeById.set(id, t)
      }
      const out: Partial<Record<FlowHandleId, number>> = {}
      const apply = (dir: 'in' | 'out', handleId: FlowHandleId) => {
        const portKey = parseFlowHandleKey(handleId)
        const explicit = pt ? (dir === 'in' ? pt.in[portKey] : pt.out[portKey]) : ''
        const schemaFieldId = parseSchemaFieldPortKey(portKey)
        const inferred = !explicit && schemaFieldId ? (fieldTypeById.get(schemaFieldId) || '') : ''
        const socketType = explicit || inferred
        if (!socketType) return
        const w = socketStyleByType.get(socketType)?.handleStrokeWidthPx
        if (typeof w !== 'number' || !Number.isFinite(w)) return
        out[handleId] = w
        ;(out as unknown as Record<string, number>)[portKey] = w
      }
      for (let j = 0; j < handles.in.length; j += 1) apply('in', handles.in[j].id)
      for (let j = 0; j < handles.out.length; j += 1) apply('out', handles.out[j].id)
      return Object.keys(out as Record<string, unknown>).length > 0 ? out : null
    })()

    const node = {
      id,
      label,
      x,
      y,
      width,
      height,
      zIndex,
      yIndex,
      xIndex,
      opacity,
      shape,
      handles,
      inHandleTopPctById,
      outHandleTopPctById,
      ...(handleColorById ? { handleColorById } : {}),
      ...(handleStrokeWidthById ? { handleStrokeWidthById } : {}),
    }
    nodes.push(node)
    nodeById.set(id, node)
    inputNodeById.set(id, n)
  }
  nodes.sort((a, b) => {
    const az = typeof (a as unknown as { zIndex?: unknown }).zIndex === 'number' ? ((a as unknown as { zIndex: number }).zIndex) : 0
    const bz = typeof (b as unknown as { zIndex?: unknown }).zIndex === 'number' ? ((b as unknown as { zIndex: number }).zIndex) : 0
    if (context === 'frontmatter-mermaid') {
      if (az !== bz) return az - bz
      if (a.y !== b.y) return a.y - b.y
      if (a.x !== b.x) return a.x - b.x
      return a.id.localeCompare(b.id)
    }

    const ag = bestGroupByNodeId.get(a.id) || { depth: -1, size: Number.POSITIVE_INFINITY }
    const bg = bestGroupByNodeId.get(b.id) || { depth: -1, size: Number.POSITIVE_INFINITY }
    if (ag.depth !== bg.depth) return ag.depth - bg.depth
    if (ag.size !== bg.size) return bg.size - ag.size
    if (az !== bz) return az - bz

    const ay = typeof (a as unknown as { yIndex?: unknown }).yIndex === 'number' ? ((a as unknown as { yIndex: number }).yIndex) : 0
    const by = typeof (b as unknown as { yIndex?: unknown }).yIndex === 'number' ? ((b as unknown as { yIndex: number }).yIndex) : 0
    if (ay !== by) return ay - by
    const ax = typeof (a as unknown as { xIndex?: unknown }).xIndex === 'number' ? ((a as unknown as { xIndex: number }).xIndex) : 0
    const bx = typeof (b as unknown as { xIndex?: unknown }).xIndex === 'number' ? ((b as unknown as { xIndex: number }).xIndex) : 0
    if (ax !== bx) return ax - bx
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

    const edgeSocketType = (() => {
      const t = typeof (e as unknown as { type?: unknown }).type === 'string' ? String((e as unknown as { type?: string }).type || '').trim() : ''
      if (t) return t
      const props = e.properties
      const fromProps =
        props && typeof props === 'object' && !Array.isArray(props) && typeof (props as Record<string, unknown>)['flow:socketType'] === 'string'
          ? String((props as Record<string, unknown>)['flow:socketType'] || '').trim()
          : ''
      return fromProps
    })()
    const edgeColor = (() => {
      if (socketStyleByType.size === 0) return ''
      if (!edgeSocketType) return ''
      return socketStyleByType.get(edgeSocketType)?.color || ''
    })()
    const edgeWidthPx = (() => {
      if (socketStyleByType.size === 0) return null
      if (!edgeSocketType) return null
      const w = socketStyleByType.get(edgeSocketType)?.edgeWidthPx
      return typeof w === 'number' && Number.isFinite(w) ? w : null
    })()

    const visual =
      e.properties && typeof e.properties === 'object' && !Array.isArray(e.properties)
        ? (e.properties as Record<string, unknown>)
        : null
    const svgPathD = visual && typeof visual['visual:pathD'] === 'string' ? String(visual['visual:pathD'] || '').trim() : ''
    const svgArrowD = visual && typeof visual['visual:arrowD'] === 'string' ? String(visual['visual:arrowD'] || '').trim() : ''
    const zIndex = (() => {
      const raw = visual ? visual['visual:zIndex'] : null
      const n = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : null
      return typeof n === 'number' && Number.isFinite(n) ? Math.floor(n) : 0
    })()
    const svgPathTx = (() => {
      const raw = visual ? visual['visual:pathTx'] : null
      const n = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : null
      return typeof n === 'number' && Number.isFinite(n) ? n : 0
    })()
    const svgPathTy = (() => {
      const raw = visual ? visual['visual:pathTy'] : null
      const n = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : null
      return typeof n === 'number' && Number.isFinite(n) ? n : 0
    })()
    const labelX = visual && typeof visual['visual:labelX'] === 'number' && Number.isFinite(visual['visual:labelX'] as number) ? (visual['visual:labelX'] as number) : null
    const labelY = visual && typeof visual['visual:labelY'] === 'number' && Number.isFinite(visual['visual:labelY'] as number) ? (visual['visual:labelY'] as number) : null

    edges.push({
      id: edgeId,
      source,
      target,
      outHandleId: buildFlowHandleId({ dir: 'out', edgeId: sourcePortKey || edgeId }),
      inHandleId: buildFlowHandleId({ dir: 'in', edgeId: targetPortKey || edgeId }),
      ...(label ? { label } : {}),
      ...(edgeColor ? { color: edgeColor } : {}),
      ...(edgeWidthPx != null ? { widthPx: edgeWidthPx } : {}),
      ...(zIndex ? { zIndex } : {}),
      ...(svgPathD ? { svgPathD } : {}),
      ...(svgArrowD ? { svgArrowD } : {}),
      ...((svgPathTx || svgPathTy) && svgPathD ? { svgPathTx, svgPathTy } : {}),
      ...(labelX != null && labelY != null ? { labelX, labelY } : {}),
    })
  }

  if (context === 'frontmatter-mermaid') {
    edges.sort((a, b) => {
      const az = typeof (a as unknown as { zIndex?: unknown }).zIndex === 'number' ? ((a as unknown as { zIndex: number }).zIndex) : 0
      const bz = typeof (b as unknown as { zIndex?: unknown }).zIndex === 'number' ? ((b as unknown as { zIndex: number }).zIndex) : 0
      if (az !== bz) return az - bz
      return a.id.localeCompare(b.id)
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
