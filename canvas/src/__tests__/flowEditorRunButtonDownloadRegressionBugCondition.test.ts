/**
 * Bug Condition Exploration Test — Flow Editor Run Button Download Regression
 * Property 1: Non-download trigger click triggers *.json file download (EXPECTED FAIL on unfixed code)
 * Validates: Requirements 1.1, 1.2, 1.3
 *
 * Discriminating pattern: the node-level fallthrough uses `flow-node-${writableNodeId}` in suggestedName.
 * The legitimate whole-graph export (`exportWorkflowBundle`) uses `flow-workflow.widget.bundle.json` — NOT the bug.
 * All probes check for `flow-node-` + `.widget.bundle.json` to target the fallthrough, not the legitimate export.
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// ---------------------------------------------------------------------------
// isBugCondition predicate
// ---------------------------------------------------------------------------

function downloadTypeTriggerSet(action: { trigger?: string; mimeType?: string; filename?: string }): Set<string> {
  return action.trigger && action.mimeType && action.filename ? new Set([action.trigger]) : new Set()
}

function isBugCondition(
  action: { trigger: string; mimeType?: string; filename?: string },
  result: { fileDownloadInitiated: boolean },
): boolean {
  return !downloadTypeTriggerSet(action).has(action.trigger) && result.fileDownloadInitiated === true
}

// ---------------------------------------------------------------------------
// Shared file reads (done once, reused across probes)
// ---------------------------------------------------------------------------

const root = process.cwd()
const workflowActionsText = readFileSync(resolve(root, 'src/components/FlowEditorCanvas/runtime/useFlowEditorWorkflowActions.ts'), 'utf8')
const fileText = readFileSync(resolve(root, 'src/lib/graph/file.ts'), 'utf8')
const saveText = readFileSync(resolve(root, 'src/lib/graph/save.ts'), 'utf8')
const runnableTargetsText = readFileSync(resolve(root, 'src/components/FlowEditorCanvas/runtime/flowEditorWorkflowDownstreamRunTargets.ts'), 'utf8')

// Node-level fallthrough pattern — distinct from the legitimate whole-graph export
// Unfixed: `flow-node-${writableNodeId}.widget.bundle.json` exists in runWorkflowNode
// Fixed:   only `flow-workflow.widget.bundle.json` (exportWorkflowBundle) remains
const NODE_DOWNLOAD_FALLTHROUGH = 'flow-node-'
const nodeDownloadFallthroughActive = workflowActionsText.includes(NODE_DOWNLOAD_FALLTHROUGH) &&
  workflowActionsText.includes('.widget.bundle.json')

// ---------------------------------------------------------------------------
// Candidate A — <a download> mechanism exists + node-level fallthrough in dispatcher
// ---------------------------------------------------------------------------

export function testFlowEditorRunButtonBugCondition_CandidateA_DomAncestorProbe() {
  if (
    !(saveText.includes('a.download = filename') && saveText.includes('URL.createObjectURL(blob)') && saveText.includes('a.click()'))
  ) throw new Error('Precondition: downloadBlob <a download> pattern not found in save.ts')

  if (
    !(fileText.includes('exportWidgetBundleAsJson') && fileText.includes('new Blob([text]') && fileText.includes('downloadBlob(blob'))
  ) throw new Error('Precondition: exportWidgetBundleAsJson Blob/download pattern not found in file.ts')

  if (nodeDownloadFallthroughActive) {
    const hasHardcoded = workflowActionsText.includes('FLOW_TEXT_GENERATION_NODE_TYPE_ID') &&
      !workflowActionsText.includes('"InputWidget"') && !workflowActionsText.includes('"ComputeWidget"')
    throw new Error(
      `[COUNTEREXAMPLE — Candidate B confirmed] dispatcher has node-level fallthrough to exportWidgetBundleAsJson. ` +
      `hardcodedTypes=${hasHardcoded} fallthroughPattern="flow-node-*.widget.bundle.json"=true`
    )
  }
}

// ---------------------------------------------------------------------------
// Candidate B — node-level Blob URL branch reachable for non-download triggers
// ---------------------------------------------------------------------------

export function testFlowEditorRunButtonBugCondition_CandidateB_DispatcherBlobBranchProbe() {
  if (
    !(fileText.includes('new Blob([text]') && fileText.includes('application/json') && fileText.includes('downloadBlob(blob'))
  ) throw new Error('Precondition: exportWidgetBundleAsJson/downloadBlob not found in file.ts')

  const runnabilityMissingInputWidget =
    runnableTargetsText.includes('isFlowEditorWorkflowRunnableNode') &&
    runnableTargetsText.includes('FLOW_TEXT_GENERATION_NODE_TYPE_ID') &&
    !runnableTargetsText.includes('"InputWidget"') && !runnableTargetsText.includes('"ComputeWidget"')

  // Only flag bug if BOTH the node-level fallthrough AND missing runnability are present
  if (nodeDownloadFallthroughActive && runnabilityMissingInputWidget) {
    throw new Error(
      '[COUNTEREXAMPLE — Candidate B confirmed] Node-level Blob URL download branch reachable for runDownstream/compute triggers. ' +
      'Fix: remove flow-node-*.widget.bundle.json fallthrough from runWorkflowNode; unknown triggers → fallbackHandler.'
    )
  }
}

// ---------------------------------------------------------------------------
// Core assertion: isBugCondition holds for both concrete failing cases
// ---------------------------------------------------------------------------

export function testFlowEditorRunButtonBugCondition_CoreAssertion_isBugConditionHolds() {
  // Only the node-level fallthrough constitutes the bug
  if (!nodeDownloadFallthroughActive) return // fallthrough removed → bug is fixed, test passes

  const bugResult = { fileDownloadInitiated: true as const }
  const cases = [
    { id: 'run', label: 'Run', icon: 'play', trigger: 'runDownstream', targets: ['compute_summary'] },
    { id: 'run', label: 'Run', icon: 'play', primary: true, trigger: 'compute' },
  ]
  const failing = cases.filter(a => isBugCondition(a, bugResult))

  if (failing.length > 0) {
    throw new Error(
      '[EXPECTED FAILURE — bug confirmed] isBugCondition=true for: ' +
      failing.map(a => `trigger="${a.trigger}"`).join(', ') +
      '. Fix: remove flow-node-*.widget.bundle.json fallthrough from runWorkflowNode.'
    )
  }
}
