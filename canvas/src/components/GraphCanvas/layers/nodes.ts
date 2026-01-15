import * as d3 from 'd3';
import type { MutableRefObject } from 'react';
import type { GraphNode, GraphEdge, GraphData } from '@/lib/graph/types';
import type { GraphSchema } from '@/lib/graph/schema';
import type { PendingLink, TempLinkSelection } from '@/features/edge-creation';
import { emitPropsPanelOpen } from '@/features/canvas/utils';
import { getNodeBaseFill, getNodeMediaSpec, getRenderNodeRadius2d, hasNodeMedia } from '@/components/GraphCanvas/helpers';
import { nodeDragBehavior } from '@/components/GraphCanvas/utils';
import { type TreeDerivation } from '@/components/GraphCanvas/layout/treeHelpers';
import { applyMediaProxySrc } from '@/lib/url';
import { MINIMAP_HEIGHT, ZOOM_MAX } from '@/features/minimap/math';

type GSelection = d3.Selection<SVGGElement, unknown, null, undefined>;

const MEDIA_PANEL_HEADER_AT_MAX_ZOOM = 36;
const MEDIA_PANEL_BODY_MINIMAP_MULTIPLIER_DEFAULT = 2;
const MEDIA_PANEL_BODY_MINIMAP_MULTIPLIER_COMPACT = 1;
const MEDIA_PANEL_ASPECT_WIDTH = 16;
const MEDIA_PANEL_ASPECT_HEIGHT = 9;
const MEDIA_PANEL_PADDING = 4;
const MEDIA_PANEL_CORNER_AT_MAX_ZOOM = 8;
const MEDIA_PANEL_BORDER_COLOR = '#e5e7eb';
const MEDIA_PANEL_BG_COLOR = '#ffffff';
const MEDIA_PANEL_HEADER_BG_COLOR = '#f9fafb';
const MEDIA_PANEL_BORDER_WIDTH = 1 / ZOOM_MAX;

