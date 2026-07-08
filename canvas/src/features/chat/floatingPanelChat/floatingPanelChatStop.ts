import type React from 'react'
import type { StreamingAssistantState } from '../FloatingPanelChatSections'
import {
  abortDurableChatStreamRun,
  clearActiveDurableChatStreamRun,
  forgetDurableChatStreamRun,
  readActiveDurableChatStreamRun,
} from './floatingPanelChatDurableStream'
import {
  finalizeSubmitTerminalState,
  type SubmitStreamingWorkspaceResetRefs,
} from './floatingPanelChatSubmitLifecycle'

type StopFloatingPanelChatStreamArgs = SubmitStreamingWorkspaceResetRefs & {
  abortRef: React.MutableRefObject<AbortController | null>
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>
  setStreamingAssistant: React.Dispatch<React.SetStateAction<StreamingAssistantState | null>>
  setStreamingInsights: React.Dispatch<React.SetStateAction<{
    reasoningPreview: string | null
    reasoningStepCount: number
    usageSummary: string | null
    finishReason: string | null
    modelId: string | null
  } | null>>
}

export function stopFloatingPanelChatStream(args: StopFloatingPanelChatStreamArgs): void {
  let handled = false
  const activeDurableRun = readActiveDurableChatStreamRun()
  if (activeDurableRun?.runId) {
    handled = true
    clearActiveDurableChatStreamRun(activeDurableRun.runId)
    void abortDurableChatStreamRun(activeDurableRun.runId)
    void forgetDurableChatStreamRun(activeDurableRun.runId)
  }
  const ctrl = args.abortRef.current
  if (ctrl) {
    handled = true
    try {
      ctrl.abort()
    } catch {
      void 0
    }
  }
  if (!handled) return
  finalizeSubmitTerminalState(args)
  args.setStreamingAssistant(null)
  args.setStreamingInsights(null)
}
