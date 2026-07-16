import type { GraphData } from '@/lib/graph/types'
import { buildGraphDocumentMetaKey, buildGraphMetaKey, buildGraphMetaKeyIgnoringPending, readBaselineGraphMetaKey } from '@/lib/graph/graphMetaKey'
import { buildActive2dZoomViewKey } from '@/lib/canvas/active-2d-zoom-view-key'
import { defaultSchema } from '@/lib/graph/schema'

export function testGraphMetaKeyIgnoringPendingStaysStableAcrossPendingFlag() {
  const pending: GraphData = {
    type: 'Graph',
    context: 't',
    metadata: { kind: 'keyword', source: 'doc:1', sourceLayerHash: 'h', pending: true },
    nodes: [],
    edges: [],
  }
  const ready: GraphData = {
    ...pending,
    metadata: { ...(pending.metadata as Record<string, unknown>), pending: false },
  }

  const a = buildGraphMetaKey(pending)
  const b = buildGraphMetaKey(ready)
  if (a === b) throw new Error(`expected buildGraphMetaKey to differ across pending flag, got ${JSON.stringify({ a, b })}`)

  const sa = buildGraphMetaKeyIgnoringPending(pending)
  const sb = buildGraphMetaKeyIgnoringPending(ready)
  if (sa !== sb) throw new Error(`expected buildGraphMetaKeyIgnoringPending to match, got ${JSON.stringify({ sa, sb })}`)
}

export function testGraphDocumentMetaKeyStaysStableAcrossSourceRevisions() {
  const first: GraphData = {
    type: 'Graph',
    context: 't',
    metadata: { kind: 'frontmatter-flow', source: 'markdown:workspace.md', sourceLayerHash: 'revision-a' },
    nodes: [],
    edges: [],
  }
  const second: GraphData = {
    ...first,
    metadata: { ...(first.metadata as Record<string, unknown>), sourceLayerHash: 'revision-b' },
  }
  const firstKey = buildGraphDocumentMetaKey(first)
  const secondKey = buildGraphDocumentMetaKey(second)
  if (firstKey !== secondKey || firstKey !== 'frontmatter-flow:markdown:workspace.md') {
    throw new Error(`expected document view-state key to ignore source revision, got ${JSON.stringify({ firstKey, secondKey })}`)
  }
}

export function testActive2dZoomViewKeyIgnoresPendingFlag() {
  const base: Omit<GraphData, 'metadata'> & { metadata: Record<string, unknown> } = {
    type: 'Graph',
    context: 't',
    metadata: { kind: 'keyword', source: 'doc:1', sourceLayerHash: 'h' },
    nodes: [],
    edges: [],
  }
  const pending = { ...base, metadata: { ...base.metadata, pending: true } } as unknown as GraphData
  const ready = { ...base, metadata: { ...base.metadata, pending: false } } as unknown as GraphData

  const k1 = buildActive2dZoomViewKey({
    canvasRenderMode: '2d',
    canvas2dRenderer: 'flow',
    schema: defaultSchema,
    graphData: pending,
    documentSemanticMode: 'keyword',
    frontmatterModeEnabled: false,
    documentStructureBaselineLock: false,
    renderMediaAsNodes: false,
    mediaPanelDensity: 'default',
    collapsedGroupIds: [],
  })
  const k2 = buildActive2dZoomViewKey({
    canvasRenderMode: '2d',
    canvas2dRenderer: 'flow',
    schema: defaultSchema,
    graphData: ready,
    documentSemanticMode: 'keyword',
    frontmatterModeEnabled: false,
    documentStructureBaselineLock: false,
    renderMediaAsNodes: false,
    mediaPanelDensity: 'default',
    collapsedGroupIds: [],
  })

  if (!k1 || !k2) throw new Error('expected zoom view keys')
  if (k1 !== k2) throw new Error(`expected zoom view key to ignore pending flag, got ${JSON.stringify({ k1, k2 })}`)
}

export function testStoryboardActive2dZoomViewKeyStaysStableAcrossSourceRevisions() {
  const first: GraphData = {
    type: 'Graph',
    context: 'frontmatter-flow',
    metadata: { kind: 'frontmatter-flow', source: 'markdown:workspace.md', sourceLayerHash: 'revision-a' },
    nodes: [],
    edges: [],
  }
  const second: GraphData = {
    ...first,
    metadata: { ...(first.metadata as Record<string, unknown>), sourceLayerHash: 'revision-b' },
  }
  const build = (canvas2dRenderer: 'storyboard' | 'flow', graphData: GraphData) => buildActive2dZoomViewKey({
    canvasRenderMode: '2d',
    canvas2dRenderer,
    schema: defaultSchema,
    graphData,
    documentSemanticMode: 'document',
    frontmatterModeEnabled: true,
    documentStructureBaselineLock: false,
    renderMediaAsNodes: false,
    mediaPanelDensity: 'default',
    collapsedGroupIds: [],
  })
  const storyboardFirst = build('storyboard', first)
  const storyboardSecond = build('storyboard', second)
  if (!storyboardFirst || storyboardFirst !== storyboardSecond) {
    throw new Error(`expected Storyboard viewport identity to survive same-document source publication, got ${JSON.stringify({ storyboardFirst, storyboardSecond })}`)
  }
  const flowFirst = build('flow', first)
  const flowSecond = build('flow', second)
  if (!flowFirst || !flowSecond || flowFirst === flowSecond) {
    throw new Error('expected non-Storyboard renderers to retain source-revision isolation')
  }
}

export function testBaselineGraphMetaKeyUsesMetadataOverrideBeforeFallback() {
  const graph: GraphData = {
    type: 'Graph',
    context: 't',
    metadata: { baselineGraphMetaKey: ' baseline:doc:1 ' },
    nodes: [],
    edges: [],
  }
  const key = readBaselineGraphMetaKey(graph, 'fallback:key')
  if (key !== 'baseline:doc:1') {
    throw new Error(`expected baseline graph meta key override to trim and win over fallback, got ${JSON.stringify({ key })}`)
  }
}

export function testBaselineGraphMetaKeyFallsBackWhenOverrideMissing() {
  const graph: GraphData = {
    type: 'Graph',
    context: 't',
    metadata: { kind: 'keyword' },
    nodes: [],
    edges: [],
  }
  const key = readBaselineGraphMetaKey(graph, 'fallback:key')
  if (key !== 'fallback:key') {
    throw new Error(`expected baseline graph meta key to fall back when override is missing, got ${JSON.stringify({ key })}`)
  }
}
