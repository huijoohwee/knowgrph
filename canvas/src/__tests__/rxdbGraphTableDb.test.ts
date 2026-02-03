import type { GraphData } from '@/lib/graph/types'
import {
  allocateNewRowId,
  createRowFromGraphEntity,
  ensureGraphTableSeed,
  getGraphTableDb,
  syncGraphDataToGraphTableDb,
  updateGraphTableCell,
} from '@/features/graph-table-db/graphTableDb'

export async function testGraphTableDbSeedsBaseTablesAndColumns() {
  await ensureGraphTableSeed()
  const { collections } = await getGraphTableDb()

  const tables = await collections.tables.find().exec()
  const ids = new Set(tables.map(t => t.get('id')))
  if (!ids.has('nodes') || !ids.has('edges')) {
    throw new Error('expected nodes and edges tables to exist')
  }

  const nodeCols = await collections.columns.find({ selector: { tableId: 'nodes' } }).exec()
  const nodeColIds = new Set(nodeCols.map(c => c.get('columnId')))
  for (const base of ['id', 'label', 'type']) {
    if (!nodeColIds.has(base)) throw new Error(`missing base node column: ${base}`)
  }

  const edgeCols = await collections.columns.find({ selector: { tableId: 'edges' } }).exec()
  const edgeColIds = new Set(edgeCols.map(c => c.get('columnId')))
  for (const base of ['id', 'label', 'source', 'target']) {
    if (!edgeColIds.has(base)) throw new Error(`missing base edge column: ${base}`)
  }
}

export async function testGraphTableDbSyncsGraphAndInfersPropertyColumns() {
  const graph: GraphData = {
    type: 'Graph',
    nodes: [{ id: 'n1', type: 'Person', label: 'Alice', properties: { age: 3 } }],
    edges: [{ id: 'e1', source: 'n1', target: 'n1', label: 'self', properties: { weight: 1 } }],
  }

  await syncGraphDataToGraphTableDb(graph)
  const { collections } = await getGraphTableDb()

  const nodeAgeCol = await collections.columns.findOne('nodes:age').exec()
  if (!nodeAgeCol) throw new Error('expected inferred nodes:age column to be created')

  const edgeWeightCol = await collections.columns.findOne('edges:weight').exec()
  if (!edgeWeightCol) throw new Error('expected inferred edges:weight column to be created')

  const nodeRow = await collections.rows.findOne('nodes:n1').exec()
  if (!nodeRow) throw new Error('expected nodes:n1 row to exist')
  const nodeJson = nodeRow.toJSON() as { data?: Record<string, unknown> }
  if (!nodeJson.data || nodeJson.data.age !== 3) {
    throw new Error('expected nodes:n1 to contain age=3')
  }
}

export async function testGraphTableDbUpdatesCellValues() {
  const graph: GraphData = {
    type: 'Graph',
    nodes: [{ id: 'n1', type: 'Person', label: 'Alice', properties: { age: 3 } }],
    edges: [],
  }
  await syncGraphDataToGraphTableDb(graph)

  await updateGraphTableCell('nodes', 'n1', 'age', 4)
  const { collections } = await getGraphTableDb()
  const row = await collections.rows.findOne('nodes:n1').exec()
  if (!row) throw new Error('expected nodes:n1 row to exist after update')
  const json = row.toJSON() as { data?: Record<string, unknown> }
  if (!json.data || json.data.age !== 4) {
    throw new Error('expected nodes:n1 age to update to 4')
  }
}

export async function testGraphTableDbAllocatesAndCreatesRows() {
  await ensureGraphTableSeed()
  const nodeId = await allocateNewRowId('nodes')
  await createRowFromGraphEntity('nodes', nodeId, { id: nodeId, label: nodeId, type: 'Entity', properties: {} })
  const { collections } = await getGraphTableDb()
  const row = await collections.rows.findOne(`nodes:${nodeId}`).exec()
  if (!row) throw new Error('expected newly created node row to exist')
}

