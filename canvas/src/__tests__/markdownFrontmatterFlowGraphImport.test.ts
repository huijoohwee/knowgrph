import { tryParseMarkdownFrontmatterFlowGraph } from '@/features/parsers/markdownFrontmatterFlowGraph'
import { FLOW_NODE_QUICK_EDITOR_REGISTRY_METADATA_KEY } from '@/lib/config'
import { FLOW_EDGE_SOURCE_PORT_KEY, FLOW_EDGE_TARGET_PORT_KEY } from '@/lib/graph/flowPorts'
import { KG_SUBGRAPHS_KEY } from '@/lib/graph/subgraphs'

export function testMarkdownFrontmatterFlowGraphImportsNodesEdgesAndRegistry() {
  const md = [
    '---',
    'meta:',
    '  id: demo-flow-001',
    'nodes:',
    '  - id: NODE_A',
    '    type: Source',
    '    label: "A"',
    '    category: source',
    '    pos: { x: 40, y: 80 }',
    '    inputs: []',
    '    outputs:',
    '      - port: out_1',
    '        type: STRING',
    '  - id: NODE_B',
    '    type: Sink',
    '    label: "B"',
    '    category: output',
    '    pos: { x: 240, y: 80 }',
    '    visual: { zIndex: 9, opacity: 0.5, width: 420, height: 180 }',
    '    inputs:',
    '      - port: in_1',
    '        type: STRING',
    '        from: NODE_A.out_1',
    '    outputs: []',
    'connections:',
    '  - { id: e01, from_node: NODE_A, from_port: out_1, to_node: NODE_B, to_port: in_1, type: STRING }',
    'socket_types:',
    '  STRING: { color: "#AED6F1", accepts: [STRING] }',
    '---',
    '',
    '# Demo',
  ].join('\n')

  const res = tryParseMarkdownFrontmatterFlowGraph('demo.md', md)
  if (!res) throw new Error('expected a frontmatter flow graph parse result')
  if ((res.warnings || []).length !== 0) throw new Error(`expected no warnings, got: ${(res.warnings || []).join('; ')}`)
  const g = res.graphData
  if (g.context !== 'frontmatter-flow') throw new Error('expected frontmatter-flow context')
  if (g.nodes.length !== 2) throw new Error(`expected 2 nodes, got ${g.nodes.length}`)
  if (g.edges.length !== 1) throw new Error(`expected 1 edge, got ${g.edges.length}`)

  const a = g.nodes.find(n => n.id === 'NODE_A')
  const b = g.nodes.find(n => n.id === 'NODE_B')
  if (!a || !b) throw new Error('expected NODE_A and NODE_B')
  if (a.x !== 40 || a.y !== 80) throw new Error('expected NODE_A x/y from pos')
  if (b.x !== 240 || b.y !== 80) throw new Error('expected NODE_B x/y from pos')
  if ((a.properties as Record<string, unknown>)['visual:layer'] !== 'source') throw new Error('expected source visual:layer=source')
  if ((b.properties as Record<string, unknown>)['visual:layer'] !== 'output') throw new Error('expected output visual:layer=output')
  if ((a.properties as Record<string, unknown>)['visual:depth'] !== 0) throw new Error('expected source visual:depth=0')
  if ((b.properties as Record<string, unknown>)['visual:depth'] !== 7) throw new Error('expected output visual:depth=7')
  if ((b.properties as Record<string, unknown>)['visual:zIndex'] !== 9) throw new Error('expected visual:zIndex override')
  if ((b.properties as Record<string, unknown>)['visual:opacity'] !== 0.5) throw new Error('expected visual:opacity override')
  if ((b.properties as Record<string, unknown>)['visual:width'] !== 420) throw new Error('expected visual:width override')
  if ((b.properties as Record<string, unknown>)['visual:height'] !== 180) throw new Error('expected visual:height override')
  const portTypes = (b.properties as Record<string, unknown>)['flow:portTypes'] as unknown
  if (!portTypes || typeof portTypes !== 'object') throw new Error('expected flow:portTypes on node')

  const e = g.edges[0]
  const props = (e.properties || {}) as Record<string, unknown>
  if (props[FLOW_EDGE_SOURCE_PORT_KEY] !== 'out_1') throw new Error('expected flow:sourcePortKey=out_1')
  if (props[FLOW_EDGE_TARGET_PORT_KEY] !== 'in_1') throw new Error('expected flow:targetPortKey=in_1')

  const meta = (g.metadata || {}) as Record<string, unknown>
  const registry = meta[FLOW_NODE_QUICK_EDITOR_REGISTRY_METADATA_KEY]
  if (!Array.isArray(registry) || registry.length < 2) throw new Error('expected quick editor registry entries')

  const socketTypes = meta.socketTypes
  if (!socketTypes || typeof socketTypes !== 'object') throw new Error('expected socketTypes metadata')

  const subgraphs = meta[KG_SUBGRAPHS_KEY]
  if (!Array.isArray(subgraphs) || subgraphs.length < 2) throw new Error('expected derived subgraphs')
}

