export interface FlowNode {
  id: string;
  label: string;
  node_type: 'process' | 'decision' | 'input' | 'output';
  position: { x: number; y: number };
  data?: Record<string, unknown>;
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  edge_type: 'default' | 'conditional' | 'loop';
}

export interface FlowDiagramData {
  id: string;
  title: string;
  description: string;
  created_at: string;
  layout_type: 'flow' | 'graph' | 'timeline';
  nodes: FlowNode[];
  edges: FlowEdge[];
}