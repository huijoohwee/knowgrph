import { addRxPlugin, createRxDatabase, type RxCollection, type RxDatabase, type RxJsonSchema } from 'rxdb/plugins/core'
import { RxDBQueryBuilderPlugin } from 'rxdb/plugins/query-builder'
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie'
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory'
import type { GraphData, GraphEdge, GraphNode, JSONValue } from '@/lib/graph/types'

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
  const data: Record<string, JSONValue> = { id: n.id, label: n.label, type: n.type }
  const props = n.properties || {}
  for (const [k, v] of Object.entries(props)) {
    const key = normalizeColumnId(k)
    if (!key) continue
    data[key] = v
  }
  return data
}

const toRowDataForEdge = (e: GraphEdge): Record<string, JSONValue> => {
  const data: Record<string, JSONValue> = { id: e.id, label: e.label, source: e.source, target: e.target }
  const props = e.properties || {}
  for (const [k, v] of Object.entries(props)) {
    const key = normalizeColumnId(k)
    if (!key) continue
    data[key] = v
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
  let order = maxOrder
  for (const [columnId, kind] of observed.entries()) {
    if (existing.has(columnId)) continue
    order += 1
    await collections.columns.insert({
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
}

export const syncGraphDataToGraphTableDb = async (graph: GraphData | null): Promise<void> => {
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
    const rowId = n.id
    existingNodeIds.delete(rowId)
    const pk = pkOfRow('nodes', rowId)
    const doc = await collections.rows.findOne(pk).exec()
    const next: GraphRowDoc = {
      pk,
      tableId: 'nodes',
      rowId,
      order: i + 1,
      data: nodeRows[i],
      createdAtMs: doc ? doc.get('createdAtMs') : now,
      updatedAtMs: now,
    }
    if (!doc) {
      await collections.rows.insert(next)
    } else {
      await doc.incrementalPatch({ order: next.order, data: next.data, updatedAtMs: next.updatedAtMs })
    }
  }

  for (let i = 0; i < graph.edges.length; i += 1) {
    const e = graph.edges[i]
    const rowId = e.id
    existingEdgeIds.delete(rowId)
    const pk = pkOfRow('edges', rowId)
    const doc = await collections.rows.findOne(pk).exec()
    const next: GraphRowDoc = {
      pk,
      tableId: 'edges',
      rowId,
      order: i + 1,
      data: edgeRows[i],
      createdAtMs: doc ? doc.get('createdAtMs') : now,
      updatedAtMs: now,
    }
    if (!doc) {
      await collections.rows.insert(next)
    } else {
      await doc.incrementalPatch({ order: next.order, data: next.data, updatedAtMs: next.updatedAtMs })
    }
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
}

export const updateGraphTableCell = async (
  tableId: GraphTableId,
  rowId: string,
  columnId: string,
  value: unknown,
): Promise<void> => {
  const { collections } = await getGraphTableDb()
  const pk = pkOfRow(tableId, rowId)
  const doc = await collections.rows.findOne(pk).exec()
  if (!doc) return
  const raw = doc.toJSON() as GraphRowDoc
  const data = isPlainObject(raw.data) ? { ...(raw.data as Record<string, JSONValue>) } : {}
  data[columnId] = value as JSONValue
  await doc.incrementalPatch({ data, updatedAtMs: Date.now() })
}

export const allocateNewRowId = async (tableId: GraphTableId): Promise<string> => {
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
}

export const createRowFromGraphEntity = async (tableId: GraphTableId, rowId: string, graph: GraphNode | GraphEdge): Promise<void> => {
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
}