export function testMarkdownFrontmatterFlowGraphMatchesVideoScriptTemplateEdgeIdsAndPorts() {
  const md = [
    '---',
    'meta:',
    '  id: video-script-template-like-001',
    'nodes:',
    '  - id: NODE_OVERLAY_04',
    '    type: TextOverlay',
    '    category: overlay',
    '    pos: { x: 1020, y: 560 }',
    '    params:',
    '      text: "{{overlays.overlay_04.text}}"',
    '    inputs:',
    '      - port: clip_in',
    '        type: VIDEO_CLIP',
    '        from: NODE_CLIP_04.clip_out',
    '    outputs:',
    '      - port: composed_out',
    '        type: VIDEO_CLIP',
    '  - id: NODE_SEQUENCE',
    '    type: SequenceAssembler',
    '    category: assemble',
    '    pos: { x: 1340, y: 440 }',
    '    inputs:',
    '      - port: clip_04_in',
    '        type: VIDEO_CLIP',
    '        from: NODE_OVERLAY_04.composed_out',
    '    outputs:',
    '      - port: sequence_out',
    '        type: VIDEO_SEQUENCE',
    'connections:',
    '  - id: e42',
    '    from: NODE_OVERLAY_04.composed_out',
    '    to: NODE_SEQUENCE.clip_04_in',
    '    type: VIDEO_CLIP',
    'socket_types:',
    '  VIDEO_CLIP: { color: "#5DADE2", accepts: [VIDEO_CLIP] }',
    '  VIDEO_SEQUENCE: { color: "#1A5276", accepts: [VIDEO_SEQUENCE] }',
    '---',
    '',
    '## Beat 04',
    '',
    '| Edge | From port | To port | Type |',
    '|---|---|---|---|',
    '| e42 | `NODE_OVERLAY_04.composed_out` | `NODE_SEQUENCE.clip_04_in` | `VIDEO_CLIP` |',
    '',
  ].join('\n')

  const res = tryParseMarkdownFrontmatterFlowGraph('video-script-template.md', md)
  if (!res) throw new Error('expected a frontmatter flow graph parse result')
  const g = res.graphData
  const e42 = g.edges.find(e => String(e.id || '') === 'e42') || null
  if (!e42) throw new Error('expected edge id=e42')
  const e42Props = (e42.properties || {}) as Record<string, unknown>
  if (e42Props[FLOW_EDGE_SOURCE_PORT_KEY] !== 'composed_out') throw new Error('expected e42 source port composed_out')
  if (e42Props[FLOW_EDGE_TARGET_PORT_KEY] !== 'clip_04_in') throw new Error('expected e42 target port clip_04_in')

  const overlay = g.nodes.find(n => n.id === 'NODE_OVERLAY_04') || null
  if (!overlay) throw new Error('expected NODE_OVERLAY_04')
  const overlayProps = (overlay.properties || {}) as Record<string, unknown>
  const params = overlayProps.params
  if (!params || typeof params !== 'object') throw new Error('expected node params payload for quick editor fidelity')
  const portTypes = overlayProps['flow:portTypes']
  if (!portTypes || typeof portTypes !== 'object') throw new Error('expected flow:portTypes for port handle fidelity')

  const meta = (g.metadata || {}) as Record<string, unknown>
  const registry = meta[FLOW_NODE_QUICK_EDITOR_REGISTRY_METADATA_KEY]
  if (!Array.isArray(registry) || registry.length < 2) throw new Error('expected quick editor registry entries')
  const socketTypes = meta.socketTypes
  if (!socketTypes || typeof socketTypes !== 'object') throw new Error('expected socketTypes metadata')
}

