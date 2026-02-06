import { LS_KEYS } from '@/lib/config'
import { lsJson, lsSetJson } from '@/lib/persistence'

import type { FlowNodeSpec, FlowWorkflowSpec } from '@/features/flow-editor-manager/spec/specTypes'

export function readFlowNodeSpecFromStorage(): FlowNodeSpec | null {
  return lsJson(LS_KEYS.flowEditorManagerNodeSpec, null, (raw) => (raw ? (raw as FlowNodeSpec) : null))
}

export function writeFlowNodeSpecToStorage(spec: FlowNodeSpec): void {
  try {
    lsSetJson(LS_KEYS.flowEditorManagerNodeSpec, spec)
  } catch {
    void 0
  }
}

export function readFlowWorkflowSpecFromStorage(): FlowWorkflowSpec | null {
  return lsJson(LS_KEYS.flowEditorManagerWorkflowSpec, null, (raw) => (raw ? (raw as FlowWorkflowSpec) : null))
}

export function writeFlowWorkflowSpecToStorage(spec: FlowWorkflowSpec): void {
  try {
    lsSetJson(LS_KEYS.flowEditorManagerWorkflowSpec, spec)
  } catch {
    void 0
  }
}
