import { addRxPlugin, createRxDatabase, type RxCollection, type RxDatabase, type RxJsonSchema } from 'rxdb/plugins/core'
import { RxDBQueryBuilderPlugin } from 'rxdb/plugins/query-builder'
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie'
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory'
import type { GraphData, GraphEdge, GraphNode, JSONValue } from '@/lib/graph/types'
import { hashString32 } from 'grph-shared/hash/stringHash'

export type GraphTableId = 'nodes' | 'edges'

export type GraphColumnKind = 'text' | 'number' | 'boolean' | 'date' | 'json'

export type GraphTableDoc = {
  id: GraphTableId
  name: string
  order: number
  createdAtMs: number
  updatedAtMs: number
}

export type GraphColumnDoc = {
  pk: string
  tableId: GraphTableId
  columnId: string
  name: string
  kind: GraphColumnKind
  order: number
  hidden: boolean
  createdAtMs: number
  updatedAtMs: number
}

export type GraphRowDoc = {
  pk: string
  tableId: GraphTableId
  rowId: string
  order: number
  data: Record<string, JSONValue>
  createdAtMs: number
  updatedAtMs: number
}

export type GraphViewDoc = {
  id: string
  tableId: GraphTableId
  name: string
  sort: unknown
  filters: unknown
  createdAtMs: number
  updatedAtMs: number
}

export type GraphMetaDoc = {
  key: string
  value: unknown
  updatedAtMs: number
}

export type GraphTableCollections = {
  tables: RxCollection<GraphTableDoc>
  columns: RxCollection<GraphColumnDoc>
  rows: RxCollection<GraphRowDoc>
  views: RxCollection<GraphViewDoc>
  meta: RxCollection<GraphMetaDoc>
}

export type GraphTableDb = {
  db: RxDatabase<GraphTableCollections>
  collections: GraphTableCollections
}

export const GRAPH_TABLE_DB_NAME = 'kg:graph-table'

const GRAPH_TABLE_COLUMN_ORDER_STEP = 1024

let graphTableDbWriteQueue: Promise<void> = Promise.resolve()

const withGraphTableDbWrite = async <T>(fn: () => Promise<T>): Promise<T> => {
  const prev = graphTableDbWriteQueue
  let release: (() => void) | null = null
  graphTableDbWriteQueue = new Promise<void>(resolve => {
    release = resolve
  })
  await prev.catch(() => void 0)
  try {
    return await fn()
  } finally {
    try {
      release?.()
    } catch {
      void 0
    }
  }
}

let rxdbPluginsInitialized = false
const ensureRxdbPlugins = () => {
  if (rxdbPluginsInitialized) return
  addRxPlugin(RxDBQueryBuilderPlugin)
  rxdbPluginsInitialized = true
}

const graphTableSchema: RxJsonSchema<GraphTableDoc> = {
  title: 'graph_table',
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 32 },
    name: { type: 'string' },
    order: { type: 'integer', minimum: 0, maximum: 2_147_483_647, multipleOf: 1 },
    createdAtMs: { type: 'number' },
    updatedAtMs: { type: 'number' },
  },
  required: ['id', 'name', 'order', 'createdAtMs', 'updatedAtMs'],
}

const graphColumnSchema: RxJsonSchema<GraphColumnDoc> = {
  title: 'graph_column',
  version: 0,
  primaryKey: 'pk',
  type: 'object',
  properties: {
    pk: { type: 'string', maxLength: 512 },
    tableId: { type: 'string', maxLength: 32 },
    columnId: { type: 'string', maxLength: 256 },
    name: { type: 'string' },
    kind: { type: 'string' },
    order: { type: 'integer', minimum: 0, maximum: 2_147_483_647, multipleOf: 1 },
    hidden: { type: 'boolean' },
    createdAtMs: { type: 'number' },
    updatedAtMs: { type: 'number' },
  },
  required: ['pk', 'tableId', 'columnId', 'name', 'kind', 'order', 'hidden', 'createdAtMs', 'updatedAtMs'],
  indexes: ['tableId', ['tableId', 'order'], ['tableId', 'columnId']],
}