export function testMarkdownFrontmatterFlowGraphHonorsUserSubgraphs() {
  const md = [
    '---',
    'meta:',
    '  id: demo-flow-subgraphs-001',
    'nodes:',
    '  - id: NODE_A',
    '    type: Source',
    '    label: "A"',
    '    category: source',
    '    pos: { x: 40, y: 80 }',
    '    inputs: []',
    '    outputs:',
    '      - port: out_1',
    '        type: STRING',
    '  - id: NODE_B',
    '    type: Sink',
    '    label: "B"',
    '    category: output',
    '    pos: { x: 240, y: 80 }',
    '    inputs:',
    '      - port: in_1',
    '        type: STRING',
    '        from: NODE_A.out_1',
    '    outputs: []',
    'connections:',
    '  - { id: e01, from_node: NODE_A, from_port: out_1, to_node: NODE_B, to_port: in_1, type: STRING }',
    `'${KG_SUBGRAPHS_KEY}':`,
    '  - id: g1',
    '    label: "Cluster 1"',
    '    kind: cluster',
    '    parentId: null',
    '    memberNodeIds: [NODE_A, NODE_B]',
    '---',
    '',
    '# Demo',
  ].join('\n')

  const res = tryParseMarkdownFrontmatterFlowGraph('demo.md', md)
  if (!res) throw new Error('expected a frontmatter flow graph parse result')
  if ((res.warnings || []).length !== 0) throw new Error(`expected no warnings, got: ${(res.warnings || []).join('; ')}`)
  const meta = (res.graphData.metadata || {}) as Record<string, unknown>
  const subgraphs = meta[KG_SUBGRAPHS_KEY]
  if (!Array.isArray(subgraphs) || subgraphs.length !== 1) throw new Error('expected user subgraphs to be preserved')
  const sg = subgraphs[0] as { id?: unknown; label?: unknown; kind?: unknown; memberNodeIds?: unknown }
  if (String(sg.id || '') !== 'g1') throw new Error('expected subgraph id g1')
  if (String(sg.label || '') !== 'Cluster 1') throw new Error('expected subgraph label Cluster 1')
  if (String(sg.kind || '') !== 'cluster') throw new Error('expected subgraph kind cluster')
  if (!Array.isArray(sg.memberNodeIds) || sg.memberNodeIds.length !== 2) throw new Error('expected memberNodeIds preserved')
}

