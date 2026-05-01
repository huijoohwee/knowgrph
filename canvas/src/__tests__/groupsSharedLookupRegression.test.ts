import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testGroupsLayerReusesSharedLookupWithCurrentGraphRefs() {
  const groupsText = readFileSync(
    resolve(process.cwd(), 'src', 'components', 'GraphCanvas', 'layers', 'groups.ts'),
    'utf8',
  )
  const lookupCacheText = readFileSync(
    resolve(process.cwd(), 'src', 'lib', 'graph', 'lookupCache.ts'),
    'utf8',
  )

  if (!groupsText.includes("cacheScope: 'graph-canvas-groups-display-nodes'") || !groupsText.includes('preferCurrentGraphDataRefs: true') || !groupsText.includes('getCachedGraphLookup({')) {
    throw new Error('expected groups layer to reuse the shared graph lookup helper with current graph references for live drag mutations')
  }
  if (!lookupCacheText.includes('preferCurrentGraphDataRefs?: boolean') || !lookupCacheText.includes('if (args.preferCurrentGraphDataRefs === true)')) {
    throw new Error('expected shared graph lookup cache to support rebinding to current graph object references for mutable consumers')
  }
}
