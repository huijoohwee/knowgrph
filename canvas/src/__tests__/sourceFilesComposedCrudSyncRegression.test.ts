import type { GraphData } from '@/lib/graph/types'
import { useGraphStore } from '@/hooks/useGraphStore'
import { applyComposedGraphFromSourceFiles } from '@/features/source-files/applyComposedGraphFromSourceFiles'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'

export async function testComposedUpdateNodeSyncsToSourceFileAndRecomposes() {
  const bootstrap = initJsdomHarness('<!doctype html><html><body></body></html>')
  try {
    const state = useGraphStore.getState()
    state.clearSourceFiles()
    state.setGraphData({ type: 'Graph', nodes: [], edges: [], metadata: {} } as unknown as GraphData)

    const g1: GraphData = {
      type: 'Graph',
      nodes: [{ id: 'n1', label: 'A', type: 'Thing', properties: {} }],
      edges: [],
      metadata: {},
    }

    state.addSourceFile({
      id: 'sf-1',
      name: 'a.md',
      text: 'a',
      enabled: true,
      status: 'parsed',
      parsedGraphData: g1,
      parsedTextHash: 'h1',
      parsedGraphRevision: 0,
      source: { kind: 'local', path: 'a.md' },
    })

    applyComposedGraphFromSourceFiles()
    const before = useGraphStore.getState()
    const beforeGraph = before.graphData
    if (!beforeGraph) throw new Error('expected composed graph data')
    const beforeKey = String(((beforeGraph.metadata || {}) as any).sourceLayerHash || '')
    if (!beforeKey) throw new Error('expected sourceLayerHash')

    before.updateNode('sf-1::n1', { label: 'A2' })

    const after = useGraphStore.getState()
    const file = after.sourceFiles.find(f => f.id === 'sf-1')
    const label = file?.parsedGraphData?.nodes?.find(n => n.id === 'n1')?.label
    if (label !== 'A2') throw new Error(`expected source file node label to update, got ${String(label)}`)
    if ((file?.parsedGraphRevision || 0) !== 1) throw new Error('expected parsedGraphRevision to increment')
    if (!String(file?.text || '').includes('flow:')) throw new Error('expected source file text to receive flow frontmatter writeback on composed update')
    if (!String(file?.text || '').includes('"A2"')) throw new Error('expected updated node label to persist into source file text')

    const afterGraph = after.graphData
    if (!afterGraph) throw new Error('expected composed graph data after update')
    const afterKey = String(((afterGraph.metadata || {}) as any).sourceLayerHash || '')
    if (afterKey === beforeKey) throw new Error('expected sourceLayerHash to change after composed CRUD update')
    const composedLabel = afterGraph.nodes.find(n => n.id === 'sf-1::n1')?.label
    if (composedLabel !== 'A2') throw new Error(`expected composed node label to update, got ${String(composedLabel)}`)
  } finally {
    await new Promise<void>(resolve => setTimeout(resolve, 0))
    bootstrap.restore()
  }
}

