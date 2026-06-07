import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  isFlowEditorWorkflowRunnableNode,
  readFlowWidgetCardRunDownstreamTargetIds,
  resolveFlowEditorWorkflowDownstreamRunTargetIds,
} from '@/components/FlowEditorCanvas/runtime/flowEditorWorkflowDownstreamRunTargets'
import type { GraphData, GraphNode } from '@/lib/graph/types'

export function testFlowEditorCanvasRunsFlowComputeBeforeProviderTextBranch() {
  const workflowActionsText = readFileSync(resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorWorkflowActions.ts'), 'utf8')
  const workflowRunInputsText = readFileSync(resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'flowEditorWorkflowRunInputs.ts'), 'utf8')
  const requiredRunInputs = [
    'export function buildFlowEditorInlineComputeOutputPatch(args: {',
    "if (!args.node || !readFlowComputeSource(args.node)) return null",
    "const isComputedDataOutput = outputSchemaPaths.size === 0 && schemaPath.startsWith('properties.data.')",
  ]
  for (const snippet of requiredRunInputs) {
    if (!workflowRunInputsText.includes(snippet)) throw new Error(`expected FlowEditor workflow run-input helper to include ${snippet}`)
  }
  const inlineComputeIndex = workflowActionsText.indexOf("if (typeof rawNodeProperties['flow:compute'] === 'string' && rawNodeProperties['flow:compute'].trim())")
  const providerTextIndex = workflowActionsText.indexOf("if (String(node.type || '').trim() === FLOW_TEXT_GENERATION_NODE_TYPE_ID)")
  if (inlineComputeIndex < 0 || providerTextIndex < 0 || inlineComputeIndex > providerTextIndex) {
    throw new Error('expected FlowEditor workflow run path to execute authored flow:compute before provider TextGeneration runs')
  }
  for (const snippet of [
    'const nextInlinePatch = buildFlowEditorInlineComputeOutputPatch({',
    'updateRunOutputForKnownNodeIds(nodeProps => buildFlowEditorInlineComputeOutputPatch({',
    "message: 'Ran inline compute.'",
    'resolveFlowEditorWorkflowDownstreamRunTargetIds({',
    'await runWorkflowNode(targetId, { allowCreateRichMediaPanel, visitedNodeIds })',
  ]) {
    if (!workflowActionsText.includes(snippet)) throw new Error(`expected FlowEditor workflow run path to include ${snippet}`)
  }

  const sourceNode: GraphNode = {
    id: 'source_input',
    type: 'InputWidget',
    label: 'Source Input',
    properties: {
      'canvas:widgetCard': {
        key: 'canvas:widgetCard',
        type: 'object',
        value: {
          onEdit: { trigger: 'runDownstream', targets: ['compute_summary'] },
          actions: [
            { id: 'run', trigger: 'runDownstream', targets: ['compute_summary', 'compute_summary'] },
          ],
        },
      },
    } as never,
  } as GraphNode
  const computeNode: GraphNode = {
    id: 'compute_summary',
    type: 'ComputeWidget',
    label: 'Compute Summary',
    properties: { 'flow:compute': 'inputs => ({ output: inputs.query })' } as never,
  } as GraphNode
  const graphData: GraphData = {
    nodes: [sourceNode, computeNode],
    edges: [
      { id: 'source-to-compute', source: 'source_input', target: 'compute_summary', properties: {} },
    ],
  } as never
  const authoredTargetIds = readFlowWidgetCardRunDownstreamTargetIds(sourceNode)
  if (authoredTargetIds.join(',') !== 'compute_summary') {
    throw new Error('expected authored widget-card runDownstream targets to be deduped and reusable by the overlay Run action')
  }
  const downstreamTargetIds = resolveFlowEditorWorkflowDownstreamRunTargetIds({ node: sourceNode, graphData })
  if (downstreamTargetIds.join(',') !== 'compute_summary') {
    throw new Error('expected overlay Run on source widgets to resolve authored downstream compute targets')
  }
  if (!isFlowEditorWorkflowRunnableNode({ node: computeNode })) {
    throw new Error('expected downstream flow:compute node to be treated as runnable')
  }
}