export function testMarkdownFrontmatterFlowGraphWarningsDetectDivergentConnections() {
  const md = [
    '---',
    'meta:',
    '  id: demo-flow-warn-001',
    'nodes:',
    '  - id: NODE_A',
    '    type: Source',
    '    label: "A"',
    '    category: source',
    '    pos_x: 40',
    '    pos_y: 80',
    '    inputs: []',
    '    outputs:',
    '      - port: out_1',
    '        type: STRING',
    '  - id: NODE_B',
    '    type: Sink',
    '    label: "B"',
    '    category: output',
    '    pos_x: 240',
    '    pos_y: 80',
    '    inputs:',
    '      - port: in_1',
    '        type: STRING',
    '        from: NODE_A.out_1',
    '    outputs: []',
    'connections:',
    '  - { id: e01, from_node: NODE_A, from_port: out_1, to_node: NODE_B, to_port: in_1, type: STRING }',
    '  - { id: e02, from_node: NODE_A, from_port: out_1, to_node: NODE_B, to_port: in_2 }',
    'socket_types:',
    '  STRING: { color: "#AED6F1", accepts: [STRING] }',
    '---',
    '',
    '# Demo',
  ].join('\n')
  const res = tryParseMarkdownFrontmatterFlowGraph('demo.md', md)
  if (!res) throw new Error('expected a frontmatter flow graph parse result')
  if ((res.warnings || []).length === 0) throw new Error('expected warnings for divergent connections')
}

export function testMarkdownFrontmatterFlowGraphParsesDotFromToConnections() {
  const md = [
    '---',
    'meta:',
    '  id: demo-flow-conn-001',
    'nodes:',
    '  - id: NODE_A',
    '    type: Source',
    '    label: "A"',
    '    category: source',
    '    pos: { x: 40, y: 80 }',
    '    inputs: []',
    '    outputs:',
    '      - port: out_1',
    '        type: STRING',
    '  - id: NODE_B',
    '    type: Sink',
    '    label: "B"',
    '    category: output',
    '    pos: { x: 240, y: 80 }',
    '    inputs:',
    '      - port: in_1',
    '        type: STRING',
    '        from: NODE_A.out_1',
    '    outputs: []',
    'connections:',
    '  - { id: e01, from: NODE_A.out_1, to: NODE_B.in_1, type: STRING }',
    'socket_types:',
    '  STRING: { color: "#AED6F1", accepts: [STRING] }',
    '---',
    '',
    '# Demo',
  ].join('\n')

  const res = tryParseMarkdownFrontmatterFlowGraph('demo.md', md)
  if (!res) throw new Error('expected a frontmatter flow graph parse result')
  if ((res.warnings || []).length !== 0) throw new Error(`expected no warnings, got: ${(res.warnings || []).join('; ')}`)
  if (res.graphData.edges.length !== 1) throw new Error(`expected 1 edge, got ${res.graphData.edges.length}`)
  const e = res.graphData.edges[0]
  if ((e.properties as Record<string, unknown>)['flow:socketType'] !== 'STRING') throw new Error('expected flow:socketType=STRING')
  if (String(e.type || '') !== 'STRING') throw new Error('expected edge.type=STRING')
}

export function testMarkdownFrontmatterFlowGraphRepairsMissingSpaceAfterColonQuote() {
  const md = [
    '---',
    'meta:',
    '  id: demo-flow-conn-002',
    'nodes:',
    '  - id: A',
    '    type: Source',
    '    label: "A"',
    '    category: source',
    '    pos: { x: 0, y: 0 }',
    '    params:',
    '      attribution:"{{strings.moments.quote_source}}"',
    '    inputs: []',
    '    outputs:',
    '      - { port: out_1, type: STRING, fans_to: [B] }',
    '  - id: B',
    '    type: Sink',
    '    label: "B"',
    '    category: output',
    '    pos: { x: 100, y: 0 }',
    '    inputs:',
    '      - { port: in_1, type: STRING, from: A.out_1 }',
    '    outputs: []',
    'connections:',
    '  - { id: e01, from: A.out_1, to: B.in_1, type: STRING }',
    'socket_types:',
    '  STRING: { color: "#AED6F1", accepts: [STRING] }',
    '---',
    '',
    '# Demo',
  ].join('\n')

  const res = tryParseMarkdownFrontmatterFlowGraph('demo.md', md)
  if (!res) throw new Error('expected a frontmatter flow graph parse result')
  if (res.graphData.nodes.length !== 2) throw new Error(`expected 2 nodes, got ${res.graphData.nodes.length}`)
  if (res.graphData.edges.length !== 1) throw new Error(`expected 1 edge, got ${res.graphData.edges.length}`)
}