const graphRowSchema: RxJsonSchema<GraphRowDoc> = {
  title: 'graph_row',
  version: 0,
  primaryKey: 'pk',
  type: 'object',
  properties: {
    pk: { type: 'string', maxLength: 1024 },
    tableId: { type: 'string', maxLength: 32 },
    rowId: { type: 'string', maxLength: 512 },
    order: { type: 'integer', minimum: 0, maximum: 2_147_483_647, multipleOf: 1 },
    data: { type: 'object', additionalProperties: true },
    createdAtMs: { type: 'number' },
    updatedAtMs: { type: 'number' },
  },
  required: ['pk', 'tableId', 'rowId', 'order', 'data', 'createdAtMs', 'updatedAtMs'],
  indexes: ['tableId', ['tableId', 'order'], ['tableId', 'rowId']],
}

const graphViewSchema: RxJsonSchema<GraphViewDoc> = {
  title: 'graph_view',
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 128 },
    tableId: { type: 'string', maxLength: 32 },
    name: { type: 'string' },
    sort: { type: 'object', additionalProperties: true },
    filters: { type: 'object', additionalProperties: true },
    createdAtMs: { type: 'number' },
    updatedAtMs: { type: 'number' },
  },
  required: ['id', 'tableId', 'name', 'sort', 'filters', 'createdAtMs', 'updatedAtMs'],
  indexes: ['tableId'],
}

const graphMetaSchema: RxJsonSchema<GraphMetaDoc> = {
  title: 'graph_meta',
  version: 0,
  primaryKey: 'key',
  type: 'object',
  properties: {
    key: { type: 'string', maxLength: 128 },
    value: { type: 'object', additionalProperties: true },
    updatedAtMs: { type: 'number' },
  },
  required: ['key', 'value', 'updatedAtMs'],
}

let graphTableDbSingleton: Promise<GraphTableDb> | null = null

export const getGraphTableDb = async (): Promise<GraphTableDb> => {
  if (graphTableDbSingleton) return graphTableDbSingleton
  graphTableDbSingleton = (async () => {
    ensureRxdbPlugins()
    const name = GRAPH_TABLE_DB_NAME
    try {
      const db = await createRxDatabase<GraphTableCollections>({
        name,
        storage: getRxStorageDexie(),
        multiInstance: true,
        eventReduce: true,
        closeDuplicates: true,
      })
      const collections = await db.addCollections({
        tables: { schema: graphTableSchema },
        columns: { schema: graphColumnSchema },
        rows: { schema: graphRowSchema },
        views: { schema: graphViewSchema },
        meta: { schema: graphMetaSchema },
      })
      return { db, collections }
    } catch {
      const db = await createRxDatabase<GraphTableCollections>({
        name: `${name}:memory`,
        storage: getRxStorageMemory(),
        multiInstance: true,
        eventReduce: true,
        closeDuplicates: true,
      })
      const collections = await db.addCollections({
        tables: { schema: graphTableSchema },
        columns: { schema: graphColumnSchema },
        rows: { schema: graphRowSchema },
        views: { schema: graphViewSchema },
        meta: { schema: graphMetaSchema },
      })
      return { db, collections }
    }
  })()
  return graphTableDbSingleton
}

const pkOfColumn = (tableId: GraphTableId, columnId: string): string => `${tableId}:${columnId}`
const pkOfRow = (tableId: GraphTableId, rowId: string): string => `${tableId}:${rowId}`

export const ensureGraphTableSeed = async (): Promise<void> => {
  const { collections } = await getGraphTableDb()
  const now = Date.now()
  const existing = await collections.tables.find().exec()
  const existingIds = new Set(existing.map(d => d.get('id')))
  const seeds: GraphTableDoc[] = [
    { id: 'nodes', name: 'Nodes', order: 1, createdAtMs: now, updatedAtMs: now },
    { id: 'edges', name: 'Edges', order: 2, createdAtMs: now, updatedAtMs: now },
  ]
  for (const t of seeds) {
    if (existingIds.has(t.id)) continue
    await collections.tables.insert(t)
  }

  const baseColumns: Array<{ tableId: GraphTableId; columnId: string; name: string; kind: GraphColumnKind; order: number; hidden?: boolean }> = [
    { tableId: 'nodes', columnId: 'id', name: 'id', kind: 'text', order: 1 },
    { tableId: 'nodes', columnId: 'label', name: 'label', kind: 'text', order: 2 },
    { tableId: 'nodes', columnId: 'type', name: 'type', kind: 'text', order: 3 },
    { tableId: 'edges', columnId: 'id', name: 'id', kind: 'text', order: 1 },
    { tableId: 'edges', columnId: 'label', name: 'label', kind: 'text', order: 2 },
    { tableId: 'edges', columnId: 'source', name: 'source', kind: 'text', order: 3 },
    { tableId: 'edges', columnId: 'target', name: 'target', kind: 'text', order: 4 },
  ]

  for (const c of baseColumns) {
    const pk = pkOfColumn(c.tableId, c.columnId)
    const exists = await collections.columns.findOne(pk).exec()
    if (exists) continue
    await collections.columns.insert({
      pk,
      tableId: c.tableId,
      columnId: c.columnId,
      name: c.name,
      kind: c.kind,
      order: c.order,
      hidden: !!c.hidden,
      createdAtMs: now,
      updatedAtMs: now,
    })
  }
}

const isPlainObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)

const toJsonValueForDb = (v: unknown): JSONValue => {
  if (v == null) return null
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return v
  if (v instanceof Date) {
    const t = v.getTime()
    if (Number.isFinite(t)) return new Date(t).toISOString()
  }
  if (Array.isArray(v)) return v.map(item => toJsonValueForDb(item)) as JSONValue
  if (isPlainObject(v)) {
    const out: Record<string, JSONValue> = {}
    for (const k of Object.keys(v).sort((a, b) => a.localeCompare(b))) {
      out[k] = toJsonValueForDb(v[k])
    }
    return out as JSONValue
  }
  return String(v)
}

const isJsonValueEqual = (a: JSONValue, b: JSONValue): boolean => {
  if (Object.is(a, b)) return true
  if (a == null || b == null) return a === b
  if (typeof a !== typeof b) return false
  if (typeof a === 'string' || typeof a === 'number' || typeof a === 'boolean') return a === b
  if (Array.isArray(a)) {
    if (!Array.isArray(b)) return false
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i += 1) {
      if (!isJsonValueEqual(a[i] as JSONValue, b[i] as JSONValue)) return false
    }
    return true
  }
  if (!isPlainObject(a) || !isPlainObject(b)) return false
  const ak = Object.keys(a)
  const bk = Object.keys(b)
  if (ak.length !== bk.length) return false
  const bSet = new Set(bk)
  for (const k of ak) {
    if (!bSet.has(k)) return false
    if (!isJsonValueEqual(a[k] as JSONValue, b[k] as JSONValue)) return false
  }
  return true
}

const isJsonRecordEqual = (a: Record<string, JSONValue>, b: Record<string, JSONValue>): boolean => {
  const ak = Object.keys(a)
  const bk = Object.keys(b)
  if (ak.length !== bk.length) return false
  const bSet = new Set(bk)
  for (const k of ak) {
    if (!bSet.has(k)) return false
    if (!isJsonValueEqual(a[k], b[k])) return false
  }
  return true
}

const isConflictError = (err: unknown): boolean => {
  if (!err || typeof err !== 'object') return false
  const rec = err as Record<string, unknown>
  if (rec.code === 'CONFLICT') return true
  const name = typeof rec.name === 'string' ? rec.name : ''
  if (name === 'RxError' && typeof rec.message === 'string' && rec.message.includes('CONFLICT')) return true
  const params = rec.parameters as unknown
  if (params && typeof params === 'object') {
    const p = params as Record<string, unknown>
    const writeError = p.writeError as unknown
    if (writeError && typeof writeError === 'object') {
      const status = (writeError as Record<string, unknown>).status
      if (status === 409) return true
    }
  }
  return false
}

const inferKind = (v: JSONValue): GraphColumnKind => {
  if (typeof v === 'string') return 'text'
  if (typeof v === 'number') return 'number'
  if (typeof v === 'boolean') return 'boolean'
  if (v === null) return 'text'
  return 'json'
}

const normalizeColumnId = (key: string): string => {
  const k = String(key || '').trim()
  if (!k) return ''
  if (k === 'id' || k === 'label' || k === 'type' || k === 'source' || k === 'target') return `prop:${k}`
  return k
}

const toRowDataForNode = (n: GraphNode): Record<string, JSONValue> => {
  const data: Record<string, JSONValue> = {
    id: toJsonValueForDb(n.id),
    label: toJsonValueForDb(n.label),
    type: toJsonValueForDb(n.type),
  }
  const props = n.properties || {}
  const sortedKeys = Object.keys(props).sort((a, b) => a.localeCompare(b))
  for (const k of sortedKeys) {
    const key = normalizeColumnId(k)
    if (!key) continue
    data[key] = toJsonValueForDb((props as Record<string, unknown>)[k])
  }
  return data
}

