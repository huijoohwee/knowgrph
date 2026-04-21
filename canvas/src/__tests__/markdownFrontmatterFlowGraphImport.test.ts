import fs from 'node:fs'
import path from 'node:path'

import { tryParseMarkdownFrontmatterFlowGraph } from '@/features/parsers/markdownFrontmatterFlowGraph'
import { loadGraphDataFromTextViaParser } from '@/features/parsers/loader'
import { buildAndSetFlowNativeScene } from '@/components/FlowCanvas/buildNativeScene'
import { readFlowConfig } from '@/components/FlowCanvas/config'
import { FLOW_WIDGET_REGISTRY_METADATA_KEY } from '@/lib/config'
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
  const registry = meta[FLOW_WIDGET_REGISTRY_METADATA_KEY]
  if (!Array.isArray(registry) || registry.length < 2) throw new Error('expected widget registry entries')

  const socketTypes = meta.socketTypes
  if (!socketTypes || typeof socketTypes !== 'object') throw new Error('expected socketTypes metadata')

  const subgraphs = meta[KG_SUBGRAPHS_KEY]
  if (typeof subgraphs !== 'undefined') throw new Error('expected no synthetic fallback subgraphs when frontmatter did not declare them')
}

export function testMarkdownFlowBlockInBodyParsesNodesEdgesAndWidgetFields() {
  const md = [
    '# Title',
    '',
    'flow:',
    '  direction:  {key: direction,  type: string,  value: LR}',
    '  edgeType:   {key: edgeType,   type: string,  value: smoothstep}',
    '  nodes:',
    '    - id:      {key: id,      type: string,   value: "n-canvas"}',
    '      type:    {key: type,    type: string,   value: "input"}',
    '      label:   {key: label,   type: string,   value: "Canvas"}',
    '      handles: {key: handles, type: object,   value: {source: [signal]}}',
    '      data:    {key: data,    type: object,   value: {pain: "x"}}',
    '      compute: {key: compute, type: function, value: |',
    '        (inputs) => ({ signal: inputs.x ?? null })',
    '      }',
    '    - id:      {key: id,      type: string,   value: "n-pack"}',
    '      type:    {key: type,    type: string,   value: "default"}',
    '      label:   {key: label,   type: string,   value: "Pack"}',
    '      handles: {key: handles, type: object,   value: {target: [signal]}}',
    '      compute: {key: compute, type: function, value: |',
    '        (inputs) => ({})',
    '      }',
    '  edges:',
    '    - { id: e1, source: n-canvas, sourceHandle: signal, target: n-pack, targetHandle: signal, animated: true }',
    '---',
    '',
    '## Body',
  ].join('\n')

  const res = tryParseMarkdownFrontmatterFlowGraph('kgc-ai-pipeline-prd-tad.md', md)
  if (!res) throw new Error('expected a flow graph parse result from markdown body')
  const g = res.graphData
  if (g.context !== 'frontmatter-flow') throw new Error('expected frontmatter-flow context')
  if (g.nodes.length !== 2) throw new Error(`expected 2 nodes, got ${g.nodes.length}`)
  if (g.edges.length !== 1) throw new Error(`expected 1 edge, got ${g.edges.length}`)

  const canvas = g.nodes.find(n => n.id === 'n-canvas')
  if (!canvas) throw new Error('expected node n-canvas')
  const canvasProps = (canvas.properties || {}) as Record<string, unknown>
  const handlesValue = canvasProps['frontmatter:handles']
  if (!handlesValue || typeof handlesValue !== 'object') throw new Error('expected frontmatter:handles to be preserved for widget')
  if (!canvasProps.data || typeof canvasProps.data !== 'object') throw new Error('expected data property for widget')
  if (typeof canvasProps['flow:compute'] !== 'string') throw new Error('expected flow:compute property for widget')

  const meta = (g.metadata || {}) as Record<string, unknown>
  const registry = meta[FLOW_WIDGET_REGISTRY_METADATA_KEY]
  if (!Array.isArray(registry) || registry.length < 2) throw new Error('expected widget registry entries')
  const canvasEntry = registry.find(e => String((e as { formId?: unknown })?.formId || '').trim() === 'fm:n-canvas') as
    | { fields?: unknown[] }
    | undefined
  if (!canvasEntry) throw new Error('expected registry entry for fm:n-canvas')
  const fields = Array.isArray(canvasEntry.fields) ? canvasEntry.fields : []
  const fieldKeys = fields.map(f => String((f as { fieldKey?: unknown })?.fieldKey || '')).filter(Boolean)
  if (!fieldKeys.includes('handles')) throw new Error('expected handles widget field from envelope')
  if (!fieldKeys.includes('data')) throw new Error('expected data widget field from envelope')
  if (!fieldKeys.includes('compute')) throw new Error('expected compute widget field from envelope')

  const e1 = g.edges.find(e => String(e.id || '') === 'e1')
  if (!e1) throw new Error('expected edge e1')
  const e1Props = (e1.properties || {}) as Record<string, unknown>
  if (e1Props[FLOW_EDGE_SOURCE_PORT_KEY] !== 'signal') throw new Error('expected e1 source port signal')
  if (e1Props[FLOW_EDGE_TARGET_PORT_KEY] !== 'signal') throw new Error('expected e1 target port signal')
}

export function testMarkdownFrontmatterFlowGraphParsesInlineEnvelopeBlockScalarBraceOnLastLine() {
  const md = [
    '---',
    'title: x',
    'flow:',
    '  nodes:',
    '    - id:      {key: id,      type: string, value: "n-canvas"}',
    '      type:    {key: type,    type: string, value: "input"}',
    '      label:   {key: label,   type: string, value: "Canvas"}',
    '      handles: {key: handles, type: object, value: {source: [signal]}}',
    '      compute: {key: compute, type: function, value: |',
    '        (inputs) => ({ ok: true })}',
    '  edges: []',
    '---',
    '',
    '# body',
  ].join('\n')

  const res = tryParseMarkdownFrontmatterFlowGraph('inline-envelope-brace.md', md)
  if (!res) throw new Error('expected parse result')
  if (res.graphData.context !== 'frontmatter-flow') throw new Error('expected frontmatter-flow context')
  const node = res.graphData.nodes.find(n => n.id === 'n-canvas')
  if (!node) throw new Error('expected node')
  const props = (node.properties || {}) as Record<string, unknown>
  if (typeof props['flow:compute'] !== 'string') throw new Error('expected flow:compute string')
  if (String(props['flow:compute']).includes('})}')) throw new Error('expected trailing brace to be repaired out of compute')
}

