import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

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
  ]) {
    if (!workflowActionsText.includes(snippet)) throw new Error(`expected FlowEditor workflow run path to include ${snippet}`)
  }
}
