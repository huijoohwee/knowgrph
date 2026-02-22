export type LayerRank = ReadonlyArray<{ id: string; rank: number }>

export const DEFAULT_CANVAS_LAYER_ORDER_2D: LayerRank = [
  { id: 'groups', rank: -30 },
  { id: 'links', rank: -20 },
  { id: 'links-hit', rank: -5 },
  { id: 'edge-labels', rank: 5 },
  { id: 'temp-link', rank: 7 },
  { id: 'nodes', rank: 10 },
  { id: 'node-chevrons', rank: 12 },
  { id: 'media', rank: 14 },
  { id: 'port-handles', rank: 16 },
  { id: 'labels', rank: 18 },
  { id: 'group-labels', rank: 20 },
]

export const MERMAID_RENDER_ORDER_KEY_TO_LAYER_ID_2D: Readonly<Record<string, string>> = {
  MermaidSubgraph: 'groups',
  MermaidNode: 'nodes',
  edge: 'links',
  edgeLabels: 'edge-labels',
  nodeLabels: 'labels',
}

