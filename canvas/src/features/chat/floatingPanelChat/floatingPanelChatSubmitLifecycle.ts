import type React from 'react'
import type { StreamingAssistantState } from '../FloatingPanelChatSections'

export type SubmitStreamingWorkspaceResetRefs = {
  setStreamingWorkspacePath: React.Dispatch<React.SetStateAction<string | null>>
  streamFollowRef: { current: { path: string; atMs: number } | null }
  streamDraftTextRef: { current: { path: string; text: string } | null }
}

export const resetSubmitStreamingWorkspaceState = (
  args: SubmitStreamingWorkspaceResetRefs,
): void => {
  args.setStreamingWorkspacePath(null)
  args.streamFollowRef.current = null
  args.streamDraftTextRef.current = null
}

export const finalizeSubmitTerminalState = (args: SubmitStreamingWorkspaceResetRefs & {
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>
  abortRef: { current: AbortController | null }
}): void => {
  args.setIsLoading(false)
  args.abortRef.current = null
  resetSubmitStreamingWorkspaceState(args)
}

export const dismissPendingSubmitAssistant = <TMessage extends { id: string }>(args: {
  assistantMessageId: string
  setStreamingAssistant: React.Dispatch<React.SetStateAction<StreamingAssistantState | null>>
  setMessages: React.Dispatch<React.SetStateAction<TMessage[]>>
}): void => {
  args.setStreamingAssistant(null)
  args.setMessages(prev => prev.filter(message => message.id !== args.assistantMessageId))
}
