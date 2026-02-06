import type { JSONValue } from '@/lib/graph/types'

export type FlowSpecValueType = 'string' | 'number' | 'boolean' | 'json' | 'any'

export type FlowSpecDirection = 'input' | 'output'

export interface FlowNodePortSpec {
  key: string
  direction: FlowSpecDirection
  valueType: FlowSpecValueType
  required?: boolean
  defaultValue?: JSONValue
  description?: string
}

export interface FlowNodeSpecV1 {
  kind: 'kg:flow:nodeSpec'
  version: 1
  nodeTypeId: string
  displayName?: string
  category?: string
  description?: string
  ports: FlowNodePortSpec[]
}

export interface FlowWorkflowNodeBindingV1 {
  id: string
  nodeTypeId: string
  title?: string
  inputs?: Record<string, JSONValue>
}

export interface FlowWorkflowSpecV1 {
  kind: 'kg:flow:workflowSpec'
  version: 1
  workflowId: string
  title?: string
  description?: string
  nodes: FlowWorkflowNodeBindingV1[]
}

export type FlowNodeSpec = FlowNodeSpecV1
export type FlowWorkflowSpec = FlowWorkflowSpecV1

