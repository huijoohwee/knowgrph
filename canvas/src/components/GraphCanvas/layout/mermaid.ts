import dagre from 'dagre';
import { GraphNode, GraphEdge } from '@/lib/graph/types';
import { GraphSchema, getNodeRadiusFromSchema } from '@/lib/graph/schema';

// Standalone Mermaid Layout Implementation
// Decoupled from generic 'tree' layout to ensure stability and specific handling for Mermaid diagrams.
// Uses dagre for hierarchical layout (TD/LR/etc.)

export const applyMermaidLayout = (
  nodes: GraphNode[],
  edges: GraphEdge[],
  width: number,
  height: number,
  schema: GraphSchema,
) => {
  if (!nodes.length) return;

  const mermaidConfig = (schema.layout as any)?.mermaid || {};
  
  // 1. Determine Layout Direction
  const orientation = mermaidConfig?.orientation || 'horizontal';
  const direction = mermaidConfig?.direction || 'source-target';
  
  let rankdir = 'LR';
  if (orientation === 'vertical') {
    if (direction === 'target-source') rankdir = 'BT';
    else rankdir = 'TB';
  } else {
    if (direction === 'target-source') rankdir = 'RL';
    else rankdir = 'LR';
  }

  // 2. Configure Separation
  // Default to spread out values to ensure visibility
  // Adjusted defaults to be more reasonable (standard dagre is ~50)
  const separation = typeof mermaidConfig?.separation === 'number' ? mermaidConfig.separation : 1.0;
  const nodeSep = 50 * separation;
  const rankSep = 50 * separation;

  // 3. Build Dagre Graph
  const g = new dagre.graphlib.Graph({ multigraph: true, compound: true });
  
  g.setGraph({
    rankdir,
    nodesep: nodeSep,
    ranksep: rankSep,
    marginx: 100,
    marginy: 100,
  });

  g.setDefaultEdgeLabel(() => ({}));

  // 4. Add Nodes
  const nodeIds = new Set<string>();
  nodes.forEach(node => {
    const id = String(node.id);
    nodeIds.add(id);
    
    // Calculate dimensions based on label text
    const label = String(node.label || node.id || '');
    const charWidth = 9;
    const lineHeight = 20; // Slightly taller for readability
    const paddingX = 32; // Generous padding
    const paddingY = 20;
    
    const lines = label.split('\n');
    const maxLineLength = Math.max(...lines.map(l => l.length));
    const textWidth = Math.max(40, maxLineLength * charWidth); // Minimum width
    const textHeight = Math.max(20, lines.length * lineHeight);

    const w = textWidth + paddingX;
    const h = textHeight + paddingY;

    // Store in properties for the renderer to pick up
    if (!node.properties) node.properties = {};
    (node.properties as any)['visual:width'] = w;
    (node.properties as any)['visual:height'] = h;

    g.setNode(id, { width: w, height: h });
    
    // Handle subgraphs (compound layout)
    // If this node is a subgraph, set it as a parent for its children
    if (node.type === 'MermaidSubgraph') {
      // Logic for children should be handled if we have parent/child info.
      // Assuming 'children' property or similar, or we iterate all nodes to find those with this parent.
      // However, usually in flat list, children point to parent.
    }
    // Check if node has a parent (subgraph)
     const parentId = (node as any).parent;
     if (parentId) {
        (g as any).setParent(id, String(parentId));
     }
   });

  // 5. Add Edges
  edges.forEach(edge => {
    const source = String(typeof edge.source === 'object' ? (edge.source as any).id : edge.source);
    const target = String(typeof edge.target === 'object' ? (edge.target as any).id : edge.target);
    
    if (nodeIds.has(source) && nodeIds.has(target)) {
       g.setEdge(source, target);
    }
  });

  // 6. Compute Layout
  dagre.layout(g);

  // 7. Extract Positions and Bounds
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  const positions = new Map<string, { x: number; y: number }>();

  g.nodes().forEach((v) => {
    const layoutNode = g.node(v) as { x: number; y: number; width: number; height: number };
    if (!layoutNode) return;
    
    positions.set(v, { x: layoutNode.x, y: layoutNode.y });

    // Store layout dimensions back to node for rendering
    // This supports Subgraph rendering which needs width/height
    const node = nodes.find(n => String(n.id) === v);
    if (node) {
        if (!node.properties) node.properties = {};
        (node.properties as any)['visual:width'] = layoutNode.width;
        (node.properties as any)['visual:height'] = layoutNode.height;
        (node.properties as any)['visual:x'] = layoutNode.x;
        (node.properties as any)['visual:y'] = layoutNode.y;
    }

    if (layoutNode.x < minX) minX = layoutNode.x;
    if (layoutNode.x > maxX) maxX = layoutNode.x;
    if (layoutNode.y < minY) minY = layoutNode.y;
    if (layoutNode.y > maxY) maxY = layoutNode.y;
  });
  
  // Extract Edge Points
   g.edges().forEach((e) => {
       const edgePoints = g.edge(e.v, e.w).points;
       // Find the edge object to store points
      // Note: This is O(E*N) potentially, but usually E is small.
      // Better to map edges by ID or source-target.
      // But edges array here is the source of truth.
      const edge = edges.find(ed => {
          const s = String(typeof ed.source === 'object' ? (ed.source as any).id : ed.source);
          const t = String(typeof ed.target === 'object' ? (ed.target as any).id : ed.target);
          return s === e.v && t === e.w;
      });
      if (edge) {
          if (!edge.properties) edge.properties = {};
          (edge.properties as any)['visual:points'] = edgePoints;
      }
  });

  // 8. Center the Graph in the Viewport
  // "ALWAYS well spreadout, center, visible within canvas/viewport"
  if (minX === Infinity) return;

  const graphWidth = maxX - minX;
  const graphHeight = maxY - minY;
  const centerX = minX + graphWidth / 2;
  const centerY = minY + graphHeight / 2;

  const targetCenterX = width / 2;
  const targetCenterY = height / 2;

  const offsetX = targetCenterX - centerX;
  const offsetY = targetCenterY - centerY;

  nodes.forEach(node => {
    const id = String(node.id);
    const pos = positions.get(id);
    if (pos) {
      node.x = pos.x + offsetX;
      node.y = pos.y + offsetY;
    }
  });
};
