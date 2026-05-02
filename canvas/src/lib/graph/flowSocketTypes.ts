import type { GraphData, GraphNode } from '@/lib/graph/types'
import { toMetadataRecord } from '@/lib/graph/documentMetadata'
import { readNodeProperties } from '@/lib/graph/nodeProperties'
import { isPlainObject } from '@/lib/graph/value'

export const FLOW_PORT_TYPES_KEY = 'flow:portTypes' as const

function pickString(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

export function readNodeFlowPortSocketType(node: GraphNode | null, dir: 'in' | 'out', portKey: string | null | undefined): string {
  if (!node) return ''
  const pk = pickString(portKey)
  if (!pk) return ''
  const props = readNodeProperties(node)
  const portTypes = props[FLOW_PORT_TYPES_KEY]
  if (!isPlainObject(portTypes)) return ''
  const bucket = portTypes[dir]
  if (!isPlainObject(bucket)) return ''
  return pickString(bucket[pk])
}

function readSocketTypeAccepts(graphData: GraphData | null, typeId: string): Set<string> | null {
  const t = pickString(typeId)
  if (!t) return null
  const meta = toMetadataRecord(graphData?.metadata)
  const socketTypes = meta.socketTypes
  if (!isPlainObject(socketTypes)) return null
  const spec = socketTypes[t]
  if (!isPlainObject(spec)) return null
  const accepts = spec.accepts
  if (!Array.isArray(accepts)) return null
  const out = new Set<string>()
  for (let i = 0; i < accepts.length; i += 1) {
    const a = pickString(accepts[i])
    if (a) out.add(a)
  }
  return out.size > 0 ? out : null
}

export function isFlowSocketCompatible(graphData: GraphData | null, outType: string, inType: string): boolean {
  const outT = pickString(outType)
  const inT = pickString(inType)
  if (!outT || !inT) return true
  if (outT === inT) return true
  const accepts = readSocketTypeAccepts(graphData, inT)
  if (!accepts) return false
  if (accepts.has('*')) return true
  return accepts.has(outT)
}

export function resolveFlowSocketTypesForEdge(args: {
  graphData: GraphData | null
  sourceNode: GraphNode | null
  targetNode: GraphNode | null
  sourcePortKey: string | null | undefined
  targetPortKey: string | null | undefined
}): { outType: string; inType: string; ok: boolean; edgeType: string } {
  const outType = readNodeFlowPortSocketType(args.sourceNode, 'out', args.sourcePortKey)
  const inType = readNodeFlowPortSocketType(args.targetNode, 'in', args.targetPortKey)
  const ok = isFlowSocketCompatible(args.graphData, outType, inType)
  return { outType, inType, ok, edgeType: outType || '' }
}
