import {
  CHAT_BYTEPLUS_AP_SOUTHEAST_ENDPOINT_URL,
  CHAT_BYTEPLUS_EU_WEST_ENDPOINT_URL,
  CHAT_DEFAULT_ENDPOINT_URL,
  CHAT_OPENAI_ENDPOINT_URL,
  type ChatProviderId,
  normalizeChatEndpointUrlInput,
  normalizeChatProviderId,
  resolveChatModelIdForProvider,
} from '@/lib/chatEndpoint'
import { inferChatProviderFromModelId } from '@/lib/chatEndpointProviderInference'

const resolveProviderTransitionEndpointUrl = (args: {
  currentEndpointUrl?: unknown
  currentProvider?: unknown
  provider: unknown
}): string => {
  const chatProvider = normalizeChatProviderId(args.provider)
  const currentProvider = normalizeChatProviderId(args.currentProvider)
  const currentEndpointUrl = String(args.currentEndpointUrl || '').trim()
  const currentProviderDefault = normalizeChatEndpointUrlInput(null, currentProvider)
  const shouldResetEndpoint =
    !currentEndpointUrl
    || currentEndpointUrl === currentProviderDefault
    || currentEndpointUrl === CHAT_DEFAULT_ENDPOINT_URL
    || currentEndpointUrl === CHAT_BYTEPLUS_AP_SOUTHEAST_ENDPOINT_URL
    || currentEndpointUrl === CHAT_BYTEPLUS_EU_WEST_ENDPOINT_URL
    || currentEndpointUrl === CHAT_OPENAI_ENDPOINT_URL
  return shouldResetEndpoint
    ? normalizeChatEndpointUrlInput(null, chatProvider)
    : normalizeChatEndpointUrlInput(currentEndpointUrl, chatProvider)
}

export function resolveChatProviderSelectionValues(args: {
  currentEndpointUrl?: unknown
  currentModel?: unknown
  currentProvider?: unknown
  provider: string
}): {
  chatEndpointUrl: string
  chatModel: string
  chatProvider: ChatProviderId
} {
  const chatProvider = normalizeChatProviderId(args.provider)
  const chatModel = resolveChatModelIdForProvider(args.currentModel, chatProvider)
  const chatEndpointUrl = resolveProviderTransitionEndpointUrl({
    currentEndpointUrl: args.currentEndpointUrl,
    currentProvider: args.currentProvider,
    provider: chatProvider,
  })

  return {
    chatEndpointUrl,
    chatModel,
    chatProvider,
  }
}

export function resolveChatModelSelectionValues(args: {
  currentEndpointUrl?: unknown
  currentProvider?: unknown
  model: string
}): {
  chatEndpointUrl: string
  chatModel: string
  chatProvider: ChatProviderId
} {
  const chatProvider = inferChatProviderFromModelId(args.model, args.currentProvider)
  const chatModel = resolveChatModelIdForProvider(args.model, chatProvider, { preserveUnknownCustomModel: true })
  const chatEndpointUrl = resolveProviderTransitionEndpointUrl({
    currentEndpointUrl: args.currentEndpointUrl,
    currentProvider: args.currentProvider,
    provider: chatProvider,
  })

  return {
    chatEndpointUrl,
    chatModel,
    chatProvider,
  }
}
