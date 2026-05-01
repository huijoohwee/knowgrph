import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import type { GraphGroup } from '@/components/GraphCanvas/layout/graphGroupsTypes'
import { prepareGroupHierarchy } from '@/components/GraphCanvas/layout/groupHierarchyPrep'

export function testPrepareGroupHierarchyBuildsChildrenAndDirectMembers() {
  const groups: GraphGroup[] = [
    { id: 'root', label: 'root', source: 'userSubgraph', depth: 0, memberNodeIds: ['n1', 'n2', 'n3'], style: {} },
    { id: 'child', label: 'child', source: 'userSubgraph', depth: 1, parentGroupId: 'root', memberNodeIds: ['n2'], style: {} },
  ]
  const prepared = prepareGroupHierarchy({
    groups,
    isValidMemberNodeId: nodeId => ['n1', 'n2', 'n3'].includes(nodeId),
  })

  const childIds = prepared.childrenByGroupId.get('root') || []
  const directRootMembers = prepared.directMembersByGroupId.get('root') || []
  const topLevelGroupIds = prepared.topLevelGroupIds

  if (childIds.join(',') !== 'child') {
    throw new Error(`expected group hierarchy helper to register child groups, got ${childIds.join(',')}`)
  }
  if (directRootMembers.join(',') !== 'n1,n3') {
    throw new Error(`expected group hierarchy helper to subtract child members from direct members, got ${directRootMembers.join(',')}`)
  }
  if (topLevelGroupIds.join(',') !== 'root') {
    throw new Error(`expected group hierarchy helper to track top-level groups, got ${topLevelGroupIds.join(',')}`)
  }
}

export function testGroupGeometrySeedReusesGroupHierarchyPrepHelper() {
  const helperText = readFileSync(
    resolve(process.cwd(), 'src', 'components', 'GraphCanvas', 'layout', 'groupHierarchyPrep.ts'),
    'utf8',
  )
  const geometrySeedText = readFileSync(
    resolve(process.cwd(), 'src', 'components', 'GraphCanvas', 'layout', 'groupGeometrySeed.ts'),
    'utf8',
  )

  if (!helperText.includes('export function prepareGroupHierarchy')) {
    throw new Error('expected shared group hierarchy prep helper to be exported')
  }
  if (!geometrySeedText.includes('prepareGroupHierarchy({')) {
    throw new Error('expected groupGeometrySeed to reuse the shared group hierarchy prep helper instead of rebuilding hierarchy maps inline')
  }
}
