import { resolveSubmitRuntimeFriendlyMessage } from '@/features/chat/floatingPanelChat/floatingPanelChatSubmitErrors'
import {
  CHAT_SUBMIT_TRANSPORT_TIMEOUT_ERROR,
  executeChatSubmitTransportAttempt,
} from '@/features/chat/floatingPanelChat/floatingPanelChatSubmitTransport'

export function testResolveSubmitRuntimeFriendlyMessageUsesTransportTimeoutCopy() {
  const friendly = resolveSubmitRuntimeFriendlyMessage({
    raw: CHAT_SUBMIT_TRANSPORT_TIMEOUT_ERROR,
    endpointUrl: 'https://api.openai.com/v1/responses',
    chatProvider: 'openai',
  })
  if (!friendly.includes('OpenAI') || !friendly.includes('request timeout')) {
    throw new Error(`Expected transport-timeout submit message to use provider-friendly copy, got: ${friendly}`)
  }
}

export async function testExecuteChatSubmitTransportAttemptTimesOutAndAbortsHangingRequest() {
  const controller = new AbortController()
  let calls = 0
  let thrown = ''
  try {
    await executeChatSubmitTransportAttempt({
      effectiveModel: 'model-a',
      tokenLimitKey: 'max_completion_tokens',
      controller,
      sendChat: async () => {
        calls += 1
        return await new Promise<Response>((_, reject) => {
          controller.signal.addEventListener('abort', () => {
            const abortError = new Error('The operation was aborted.')
            abortError.name = 'AbortError'
            reject(abortError)
          }, { once: true })
        })
      },
      parseErrorBody: async () => null,
      providerModelOptions: ['model-a'],
      loadFallbackModelIds: async () => [],
      transportTimeoutMs: 5,
    })
  } catch (error) {
    thrown = error instanceof Error ? error.message : String(error || '')
  }
  if (!thrown.includes(CHAT_SUBMIT_TRANSPORT_TIMEOUT_ERROR)) {
    throw new Error(`Expected hanging transport attempt to throw timeout marker, got: ${thrown}`)
  }
  if (!controller.signal.aborted) {
    throw new Error('Expected hanging transport timeout to abort the active request controller')
  }
  if (calls !== 1) {
    throw new Error(`Expected timeout not to retry the aborted hanging request, got calls=${calls}`)
  }
}
