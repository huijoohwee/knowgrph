import * as d3 from 'd3';
import type { MutableRefObject } from 'react';
import type { GraphNode, GraphEdge, GraphData } from '@/lib/graph/types';
import type { GraphSchema } from '@/lib/graph/schema';
import type { PendingLink, TempLinkSelection } from '@/features/edge-creation';
import { finalizePendingEdge, startEdgeFromNode, startUpdateEdgeEndpoint } from '@/features/edge-creation';
import { emitPropsPanelOpen } from '@/features/canvas/utils';
import type { HoverInfo } from '@/components/GraphHoverTooltip';
import { getNodeBaseFill, getNodeMediaSpec, getRenderNodeRadius2d, hasNodeMedia } from '@/components/GraphCanvas/helpers';
import { getEdgeEndpoints, nodeDragBehavior, type EdgeWithRuntime, type TidyTreeDerivation } from '@/components/GraphCanvas/utils';
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
  tidyTreeDerivation: TidyTreeDerivation | null;
  hoverEnabled: boolean;
  zoomOnDoubleClick: boolean;
  renderMediaAsNodes: boolean;
  mediaPanelDensity: 'default' | 'compact';
  isEditModeRef: MutableRefObject<boolean>;
  selectedEdgeIdRef: MutableRefObject<string | null>;
  tempLinkSelRef: MutableRefObject<TempLinkSelection>;
  linkDragRef: MutableRefObject<PendingLink | null>;
  simulation: d3.Simulation<GraphNode, GraphEdge>;
  selectNode: (id: string | null) => void;
  selectEdge: (id: string | null) => void;
  setSelectionSource: (src: 'menu' | 'canvas' | 'toolbar' | 'editor' | 'unknown') => void;
  addEdge: (e: GraphEdge) => void;
  updateEdge: (id: string, u: Partial<GraphEdge>) => void;
  setHoverInfo: (updater: (prev: HoverInfo | null) => HoverInfo | null) => void;
  requestZoomSelection: () => void;
}): {
  nodeSel: d3.Selection<SVGElement, GraphNode, SVGGElement, unknown>;
  mediaSel: d3.Selection<SVGGraphicsElement, GraphNode, SVGGElement, unknown> | null;
} => {
  const {
    g,
    graphData,
    edgesForDisplay,
    schema,
    tidyTreeDerivation,
    hoverEnabled,
    renderMediaAsNodes,
    mediaPanelDensity,
    zoomOnDoubleClick,
    isEditModeRef,
    selectedEdgeIdRef,
    tempLinkSelRef,
    linkDragRef,
    selectNode,
    selectEdge,
    setSelectionSource,
    addEdge,
    updateEdge,
    setHoverInfo,
    requestZoomSelection,
    simulation,
  } = args;

  const isTidyTree = schema.layout?.mode === 'tidy-tree';
  const tidyCfg = schema.layout?.tidyTree || {};
  const tidyColorMode = tidyCfg.colorMode === 'schema' ? 'schema' : 'observable';
  const direction = tidyTreeDerivation?.direction ?? 'source-target';
  const nodesWithChildren = new Set<string>();
  if (isTidyTree && tidyColorMode === 'observable') {
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
    const raw = typeof tidyCfg.internalFill === 'string' ? tidyCfg.internalFill.trim() : '';
    if (raw) return raw;
    const linkStroke = typeof tidyCfg.linkStroke === 'string' ? tidyCfg.linkStroke.trim() : '';
    return linkStroke || '#555';
  })();
  const leafFill = (() => {
    const raw = typeof tidyCfg.leafFill === 'string' ? tidyCfg.leafFill.trim() : '';
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
    if (!hiddenTypeSet) return rawNodes;
    const filtered = rawNodes.filter(n => !hiddenTypeSet.has(String(n.type || '')));
    return filtered.length > 0 ? filtered : rawNodes;
  })();
  const getNodeShape = (n: GraphNode): 'circle' | 'rect' => {
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
              .style('background', '#000')
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
    return rectNodeIdSet.has(String(n.id));
  });
  const circleNodes = nodes.filter(n => {
    if (renderMediaAsNodes && hasNodeMedia(n)) return false;
    return !rectNodeIdSet.has(String(n.id));
  });

  const circleSel = nodeLayer
    .selectAll('circle')
    .data(circleNodes)
    .enter()
    .append('circle')
    .attr('r', (d: GraphNode) => getRenderNodeRadius2d(d, schema))

  const rectSel = nodeLayer
    .selectAll('rect')
    .data(rectNodes)
    .enter()
    .append('rect')
    .attr('rx', (d: GraphNode) => getRenderNodeRadius2d(d, schema) * 0.22)
    .attr('ry', (d: GraphNode) => getRenderNodeRadius2d(d, schema) * 0.22)

  const node = (circleSel as unknown as d3.Selection<SVGElement, GraphNode, SVGGElement, unknown>).merge(
    rectSel as unknown as d3.Selection<SVGElement, GraphNode, SVGGElement, unknown>,
  )
  node
    .attr(
      'fill',
      (d: GraphNode) =>
        isTidyTree && tidyColorMode === 'observable'
          ? nodesWithChildren.has(String(d.id))
            ? internalFill
            : leafFill
          : getNodeBaseFill(d, schema),
    )
    .attr('stroke', (d: GraphNode) => {
      if (isTidyTree && tidyColorMode === 'observable') return 'none';
      if (schema.layout?.mode === 'tidy-tree') return schema.nodeStroke?.[d.type]?.color ?? 'none';
      return schema.nodeStroke?.[d.type]?.color ?? '#ffffff';
    })
    .attr('stroke-width', (d: GraphNode) => {
      if (isTidyTree && tidyColorMode === 'observable') return 0;
      const w = schema.nodeStroke?.[d.type]?.width;
      if (typeof w === 'number' && Number.isFinite(w) && w >= 0) return w;
      if (schema.layout?.mode === 'tidy-tree') return 0;
      return 1.5;
    })
    .style('cursor', 'pointer')
    .style('pointer-events', 'all');

  const interactiveNodeSel = mediaPanelSel
    ? (node as d3.Selection<SVGElement, GraphNode, SVGGElement, unknown>).merge(
        mediaPanelSel as unknown as d3.Selection<SVGElement, GraphNode, SVGGElement, unknown>,
      )
    : node;

  if (schema.behavior.allowNodeDrag) {
    const dragBehavior = nodeDragBehavior(simulation, schema);
    (interactiveNodeSel as d3.Selection<SVGElement, GraphNode, SVGGElement, unknown>).call(
      dragBehavior as d3.DragBehavior<SVGElement, GraphNode, unknown>,
    );
  }

  interactiveNodeSel.on('contextmenu', (event: MouseEvent, d: GraphNode) => {
    event.preventDefault();
    event.stopPropagation();
    setSelectionSource('menu');
    selectEdge(null);
    selectNode(d.id);
    emitPropsPanelOpen({ clientX: event.clientX, clientY: event.clientY });
  });

  interactiveNodeSel.on('mousedown', (event, d: GraphNode) => {
    if (isEditModeRef.current && schema.behavior.allowEdgeCreation && (event as MouseEvent).shiftKey) {
      const currentSelectedEdgeId = selectedEdgeIdRef.current;
      const sel = currentSelectedEdgeId ? graphData.edges.find(e => e.id === currentSelectedEdgeId) || null : null;
      if (sel) {
        const endpoints = getEdgeEndpoints(sel as EdgeWithRuntime);
        const srcId = endpoints.src || '';
        const tgtId = endpoints.tgt || '';
        const selectEdgeNonNull = (id: string) => selectEdge(id);
        const setSelectionSourceStrict = (src: 'menu' | 'canvas' | 'toolbar' | 'editor' | 'unknown') =>
          setSelectionSource(src);
        if (d.id === srcId) {
          startUpdateEdgeEndpoint(
            sel,
            d,
            'update-source',
            tempLinkSelRef,
            linkDragRef,
            selectEdgeNonNull,
            setSelectionSourceStrict,
          );
        } else if (d.id === tgtId) {
          startUpdateEdgeEndpoint(
            sel,
            d,
            'update-target',
            tempLinkSelRef,
            linkDragRef,
            selectEdgeNonNull,
            setSelectionSourceStrict,
          );
        } else {
          startEdgeFromNode(d, tempLinkSelRef, linkDragRef);
        }
      } else {
        startEdgeFromNode(d, tempLinkSelRef, linkDragRef);
      }
      return;
    }
    if ((event as MouseEvent).detail === 0) {
      setSelectionSource('canvas');
      selectNode(d.id);
    }
  });

  interactiveNodeSel.on('click', (event, d: GraphNode) => {
    event.stopPropagation();
    const currentGraphData: GraphData = graphData;
    const selectEdgeNonNull = (id: string) => selectEdge(id);
    const setSelectionSourceStrict = (src: 'menu' | 'canvas' | 'toolbar' | 'editor' | 'unknown') =>
      setSelectionSource(src);
    if (
      finalizePendingEdge(
        d.id,
        currentGraphData,
        selectedEdgeIdRef.current,
        tempLinkSelRef,
        linkDragRef,
        addEdge,
        updateEdge,
        selectEdgeNonNull,
        setSelectionSourceStrict,
        schema,
      )
    ) {
      return;
    }
    setSelectionSource('canvas');
    selectNode(d.id);
  });

  interactiveNodeSel.on('dblclick', (event, d: GraphNode) => {
    event.stopPropagation();
    setSelectionSource('canvas');
    selectNode(d.id);
    if (zoomOnDoubleClick) {
      requestZoomSelection();
    }
  });

  interactiveNodeSel.on('touchstart', (_event, d: GraphNode) => {
    setSelectionSource('canvas');
    selectNode(d.id);
  });

  interactiveNodeSel.on('mouseover', (event: MouseEvent, d: GraphNode) => {
    if (!hoverEnabled) return;
    setHoverInfo(() => ({
      kind: 'node',
      id: d.id,
      clientX: event.clientX,
      clientY: event.clientY,
    }));
  });

  interactiveNodeSel.on('mousemove', (event: MouseEvent, d: GraphNode) => {
    if (!hoverEnabled) return;
    setHoverInfo(() => ({
      kind: 'node',
      id: d.id,
      clientX: event.clientX,
      clientY: event.clientY,
    }));
  });

  interactiveNodeSel.on('mouseout', () => {
    if (!hoverEnabled) return;
    setHoverInfo(prev => (prev && prev.kind === 'node' ? null : prev));
  });

  return { nodeSel: node as d3.Selection<SVGCircleElement, GraphNode, SVGGElement, unknown>, mediaSel };
};
