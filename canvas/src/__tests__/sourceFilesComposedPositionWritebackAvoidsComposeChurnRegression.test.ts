import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testComposedPositionWritebackUpdatesSourceLayerKeysInGraphDataMetadata() {
  const p = resolve(process.cwd(), 'src', 'hooks', 'store', 'graphDataSlice.ts')
  const text = readFileSync(p, 'utf8')
  const hasKeysImport = text.includes("buildSourceLayerKeys")
  const hasMetaUpdate = text.includes('sourceLayerHash') && text.includes('sourceLayerOrderHash')
  if (!hasKeysImport || !hasMetaUpdate) {
    throw new Error('expected composed position writeback to update source layer keys in graphData metadata')
  }
}