export async function testComposedAddNodePrefersActiveMarkdownDocumentSourceFile() {
  const bootstrap = initJsdomHarness('<!doctype html><html><body></body></html>')
  try {
    const state = useGraphStore.getState()
    state.clearSourceFiles()
    state.setGraphData({ type: 'Graph', nodes: [], edges: [], metadata: {} } as unknown as GraphData)

    const graphA: GraphData = {
      type: 'Graph',
      nodes: [{ id: 'a1', label: 'A', type: 'Thing', properties: {} }],
      edges: [],
      metadata: {},
    }
    const graphB: GraphData = {
      type: 'Graph',
      nodes: [{ id: 'b1', label: 'B', type: 'Thing', properties: {} }],
      edges: [],
      metadata: {},
    }

    state.addSourceFile({
      id: 'sf-a',
      name: 'a.md',
      text: 'a',
      enabled: true,
      status: 'parsed',
      parsedGraphData: graphA,
      parsedTextHash: 'ha',
      parsedGraphRevision: 0,
      source: { kind: 'local', path: 'workspace:/a.md' },
    })
    state.addSourceFile({
      id: 'sf-b',
      name: 'b.md',
      text: 'b',
      enabled: true,
      status: 'parsed',
      parsedGraphData: graphB,
      parsedTextHash: 'hb',
      parsedGraphRevision: 0,
      source: { kind: 'local', path: 'workspace:/b.md' },
    })

    applyComposedGraphFromSourceFiles()
    const composed = useGraphStore.getState()
    composed.setMarkdownDocument('workspace:/b.md', '---\ntitle: B\n---\n')
    useGraphStore.setState({ selectedNodeId: 'sf-a::a1' })

    composed.addNode({
      id: 'grabmaps-discovery',
      label: 'GrabMaps Chat Discovery Widget',
      type: 'GrabMapsDiscovery',
      x: 10,
      y: 20,
      properties: { geo: { lat: 1.29, lng: 103.85 } } as never,
    })

    const after = useGraphStore.getState()
    const sourceA = after.sourceFiles.find(f => f.id === 'sf-a')
    const sourceB = after.sourceFiles.find(f => f.id === 'sf-b')
    const inA = sourceA?.parsedGraphData?.nodes?.some(n => n.id === 'grabmaps-discovery')
    const inB = sourceB?.parsedGraphData?.nodes?.some(n => n.id === 'grabmaps-discovery')
    if (inA) throw new Error('expected composed addNode to avoid appending into the selected non-active markdown source file')
    if (!inB) throw new Error('expected composed addNode to append into the active markdown document source file')
    const composedNode = after.graphData?.nodes?.find(n => n.id === 'sf-b::grabmaps-discovery')
    if (!composedNode) throw new Error('expected recomposed graph to expose the new node under the active markdown source layer id')
  } finally {
    await new Promise<void>(resolve => setTimeout(resolve, 0))
    bootstrap.restore()
  }
}

export async function testComposedAddNodeSeedsActiveMarkdownDocumentWhenGraphMissing() {
  const bootstrap = initJsdomHarness('<!doctype html><html><body></body></html>')
  try {
    const state = useGraphStore.getState()
    state.clearSourceFiles()
    state.setGraphData({ type: 'Graph', nodes: [], edges: [], metadata: {} } as unknown as GraphData)

    const graphA: GraphData = {
      type: 'Graph',
      nodes: [{ id: 'a1', label: 'A', type: 'Thing', properties: {} }],
      edges: [],
      metadata: {},
    }

    state.addSourceFile({
      id: 'sf-a',
      name: 'a.md',
      text: '# A',
      enabled: true,
      status: 'parsed',
      parsedGraphData: graphA,
      parsedTextHash: 'ha',
      parsedGraphRevision: 0,
      source: { kind: 'local', path: 'workspace:/a.md' },
    })
    state.addSourceFile({
      id: 'sf-b',
      name: 'b.md',
      text: '---\ntitle: B\n---\n',
      enabled: true,
      status: 'idle',
      parsedGraphData: null,
      parsedTextHash: '',
      parsedGraphRevision: 0,
      source: { kind: 'local', path: 'workspace:/b.md' },
    })

    applyComposedGraphFromSourceFiles()
    const composed = useGraphStore.getState()
    composed.setMarkdownDocument('workspace:/b.md', '---\ntitle: B\n---\n')
    useGraphStore.setState({ selectedNodeId: 'sf-a::a1' })

    composed.addNode({
      id: 'grabmaps-discovery-b',
      label: 'GrabMaps Chat Discovery Widget',
      type: 'GrabMapsDiscovery',
      x: 10,
      y: 20,
      properties: { geo: { lat: 1.29, lng: 103.85 } } as never,
    })

    const after = useGraphStore.getState()
    const sourceA = after.sourceFiles.find(f => f.id === 'sf-a')
    const sourceB = after.sourceFiles.find(f => f.id === 'sf-b')
    const inA = sourceA?.parsedGraphData?.nodes?.some(n => n.id === 'grabmaps-discovery-b')
    const inB = sourceB?.parsedGraphData?.nodes?.some(n => n.id === 'grabmaps-discovery-b')
    if (inA) throw new Error('expected active markdown addNode to avoid non-active source file insertion')
    if (!inB) throw new Error('expected addNode to seed and append into active markdown source file when parsed graph is missing')
    if ((sourceB?.parsedGraphRevision || 0) < 1) throw new Error('expected active markdown source parsedGraphRevision to increment after seeded addNode')
    const composedNode = after.graphData?.nodes?.find(n => n.id === 'sf-b::grabmaps-discovery-b')
    if (!composedNode) throw new Error('expected recomposed graph to expose the seeded active markdown source node')
  } finally {
    await new Promise<void>(resolve => setTimeout(resolve, 0))
    bootstrap.restore()
  }
}

