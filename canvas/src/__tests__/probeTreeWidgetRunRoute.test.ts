import { resolveStoryboardWidgetProbeTreeChatRoute } from '@/components/StoryboardWidgetCanvas/runtime/storyboardWidgetWorkflowProbeTreeRun'
import { CHAT_OPENAI_ENDPOINT_URL, CHAT_PROVIDER_OPENAI } from '@/lib/chatEndpoint'

export function testProbeTreeWidgetRunUsesActiveChatRouteOverStaleCardProvider() {
  const route = resolveStoryboardWidgetProbeTreeChatRoute({
    localProperties: { chatAuthMode: { key: 'chatAuthMode', type: 'string', value: 'byok' } },
    resolvedProperties: {
      chatProvider: { key: 'chatProvider', type: 'string', value: 'byteplus-modelark' },
      chatEndpointUrl: { key: 'chatEndpointUrl', type: 'string', value: 'https://ark.ap-southeast.bytepluses.com/api/v3/chat/completions' },
      chatModel: { key: 'chatModel', type: 'string', value: 'seed-2-0-lite-260228' },
      chatAuthMode: { key: 'chatAuthMode', type: 'string', value: 'byok' },
    },
    runtimeProperties: {
      chatProvider: CHAT_PROVIDER_OPENAI,
      chatEndpointUrl: CHAT_OPENAI_ENDPOINT_URL,
      chatModel: 'gpt-5-nano',
      chatAuthMode: 'serverManaged',
    },
  })
  if (route.provider !== CHAT_PROVIDER_OPENAI || route.endpointUrl !== CHAT_OPENAI_ENDPOINT_URL || route.chatModel !== 'gpt-5-nano' || route.chatAuthMode !== 'byok') {
    throw new Error(`expected active Chat routing to own Probe-Tree LLM generation, got ${JSON.stringify(route)}`)
  }

  const missingActiveRoute = resolveStoryboardWidgetProbeTreeChatRoute({
    localProperties: {},
    resolvedProperties: {
      chatProvider: 'byteplus-modelark',
      chatEndpointUrl: 'https://ark.ap-southeast.bytepluses.com/api/v3/chat/completions',
      chatModel: 'stale-card-model',
    },
    runtimeProperties: {},
  })
  if (missingActiveRoute.provider || missingActiveRoute.endpointUrl || missingActiveRoute.chatModel) {
    throw new Error(`expected Probe-Tree routing to fail closed without an active Chat tuple, got ${JSON.stringify(missingActiveRoute)}`)
  }
}
