import { executeChatSubmitTransportAttempt } from '@/features/chat/floatingPanelChat/floatingPanelChatSubmitTransport'
import { CHAT_BYTEPLUS_TEXT_MODEL_DEFAULT } from '@/lib/chatEndpoint'

export async function testChatSubmitTransportRecoversFromBytePlusModelActivationFailure() {
  const calls: string[] = []
  const resolvedModels: string[] = []
  const result = await executeChatSubmitTransportAttempt({
    effectiveModel: 'provider-unactivated-model',
    tokenLimitKey: 'max_completion_tokens',
    controller: new AbortController(),
    sendChat: async model => {
      calls.push(model)
      return model === CHAT_BYTEPLUS_TEXT_MODEL_DEFAULT
        ? new Response('{}', { status: 200 })
        : new Response('model activation required', { status: 404 })
    },
    parseErrorBody: async response => response.ok
      ? null
      : 'Your account has not activated the model service. Please activate the model service in the Ark Console.',
    providerModelOptions: [CHAT_BYTEPLUS_TEXT_MODEL_DEFAULT],
    loadFallbackModelIds: async () => [CHAT_BYTEPLUS_TEXT_MODEL_DEFAULT],
    onResolvedFallbackModel: model => { resolvedModels.push(model) },
  })

  if (!result.response.ok || result.effectiveModel !== CHAT_BYTEPLUS_TEXT_MODEL_DEFAULT) {
    throw new Error(`expected activation fallback to recover with the available BytePlus model, got ${JSON.stringify({ ok: result.response.ok, effectiveModel: result.effectiveModel })}`)
  }
  if (calls.join(',') !== `provider-unactivated-model,${CHAT_BYTEPLUS_TEXT_MODEL_DEFAULT}`) {
    throw new Error(`expected one bounded fallback request, got ${JSON.stringify(calls)}`)
  }
  if (resolvedModels.join(',') !== CHAT_BYTEPLUS_TEXT_MODEL_DEFAULT) {
    throw new Error(`expected the resolved model callback once, got ${JSON.stringify(resolvedModels)}`)
  }
}
