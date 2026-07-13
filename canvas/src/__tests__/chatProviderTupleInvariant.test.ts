import type { GraphState } from '@/hooks/store/types'
import { createUiChatActions } from '@/hooks/store/uiSliceChat'
import {
  CHAT_BYTEPLUS_AP_SOUTHEAST_ENDPOINT_URL,
  CHAT_BYTEPLUS_TEXT_MODEL_DEFAULT,
  CHAT_OPENAI_ENDPOINT_URL,
  CHAT_PROVIDER_BYTEPLUS,
} from '@/lib/chatEndpoint'

export function testSetChatProviderRepairsSameProviderTupleDrift() {
  let state = {
    chatProvider: CHAT_PROVIDER_BYTEPLUS,
    chatModel: CHAT_BYTEPLUS_TEXT_MODEL_DEFAULT,
    chatEndpointUrl: CHAT_OPENAI_ENDPOINT_URL,
  } as unknown as GraphState
  const setState = ((update: Parameters<Parameters<typeof createUiChatActions>[0]>[0]) => {
    const patch = typeof update === 'function' ? update(state) : update
    state = { ...state, ...patch }
  }) as Parameters<typeof createUiChatActions>[0]
  const actions = createUiChatActions(setState)

  actions.setChatProvider(CHAT_PROVIDER_BYTEPLUS)

  if (state.chatProvider !== CHAT_PROVIDER_BYTEPLUS) {
    throw new Error(`expected BytePlus provider to remain selected, got ${state.chatProvider}`)
  }
  if (state.chatModel !== CHAT_BYTEPLUS_TEXT_MODEL_DEFAULT) {
    throw new Error(`expected BytePlus model to remain selected, got ${state.chatModel}`)
  }
  if (state.chatEndpointUrl !== CHAT_BYTEPLUS_AP_SOUTHEAST_ENDPOINT_URL) {
    throw new Error(`expected same-provider selection to repair endpoint drift, got ${state.chatEndpointUrl}`)
  }
}