export function testMarkdownFrontmatterFlowGraphParsesNoSpaceEnvelopeObjectKeysForWidgetVisibility() {
  const md = [
    '---',
    'flow:',
    '  nodes:',
    '    - id:           {key: id,           type: string,  value: "n-canvas"}',
    '      type:         {key: type,         type: string,  value: "input"}',
    '      label:        {key: label,        type: string,  value: "S01"}',
    '      handles:      {key: handles,      type: object,  value: {source: [signal]}}',
    '      applies_rules:{key: applies_rules,type: array,   value: []}',
    '      compute:      {key: compute,      type: function, value: |',
    '        (inputs) => ({ signal: inputs.x ?? null })',
    '      }',
    '    - id:           {key: id,           type: string,  value: "n-pack"}',
    '      type:         {key: type,         type: string,  value: "default"}',
    '      label:        {key: label,        type: string,  value: "S02"}',
    '      handles:      {key: handles,      type: object,  value: {target: [signal], source: [context]}}',
    '      applies_rules:{key: applies_rules,type: array,   value: []}',
    '      compute:      {key: compute,      type: function, value: |',
    '        (inputs) => ({ context: inputs.signal ?? null })',
    '      }',
    '  edges:',
    '    - {id: e1, source: n-canvas, sourceHandle: signal, target: n-pack, targetHandle: signal}',
    '---',
    '',
    '# body',
  ].join('\n')

  const res = tryParseMarkdownFrontmatterFlowGraph('kgc-no-space-envelope.md', md)
  if (!res) throw new Error('expected parse result for no-space envelope keys')
  const g = res.graphData
  if (g.context !== 'frontmatter-flow') throw new Error('expected frontmatter-flow context')
  if ((g.nodes || []).length !== 2) throw new Error(`expected 2 nodes, got ${(g.nodes || []).length}`)
  if ((g.edges || []).length !== 1) throw new Error(`expected 1 edge, got ${(g.edges || []).length}`)

  const nodeIds = new Set((g.nodes || []).map(n => String(n.id || '').trim()).filter(Boolean))
  if (!nodeIds.has('n-canvas') || !nodeIds.has('n-pack')) {
    throw new Error(`expected parsed node ids n-canvas,n-pack, got ${Array.from(nodeIds).join(',')}`)
  }

  const widgetForms = (g.nodes || [])
    .map(n => String(((n.properties || {}) as Record<string, unknown>)['flow:widgetFormId'] || '').trim())
    .filter(Boolean)
    .sort()
  if (widgetForms.join(',') !== 'fm:n-canvas,fm:n-pack') {
    throw new Error(`expected node-scoped widget forms, got ${widgetForms.join(',')}`)
  }

  const canvasNode = (g.nodes || []).find(n => String(n.id || '').trim() === 'n-canvas')
  if (!canvasNode) throw new Error('expected n-canvas node')
  const canvasProps = (canvasNode.properties || {}) as Record<string, unknown>
  if (String(canvasProps.phase || '') !== 'emit') throw new Error('expected declared phase to persist in node properties')
  const actor = canvasProps.actor
  if (!Array.isArray(actor) || actor.length !== 2) throw new Error('expected declared actor array to persist in node properties')
  const appliesRules = canvasProps.applies_rules
  if (!Array.isArray(appliesRules)) throw new Error('expected declared applies_rules to persist in node properties')
  if (String(canvasProps.db_writes || '') !== 'flow_nodes') throw new Error('expected declared db_writes to persist in node properties')
  if (String(canvasProps.retry_arc || '') !== '—') throw new Error('expected declared retry_arc to persist in node properties')
  if (String(canvasProps.confidence || '') !== 'high') throw new Error('expected declared confidence to persist in node properties')
  if (String(canvasProps.status || '') !== 'TBD') throw new Error('expected declared status to persist in node properties')
  if (String(canvasProps.kanban || '') !== 'done') throw new Error('expected declared kanban to persist in node properties')
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
  if (!params || typeof params !== 'object') throw new Error('expected node params payload for widget fidelity')
  const portTypes = overlayProps['flow:portTypes']
  if (!portTypes || typeof portTypes !== 'object') throw new Error('expected flow:portTypes for port handle fidelity')

  const meta = (g.metadata || {}) as Record<string, unknown>
  const registry = meta[FLOW_WIDGET_REGISTRY_METADATA_KEY]
  if (!Array.isArray(registry) || registry.length < 2) throw new Error('expected widget registry entries')
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

export function testMarkdownFrontmatterFlowGraphParsesSigilEdgeLinesWithHandleRouting() {
  const md = [
    '---',
    'nodes:',
    '  - @node:n-a: { label: "A", type: input }',
    '  - @node:n-b: { label: "B", type: output }',
    'edges:',
    '  - @edge:n-a:signal → n-b:signal',
    '---',
    '',
    '# Flow',
  ].join('\n')

  const res = tryParseMarkdownFrontmatterFlowGraph('sigil-edge-lines.md', md)
  if (!res) throw new Error('expected a frontmatter flow graph parse result')
  const edge = res.graphData.edges.find(e => String(e.id || '').includes('@edge:n-a:signal->n-b:signal')) || null
  if (!edge) throw new Error('expected edge from sigil line declaration')
  const props = (edge.properties || {}) as Record<string, unknown>
  if (String(props[FLOW_EDGE_SOURCE_PORT_KEY] || '') !== 'signal') throw new Error('expected source port from sigil edge line')
  if (String(props[FLOW_EDGE_TARGET_PORT_KEY] || '') !== 'signal') throw new Error('expected target port from sigil edge line')
}

export function testMarkdownFrontmatterFlowGraphParsesWorkflowFlowBlockWithHandlesDataAndCompute() {
  const md = [
    '---',
    'subject: hackathon winners',
    'flow:',
    '  direction: LR',
    '  edgeType: smoothstep',
    '  snapToGrid: true',
    '  gridSize: 20',
    '  computed: true',
    '  nodes:',
    '    - id: n-scrape',
    '      type: input',
    '      label: scrape event URLs',
    '      position: { x: 0, y: 0 }',
    '      handles:',
    '        source: [urls]',
    '      data:',
    '        urls: ["https://example.com/a"]',
    '        confidence: high',
    '    - id: n-extract',
    '      type: default',
    '      label: "{{subject}}"',
    '      position: { x: 220, y: 0 }',
    '      handles:',
    '        target: [urls]',
    '        source: [demos]',
    '      compute: |',
    '        (inputs) => ({',
    '          demos: (Array.isArray(inputs.urls) ? inputs.urls : [inputs.urls]).filter(Boolean).map((u) => ({ url: u, extracted: true }))',
    '        })',
    '      data: {}',
    '    - id: n-gallery',
    '      type: output',
    '      label: project gallery',
    '      position: { x: 440, y: 0 }',
    '      handles:',
    '        target: [demos]',
    '      data:',
    '        winner_badge: true',
    '        repo_link: TBD',
    '  edges:',
    '    - id: e-scrape-extract',
    '      source: n-scrape',
    '      sourceHandle: urls',
    '      target: n-extract',
    '      targetHandle: urls',
    '      label: scrape → extract',
    '      animated: true',
    '---',
    '',
    '# Demo',
  ].join('\n')

  const res = tryParseMarkdownFrontmatterFlowGraph('flow-guideline.md', md)
  if (!res) throw new Error('expected a frontmatter flow graph parse result')
  const g = res.graphData
  if (g.nodes.length !== 3) throw new Error(`expected 3 nodes, got ${g.nodes.length}`)
  if (g.edges.length !== 1) throw new Error(`expected 1 edge, got ${g.edges.length}`)

  const extract = g.nodes.find(n => n.id === 'n-extract') || null
  if (!extract) throw new Error('expected n-extract')
  if (String(extract.label || '') !== 'hackathon winners') throw new Error('expected template label resolution for n-extract')
  const extractProps = (extract.properties || {}) as Record<string, unknown>
  if (typeof extractProps['flow:compute'] !== 'string') throw new Error('expected flow:compute on n-extract')
  const extractData = extractProps.data as Record<string, unknown> | undefined
  if (!extractData || typeof extractData !== 'object') throw new Error('expected data object on n-extract')

  const gallery = g.nodes.find(n => n.id === 'n-gallery') || null
  if (!gallery) throw new Error('expected n-gallery')
  const galleryProps = (gallery.properties || {}) as Record<string, unknown>
  if (galleryProps['frontmatter:waiting'] !== true) throw new Error('expected frontmatter:waiting for TBD payload')
  const galleryData = galleryProps.data as Record<string, unknown> | undefined
  if (!galleryData || galleryData.repo_link !== null) throw new Error('expected TBD to normalize to null in node data')

  const edge = g.edges[0]
  const edgeProps = (edge.properties || {}) as Record<string, unknown>
  if (edgeProps[FLOW_EDGE_SOURCE_PORT_KEY] !== 'urls') throw new Error('expected source handle urls')
  if (edgeProps[FLOW_EDGE_TARGET_PORT_KEY] !== 'urls') throw new Error('expected target handle urls')
  if (String(edge.label || '') !== 'scrape → extract') throw new Error('expected edge label from flow block')
  if (edgeProps['flow:animated'] !== true) throw new Error('expected flow:animated=true from flow block')

  const meta = (g.metadata || {}) as Record<string, unknown>
  const settings = meta.frontmatterFlowSettings as Record<string, unknown> | undefined
  if (!settings) throw new Error('expected frontmatterFlowSettings in metadata')
  if (settings.direction !== 'LR') throw new Error('expected flow direction LR')
  if (settings.edgeType !== 'smoothstep') throw new Error('expected flow edgeType smoothstep')
}

export function testMarkdownFrontmatterFlowGraphParsesWrappedNodeFieldEnvelopeAndEdgeHandles() {
  const md = [
    '---',
    'flow:',
    '  direction: LR',
    '  edgeType: smoothstep',
    '  snapToGrid: true',
    '  gridSize: 20',
    '  computed: true',
    '  nodes:',
    '    - id:      {key: id,      type: string,   value: "n-canvas"}',
    '      type:    {key: type,    type: string,   value: "input"}',
    '      label:   {key: label,   type: string,   value: "Knowledge Graph Canvas"}',
    '      handles: {key: handles, type: object,   value: {source: [signal]}}',
    '      data:    {key: data,    type: object,   value: {pain: "AI responses ignore graph structure", goal: "structured context for every prompt"}}',
    '      compute: {key: compute, type: function, value: "(inputs) => ({ signal: { node: inputs.__selected_node ?? null, fm: inputs.__frontmatter ?? {}, summary: inputs.__graph_summary ?? \\"\\" } })"}',
    '    - id:      {key: id,      type: string,   value: "n-ai"}',
    '      type:    {key: type,    type: string,   value: "default"}',
    '      label:   {key: label,   type: string,   value: "generateMarkdown()"}',
    '      handles: {key: handles, type: object,   value: {target: [context, correction], source: [md]}}',
    '      data:    {key: data,    type: object,   value: {model: "claude-sonnet-4-20250514", temperature: 0.3}}',
    '    - id:      {key: id,      type: string,   value: "n-validate"}',
    '      type:    {key: type,    type: string,   value: "default"}',
    '      label:   {key: label,   type: string,   value: "validateMarkdown()"}',
    '      handles: {key: handles, type: object,   value: {target: [md], source: [valid_md, correction]}}',
    '      data:    {key: data,    type: object,   value: {rules: ["V-01","V-02"], max_retry: 3}}',
    '    - id:      {key: id,      type: string,   value: "n-render"}',
    '      type:    {key: type,    type: string,   value: "output"}',
    '      label:   {key: label,   type: string,   value: "renderCanvas()"}',
    '      handles: {key: handles, type: object,   value: {target: [valid_md]}}',
    '      data:    {key: data,    type: object,   value: {stores: ["flow_nodes","flow_edges"], triggers: "canvas re-render"}}',
    '  edges:',
    '    - { id: e3, source: n-ai,       sourceHandle: md,         target: n-validate, targetHandle: md,         animated: true }',
    '    - { id: e4, source: n-validate, sourceHandle: valid_md,   target: n-render,   targetHandle: valid_md,   animated: true, label: "validated MD" }',
    '    - { id: e5, source: n-validate, sourceHandle: correction, target: n-ai,       targetHandle: correction, animated: true, label: "@flag:correction" }',
    '---',
  ].join('\n')

  const res = tryParseMarkdownFrontmatterFlowGraph('wrapped-flow-envelope.md', md)
  if (!res) throw new Error('expected parse result for wrapped flow node field envelope')
  const g = res.graphData
  if (g.nodes.length !== 4) throw new Error(`expected 4 flow nodes, got ${g.nodes.length}`)
  if (g.edges.length !== 3) throw new Error(`expected 3 flow edges, got ${g.edges.length}`)

  const e5 = g.edges.find(e => String(e.id || '') === 'e5') || null
  if (!e5) throw new Error('expected e5 edge')
  const e5Props = (e5.properties || {}) as Record<string, unknown>
  if (String(e5.source || '') !== 'n-validate' || String(e5.target || '') !== 'n-ai') {
    throw new Error('expected e5 endpoints n-validate -> n-ai')
  }
  if (String(e5Props[FLOW_EDGE_SOURCE_PORT_KEY] || '') !== 'correction') throw new Error('expected e5 source handle correction')
  if (String(e5Props[FLOW_EDGE_TARGET_PORT_KEY] || '') !== 'correction') throw new Error('expected e5 target handle correction')

  const meta = (g.metadata || {}) as Record<string, unknown>
  const registry = Array.isArray(meta[FLOW_WIDGET_REGISTRY_METADATA_KEY])
    ? (meta[FLOW_WIDGET_REGISTRY_METADATA_KEY] as Array<Record<string, unknown>>)
    : []
  const aiForm = registry.find(r => String(r.formId || '') === 'fm:n-ai') || null
  const validateForm = registry.find(r => String(r.formId || '') === 'fm:n-validate') || null
  if (!aiForm || !validateForm) throw new Error('expected registry entries for n-ai and n-validate')
  const aiPorts = Array.isArray(aiForm.ports) ? (aiForm.ports as Array<Record<string, unknown>>) : []
  const validatePorts = Array.isArray(validateForm.ports) ? (validateForm.ports as Array<Record<string, unknown>>) : []
  const hasAiCorrectionIn = aiPorts.some(p => String(p.portKey || '') === 'correction' && String(p.direction || '') === 'input')
  const hasValidateCorrectionOut = validatePorts.some(p => String(p.portKey || '') === 'correction' && String(p.direction || '') === 'output')
  if (!hasAiCorrectionIn || !hasValidateCorrectionOut) {
    throw new Error('expected wrapped-flow envelope handles to map correction ports into widget registry')
  }
}

export function testMarkdownFrontmatterFlowGraphParsesAllWrappedNodeIdsIntoWidgetForms() {
  const md = [
    '---',
    'flow:',
    '  nodes:',
    '    - id:      {key: id,      type: string,   value: "n-canvas"}',
    '      type:    {key: type,    type: string,   value: "input"}',
    '      handles: {key: handles, type: object,   value: {source: [signal]}}',
    '    - id:      {key: id,      type: string,   value: "n-pack"}',
    '      type:    {key: type,    type: string,   value: "default"}',
    '      handles: {key: handles, type: object,   value: {target: [signal], source: [context]}}',
    '    - id:      {key: id,      type: string,   value: "n-ai"}',
    '      type:    {key: type,    type: string,   value: "default"}',
    '      handles: {key: handles, type: object,   value: {target: [context, correction], source: [md]}}',
    '    - id:      {key: id,      type: string,   value: "n-validate"}',
    '      type:    {key: type,    type: string,   value: "default"}',
    '      handles: {key: handles, type: object,   value: {target: [md], source: [valid_md, correction]}}',
    '    - id:      {key: id,      type: string,   value: "n-render"}',
    '      type:    {key: type,    type: string,   value: "output"}',
    '      handles: {key: handles, type: object,   value: {target: [valid_md]}}',
    '  edges:',
    '    - { id: e1, source: n-canvas,   sourceHandle: signal,     target: n-pack,     targetHandle: signal }',
    '    - { id: e2, source: n-pack,     sourceHandle: context,    target: n-ai,       targetHandle: context }',
    '    - { id: e3, source: n-ai,       sourceHandle: md,         target: n-validate, targetHandle: md }',
    '    - { id: e4, source: n-validate, sourceHandle: valid_md,   target: n-render,   targetHandle: valid_md }',
    '    - { id: e5, source: n-validate, sourceHandle: correction, target: n-ai,       targetHandle: correction }',
    '---',
  ].join('\n')

  const expectedNodeIds = ['n-canvas', 'n-pack', 'n-ai', 'n-validate', 'n-render'].sort()
  const res = tryParseMarkdownFrontmatterFlowGraph('wrapped-flow-ids.md', md)
  if (!res) throw new Error('expected parse result for wrapped node ids')
  const g = res.graphData
  const actualNodeIds = (g.nodes || []).map(n => String(n.id || '')).filter(Boolean).sort()
  if (JSON.stringify(actualNodeIds) !== JSON.stringify(expectedNodeIds)) {
    throw new Error(`expected wrapped node ids parsed into graph nodes, got ${JSON.stringify(actualNodeIds)}`)
  }

  const meta = (g.metadata || {}) as Record<string, unknown>
  const registry = Array.isArray(meta[FLOW_WIDGET_REGISTRY_METADATA_KEY])
    ? (meta[FLOW_WIDGET_REGISTRY_METADATA_KEY] as Array<Record<string, unknown>>)
    : []
  const formIds = registry.map(r => String(r.formId || '')).filter(Boolean)
  for (let i = 0; i < expectedNodeIds.length; i += 1) {
    const formId = `fm:${expectedNodeIds[i]}`
    if (!formIds.includes(formId)) throw new Error(`expected widget form for wrapped node id ${expectedNodeIds[i]}`)
  }
}

export function testMarkdownFrontmatterFlowGraphFlowBlockIgnoresMermaidAndRendersOnlyFlowNodesForWidgets() {
  const md = [
    '---',
    'mermaid: |',
    '  flowchart TB',
    '    extra_a["extra-a"] --> extra_b["extra-b"]',
    'flow:',
    '  nodes:',
    '    - id:      {key: id,      type: string,   value: "n-canvas"}',
    '      type:    {key: type,    type: string,   value: "input"}',
    '      handles: {key: handles, type: object,   value: {source: [signal]}}',
    '    - id:      {key: id,      type: string,   value: "n-pack"}',
    '      type:    {key: type,    type: string,   value: "default"}',
    '      handles: {key: handles, type: object,   value: {target: [signal], source: [context]}}',
    '    - id:      {key: id,      type: string,   value: "n-ai"}',
    '      type:    {key: type,    type: string,   value: "default"}',
    '      handles: {key: handles, type: object,   value: {target: [context, correction], source: [md]}}',
    '    - id:      {key: id,      type: string,   value: "n-validate"}',
    '      type:    {key: type,    type: string,   value: "default"}',
    '      handles: {key: handles, type: object,   value: {target: [md], source: [valid_md, correction]}}',
    '    - id:      {key: id,      type: string,   value: "n-render"}',
    '      type:    {key: type,    type: string,   value: "output"}',
    '      handles: {key: handles, type: object,   value: {target: [valid_md]}}',
    '  edges:',
    '    - { id: e1, source: n-canvas,   sourceHandle: signal,     target: n-pack,     targetHandle: signal }',
    '    - { id: e2, source: n-pack,     sourceHandle: context,    target: n-ai,       targetHandle: context }',
    '    - { id: e3, source: n-ai,       sourceHandle: md,         target: n-validate, targetHandle: md }',
    '    - { id: e4, source: n-validate, sourceHandle: valid_md,   target: n-render,   targetHandle: valid_md }',
    '    - { id: e5, source: n-validate, sourceHandle: correction, target: n-ai,       targetHandle: correction }',
    '---',
  ].join('\n')

  const expectedNodeIds = ['n-canvas', 'n-pack', 'n-ai', 'n-validate', 'n-render'].sort()
  const res = tryParseMarkdownFrontmatterFlowGraph('flow-block-ignore-mermaid.md', md)
  if (!res) throw new Error('expected parse result for flow block with mermaid side payload')
  const actualNodeIds = (res.graphData.nodes || []).map(n => String(n.id || '')).filter(Boolean).sort()
  if (JSON.stringify(actualNodeIds) !== JSON.stringify(expectedNodeIds)) {
    throw new Error(`expected only flow node ids from flow block, got ${JSON.stringify(actualNodeIds)}`)
  }
  const meta = (res.graphData.metadata || {}) as Record<string, unknown>
  const registry = Array.isArray(meta[FLOW_WIDGET_REGISTRY_METADATA_KEY])
    ? (meta[FLOW_WIDGET_REGISTRY_METADATA_KEY] as Array<Record<string, unknown>>)
    : []
  const formIds = registry.map(r => String(r.formId || '')).filter(Boolean).sort()
  const expectedFormIds = expectedNodeIds.map(id => `fm:${id}`).sort()
  if (JSON.stringify(formIds) !== JSON.stringify(expectedFormIds)) {
    throw new Error(`expected only flow node widget forms, got ${JSON.stringify(formIds)}`)
  }
}

export async function testMarkdownLoaderFlowBlockSkipsMarkdownStructureNodesForWidgets() {
  const md = [
    '---',
    'title: Loader Isolation',
    'flow:',
    '  nodes:',
    '    - id: a',
    '      type: input',
    '      handles: { source: [out] }',
    '    - id: b',
    '      type: output',
    '      handles: { target: [out] }',
    '  edges:',
    '    - { id: e1, source: a, sourceHandle: out, target: b, targetHandle: out }',
    '---',
    '',
    '# architecture-overview',
    '',
    '- List 2',
    '',
    '| Table 1 |',
    '| --- |',
    '| Paragraph 1 |',
  ].join('\n')

  const res = await loadGraphDataFromTextViaParser('loader-flow-isolation.md', md, { applyToStore: false, syncMarkdownDocument: false })
  if (!res?.graphData) throw new Error('expected loader graph data')
  const g = res.graphData
  if (String(g.context || '').trim() !== 'frontmatter-flow') throw new Error('expected frontmatter-flow context')
  const ids = (g.nodes || []).map(n => String(n.id || '').trim()).filter(Boolean).sort()
  const expected = ['a', 'b']
  if (JSON.stringify(ids) !== JSON.stringify(expected)) {
    throw new Error(`expected only flow node ids from flow block, got ${JSON.stringify(ids)}`)
  }
  const meta = (g.metadata || {}) as Record<string, unknown>
  const registry = Array.isArray(meta[FLOW_WIDGET_REGISTRY_METADATA_KEY])
    ? (meta[FLOW_WIDGET_REGISTRY_METADATA_KEY] as Array<Record<string, unknown>>)
    : []
  const forms = registry.map(r => String(r.formId || '').trim()).filter(Boolean).sort()
  if (JSON.stringify(forms) !== JSON.stringify(['fm:a', 'fm:b'])) {
    throw new Error(`expected only flow widget forms for loader parse, got ${JSON.stringify(forms)}`)
  }
}

export function testMarkdownFrontmatterFlowGraphParsesWrappedFlowSettingsAndMultilineComputeEnvelope() {
  const md = [
    '---',
    'flow:',
    '  direction:  {key: direction,  type: string,  value: LR}',
    '  edgeType:   {key: edgeType,   type: string,  value: smoothstep}',
    '  snapToGrid: {key: snapToGrid, type: boolean, value: true}',
    '  computed:   {key: computed,   type: boolean, value: true}',
    '  nodes:',
    '    - id:      {key: id,      type: string,   value: "n-a"}',
    '      type:    {key: type,    type: string,   value: "input"}',
    '      handles: {key: handles, type: object,   value: {source: [signal]}}',
    '      compute: {key: compute, type: function, value: |',
    '        (inputs) => ({',
    '          signal: { ok: true }',
    '        })',
    '      }',
    '    - id:      {key: id,      type: string,   value: "n-b"}',
    '      type:    {key: type,    type: string,   value: "output"}',
    '      handles: {key: handles, type: object,   value: {target: [signal]}}',
    '  edges:',
    '    - { id: e1, source: n-a, sourceHandle: signal, target: n-b, targetHandle: signal }',
    '---',
  ].join('\n')

  const res = tryParseMarkdownFrontmatterFlowGraph('wrapped-flow-settings-compute.md', md)
  if (!res) throw new Error('expected wrapped flow settings + multiline compute envelope parse result')
  const g = res.graphData
  if (String(g.context || '').trim() !== 'frontmatter-flow') throw new Error('expected frontmatter-flow context')
  const ids = (g.nodes || []).map(n => String(n.id || '').trim()).filter(Boolean).sort()
  if (JSON.stringify(ids) !== JSON.stringify(['n-a', 'n-b'])) {
    throw new Error(`expected n-a/n-b flow nodes only, got ${JSON.stringify(ids)}`)
  }
  const meta = (g.metadata || {}) as Record<string, unknown>
  const settings = (meta.frontmatterFlowSettings || {}) as Record<string, unknown>
  if (String(settings.direction || '').trim() !== 'LR') throw new Error('expected wrapped flow.direction to parse as LR')
  if (String(settings.edgeType || '').trim() !== 'smoothstep') throw new Error('expected wrapped flow.edgeType to parse as smoothstep')
  if (settings.snapToGrid !== true || settings.computed !== true) throw new Error('expected wrapped flow boolean settings to parse as true')
}

export function testMarkdownFrontmatterFlowGraphChatKnowgrphUsesLeadingKgcBlockOnlyAndDedupesEdges() {
  const md = [
    '---',
    'doc:',
    '  id: "doc:kgc:turn:demo"',
    '  type: chatKnowgrph',
    'flow:',
    '  nodes:',
    '    - id: n-in',
    '      type: input',
    '      handles:',
    '        source: [turn]',
    '    - id: n-out',
    '      type: output',
    '      handles:',
    '        target: [turn]',
    '  edges:',
    '    - id: e-front',
    '      source: n-in.turn',
    '      target: n-out.turn',
    '---',
    '',
    '# Trailing chat history',
    '',
    '| Edge | From port | To port | Type |',
    '|---|---|---|---|',
    '| e-history | `n-in.turn` | `n-out.turn` | `STRING` |',
    '',
  ].join('\n')

  const res = tryParseMarkdownFrontmatterFlowGraph('kgc-chat.md', md)
  if (!res) throw new Error('expected chatKnowgrph frontmatter-flow parse result')

  const g = res.graphData
  if (g.nodes.length !== 2) throw new Error(`expected 2 nodes from leading KGC block, got ${g.nodes.length}`)
  if (g.edges.length !== 1) throw new Error(`expected 1 deduped edge from leading KGC block, got ${g.edges.length}`)
  const edge = g.edges[0]
  if (String(edge.source || '') !== 'n-in' || String(edge.target || '') !== 'n-out') {
    throw new Error('expected canonical edge endpoints without @node prefix drift')
  }
}

export function testMarkdownFrontmatterFlowGraphFlowBlockParsesDottedEdgeEndpointsForWidgetLinks() {
  const md = [
    '---',
    'doc:',
    '  type: chatKnowgrph',
    'flow:',
    '  nodes:',
    '    - id: n-in',
    '      type: input',
    '      handles:',
    '        source: [turn]',
    '    - id: n-out',
    '      type: output',
    '      handles:',
    '        target: [turn]',
    '  edges:',
    '    - source: n-in.turn',
    '      target: n-out.turn',
    '      label: "responds"',
    '---',
    '',
    '# trailing history',
  ].join('\n')

  const res = tryParseMarkdownFrontmatterFlowGraph('kgc-dotted-flow-edges.md', md)
  if (!res) throw new Error('expected frontmatter flow parse result')
  if (res.graphData.edges.length !== 1) throw new Error(`expected 1 parsed edge, got ${res.graphData.edges.length}`)
  const edge = res.graphData.edges[0]!
  const props = (edge.properties || {}) as Record<string, unknown>
  if (String(edge.source || '') !== 'n-in' || String(edge.target || '') !== 'n-out') {
    throw new Error('expected dotted endpoints to resolve to node ids')
  }
  if (String(props[FLOW_EDGE_SOURCE_PORT_KEY] || '') !== 'turn') throw new Error('expected source port from dotted endpoint')
  if (String(props[FLOW_EDGE_TARGET_PORT_KEY] || '') !== 'turn') throw new Error('expected target port from dotted endpoint')
  if (String(edge.label || '') !== 'responds') throw new Error('expected label from dotted flow edge declaration')
}

export function testMarkdownFrontmatterFlowGraphChatKnowgrphKeepsOutputSourceHandlesForWidgetEdgeAnchors() {
  const md = [
    '---',
    'doc:',
    '  type: chatKnowgrph',
    'flow:',
    '  nodes:',
    '    - id: n-in',
    '      type: input',
    '      handles:',
    '        source: [turn]',
    '    - id: n-out',
    '      type: output',
    '      handles:',
    '        target: [turn]',
    '        source: [detail]',
    '  edges:',
    '    - source: n-in.turn',
    '      target: n-out.turn',
    '    - source: n-out.detail',
    '      target: n-in.turn',
    '---',
  ].join('\n')

  const res = tryParseMarkdownFrontmatterFlowGraph('kgc-output-source-handle.md', md)
  if (!res) throw new Error('expected chatKnowgrph flow parse result')
  const registry = ((res.graphData.metadata || {}) as Record<string, unknown>)['flow:widgetRegistry']
  if (!Array.isArray(registry)) throw new Error('expected widget registry metadata')
  const form = registry.find((r: unknown) => {
    const rec = (r || {}) as Record<string, unknown>
    return String(rec.formId || '') === 'fm:n-out'
  }) as Record<string, unknown> | undefined
  if (!form) throw new Error('expected n-out widget form registry entry')
  const ports = Array.isArray(form.ports) ? (form.ports as Array<Record<string, unknown>>) : []
  const hasDetailOutput = ports.some(p => String(p.portKey || '') === 'detail' && String(p.direction || '') === 'output')
  if (!hasDetailOutput) throw new Error('expected chatKnowgrph output node to keep source handle detail for widget edge anchors')
}

export function testMarkdownFrontmatterFlowGraphChatKnowgrphKeepsTurnEdgeDirectionAndHandleMapping() {
  const md = [
    '---',
    'doc:',
    '  type: chatKnowgrph',
    'flow:',
    '  nodes:',
    '    - id: n-recommend-solo-founder-z',
    '      type: input',
    '      handles:',
    '        source: [turn]',
    '    - id: n-solution-1-use-case-prob',
    '      type: output',
    '      handles:',
    '        target: [turn]',
    '        source: [detail]',
    '  edges:',
    '    - source: n-recommend-solo-founder-z.turn',
    '      target: n-solution-1-use-case-prob.turn',
    '      label: "responds"',
    '---',
  ].join('\n')

  const res = tryParseMarkdownFrontmatterFlowGraph('kgc-turn-direction.md', md)
  if (!res) throw new Error('expected chatKnowgrph flow parse result')
  if (res.graphData.edges.length !== 1) throw new Error(`expected exactly 1 edge, got ${res.graphData.edges.length}`)
  const e = res.graphData.edges[0]!
  const props = (e.properties || {}) as Record<string, unknown>
  if (String(e.source || '') !== 'n-recommend-solo-founder-z') {
    throw new Error('expected source node to remain n-recommend-solo-founder-z')
  }
  if (String(e.target || '') !== 'n-solution-1-use-case-prob') {
    throw new Error('expected target node to remain n-solution-1-use-case-prob')
  }
  if (String(props[FLOW_EDGE_SOURCE_PORT_KEY] || '') !== 'turn') {
    throw new Error('expected source handle mapping to port turn')
  }
  if (String(props[FLOW_EDGE_TARGET_PORT_KEY] || '') !== 'turn') {
    throw new Error('expected target handle mapping to port turn')
  }
  if (String(e.label || '') !== 'responds') {
    throw new Error('expected edge label responds')
  }
}

export function testMarkdownFrontmatterFlowGraphChatKnowgrphFlowBlockOverridesLegacyTopLevelNodesAndEdges() {
  const md = [
    '---',
    'doc:',
    '  type: chatKnowgrph',
    'nodes:',
    '  - id: legacy-a',
    '    label: "Legacy A"',
    '  - id: legacy-b',
    '    label: "Legacy B"',
    'edges:',
    '  - source: legacy-a.turn',
    '    target: legacy-b.turn',
    '    label: "legacy-edge"',
    'flow:',
    '  nodes:',
    '    - id: flow-a',
    '      type: input',
    '      handles:',
    '        source: [turn]',
    '    - id: flow-b',
    '      type: output',
    '      handles:',
    '        target: [turn]',
    '  edges:',
    '    - source: flow-a.turn',
    '      target: flow-b.turn',
    '      label: "flow-edge"',
    '---',
  ].join('\n')

  const res = tryParseMarkdownFrontmatterFlowGraph('kgc-flow-overrides-legacy.md', md)
  if (!res) throw new Error('expected parse result')
  const nodeIds = new Set((res.graphData.nodes || []).map(n => String(n.id || '')))
  if (nodeIds.has('legacy-a') || nodeIds.has('legacy-b')) {
    throw new Error('expected legacy top-level nodes to be ignored when flow block is present')
  }
  if (!nodeIds.has('flow-a') || !nodeIds.has('flow-b')) {
    throw new Error('expected only flow block nodes to remain')
  }
  if (res.graphData.edges.length !== 1) throw new Error(`expected only 1 flow edge, got ${res.graphData.edges.length}`)
  const e = res.graphData.edges[0]!
  if (String(e.source || '') !== 'flow-a' || String(e.target || '') !== 'flow-b' || String(e.label || '') !== 'flow-edge') {
    throw new Error('expected only flow block edge to remain')
  }
}

export function testMarkdownFrontmatterFlowGraphFlowBlockOverridesLegacyTopLevelEdgesOutsideChatMode() {
  const md = [
    '---',
    'nodes:',
    '  - id: legacy-a',
    '    label: "Legacy A"',
    '  - id: legacy-b',
    '    label: "Legacy B"',
    'edges:',
    '  - source: legacy-a.turn',
    '    target: legacy-b.turn',
    '    label: "legacy-edge"',
    'flow:',
    '  nodes:',
    '    - id: flow-a',
    '      type: input',
    '      handles:',
    '        source: [turn]',
    '    - id: flow-b',
    '      type: output',
    '      handles:',
    '        target: [turn]',
    '  edges:',
    '    - source: flow-a.turn',
    '      target: flow-b.turn',
    '      label: "flow-edge"',
    '---',
  ].join('\n')

  const res = tryParseMarkdownFrontmatterFlowGraph('flow-overrides-legacy-non-chat.md', md)
  if (!res) throw new Error('expected parse result')
  const nodeIds = new Set((res.graphData.nodes || []).map(n => String(n.id || '')))
  if (nodeIds.has('legacy-a') || nodeIds.has('legacy-b')) {
    throw new Error('expected legacy top-level nodes to be ignored when flow block is present')
  }
  if (!nodeIds.has('flow-a') || !nodeIds.has('flow-b')) {
    throw new Error('expected only flow block nodes to remain')
  }
  if (res.graphData.edges.length !== 1) throw new Error(`expected only 1 flow edge, got ${res.graphData.edges.length}`)
  const e = res.graphData.edges[0]!
  if (String(e.source || '') !== 'flow-a' || String(e.target || '') !== 'flow-b' || String(e.label || '') !== 'flow-edge') {
    throw new Error('expected only flow block edge to remain')
  }
}

export function testMarkdownFrontmatterFlowGraphChatKnowgrphRemovesConflictingComputeAndWiringData() {
  const md = [
    '---',
    'doc:',
    '  type: chatKnowgrph',
    'flow:',
    '  nodes:',
    '    - id: n-a',
    '      type: input',
    '      handles:',
    '        source: [turn]',
    '      compute: "return 42"',
    '      data:',
    '        text: "ok"',
    '        handles: "legacy-should-be-removed"',
    '        compute: "legacy-should-be-removed"',
    '    - id: n-b',
    '      type: output',
    '      handles:',
    '        target: [turn]',
    '  edges:',
    '    - source: n-a.turn',
    '      target: n-b.turn',
    '      label: "responds"',
    '---',
  ].join('\n')

  const res = tryParseMarkdownFrontmatterFlowGraph('kgc-chat-clean-wire.md', md)
  if (!res) throw new Error('expected parse result')
  const nodeA = res.graphData.nodes.find(n => String(n.id || '') === 'n-a')
  if (!nodeA) throw new Error('expected node n-a')
  const props = (nodeA.properties || {}) as Record<string, unknown>
  const data = (props.data || {}) as Record<string, unknown>
  if (Object.prototype.hasOwnProperty.call(props, 'compute')) {
    throw new Error('expected compute to be removed for chatKnowgrph flow nodes')
  }
  if (Object.prototype.hasOwnProperty.call(data, 'handles') || Object.prototype.hasOwnProperty.call(data, 'compute')) {
    throw new Error('expected conflicting wiring/compute keys removed from chatKnowgrph node data')
  }
  if (String(data.text || '') !== 'ok') throw new Error('expected non-conflicting data to remain')
}

export function testMarkdownFrontmatterFlowGraphChatKnowgrphParsesOnlyDeclaredFlowNodeIdsForWidgets() {
  const md = [
    '---',
    'doc:',
    '  type: chatKnowgrph',
    'nodes:',
    '  - id: legacy-n-1',
    '    label: "Legacy 1"',
    '  - id: legacy-n-2',
    '    label: "Legacy 2"',
    'flow:',
    '  nodes:',
    '    - id: n-recommend-solo-founder-z',
    '      type: input',
    '      handles:',
    '        source: [turn]',
    '    - id: n-solution-1-use-case-prob',
    '      type: output',
    '      handles:',
    '        target: [turn]',
    '        source: [detail]',
    '    - id: n-1-use-case-problem-solut',
    '      type: default',
    '      handles:',
    '        target: [detail]',
    '    - id: n-use-case',
    '      type: default',
    '      handles:',
    '        target: [detail]',
    '    - id: n-problem',
    '      type: default',
    '      handles:',
    '        target: [detail]',
    '    - id: n-2-solo-founder-zero-budg',
    '      type: default',
    '      handles:',
    '        target: [detail]',
    '    - id: n-2-1-ship-a-wedge-in-7-14',
    '      type: default',
    '      handles:',
    '        target: [detail]',
    '    - id: n-2-2-tco-first-architectu',
    '      type: default',
    '      handles:',
    '        target: [detail]',
    '    - id: n-2-3-organic-growth-chann',
    '      type: default',
    '      handles:',
    '        target: [detail]',
    '    - id: n-2-4-conversion-loop-free',
    '      type: default',
    '      handles:',
    '        target: [detail]',
    '  edges:',
    '    - source: n-recommend-solo-founder-z.turn',
    '      target: n-solution-1-use-case-prob.turn',
    '      label: "responds"',
    '---',
  ].join('\n')

  const expected = [
    'n-recommend-solo-founder-z',
    'n-solution-1-use-case-prob',
    'n-1-use-case-problem-solut',
    'n-use-case',
    'n-problem',
    'n-2-solo-founder-zero-budg',
    'n-2-1-ship-a-wedge-in-7-14',
    'n-2-2-tco-first-architectu',
    'n-2-3-organic-growth-chann',
    'n-2-4-conversion-loop-free',
  ].sort()

  const res = tryParseMarkdownFrontmatterFlowGraph('kgc-chat-only-flow-node-ids.md', md)
  if (!res) throw new Error('expected parse result')
  const actual = (res.graphData.nodes || []).map(n => String(n.id || '')).filter(Boolean).sort()
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`expected only declared flow node ids, got ${JSON.stringify(actual)}`)
  }
}

