import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { buildHierarchyDepthResolver, buildHierarchicalLeafMemberCollector } from '@/components/GraphCanvas/layout/hierarchicalGroupMembers'

export function testHierarchicalGroupMemberHelpersResolveDepthAndLeafMembers() {
  const computeDepth = buildHierarchyDepthResolver(
    new Map([
      ['child', 'root'],
      ['leaf', 'child'],
    ]),
  )
  const collectLeafMembers = buildHierarchicalLeafMemberCollector({
    getChildIds: id =>
      id === 'root'
        ? ['child']
        : id === 'child'
          ? ['leaf']
          : [],
    getDirectMemberIds: id =>
      id === 'root'
        ? ['a']
        : id === 'child'
          ? ['b']
          : id === 'leaf'
            ? ['c']
            : [],
  })

  if (computeDepth('root') !== 0 || computeDepth('child') !== 1 || computeDepth('leaf') !== 2) {
    throw new Error('expected shared hierarchy helper to compute parent-based depths consistently')
  }
  const rootLeaves = collectLeafMembers('root')
  if (rootLeaves.join(',') !== 'a,b,c') {
    throw new Error(`expected shared hierarchy helper to collect recursive leaf members, got ${rootLeaves.join(',')}`)
  }
}

export function testGroupDerivationPathsReuseHierarchicalHelpers() {
  const helperText = readFileSync(
    resolve(process.cwd(), 'src', 'components', 'GraphCanvas', 'layout', 'hierarchicalGroupMembers.ts'),
    'utf8',
  )
  const mermaidText = readFileSync(
    resolve(process.cwd(), 'src', 'components', 'GraphCanvas', 'layout', 'mermaidSubgraphGroups.ts'),
    'utf8',
  )
  const markdownText = readFileSync(
    resolve(process.cwd(), 'src', 'components', 'GraphCanvas', 'layout', 'markdownHeadingGroups.ts'),
    'utf8',
  )

  if (!helperText.includes('export function buildHierarchyDepthResolver') || !helperText.includes('export function buildHierarchicalLeafMemberCollector')) {
    throw new Error('expected shared hierarchy helper file to expose depth and leaf-member collectors')
  }
  if (!mermaidText.includes('buildHierarchyDepthResolver') || !mermaidText.includes('buildHierarchicalLeafMemberCollector')) {
    throw new Error('expected mermaid subgraph group derivation to reuse shared hierarchy helpers')
  }
  if (!markdownText.includes('buildHierarchyDepthResolver') || !markdownText.includes('buildHierarchicalLeafMemberCollector')) {
    throw new Error('expected markdown heading group derivation to reuse shared hierarchy helpers')
  }
}
