import type { JSONValue } from '@/lib/graph/types'
import {
  CHAT_PROVIDER_AGNES,
  CHAT_PROVIDER_BYTEPLUS,
  CHAT_PROVIDER_GOOGLE_CLOUD,
  CHAT_PROVIDER_MIROMIND,
  CHAT_PROVIDER_OPENAI,
  CHAT_PROVIDER_QWEN,
  isResponsesEndpointUrl,
  normalizeChatProviderId,
} from '@/lib/chatEndpoint'

export const clampTemperature = (raw: unknown): number => {
  const t = Number(raw)
  if (!Number.isFinite(t)) return 0.3
  if (t < 0) return 0
  if (t > 2) return 2
  return t
}

const clampBytePlusPenalty = (raw: unknown): number => {
  const next = Number(raw)
  if (!Number.isFinite(next)) return 0
  if (next < -2) return -2
  if (next > 2) return 2
  return next
}

const clampBytePlusTopP = (raw: unknown): number => {
  const next = Number(raw)
  if (!Number.isFinite(next)) return 0.7
  if (next < 0) return 0
  if (next > 1) return 1
  return next
}

const clampBytePlusTopLogprobs = (raw: unknown): number => {
  const next = Math.floor(Number(raw))
  if (!Number.isFinite(next)) return 0
  if (next < 0) return 0
  if (next > 20) return 20
  return next
}

const normalizeBytePlusServiceTier = (raw: unknown): 'auto' | 'default' => {
  return String(raw || '').trim().toLowerCase() === 'default' ? 'default' : 'auto'
}

const normalizeBytePlusReasoningEffort = (raw: unknown): 'minimal' | 'low' | 'medium' | 'high' => {
  const next = String(raw || '').trim().toLowerCase()
  if (next === 'low' || next === 'medium' || next === 'high') return next
  return 'minimal'
}

const supportsOpenAiResponsesReasoning = (modelId: string): boolean =>
  /^(?:gpt-5(?:[.-]|$)|o[134](?:[.-]|$))/i.test(modelId)

const normalizeOpenAiResponsesStreamOptions = (raw: JSONValue | undefined): JSONValue | undefined => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const includeObfuscation = (raw as Record<string, unknown>).include_obfuscation
  return typeof includeObfuscation === 'boolean'
    ? { include_obfuscation: includeObfuscation }
    : undefined
}

const normalizeBytePlusThinkingType = (raw: unknown): 'enabled' | 'disabled' => {
  const next = String(raw || '').trim().toLowerCase()
  return next === 'enabled' ? 'enabled' : 'disabled'
}

const coerceBooleanFlag = (raw: unknown, fallback: boolean): boolean => {
  if (typeof raw === 'boolean') return raw
  const next = String(raw || '').trim().toLowerCase()
  if (!next) return fallback
  if (next === 'false' || next === '0' || next === 'no' || next === 'off') return false
  if (next === 'true' || next === '1' || next === 'yes' || next === 'on') return true
  return fallback
}

