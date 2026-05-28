import {
  CHAT_DEFAULT_ENDPOINT_URL,
  CHAT_PROVIDER_OPENAI,
  buildChatProxyHeaders,
  getDefaultChatModelForProvider,
  getChatModelOptions,
  normalizeChatModelIdForProvider,
  normalizeChatProviderId,
} from '@/lib/chatEndpoint'
import { clampChatCompletionTokens } from '../chatAiMarkdownSpec'
import { buildPackedContextSystemPrompt, packChatContext, type ChatPackedContext } from '../chatContextPack'
import {
  CHAT_BASE_KGC_RESPONSE_CONTRACT_PROMPT,
  CHAT_BASE_RESPONSE_CONTRACT_PROMPT,
} from '../chatResponseBaseContract'
import {
  buildBoundedGraphSystemPrompt,
  buildMarkdownNodeSnippetPrompt,
  buildWorkspaceWideContextPrompt,
} from '../chatPromptHelpers'
import { buildProviderChatRequestOptions, parseLine, toShortId } from '../FloatingPanelChat.helpers'
import type { ChatMessage } from '../FloatingPanelChatSections'
import type { FloatingPanelChatSubmitArgs } from './floatingPanelChatSubmitTypes'

export type ChatSubmitMessage = { role: 'system' | 'user' | 'assistant'; content: string }
export type ChatSubmitTokenLimitKey = 'max_tokens' | 'max_completion_tokens'

const toFiniteNumberOrUndefined = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return undefined
}

export const resolveChatSubmitTokenLimitKey = (chatProvider: string): ChatSubmitTokenLimitKey => {
  const provider = normalizeChatProviderId(chatProvider)
  return provider === CHAT_PROVIDER_OPENAI ? 'max_completion_tokens' : 'max_tokens'
}

export const resolveInitialChatSubmitModel = (args: {
  chatProvider: string
  chatModel: string | null
}): { providerModelOptions: string[]; effectiveModel: string } => {
  const providerModelOptions = getChatModelOptions(args.chatProvider)
  const normalizedProviderModel = normalizeChatModelIdForProvider(args.chatModel, args.chatProvider)
  const effectiveModel = providerModelOptions.includes(normalizedProviderModel)
    ? normalizedProviderModel
    : getDefaultChatModelForProvider(args.chatProvider)
  return { providerModelOptions: [...providerModelOptions], effectiveModel }
}

export const buildSubmitConversationMessages = (
  nextMessages: ChatMessage[],
  assistantMessageId: string,
): Array<{ role: 'user' | 'assistant'; content: string }> =>
  nextMessages
    .filter(message => message.id !== assistantMessageId)
    .map(message => ({ role: message.role, content: message.content }))

export const buildChatSubmitPayloadMessages = (args: {
  systemMessages: Array<{ role: 'system'; content: string }>
  conversationMessages: Array<{ role: 'user' | 'assistant'; content: string }>
  correctionPrompt: string | null
}): ChatSubmitMessage[] => {
  const out: ChatSubmitMessage[] = [...args.systemMessages]
  if (args.correctionPrompt && args.correctionPrompt.trim()) {
    out.push({ role: 'system', content: args.correctionPrompt })
  }
  out.push(...args.conversationMessages)
  return out
}

