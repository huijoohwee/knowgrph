import type { GraphData, GraphEdge, GraphNode, JSONValue } from '@/lib/graph/types'
import { LRUCache } from '@/lib/cache/LRUCache'
import { hashStringToHex } from '@/lib/hash/stringHash'
import { KG_SUBGRAPHS_KEY, type UserSubgraph } from '@/lib/graph/subgraphs'
import {
  readWorkspaceDataViewStateWithMeta,
  type WorkspaceDataViewGraphColumnRole,
} from '@/components/BottomPanel/markdownWorkspace/main/viewer/workspaceDataViewConfig'

type TableNodeLike = {
  id?: unknown
  type?: unknown
  properties?: unknown
  metadata?: unknown
}

type DeriveArgs = {
  graphData: GraphData
  forceGraphEnabled?: boolean
}

const cache = new LRUCache<string, GraphData | null>(32, 30_000)

const fnv1a32PushString = (h0: number, input: string): number => {
  let h = h0 >>> 0
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

const hashTableContentToHex = (header: string[], rows: string[][]): string => {
  let h = 0x811c9dc5
  h = fnv1a32PushString(h, `h:${header.length}|r:${rows.length}`)
  for (let i = 0; i < header.length; i += 1) {
    h = fnv1a32PushString(h, '\u0001')
    h = fnv1a32PushString(h, header[i] ?? '')
  }
  for (let rIdx = 0; rIdx < rows.length; rIdx += 1) {
    const row = rows[rIdx]!
    h = fnv1a32PushString(h, '\u0002')
    for (let cIdx = 0; cIdx < row.length; cIdx += 1) {
      h = fnv1a32PushString(h, '\u0001')
      h = fnv1a32PushString(h, row[cIdx] ?? '')
    }
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}

const normalizeText = (v: unknown): string => String(v ?? '').replace(/\s+/g, ' ').trim()

const splitMulti = (raw: string): string[] => {
  const s = normalizeText(raw)
  if (!s) return []
  return s
    .split(',')
    .map(x => normalizeText(x))
    .filter(Boolean)
}

const readStringArrayProp = (props: unknown, key: string): string[] => {
  if (!props || typeof props !== 'object' || Array.isArray(props)) return []
  const v = (props as Record<string, unknown>)[key]
  if (!Array.isArray(v)) return []
  return v.map(x => normalizeText(x)).filter(Boolean)
}

const readStringMatrixProp = (props: unknown, key: string): string[][] => {
  if (!props || typeof props !== 'object' || Array.isArray(props)) return []
  const v = (props as Record<string, unknown>)[key]
  if (!Array.isArray(v)) return []
  const out: string[][] = []
  for (const row of v) {
    if (!Array.isArray(row)) continue
    out.push(row.map(x => normalizeText(x)))
  }
  return out
}

const readLineRange = (meta: unknown): { startLine: number; endLine: number; documentPath: string } => {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return { startLine: 1, endLine: 1, documentPath: '' }
  const m = meta as Record<string, unknown>
  const startLine = Number.isFinite(m.lineStart) ? Number(m.lineStart) : 1
  const endLine = Number.isFinite(m.lineEnd) ? Number(m.lineEnd) : startLine
  const documentPath = normalizeText(m.documentPath)
  return {
    startLine: Math.max(1, Math.floor(startLine)),
    endLine: Math.max(1, Math.floor(endLine)),
    documentPath,
  }
}

type ColumnRole = WorkspaceDataViewGraphColumnRole

const inferRolesByHeader = (header: string[]): Record<string, ColumnRole> => {
  const out: Record<string, ColumnRole> = {}
  for (let i = 0; i < header.length; i += 1) {
    const name = normalizeText(header[i])
    const lower = name.toLowerCase()
    const colId = `col_${i}`
    if (lower === 'task') out[colId] = 'node'
    else if (lower === 'status') out[colId] = 'color'
    else if (lower === 'category') out[colId] = 'group'
    else if (lower === 'dependency' || lower === 'dependencies') out[colId] = 'dependsOn'
    else if (lower === 'predecessor' || lower === 'predecessors') out[colId] = 'predecessor'
    else if (lower === 'successor' || lower === 'successors') out[colId] = 'successor'
    else out[colId] = 'none'
  }
  return out
}

const coerceRole = (raw: unknown): ColumnRole => {
  const v = String(raw || '').trim()
  if (v === 'node' || v === 'color' || v === 'group' || v === 'dependsOn' || v === 'predecessor' || v === 'successor') return v
  return 'none'
}

const readRolesFromWorkspaceDataView = (args: {
  documentPath: string | null
  tableId: string
  header: string[]
  forceGraphEnabled?: boolean
}): { enabled: boolean; rolesByColumnId: Record<string, ColumnRole>; hasStoredValue: boolean } => {
  const { state, hasStoredValue } = readWorkspaceDataViewStateWithMeta({
    activeDocumentPath: args.documentPath,
    tableId: args.tableId,
  })
  const activeView = state.views.find(v => v.id === state.activeViewId) || state.views[0]
  const storedRolesRaw =
    activeView && (activeView as Record<string, unknown>).graphRolesByColumnId && typeof (activeView as Record<string, unknown>).graphRolesByColumnId === 'object'
      ? ((activeView as Record<string, unknown>).graphRolesByColumnId as Record<string, unknown>)
      : null
  const storedEnabledRaw = activeView ? (activeView as Record<string, unknown>).graphEnabled : undefined

  const inferred = inferRolesByHeader(args.header)
  if (args.forceGraphEnabled === true) {
    if (!storedRolesRaw) return { enabled: true, rolesByColumnId: inferred, hasStoredValue }
    const roles: Record<string, ColumnRole> = { ...inferred }
    for (const [k, v] of Object.entries(storedRolesRaw)) {
      const id = String(k || '').trim()
      if (!id) continue
      roles[id] = coerceRole(v)
    }
    return { enabled: true, rolesByColumnId: roles, hasStoredValue }
  }
  if (!hasStoredValue) {
    return { enabled: true, rolesByColumnId: inferred, hasStoredValue }
  }
  if (!storedRolesRaw) {
    const enabled = typeof storedEnabledRaw === 'boolean' ? storedEnabledRaw : false
    return { enabled, rolesByColumnId: inferred, hasStoredValue }
  }

  const roles: Record<string, ColumnRole> = { ...inferred }
  for (const [k, v] of Object.entries(storedRolesRaw)) {
    const id = String(k || '').trim()
    if (!id) continue
    roles[id] = coerceRole(v)
  }
  const enabled = typeof storedEnabledRaw === 'boolean' ? storedEnabledRaw : true
  return { enabled, rolesByColumnId: roles, hasStoredValue }
}

const statusToFill = (statusRaw: string): string | null => {
  const s = normalizeText(statusRaw).toLowerCase()
  if (!s) return null
  if (s === 'done') return '#10B981'
  if (s === 'doing' || s === 'in progress' || s === 'wip') return '#F59E0B'
  if (s === 'todo' || s === 'backlog') return '#6B7280'
  if (s === 'blocked') return '#EF4444'
  return '#3B82F6'
}

const normalizePropertyKey = (name: string): string => {
  const s = normalizeText(name).toLowerCase()
  const key = s.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
  return key || 'col'
}

const makeStableId = (prefix: string, raw: string): string => {
  const h = hashStringToHex(`${prefix}|${raw}`)
  return `${prefix}:${h.slice(0, 16)}`
}

export function deriveMarkdownTableGraphForFrontmatterMode(args: DeriveArgs): GraphData | null {
  const graphData = args.graphData

  const nodes = Array.isArray(graphData.nodes) ? graphData.nodes : []
  const docNode = nodes.find(n => String((n as { type?: unknown }).type || '') === 'Document') as
    | { properties?: Record<string, unknown> }
    | undefined
  const documentPath = normalizeText(docNode?.properties?.path)

  const tableNodes = nodes.filter(n => String((n as { type?: unknown }).type || '') === 'Table') as unknown as TableNodeLike[]
  if (tableNodes.length === 0) return null

  const tryDerive = (tn: TableNodeLike, tIdx: number, requireStored: boolean): GraphData | null => {
    const header = readStringArrayProp(tn.properties, 'table:header')
    const rows = readStringMatrixProp(tn.properties, 'table:rows')
    if (header.length < 2 || rows.length < 1) return null

    const meta = readLineRange(tn.metadata)
    const tableId = `md-block:${meta.startLine}-${meta.endLine}`
    const cfg = readRolesFromWorkspaceDataView({
      documentPath: documentPath || meta.documentPath || null,
      tableId,
      header,
      forceGraphEnabled: args.forceGraphEnabled === true,
    })
    if (!cfg.enabled) return null
    if (requireStored && !cfg.hasStoredValue) return null

    const cfgKey = hashStringToHex(
      `cfg|${cfg.enabled ? 1 : 0}|${Object.entries(cfg.rolesByColumnId)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}:${v}`)
        .join('|')}`,
    )
    const tableHash = hashTableContentToHex(header, rows)
    const cacheKey = hashStringToHex(
      `mdtbl|${documentPath || meta.documentPath || ''}|${tableId}|${cfgKey}|${tableHash}`,
    )
    const cached = cache.get(cacheKey)
    if (cached !== undefined) return cached

    const colIndexById = new Map<string, number>()
    for (let i = 0; i < header.length; i += 1) colIndexById.set(`col_${i}`, i)

    const roleEntries = Object.entries(cfg.rolesByColumnId)
    const nodeColId = roleEntries.find(([, r]) => r === 'node')?.[0] || 'col_0'
    const colorColId = roleEntries.find(([, r]) => r === 'color')?.[0] || ''
    const groupColIds = roleEntries
      .filter(([, r]) => r === 'group')
      .map(([id]) => id)
    const edgeCols = roleEntries.filter(([, r]) => r === 'dependsOn' || r === 'predecessor' || r === 'successor')

    const nodeColIndex = colIndexById.get(nodeColId) ?? 0
    const colorColIndex = colorColId ? colIndexById.get(colorColId) ?? -1 : -1

    const tableKey = makeStableId('mdtbl', `${documentPath || meta.documentPath || ''}|${tableId}|${tIdx}`)

    const outNodes: GraphNode[] = []
    const nodeIdByLabelKey = new Map<string, string>()
    const nodeById = new Map<string, GraphNode>()

    for (let rIdx = 0; rIdx < rows.length; rIdx += 1) {
      const row = rows[rIdx]!
      const label = normalizeText(row[nodeColIndex] ?? '')
      if (!label) continue
      const labelKey = label.toLowerCase()
      if (nodeIdByLabelKey.has(labelKey)) continue

      const id = makeStableId(tableKey, labelKey)
      const props: Record<string, JSONValue> = {}
      for (let cIdx = 0; cIdx < header.length; cIdx += 1) {
        const colName = normalizeText(header[cIdx] ?? '') || `Column ${cIdx + 1}`
        const key = `md:table:${normalizePropertyKey(colName)}`
        const raw = normalizeText(row[cIdx] ?? '')
        if (!raw) continue
        const role = cfg.rolesByColumnId[`col_${cIdx}`] || 'none'
        props[key] = role === 'group' ? (splitMulti(raw) as unknown as JSONValue) : raw
      }

      if (colorColIndex >= 0) {
        const status = normalizeText(row[colorColIndex] ?? '')
        const fill = statusToFill(status)
        if (fill) props['visual:fill'] = fill
        if (status) props['md:table:status'] = status
      }

      const n: GraphNode = {
        id,
        type: 'Task',
        label,
        properties: props,
      }
      outNodes.push(n)
      nodeIdByLabelKey.set(labelKey, id)
      nodeById.set(id, n)
    }

    if (outNodes.length < 1) return null

    const ensurePlaceholderNode = (label: string): string => {
      const key = label.toLowerCase()
      const existing = nodeIdByLabelKey.get(key)
      if (existing) return existing
      const id = makeStableId(tableKey, `placeholder|${key}`)
      const n: GraphNode = { id, type: 'Task', label, properties: { 'md:table:placeholder': true } }
      outNodes.push(n)
      nodeIdByLabelKey.set(key, id)
      nodeById.set(id, n)
      return id
    }

    const edges: GraphEdge[] = []
    const seenEdgeId = new Set<string>()
    for (let rIdx = 0; rIdx < rows.length; rIdx += 1) {
      const row = rows[rIdx]!
      const srcLabel = normalizeText(row[nodeColIndex] ?? '')
      if (!srcLabel) continue
      const srcId = nodeIdByLabelKey.get(srcLabel.toLowerCase())
      if (!srcId) continue

      for (const [colId, role] of edgeCols) {
        const idx = colIndexById.get(colId) ?? -1
        if (idx < 0) continue
        const cell = normalizeText(row[idx] ?? '')
        if (!cell) continue
        const targets = splitMulti(cell)
        for (const t of targets) {
          const tgtId = ensurePlaceholderNode(t)
          let source = srcId
          let target = tgtId
          let label = 'dependsOn'
          if (role === 'predecessor') {
            label = 'predecessor'
            source = tgtId
            target = srcId
          } else if (role === 'successor') {
            label = 'successor'
            source = srcId
            target = tgtId
          }
          const edgeId = makeStableId('e', `${tableKey}|${label}|${source}|${target}`)
          if (seenEdgeId.has(edgeId)) continue
          seenEdgeId.add(edgeId)
          edges.push({ id: edgeId, source, target, label, properties: { 'md:table:origin': tableId } })
        }
      }
    }

    const subgraphs: UserSubgraph[] = []
    const groupsById = new Map<string, { label: string; members: Set<string> }>()
    for (const n of outNodes) {
      const nodeProps = (n.properties || {}) as Record<string, unknown>
      for (const colId of groupColIds) {
        const idx = colIndexById.get(colId) ?? -1
        if (idx < 0) continue
        const colName = normalizeText(header[idx] ?? '') || `col_${idx}`
        const key = `md:table:${normalizePropertyKey(colName)}`
        const raw = nodeProps[key]
        const vals = Array.isArray(raw) ? raw.map(x => normalizeText(x)).filter(Boolean) : splitMulti(String(raw ?? ''))
        for (const v of vals) {
          const groupId = makeStableId('sg', `${tableKey}|${colName}|${v.toLowerCase()}`)
          const label = colName.trim().toLowerCase() === 'category' ? v : `${colName}: ${v}`
          const cur = groupsById.get(groupId) || { label, members: new Set<string>() }
          cur.members.add(String(n.id))
          groupsById.set(groupId, cur)
        }
      }
    }
    for (const [id, g] of groupsById) {
      const memberNodeIds = Array.from(g.members)
      if (memberNodeIds.length < 2) continue
      subgraphs.push({ id, label: g.label || id, memberNodeIds, kind: 'cluster' })
    }

    const derived: GraphData = {
      type: 'Graph',
      context: 'markdown-table-graph',
      nodes: outNodes,
      edges,
      metadata: {
        ...(graphData.metadata as Record<string, JSONValue>),
        [KG_SUBGRAPHS_KEY]: (subgraphs as unknown as JSONValue) || ([] as unknown as JSONValue),
      },
    }
    cache.set(cacheKey, derived)
    return derived
  }

  for (let tIdx = 0; tIdx < tableNodes.length; tIdx += 1) {
    const tn = tableNodes[tIdx]!
    const derived = tryDerive(tn, tIdx, true)
    if (derived) return derived
  }

  for (let tIdx = 0; tIdx < tableNodes.length; tIdx += 1) {
    const tn = tableNodes[tIdx]!
    const derived = tryDerive(tn, tIdx, false)
    if (derived) return derived
  }
  return null
}
