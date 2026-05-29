import {
  readFlowEditorRuntimeCacheEntry,
  writeFlowEditorRuntimeCacheEntry,
} from '@/components/FlowEditorCanvas/runtime/flowEditorRuntimeCache'
import { getCachedFlowEditorRenderGraph } from '@/components/FlowEditorCanvas/runtime/flowEditorRenderGraph'
import type { GraphData } from '@/lib/graph/types'

export function testFlowEditorRuntimeCachePreservesFalsyValues() {
  const cache = new Map<string, false | 0 | ''>()
  writeFlowEditorRuntimeCacheEntry(cache, 'false-value', false, 4)
  writeFlowEditorRuntimeCacheEntry(cache, 'zero-value', 0, 4)
  writeFlowEditorRuntimeCacheEntry(cache, 'empty-string-value', '', 4)

  if (readFlowEditorRuntimeCacheEntry(cache, 'false-value') !== false) {
    throw new Error('expected Flow Editor runtime cache to preserve false values')
  }
  if (readFlowEditorRuntimeCacheEntry(cache, 'zero-value') !== 0) {
    throw new Error('expected Flow Editor runtime cache to preserve zero values')
  }
  if (readFlowEditorRuntimeCacheEntry(cache, 'empty-string-value') !== '') {
    throw new Error('expected Flow Editor runtime cache to preserve empty-string values')
  }
  if (readFlowEditorRuntimeCacheEntry(cache, 'missing') !== null) {
    throw new Error('expected Flow Editor runtime cache misses to return null')
  }
}

export function testFlowEditorRuntimeCacheTouchesReadEntriesForLru() {
  const cache = new Map<string, number>()
  writeFlowEditorRuntimeCacheEntry(cache, 'a', 1, 2)
  writeFlowEditorRuntimeCacheEntry(cache, 'b', 2, 2)
  if (readFlowEditorRuntimeCacheEntry(cache, 'a') !== 1) {
    throw new Error('expected cache read to return the touched entry')
  }
  writeFlowEditorRuntimeCacheEntry(cache, 'c', 3, 2)

  if (cache.has('b')) {
    throw new Error('expected least-recently-used entry to be evicted after a read touch')
  }
  if (!cache.has('a') || !cache.has('c')) {
    throw new Error('expected recently touched and newest Flow Editor runtime cache entries to remain')
  }
}

export function testFlowEditorRenderGraphCacheReusesSemanticSummaries() {
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
  const first = getCachedFlowEditorRenderGraph({
    scope: 'test-flow-editor-render-graph-cache-reuse',
    graphData: graph,
    graphRevision: 1,
    preferCurrentGraphDataRefs: true,
  })
  const second = getCachedFlowEditorRenderGraph({
    scope: 'test-flow-editor-render-graph-cache-reuse',
    graphData: graph,
    graphRevision: 1,
    preferCurrentGraphDataRefs: true,
  })

  if (!first || !second) throw new Error('expected Flow Editor render-graph cache test to build lookups')
  if (first !== second) {
    throw new Error('expected Flow Editor render-graph cache to reuse the derived semantic summary object')
  }
  if (first.eligibleNodeIds !== second.eligibleNodeIds || first.nodeIdsByInnerId !== second.nodeIdsByInnerId) {
    throw new Error('expected Flow Editor render-graph cache to reuse eligibility and inner-id summaries')
  }
}

export function testFlowEditorRenderGraphCacheHonorsCurrentGraphRefs() {
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
  const first = getCachedFlowEditorRenderGraph({
    scope: 'test-flow-editor-render-graph-cache-current-refs',
    graphData: graphA,
    graphRevision: 7,
    preferCurrentGraphDataRefs: true,
  })
  const second = getCachedFlowEditorRenderGraph({
    scope: 'test-flow-editor-render-graph-cache-current-refs',
    graphData: graphB,
    graphRevision: 7,
    preferCurrentGraphDataRefs: true,
  })

  if (!first || !second) throw new Error('expected Flow Editor render-graph current-ref test to build lookups')
  if (first === second) {
    throw new Error('expected Flow Editor render-graph cache to rebuild when current graph refs change')
  }
  if (second.graph !== graphB || second.nodes !== graphB.nodes) {
    throw new Error('expected Flow Editor render-graph cache to expose current graph data refs after rebuild')
  }
}