export const buildChatSubmitRequestContext = async (args: {
  submitArgs: FloatingPanelChatSubmitArgs
  nextMessages: ChatMessage[]
  assistantMessageId: string
}): Promise<{
  packedContext: ChatPackedContext
  systemMessages: Array<{ role: 'system'; content: string }>
  conversationMessages: Array<{ role: 'user' | 'assistant'; content: string }>
}> => {
  const packedContext = packChatContext({
    graphData: args.submitArgs.graphData,
    currentNode: args.submitArgs.currentNode,
    markdownText: args.submitArgs.markdownText,
    graphSummaryMaxTokens: toFiniteNumberOrUndefined(args.submitArgs.chatGraphSummaryMaxTokens),
    guidelineDigestMaxTokens: toFiniteNumberOrUndefined(args.submitArgs.chatGuidelineDigestMaxTokens),
  })
  const includeSelectionContext =
    args.submitArgs.chatContextScope === 'selection' || args.submitArgs.chatContextScope === 'hybrid'
  const includeWorkspaceContext =
    args.submitArgs.chatContextScope === 'workspace' || args.submitArgs.chatContextScope === 'hybrid'

  const systemMessages: Array<{ role: 'system'; content: string }> = [
    {
      role: 'system',
      content:
        args.submitArgs.chatStorageTarget === 'chatKnowgrph'
          ? CHAT_BASE_KGC_RESPONSE_CONTRACT_PROMPT
          : CHAT_BASE_RESPONSE_CONTRACT_PROMPT,
    },
    {
      role: 'system',
      content: buildPackedContextSystemPrompt(packedContext),
    },
  ]

  if (includeSelectionContext) {
    systemMessages.push({
      role: 'system',
      content: buildBoundedGraphSystemPrompt(args.submitArgs.graphData, args.submitArgs.currentNode),
    })
  }
  if (args.submitArgs.chatSystemPrompt && typeof args.submitArgs.chatSystemPrompt === 'string' && args.submitArgs.chatSystemPrompt.trim()) {
    systemMessages.push({ role: 'system', content: args.submitArgs.chatSystemPrompt })
  }
  if (includeSelectionContext) {
    const markdownSnippet = buildMarkdownNodeSnippetPrompt(
      args.submitArgs.markdownText,
      args.submitArgs.currentNode,
      parseLine,
    )
    if (markdownSnippet) systemMessages.push({ role: 'system', content: markdownSnippet })
  }
  if (includeWorkspaceContext) {
    const workspaceContextPrompt = await buildWorkspaceWideContextPrompt({
      markdownDocumentName: args.submitArgs.markdownDocumentName,
      markdownText: args.submitArgs.markdownText,
      sourceFiles: args.submitArgs.sourceFiles,
      cacheKey: args.submitArgs.workspaceContextCacheKey,
    })
    if (workspaceContextPrompt) systemMessages.push({ role: 'system', content: workspaceContextPrompt })
  }

  return {
    packedContext,
    systemMessages,
    conversationMessages: buildSubmitConversationMessages(args.nextMessages, args.assistantMessageId),
  }
}

export const createChatSubmitRequestSender = (args: {
  submitArgs: FloatingPanelChatSubmitArgs
  requestUrl: string
  controller: AbortController
  fetchFn?: typeof fetch
}) => {
  const fetchFn = args.fetchFn || fetch
  return async (
    model: string,
    messages: ChatSubmitMessage[],
    tokenLimitKey: ChatSubmitTokenLimitKey = resolveChatSubmitTokenLimitKey(args.submitArgs.chatProvider),
  ): Promise<Response> => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...buildChatProxyHeaders({
        provider: args.submitArgs.chatProvider,
        apiKey: args.submitArgs.chatAuthMode === 'byok' ? args.submitArgs.chatApiKey : null,
        endpointUrl: args.submitArgs.chatEndpointUrl || CHAT_DEFAULT_ENDPOINT_URL,
        clientRequestId: `kg-chat-${toShortId()}`,
      }),
    }
    const tokenLimit = clampChatCompletionTokens(args.submitArgs.chatMaxCompletionTokens)
    const effectiveTokenLimit =
      args.submitArgs.chatStorageTarget === 'chatKnowgrph'
        ? Math.max(4000, tokenLimit)
        : tokenLimit
    const providerOptions = buildProviderChatRequestOptions({
      provider: args.submitArgs.chatProvider,
      endpointUrl: args.submitArgs.chatEndpointUrl || CHAT_DEFAULT_ENDPOINT_URL,
      chatModel: args.submitArgs.chatModel,
      chatTemperature: args.submitArgs.chatTemperature,
      chatServiceTier: args.submitArgs.chatServiceTier,
      chatStream: args.submitArgs.chatStream,
      chatMessagesJson: args.submitArgs.chatMessagesJson,
      chatReasoningEffort: args.submitArgs.chatReasoningEffort,
      chatThinkingType: args.submitArgs.chatThinkingType,
      chatThinkingJson: args.submitArgs.chatThinkingJson,
      chatFrequencyPenalty: args.submitArgs.chatFrequencyPenalty,
      chatPresencePenalty: args.submitArgs.chatPresencePenalty,
      chatTopP: args.submitArgs.chatTopP,
      chatLogprobs: args.submitArgs.chatLogprobs,
      chatTopLogprobs: args.submitArgs.chatTopLogprobs,
      chatParallelToolCalls: args.submitArgs.chatParallelToolCalls,
      chatStopJson: args.submitArgs.chatStopJson,
      chatStreamOptionsJson: args.submitArgs.chatStreamOptionsJson,
      chatResponseFormatJson: args.submitArgs.chatResponseFormatJson,
      chatLogitBiasJson: args.submitArgs.chatLogitBiasJson,
      chatToolsJson: args.submitArgs.chatToolsJson,
      chatToolChoiceJson: args.submitArgs.chatToolChoiceJson,
    })
    return await fetchFn(args.requestUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        ...providerOptions,
        ...(tokenLimitKey === 'max_completion_tokens'
          ? { max_completion_tokens: effectiveTokenLimit }
          : { max_tokens: effectiveTokenLimit }),
      }),
      signal: args.controller.signal,
    })
  }
}
