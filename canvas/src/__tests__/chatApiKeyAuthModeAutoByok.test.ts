import { useGraphStore } from '@/hooks/useGraphStore'

export async function testChatApiKeyAutoEnablesByokAuthMode() {
  const api = useGraphStore.getState()
  api.resetAll()

  if (api.chatAuthMode !== 'serverManaged') {
    throw new Error(`expected initial auth mode serverManaged, got ${String(api.chatAuthMode)}`)
  }

  api.setChatApiKey('sk-test-key')
  const next = useGraphStore.getState()
  if (next.chatAuthMode !== 'byok') {
    throw new Error(`expected auth mode byok after setting key, got ${String(next.chatAuthMode)}`)
  }
  if (!next.chatApiKey) {
    throw new Error('expected chatApiKey to be set')
  }
}

