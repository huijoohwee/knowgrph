import { generateRunMarkdownWithProvider } from '@/features/chat/byteplusRunGeneration'
import { resolveSubmitRuntimeFriendlyMessage } from '@/features/chat/floatingPanelChat/floatingPanelChatSubmitErrors'
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
  const provider = properties.chatProvider || store.chatProvider
  const endpointUrl = properties.chatEndpointUrl || store.chatEndpointUrl
  const authMode = (properties.chatAuthMode || store.chatAuthMode) === 'byok' ? 'byok' : 'serverManaged'
  return generateRunMarkdownWithProvider({
    config: {
      provider,
      endpointUrl,
      apiKey: authMode === 'byok' ? store.chatApiKey : '',
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
  }).catch(error => {
    const raw = error instanceof Error ? error.message : String(error || '')
    throw new Error(resolveSubmitRuntimeFriendlyMessage({
      raw,
      endpointUrl: typeof endpointUrl === 'string' ? endpointUrl : null,
      chatProvider: typeof provider === 'string' ? provider : null,
      chatAuthMode: authMode,
    }))
  })
}