const toRowDataForEdge = (e: GraphEdge): Record<string, JSONValue> => {
  const data: Record<string, JSONValue> = {
    id: toJsonValueForDb(e.id),
    label: toJsonValueForDb(e.label),
    source: toJsonValueForDb(e.source),
    target: toJsonValueForDb(e.target),
  }
  const props = e.properties || {}
  const sortedKeys = Object.keys(props).sort((a, b) => a.localeCompare(b))
  for (const k of sortedKeys) {
    const key = normalizeColumnId(k)
    if (!key) continue
    data[key] = toJsonValueForDb((props as Record<string, unknown>)[k])
  }
  return data
}

const ensureColumnsForRowData = async (tableId: GraphTableId, rows: Array<Record<string, JSONValue>>): Promise<void> => {
  const { collections } = await getGraphTableDb()
  const now = Date.now()
  const known = await collections.columns.find({ selector: { tableId } }).exec()
  const existing = new Map<string, GraphColumnDoc>()
  for (const d of known) {
    const json = d.toJSON() as GraphColumnDoc
    existing.set(json.columnId, json)
  }

  const observed = new Map<string, GraphColumnKind>()
  for (const r of rows) {
    for (const [k, v] of Object.entries(r)) {
      if (k === 'id' || k === 'label' || k === 'type' || k === 'source' || k === 'target') continue
      const kind = inferKind(v)
      const prev = observed.get(k)
      if (!prev) {
        observed.set(k, kind)
        continue
      }
      if (prev === kind) continue
      observed.set(k, 'json')
    }
  }

  const maxOrder = Math.max(0, ...Array.from(existing.values()).map(c => c.order))
  let order = Math.ceil(maxOrder / GRAPH_TABLE_COLUMN_ORDER_STEP) * GRAPH_TABLE_COLUMN_ORDER_STEP
  const planned: GraphColumnDoc[] = []
  for (const [columnId, kind] of observed.entries()) {
    if (existing.has(columnId)) continue
    order += GRAPH_TABLE_COLUMN_ORDER_STEP
    planned.push({
      pk: pkOfColumn(tableId, columnId),
      tableId,
      columnId,
      name: columnId,
      kind,
      order,
      hidden: false,
      createdAtMs: now,
      updatedAtMs: now,
    })
  }
  if (planned.length === 0) return
  planned.sort((a, b) => a.order - b.order)
  for (const col of planned) {
    try {
      await collections.columns.insert(col)
    } catch (err) {
      if (isConflictError(err)) continue
      throw err
    }
  }
}

