import { LS_KEYS } from '@/lib/config'
import { lsJson, lsSetJson } from '@/lib/persistence'

import type { FlowNodeSpec, FlowWorkflowSpec } from '@/features/storyboard-widget-manager/spec/specTypes'

export function readFlowNodeSpecFromStorage(): FlowNodeSpec | null {
  return lsJson(LS_KEYS.storyboardWidgetManagerNodeSpec, null, (raw) => (raw ? (raw as FlowNodeSpec) : null))
}

export function writeFlowNodeSpecToStorage(spec: FlowNodeSpec): void {
  try {
    lsSetJson(LS_KEYS.storyboardWidgetManagerNodeSpec, spec)
  } catch {
    void 0
  }
}

export function readFlowWorkflowSpecFromStorage(): FlowWorkflowSpec | null {
  return lsJson(LS_KEYS.storyboardWidgetManagerWorkflowSpec, null, (raw) => (raw ? (raw as FlowWorkflowSpec) : null))
}

export function writeFlowWorkflowSpecToStorage(spec: FlowWorkflowSpec): void {
  try {
    lsSetJson(LS_KEYS.storyboardWidgetManagerWorkflowSpec, spec)
  } catch {
    void 0
  }
}
