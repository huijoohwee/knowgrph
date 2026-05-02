import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testSourceLayersMetadataHandlingStaysCentralized() {
  const helperPath = resolve(process.cwd(), 'src', 'lib', 'graph', 'sourceLayers.ts')
  const helperText = readFileSync(helperPath, 'utf8')

  if (!helperText.includes('function readSourceLayerGraphMetadata(')) {
    throw new Error('expected sourceLayers helper to centralize graph metadata coercion upstream')
  }
  if (!helperText.includes('const metadata = readSourceLayerGraphMetadata(graphData)')) {
    throw new Error('expected source-layer key reads to reuse the shared metadata coercion helper')
  }
  if (!helperText.includes('const metadata = readSourceLayerGraphMetadata(graph)')) {
    throw new Error('expected source-layer widget registry metadata reads to reuse the shared metadata coercion helper')
  }
  if (!helperText.includes('...readSourceLayerGraphMetadata(args.graphData),')) {
    throw new Error('expected source-layer key writeback to reuse the shared metadata coercion helper')
  }
  if (!helperText.includes('const baseMetadata = readSourceLayerGraphMetadata(base) as Record<string, JSONValue>')) {
    throw new Error('expected source-layer graph composition to reuse the shared metadata coercion helper')
  }
}