export const syncGraphDataToGraphTableDb = async (graph: GraphData | null): Promise<void> => {
  await withGraphTableDbWrite(async () => {
    await ensureGraphTableSeed()
    if (!graph) return
    const { collections } = await getGraphTableDb()
    const now = Date.now()

    const nodeRows = graph.nodes.map(toRowDataForNode)
    const edgeRows = graph.edges.map(toRowDataForEdge)

    await ensureColumnsForRowData('nodes', nodeRows)
    await ensureColumnsForRowData('edges', edgeRows)

    const existingNodes = await collections.rows.find({ selector: { tableId: 'nodes' } }).exec()
    const existingEdges = await collections.rows.find({ selector: { tableId: 'edges' } }).exec()
    const existingNodeIds = new Set(existingNodes.map(d => d.get('rowId')))
    const existingEdgeIds = new Set(existingEdges.map(d => d.get('rowId')))

    for (let i = 0; i < graph.nodes.length; i += 1) {
      const n = graph.nodes[i]
      const rowId = String(n.id)
      existingNodeIds.delete(rowId)
      const pk = pkOfRow('nodes', rowId)
      const doc = await collections.rows.findOne(pk).exec()
      const nextData = nodeRows[i]
      if (!doc) {
        await collections.rows.insert({
          pk,
          tableId: 'nodes',
          rowId,
          order: i + 1,
          data: nextData,
          createdAtMs: now,
          updatedAtMs: now,
        })
        continue
      }
      const prevOrder = Number(doc.get('order'))
      const prevData = doc.get('data') as unknown
      const prevDataRec = isPlainObject(prevData) ? (prevData as Record<string, JSONValue>) : {}
      const nextOrder = i + 1
      if (prevOrder === nextOrder && isJsonRecordEqual(prevDataRec, nextData)) continue
      await doc.incrementalPatch({ order: nextOrder, data: nextData, updatedAtMs: now })
    }

    for (let i = 0; i < graph.edges.length; i += 1) {
      const e = graph.edges[i]
      const rowId = String(e.id)
      existingEdgeIds.delete(rowId)
      const pk = pkOfRow('edges', rowId)
      const doc = await collections.rows.findOne(pk).exec()
      const nextData = edgeRows[i]
      if (!doc) {
        await collections.rows.insert({
          pk,
          tableId: 'edges',
          rowId,
          order: i + 1,
          data: nextData,
          createdAtMs: now,
          updatedAtMs: now,
        })
        continue
      }
      const prevOrder = Number(doc.get('order'))
      const prevData = doc.get('data') as unknown
      const prevDataRec = isPlainObject(prevData) ? (prevData as Record<string, JSONValue>) : {}
      const nextOrder = i + 1
      if (prevOrder === nextOrder && isJsonRecordEqual(prevDataRec, nextData)) continue
      await doc.incrementalPatch({ order: nextOrder, data: nextData, updatedAtMs: now })
    }

    for (const rowId of existingNodeIds) {
      const pk = pkOfRow('nodes', rowId)
      const doc = await collections.rows.findOne(pk).exec()
      if (doc) await doc.remove()
    }
    for (const rowId of existingEdgeIds) {
      const pk = pkOfRow('edges', rowId)
      const doc = await collections.rows.findOne(pk).exec()
      if (doc) await doc.remove()
    }
  })
}

export const updateGraphTableCell = async (
  tableId: GraphTableId,
  rowId: string,
  columnId: string,
  value: unknown,
): Promise<void> => {
  await withGraphTableDbWrite(async () => {
    const { collections } = await getGraphTableDb()
    const pk = pkOfRow(tableId, rowId)
    const doc = await collections.rows.findOne(pk).exec()
    if (!doc) return
    const raw = doc.toJSON() as GraphRowDoc
    const data = isPlainObject(raw.data) ? { ...(raw.data as Record<string, JSONValue>) } : {}
    data[columnId] = toJsonValueForDb(value)
    const prev = isPlainObject(raw.data) ? (raw.data as Record<string, JSONValue>) : {}
    if (isJsonRecordEqual(prev, data)) return
    await doc.incrementalPatch({ data, updatedAtMs: Date.now() })
  })
}

export const allocateNewRowId = async (tableId: GraphTableId): Promise<string> => {
  return withGraphTableDbWrite(async () => {
    const { collections } = await getGraphTableDb()
    const key = `counter:${tableId}`
    const now = Date.now()
    const doc = await collections.meta.findOne(key).exec()
    const prevValue = doc ? (doc.get('value') as unknown) : null
    const prev = typeof prevValue === 'number' && Number.isFinite(prevValue) ? Math.max(0, Math.floor(prevValue)) : 0
    const next = prev + 1
    if (!doc) {
      await collections.meta.insert({ key, value: next, updatedAtMs: now })
    } else {
      await doc.incrementalPatch({ value: next, updatedAtMs: now })
    }
    return tableId === 'nodes' ? `node-${next}` : `edge-${next}`
  })
}

export const createRowFromGraphEntity = async (tableId: GraphTableId, rowId: string, graph: GraphNode | GraphEdge): Promise<void> => {
  await withGraphTableDbWrite(async () => {
    const { collections } = await getGraphTableDb()
    const now = Date.now()
    const count = await collections.rows.find({ selector: { tableId } }).exec()
    const order = count.length + 1
    const data = tableId === 'nodes' ? toRowDataForNode(graph as GraphNode) : toRowDataForEdge(graph as GraphEdge)
    await ensureColumnsForRowData(tableId, [data])
    await collections.rows.insert({
      pk: pkOfRow(tableId, rowId),
      tableId,
      rowId,
      order,
      data,
      createdAtMs: now,
      updatedAtMs: now,
    })
  })
}

export const __debugGraphTableRowHash = (data: Record<string, JSONValue>): number => {
  try {
    return hashString32(JSON.stringify(data || {}))
  } catch {
    return 0
  }
}
