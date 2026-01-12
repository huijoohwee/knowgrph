import * as d3 from 'd3';
import type { MutableRefObject } from 'react';
import type { GraphData, GraphNode, GraphEdge } from '@/lib/graph/types';
import type { GraphSchema } from '@/lib/graph/schema';
import type { TidyTreeDerivation } from '@/components/GraphCanvas/utils';
import { computeTidyTreeLabelVisibility } from '@/components/GraphCanvas/tidyTreeLabelLod';
import { getRenderNodeRadius2d, hasNodeMedia } from '@/components/GraphCanvas/helpers';

type GSelection = d3.Selection<SVGGElement, unknown, null, undefined>;

export const createLabelsLayer = (args: {
  g: GSelection;
  graphData: GraphData;
  schema: GraphSchema;
  edgesForDisplay: GraphEdge[];
  tidyTreeDerivation: TidyTreeDerivation | null;
  labelsSelRef: MutableRefObject<d3.Selection<SVGTextElement, GraphNode, SVGGElement, unknown> | null>;
  renderMediaAsNodes: boolean;
  graphLayersVisible: boolean;
}) => {
  const {
    g,
    graphData,
    schema,
    edgesForDisplay,
    tidyTreeDerivation,
    labelsSelRef,
    renderMediaAsNodes,
    graphLayersVisible,
  } = args;
  const isTidyTree = schema.layout?.mode === 'tidy-tree';
  const tidyCfg = schema.layout?.tidyTree || {};
  const tidyColorMode = tidyCfg.colorMode === 'schema' ? 'schema' : 'observable';
  const direction = tidyTreeDerivation?.direction ?? 'source-target';
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
  const tidyTreeLabelVisibility = isTidyTree
    ? computeTidyTreeLabelVisibility({ nodes, edgesForDisplay, direction, lod: schema.performance?.lod?.tidyTree })
    : null;
  const nodesWithChildren = new Set<string>();
  if (isTidyTree) {
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
    if (!isTidyTree) return schema.labelStyles?.fontSize ?? 12;
    const raw = tidyCfg.labelFontSize;
    if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return raw;
    const fromLabelStyles = schema.labelStyles?.fontSize;
    if (typeof fromLabelStyles === 'number' && Number.isFinite(fromLabelStyles) && fromLabelStyles > 0) return fromLabelStyles;
    return 10;
  })();
  const labelFontFamily = (() => {
    if (!isTidyTree) return null;
    const raw = typeof tidyCfg.labelFontFamily === 'string' ? tidyCfg.labelFontFamily.trim() : '';
    return raw ? raw : 'sans-serif';
  })();
  const labelFill = (() => {
    if (!isTidyTree) return schema.labelStyles?.color ?? '#111';
    if (tidyColorMode === 'schema') return schema.labelStyles?.color ?? '#111';
    const override = typeof tidyCfg.linkStroke === 'string' ? tidyCfg.linkStroke.trim() : '';
    return override || '#555';
  })();
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
    .attr('data-lod-hidden', (d: GraphNode) => {
      if (!isTidyTree) return '0';
      const id = String(d.id);
      return tidyTreeLabelVisibility && tidyTreeLabelVisibility.has(id) ? '0' : '1';
    })
    .attr('data-zoom-lod-hidden', '0')
    .attr('dx', (d: GraphNode) => {
      if (!isTidyTree) return schema.labelStyles?.offset?.dx ?? 12;
      const id = String(d.id);
      const r = getRenderNodeRadius2d(d, schema);
      const pad = 6;
      if (tidyColorMode === 'observable') {
        const delta = Math.max(pad, r + 3);
        return nodesWithChildren.has(id) ? -delta : delta;
      }
      return nodesWithChildren.has(id) ? -(r + pad) : r + pad;
    })
    .attr('dy', isTidyTree ? '0.32em' : (schema.labelStyles?.offset?.dy ?? 4))
    .attr('data-base-anchor', (d: GraphNode) => {
      if (!isTidyTree) return 'start';
      const id = String(d.id);
      return nodesWithChildren.has(id) ? 'end' : 'start';
    })
    .attr('data-base-dx', (d: GraphNode) => {
      if (!isTidyTree) return String(baseDx);
      const id = String(d.id);
      const r = getRenderNodeRadius2d(d, schema);
      const pad = 6;
      if (tidyColorMode === 'observable') {
        const delta = Math.max(pad, r + 3);
        return String(nodesWithChildren.has(id) ? -delta : delta);
      }
      return String(nodesWithChildren.has(id) ? -(r + pad) : r + pad);
    })
    .attr('data-base-dy', () => {
      if (isTidyTree) return '';
      return String(schema.labelStyles?.offset?.dy ?? 4);
    })
    .attr('fill', labelFill)
    .attr('text-anchor', (d: GraphNode) => {
      if (!isTidyTree) return null;
      const id = String(d.id);
      return nodesWithChildren.has(id) ? 'end' : 'start';
    })
    .attr('paint-order', isTidyTree && tidyColorMode === 'observable' ? 'stroke' : null)
    .attr('stroke', isTidyTree && tidyColorMode === 'observable' ? haloColor : null)
    .attr('stroke-width', isTidyTree && tidyColorMode === 'observable' ? haloWidth : null)
    .attr('stroke-linejoin', isTidyTree && tidyColorMode === 'observable' ? 'round' : null)
    .style('pointer-events', 'none');
  labelsSelRef.current = label as d3.Selection<SVGTextElement, GraphNode, SVGGElement, unknown>;
};
