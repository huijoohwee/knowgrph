import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testComposedPositionWritebackUpdatesSourceLayerKeysInGraphDataMetadata() {
  const writebackPath = resolve(process.cwd(), 'src', 'hooks', 'store', 'graph-data-slice', 'graphDataComposedSource.ts')
  const helperPath = resolve(process.cwd(), 'src', 'lib', 'graph', 'sourceLayers.ts')
  const writebackText = readFileSync(writebackPath, 'utf8')
  const helperText = readFileSync(helperPath, 'utf8')
  if (!writebackText.includes('updateGraphDataSourceLayerKeys({')) {
    throw new Error('expected composed position writeback to reuse the shared source-layer metadata key refresh helper')
  }
  if (!helperText.includes('export function updateGraphDataSourceLayerKeys(args:')) {
    throw new Error('expected source-layer metadata key refresh to be centralized in the shared sourceLayers helper')
  }
  if (!helperText.includes('export function readSourceLayerKeysFromGraphData(')) {
    throw new Error('expected source-layer metadata key reads to be centralized in the shared sourceLayers helper')
  }
}