export function testMarkdownFrontmatterFlowGraphChatKnowgrphKgcSampleUsesOnlyDeclaredTurnDetailPorts() {
  const md = [
    '---',
    'doc:',
    '  type: chatKnowgrph',
    'flow:',
    '  nodes:',
    '    - id: n-recommend-solo-founder-z',
    '      type: input',
    '      handles:',
    '        source: [turn]',
    '    - id: n-solution-1-use-case-prob',
    '      type: output',
    '      handles:',
    '        target: [turn]',
    '        source: [detail]',
    '    - id: n-1-use-case-problem-solut',
    '      type: default',
    '      handles:',
    '        target: [detail]',
    '    - id: n-use-case',
    '      type: default',
    '      handles:',
    '        target: [detail]',
    '    - id: n-problem',
    '      type: default',
    '      handles:',
    '        target: [detail]',
    '    - id: n-2-solo-founder-zero-budg',
    '      type: default',
    '      handles:',
    '        target: [detail]',
    '    - id: n-2-1-ship-a-wedge-in-7-14',
    '      type: default',
    '      handles:',
    '        target: [detail]',
    '    - id: n-2-2-tco-first-architectu',
    '      type: default',
    '      handles:',
    '        target: [detail]',
    '    - id: n-2-3-organic-growth-chann',
    '      type: default',
    '      handles:',
    '        target: [detail]',
    '    - id: n-2-4-conversion-loop-free',
    '      type: default',
    '      handles:',
    '        target: [detail]',
    '  edges:',
    '    - source: n-recommend-solo-founder-z.turn',
    '      target: n-solution-1-use-case-prob.turn',
    '      label: "responds"',
    '    - source: n-solution-1-use-case-prob.detail',
    '      target: n-1-use-case-problem-solut.detail',
    '      label: "expands"',
    '    - source: n-solution-1-use-case-prob.detail',
    '      target: n-use-case.detail',
    '      label: "expands"',
    '    - source: n-solution-1-use-case-prob.detail',
    '      target: n-problem.detail',
    '      label: "expands"',
    '    - source: n-solution-1-use-case-prob.detail',
    '      target: n-2-solo-founder-zero-budg.detail',
    '      label: "expands"',
    '    - source: n-solution-1-use-case-prob.detail',
    '      target: n-2-1-ship-a-wedge-in-7-14.detail',
    '      label: "expands"',
    '    - source: n-solution-1-use-case-prob.detail',
    '      target: n-2-2-tco-first-architectu.detail',
    '      label: "expands"',
    '    - source: n-solution-1-use-case-prob.detail',
    '      target: n-2-3-organic-growth-chann.detail',
    '      label: "expands"',
    '    - source: n-solution-1-use-case-prob.detail',
    '      target: n-2-4-conversion-loop-free.detail',
    '      label: "expands"',
    '---',
  ].join('\n')

  const res = tryParseMarkdownFrontmatterFlowGraph('kgc-flow-sample.md', md)
  if (!res) throw new Error('expected parse result')
  if (res.graphData.edges.length !== 9) throw new Error(`expected 9 flow edges, got ${res.graphData.edges.length}`)

  const meta = (res.graphData.metadata || {}) as Record<string, unknown>
  const registry = Array.isArray(meta['flow:widgetRegistry']) ? (meta['flow:widgetRegistry'] as Array<Record<string, unknown>>) : []
  if (registry.length < 10) throw new Error(`expected widget registry entries for flow nodes, got ${registry.length}`)

  const forbiddenPortKeys = new Set(['compute', 'data'])
  for (let i = 0; i < registry.length; i += 1) {
    const rec = registry[i]
    const ports = Array.isArray(rec.ports) ? (rec.ports as Array<Record<string, unknown>>) : []
    for (let j = 0; j < ports.length; j += 1) {
      const portKey = String(ports[j]?.portKey || '').trim()
      if (forbiddenPortKeys.has(portKey)) {
        throw new Error(`expected no hard-coded port handle "${portKey}"`)
      }
    }
  }

  const formInput = registry.find(r => String(r.formId || '') === 'fm:n-recommend-solo-founder-z') || null
  if (!formInput) throw new Error('expected form registry for n-recommend-solo-founder-z')
  const inputPorts = Array.isArray(formInput.ports) ? (formInput.ports as Array<Record<string, unknown>>) : []
  const hasInputTurnSource = inputPorts.some(p => String(p.portKey || '') === 'turn' && String(p.direction || '') === 'output')
  if (!hasInputTurnSource) throw new Error('expected n-recommend-solo-founder-z source handle turn')

  const formOutput = registry.find(r => String(r.formId || '') === 'fm:n-solution-1-use-case-prob') || null
  if (!formOutput) throw new Error('expected form registry for n-solution-1-use-case-prob')
  const outputPorts = Array.isArray(formOutput.ports) ? (formOutput.ports as Array<Record<string, unknown>>) : []
  const hasOutputTurnTarget = outputPorts.some(p => String(p.portKey || '') === 'turn' && String(p.direction || '') === 'input')
  const hasOutputDetailSource = outputPorts.some(p => String(p.portKey || '') === 'detail' && String(p.direction || '') === 'output')
  if (!hasOutputTurnTarget || !hasOutputDetailSource) {
    throw new Error('expected n-solution-1-use-case-prob handles target.turn and source.detail')
  }
}

