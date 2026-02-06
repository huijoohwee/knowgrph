import {
  buildDefaultFlowNodeSpec,
  buildDefaultFlowWorkflowSpec,
  validateFlowNodeSpec,
  validateFlowWorkflowSpec,
} from '@/features/flow-editor-manager/spec/specValidation'

export function testFlowEditorSpecNodeValidationAcceptsDefault() {
  const spec = buildDefaultFlowNodeSpec({ nodeTypeId: 'Node' })
  const res = validateFlowNodeSpec(spec)
  if (res.ok !== true) throw new Error(res.error)
}

export function testFlowEditorSpecWorkflowValidationRejectsDuplicateNodeIds() {
  const spec = buildDefaultFlowWorkflowSpec({ workflowId: 'wf' })
  spec.nodes = [
    { id: 'a', nodeTypeId: 'Node' },
    { id: 'a', nodeTypeId: 'Node' },
  ]
  const res = validateFlowWorkflowSpec(spec)
  if (res.ok) throw new Error('expected validation error')
}