export async function testAddNodeSeedsActiveMarkdownDocumentWithoutPreexistingComposedGraph() {
  const bootstrap = initJsdomHarness('<!doctype html><html><body></body></html>')
  try {
    const state = useGraphStore.getState()
    state.clearSourceFiles()
    state.setGraphData({ type: 'Graph', nodes: [], edges: [], metadata: {} } as unknown as GraphData)

    state.addSourceFile({
      id: 'sf-b',
      name: 'b.md',
      text: '---\ntitle: B\n---\n',
      enabled: true,
      status: 'idle',
      parsedGraphData: null,
      parsedTextHash: '',
      parsedGraphRevision: 0,
      source: { kind: 'local', path: 'workspace:/b.md' },
    })

    const before = useGraphStore.getState()
    const fileBefore = before.sourceFiles.find(f => f.id === 'sf-b')
    if (fileBefore?.parsedGraphData) throw new Error('expected active markdown source file to start without parsed graph data')

    before.setMarkdownDocument('workspace:/b.md', '---\ntitle: B\n---\n')
    before.addNode({
      id: 'grabmaps-discovery-c',
      label: 'GrabMaps Chat Discovery Widget',
      type: 'GrabMapsDiscovery',
      x: 10,
      y: 20,
      properties: { geo: { lat: 1.29, lng: 103.85 } } as never,
    })

    const after = useGraphStore.getState()
    const sourceB = after.sourceFiles.find(f => f.id === 'sf-b')
    const inB = sourceB?.parsedGraphData?.nodes?.some(n => n.id === 'grabmaps-discovery-c')
    if (!inB) throw new Error('expected addNode to seed active markdown source file even when no composed graph existed yet')
    if ((sourceB?.parsedGraphRevision || 0) < 1) throw new Error('expected parsedGraphRevision increment after seeding active markdown source file')
    const composedNode = after.graphData?.nodes?.find(n => n.id === 'sf-b::grabmaps-discovery-c')
    if (!composedNode) throw new Error('expected graphData to recompose from seeded active markdown source file')
    if (!String(sourceB?.text || '').includes('flow:')) throw new Error('expected active markdown source text to receive frontmatter flow block writeback')
    if (!String(sourceB?.text || '').includes('GrabMaps Chat Discovery Widget')) throw new Error('expected active markdown source text to include newly appended widget node')
    if (String(after.markdownDocumentText || '') !== String(sourceB?.text || '')) throw new Error('expected active markdown editor text to stay in sync with source file text writeback')
  } finally {
    await new Promise<void>(resolve => setTimeout(resolve, 0))
    bootstrap.restore()
  }
}