export function testMarkdownFrontmatterFlowGraphChatKnowgrphPrunesUnreferencedHandlesAndKeepsEdgeMappedPorts() {
  const md = [
    '---',
    'doc:',
    '  type: chatKnowgrph',
    'flow:',
    '  nodes:',
    '    - id: n-a',
    '      type: input',
    '      handles:',
    '        source: [turn,unusedOut]',
    '    - id: n-b',
    '      type: output',
    '      handles:',
    '        target: [turn,unusedIn]',
    '        source: [detail,unusedOut2]',
    '  edges:',
    '    - source: n-a.turn',
    '      target: n-b.turn',
    '      label: "responds"',
    '    - source: n-b.detail',
    '      target: n-a.turn',
    '      label: "expands"',
    '---',
  ].join('\n')

  const res = tryParseMarkdownFrontmatterFlowGraph('kgc-handle-prune.md', md)
  if (!res) throw new Error('expected parse result')
  const meta = (res.graphData.metadata || {}) as Record<string, unknown>
  const registry = Array.isArray(meta['flow:widgetRegistry']) ? (meta['flow:widgetRegistry'] as Array<Record<string, unknown>>) : []
  const formA = registry.find(r => String(r.formId || '') === 'fm:n-a')
  const formB = registry.find(r => String(r.formId || '') === 'fm:n-b')
  if (!formA || !formB) throw new Error('expected widget registry forms for n-a and n-b')
  const portsA = Array.isArray(formA.ports) ? formA.ports as Array<Record<string, unknown>> : []
  const portsB = Array.isArray(formB.ports) ? formB.ports as Array<Record<string, unknown>> : []
  const hasA_turn_out = portsA.some(p => String(p.portKey || '') === 'turn' && String(p.direction || '') === 'output')
  const hasA_unusedOut = portsA.some(p => String(p.portKey || '') === 'unusedOut')
  const hasB_turn_in = portsB.some(p => String(p.portKey || '') === 'turn' && String(p.direction || '') === 'input')
  const hasB_detail_out = portsB.some(p => String(p.portKey || '') === 'detail' && String(p.direction || '') === 'output')
  const hasB_unused = portsB.some(p => String(p.portKey || '').toLowerCase().includes('unused'))
  if (!hasA_turn_out || !hasB_turn_in || !hasB_detail_out) {
    throw new Error('expected edge-mapped handle ports to remain')
  }
  if (hasA_unusedOut || hasB_unused) {
    throw new Error('expected unreferenced handles to be pruned in chatKnowgrph flow mode')
  }
}

