import * as d3 from 'd3';
import type { MutableRefObject } from 'react';
import type { GraphNode, GraphEdge, GraphData } from '@/lib/graph/types';
import type { GraphSchema } from '@/lib/graph/schema';
import type { PendingLink, TempLinkSelection } from '@/features/edge-creation';
import { finalizePendingEdge, startEdgeFromNode } from '@/features/edge-creation'
import { emitPropsPanelOpen } from '@/features/canvas/utils';
import {
  getNodeBaseFill,
  getNodeMediaSpec,
  getRenderNodeRadius2d,
  hasNodeMedia,
} from '@/components/GraphCanvas/helpers';
import { nodeDragBehavior } from '@/components/GraphCanvas/utils';
import { applyMediaProxySrc } from '@/lib/url';
import { MINIMAP_HEIGHT } from '@/features/minimap/math';
import { DEFAULT_ZOOM_MAX_SCALE } from '@/lib/graph/layoutDefaults'
import { getPortHandlePosition, getPortHandlesConfig, listPortHandlesForNodes, type PortHandleDatum } from '@/components/GraphCanvas/portHandles';
import { getNodeRectDimensions2d, getNodeRenderShape2d } from '@/components/GraphCanvas/nodeSizing2d';
import { buildNodeShapePathD } from '@/components/GraphCanvas/shapePaths2d';
import type { HoverInfo } from '@/components/GraphHoverTooltip'
import { isTooltipRelatedTarget } from '@/features/panels/ui/tooltipUtils'
import { createEdgeScrollController } from '@/lib/canvas/edge-scroll'

type GSelection = d3.Selection<SVGGElement, unknown, null, undefined>;

import { UI_THEME_COLORS_CSS } from '@/lib/ui/theme-tokens';

const MEDIA_PANEL_HEADER_AT_MAX_ZOOM = 36;
const MEDIA_PANEL_BODY_MINIMAP_MULTIPLIER_DEFAULT = 5.0;
const MEDIA_PANEL_BODY_MINIMAP_MULTIPLIER_COMPACT = 2.5; // Aligned with ~half size
const MEDIA_PANEL_ASPECT_WIDTH = 16;
const MEDIA_PANEL_ASPECT_HEIGHT = 9;
const MEDIA_PANEL_PADDING = 4;
const MEDIA_PANEL_CORNER_AT_MAX_ZOOM = 8;
const MEDIA_PANEL_BORDER_COLOR = UI_THEME_COLORS_CSS.border;
const MEDIA_PANEL_BG_FILL_OPACITY = 0.14;
const MEDIA_PANEL_HEADER_FILL_OPACITY = 0.22;
const MEDIA_PANEL_BORDER_WIDTH = 1 / DEFAULT_ZOOM_MAX_SCALE;

