import { frontmatterFlowTextHasRepeatedCanonicalStringResidue } from '@/features/parsers/markdownFrontmatterFlowRepair'

export async function testFrontmatterFlowRepairDetectsRepeatedCanonicalResidueAcrossNodeAndEdgeStringFields() {
  const canonicalText = [
    '---',
    'flow:',
    '  nodes:',
    '    - id: source_input',
    '      type: InputWidget',
    '      label: {key: label, type: string, value: "Source Input"}',
    '    - id: compute_summary',
    '      type: ComputeWidget',
    '      label: {key: label, type: string, value: "Compute Summary"}',
    '      compute:',
    '        key: compute',
    '        type: string',
    '        value: |',
    '          inputs => ({ outputSrcDoc: "frame summary" })',
    '  edges:',
    '    - id: edge_metric',
    '      source: {key: source, type: string, value: "source_input"}',
    '      sourceHandle: {key: sourceHandle, type: string, value: "input_metric_target"}',
    '      target: {key: target, type: string, value: "compute_summary"}',
    '      targetHandle: {key: targetHandle, type: string, value: "input_metric_target"}',
    '      label: {key: label, type: string, value: "input_metric_target"}',
    '      type: {key: type, type: string, value: "template_number_signal"}',
    '---',
    '',
  ].join('\n')

  const repeatedLabelText = canonicalText.replace(
    'Source Input',
    'Source InputSource Input XSource Input stale',
  )
  if (!frontmatterFlowTextHasRepeatedCanonicalStringResidue({
    documentName: 'runtime-flow.md',
    currentText: repeatedLabelText,
    canonicalText,
  })) {
    throw new Error('expected repeated node label residue to be detected')
  }

  const repeatedNodeTypeText = canonicalText.replace(
    'type: ComputeWidget',
    'type: ComputeWidgetComputeWidget stale ComputeWidget',
  )
  if (!frontmatterFlowTextHasRepeatedCanonicalStringResidue({
    documentName: 'runtime-flow.md',
    currentText: repeatedNodeTypeText,
    canonicalText,
  })) {
    throw new Error('expected repeated node type residue to be detected')
  }

  const repeatedPropertyText = canonicalText.replace(
    'inputs => ({ outputSrcDoc: "frame summary" })',
    'inputs => ({ outputSrcDoc: "frame summary" })inputs => ({ outputSrcDoc: "frame summary" }) // stale append',
  )
  if (!frontmatterFlowTextHasRepeatedCanonicalStringResidue({
    documentName: 'runtime-flow.md',
    currentText: repeatedPropertyText,
    canonicalText,
  })) {
    throw new Error('expected repeated node string property residue to be detected')
  }

  const repeatedEdgeText = canonicalText.replace(
    'input_metric_target',
    'input_metric_targetinput_metric_target extra input_metric_target',
  )
  if (!frontmatterFlowTextHasRepeatedCanonicalStringResidue({
    documentName: 'runtime-flow.md',
    currentText: repeatedEdgeText,
    canonicalText,
  })) {
    throw new Error('expected repeated edge string residue to be detected')
  }

  const repeatedEdgeTargetText = canonicalText.replace(
    'target: {key: target, type: string, value: "compute_summary"}',
    'target: {key: target, type: string, value: "compute_summarycompute_summary stale compute_summary"}',
  )
  if (!frontmatterFlowTextHasRepeatedCanonicalStringResidue({
    documentName: 'runtime-flow.md',
    currentText: repeatedEdgeTargetText,
    canonicalText,
  })) {
    throw new Error('expected repeated edge endpoint residue to be detected')
  }

  const nonCorruptedText = canonicalText.replace('Compute Summary', 'Compute Summary V2')
  if (frontmatterFlowTextHasRepeatedCanonicalStringResidue({
    documentName: 'runtime-flow.md',
    currentText: nonCorruptedText,
    canonicalText,
  })) {
    throw new Error('expected non-repeated field edits to avoid false positives')
  }
}