export function testMarkdownFrontmatterFlowGraphEnforcesNodeTypeHandleAndComputeContract() {
  const md = [
    '---',
    'flow:',
    '  computed: true',
    '  nodes:',
    '    - id: n-input',
    '      type: input',
    '      handles:',
    '        target: [bad_sink]',
    '        source: [out_a]',
    '      compute: |',
    '        (inputs) => ({ out_a: inputs.bad_sink })',
    '      data: []',
    '    - id: n-output',
    '      type: output',
    '      handles:',
    '        target: [in_a]',
    '        source: [bad_source]',
    '      compute: |',
    '        (inputs) => ({ bad_source: inputs.in_a })',
    '      data: "scalar-jsonb"',
    '  edges:',
    '    - id: e1',
    '      source: n-input',
    '      sourceHandle: out_a',
    '      target: n-output',
    '      targetHandle: in_a',
    '---',
    '',
    '# Demo',
  ].join('\n')
  const res = tryParseMarkdownFrontmatterFlowGraph('flow-contract.md', md)
  if (!res) throw new Error('expected parse result')
  const inputNode = res.graphData.nodes.find(n => n.id === 'n-input') || null
  const outputNode = res.graphData.nodes.find(n => n.id === 'n-output') || null
  if (!inputNode || !outputNode) throw new Error('expected input and output nodes')
  const inputProps = (inputNode.properties || {}) as Record<string, unknown>
  const outputProps = (outputNode.properties || {}) as Record<string, unknown>
  if (typeof inputProps['flow:compute'] !== 'string' || !String(inputProps['flow:compute']).trim()) {
    throw new Error('expected input compute to be preserved')
  }
  if (typeof outputProps['flow:compute'] !== 'string' || !String(outputProps['flow:compute']).trim()) {
    throw new Error('expected output compute to be preserved')
  }
  const inputPortTypes = (inputProps['flow:portTypes'] || {}) as { in?: Record<string, unknown>; out?: Record<string, unknown> }
  const outputPortTypes = (outputProps['flow:portTypes'] || {}) as { in?: Record<string, unknown>; out?: Record<string, unknown> }
  if (inputPortTypes.in && Object.keys(inputPortTypes.in).length > 0) throw new Error('expected input node to have no target handles')
  if (outputPortTypes.out && Object.keys(outputPortTypes.out).length > 0) throw new Error('expected output node to have no source handles')
  if ((inputProps.data as unknown[] | null)?.length !== 0) throw new Error('expected input node data to preserve jsonb array')
  if (String(outputProps.data || '') !== 'scalar-jsonb') throw new Error('expected output node data to preserve jsonb scalar')
  const warningBlob = res.warnings.join(' | ')
  if (!warningBlob.includes('input node n-input cannot declare target handles')) throw new Error('expected input sink contract warning')
  if (!warningBlob.includes('output node n-output cannot declare source handles')) throw new Error('expected output source contract warning')
}