export function testMarkdownFrontmatterFlowGraphAugmentsPortsFromEdgeMap() {
  const md = [
    '---',
    'meta:',
    '  id: demo-flow-conn-003',
    'nodes:',
    '  - id: A',
    '    type: Source',
    '    label: "A"',
    '    category: source',
    '    pos: { x: 0, y: 0 }',
    '    params: {}',
    '    inputs: []',
    '    outputs:',
    '      - { port: out_1, type: STRING, fans_to: [B] }',
    '  - id: B',
    '    type: Sink',
    '    label: "B"',
    '    category: output',
    '    pos: { x: 100, y: 0 }',
    '    params: {}',
    '    inputs: []',
    '    outputs: []',
    'connections:',
    '  - { id: e01, from: A.out_1, to: B.in_1, type: STRING }',
    'socket_types:',
    '  STRING: { color: "#AED6F1", accepts: [STRING] }',
    '---',
    '',
    '# Demo',
  ].join('\n')

  const res = tryParseMarkdownFrontmatterFlowGraph('demo.md', md)
  if (!res) throw new Error('expected a frontmatter flow graph parse result')
  const b = res.graphData.nodes.find(n => n.id === 'B') || null
  if (!b) throw new Error('expected node B')
  const portTypes = (b.properties || {})['flow:portTypes'] as unknown
  if (!portTypes || typeof portTypes !== 'object') throw new Error('expected node B to have flow:portTypes')
  const inPorts = (portTypes as { in?: Record<string, unknown> }).in || {}
  if (inPorts.in_1 !== 'STRING') throw new Error(`expected B.in_1 type STRING, got ${String(inPorts.in_1 || '')}`)
}

export function testMarkdownFrontmatterFlowGraphExtractsEdgeTablesAndSocketLegend() {
  const md = [
    '---',
    'meta:',
    '  id: demo-flow-table-001',
    'nodes:',
    '  - id: NODE_A',
    '    type: Source',
    '    category: source',
    '    pos: { x: 40, y: 80 }',
    '    params: {}',
    '  - id: NODE_B',
    '    type: Sink',
    '    category: output',
    '    pos: { x: 240, y: 80 }',
    '    params: {}',
    '---',
    '',
    '# Demo',
    '',
    '| Edge | From port | To port | Type |',
    '|---|---|---|---|',
    '| e01 | `NODE_A.out_1` | `NODE_B.in_1` | `STRING` |',
    '',
    '## Socket Type Legend',
    '',
    '| Type | Colour | Carries |',
    '|---|---|---|',
    '| `STRING` | 🔵 `#AED6F1` | Text values |',
    '',
  ].join('\n')

  const res = tryParseMarkdownFrontmatterFlowGraph('demo.md', md)
  if (!res) throw new Error('expected a frontmatter flow graph parse result')
  if (res.graphData.edges.length !== 1) throw new Error(`expected 1 edge, got ${res.graphData.edges.length}`)

  const meta = (res.graphData.metadata || {}) as Record<string, unknown>
  const socketTypes = meta.socketTypes as unknown
  if (!socketTypes || typeof socketTypes !== 'object') throw new Error('expected socketTypes metadata from legend table')
  const spec = (socketTypes as Record<string, unknown>).STRING as unknown
  if (!spec || typeof spec !== 'object') throw new Error('expected socketTypes.STRING spec')
  if ((spec as Record<string, unknown>).color !== '#AED6F1') throw new Error('expected socketTypes.STRING.color to match legend')

  const b = res.graphData.nodes.find(n => n.id === 'NODE_B') || null
  if (!b) throw new Error('expected node NODE_B')
  const portTypes = (b.properties || {})['flow:portTypes'] as unknown
  if (!portTypes || typeof portTypes !== 'object') throw new Error('expected node NODE_B to have flow:portTypes')
  const inPorts = (portTypes as { in?: Record<string, unknown> }).in || {}
  if (inPorts.in_1 !== 'STRING') throw new Error(`expected NODE_B.in_1 type STRING, got ${String(inPorts.in_1 || '')}`)
}

