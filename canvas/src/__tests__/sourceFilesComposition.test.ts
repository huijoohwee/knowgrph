import type { GraphData } from '@/lib/graph/types'
import { FLOW_WIDGET_REGISTRY_METADATA_KEY } from '@/lib/config'
import { composeGraphFromSourceLayers } from '@/lib/graph/sourceLayers'

export function testSourceFilesCompositionOrderAndVisibility() {
  const g1: GraphData = {
    type: 'Graph',
    nodes: [{ id: 'n1', label: 'A', type: 'Thing', properties: {} }],
    edges: [],
    metadata: {},
  }
  const g2: GraphData = {
    type: 'Graph',
    nodes: [{ id: 'n2', label: 'B', type: 'Thing', properties: {} }],
    edges: [],
    metadata: {},
  }

  const first = composeGraphFromSourceLayers({
    layers: [
      { id: 'sf-1', name: 'a.md', text: 'a', enabled: true, parsedGraphData: g1, parsedTextHash: 'h1', source: { kind: 'local', path: 'a.md' } },
      { id: 'sf-2', name: 'b.md', text: 'b', enabled: true, parsedGraphData: g2, parsedTextHash: 'h2', source: { kind: 'local', path: 'b.md' } },
    ],
  }).graphData
  const meta1 = (first.metadata || {}) as unknown as Record<string, unknown>
  const layers1Raw = meta1.sourceLayers
  const layerIds1 = Array.isArray(layers1Raw)
    ? layers1Raw
        .map(v => (v && typeof v === 'object' && 'id' in v ? String((v as { id?: unknown }).id || '') : ''))
        .filter(Boolean)
    : []
  if (layerIds1.length !== 2) throw new Error('expected 2 sourceLayers')
  if (layerIds1[0] !== 'sf-1' || layerIds1[1] !== 'sf-2') throw new Error('sourceLayers order mismatch')
  if (first.nodes.map(n => n.id).join(',') !== 'sf-1::n1,sf-2::n2') throw new Error('node order mismatch after compose')

  const contentKey1 = String(meta1.sourceLayerHash || '')
  const orderKey1 = String(meta1.sourceLayerOrderHash || '')
  if (!contentKey1 || !orderKey1) throw new Error('expected composition keys')

  const second = composeGraphFromSourceLayers({
    layers: [
      { id: 'sf-2', name: 'b.md', text: 'b', enabled: true, parsedGraphData: g2, parsedTextHash: 'h2', source: { kind: 'local', path: 'b.md' } },
      { id: 'sf-1', name: 'a.md', text: 'a', enabled: true, parsedGraphData: g1, parsedTextHash: 'h1', source: { kind: 'local', path: 'a.md' } },
    ],
  }).graphData
  const meta2 = (second.metadata || {}) as unknown as Record<string, unknown>
  const layers2Raw = meta2.sourceLayers
  const layerIds2 = Array.isArray(layers2Raw)
    ? layers2Raw
        .map(v => (v && typeof v === 'object' && 'id' in v ? String((v as { id?: unknown }).id || '') : ''))
        .filter(Boolean)
    : []
  if (layerIds2.length !== 2) throw new Error('expected 2 sourceLayers after reorder')
  if (layerIds2[0] !== 'sf-2' || layerIds2[1] !== 'sf-1') throw new Error('sourceLayers order mismatch after reorder')
  if (second.nodes.map(n => n.id).join(',') !== 'sf-2::n2,sf-1::n1') throw new Error('node order mismatch after reorder')

  const contentKey2 = String(meta2.sourceLayerHash || '')
  const orderKey2 = String(meta2.sourceLayerOrderHash || '')
  if (contentKey2 !== contentKey1) throw new Error('content key should not change on reorder')
  if (orderKey2 === orderKey1) throw new Error('order key should change on reorder')

  const third = composeGraphFromSourceLayers({
    layers: [
      { id: 'sf-2', name: 'b.md', text: 'b', enabled: false, parsedGraphData: g2, parsedTextHash: 'h2', source: { kind: 'local', path: 'b.md' } },
      { id: 'sf-1', name: 'a.md', text: 'a', enabled: true, parsedGraphData: g1, parsedTextHash: 'h1', source: { kind: 'local', path: 'a.md' } },
    ],
  }).graphData
  if (third.nodes.length !== 1 || third.nodes[0]?.id !== 'sf-1::n1') throw new Error('expected only enabled layer nodes')
}

export function testSourceFilesCompositionMergesWidgetRegistryMetadataFromNonBaseLayer() {
  const g1: GraphData = {
    type: 'Graph',
    nodes: [{ id: 'n1', label: 'A', type: 'Thing', properties: {} }],
    edges: [],
    metadata: {},
  }
  const g2: GraphData = {
    type: 'Graph',
    nodes: [{ id: 'n2', label: 'Panel', type: 'RichMediaPanel', properties: { 'flow:widgetTypeId': 'default', 'flow:widgetFormId': 'richMediaPanel' } }],
    edges: [],
    metadata: {
      [FLOW_WIDGET_REGISTRY_METADATA_KEY]: [
        {
          id: 'qer-RichMediaPanel-default-richMediaPanel',
          isEnabled: true,
          nodeTypeId: 'RichMediaPanel',
          widgetTypeId: 'default',
          formId: 'richMediaPanel',
          fields: [],
          ports: [{ portKey: 'imageUrl', direction: 'input', schemaPath: 'properties.imageUrl' }],
          updatedAt: '2026-04-22T00:00:00.000Z',
        },
      ],
    },
  }

  const composed = composeGraphFromSourceLayers({
    layers: [
      { id: 'sf-1', name: 'a.md', text: 'a', enabled: true, parsedGraphData: g1, parsedTextHash: 'h1', source: { kind: 'local', path: 'a.md' } },
      { id: 'sf-2', name: 'widget-bundle.frontmatter.yaml', text: 'bundle', enabled: true, parsedGraphData: g2, parsedTextHash: 'h2', source: { kind: 'local', path: 'widget-bundle.frontmatter.yaml' } },
    ],
  }).graphData
  const meta = (composed.metadata || {}) as Record<string, unknown>
  const registry = Array.isArray(meta[FLOW_WIDGET_REGISTRY_METADATA_KEY]) ? (meta[FLOW_WIDGET_REGISTRY_METADATA_KEY] as unknown[]) : []
  if (registry.length !== 1) throw new Error(`expected composed graph to preserve widget registry metadata, got ${registry.length}`)
  const entry = (registry[0] || {}) as Record<string, unknown>
  if (String(entry.nodeTypeId || '') !== 'RichMediaPanel') throw new Error('expected preserved widget registry entry for RichMediaPanel')
}
