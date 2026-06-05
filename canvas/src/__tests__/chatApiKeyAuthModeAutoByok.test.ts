import { useGraphStore } from '@/hooks/useGraphStore'
import { MemoryStorage } from '@/tests/lib/memoryStorage'
import { initWindowHarness } from '@/tests/lib/windowHarness'

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

export async function testChatApiKeyStaysMemoryOnlyAndClearsOnServerManaged() {
  const storage = new MemoryStorage()
  const { restore } = initWindowHarness({ storage })

  try {
    const api = useGraphStore.getState()
    api.resetAll()

    api.setChatApiKey('sk-memory-only')
    const byokState = useGraphStore.getState()
    if (byokState.chatAuthMode !== 'byok') {
      throw new Error(`expected BYOK after setting an API key, got ${String(byokState.chatAuthMode)}`)
    }
    if (byokState.chatApiKey !== 'sk-memory-only') {
      throw new Error('expected chatApiKey to stay in the store while BYOK is explicit')
    }

    const storedValues = Array.from({ length: storage.length }, (_, index) => {
      const key = storage.key(index) || ''
      return `${key}=${storage.getItem(key) || ''}`
    }).join('\n')
    if (storedValues.includes('sk-memory-only')) {
      throw new Error(`expected BYOK chat API key to avoid localStorage persistence, got ${storedValues}`)
    }

    byokState.setChatAuthMode('serverManaged')
    const serverManagedState = useGraphStore.getState()
    if (serverManagedState.chatAuthMode !== 'serverManaged') {
      throw new Error(`expected auth mode serverManaged, got ${String(serverManagedState.chatAuthMode)}`)
    }
    if (serverManagedState.chatApiKey !== '') {
      throw new Error('expected switching back to serverManaged to clear the memory-only BYOK key')
    }
  } finally {
    restore()
  }
}
