import type { GraphData, JSONValue } from '@/lib/graph/types'
import { createUniqueId } from '@/lib/ids'

export type UserSubgraph = {
  id: string
  label: string
  memberNodeIds: string[]
  parentId?: string | null
}

export const KG_SUBGRAPHS_KEY = 'kg:subgraphs'

export const subgraphGroupId = (id: string): string => {
  const v = String(id || '').trim()
  return v ? `subgraph:${v}` : ''
}

const normalizeIds = (ids: unknown): string[] => {
  const out: string[] = []
  const seen = new Set<string>()
  if (!Array.isArray(ids)) return out
  for (let i = 0; i < ids.length; i += 1) {
    const id = String(ids[i] || '').trim()
    if (!id) continue
    if (seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  out.sort((a, b) => a.localeCompare(b))
  return out
}

const coerceSubgraph = (raw: unknown): UserSubgraph | null => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const r = raw as Record<string, unknown>
  const id = String(r.id || '').trim()
  if (!id) return null
  const label = String(r.label || id).trim() || id
  const memberNodeIds = normalizeIds(r.memberNodeIds)
  const parentRaw = r.parentId
  const parentId = parentRaw == null ? null : String(parentRaw || '').trim() || null
  return { id, label, memberNodeIds, parentId }
}

export const readSubgraphs = (data: GraphData | null | undefined): UserSubgraph[] => {
  const meta = (data?.metadata || {}) as Record<string, unknown>
  const raw = meta[KG_SUBGRAPHS_KEY]
  if (!Array.isArray(raw)) return []
  const out: UserSubgraph[] = []
  const seen = new Set<string>()
  for (let i = 0; i < raw.length; i += 1) {
    const sg = coerceSubgraph(raw[i])
    if (!sg) continue
    if (seen.has(sg.id)) continue
    seen.add(sg.id)
    out.push(sg)
  }
  out.sort((a, b) => a.label.localeCompare(b.label))
  return out
}

export const writeSubgraphs = (data: GraphData, subgraphs: UserSubgraph[]): GraphData => {
  const meta = ((data.metadata || {}) as Record<string, JSONValue>) || {}
  const next: UserSubgraph[] = []
  const seen = new Set<string>()
  for (let i = 0; i < subgraphs.length; i += 1) {
    const sg = subgraphs[i]
    const id = String(sg.id || '').trim()
    if (!id || seen.has(id)) continue
    seen.add(id)
    next.push({
      id,
      label: String(sg.label || id).trim() || id,
      memberNodeIds: normalizeIds(sg.memberNodeIds),
      parentId: sg.parentId == null ? null : String(sg.parentId || '').trim() || null,
    })
  }
  next.sort((a, b) => a.label.localeCompare(b.label))
  return {
    ...data,
    metadata: {
      ...meta,
      [KG_SUBGRAPHS_KEY]: next as unknown as JSONValue,
    },
  }
}

export const createSubgraph = (data: GraphData, args: { nodeIds: string[]; label?: string; parentId?: string | null }) => {
  const subgraphs = readSubgraphs(data)
  const used = new Set<string>(subgraphs.map(s => s.id))
  const id = createUniqueId('sg', used)
  const label = String(args.label || `Subgraph ${id}`).trim() || `Subgraph ${id}`
  const memberNodeIds = normalizeIds(args.nodeIds)
  const parentId = args.parentId == null ? null : String(args.parentId || '').trim() || null
  const sg: UserSubgraph = { id, label, memberNodeIds, parentId }
  return { subgraph: sg, graphData: writeSubgraphs(data, [...subgraphs, sg]) }
}

export const updateSubgraph = (data: GraphData, id: string, patch: Partial<UserSubgraph>): GraphData => {
  const sid = String(id || '').trim()
  if (!sid) return data
  const subgraphs = readSubgraphs(data)
  const next = subgraphs.map(sg => {
    if (sg.id !== sid) return sg
    const label = patch.label == null ? sg.label : String(patch.label || '').trim() || sg.label
    const memberNodeIds = patch.memberNodeIds == null ? sg.memberNodeIds : normalizeIds(patch.memberNodeIds)
    const parentId = patch.parentId === undefined ? sg.parentId : patch.parentId == null ? null : String(patch.parentId || '').trim() || null
    return { ...sg, label, memberNodeIds, parentId }
  })
  return writeSubgraphs(data, next)
}

export const removeSubgraph = (data: GraphData, id: string): GraphData => {
  const sid = String(id || '').trim()
  if (!sid) return data
  const subgraphs = readSubgraphs(data)
  const filtered = subgraphs.filter(sg => sg.id !== sid).map(sg => ({ ...sg, parentId: sg.parentId === sid ? null : sg.parentId }))
  return writeSubgraphs(data, filtered)
}

