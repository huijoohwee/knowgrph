import * as d3 from 'd3';
import type { MutableRefObject } from 'react';
import type { GraphData, GraphNode, GraphEdge } from '@/lib/graph/types';
import type { GraphSchema } from '@/lib/graph/schema';
import { getRenderNodeRadius2d, hasNodeMedia } from '@/components/GraphCanvas/helpers';

type GSelection = d3.Selection<SVGGElement, unknown, null, undefined>;

export const createLabelsLayer = (args: {
  g: GSelection;
  graphData: GraphData;
  schema: GraphSchema;
  edgesForDisplay: GraphEdge[];
  labelsSelRef: MutableRefObject<d3.Selection<SVGTextElement, GraphNode, SVGGElement, unknown> | null>;
  renderMediaAsNodes: boolean;
  graphLayersVisible: boolean;
}) => {
  const {
    g,
    graphData,
    schema,
    edgesForDisplay,
    labelsSelRef,
    renderMediaAsNodes,
    graphLayersVisible,
  } = args;
  const isTree = schema.layout?.mode === 'tree';
  const treeCfg = schema.layout?.tree || {};
  const treeColorMode = treeCfg.colorMode === 'schema' ? 'schema' : 'observable';
  const direction = treeCfg.direction ?? 'source-target';
  const rawNodes = Array.isArray(graphData.nodes) ? graphData.nodes : [];
  const layersCfg = schema.layers || {};
  const layerMode = layersCfg.mode || 'property';
  const semanticCfg = layersCfg.semantic || {};
  const semanticHiddenTypes = Array.isArray(semanticCfg.hiddenNodeTypes)
    ? semanticCfg.hiddenNodeTypes.map(t => String(t || '').trim()).filter(Boolean)
    : [];
  const hiddenTypeSet =
    layerMode === 'semantic' && semanticHiddenTypes.length
      ? new Set(semanticHiddenTypes)
      : null;
  const nodes = (() => {
    const base = (() => {
      if (!hiddenTypeSet) return rawNodes;
      const filtered = rawNodes.filter(n => !hiddenTypeSet.has(String(n.type || '')));
      return filtered.length > 0 ? filtered : rawNodes;
    })();
    const withoutMedia = (() => {
      if (!renderMediaAsNodes) return base;
      return base.filter(n => !hasNodeMedia(n));
    })();
    if (!graphLayersVisible) return withoutMedia;
    const filteredForLayers = withoutMedia.filter(n => String(n.type || '') !== 'MermaidSubgraph');
    return filteredForLayers.length > 0 ? filteredForLayers : withoutMedia;
  })();
  
  const nodesWithChildren = new Set<string>();
  if (isTree) {
    for (let i = 0; i < edgesForDisplay.length; i += 1) {
      const e = edgesForDisplay[i];
      const src = String(e.source ?? '');
      const tgt = String(e.target ?? '');
      const parent = direction === 'source-target' ? src : tgt;
      const child = direction === 'source-target' ? tgt : src;
      if (!parent || !child || parent === child) continue;
      nodesWithChildren.add(parent);
    }
  }
  const haloColor = schema.labelStyles?.halo?.color ?? '#ffffff';
  const haloWidthRaw = schema.labelStyles?.halo?.width;
  const haloWidth =
    typeof haloWidthRaw === 'number' && Number.isFinite(haloWidthRaw) && haloWidthRaw > 0 ? haloWidthRaw : 3;
  const labelFontSize = (() => {
    if (!isTree) return schema.labelStyles?.fontSize ?? 12;
    const raw = treeCfg.labelFontSize;
    if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return raw;
    const fromLabelStyles = schema.labelStyles?.fontSize;
    if (typeof fromLabelStyles === 'number' && Number.isFinite(fromLabelStyles) && fromLabelStyles > 0) return fromLabelStyles;
    return 10;
  })();
  const labelFontFamily = (() => {
    if (!isTree) return null;
    const raw = typeof treeCfg.labelFontFamily === 'string' ? treeCfg.labelFontFamily.trim() : '';
    return raw ? raw : 'sans-serif';
  })();
  const labelFill = (() => {
    if (!isTree) return schema.labelStyles?.color ?? '#111';
    if (treeColorMode === 'schema') return schema.labelStyles?.color ?? '#111';
    const override = typeof treeCfg.linkStroke === 'string' ? treeCfg.linkStroke.trim() : '';
    return override || '#555';
  })();
  const isMermaid = schema.layout?.mode === 'mermaid';
  const baseDx = schema.labelStyles?.offset?.dx ?? 12;
  const label = g
    .append('g')
    .selectAll('text')
    .data(nodes)
    .enter()
    .append('text')
    .text((d: GraphNode) => d.label)
    .attr('font-size', labelFontSize)
    .attr('font-family', labelFontFamily)
    .attr('data-lod-hidden', '0')
    .attr('data-zoom-lod-hidden', '0')
    .attr('dx', (d: GraphNode) => {
      if (isMermaid) return 0;
      if (!isTree) return schema.labelStyles?.offset?.dx ?? 12;
      const id = String(d.id);
      const r = getRenderNodeRadius2d(d, schema);
      const pad = 6;
      if (treeColorMode === 'observable') {
        const delta = Math.max(pad, r + 3);
        return nodesWithChildren.has(id) ? -delta : delta;
      }
      return nodesWithChildren.has(id) ? -(r + pad) : r + pad;
    })
    .attr('dy', (d: GraphNode) => {
        if (isMermaid) return '0.35em';
        return isTree ? '0.32em' : (schema.labelStyles?.offset?.dy ?? 4)
    })
    .attr('data-base-anchor', (d: GraphNode) => {
      if (isMermaid) return 'middle';
      if (!isTree) return 'start';
      const id = String(d.id);
      return nodesWithChildren.has(id) ? 'end' : 'start';
    })
    .attr('data-base-dx', (d: GraphNode) => {
      if (isMermaid) return '0';
      if (!isTree) return String(baseDx);
      const id = String(d.id);
      const r = getRenderNodeRadius2d(d, schema);
      const pad = 6;
      if (treeColorMode === 'observable') {
        const delta = Math.max(pad, r + 3);
        return String(nodesWithChildren.has(id) ? -delta : delta);
      }
      return String(nodesWithChildren.has(id) ? -(r + pad) : r + pad);
    })
    .attr('data-base-dy', () => {
      if (isMermaid) return '0.35em';
      if (isTree) return '';
      return String(schema.labelStyles?.offset?.dy ?? 4);
    })
    .attr('fill', labelFill)
    .attr('text-anchor', (d: GraphNode) => {
      if (isMermaid) return 'middle';
      if (!isTree) return null;
      const id = String(d.id);
      return nodesWithChildren.has(id) ? 'end' : 'start';
    })
    .attr('paint-order', isTree && treeColorMode === 'observable' ? 'stroke' : null)
    .attr('stroke', isTree && treeColorMode === 'observable' ? haloColor : null)
    .attr('stroke-width', isTree && treeColorMode === 'observable' ? haloWidth : null)
    .attr('stroke-linejoin', isTree && treeColorMode === 'observable' ? 'round' : null)
    .style('pointer-events', 'none');
  labelsSelRef.current = label as d3.Selection<SVGTextElement, GraphNode, SVGGElement, unknown>;
};
