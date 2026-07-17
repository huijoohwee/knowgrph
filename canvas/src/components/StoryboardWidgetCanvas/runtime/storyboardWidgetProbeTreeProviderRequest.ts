export const PROBE_TREE_CLARIFICATION_PROVIDER_TASK_MARKER = 'Widget Card Probe-Tree provider task:'
export const PROBE_TREE_TERMINAL_PROVIDER_TASK_MARKER = 'Terminal generation task:'

const PROBE_TREE_PROVIDER_TASK_MARKERS = [
  PROBE_TREE_CLARIFICATION_PROVIDER_TASK_MARKER,
  PROBE_TREE_TERMINAL_PROVIDER_TASK_MARKER,
] as const

export const PROBE_TREE_PROVIDER_MIN_OUTPUT_TOKENS = 2_400

export function resolveStoryboardWidgetProbeTreeProviderRequestOptions(args: {
  prompt: string
  chatMaxCompletionTokens: unknown
  chatReasoningEffort: unknown
}): { chatMaxCompletionTokens: unknown; chatReasoningEffort: unknown } {
  const prompt = String(args.prompt || '')
  if (!PROBE_TREE_PROVIDER_TASK_MARKERS.some(marker => prompt.includes(marker))) {
    return {
      chatMaxCompletionTokens: args.chatMaxCompletionTokens,
      chatReasoningEffort: args.chatReasoningEffort,
    }
  }
  const configuredTokens = Number(args.chatMaxCompletionTokens)
  return {
    chatMaxCompletionTokens: Math.max(
      Number.isFinite(configuredTokens) ? configuredTokens : 0,
      PROBE_TREE_PROVIDER_MIN_OUTPUT_TOKENS,
    ),
    chatReasoningEffort: 'minimal',
  }
}
