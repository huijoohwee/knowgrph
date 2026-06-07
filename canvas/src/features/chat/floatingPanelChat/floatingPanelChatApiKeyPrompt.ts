import { chatProviderRequiresApiKey } from '@/lib/chatEndpoint'

export const shouldRenderFloatingChatApiKeyPrompt = (args: {
  chatAuthMode: 'byok' | 'serverManaged'
  chatProvider: string
}): boolean => args.chatAuthMode === 'byok' && chatProviderRequiresApiKey(args.chatProvider)
