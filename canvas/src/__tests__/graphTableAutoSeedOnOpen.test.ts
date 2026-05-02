import fs from 'node:fs'
import path from 'node:path'

export function testGraphTableAutoSeedsWhenManualAndDbEmpty() {
  const filePath = path.resolve(process.cwd(), 'src', 'lib', 'graph-table', 'ui', 'GraphTableWorkspace.impl.tsx')
  const text = fs.readFileSync(filePath, { encoding: 'utf8' })
  if (!text.includes("canvasWorkspaceSyncMode === 'manual'")) {
    throw new Error('expected GraphTableWorkspace to handle manual sync mode explicitly')
  }
  if (!text.includes('initialCols.length === 0') || !text.includes('initialRows.length === 0')) {
    throw new Error('expected GraphTableWorkspace to detect empty DB and auto-seed')
  }
  const syncCalls = (text.match(/syncGraphDataToGraphTableDb\(syncGraphData\)/g) || []).length
  if (syncCalls !== 1) {
    throw new Error(`expected GraphTableWorkspace to keep a single empty-db auto-seed path, got ${syncCalls}`)
  }
  if (text.includes('columns.length > 0 || rows.length > 0')) {
    throw new Error('expected GraphTableWorkspace to avoid pre-hydration empty-state auto-seed churn')
  }
  if (!text.includes('syncGraphDataToGraphTableDb')) {
    throw new Error('expected GraphTableWorkspace to seed graph-table db from graph data when empty')
  }
}
