import type { GraphData, GraphEdge, GraphNode, JSONValue } from './types'

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)

const coerceJsonValueRecord = (v: unknown): Record<string, JSONValue> => {
  if (!isRecord(v)) return {}
  return v as Record<string, JSONValue>
}

const coerceJsonMetadataRecord = (v: unknown): Record<string, JSONValue> | undefined => {
  if (!isRecord(v)) return undefined
  const keys = Object.keys(v)
  if (keys.length === 0) return undefined
  return v as Record<string, JSONValue>
}

const coerceString = (v: unknown): string => String(v ?? '').trim()

export function normalizeGraphData(input: GraphData): GraphData {
  const baseType = coerceString((input as unknown as { type?: unknown }).type) || 'Graph'
  const baseContext = (input as unknown as { context?: unknown }).context as JSONValue | undefined
  const baseMetadata = coerceJsonMetadataRecord((input as unknown as { metadata?: unknown }).metadata)

  const rawNodes = Array.isArray(input.nodes) ? input.nodes : []
  const rawEdges = Array.isArray(input.edges) ? input.edges : []

  let nodesChanged = false
  const nodesOut: GraphNode[] = []
  for (let i = 0; i < rawNodes.length; i += 1) {
    const n = rawNodes[i]
    if (!n) {
      nodesChanged = true
      continue
    }
    const id = coerceString((n as unknown as { id?: unknown }).id)
    if (!id) {
      nodesChanged = true
      continue
    }
    const label = coerceString((n as unknown as { label?: unknown }).label)
    const type = coerceString((n as unknown as { type?: unknown }).type) || 'Node'
    const properties = coerceJsonValueRecord((n as unknown as { properties?: unknown }).properties)
    const metadata = coerceJsonMetadataRecord((n as unknown as { metadata?: unknown }).metadata)

    const x = (n as unknown as { x?: unknown }).x
    const y = (n as unknown as { y?: unknown }).y
    const vx = (n as unknown as { vx?: unknown }).vx
    const vy = (n as unknown as { vy?: unknown }).vy
    const fx = (n as unknown as { fx?: unknown }).fx
    const fy = (n as unknown as { fy?: unknown }).fy

    const xNum = typeof x === 'number' && Number.isFinite(x) ? x : undefined
    const yNum = typeof y === 'number' && Number.isFinite(y) ? y : undefined
    const vxNum = typeof vx === 'number' && Number.isFinite(vx) ? vx : undefined
    const vyNum = typeof vy === 'number' && Number.isFinite(vy) ? vy : undefined
    const fxNum = typeof fx === 'number' && Number.isFinite(fx) ? fx : fx === null ? null : undefined
    const fyNum = typeof fy === 'number' && Number.isFinite(fy) ? fy : fy === null ? null : undefined

    const needsClone =
      id !== n.id ||
      label !== n.label ||
      type !== n.type ||
      (n as unknown as { properties?: unknown }).properties !== properties ||
      ((n as unknown as { metadata?: unknown }).metadata ?? undefined) !== metadata ||
      (n.x ?? undefined) !== xNum ||
      (n.y ?? undefined) !== yNum ||
      (n.vx ?? undefined) !== vxNum ||
      (n.vy ?? undefined) !== vyNum ||
      (n.fx ?? undefined) !== fxNum ||
      (n.fy ?? undefined) !== fyNum

    if (needsClone) {
      nodesChanged = true
      nodesOut.push({
        ...n,
        id,
        label,
        type,
        properties,
        ...(metadata ? { metadata } : {}),
        ...(xNum != null ? { x: xNum } : {}),
        ...(yNum != null ? { y: yNum } : {}),
        ...(vxNum != null ? { vx: vxNum } : {}),
        ...(vyNum != null ? { vy: vyNum } : {}),
        ...(fxNum !== undefined ? { fx: fxNum } : {}),
        ...(fyNum !== undefined ? { fy: fyNum } : {}),
      })
    } else {
      nodesOut.push(n)
    }
  }

  const nodeIds = new Set<string>()
  for (let i = 0; i < nodesOut.length; i += 1) nodeIds.add(nodesOut[i].id)

  let edgesChanged = false
  const edgesOut: GraphEdge[] = []
  const idCounts = new Map<string, number>()
  for (let i = 0; i < rawEdges.length; i += 1) {
    const e = rawEdges[i]
    if (!e) {
      edgesChanged = true
      continue
    }
    const source = coerceString((e as unknown as { source?: unknown }).source)
    const target = coerceString((e as unknown as { target?: unknown }).target)
    if (!source || !target) {
      edgesChanged = true
      continue
    }
    if (!nodeIds.has(source) || !nodeIds.has(target)) {
      edgesChanged = true
      continue
    }
    const label = coerceString((e as unknown as { label?: unknown }).label)
    const properties = coerceJsonValueRecord((e as unknown as { properties?: unknown }).properties)
    const metadata = coerceJsonMetadataRecord((e as unknown as { metadata?: unknown }).metadata)

    let id = coerceString((e as unknown as { id?: unknown }).id)
    if (!id) {
      edgesChanged = true
      id = `${source}->${target}:${label || 'edge'}:${i}`
    }
    const prior = idCounts.get(id) || 0
    idCounts.set(id, prior + 1)
    if (prior > 0) {
      edgesChanged = true
      id = `${id}#${prior + 1}`
    }

    const needsClone =
      id !== (e as unknown as { id?: unknown }).id ||
      source !== e.source ||
      target !== e.target ||
      label !== (e as unknown as { label?: unknown }).label ||
      (e as unknown as { properties?: unknown }).properties !== properties ||
      ((e as unknown as { metadata?: unknown }).metadata ?? undefined) !== metadata

    if (needsClone) {
      edgesOut.push({
        ...e,
        id,
        source,
        target,
        label,
        properties,
        ...(metadata ? { metadata } : {}),
      })
      edgesChanged = true
    } else {
      edgesOut.push(e)
    }
  }

  const graphNeedsClone =
    baseType !== input.type ||
    baseMetadata !== ((input as unknown as { metadata?: unknown }).metadata ?? undefined) ||
    (baseContext ?? undefined) !== ((input as unknown as { context?: unknown }).context as JSONValue | undefined) ||
    nodesChanged ||
    edgesChanged

  if (!graphNeedsClone) return input

  const next: GraphData = {
    ...input,
    type: baseType,
    nodes: nodesOut,
    edges: edgesOut,
  }
  if (baseContext !== undefined) next.context = baseContext
  if (baseMetadata) next.metadata = baseMetadata
  return next
}

