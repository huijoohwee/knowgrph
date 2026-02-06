import { defaultSchema } from '@/lib/graph/schema'
import type { GraphData } from '@/lib/graph/types'
import {
  convertNodeToLoopInGraphData,
  enableHandlesForAllInputsInSchema,
  isHandlesForAllInputsEnabled,
  isLoopNode,
} from '@/lib/flowEditor/flowEditorActions'

export const testFlowEditorEnableHandlesForAllInputsIsIdempotent = () => {
  const base = { ...defaultSchema, behavior: { ...defaultSchema.behavior, portHandles: { ...defaultSchema.behavior.portHandles } } }
  if (isHandlesForAllInputsEnabled(base)) throw new Error('precondition failed: handles should start disabled')
  const first = enableHandlesForAllInputsInSchema(base)
  if (!first.changed) throw new Error('expected schema to change when enabling handles')
  if (!isHandlesForAllInputsEnabled(first.schema)) throw new Error('expected schema handles showAllInputs to be enabled')
  const second = enableHandlesForAllInputsInSchema(first.schema)
  if (second.changed) throw new Error('expected enabling handles to be idempotent when already enabled')
  if (second.schema !== first.schema) throw new Error('expected idempotent enable to return same schema reference')
}

export const testFlowEditorConvertToLoopSetsTypeAndKind = () => {
  const graphData: GraphData = {
    type: 'graph',
    nodes: [{ id: 'n1', label: 'A', type: 'Node', properties: {} }],
    edges: [],
  }
  const out = convertNodeToLoopInGraphData(graphData, 'n1')
  if (!out.changed) throw new Error('expected conversion to change graph')
  const n1 = (out.graphData.nodes || []).find(n => String(n.id || '') === 'n1') || null
  if (!n1) throw new Error('expected node to exist after conversion')
  if (!isLoopNode(n1)) throw new Error('expected node to be identified as loop')

  const second = convertNodeToLoopInGraphData(out.graphData, 'n1')
  if (second.changed) throw new Error('expected conversion to be idempotent when already loop')
  if (second.graphData !== out.graphData) throw new Error('expected idempotent convert to return same graph reference')
}
