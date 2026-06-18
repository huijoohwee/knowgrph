import {
  getDefaultChatModelForProvider,
  getSharedChatModelCatalogOptions,
  normalizeChatModelIdForProvider,
  normalizeChatProviderId,
} from '@/lib/chatEndpoint'

export type SharedChatModelSelect = {
  modelId: string
  options: string[]
}

export function resolveSharedChatModelSelect(args: {
  chatModel: unknown
  chatProvider: unknown
}): SharedChatModelSelect {
  const normalizedProvider = normalizeChatProviderId(args.chatProvider)
  const options = getSharedChatModelCatalogOptions(normalizedProvider)
  const normalizedModel = normalizeChatModelIdForProvider(args.chatModel, normalizedProvider)
  const fallbackModel = normalizedModel || getDefaultChatModelForProvider(normalizedProvider)
  const selected = fallbackModel || (options[0] || '')
  const combined = options.includes(selected)
    ? options
    : [selected, ...options].filter(Boolean)
  return { modelId: selected, options: combined }
}