export const createNodesLayer = (args: {
  g: GSelection;
  graphData: GraphData;
  edgesForDisplay: GraphEdge[];
  schema: GraphSchema;
  treeDerivation?: TreeDerivation | null;
  zoomOnDoubleClick: boolean;
  renderMediaAsNodes: boolean;
  mediaPanelDensity: 'default' | 'compact';
  tempLinkSelRef: MutableRefObject<TempLinkSelection>;
  linkDragRef: MutableRefObject<PendingLink | null>;
  simulation: d3.Simulation<GraphNode, GraphEdge>;
  selectNode: (id: string | null) => void;
  selectEdge: (id: string | null) => void;
  setSelectionSource: (src: 'menu' | 'canvas' | 'toolbar' | 'editor' | 'unknown') => void;
  requestZoomSelection: () => void;
  graphLayersVisible: boolean;
}): {
  nodeSel: d3.Selection<SVGElement, GraphNode, SVGGElement, unknown>;
  mediaSel: d3.Selection<SVGGraphicsElement, GraphNode, SVGGElement, unknown> | null;
} => {
  const {
    g,
    graphData,
    edgesForDisplay,
    schema,
    treeDerivation,
    graphLayersVisible,
    renderMediaAsNodes,
    mediaPanelDensity,
    zoomOnDoubleClick,
    selectNode,
    selectEdge,
    setSelectionSource,
    requestZoomSelection,
    simulation,
  } = args;

  const isTree = schema.layout?.mode === 'tree';
  const isMermaid = schema.layout?.mode === 'mermaid';
  const treeCfg = schema.layout?.tree || {};
  const treeColorMode = treeCfg.colorMode === 'schema' ? 'schema' : 'observable';
  const direction = treeDerivation?.direction ?? treeCfg.direction ?? 'source-target';
  const nodesWithChildren = new Set<string>();
  if (isTree && treeColorMode === 'observable') {
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
  const internalFill = (() => {
    const raw = typeof treeCfg.internalFill === 'string' ? treeCfg.internalFill.trim() : '';
    if (raw) return raw;
    const linkStroke = typeof treeCfg.linkStroke === 'string' ? treeCfg.linkStroke.trim() : '';
    return linkStroke || '#555';
  })();
  const leafFill = (() => {
    const raw = typeof treeCfg.leafFill === 'string' ? treeCfg.leafFill.trim() : '';
    return raw || '#999';
  })();

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
      const filtered = rawNodes.filter(n => {
        const t = String(n.type || '')
        if (!graphLayersVisible && t === 'MermaidSubgraph') return true
        return !hiddenTypeSet.has(t)
      });
      return filtered.length > 0 ? filtered : rawNodes;
    })();
    if (isMermaid) {
      if (!graphLayersVisible) return base
      const filtered = base.filter(n => String(n.type || '') !== 'MermaidSubgraph');
      return filtered.length > 0 ? filtered : base;
    }
    if (!graphLayersVisible) return base;
    const filteredForLayers = base.filter(n => String(n.type || '') !== 'MermaidSubgraph');
    return filteredForLayers.length > 0 ? filteredForLayers : base;
  })();
  const getNodeShape = (n: GraphNode): 'circle' | 'rect' => {
    // If Tree layout is active, force rect shape for all nodes or specifically Mermaid nodes
    const type = String(n.type || '')
    if (type === 'MermaidNode' || type === 'MermaidSubgraph') return 'rect'
    if (isTree || isMermaid) return 'rect'

    const fromSchema = schema.nodeShapes?.[String(n.type || '')]
    if (fromSchema === 'rect') return 'rect'
    if (fromSchema === 'circle') return 'circle'
    const raw = (n.properties || {})['visual:shape']
    const v = typeof raw === 'string' ? raw.trim().toLowerCase() : ''
    return v === 'rect' ? 'rect' : 'circle'
  }
  const rectNodeIdSet = new Set<string>()
  for (let i = 0; i < nodes.length; i += 1) {
    const n = nodes[i]
    if (getNodeShape(n) === 'rect') rectNodeIdSet.add(String(n.id))
  }
  const mediaByNodeId = new Map<string, ReturnType<typeof getNodeMediaSpec>>();
  if (renderMediaAsNodes) {
    for (let i = 0; i < nodes.length; i += 1) {
      const n = nodes[i];
      const spec = getNodeMediaSpec(n);
      if (!spec) continue;
      mediaByNodeId.set(String(n.id), spec);
    }
  }

  const mediaLayer = g.append('g');
  let mediaPanelSel: d3.Selection<SVGGElement, GraphNode, SVGGElement, unknown> | null = null;
  if (renderMediaAsNodes && mediaByNodeId.size > 0) {
    const mediaNodes = nodes.filter(n => mediaByNodeId.has(String(n.id)));
    if (mediaNodes.length > 0) {
      const headerHeight = MEDIA_PANEL_HEADER_AT_MAX_ZOOM / ZOOM_MAX;
      const padding = MEDIA_PANEL_PADDING;

      mediaPanelSel = (mediaLayer
        .selectAll<SVGGElement, GraphNode>('g.media-node-panel')
        .data(mediaNodes, (d: unknown) => String((d as GraphNode).id))
        .enter()
        .append('g')
        .attr('class', 'media-node-panel')
        .attr('data-role', 'media-node-panel')
        .attr('data-node-id', (d: GraphNode) => String(d.id)) as unknown) as d3.Selection<
        SVGGElement,
        GraphNode,
        SVGGElement,
        unknown
      >;

      mediaPanelSel.each(function (d: GraphNode) {
        const spec = mediaByNodeId.get(String(d.id));
        if (!spec) return;
        const panel = d3.select(this);
        const density = mediaPanelDensity === 'compact' ? 'compact' : 'default';
        const rawLabel = String(d.label || d.id || '').trim();
        const rawType = String(d.type || '').trim();
        const baseLabel = rawLabel || String(d.id || '');
        const fullTitle = rawType ? `${baseLabel} (${rawType})` : baseLabel || 'Media node';
        const bodyMultiplier =
          density === 'compact'
            ? MEDIA_PANEL_BODY_MINIMAP_MULTIPLIER_COMPACT
            : MEDIA_PANEL_BODY_MINIMAP_MULTIPLIER_DEFAULT;
        const bodyHeight = (MINIMAP_HEIGHT * bodyMultiplier) / ZOOM_MAX;
        const panelHeight = bodyHeight + headerHeight;
        const panelWidth = (bodyHeight * MEDIA_PANEL_ASPECT_WIDTH) / MEDIA_PANEL_ASPECT_HEIGHT;
        const corner = MEDIA_PANEL_CORNER_AT_MAX_ZOOM / ZOOM_MAX;
        const bg = panel
          .append('rect')
          .attr('data-role', 'media-panel-bg')
          .attr('x', -panelWidth / 2)
          .attr('y', -panelHeight / 2)
          .attr('width', panelWidth)
          .attr('height', panelHeight)
          .attr('rx', corner)
          .attr('ry', corner)
          .attr('fill', MEDIA_PANEL_BG_COLOR)
          .attr('stroke', MEDIA_PANEL_BORDER_COLOR)
          .attr('stroke-width', MEDIA_PANEL_BORDER_WIDTH);
        const header = panel
          .append('g')
          .attr('class', 'media-panel-header')
          .attr('data-role', 'media-panel-header');
        header
          .append('rect')
          .attr('x', -panelWidth / 2)
          .attr('y', -panelHeight / 2)
          .attr('width', panelWidth)
          .attr('height', headerHeight)
          .attr('fill', MEDIA_PANEL_HEADER_BG_COLOR);
        header
          .append('text')
          .attr('x', 0)
          .attr('y', -panelHeight / 2 + headerHeight / 2)
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'middle')
          .attr('font-size', 10)
          .text(fullTitle);
        const contentX = -panelWidth / 2 + padding;
        const contentY = -panelHeight / 2 + headerHeight + padding;
        const contentWidth = panelWidth - padding * 2;
        const contentHeight = Math.max(0, panelHeight - headerHeight - padding * 2);
        if (spec.kind === 'image' || spec.kind === 'svg') {
          panel
            .append('image')
            .attr('data-role', 'media-panel-media')
            .attr('x', contentX)
            .attr('y', contentY)
            .attr('width', contentWidth)
            .attr('height', contentHeight)
            .attr('preserveAspectRatio', 'xMidYMid meet')
            .attr('href', () => applyMediaProxySrc(spec.url))
            .style('pointer-events', 'none');
        } else {
          const fo = panel
            .append('foreignObject')
            .attr('data-role', 'media-panel-media')
            .attr('x', contentX)
            .attr('y', contentY)
            .attr('width', contentWidth)
            .attr('height', contentHeight)
            .style('overflow', 'hidden')
            .style('pointer-events', spec.interactive ? 'auto' : 'none') as unknown as d3.Selection<
            SVGForeignObjectElement,
            GraphNode,
            SVGGElement,
            unknown
          >;
          fo.each(function () {
            const container = d3
              .select(this)
              .append('xhtml:div')
              .style('width', '100%')
              .style('height', '100%')
              .style('border-radius', `${corner}px`)
              .style('overflow', 'hidden')
              .style('background', 'transparent')
              .style('pointer-events', spec.interactive ? 'auto' : 'none');
            if (spec.kind === 'video') {
              const url = applyMediaProxySrc(spec.url);
              const video = container
                .append('xhtml:video')
                .attr('src', url)
                .attr('playsinline', 'true')
                .attr('muted', 'true')
                .attr('controls', 'true')
                .attr('preload', 'metadata')
                .style('width', '100%')
                .style('height', '100%')
                .style('object-fit', 'cover');
              video
                .on('mousedown', event => {
                  event.stopPropagation();
                })
                .on('click', event => {
                  event.stopPropagation();
                })
                .on('dblclick', event => {
                  event.stopPropagation();
                })
                .on('contextmenu', event => {
                  event.stopPropagation();
                });
            } else if (spec.kind === 'iframe') {
              const iframe = container
                .append('xhtml:iframe')
                .attr('src', spec.url)
                .attr('loading', 'lazy')
                .attr('referrerpolicy', 'no-referrer')
                .attr('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups allow-presentation')
                .attr(
                  'allow',
                  'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share',
                )
                .style('width', '100%')
                .style('height', '100%')
                .style('border', '0');
              iframe
                .on('mousedown', event => {
                  event.stopPropagation();
                })
                .on('click', event => {
                  event.stopPropagation();
                })
                .on('dblclick', event => {
                  event.stopPropagation();
                })
                .on('contextmenu', event => {
                  event.stopPropagation();
                });
            }
          });
        }
        panel.append('title').text(fullTitle);
        bg.lower();
      });
    }
  }

  const mediaSel =
    mediaPanelSel && mediaByNodeId.size > 0
      ? (mediaPanelSel as unknown as d3.Selection<SVGGraphicsElement, GraphNode, SVGGElement, unknown>)
      : null;

  const nodeLayer = g.append('g');
  const rectNodes = nodes.filter(n => {
    if (renderMediaAsNodes && hasNodeMedia(n)) return false;
    
    // Always force MermaidNode to be rect
    if (String(n.type || '') === 'MermaidNode') return true;

    if (isMermaid) {
      if (String(n.type || '') === 'MermaidSubgraph') return !graphLayersVisible;
      return true;
    }
    return rectNodeIdSet.has(String(n.id));
  });
  const circleNodes = nodes.filter(n => {
    if (renderMediaAsNodes && hasNodeMedia(n)) return false;
    
    // MermaidNode is always rect
    if (String(n.type || '') === 'MermaidNode') return false;

    if (isMermaid) return false;
    return !rectNodeIdSet.has(String(n.id));
  });

  nodeLayer
    .selectAll('circle')
    .data(circleNodes)
    .enter()
    .append('circle')
    .attr('fill', 'transparent')
    .attr('r', (d: GraphNode) => getRenderNodeRadius2d(d, schema))

  nodeLayer
    .selectAll('rect')
    .data(rectNodes)
    .enter()
    .append('rect')
    .attr('fill', 'transparent')
    .attr('rx', (d: GraphNode) => {
       if (d.type === 'MermaidSubgraph') return 0; // Subgraphs often square in Mermaid
       if (isMermaid) return 4; // Mermaid Land style
       return getRenderNodeRadius2d(d, schema) * 0.22;
    })
    .attr('ry', (d: GraphNode) => {
       if (d.type === 'MermaidSubgraph') return 0;
       if (isMermaid) return 4;
       return getRenderNodeRadius2d(d, schema) * 0.22;
    })
    .attr('x', (d: GraphNode) => {
        const props = (d.properties || {}) as Record<string, unknown>;
        const w = typeof props['visual:width'] === 'number' ? props['visual:width'] : getRenderNodeRadius2d(d, schema) * 2;
        return (d.x ?? 0) - w / 2;
    })
    .attr('y', (d: GraphNode) => {
        const props = (d.properties || {}) as Record<string, unknown>;
        const h = typeof props['visual:height'] === 'number' ? props['visual:height'] : getRenderNodeRadius2d(d, schema) * 2;
        return (d.y ?? 0) - h / 2;
    })
    .attr('width', (d: GraphNode) => {
        const props = (d.properties || {}) as Record<string, unknown>;
        return typeof props['visual:width'] === 'number' ? props['visual:width'] : getRenderNodeRadius2d(d, schema) * 2;
    })
    .attr('height', (d: GraphNode) => {
        const props = (d.properties || {}) as Record<string, unknown>;
        return typeof props['visual:height'] === 'number' ? props['visual:height'] : getRenderNodeRadius2d(d, schema) * 2;
    })

  const node = nodeLayer.selectAll<SVGElement, GraphNode>('circle,rect')
  node
     .attr('fill', (d: GraphNode) => {
       if (isTree && treeColorMode === 'observable') {
         return nodesWithChildren.has(String(d.id)) ? internalFill : leafFill;
       }
       return getNodeBaseFill(d, schema);
     })
    .attr('stroke', (d: GraphNode) => {
      if (isTree && treeColorMode === 'observable') return 'none'
      if (isMermaid) {
        const props = (d.properties || {}) as Record<string, unknown>
        const visualStroke = typeof props['visual:stroke'] === 'string' ? String(props['visual:stroke']).trim() : ''
        const stroke = typeof props.stroke === 'string' ? String(props.stroke).trim() : ''
        const override = visualStroke || stroke
        if (override) return override
        return schema.nodeStroke?.[d.type]?.color ?? '#333'
      }
      if (schema.layout?.mode === 'tree') return schema.nodeStroke?.[d.type]?.color ?? 'none'
      return schema.nodeStroke?.[d.type]?.color ?? '#ffffff'
    })
    .attr('stroke-width', (d: GraphNode) => {
      if (isTree && treeColorMode === 'observable') return 0
      if (isMermaid) {
        const props = (d.properties || {}) as Record<string, unknown>
        const raw =
          props['visual:strokeWidth'] ??
          props['stroke-width'] ??
          props.strokeWidth ??
          props['visual:stroke-width']
        if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 0) return raw
        if (typeof raw === 'string') {
          const parsed = parseFloat(raw)
          if (Number.isFinite(parsed) && parsed >= 0) return parsed
        }
        const w = schema.nodeStroke?.[d.type]?.width
        return typeof w === 'number' ? w : 1.5
      }
      const w = schema.nodeStroke?.[d.type]?.width
      if (typeof w === 'number' && Number.isFinite(w) && w >= 0) return w
      if (schema.layout?.mode === 'tree') return 0
      return 1.5
    })
    .attr('stroke-dasharray', () => null)
    .style('cursor', 'pointer')
    .style('pointer-events', 'all');

  const mediaInteractiveSel = mediaPanelSel as unknown as d3.Selection<SVGElement, GraphNode, SVGGElement, unknown> | null

  if (schema.behavior.allowNodeDrag) {
    const dragBehavior = nodeDragBehavior(simulation, schema);
    ;(node as d3.Selection<SVGElement, GraphNode, SVGGElement, unknown>).call(
      dragBehavior as d3.DragBehavior<SVGElement, GraphNode, unknown>,
    )
    if (mediaInteractiveSel) {
      mediaInteractiveSel.call(dragBehavior as d3.DragBehavior<SVGElement, GraphNode, unknown>)
    }
  }

  const onContextMenu = (event: MouseEvent, d: GraphNode) => {
    event.preventDefault();
    event.stopPropagation();
    setSelectionSource('menu');
    selectEdge(null);
    selectNode(String(d.id));
  }

  const onClick = (event: MouseEvent, d: GraphNode) => {
    event.stopPropagation();
    setSelectionSource('canvas');
    selectEdge(null);
    selectNode(String(d.id));
  }

  const onDblClick = (event: MouseEvent) => {
    event.stopPropagation();
    if (zoomOnDoubleClick) {
      requestZoomSelection();
    }
    emitPropsPanelOpen();
  }

  ;(node as d3.Selection<SVGElement, GraphNode, SVGGElement, unknown>).on('contextmenu', onContextMenu)
  ;(node as d3.Selection<SVGElement, GraphNode, SVGGElement, unknown>).on('click', onClick)
  ;(node as d3.Selection<SVGElement, GraphNode, SVGGElement, unknown>).on('dblclick', onDblClick)
  if (mediaInteractiveSel) {
    mediaInteractiveSel.on('contextmenu', onContextMenu)
    mediaInteractiveSel.on('click', onClick)
    mediaInteractiveSel.on('dblclick', onDblClick)
  }

  return { nodeSel: node, mediaSel };
};
