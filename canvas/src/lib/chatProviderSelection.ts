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
  const currentProvider = normalizeChatProviderId(args.currentProvider)
  const chatModel = resolveChatModelIdForProvider(args.currentModel, chatProvider)
  const currentEndpointUrl = String(args.currentEndpointUrl || '').trim()
  const currentProviderDefault = normalizeChatEndpointUrlInput(null, currentProvider)
  const shouldResetEndpoint =
    !currentEndpointUrl
    || currentEndpointUrl === currentProviderDefault
    || currentEndpointUrl === CHAT_DEFAULT_ENDPOINT_URL
    || currentEndpointUrl === CHAT_BYTEPLUS_AP_SOUTHEAST_ENDPOINT_URL
    || currentEndpointUrl === CHAT_BYTEPLUS_EU_WEST_ENDPOINT_URL
    || currentEndpointUrl === CHAT_OPENAI_ENDPOINT_URL
  const chatEndpointUrl = shouldResetEndpoint
    ? normalizeChatEndpointUrlInput(null, chatProvider)
    : normalizeChatEndpointUrlInput(currentEndpointUrl, chatProvider)

  return {
    chatEndpointUrl,
    chatModel,
    chatProvider,
  }
}