export const createNodesLayer = (args: {
  g: GSelection;
  graphData: GraphData;
  schema: GraphSchema;
  zoomOnDoubleClick: boolean;
  renderMediaAsNodes: boolean;
  mediaPanelDensity: 'default' | 'compact';
  tempLinkSelRef: MutableRefObject<TempLinkSelection>;
  linkDragRef: MutableRefObject<PendingLink | null>;
  simulation: d3.Simulation<GraphNode, GraphEdge>;
  addEdge: (e: GraphEdge) => void;
  updateEdge: (id: string, u: Partial<GraphEdge>) => void;
  getSelectedEdgeId: () => string | null;
  enableEditorGestures?: boolean;
  onCommitNodePosition?: (args: { id: string; x: number; y: number }) => void;
  hoverEnabled?: boolean;
  setHoverInfo?: (updater: (prev: HoverInfo | null) => HoverInfo | null) => void;
  selectNode: (id: string | null) => void;
  selectEdge: (id: string | null) => void;
  setSelectionSource: (src: 'menu' | 'canvas' | 'toolbar' | 'editor' | 'unknown') => void;
  requestZoomSelection: () => void;
  toggleGroupCollapsed: (id: string) => void;
  edgeScroll?: { enabled: () => boolean; panByPx: (dx: number, dy: number) => void };
}): {
  nodeSel: d3.Selection<SVGElement, GraphNode, SVGGElement, unknown>;
  mediaSel: d3.Selection<SVGGraphicsElement, GraphNode, SVGGElement, unknown> | null;
  portHandlesSel: d3.Selection<SVGCircleElement, PortHandleDatum, SVGGElement, unknown> | null;
  groupChevronSel: d3.Selection<SVGPathElement, GraphNode, SVGGElement, unknown> | null;
} => {
  const {
    g,
    graphData,
    schema,
    renderMediaAsNodes,
    mediaPanelDensity,
    zoomOnDoubleClick,
    selectNode,
    selectEdge,
    setSelectionSource,
    requestZoomSelection,
    simulation,
    addEdge,
    updateEdge,
    getSelectedEdgeId,
    enableEditorGestures,
    onCommitNodePosition,
    hoverEnabled,
    setHoverInfo,
    toggleGroupCollapsed,
  } = args;

  const rawNodes = Array.isArray(graphData.nodes) ? graphData.nodes : [];
  const nodes = rawNodes;
  const shapeByNodeId = new Map<string, ReturnType<typeof getNodeRenderShape2d>>();
  for (let i = 0; i < nodes.length; i += 1) {
    const n = nodes[i];
    shapeByNodeId.set(String(n.id), getNodeRenderShape2d(n, schema));
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

  const mediaLayer = g.append('g').attr('data-kg-layer', 'media');
  let mediaPanelSel: d3.Selection<SVGGElement, GraphNode, SVGGElement, unknown> | null = null;
  if (renderMediaAsNodes && mediaByNodeId.size > 0) {
    const mediaNodes = nodes.filter(n => mediaByNodeId.has(String(n.id)));
    if (mediaNodes.length > 0) {
      const headerHeight = MEDIA_PANEL_HEADER_AT_MAX_ZOOM / DEFAULT_ZOOM_MAX_SCALE;
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
        const bodyHeight = (MINIMAP_HEIGHT * bodyMultiplier) / DEFAULT_ZOOM_MAX_SCALE;
        const panelHeight = bodyHeight + headerHeight;
        const panelWidth = (bodyHeight * MEDIA_PANEL_ASPECT_WIDTH) / MEDIA_PANEL_ASPECT_HEIGHT;
        const corner = MEDIA_PANEL_CORNER_AT_MAX_ZOOM / DEFAULT_ZOOM_MAX_SCALE;
        const baseFill = getNodeBaseFill(d, schema)
        const baseStroke = schema.nodeStroke?.[d.type]?.color ?? UI_THEME_COLORS_CSS.nodeStroke
        const bg = panel
          .append('rect')
          .attr('data-role', 'media-panel-bg')
          .attr('x', -panelWidth / 2)
          .attr('y', -panelHeight / 2)
          .attr('width', panelWidth)
          .attr('height', panelHeight)
          .attr('rx', corner)
          .attr('ry', corner)
          .attr('fill', baseFill)
          .attr('fill-opacity', MEDIA_PANEL_BG_FILL_OPACITY)
          .attr('stroke', baseStroke || MEDIA_PANEL_BORDER_COLOR)
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
          .attr('fill', baseFill)
          .attr('fill-opacity', MEDIA_PANEL_HEADER_FILL_OPACITY);
        header
          .append('text')
          .attr('x', 0)
          .attr('y', -panelHeight / 2 + headerHeight / 2)
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'middle')
          .attr('font-size', 10)
          .attr('fill', UI_THEME_COLORS_CSS.text)
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
            .attr('crossorigin', 'anonymous')
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
              .append('xhtml:section')
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

  const nodeLayer = g.append('g').attr('data-kg-layer', 'nodes');

  const eligibleNodes = nodes.filter(n => !(renderMediaAsNodes && hasNodeMedia(n)));
  const circleNodes = eligibleNodes.filter(n => shapeByNodeId.get(String(n.id)) === 'circle');
  const rectNodes = eligibleNodes.filter(n => shapeByNodeId.get(String(n.id)) === 'rect');
  const diamondNodes = eligibleNodes.filter(n => shapeByNodeId.get(String(n.id)) === 'diamond');
  const hexNodes = eligibleNodes.filter(n => shapeByNodeId.get(String(n.id)) === 'hex');

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
    .attr('rx', (d: GraphNode) => getRenderNodeRadius2d(d, schema) * 0.22)
    .attr('ry', (d: GraphNode) => getRenderNodeRadius2d(d, schema) * 0.22)
    .attr('x', (d: GraphNode) => {
        const { width } = getNodeRectDimensions2d(d, schema)
        return (d.x ?? 0) - width / 2;
    })
    .attr('y', (d: GraphNode) => {
        const { height } = getNodeRectDimensions2d(d, schema)
        return (d.y ?? 0) - height / 2;
    })
    .attr('width', (d: GraphNode) => {
        return getNodeRectDimensions2d(d, schema).width
    })
    .attr('height', (d: GraphNode) => {
        return getNodeRectDimensions2d(d, schema).height
    })

  nodeLayer
    .selectAll('path[data-kg-node-shape="diamond"]')
    .data(diamondNodes)
    .enter()
    .append('path')
    .attr('data-kg-node-shape', 'diamond')
    .attr('fill', 'transparent')
    .attr('transform', (d: GraphNode) => {
      const x = typeof d.x === 'number' && Number.isFinite(d.x) ? d.x : 0;
      const y = typeof d.y === 'number' && Number.isFinite(d.y) ? d.y : 0;
      return `translate(${x},${y})`;
    })
    .attr('d', (d: GraphNode) => {
      const { width, height } = getNodeRectDimensions2d(d, schema);
      return buildNodeShapePathD({ shape: 'diamond', width, height });
    })

  nodeLayer
    .selectAll('path[data-kg-node-shape="hex"]')
    .data(hexNodes)
    .enter()
    .append('path')
    .attr('data-kg-node-shape', 'hex')
    .attr('fill', 'transparent')
    .attr('transform', (d: GraphNode) => {
      const x = typeof d.x === 'number' && Number.isFinite(d.x) ? d.x : 0;
      const y = typeof d.y === 'number' && Number.isFinite(d.y) ? d.y : 0;
      return `translate(${x},${y})`;
    })
    .attr('d', (d: GraphNode) => {
      const { width, height } = getNodeRectDimensions2d(d, schema);
      return buildNodeShapePathD({ shape: 'hex', width, height });
    })

  const node = nodeLayer.selectAll<SVGElement, GraphNode>('circle,rect,path[data-kg-node-shape]')
  node
     .attr('fill', (d: GraphNode) => getNodeBaseFill(d, schema))
    .attr('stroke', (d: GraphNode) => {
      return schema.nodeStroke?.[d.type]?.color ?? UI_THEME_COLORS_CSS.nodeStroke
    })
    .attr('stroke-width', (d: GraphNode) => {
      const w = schema.nodeStroke?.[d.type]?.width
      if (typeof w === 'number' && Number.isFinite(w) && w >= 0) return w
      return 1.5
    })
    .attr('stroke-dasharray', () => null)
    .style('user-select', 'none')
    .style('cursor', 'pointer')
    .style('pointer-events', 'all');

  const mediaInteractiveSel = mediaPanelSel as unknown as d3.Selection<SVGElement, GraphNode, SVGGElement, unknown> | null

  const groupChevronSel = (() => {
    const groupNodes = nodes.filter((n) => {
      const props = (n.properties || {}) as Record<string, unknown>
      const groupId = typeof props['kg:groupId'] === 'string' ? String(props['kg:groupId'] || '').trim() : ''
      return !!groupId
    })
    if (groupNodes.length === 0) return null
    const layer = g.append('g').attr('data-kg-layer', 'node-chevrons')
    return layer
      .selectAll<SVGPathElement, GraphNode>('path[data-kg-node-chevron]')
      .data(groupNodes, (d: unknown) => String((d as GraphNode).id))
      .enter()
      .append('path')
      .attr('data-kg-node-chevron', '1')
      .attr('fill', 'none')
      .attr('stroke', UI_THEME_COLORS_CSS.textSecondary)
      .attr('stroke-width', 1.75)
      .attr('stroke-linecap', 'round')
      .attr('stroke-linejoin', 'round')
      .style('pointer-events', 'all')
      .style('cursor', 'pointer') as unknown as d3.Selection<SVGPathElement, GraphNode, SVGGElement, unknown>
  })()

  if (schema.behavior?.allowNodeDrag !== false) {
    const dragBehavior = nodeDragBehavior(simulation, schema, {
      onNodeDragEnd: (d) => {
        const id = String(d.id || '').trim()
        const x = typeof d.x === 'number' && Number.isFinite(d.x) ? d.x : null
        const y = typeof d.y === 'number' && Number.isFinite(d.y) ? d.y : null
        if (!id || x == null || y == null) return
        try {
          onCommitNodePosition?.({ id, x, y })
        } catch {
          void 0
        }
      },
    });

    if (args.edgeScroll) {
      const edgeScroll = createEdgeScrollController()
      dragBehavior.on('start.kgEdgeScroll', () => edgeScroll.reset())
      dragBehavior.on('drag.kgEdgeScroll', (event: unknown) => {
        if (!args.edgeScroll) return
        if (!args.edgeScroll.enabled()) {
          edgeScroll.reset()
          return
        }
        const ev = event as { sourceEvent?: unknown }
        const src = ev?.sourceEvent as { clientX?: unknown; clientY?: unknown; pointerType?: unknown } | undefined
        const clientX = typeof src?.clientX === 'number' ? src.clientX : NaN
        const clientY = typeof src?.clientY === 'number' ? src.clientY : NaN
        if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return
        const svgEl = args.g.node()?.ownerSVGElement
        if (!svgEl) return
        const rect = svgEl.getBoundingClientRect()
        const sx = clientX - rect.left
        const sy = clientY - rect.top
        const d = edgeScroll.update({
          nowMs: Date.now(),
          pointer: {
            sx,
            sy,
            kind: src?.pointerType === 'touch' ? 'touch' : src?.pointerType === 'pen' ? 'pen' : 'mouse',
          },
          viewport: { w: rect.width, h: rect.height },
          zoomK: d3.zoomTransform(svgEl).k || 1,
          enabled: true,
        })
        if (Math.abs(d.dx) > 1e-6 || Math.abs(d.dy) > 1e-6) {
          args.edgeScroll.panByPx(d.dx, d.dy)
        }
      })
      dragBehavior.on('end.kgEdgeScroll', () => edgeScroll.reset())
    }

    const draggable = (node as d3.Selection<SVGElement, GraphNode, SVGGElement, unknown>)
    draggable.call(dragBehavior as d3.DragBehavior<SVGElement, GraphNode, unknown>)
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
    const btn = (event as unknown as { button?: unknown }).button
    if (typeof btn === 'number' && btn !== 0) return
    event.stopPropagation();
    const editorGestures = enableEditorGestures === true
    const allowEdgeCreation = schema?.behavior?.allowEdgeCreation !== false
    if (editorGestures && allowEdgeCreation) {
      if (event.shiftKey && !args.linkDragRef.current) {
        setSelectionSource('editor')
        selectEdge(null)
        selectNode(String(d.id))
        startEdgeFromNode(d, args.tempLinkSelRef, args.linkDragRef)
        return
      }
      if (args.linkDragRef.current) {
        finalizePendingEdge(
          String(d.id),
          graphData,
          getSelectedEdgeId(),
          args.tempLinkSelRef,
          args.linkDragRef,
          addEdge,
          updateEdge,
          id => selectEdge(id),
          src => setSelectionSource(src),
          schema,
        )
        return
      }
    }
    setSelectionSource('canvas');
    selectEdge(null);
    selectNode(String(d.id));
  }

  const onDblClick = (event: MouseEvent, d: GraphNode) => {
    event.stopPropagation();
    const props = (d.properties || {}) as Record<string, unknown>
    const groupId = typeof props['kg:groupId'] === 'string' ? String(props['kg:groupId'] || '').trim() : ''
    if (groupId) {
      setSelectionSource('canvas');
      selectEdge(null);
      selectNode(String(d.id));
      toggleGroupCollapsed(groupId)
      return
    }
    if (zoomOnDoubleClick) {
      requestZoomSelection();
    }
    emitPropsPanelOpen();
  }

  const onGroupChevronClick = (event: MouseEvent, d: GraphNode) => {
    event.stopPropagation()
    const props = (d.properties || {}) as Record<string, unknown>
    const groupId = typeof props['kg:groupId'] === 'string' ? String(props['kg:groupId'] || '').trim() : ''
    if (!groupId) return
    setSelectionSource('canvas')
    selectEdge(null)
    selectNode(String(d.id))
    toggleGroupCollapsed(groupId)
  }

  const onMouseOver = (event: MouseEvent, d: GraphNode) => {
    if (!hoverEnabled || !setHoverInfo) return
    const id = String(d.id)
    if (!id) return
    setHoverInfo(() => ({ kind: 'node', id, clientX: event.clientX, clientY: event.clientY }))
  }

  const onMouseMove = (event: MouseEvent, d: GraphNode) => {
    if (!hoverEnabled || !setHoverInfo) return
    const id = String(d.id)
    if (!id) return
    setHoverInfo(() => ({ kind: 'node', id, clientX: event.clientX, clientY: event.clientY }))
  }

  const onMouseOut = (event: MouseEvent, d: GraphNode) => {
    if (!hoverEnabled || !setHoverInfo) return
    const rt = (event as unknown as { relatedTarget?: unknown }).relatedTarget
    if (isTooltipRelatedTarget(rt)) return
    const id = String(d.id)
    if (!id) return
    setHoverInfo(prev => (prev && prev.kind === 'node' && prev.id === id ? null : prev))
  }

  ;(node as d3.Selection<SVGElement, GraphNode, SVGGElement, unknown>).on('contextmenu', onContextMenu)
  ;(node as d3.Selection<SVGElement, GraphNode, SVGGElement, unknown>).on('click', onClick)
  ;(node as d3.Selection<SVGElement, GraphNode, SVGGElement, unknown>).on('dblclick', onDblClick)
  ;(node as d3.Selection<SVGElement, GraphNode, SVGGElement, unknown>).on('mouseover', onMouseOver)
  ;(node as d3.Selection<SVGElement, GraphNode, SVGGElement, unknown>).on('mousemove', onMouseMove)
  ;(node as d3.Selection<SVGElement, GraphNode, SVGGElement, unknown>).on('mouseout', onMouseOut)
  if (mediaInteractiveSel) {
    mediaInteractiveSel.on('contextmenu', onContextMenu)
    mediaInteractiveSel.on('click', onClick)
    mediaInteractiveSel.on('dblclick', onDblClick)
    mediaInteractiveSel.on('mouseover', onMouseOver)
    mediaInteractiveSel.on('mousemove', onMouseMove)
    mediaInteractiveSel.on('mouseout', onMouseOut)
  }
  if (groupChevronSel) {
    groupChevronSel.on('click', onGroupChevronClick)
  }

  const portHandlesCfg = getPortHandlesConfig(schema);
  const portHandlesEnabled = portHandlesCfg.enabled;
  const portHandlesSel = (() => {
    if (!portHandlesEnabled) return null;
    const portLayer = g.append('g').attr('data-kg-layer', 'port-handles');
    const data = listPortHandlesForNodes(nodes, graphData.edges);
    if (!data.length) return null;
    return (portLayer
      .selectAll<SVGCircleElement, PortHandleDatum>('circle')
      .data(data, d => `${d.nodeId}:${d.side}`)
      .enter()
      .append('circle')
      .attr('r', portHandlesCfg.size)
      .attr('fill', portHandlesCfg.fill)
      .attr('stroke', portHandlesCfg.stroke)
      .attr('stroke-width', portHandlesCfg.strokeWidth)
      .style('pointer-events', 'none')) as d3.Selection<SVGCircleElement, PortHandleDatum, SVGGElement, unknown>;
  })();

  if (portHandlesSel) {
    const nodeById = new Map<string, GraphNode>();
    for (let i = 0; i < nodes.length; i += 1) nodeById.set(String(nodes[i].id), nodes[i]);
    portHandlesSel
      .attr('cx', d => {
        const n = nodeById.get(d.nodeId);
        if (!n) return 0;
        return getPortHandlePosition({ datum: d, node: n, schema, cfg: portHandlesCfg }).x;
      })
      .attr('cy', d => {
        const n = nodeById.get(d.nodeId);
        if (!n) return 0;
        return getPortHandlePosition({ datum: d, node: n, schema, cfg: portHandlesCfg }).y;
      });
  }

  return { nodeSel: node, mediaSel, portHandlesSel, groupChevronSel };
};