function readPitchdeckTemplatePath(): string {
  const envPath = typeof process.env.KG_TEST_PITCHDECK_TEMPLATE_PATH === 'string'
    ? process.env.KG_TEST_PITCHDECK_TEMPLATE_PATH.trim()
    : ''
  if (envPath) return envPath
  const cwd = process.cwd()
  const fallback = path.resolve(cwd, '..', '..', 'huijoohwee.github.io', 'docs', 'pitchdeck-prd-tad-template-lite.md')
  return fallback
}

export function testMarkdownFrontmatterFlowGraphFidelityPitchdeckTemplateLite() {
  const templatePath = readPitchdeckTemplatePath()
  if (!templatePath || !fs.existsSync(templatePath)) return
  const md = fs.readFileSync(templatePath, 'utf8')
  const res = tryParseMarkdownFrontmatterFlowGraph(path.basename(templatePath), md)
  if (!res) throw new Error('expected pitchdeck frontmatter flow parse result')
  const g = res.graphData
  if (g.context !== 'frontmatter-flow') throw new Error('expected frontmatter-flow context')
  const flowNodes = g.nodes.filter(n => {
    const type = String(n?.type || '').trim()
    return type === 'input' || type === 'default' || type === 'output' || type === 'custom'
  })
  const flowEdges = g.edges.filter(e => {
    const props = (e.properties || {}) as Record<string, unknown>
    const sourcePort = String(props[FLOW_EDGE_SOURCE_PORT_KEY] || '')
    const targetPort = String(props[FLOW_EDGE_TARGET_PORT_KEY] || '')
    return !!sourcePort && !!targetPort
  })
  if (flowNodes.length < 12) throw new Error(`expected at least 12 typed flow nodes, got ${flowNodes.length}`)
  if (flowEdges.length !== 13) throw new Error(`expected 13 handle-linked flow edges, got ${flowEdges.length}`)
  const byType = new Map<string, number>()
  for (let i = 0; i < flowNodes.length; i += 1) {
    const type = String(flowNodes[i]?.type || '').trim()
    byType.set(type, (byType.get(type) || 0) + 1)
  }
  if ((byType.get('input') || 0) !== 3) throw new Error(`expected 3 input nodes, got ${String(byType.get('input') || 0)}`)
  if ((byType.get('default') || 0) < 5) throw new Error(`expected at least 5 default nodes, got ${String(byType.get('default') || 0)}`)
  if ((byType.get('output') || 0) !== 2) throw new Error(`expected 2 output nodes, got ${String(byType.get('output') || 0)}`)
  if ((byType.get('custom') || 0) !== 2) throw new Error(`expected 2 custom nodes, got ${String(byType.get('custom') || 0)}`)

  const nodeById = new Map(g.nodes.map(n => [String(n.id || ''), n] as const))
  const fnConfig = nodeById.get('fn-config') || null
  if (!fnConfig) throw new Error('expected fn-config input node')
  const fnConfigData = (((fnConfig.properties || {}) as Record<string, unknown>).data || {}) as Record<string, unknown>
  if (String(fnConfigData.ai_proxy || '') !== '[AI proxy]') throw new Error('expected frontmatter variable resolution in fn-config.data.ai_proxy')

  const fnPersona = nodeById.get('fn-persona') || null
  if (!fnPersona) throw new Error('expected fn-persona input node')
  const fnPersonaData = (((fnPersona.properties || {}) as Record<string, unknown>).data || {}) as Record<string, unknown>
  if (String(fnPersonaData.pain_a || '') !== '[Pain point A]') throw new Error('expected {{pain-a}} resolution for fn-persona.data.pain_a')

  const fnScore = nodeById.get('fn-score') || null
  if (!fnScore) throw new Error('expected fn-score default node')
  const fnScoreCompute = String((((fnScore.properties || {}) as Record<string, unknown>)['flow:compute']) || '')
  if (fnScoreCompute) throw new Error('expected unsafe eval compute to be rejected for fn-score')

  const fnApi = nodeById.get('fn-api') || null
  if (!fnApi) throw new Error('expected fn-api default node')
  const fnApiCompute = String((((fnApi.properties || {}) as Record<string, unknown>)['flow:compute']) || '')
  if (!fnApiCompute.includes('json_payload')) throw new Error('expected fn-api compute to be preserved')

  const handleNames = new Set<string>()
  for (let i = 0; i < flowEdges.length; i += 1) {
    const props = (flowEdges[i].properties || {}) as Record<string, unknown>
    handleNames.add(String(props[FLOW_EDGE_SOURCE_PORT_KEY] || ''))
    handleNames.add(String(props[FLOW_EDGE_TARGET_PORT_KEY] || ''))
  }
  const requiredHandles = ['pain_signal', 'raw_items', 'vars', 'clean_items', 'typed_nodes', 'scored_nodes', 'alert_signal', 'json_payload']
  for (let i = 0; i < requiredHandles.length; i += 1) {
    if (!handleNames.has(requiredHandles[i])) throw new Error(`expected flow handle ${requiredHandles[i]} in parsed edges`)
  }
}

