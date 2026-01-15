declare module 'dagre' {
  export namespace graphlib {
    class Graph {
      constructor(options?: { directed?: boolean; multigraph?: boolean; compound?: boolean });
      setGraph(label: Record<string, unknown>): void;
      setDefaultEdgeLabel(label: string | (() => unknown)): void;
      setNode(id: string, label: Record<string, unknown>): void;
      setEdge(v: string, w: string, label?: Record<string, unknown>, name?: string): void;
      nodes(): string[];
      edges(): { v: string; w: string }[];
      node(id: string): unknown;
      edge(v: string, w: string): unknown;
      nodeCount(): number;
      edgeCount(): number;
    }
  }
  export function layout(graph: graphlib.Graph): void;
}
