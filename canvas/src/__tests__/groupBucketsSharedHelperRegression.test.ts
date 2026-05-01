import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  finalizeGroupBucketMemberNodeIds,
  pushGroupBucketMember,
  readUpdatedBucketLayoutMeta,
} from '@/components/GraphCanvas/layout/groupBuckets'

export function testGroupBucketHelpersNormalizeMembersAndLayoutMeta() {
  const bucketsByKey = new Map<string, string[]>()
  pushGroupBucketMember(bucketsByKey, 'layer:source', 'b')
  pushGroupBucketMember(bucketsByKey, 'layer:source', 'a')
  pushGroupBucketMember(bucketsByKey, 'layer:source', 'a')
  const ids = finalizeGroupBucketMemberNodeIds(bucketsByKey.get('layer:source') || [])
  if (ids.join(',') !== 'a,b') {
    throw new Error(`expected group bucket helper to dedupe and sort ids, got ${ids.join(',')}`)
  }

  const meta = readUpdatedBucketLayoutMeta(undefined, {
    bucketValue: 2,
    explicitDepth: 5,
    xIndex: 1,
    yIndex: 3,
  })
  const merged = readUpdatedBucketLayoutMeta(meta, {
    bucketValue: 4,
    explicitDepth: 1,
    xIndex: 7,
    yIndex: 2,
  })
  if (merged.depth !== 5 || merged.xIndex !== 7 || merged.yIndex !== 3) {
    throw new Error(`expected group bucket helper to retain max layout metadata, got ${JSON.stringify(merged)}`)
  }
}

export function testGraphGroupsReuseSharedBucketHelpers() {
  const helperText = readFileSync(
    resolve(process.cwd(), 'src', 'components', 'GraphCanvas', 'layout', 'groupBuckets.ts'),
    'utf8',
  )
  const graphGroupsText = readFileSync(
    resolve(process.cwd(), 'src', 'components', 'GraphCanvas', 'layout', 'graphGroups.ts'),
    'utf8',
  )

  if (!helperText.includes('export function pushGroupBucketMember') || !helperText.includes('export function finalizeGroupBucketMemberNodeIds') || !helperText.includes('export function readUpdatedBucketLayoutMeta')) {
    throw new Error('expected shared group bucket helper file to expose member and layout normalization helpers')
  }
  if (!graphGroupsText.includes('pushGroupBucketMember') || !graphGroupsText.includes('finalizeGroupBucketMemberNodeIds') || !graphGroupsText.includes('readUpdatedBucketLayoutMeta')) {
    throw new Error('expected graphGroups derivation to reuse shared group bucket helpers instead of repeating bucket normalization logic inline')
  }
}