function readMarkdownSyntaxComputingFlowSamplePath(): string {
  const envPath = typeof process.env.KG_TEST_MARKDOWN_SYNTAX_COMPUTING_FLOW_SAMPLE_PATH === 'string'
    ? process.env.KG_TEST_MARKDOWN_SYNTAX_COMPUTING_FLOW_SAMPLE_PATH.trim()
    : ''
  if (envPath) return envPath
  const cwd = process.cwd()
  return path.resolve(cwd, '..', '..', 'sandbox', 'test-data', 'markdown-syntax-computing-flow-sample.md')
}

function readMarkdownSyntaxComputingFlowRfSamplePath(): string {
  const envPath = typeof process.env.KG_TEST_MARKDOWN_SYNTAX_COMPUTING_FLOW_RF_SAMPLE_PATH === 'string'
    ? process.env.KG_TEST_MARKDOWN_SYNTAX_COMPUTING_FLOW_RF_SAMPLE_PATH.trim()
    : ''
  if (envPath) return envPath
  const cwd = process.cwd()
  return path.resolve(cwd, '..', '..', 'sandbox', 'test-data', 'markdown-syntax-computing-flow-rf-sample.md')
}

function readKgcAiPipelinePrdTadPath(): string {
  const envPath = typeof process.env.KG_TEST_KGC_PIPELINE_PRD_TAD_PATH === 'string'
    ? process.env.KG_TEST_KGC_PIPELINE_PRD_TAD_PATH.trim()
    : ''
  if (envPath) return envPath
  const cwd = process.cwd()
  return path.resolve(cwd, '..', '..', '..', 'huijoohwee.github.io', 'docs', 'kgc-ai-pipeline-prd-tad.md')
}

export function testMarkdownFrontmatterFlowGraphFidelityMarkdownSyntaxComputingFlowSample() {
  const samplePath = readMarkdownSyntaxComputingFlowSamplePath()
  if (!samplePath || !fs.existsSync(samplePath)) return
  const md = fs.readFileSync(samplePath, 'utf8')
  const res = tryParseMarkdownFrontmatterFlowGraph(path.basename(samplePath), md)
  if (!res) throw new Error('expected computing-flow sample frontmatter parse result')
  const g = res.graphData
  if (g.context !== 'frontmatter-flow') throw new Error('expected frontmatter-flow context')

  const typedNodes = g.nodes.filter(n => {
    const type = String(n?.type || '').trim()
    return type === 'input' || type === 'default' || type === 'output' || type === 'custom'
  })
  if (typedNodes.length !== 9) throw new Error(`expected 9 typed flow nodes, got ${typedNodes.length}`)
  const byType = new Map<string, number>()
  for (let i = 0; i < typedNodes.length; i += 1) {
    const type = String(typedNodes[i]?.type || '').trim()
    byType.set(type, (byType.get(type) || 0) + 1)
  }
  if ((byType.get('input') || 0) !== 2) throw new Error('expected 2 input nodes')
  if ((byType.get('default') || 0) !== 4) throw new Error('expected 4 default nodes')
  if ((byType.get('output') || 0) !== 2) throw new Error('expected 2 output nodes')
  if ((byType.get('custom') || 0) !== 1) throw new Error('expected 1 custom node')

  const flowEdges = g.edges.filter(e => {
    const props = (e.properties || {}) as Record<string, unknown>
    const sourcePort = String(props[FLOW_EDGE_SOURCE_PORT_KEY] || '')
    const targetPort = String(props[FLOW_EDGE_TARGET_PORT_KEY] || '')
    return !!sourcePort && !!targetPort
  })
  if (flowEdges.length !== 11) throw new Error(`expected 11 handle-linked edges, got ${flowEdges.length}`)

  const nodeById = new Map(g.nodes.map(n => [String(n.id || ''), n] as const))
  const configNode = nodeById.get('n-config') || null
  if (!configNode) throw new Error('expected n-config input node')
  const configData = (((configNode.properties || {}) as Record<string, unknown>).data || {}) as Record<string, unknown>
  if (String(configData.demo_url || '') !== 'https://treehacks-2026.devpost.com/project-gallery') {
    throw new Error('expected frontmatter variable resolution for n-config.data.demo_url')
  }
  if (configData.threshold !== 0.75) {
    throw new Error('expected numeric frontmatter variable resolution for n-config.data.threshold')
  }
  if (String(configData.score_formula || '') !== 'demos.length * 0.4 + (winner ? 0.6 : 0)') {
    throw new Error('expected frontmatter variable resolution for n-config.data.score_formula')
  }

  const unresolvedLabelEdge = flowEdges.find(e => String(e.id || '') === 'fe-06') || null
  if (!unresolvedLabelEdge) throw new Error('expected fe-06 edge')
  if (String(unresolvedLabelEdge.label || '') !== 'confidence ≥ high') {
    throw new Error('expected edge labels to resolve dotted flow-node data references')
  }

  const scoreNode = nodeById.get('n-score') || null
  if (!scoreNode) throw new Error('expected n-score default node')
  const scoreCompute = String((((scoreNode.properties || {}) as Record<string, unknown>)['flow:compute']) || '')
  if (!scoreCompute.includes('scored_demos')) throw new Error('expected n-score compute to be preserved')

  const waitingNode = nodeById.get('n-gallery') || null
  if (!waitingNode) throw new Error('expected n-gallery output node')
  const waitingProps = (waitingNode.properties || {}) as Record<string, unknown>
  if (waitingProps['frontmatter:waiting'] !== true) throw new Error('expected frontmatter:waiting for TBD repo_url')
  const waitingData = (waitingProps.data || {}) as Record<string, unknown>
  if (waitingData.repo_url !== null) throw new Error('expected repo_url TBD to normalize as null')

  const flowWarnings = res.warnings.filter(w => w.includes('Flow node contract violation') || w.includes('Flow node compute rejected as unsafe'))
  if (flowWarnings.length > 0) throw new Error(`expected no flow contract warnings for sample, got: ${flowWarnings.join(' | ')}`)
}

