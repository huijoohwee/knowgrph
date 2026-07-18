import { generateRunMarkdownWithProvider } from '@/features/chat/byteplusRunGeneration'
import type { GraphState } from '@/hooks/useGraphStore'
import { resolveStoryboardWidgetTextThinkingOptions } from './storyboardWidgetWorkflowTextThinking'

export function generateStoryboardWidgetTextWithProvider(args: {
  properties: Record<string, unknown>
  store: GraphState
  formId: unknown
  localProperties: Record<string, unknown>
  prompt: string
  onText?: (nextText: string) => void
}): Promise<string> {
  const { properties, store } = args
  const thinkingOptions = resolveStoryboardWidgetTextThinkingOptions({
    formId: args.formId,
    localProperties: args.localProperties,
    prompt: args.prompt,
    resolvedMaxCompletionTokens: properties.chatMaxCompletionTokens ?? store.chatMaxCompletionTokens,
    resolvedReasoningEffort: properties.chatReasoningEffort ?? store.chatReasoningEffort,
    resolvedThinkingJson: properties.chatThinkingJson ?? store.chatThinkingJson,
    resolvedThinkingType: properties.chatThinkingType ?? store.chatThinkingType,
  })
  return generateRunMarkdownWithProvider({
    config: {
      provider: properties.chatProvider || store.chatProvider,
      endpointUrl: properties.chatEndpointUrl || store.chatEndpointUrl,
      apiKey: (properties.chatAuthMode || store.chatAuthMode) === 'byok' ? store.chatApiKey : '',
      chatModel: properties.chatModel || store.chatModel,
    },
    prompt: args.prompt,
    options: {
      chatTemperature: properties.chatTemperature ?? store.chatTemperature,
      chatMaxCompletionTokens: thinkingOptions.chatMaxCompletionTokens,
      chatServiceTier: properties.chatServiceTier ?? store.chatServiceTier,
      chatStream: args.onText ? properties.chatStream ?? store.chatStream : false,
      chatMessagesJson: properties.chatMessagesJson ?? store.chatMessagesJson,
      chatReasoningEffort: thinkingOptions.chatReasoningEffort,
      chatThinkingType: thinkingOptions.chatThinkingType,
      chatThinkingJson: thinkingOptions.chatThinkingJson,
      chatFrequencyPenalty: properties.chatFrequencyPenalty ?? store.chatFrequencyPenalty,
      chatPresencePenalty: properties.chatPresencePenalty ?? store.chatPresencePenalty,
      chatTopP: properties.chatTopP ?? store.chatTopP,
      chatLogprobs: properties.chatLogprobs ?? store.chatLogprobs,
      chatTopLogprobs: properties.chatTopLogprobs ?? store.chatTopLogprobs,
      chatParallelToolCalls: properties.chatParallelToolCalls ?? store.chatParallelToolCalls,
      chatStopJson: properties.chatStopJson ?? store.chatStopJson,
      chatStreamOptionsJson: properties.chatStreamOptionsJson ?? store.chatStreamOptionsJson,
      chatResponseFormatJson: properties.chatResponseFormatJson ?? store.chatResponseFormatJson,
      chatLogitBiasJson: properties.chatLogitBiasJson ?? store.chatLogitBiasJson,
      chatToolsJson: properties.chatToolsJson ?? store.chatToolsJson,
      chatToolChoiceJson: properties.chatToolChoiceJson ?? store.chatToolChoiceJson,
      ...(args.onText ? { onText: args.onText } : {}),
    },
  })
}
