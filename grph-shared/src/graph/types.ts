export type JSONValue = string | number | boolean | null | { [key: string]: JSONValue } | JSONValue[]

export interface GraphNode {
  id: string
  label: string
  type: string
  x?: number
  y?: number
  vx?: number
  vy?: number
  fx?: number | null
  fy?: number | null
  properties: Record<string, JSONValue>
  metadata?: Record<string, JSONValue>
}

export interface GraphEdge {
  id: string
  source: string
  target: string
  label: string
  type?: string
  properties: Record<string, JSONValue>
  metadata?: Record<string, JSONValue>
}

export interface GraphData {
  context?: JSONValue
  metadata?: Record<string, JSONValue>
  type: string
  nodes: GraphNode[]
  edges: GraphEdge[]
}