export async function testComposedUpdateNodePreservesTypedFrontmatterEnvelopeWriteback() {
  const bootstrap = initJsdomHarness('<!doctype html><html><body></body></html>')
  try {
    const state = useGraphStore.getState()
    state.clearSourceFiles()
    state.setGraphData({ type: 'Graph', nodes: [], edges: [], metadata: {} } as unknown as GraphData)

    const typedGraph: GraphData = {
      type: 'Graph',
      nodes: [
        {
          id: 'w-text',
          label: 'Text Widget',
          type: 'TextGeneration',
          properties: {
            prompt: 'old prompt',
            stream: true,
            'frontmatter:handles': { target: ['prompt_in'], source: ['text_out'] },
            'frontmatter:widgetFields': [
              { fieldKey: 'prompt', fieldType: 'string', schemaPath: 'prompt' },
              { fieldKey: 'stream', fieldType: 'boolean', schemaPath: 'stream' },
            ],
          } as never,
        },
      ],
      edges: [],
      metadata: {
        frontmatterFlowSettings: {
          direction: 'LR',
          edgeType: 'bezier',
          computed: true,
          snapToGrid: true,
        },
      },
    }

    state.addSourceFile({
      id: 'sf-typed',
      name: 'typed.md',
      text: '---\ntitle: Typed\n---\n',
      enabled: true,
      status: 'parsed',
      parsedGraphData: typedGraph,
      parsedTextHash: 'typed-h1',
      parsedGraphRevision: 0,
      source: { kind: 'local', path: 'workspace:/typed.md' },
    })

    applyComposedGraphFromSourceFiles()
    const before = useGraphStore.getState()
    before.setMarkdownDocument('workspace:/typed.md', '---\ntitle: Typed\n---\n')
    before.updateNode('sf-typed::w-text', {
      properties: {
        ...(((typedGraph.nodes[0] || {}).properties || {}) as Record<string, unknown>),
        prompt: 'new prompt',
      } as never,
    })

    const after = useGraphStore.getState()
    const file = after.sourceFiles.find(f => f.id === 'sf-typed')
    const text = String(file?.text || '')
    if (!text.includes('prompt: {key: prompt, type: string, value: "new prompt"}')) {
      throw new Error('expected typed frontmatter prompt envelope writeback to preserve key/type/value')
    }
    if (!text.includes('stream: {key: stream, type: boolean, value: true}')) {
      throw new Error('expected typed frontmatter boolean envelope writeback to preserve field type')
    }
    if (!text.includes('id: {key: id, type: string, value: "w-text"}')) {
      throw new Error('expected typed frontmatter node id envelope writeback')
    }
    if (String(after.markdownDocumentText || '') !== text) {
      throw new Error('expected active markdown editor text to stay aligned with typed frontmatter writeback')
    }
  } finally {
    await new Promise<void>(resolve => setTimeout(resolve, 0))
    bootstrap.restore()
  }
}

export async function testComposedAddEdgeSyncsToSourceFileAndActiveMarkdownText() {
  const bootstrap = initJsdomHarness('<!doctype html><html><body></body></html>')
  try {
    const state = useGraphStore.getState()
    state.clearSourceFiles()
    state.setGraphData({ type: 'Graph', nodes: [], edges: [], metadata: {} } as unknown as GraphData)

    const graph: GraphData = {
      type: 'Graph',
      nodes: [
        { id: 'a', label: 'A', type: 'Thing', properties: { 'frontmatter:handles': { source: ['out'] } } as never },
        { id: 'b', label: 'B', type: 'Thing', properties: { 'frontmatter:handles': { target: ['in'] } } as never },
      ],
      edges: [],
      metadata: {},
    }

    state.addSourceFile({
      id: 'sf-edge',
      name: 'edge.md',
      text: '---\ntitle: Edge\n---\n',
      enabled: true,
      status: 'parsed',
      parsedGraphData: graph,
      parsedTextHash: 'edge-h1',
      parsedGraphRevision: 0,
      source: { kind: 'local', path: 'workspace:/edge.md' },
    })

    applyComposedGraphFromSourceFiles()
    const before = useGraphStore.getState()
    before.setMarkdownDocument('workspace:/edge.md', '---\ntitle: Edge\n---\n')
    before.addEdge({
      id: 'e1',
      source: 'sf-edge::a',
      target: 'sf-edge::b',
      label: 'out -> in',
      properties: {
        'flow:sourcePortKey': 'out',
        'flow:targetPortKey': 'in',
        animated: true,
      } as never,
    } as never)

    const after = useGraphStore.getState()
    const file = after.sourceFiles.find(f => f.id === 'sf-edge')
    const edge = file?.parsedGraphData?.edges?.find(e => String(e.id || '') === 'e1') || null
    if (!edge) throw new Error('expected composed addEdge to persist into source file parsed graph data')
    const text = String(file?.text || '')
    if (!text.includes('"source":"a","sourceHandle":"out","target":"b","targetHandle":"in"')) {
      throw new Error('expected edge frontmatter writeback to persist explicit sourceHandle/targetHandle')
    }
    if (String(after.markdownDocumentText || '') !== text) {
      throw new Error('expected active markdown editor text to stay aligned with edge writeback')
    }
  } finally {
    await new Promise<void>(resolve => setTimeout(resolve, 0))
    bootstrap.restore()
  }
}
