import { shouldRetryWithModelFallback } from '../FloatingPanelChat.helpers'
import { CHAT_PROVIDER_OPENAI, normalizeChatProviderId } from '@/lib/chatEndpoint'

export type ChatSubmitTokenLimitKey = 'max_tokens' | 'max_completion_tokens'

export const CHAT_SUBMIT_TRANSPORT_TIMEOUT_MS = 45_000
export const CHAT_SUBMIT_OPENAI_RESPONSES_TIMEOUT_MS = 180_000
export const CHAT_SUBMIT_TRANSPORT_TIMEOUT_ERROR = 'CHAT_SUBMIT_TRANSPORT_TIMEOUT'

export const resolveChatSubmitTransportTimeoutMs = (args: {
  chatProvider?: string | null
  chatModel?: string | null
  endpointUrl?: string | null
}): number => {
  const provider = normalizeChatProviderId(args.chatProvider || '')
  const modelId = String(args.chatModel || '').trim().toLowerCase()
  const endpointUrl = String(args.endpointUrl || '').trim().toLowerCase()
  const isOpenAi = provider === CHAT_PROVIDER_OPENAI || endpointUrl.includes('api.openai.com')
  const isGpt5Model = /^gpt-5(?:[.-]|$)/i.test(modelId)
  const isResponsesEndpoint = endpointUrl.includes('/v1/responses')
  return isOpenAi && (isGpt5Model || isResponsesEndpoint)
    ? CHAT_SUBMIT_OPENAI_RESPONSES_TIMEOUT_MS
    : CHAT_SUBMIT_TRANSPORT_TIMEOUT_MS
}

const isRetryableTransportError = (error: unknown, controller: AbortController): boolean => {
  const message = error instanceof Error ? error.message : String(error || '')
  const lowered = message.toLowerCase()
  return (
    !controller.signal.aborted &&
    (/aborted/i.test(message) || lowered.includes('failed to fetch') || lowered.includes('networkerror') || lowered.includes('err_aborted'))
  )
}

const shouldRetryWithTokenFallback = (status: number, detail: string | null): boolean => {
  if (status !== 400) return false
  const text = String(detail || '')
  return (
    text.includes("Unsupported parameter: 'max_tokens'") ||
    text.includes("Unsupported parameter: 'max_completion_tokens'") ||
    text.includes("Use 'max_completion_tokens' instead") ||
    text.includes('Use "max_completion_tokens" instead')
  )
}

const flipTokenLimitKey = (key: ChatSubmitTokenLimitKey): ChatSubmitTokenLimitKey =>
  key === 'max_tokens' ? 'max_completion_tokens' : 'max_tokens'

const isAbortLikeTransportError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error || '')
  const name = error && typeof error === 'object' && 'name' in error ? String((error as { name?: unknown }).name || '') : ''
  return /abort/i.test(name) || /aborted/i.test(message)
}

const sendChatWithTransportTimeout = async (args: {
  controller: AbortController
  timeoutMs?: number
  sendChat: () => Promise<Response>
}): Promise<Response> => {
  const timeoutMs = Number.isFinite(args.timeoutMs)
    ? Math.max(0, Number(args.timeoutMs))
    : CHAT_SUBMIT_TRANSPORT_TIMEOUT_MS
  if (timeoutMs <= 0) return await args.sendChat()
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  let timedOut = false
  const sendPromise = args.sendChat().catch(error => {
    if (timedOut && isAbortLikeTransportError(error)) {
      throw new Error(CHAT_SUBMIT_TRANSPORT_TIMEOUT_ERROR)
    }
    throw error
  })
  const timeoutPromise = new Promise<Response>((_, reject) => {
    timeoutId = setTimeout(() => {
      timedOut = true
      try {
        args.controller.abort()
      } catch {
        void 0
      }
      reject(new Error(CHAT_SUBMIT_TRANSPORT_TIMEOUT_ERROR))
    }, timeoutMs)
  })
  return await Promise.race([sendPromise, timeoutPromise]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId)
  })
}

export const resolvePreferredFallbackModel = (args: {
  providerModelOptions: string[]
  availableModelIds: string[]
  effectiveModel: string
}): string => {
  const preferredFallback = args.providerModelOptions.find(id => args.availableModelIds.includes(id) && id !== args.effectiveModel) || ''
  return preferredFallback || args.availableModelIds.find(id => id !== args.effectiveModel) || args.availableModelIds[0] || ''
}

export const executeChatSubmitTransportAttempt = async (args: {
  effectiveModel: string
  tokenLimitKey: ChatSubmitTokenLimitKey
  controller: AbortController
  sendChat: (model: string, tokenLimitKey: ChatSubmitTokenLimitKey) => Promise<Response>
  parseErrorBody: (response: Response) => Promise<string | null>
  providerModelOptions: string[]
  loadFallbackModelIds: () => Promise<string[]>
  onResolvedFallbackModel?: (modelId: string) => void
  transportTimeoutMs?: number
}): Promise<{
  response: Response
  effectiveModel: string
  detail: string | null
}> => {
  let effectiveModel = args.effectiveModel
  let tokenLimitKey = args.tokenLimitKey
  let detail: string | null = null
  let response: Response
  try {
    response = await sendChatWithTransportTimeout({
      controller: args.controller,
      timeoutMs: args.transportTimeoutMs,
      sendChat: async () => await args.sendChat(effectiveModel, tokenLimitKey),
    })
  } catch (error) {
    if (!isRetryableTransportError(error, args.controller)) throw error
    response = await sendChatWithTransportTimeout({
      controller: args.controller,
      timeoutMs: args.transportTimeoutMs,
      sendChat: async () => await args.sendChat(effectiveModel, tokenLimitKey),
    })
  }

  if (!response.ok) {
    detail = await args.parseErrorBody(response)
    if (shouldRetryWithTokenFallback(response.status, detail)) {
      tokenLimitKey = flipTokenLimitKey(tokenLimitKey)
      response = await sendChatWithTransportTimeout({
        controller: args.controller,
        timeoutMs: args.transportTimeoutMs,
        sendChat: async () => await args.sendChat(effectiveModel, tokenLimitKey),
      })
      detail = response.ok ? null : await args.parseErrorBody(response)
    }
    if (!response.ok && shouldRetryWithModelFallback(response.status, detail)) {
      const availableModelIds = await args.loadFallbackModelIds()
      const fallback = resolvePreferredFallbackModel({
        providerModelOptions: args.providerModelOptions,
        availableModelIds,
        effectiveModel,
      })
      if (fallback && fallback !== effectiveModel) {
        effectiveModel = fallback
        args.onResolvedFallbackModel?.(fallback)
        response = await sendChatWithTransportTimeout({
          controller: args.controller,
          timeoutMs: args.transportTimeoutMs,
          sendChat: async () => await args.sendChat(effectiveModel, tokenLimitKey),
        })
        detail = response.ok ? null : await args.parseErrorBody(response)
      }
    }
  }

  return {
    response,
    effectiveModel,
    detail,
  }
}
