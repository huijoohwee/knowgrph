import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testGraphCanvasRootReusesSharedMergedNodeLookupHelper() {
  const helperText = readFileSync(
    resolve(process.cwd(), 'src', 'components', 'GraphCanvasRoot', 'utils', 'mergedNodeLookup.ts'),
    'utf8',
  )
  const graphRootText = readFileSync(
    resolve(process.cwd(), 'src', 'components', 'GraphCanvasRoot', 'GraphCanvasRootImpl.tsx'),
    'utf8',
  )
  const richMediaText = readFileSync(
    resolve(process.cwd(), 'src', 'components', 'GraphCanvasRoot', 'hooks', 'useRichMediaOverlays2d.ts'),
    'utf8',
  )

  if (
    !helperText.includes('export function readMergedGraphNodeLookup')
    || !helperText.includes('preferCurrentGraphDataRefs: true')
    || !helperText.includes('getCachedGraphLookup({')
  ) {
    throw new Error('expected GraphCanvasRoot merged node lookup helper to reuse the shared graph lookup cache before overlaying live simulation nodes')
  }
  if (!graphRootText.includes('readMergedGraphNodeLookup({')) {
    throw new Error('expected GraphCanvasRootImpl to reuse the shared merged node lookup helper for panel anchoring and graph block panel reads')
  }
  if (!richMediaText.includes('readMergedGraphNodeLookup({')) {
    throw new Error('expected GraphCanvasRoot rich media overlay hook to reuse the shared merged node lookup helper for live overlay anchoring')
  }
}
