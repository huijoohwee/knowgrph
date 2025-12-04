import { FlowDiagramData } from '../types/flow';

/**
 * Load flow diagram data from local data/outputs directory
 * Reads a0.jsonld and converts to flow diagram format
 */
export async function loadFlowData(): Promise<FlowDiagramData | null> {
  try {
    // Try to load from local data/outputs directory
    const response = await fetch('data/outputs/a0.jsonld');
    
    if (!response.ok) {
      console.warn('Could not load a0.jsonld, falling back to sample data');
      return getSampleFlowData();
    }

    const jsonld = await response.json();
    return convertJsonLdToFlowDiagram(jsonld);
  } catch (error) {
    console.error('Error loading flow data:', error);
    return getSampleFlowData();
  }
}

/**
 * Convert JSON-LD data to flow diagram format
 */
function convertJsonLdToFlowDiagram(jsonld: any): FlowDiagramData {
  const nodes: any[] = [];
  const edges: any[] = [];
  const nodeMap = new Map<string, any>();

  // Process each item in the graph
  const graph = jsonld['@graph'] || [];
  
  // First pass: create nodes
  graph.forEach((item: any, index: number) => {
    const subject = item.subject || item.id;
    const object = item.object;
    
    // Create subject node if it doesn't exist
    if (!nodeMap.has(subject)) {
      const node = {
        id: `node-${subject.toLowerCase().replace(/\s+/g, '-')}`,
        label: subject,
        node_type: getNodeType(subject, item),
        position: { x: 100 + (nodes.length * 200), y: 100 + (nodes.length * 50) },
        data: { ...item }
      };
      nodes.push(node);
      nodeMap.set(subject, node);
    }

    // Create object node if it doesn't exist and object is not empty
    if (object && !nodeMap.has(object)) {
      const node = {
        id: `node-${object.toLowerCase().replace(/\s+/g, '-')}`,
        label: object,
        node_type: getNodeType(object, item),
        position: { x: 100 + (nodes.length * 200), y: 100 + (nodes.length * 50) },
        data: { ...item }
      };
      nodes.push(node);
      nodeMap.set(object, node);
    }

    // Create edge if both nodes exist and there's a predicate
    if (item.predicate && subject && object) {
      const sourceNode = nodeMap.get(subject);
      const targetNode = nodeMap.get(object);
      
      if (sourceNode && targetNode) {
        edges.push({
          id: `edge-${index}`,
          source: sourceNode.id,
          target: targetNode.id,
          label: item.predicate,
          edge_type: getEdgeType(item.predicate)
        });
      }
    }
  });

  // Auto-layout nodes in a more readable format
  layoutNodes(nodes, edges);

  return {
    id: 'readme-flow',
    title: 'README Example Flow',
    description: 'Interactive visualization of the pipeline flow from README.md',
    created_at: new Date().toISOString(),
    layout_type: 'flow',
    nodes,
    edges
  };
}

/**
 * Determine node type based on content
 */
function getNodeType(label: string, item: any): 'process' | 'decision' | 'input' | 'output' {
  const lowerLabel = label.toLowerCase();
  
  if (lowerLabel.includes('markdown') || lowerLabel.includes('csv') || lowerLabel.includes('json')) {
    return 'input';
  }
  if (lowerLabel.includes('chart') || lowerLabel.includes('graph') || lowerLabel.includes('view')) {
    return 'output';
  }
  if (lowerLabel.includes('engine') || lowerLabel.includes('query') || lowerLabel.includes('process')) {
    return 'process';
  }
  if (lowerLabel.includes('decision') || lowerLabel.includes('evaluate')) {
    return 'decision';
  }
  
  return 'process';
}

/**
 * Determine edge type based on predicate
 */
function getEdgeType(predicate: string): 'default' | 'conditional' | 'loop' {
  const lowerPred = predicate.toLowerCase();
  
  if (lowerPred.includes('transform') || lowerPred.includes('convert')) {
    return 'default';
  }
  if (lowerPred.includes('loop') || lowerPred.includes('cycle')) {
    return 'loop';
  }
  if (lowerPred.includes('if') || lowerPred.includes('condition')) {
    return 'conditional';
  }
  
  return 'default';
}

/**
 * Simple auto-layout algorithm
 */
