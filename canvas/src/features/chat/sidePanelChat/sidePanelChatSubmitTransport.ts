import { shouldRetryWithModelFallback } from '../SidePanelChat.helpers'

export type ChatSubmitTokenLimitKey = 'max_tokens' | 'max_completion_tokens'

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
    response = await args.sendChat(effectiveModel, tokenLimitKey)
  } catch (error) {
    if (!isRetryableTransportError(error, args.controller)) throw error
    response = await args.sendChat(effectiveModel, tokenLimitKey)
  }

  if (!response.ok) {
    detail = await args.parseErrorBody(response)
    if (shouldRetryWithTokenFallback(response.status, detail)) {
      tokenLimitKey = flipTokenLimitKey(tokenLimitKey)
      response = await args.sendChat(effectiveModel, tokenLimitKey)
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
        response = await args.sendChat(effectiveModel, tokenLimitKey)
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
