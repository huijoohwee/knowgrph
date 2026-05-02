import type { GraphData } from '@/lib/graph/types'
import {
  __resetGraphTableDbForTests,
  allocateNewRowId,
  createRowFromGraphEntity,
  ensureGraphTableSeed,
  getGraphTableDb,
  syncGraphDataToGraphTableDb,
  updateGraphTableCell,
  warmGraphTableDb,
} from '@/features/graph-table-db/graphTableDb'
import { collapsedGroupNodeIdFor, deriveGraphDataWithGroupCollapse } from '@/components/GraphCanvas/viewDerivation'

const resetGraphTableDb = async () => {
  await __resetGraphTableDbForTests()
}

export async function testGraphTableDbSeedsBaseTablesAndColumns() {
  await resetGraphTableDb()
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
  await resetGraphTableDb()
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

export async function testGraphTableDbInfersAndUpgradesDateColumns() {
  await resetGraphTableDb()
  const graph1: GraphData = {
    type: 'Graph',
    nodes: [{ id: 'n1', type: 'Person', label: 'Alice', properties: { created: 'hello' } }],
    edges: [],
  }
  await syncGraphDataToGraphTableDb(graph1)
  const { collections } = await getGraphTableDb()
  const col1 = await collections.columns.findOne('nodes:created').exec()
  if (!col1) throw new Error('expected nodes:created column to exist')
  if (col1.get('kind') !== 'text') throw new Error('expected nodes:created kind to start as text')

  const graph2: GraphData = {
    type: 'Graph',
    nodes: [{ id: 'n1', type: 'Person', label: 'Alice', properties: { created: '2026-02-17' } }],
    edges: [],
  }
  await syncGraphDataToGraphTableDb(graph2)
  const col2 = await collections.columns.findOne('nodes:created').exec()
  if (!col2) throw new Error('expected nodes:created column to still exist')
  if (col2.get('kind') !== 'date') throw new Error('expected nodes:created kind to upgrade to date')
}

export async function testGraphTableDbConcurrentSyncDoesNotConflict() {
  await resetGraphTableDb()
  const graph: GraphData = {
    type: 'Graph',
    nodes: [{ id: 'n1', type: 'Entity', label: 'Node', properties: { isMermaidFrontmatter: true } }],
    edges: [],
  }
  await Promise.all([syncGraphDataToGraphTableDb(graph), syncGraphDataToGraphTableDb(graph)])
  const { collections } = await getGraphTableDb()
  const col = await collections.columns.findOne('nodes:isMermaidFrontmatter').exec()
  if (!col) throw new Error('expected concurrent sync to create column without conflicts')
}

export async function testGraphTableDbWarmAndSyncDoNotConflict() {
  await resetGraphTableDb()
  const graph: GraphData = {
    type: 'Graph',
    nodes: [{ id: 'n1', type: 'Entity', label: 'Node', properties: { widgetMode: 'active' } }],
    edges: [],
  }
  await Promise.all([warmGraphTableDb(), syncGraphDataToGraphTableDb(graph)])
  const { collections } = await getGraphTableDb()
  const table = await collections.tables.findOne('nodes').exec()
  if (!table) throw new Error('expected nodes table to exist after concurrent warm and sync')
  const row = await collections.rows.findOne('nodes:n1').exec()
  if (!row) throw new Error('expected nodes:n1 row to exist after concurrent warm and sync')
}

export async function testGraphTableDbNoopSyncDoesNotRewriteRows() {
  await resetGraphTableDb()
  const graph: GraphData = {
    type: 'Graph',
    nodes: [{ id: 'n1', type: 'Person', label: 'Alice', properties: { age: 3 } }],
    edges: [],
  }
  await syncGraphDataToGraphTableDb(graph)
  const { collections } = await getGraphTableDb()
  const row1 = await collections.rows.findOne('nodes:n1').exec()
  if (!row1) throw new Error('expected nodes:n1 to exist')
  const updatedAt1 = Number(row1.get('updatedAtMs'))
  await new Promise(resolve => setTimeout(resolve, 2))
  await syncGraphDataToGraphTableDb(graph)
  const row2 = await collections.rows.findOne('nodes:n1').exec()
  if (!row2) throw new Error('expected nodes:n1 to exist after noop sync')
  const updatedAt2 = Number(row2.get('updatedAtMs'))
  if (updatedAt2 !== updatedAt1) {
    throw new Error('expected noop sync to avoid rewriting unchanged rows')
  }
}

export async function testGraphTableDbUpdatesCellValues() {
  await resetGraphTableDb()
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
  await resetGraphTableDb()
  await ensureGraphTableSeed()
  const nodeId = await allocateNewRowId('nodes')
  await createRowFromGraphEntity('nodes', nodeId, { id: nodeId, label: nodeId, type: 'Entity', properties: {} })
  const { collections } = await getGraphTableDb()
  const row = await collections.rows.findOne(`nodes:${nodeId}`).exec()
  if (!row) throw new Error('expected newly created node row to exist')
}

export async function testGraphTableDbSyncsCollapsedGraphViewRows() {
  await resetGraphTableDb()
  const graph: GraphData = {
    type: 'Graph',
    nodes: [
      { id: 'a', type: 'Entity', label: 'A', properties: { 'visual:community': 0 } },
      { id: 'b', type: 'Entity', label: 'B', properties: { 'visual:community': 0 } },
      { id: 'c', type: 'Entity', label: 'C', properties: { 'visual:community': 1 } },
    ],
    edges: [{ id: 'e1', source: 'a', target: 'c', label: 'rel', properties: {} }],
  }

  const collapsed = deriveGraphDataWithGroupCollapse({ graphData: graph, collapsedGroupIds: ['community:0'] })
  await syncGraphDataToGraphTableDb(collapsed)

  const { collections } = await getGraphTableDb()
  const rows = await collections.rows.find({ selector: { tableId: 'nodes' } }).exec()
  const ids = new Set(rows.map(r => r.get('rowId')))
  const groupNodeId = collapsedGroupNodeIdFor('community:0')
  if (!ids.has(groupNodeId)) throw new Error('expected collapsed group node to be present in nodes table')
  if (ids.has('a') || ids.has('b')) throw new Error('expected collapsed member nodes to be absent from nodes table')
  if (!ids.has('c')) throw new Error('expected non-member node to remain present in nodes table')
}
