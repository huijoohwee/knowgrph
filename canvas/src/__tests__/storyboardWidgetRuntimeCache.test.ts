import {
  readStoryboardWidgetRuntimeCacheEntry,
  writeStoryboardWidgetRuntimeCacheEntry,
} from '@/components/StoryboardWidgetCanvas/runtime/storyboardWidgetRuntimeCache'
import { getCachedStoryboardWidgetRenderGraph } from '@/components/StoryboardWidgetCanvas/runtime/storyboardWidgetRenderGraph'
import type { GraphData } from '@/lib/graph/types'

export function testStoryboardWidgetRuntimeCachePreservesFalsyValues() {
  const cache = new Map<string, false | 0 | ''>()
  writeStoryboardWidgetRuntimeCacheEntry(cache, 'false-value', false, 4)
  writeStoryboardWidgetRuntimeCacheEntry(cache, 'zero-value', 0, 4)
  writeStoryboardWidgetRuntimeCacheEntry(cache, 'empty-string-value', '', 4)

  if (readStoryboardWidgetRuntimeCacheEntry(cache, 'false-value') !== false) {
    throw new Error('expected Storyboard Widget runtime cache to preserve false values')
  }
  if (readStoryboardWidgetRuntimeCacheEntry(cache, 'zero-value') !== 0) {
    throw new Error('expected Storyboard Widget runtime cache to preserve zero values')
  }
  if (readStoryboardWidgetRuntimeCacheEntry(cache, 'empty-string-value') !== '') {
    throw new Error('expected Storyboard Widget runtime cache to preserve empty-string values')
  }
  if (readStoryboardWidgetRuntimeCacheEntry(cache, 'missing') !== null) {
    throw new Error('expected Storyboard Widget runtime cache misses to return null')
  }
}

export function testStoryboardWidgetRuntimeCacheTouchesReadEntriesForLru() {
  const cache = new Map<string, number>()
  writeStoryboardWidgetRuntimeCacheEntry(cache, 'a', 1, 2)
  writeStoryboardWidgetRuntimeCacheEntry(cache, 'b', 2, 2)
  if (readStoryboardWidgetRuntimeCacheEntry(cache, 'a') !== 1) {
    throw new Error('expected cache read to return the touched entry')
  }
  writeStoryboardWidgetRuntimeCacheEntry(cache, 'c', 3, 2)

  if (cache.has('b')) {
    throw new Error('expected least-recently-used entry to be evicted after a read touch')
  }
  if (!cache.has('a') || !cache.has('c')) {
    throw new Error('expected recently touched and newest Storyboard Widget runtime cache entries to remain')
  }
}

export function testStoryboardWidgetRenderGraphCacheReusesSemanticSummaries() {
  const graph: GraphData = {
    type: 'graph',
    nodes: [
      { id: 'outer::agent', label: 'Agent', type: 'task', properties: {} },
      { id: 'outer::driver', label: 'Driver', type: 'metric', properties: {} },
    ],
    edges: [
      { id: 'e1', source: 'outer::driver', target: 'outer::agent', label: '', type: 'depends_on', properties: {} },
    ],
  }
  const first = getCachedStoryboardWidgetRenderGraph({
    scope: 'test-storyboard-widget-render-graph-cache-reuse',
    graphData: graph,
    graphRevision: 1,
    preferCurrentGraphDataRefs: true,
  })
  const second = getCachedStoryboardWidgetRenderGraph({
    scope: 'test-storyboard-widget-render-graph-cache-reuse',
    graphData: graph,
    graphRevision: 1,
    preferCurrentGraphDataRefs: true,
  })

  if (!first || !second) throw new Error('expected Storyboard Widget render-graph cache test to build lookups')
  if (first !== second) {
    throw new Error('expected Storyboard Widget render-graph cache to reuse the derived semantic summary object')
  }
  if (first.eligibleNodeIds !== second.eligibleNodeIds || first.nodeIdsByInnerId !== second.nodeIdsByInnerId) {
    throw new Error('expected Storyboard Widget render-graph cache to reuse eligibility and inner-id summaries')
  }
}

export function testStoryboardWidgetRenderGraphCacheHonorsCurrentGraphRefs() {
  const graphA: GraphData = {
    type: 'graph',
    nodes: [{ id: 'outer::agent', label: 'Agent A', type: 'task', properties: {} }],
    edges: [],
  }
  const graphB: GraphData = {
    type: 'graph',
    nodes: [{ id: 'outer::agent', label: 'Agent B', type: 'task', properties: {} }],
    edges: [],
  }
  const first = getCachedStoryboardWidgetRenderGraph({
    scope: 'test-storyboard-widget-render-graph-cache-current-refs',
    graphData: graphA,
    graphRevision: 7,
    preferCurrentGraphDataRefs: true,
  })
  const second = getCachedStoryboardWidgetRenderGraph({
    scope: 'test-storyboard-widget-render-graph-cache-current-refs',
    graphData: graphB,
    graphRevision: 7,
    preferCurrentGraphDataRefs: true,
  })

  if (!first || !second) throw new Error('expected Storyboard Widget render-graph current-ref test to build lookups')
  if (first === second) {
    throw new Error('expected Storyboard Widget render-graph cache to rebuild when current graph refs change')
  }
  if (second.graph !== graphB || second.nodes !== graphB.nodes) {
    throw new Error('expected Storyboard Widget render-graph cache to expose current graph data refs after rebuild')
  }
}
