import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { getCachedStoryboardWidgetContainmentGroupLookup } from '@/components/StoryboardWidgetCanvas/runtime/storyboardWidgetRuntimeGroupLookup'
import type { FlowNativeScene } from '@/components/FlowCanvas/nativeRuntime'
import type { GraphGroup } from '@/components/GraphCanvas/layout/graphGroupsTypes'

const group = (id: string, depth: number, memberNodeIds: string[], source: GraphGroup['source'] = 'userSubgraph'): GraphGroup => ({
  id,
  label: id,
  source,
  depth,
  memberNodeIds,
  style: {},
})

export function testStoryboardWidgetContainmentGroupLookupCachesPerScene() {
  const scene = {
    nodes: [],
    edges: [],
    nodeById: new Map(),
    groups: [
      group('subgraph:outer', 1, ['n1', 'n2', 'n3']),
      group('subgraph:inner', 2, ['n1']),
      group('markdown-heading', 9, ['n1'], 'markdownHeading'),
    ],
    groupIdsByNodeId: new Map([['n1', ['subgraph:outer', 'subgraph:inner', 'markdown-heading']]]),
  } as unknown as FlowNativeScene

  const first = getCachedStoryboardWidgetContainmentGroupLookup(scene)
  const second = getCachedStoryboardWidgetContainmentGroupLookup(scene)
  if (!first || !second) throw new Error('expected Storyboard Widget containment group lookup to be available')
  if (first !== second) throw new Error('expected containment group lookup to be cached per runtime scene')
  if (first.groupById.size !== 3) throw new Error(`expected cached group map to include all groups, got ${first.groupById.size}`)
  if (first.readContainmentGroupForNode('n1')?.id !== 'subgraph:inner') {
    throw new Error('expected containment lookup to choose the deepest eligible containment group')
  }
}

export function testStoryboardWidgetRuntimeSceneReusesContainmentGroupLookup() {
  const runtimeSceneText = readFileSync(
    resolve(process.cwd(), 'src', 'components', 'StoryboardWidgetCanvas', 'runtime', 'useStoryboardWidgetRuntimeScene.ts'),
    'utf8',
  )
  if (!runtimeSceneText.includes('getCachedStoryboardWidgetContainmentGroupLookup(scene)?.readContainmentGroupForNode(id)')) {
    throw new Error('expected Storyboard Widget runtime scene to reuse the cached containment group lookup')
  }
  const start = runtimeSceneText.indexOf('const getLiveContainmentGroupAabbForNode')
  const end = runtimeSceneText.indexOf('const renderGraphDataOverrideRef', start)
  const callbackText = start >= 0 && end > start ? runtimeSceneText.slice(start, end) : ''
  if (!callbackText) throw new Error('expected runtime scene to expose getLiveContainmentGroupAabbForNode')
  if (callbackText.includes('new Map<string')) {
    throw new Error('expected containment group lookup callback not to rebuild group maps per node')
  }
}