export function testMarkdownFrontmatterFlowGraphFidelityKgcAiPipelinePrdTadTopLevelSections() {
  const samplePath = readKgcAiPipelinePrdTadPath()
  if (!samplePath || !fs.existsSync(samplePath)) return
  const md = fs.readFileSync(samplePath, 'utf8')
  const res = tryParseMarkdownFrontmatterFlowGraph(path.basename(samplePath), md)
  if (!res) throw new Error('expected KGC pipeline PRD/TAD frontmatter parse result')
  const g = res.graphData
  if (String(g.context || '').trim() !== 'frontmatter-flow') throw new Error('expected frontmatter-flow context')
  if (!Array.isArray(g.nodes) || g.nodes.length !== 5) throw new Error(`expected 5 flow nodes, got ${g.nodes.length}`)
  if (!Array.isArray(g.edges) || g.edges.length !== 5) throw new Error(`expected 5 flow edges, got ${g.edges.length}`)

  const meta = (g.metadata || {}) as Record<string, unknown>
  const frontmatterMeta = (meta.frontmatterMeta || null) as Record<string, unknown> | null
  if (!frontmatterMeta || typeof frontmatterMeta !== 'object') throw new Error('expected metadata.frontmatterMeta for top-level frontmatter sections')

  if (String(frontmatterMeta.product || '') !== '{{product}}') throw new Error('expected Tier B placeholder product in frontmatterMeta')
  if (String(frontmatterMeta.subject || '') !== '{{subject}}') throw new Error('expected Tier B placeholder subject in frontmatterMeta')
  const runtime = (frontmatterMeta.runtime || null) as Record<string, unknown> | null
  if (!runtime || typeof runtime !== 'object') throw new Error('expected runtime block in frontmatterMeta')
  const runtimeEntry = (runtime.entry || null) as Record<string, unknown> | null
  const runtimeExit = (runtime.exit || null) as Record<string, unknown> | null
  if (String(runtimeEntry?.value || '') !== 'n-trigger') throw new Error('expected runtime.entry.value=n-trigger')
  if (String(runtimeExit?.value || '') !== 'n-deliver') throw new Error('expected runtime.exit.value=n-deliver')

  const pipeline = Array.isArray(frontmatterMeta.pipeline) ? frontmatterMeta.pipeline as Array<Record<string, unknown>> : null
  if (!pipeline || pipeline.length !== 5) throw new Error('expected 5 pipeline steps in frontmatterMeta')
  if (String((pipeline[0] || {}).seq || '') !== 'S01' || String((pipeline[4] || {}).seq || '') !== 'S05') {
    throw new Error('expected pipeline S01..S05 sequence in frontmatterMeta')
  }

  const mermaid = String(frontmatterMeta.mermaid || '')
  if (!mermaid.includes('flowchart LR')) throw new Error('expected mermaid block preserved in frontmatterMeta')
  const flow = (frontmatterMeta.flow || null) as Record<string, unknown> | null
  if (!flow || typeof flow !== 'object') throw new Error('expected flow block in frontmatterMeta')
  const flowNodes = Array.isArray(flow.nodes) ? flow.nodes : []
  if (flowNodes.length !== 5) throw new Error(`expected 5 flow.nodes in frontmatterMeta, got ${flowNodes.length}`)
  const flowEdges = Array.isArray(flow.edges) ? flow.edges : []
  if (flowEdges.length !== 5) throw new Error(`expected 5 flow.edges in frontmatterMeta, got ${flowEdges.length}`)
}

export function testMarkdownFrontmatterFlowGraphFidelityMarkdownSyntaxComputingFlowRfSample() {
  const samplePath = readMarkdownSyntaxComputingFlowRfSamplePath()
  if (!samplePath || !fs.existsSync(samplePath)) return
  const md = fs.readFileSync(samplePath, 'utf8')
  const res = tryParseMarkdownFrontmatterFlowGraph(path.basename(samplePath), md)
  if (!res) throw new Error('expected computing-flow-rf sample frontmatter parse result')
  const g = res.graphData
  if (g.context !== 'frontmatter-flow') throw new Error('expected frontmatter-flow context')

  const typedNodes = g.nodes.filter(n => {
    const type = String(n?.type || '').trim()
    return type === 'input' || type === 'default' || type === 'output'
  })
  if (typedNodes.length !== 7) throw new Error(`expected 7 typed flow nodes, got ${typedNodes.length}`)
  const byType = new Map<string, number>()
  for (let i = 0; i < typedNodes.length; i += 1) {
    const type = String(typedNodes[i]?.type || '').trim()
    byType.set(type, (byType.get(type) || 0) + 1)
  }
  if ((byType.get('input') || 0) !== 3) throw new Error('expected 3 input nodes')
  if ((byType.get('default') || 0) !== 2) throw new Error('expected 2 default nodes')
  if ((byType.get('output') || 0) !== 2) throw new Error('expected 2 output nodes')

  const flowEdges = g.edges.filter(e => {
    const props = (e.properties || {}) as Record<string, unknown>
    const sourcePort = String(props[FLOW_EDGE_SOURCE_PORT_KEY] || '')
    const targetPort = String(props[FLOW_EDGE_TARGET_PORT_KEY] || '')
    return !!sourcePort && !!targetPort
  })
  if (flowEdges.length !== 6) throw new Error(`expected 6 handle-linked edges, got ${flowEdges.length}`)

  const nodeById = new Map(g.nodes.map(n => [String(n.id || ''), n] as const))
  const inputNode = nodeById.get('1') || null
  if (!inputNode) throw new Error('expected node 1')
  const inputData = (((inputNode.properties || {}) as Record<string, unknown>).data || {}) as Record<string, unknown>
  if (!String(inputData.note || '').includes('@flag:local state for UI; data object for downstream')) {
    throw new Error('expected NumberInput advisory flag in node 1 data.note')
  }

  const colorNode = nodeById.get('4') || null
  if (!colorNode) throw new Error('expected node 4')
  const colorData = (((colorNode.properties || {}) as Record<string, unknown>).data || {}) as Record<string, unknown>
  if (!String(colorData.note || '').includes('@flag:CustomHandle isolates per-handle connection state')) {
    throw new Error('expected ColorPreview advisory flag in node 4 data.note')
  }

  const edge = flowEdges.find(e => String(e.id || '') === 'e7-8') || null
  if (!edge) throw new Error('expected e7-8 edge')
  const edgeProps = (edge.properties || {}) as Record<string, unknown>
  if (String(edgeProps[FLOW_EDGE_SOURCE_PORT_KEY] || '') !== 'color') throw new Error('expected e7-8 source port color')
  if (String(edgeProps[FLOW_EDGE_TARGET_PORT_KEY] || '') !== 'color') throw new Error('expected e7-8 target port color')

  const positions: Record<string, { x: number; y: number }> = {}
  for (let i = 0; i < g.nodes.length; i += 1) {
    const n = g.nodes[i]
    const id = String(n.id || '').trim()
    if (!id) continue
    const x = (n as unknown as { x?: unknown }).x
    const y = (n as unknown as { y?: unknown }).y
    if (typeof x === 'number' && Number.isFinite(x) && typeof y === 'number' && Number.isFinite(y)) {
      positions[id] = { x, y }
    }
  }
  const runtime = { rankdir: 'LR', scene: null, dirty: false } as unknown as {
    rankdir: 'TB' | 'LR'
    scene: unknown
    dirty: boolean
  }
  buildAndSetFlowNativeScene({
    runtime: runtime as never,
    graphData: g,
    positions,
    schema: null,
    forbidCircleNodes: false,
    flowConfig: readFlowConfig({ schema: null, rankdir: 'LR' }),
    sceneGroups: [],
    rankdir: 'LR',
    widgetRegistry: [],
  })
  const scene = runtime.scene as unknown as { nodes?: Array<{ id?: unknown }>; edges?: Array<{ id?: unknown }> } | null
  if (!scene || !Array.isArray(scene.nodes) || scene.nodes.length < 7) throw new Error('expected Flow native scene nodes for RF sample')
  if (!Array.isArray(scene.edges) || scene.edges.length < 6) throw new Error('expected Flow native scene edges for RF sample')

  const flowWarnings = res.warnings.filter(w => w.includes('Flow node contract violation') || w.includes('Flow node compute rejected as unsafe'))
  if (flowWarnings.length > 0) throw new Error(`expected no flow contract warnings for RF sample, got: ${flowWarnings.join(' | ')}`)
}