export function testMarkdownFrontmatterFlowGraphParsesMultiFrontmatterBlocks() {
  const md = [
    '---',
    'meta:',
    '  id: demo-flow-multi-001',
    '---',
    '---',
    'nodes:',
    '  - id: NODE_A',
    '    type: Source',
    '    category: source',
    '    pos: { x: 40, y: 80 }',
    '    params: {}',
    '    inputs: []',
    '    outputs:',
    '      - port: out_1',
    '        type: STRING',
    '  - id: NODE_B',
    '    type: Sink',
    '    category: output',
    '    pos: { x: 240, y: 80 }',
    '    params: {}',
    '    inputs: []',
    '    outputs: []',
    '---',
    '',
    '# Demo',
    '',
    '| Edge | From port | To port | Type |',
    '|---|---|---|---|',
    '| e01 | `NODE_A.out_1` | `NODE_B.in_1` | `STRING` |',
    '',
  ].join('\n')

  const res = tryParseMarkdownFrontmatterFlowGraph('demo.md', md)
  if (!res) throw new Error('expected a frontmatter flow graph parse result')
  if (res.graphData.nodes.length !== 2) throw new Error(`expected 2 nodes, got ${res.graphData.nodes.length}`)
  if (res.graphData.edges.length !== 1) throw new Error(`expected 1 edge, got ${res.graphData.edges.length}`)
}

export function testMarkdownFrontmatterFlowGraphParsesSigilNeuralTemplateAndBodyAnnotations() {
  const md = [
    '---',
    'doc:',
    '  id: "doc:test"',
    'nodes:',
    '  - @node:pain:a: { label: "Pain A", status: placeholder }',
    '  - @node:feature:1: { label: "Feature 1", status: active }',
    'clusters:',
    '  - @cluster:pitch:',
    '      label: "Pitch Cluster"',
    '      color: "#2D6A4F"',
    '      members:',
    '        - "@node:pain:a"',
    '        - "@node:feature:1"',
    'edges:',
    '  - id: @edge:pain→feature',
    '    source: "@node:pain:*"',
    '    target: "@node:feature:*"',
    '    rel: motivates',
    '---',
    '',
    '## Pitch<!-- @cluster:pitch -->',
    'Pain marker<!-- @node:pain:a -->',
    'Feature marker<!-- @node:feature:1 -->',
    '',
  ].join('\n')

  const res = tryParseMarkdownFrontmatterFlowGraph('sigil-template.md', md)
  if (!res) throw new Error('expected a frontmatter flow graph parse result')
  if (res.graphData.nodes.length < 3) throw new Error(`expected at least 3 nodes, got ${res.graphData.nodes.length}`)
  if (res.graphData.edges.length < 1) throw new Error(`expected at least 1 edge, got ${res.graphData.edges.length}`)

  const pain = res.graphData.nodes.find(n => n.id === '@node:pain:a') || null
  if (!pain) throw new Error('expected @node:pain:a')
  const pitch = res.graphData.nodes.find(n => n.id === '@cluster:pitch') || null
  if (!pitch) throw new Error('expected @cluster:pitch')
  const painPrimitive = (pain.properties || {})['frontmatter:primitive']
  const clusterPrimitive = (pitch.properties || {})['frontmatter:primitive']
  if (painPrimitive !== 'node') throw new Error('expected @node primitive=node')
  if (clusterPrimitive !== 'cluster') throw new Error('expected @cluster primitive=cluster')

  const edge = res.graphData.edges.find(e => String(e.id || '').startsWith('@edge:pain→feature')) || null
  if (!edge) throw new Error('expected @edge:pain→feature edge')
  if ((edge.properties || {})['frontmatter:primitive'] !== 'edge') throw new Error('expected edge primitive=edge')
  if (String(edge.label || '') !== 'motivates') throw new Error('expected edge label motivates')

  const meta = (res.graphData.metadata || {}) as Record<string, unknown>
  const wiring = meta.frontmatterAnnotationWiring as unknown
  if (!wiring || typeof wiring !== 'object') throw new Error('expected frontmatterAnnotationWiring metadata')
  const nodeIds = (wiring as { nodeIds?: unknown }).nodeIds
  if (!Array.isArray(nodeIds) || !nodeIds.includes('@node:pain:a')) throw new Error('expected node annotation ids to include @node:pain:a')
  const clusterIds = (wiring as { clusterIds?: unknown }).clusterIds
  if (!Array.isArray(clusterIds) || !clusterIds.includes('@cluster:pitch')) throw new Error('expected cluster annotation ids to include @cluster:pitch')

  const subgraphs = meta[KG_SUBGRAPHS_KEY]
  if (!Array.isArray(subgraphs)) throw new Error('expected subgraphs metadata')
  const pitchSubgraph = subgraphs.find(s => (s as { id?: unknown }).id === '@cluster:pitch') || null
  if (!pitchSubgraph) throw new Error('expected @cluster:pitch subgraph')
}