export const buildProviderChatRequestOptions = (args: {
  provider: unknown
  endpointUrl?: unknown
  chatModel?: unknown
  chatTemperature: unknown
  chatServiceTier: unknown
  chatStream: unknown
  chatMessagesJson: unknown
  chatReasoningEffort: unknown
  chatThinkingType: unknown
  chatThinkingJson: unknown
  chatFrequencyPenalty: unknown
  chatPresencePenalty: unknown
  chatTopP: unknown
  chatLogprobs: unknown
  chatTopLogprobs: unknown
  chatParallelToolCalls: unknown
  chatStopJson: unknown
  chatStreamOptionsJson: unknown
  chatResponseFormatJson: unknown
  chatLogitBiasJson: unknown
  chatToolsJson: unknown
  chatToolChoiceJson: unknown
}): Record<string, unknown> => {
  const modelId = typeof args.chatModel === 'string' ? args.chatModel.trim() : ''
  const isGpt5Model = modelId ? /^gpt-5(?:[.-]|$)/i.test(modelId) : false
  const provider = normalizeChatProviderId(args.provider)
  const shouldSendTemperature = provider !== CHAT_PROVIDER_OPENAI ? true : !isGpt5Model
  const shouldSendTopP = provider !== CHAT_PROVIDER_OPENAI ? true : !isGpt5Model

  const base: Record<string, unknown> = {
    ...(shouldSendTemperature ? { temperature: clampTemperature(args.chatTemperature) } : {}),
  }
  const isResponsesEndpoint = isResponsesEndpointUrl(args.endpointUrl)

  const parseOptionalJsonConfig = (raw: unknown, fieldName: string, providerLabel: string): JSONValue | undefined => {
    if (typeof raw !== 'string') {
      return typeof raw === 'undefined' ? undefined : (raw as JSONValue)
    }
    const text = raw.trim()
    if (!text) return undefined
    try {
      return JSON.parse(text) as JSONValue
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error || '')
      throw new Error(`Invalid ${providerLabel} ${fieldName} JSON: ${message || 'parse failed'}`)
    }
  }

  if (provider === CHAT_PROVIDER_BYTEPLUS) {
    const logprobs = coerceBooleanFlag(args.chatLogprobs, false)
    const topLogprobs = clampBytePlusTopLogprobs(args.chatTopLogprobs)
    const thinking = parseOptionalJsonConfig(args.chatThinkingJson, 'thinking', 'BytePlus')
    const messages = parseOptionalJsonConfig(args.chatMessagesJson, 'messages', 'BytePlus')
    const stop = parseOptionalJsonConfig(args.chatStopJson, 'stop', 'BytePlus')
    const streamOptions = parseOptionalJsonConfig(args.chatStreamOptionsJson, 'stream_options', 'BytePlus')
    const responseFormat = parseOptionalJsonConfig(args.chatResponseFormatJson, 'response_format', 'BytePlus')
    const logitBias = parseOptionalJsonConfig(args.chatLogitBiasJson, 'logit_bias', 'BytePlus')
    const tools = parseOptionalJsonConfig(args.chatToolsJson, 'tools', 'BytePlus')
    const toolChoice = parseOptionalJsonConfig(args.chatToolChoiceJson, 'tool_choice', 'BytePlus')
    return {
      ...base,
      ...(typeof messages !== 'undefined' ? { messages } : {}),
      service_tier: normalizeBytePlusServiceTier(args.chatServiceTier),
      reasoning_effort: normalizeBytePlusReasoningEffort(args.chatReasoningEffort),
      thinking: thinking ?? { type: normalizeBytePlusThinkingType(args.chatThinkingType) },
      frequency_penalty: clampBytePlusPenalty(args.chatFrequencyPenalty),
      presence_penalty: clampBytePlusPenalty(args.chatPresencePenalty),
      top_p: clampBytePlusTopP(args.chatTopP),
      logprobs,
      ...(logprobs ? { top_logprobs: topLogprobs } : {}),
      parallel_tool_calls: coerceBooleanFlag(args.chatParallelToolCalls, true),
      ...(typeof stop !== 'undefined' ? { stop } : {}),
      ...(typeof streamOptions !== 'undefined' ? { stream_options: streamOptions } : {}),
      ...(typeof responseFormat !== 'undefined' ? { response_format: responseFormat } : {}),
      ...(typeof logitBias !== 'undefined' ? { logit_bias: logitBias } : {}),
      ...(typeof tools !== 'undefined' ? { tools } : {}),
      ...(typeof toolChoice !== 'undefined' ? { tool_choice: toolChoice } : {}),
      stream: coerceBooleanFlag(args.chatStream, true),
    }
  }

  if (provider === CHAT_PROVIDER_AGNES) {
    const tools = parseOptionalJsonConfig(args.chatToolsJson, 'tools', 'Agnes AI')
    const toolChoice = parseOptionalJsonConfig(args.chatToolChoiceJson, 'tool_choice', 'Agnes AI')
    return {
      ...base,
      top_p: clampBytePlusTopP(args.chatTopP),
      ...(typeof tools !== 'undefined' ? { tools } : {}),
      ...(typeof toolChoice !== 'undefined' ? { tool_choice: toolChoice } : {}),
    }
  }

  if (provider !== CHAT_PROVIDER_OPENAI && provider !== CHAT_PROVIDER_MIROMIND && provider !== CHAT_PROVIDER_QWEN && provider !== CHAT_PROVIDER_GOOGLE_CLOUD) return base

  const providerLabel =
    provider === CHAT_PROVIDER_MIROMIND
      ? 'MiroMind'
      : provider === CHAT_PROVIDER_QWEN
        ? 'Qwen'
        : provider === CHAT_PROVIDER_GOOGLE_CLOUD
          ? 'Google Cloud'
        : 'OpenAI'
  const logprobs = coerceBooleanFlag(args.chatLogprobs, false)
  const topLogprobs = clampBytePlusTopLogprobs(args.chatTopLogprobs)
  const stop = parseOptionalJsonConfig(args.chatStopJson, 'stop', providerLabel)
  const streamOptions = parseOptionalJsonConfig(args.chatStreamOptionsJson, 'stream_options', providerLabel)
  const responsesStreamOptions = normalizeOpenAiResponsesStreamOptions(streamOptions)
  const text = parseOptionalJsonConfig(args.chatResponseFormatJson, 'text', providerLabel)
  const responseFormat = parseOptionalJsonConfig(args.chatResponseFormatJson, 'response_format', providerLabel)
  const logitBias = parseOptionalJsonConfig(args.chatLogitBiasJson, 'logit_bias', providerLabel)
  const tools = parseOptionalJsonConfig(args.chatToolsJson, 'tools', providerLabel)
  const toolChoice = parseOptionalJsonConfig(args.chatToolChoiceJson, 'tool_choice', providerLabel)
  const effort = normalizeBytePlusReasoningEffort(args.chatReasoningEffort)

  const topP = clampBytePlusTopP(args.chatTopP)

  if (isResponsesEndpoint) {
    return {
      ...base,
      service_tier: normalizeBytePlusServiceTier(args.chatServiceTier),
      ...(shouldSendTopP ? { top_p: topP } : {}),
      parallel_tool_calls: coerceBooleanFlag(args.chatParallelToolCalls, true),
      ...(typeof responsesStreamOptions !== 'undefined' ? { stream_options: responsesStreamOptions } : {}),
      ...(typeof tools !== 'undefined' ? { tools } : {}),
      ...(typeof toolChoice !== 'undefined' ? { tool_choice: toolChoice } : {}),
      ...(logprobs ? { include: ['message.output_text.logprobs'] } : {}),
      ...(logprobs && topLogprobs > 0 ? { top_logprobs: topLogprobs } : {}),
      ...(typeof text !== 'undefined' ? { text } : {}),
      ...(effort && supportsOpenAiResponsesReasoning(modelId) ? { reasoning: { effort } } : {}),
    }
  }

  return {
    ...base,
    service_tier: normalizeBytePlusServiceTier(args.chatServiceTier),
    frequency_penalty: clampBytePlusPenalty(args.chatFrequencyPenalty),
    presence_penalty: clampBytePlusPenalty(args.chatPresencePenalty),
    ...(shouldSendTopP ? { top_p: topP } : {}),
    parallel_tool_calls: coerceBooleanFlag(args.chatParallelToolCalls, true),
    ...(typeof stop !== 'undefined' ? { stop } : {}),
    ...(typeof streamOptions !== 'undefined' ? { stream_options: streamOptions } : {}),
    ...(typeof logitBias !== 'undefined' ? { logit_bias: logitBias } : {}),
    ...(typeof tools !== 'undefined' ? { tools } : {}),
    ...(typeof toolChoice !== 'undefined' ? { tool_choice: toolChoice } : {}),
    logprobs,
    ...(logprobs ? { top_logprobs: topLogprobs } : {}),
    ...(typeof responseFormat !== 'undefined' ? { response_format: responseFormat } : {}),
  }
}
