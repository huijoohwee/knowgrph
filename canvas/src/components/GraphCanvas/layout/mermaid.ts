import dagre from 'dagre';
import { GraphNode, GraphEdge } from '@/lib/graph/types';
import { GraphSchema } from '@/lib/graph/schema';
import { calculateNodeDimensions } from '@/components/GraphCanvas/layout/utils';

export const applyMermaidLayout = (
  nodes: GraphNode[],
  edges: GraphEdge[],
  width: number,
  height: number,
  schema: GraphSchema,
) => {
  if (!nodes.length) return;

  const nodeIds = new Set<string>();
  const validNodes: GraphNode[] = [];
  
  nodes.forEach(n => {
    const id = String(n.id);
    if (!id) return;
    if (nodeIds.has(id)) return; // Skip duplicates
    if (String(n.type || '') === 'MermaidSubgraph') return;
    nodeIds.add(id);
    validNodes.push(n);
  });

  const mermaidConfig = (schema.layout as any)?.mermaid || {};
  
  const orientation = mermaidConfig?.orientation || 'vertical';
  const direction = mermaidConfig?.direction || 'source-target';
  
  let rankdir = 'LR';
  if (orientation === 'vertical') {
    if (direction === 'target-source') rankdir = 'BT';
    else rankdir = 'TB';
  } else {
    if (direction === 'target-source') rankdir = 'RL';
    else rankdir = 'LR';
  }

  const separation = typeof mermaidConfig?.separation === 'number' ? mermaidConfig.separation : 1.0;
  const nodeSep = 50 * separation;
  const rankSep = 50 * separation;

  const g = new dagre.graphlib.Graph({ multigraph: true, compound: false });
  
  g.setGraph({
    rankdir,
    nodesep: nodeSep,
    ranksep: rankSep,
    marginx: 40,
    marginy: 40,
    ranker: 'network-simplex',
  });

  g.setDefaultEdgeLabel(() => ({}));

  validNodes.forEach(node => {
    const id = String(node.id);
    
    const { width: w, height: h } = calculateNodeDimensions(node);

    if (!node.properties) node.properties = {};
    (node.properties as any)['visual:width'] = w;
    (node.properties as any)['visual:height'] = h;

    g.setNode(id, { width: w, height: h });
  });

  edges.forEach(edge => {
    const source = String(typeof edge.source === 'object' ? (edge.source as any).id : edge.source);
    const target = String(typeof edge.target === 'object' ? (edge.target as any).id : edge.target);
    
    if (
        source !== target && 
        nodeIds.has(source) && 
        nodeIds.has(target)
    ) {
       try {
         g.setEdge(source, target);
       } catch (e) {
         console.warn('Mermaid Layout: Failed to set edge', source, target, e);
       }
    }
  });

  try {
    dagre.layout(g);
  } catch (e) {
    console.error('Mermaid Layout: Dagre layout failed', e);
    return;
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  const positions = new Map<string, { x: number; y: number }>();

  g.nodes().forEach((v) => {
    const layoutNode = g.node(v) as { x: number; y: number; width: number; height: number };
    if (!layoutNode) return;
    
    positions.set(v, { x: layoutNode.x, y: layoutNode.y });

    const node = validNodes.find(n => String(n.id) === v);
    if (node) {
        if (!node.properties) node.properties = {};
        (node.properties as any)['visual:width'] = layoutNode.width;
        (node.properties as any)['visual:height'] = layoutNode.height;
        (node.properties as any)['visual:x'] = layoutNode.x;
        (node.properties as any)['visual:y'] = layoutNode.y;
    }

    if (Number.isFinite(layoutNode.x)) {
      if (layoutNode.x < minX) minX = layoutNode.x;
      if (layoutNode.x > maxX) maxX = layoutNode.x;
    }
    if (Number.isFinite(layoutNode.y)) {
      if (layoutNode.y < minY) minY = layoutNode.y;
      if (layoutNode.y > maxY) maxY = layoutNode.y;
    }
  });
  
  if (minX === Infinity || maxX === -Infinity) return;

  const graphWidth = maxX - minX;
  const graphHeight = maxY - minY;
  const centerX = minX + graphWidth / 2;
  const centerY = minY + graphHeight / 2;

  const targetCenterX = width / 2;
  const targetCenterY = height / 2;

  const offsetX = targetCenterX - centerX;
  const offsetY = targetCenterY - centerY;

  validNodes.forEach(node => {
    const id = String(node.id);
    const pos = positions.get(id);
    if (pos) {
      node.x = pos.x + offsetX;
      node.y = pos.y + offsetY;
      node.fx = node.x;
      node.fy = node.y;
    }
  });

  g.edges().forEach((e) => {
      const edgePoints = g.edge(e.v, e.w).points;
      
      const edge = edges.find(ed => {
          const s = String(typeof ed.source === 'object' ? (ed.source as any).id : ed.source);
          const t = String(typeof ed.target === 'object' ? (ed.target as any).id : ed.target);
          return s === e.v && t === e.w;
      });
      
      if (edge && edgePoints) {
          if (!edge.properties) edge.properties = {};
          (edge.properties as any)['visual:points'] = edgePoints.map((p: { x: number; y: number }) => ({
              x: p.x + offsetX,
              y: p.y + offsetY
          }));
      }
  });
};
