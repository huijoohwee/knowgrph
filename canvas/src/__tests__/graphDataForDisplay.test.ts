import { getGraphDataForDisplay } from '@/components/GraphCanvas/displayFilter'
import { FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID } from '@/lib/config.flow-editor'
import type { GraphData } from '@/lib/graph/types'

export const testGraphDataForDisplayFiltersNodesAndEdgesTogether = () => {
  const graphData: GraphData = {
    type: 'Graph',
    context: 'test',
    metadata: {},
    nodes: [
      { id: 'h1', type: 'Section', label: 'H1', properties: { level: 1 }, metadata: {} },
      { id: 'a', type: 'Entity', label: 'A', properties: {}, metadata: {} },
    ],
    edges: [
      { id: 'e1', source: 'h1', target: 'a', label: 'contains', properties: {}, metadata: {} },
      { id: 'e2', source: 'a', target: 'a', label: 'self', properties: {}, metadata: {} },
    ],
  }

  const display = getGraphDataForDisplay({ graphData })
  const nodeIds = new Set((display.nodes || []).map(n => String((n as { id?: unknown }).id)))
  if (nodeIds.has('h1')) throw new Error('expected Section heading node to be filtered from display nodes')
  if (!nodeIds.has('a')) throw new Error('expected Entity node to remain in display nodes')
  const edgeIds = new Set((display.edges || []).map(e => String((e as { id?: unknown }).id)))
  if (edgeIds.has('e1')) throw new Error('expected edge with filtered endpoint to be removed')
  if (!edgeIds.has('e2')) throw new Error('expected edge between display endpoints to remain')
}

export const testGraphDataForDisplayKeepsFilteredEndpointsWhenAllEdgesWouldDisappear = () => {
  const graphData: GraphData = {
    type: 'Graph',
    context: 'test',
    metadata: {},
    nodes: [
      { id: 'h1', type: 'Section', label: 'H1', properties: { level: 1 }, metadata: {} },
      { id: 'p1', type: 'Paragraph', label: 'P1', properties: {}, metadata: {} },
    ],
    edges: [{ id: 'e1', source: 'h1', target: 'p1', label: 'hasSection', properties: {}, metadata: {} }],
  }

  const display = getGraphDataForDisplay({ graphData })
  const nodeIds = new Set((display.nodes || []).map(n => String((n as { id?: unknown }).id)))
  if (!nodeIds.has('h1')) throw new Error('expected filtered heading node to be restored when it carries all edges')
  if (!nodeIds.has('p1')) throw new Error('expected paragraph node to remain')
  const edgeIds = new Set((display.edges || []).map(e => String((e as { id?: unknown }).id)))
  if (!edgeIds.has('e1')) throw new Error('expected edge to be preserved when it would otherwise disappear')
}

export const testGraphDataForDisplayKeepsKeywordSourceWhenAllEdgesWouldDisappear = () => {
  const graphData: GraphData = {
    type: 'Graph',
    context: 'test',
    metadata: {},
    nodes: [
      { id: 'doc:a', type: 'KeywordSource', label: 'A', properties: {}, metadata: {} },
      { id: 'kw:x', type: 'Entity', label: 'X', properties: {}, metadata: {} },
    ],
    edges: [{ id: 'e1', source: 'doc:a', target: 'kw:x', label: 'mentions', properties: {}, metadata: {} }],
  }

  const display = getGraphDataForDisplay({ graphData })
  const nodeIds = new Set((display.nodes || []).map(n => String((n as { id?: unknown }).id)))
  if (!nodeIds.has('doc:a')) throw new Error('expected KeywordSource node to be restored when it carries all edges')
  if (!nodeIds.has('kw:x')) throw new Error('expected keyword node to remain')
  const edgeIds = new Set((display.edges || []).map(e => String((e as { id?: unknown }).id)))
  if (!edgeIds.has('e1')) throw new Error('expected mention edge to be preserved')
}

export const testGraphDataForDisplayFrontmatterSuppressesParagraphAndList = () => {
  const graphData: GraphData = {
    type: 'Graph',
    context: 'markdown',
    metadata: { kind: 'frontmatter-flow' },
    nodes: [
      { id: 'm1', type: 'MermaidNode', label: 'M1', properties: { mermaidScope: 'frontmatter' }, metadata: {} },
      { id: 'p1', type: 'Paragraph', label: 'Paragraph 1', properties: {}, metadata: {} },
      { id: 'l1', type: 'List', label: 'List 1', properties: {}, metadata: {} },
    ],
    edges: [
      { id: 'e1', source: 'm1', target: 'p1', label: 'hasBlock', properties: {}, metadata: {} },
      { id: 'e2', source: 'p1', target: 'l1', label: 'next', properties: {}, metadata: {} },
    ],
  }

  const display = getGraphDataForDisplay({ graphData })
  const nodeIds = new Set((display.nodes || []).map(n => String((n as { id?: unknown }).id)))
  if (!nodeIds.has('m1')) throw new Error('expected frontmatter mermaid node to remain')
  if (nodeIds.has('p1')) throw new Error('expected Paragraph node to be suppressed in frontmatter display')
  if (nodeIds.has('l1')) throw new Error('expected List node to be suppressed in frontmatter display')
  if ((display.edges || []).length !== 0) throw new Error('expected edges connected only to suppressed nodes to be removed')
}

export const testGraphDataForDisplayKeepsRichMediaPanelWithoutLocalMediaSpec = () => {
  const graphData: GraphData = {
    type: 'Graph',
    context: 'test',
    metadata: {},
    nodes: [
      { id: 'widget-1', type: 'TextGeneration', label: 'OpenAI Text Widget', properties: { output: 'hello' }, metadata: {} },
      { id: 'panel-1', type: FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID, label: 'Rich Media Panel', properties: {}, metadata: {} },
    ],
    edges: [
      { id: 'edge-1', source: 'widget-1', target: 'panel-1', label: 'linksTo', properties: {}, metadata: {} },
    ],
  }

  const display = getGraphDataForDisplay({ graphData })
  const nodeIds = new Set((display.nodes || []).map(n => String((n as { id?: unknown }).id)))
  if (!nodeIds.has('panel-1')) throw new Error('expected Rich Media Panel node to stay in display graph before connected values are rendered')
  const edgeIds = new Set((display.edges || []).map(e => String((e as { id?: unknown }).id)))
  if (!edgeIds.has('edge-1')) throw new Error('expected edge to Rich Media Panel to stay visible with the panel node')
}