function layoutNodes(nodes: any[], edges: any[]) {
  const levels = new Map<string, number>();
  const visited = new Set<string>();
  
  // Find starting nodes (no incoming edges)
  const incomingEdges = new Map<string, number>();
  edges.forEach((edge: any) => {
    incomingEdges.set(edge.target, (incomingEdges.get(edge.target) || 0) + 1);
  });
  
  // BFS to assign levels
  const queue: string[] = [];
  nodes.forEach((node: any) => {
    if (!incomingEdges.has(node.id)) {
      queue.push(node.id);
      levels.set(node.id, 0);
    }
  });
  
  while (queue.length > 0) {
    const currentId = queue.shift()!;
    if (visited.has(currentId)) continue;
    visited.add(currentId);
    
    const currentLevel = levels.get(currentId) || 0;
    
    // Find outgoing edges
    edges.forEach((edge: any) => {
      if (edge.source === currentId && !visited.has(edge.target)) {
        levels.set(edge.target, Math.max(levels.get(edge.target) || 0, currentLevel + 1));
        queue.push(edge.target);
      }
    });
  }
  
  // Position nodes by level
  const levelGroups = new Map<number, any[]>();
  nodes.forEach((node: any) => {
    const level = levels.get(node.id) || 0;
    if (!levelGroups.has(level)) {
      levelGroups.set(level, []);
    }
    levelGroups.get(level)!.push(node);
  });
  
  // Calculate positions
  levelGroups.forEach((group, level) => {
    const y = 50 + level * 120;
    const spacing = Math.max(200, 800 / Math.max(group.length, 1));
    const startX = 50 + Math.max(0, (800 - (group.length - 1) * spacing) / 2);
    
    group.forEach((node: any, index: number) => {
      node.position = {
        x: startX + index * spacing,
        y: y
      };
    });
  });
}

/**
 * Fallback sample data based on README Example Flow
 */
function getSampleFlowData(): FlowDiagramData {
  return {
    id: 'sample-readme-flow',
    title: 'README Example Flow (Sample)',
    description: 'Sample flow diagram from README.md Example Flow',
    created_at: new Date().toISOString(),
    layout_type: 'flow',
    nodes: [
      {
        id: 'markdown',
        label: 'Markdown',
        node_type: 'input',
        position: { x: 50, y: 50 }
      },
      {
        id: 'csv',
        label: 'CSV (A0 schema)',
        node_type: 'process',
        position: { x: 250, y: 50 }
      },
      {
        id: 'jsonld',
        label: 'JSON-LD',
        node_type: 'process',
        position: { x: 450, y: 50 }
      },
      {
        id: 'rdf',
        label: 'RDF (rdflib)',
        node_type: 'process',
        position: { x: 650, y: 50 }
      },
      {
        id: 'sparql',
        label: 'SPARQL queries',
        node_type: 'process',
        position: { x: 150, y: 170 }
      },
      {
        id: 'eda',
        label: 'EDA (pandas/NumPy)',
        node_type: 'process',
        position: { x: 350, y: 170 }
      },
      {
        id: 'mlp',
        label: 'MLP (scikit-learn/PyTorch)',
        node_type: 'process',
        position: { x: 550, y: 170 }
      },
      {
        id: 'engine',
        label: 'Curriculum Engine',
        node_type: 'process',
        position: { x: 250, y: 290 }
      },
      {
        id: 'd3',
        label: 'D3.js',
        node_type: 'output',
        position: { x: 450, y: 290 }
      },
      {
        id: 'cytoscape',
        label: 'Cytoscape.js',
        node_type: 'output',
        position: { x: 650, y: 290 }
      }
    ],
    edges: [
      {
        id: 'e1',
        source: 'markdown',
        target: 'csv',
        label: 'transforms_to',
        edge_type: 'default'
      },
      {
        id: 'e2',
        source: 'csv',
        target: 'jsonld',
        label: 'transforms_to',
        edge_type: 'default'
      },
      {
        id: 'e3',
        source: 'jsonld',
        target: 'rdf',
        label: 'transforms_to',
        edge_type: 'default'
      },
      {
        id: 'e4',
        source: 'rdf',
        target: 'sparql',
        label: 'extracts',
        edge_type: 'default'
      },
      {
        id: 'e5',
        source: 'sparql',
        target: 'eda',
        label: 'feeds_to',
        edge_type: 'default'
      },
      {
        id: 'e6',
        source: 'eda',
        target: 'mlp',
        label: 'feeds_to',
        edge_type: 'default'
      },
      {
        id: 'e7',
        source: 'mlp',
        target: 'engine',
        label: 'feeds_to',
        edge_type: 'default'
      },
      {
        id: 'e8',
        source: 'engine',
        target: 'd3',
        label: 'generates',
        edge_type: 'default'
      },
      {
        id: 'e9',
        source: 'engine',
        target: 'cytoscape',
        label: 'generates',
        edge_type: 'default'
      }
    ]
  };
}