export function testMarkdownFrontmatterFlowGraphPrefersMermaidWiringOverSyntheticSigilExpansion() {
  const md = [
    '---',
    'nodes:',
    '  - @node:pain:a: { label: "Pain A", status: placeholder }',
    '  - @node:feature:1: { label: "Feature 1", status: active }',
    'edges:',
    '  - id: @edge:pain→feature',
    '    source: "@node:pain:*"',
    '    target: "@node:feature:*"',
    '    rel: motivates',
    'graph: |',
    '  graph TD',
    '    n_pain["@node:pain:a · Pain A"]',
    '    n_feat["@node:feature:1 · Feature 1"]',
    '    e_motivates{{"@edge:pain→feature · motivates"}}',
    '    n_pain -->|identity-anchor| e_motivates --> n_feat',
    '---',
    '',
    'Body',
  ].join('\n')

  const res = tryParseMarkdownFrontmatterFlowGraph('sigil-mermaid-wiring.md', md)
  if (!res) throw new Error('expected a frontmatter flow graph parse result')
  const edges = res.graphData.edges || []
  if (edges.length !== 2) throw new Error(`expected exactly 2 mermaid wiring edges, got ${edges.length}`)

  const hasSyntheticMotivates = edges.some(e => String(e.label || '') === 'motivates')
  if (hasSyntheticMotivates) throw new Error('expected no synthetic direct motivates edges when mermaid wiring exists')

  const edgeNode = res.graphData.nodes.find(n => n.id === '@edge:pain→feature') || null
  if (!edgeNode) throw new Error('expected @edge node to be materialized from mermaid wiring')
  const primitive = (edgeNode.properties || {})['frontmatter:primitive']
  if (primitive !== 'edge') throw new Error('expected @edge node primitive=edge')

  const edgeSourceKinds = new Set(
    edges.map(e => String(((e.properties || {}) as Record<string, unknown>)['frontmatter:edgeSource'] || '')),
  )
  if (edgeSourceKinds.size !== 1 || !edgeSourceKinds.has('mermaid-wiring')) {
    throw new Error('expected all edges to come from mermaid wiring source')
  }

  const identityAnchorEdge = edges.find(e => String(e.label || '') === 'identity-anchor') || null
  if (!identityAnchorEdge) throw new Error('expected inline mermaid edge label to be preserved')
  const displayLabel = String(((identityAnchorEdge.properties || {}) as Record<string, unknown>)['frontmatter:displayLabel'] || '')
  if (displayLabel !== 'identity-anchor') throw new Error('expected frontmatter:displayLabel to preserve inline label')
}
