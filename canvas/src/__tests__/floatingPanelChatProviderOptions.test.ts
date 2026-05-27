import { CHAT_PROVIDER_AGNES, CHAT_PROVIDER_BYTEPLUS, CHAT_PROVIDER_MIROMIND, CHAT_PROVIDER_OPENAI } from '@/lib/chatEndpoint'
import { buildProviderChatRequestOptions } from '@/features/chat/FloatingPanelChat.helpers'

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(item => stableStringify(item)).join(',')}]`
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
    return `{${entries.map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`).join(',')}}`
  }
  return JSON.stringify(value)
}

export function testBytePlusProviderOptionsIncludeSharedRequestParams() {
  const options = buildProviderChatRequestOptions({
    provider: CHAT_PROVIDER_BYTEPLUS,
    chatTemperature: 1.4,
    chatServiceTier: 'default',
    chatStream: false,
    chatMessagesJson: '[{"role":"user","content":"override"}]',
    chatReasoningEffort: 'high',
    chatThinkingType: 'auto',
    chatThinkingJson: '{"type":"auto"}',
    chatFrequencyPenalty: -0.4,
    chatPresencePenalty: 0.6,
    chatTopP: 0.92,
    chatLogprobs: true,
    chatTopLogprobs: 7,
    chatParallelToolCalls: false,
    chatStopJson: '["END","STOP"]',
    chatStreamOptionsJson: '{"include_usage":true}',
    chatResponseFormatJson: '{"type":"json_object"}',
    chatLogitBiasJson: '{"42":5}',
    chatToolsJson: '[{"type":"function","function":{"name":"lookup","parameters":{"type":"object","properties":{}}}}]',
    chatToolChoiceJson: '{"type":"function","function":{"name":"lookup"}}',
  })

  const expected = {
    temperature: 1.4,
    messages: [{ role: 'user', content: 'override' }],
    service_tier: 'default',
    reasoning_effort: 'high',
    thinking: { type: 'auto' },
    frequency_penalty: -0.4,
    presence_penalty: 0.6,
    top_p: 0.92,
    logprobs: true,
    top_logprobs: 7,
    parallel_tool_calls: false,
    stream: false,
    stop: ['END', 'STOP'],
    stream_options: { include_usage: true },
    response_format: { type: 'json_object' },
    logit_bias: { '42': 5 },
    tools: [{ type: 'function', function: { name: 'lookup', parameters: { type: 'object', properties: {} } } }],
    tool_choice: { type: 'function', function: { name: 'lookup' } },
  }
  const serialized = stableStringify(options)
  const serializedExpected = stableStringify(expected)
  if (serialized !== serializedExpected) {
    throw new Error(`expected BytePlus provider options ${serializedExpected}, got ${serialized}`)
  }
}

export function testNonBytePlusProviderOptionsStayMinimal() {
  const options = buildProviderChatRequestOptions({
    provider: CHAT_PROVIDER_OPENAI,
    endpointUrl: '/v1/chat/completions',
    chatModel: 'gpt-5.4-nano',
    chatTemperature: 0.5,
    chatServiceTier: 'default',
    chatStream: false,
    chatMessagesJson: '[{"role":"user","content":"ignored"}]',
    chatReasoningEffort: 'high',
    chatThinkingType: 'auto',
    chatThinkingJson: '{"type":"auto"}',
    chatFrequencyPenalty: 1,
    chatPresencePenalty: 1,
    chatTopP: 0.9,
    chatLogprobs: true,
    chatTopLogprobs: 5,
    chatParallelToolCalls: false,
    chatStopJson: '["DONE"]',
    chatStreamOptionsJson: '{"include_usage":true}',
    chatResponseFormatJson: '{"type":"json_object"}',
    chatLogitBiasJson: '{"42":5}',
    chatToolsJson: '[{"type":"function","function":{"name":"lookup"}}]',
    chatToolChoiceJson: '{"type":"function","function":{"name":"lookup"}}',
  })
  const expected = {
    service_tier: 'default',
    frequency_penalty: 1,
    presence_penalty: 1,
    logprobs: true,
    top_logprobs: 5,
    parallel_tool_calls: false,
    stop: ['DONE'],
    stream_options: { include_usage: true },
    response_format: { type: 'json_object' },
    logit_bias: { '42': 5 },
    tools: [{ type: 'function', function: { name: 'lookup' } }],
    tool_choice: { type: 'function', function: { name: 'lookup' } },
  }
  const serialized = stableStringify(options)
  const serializedExpected = stableStringify(expected)
  if (serialized !== serializedExpected) {
    throw new Error(`expected OpenAI provider options ${serializedExpected}, got ${serialized}`)
  }
}

export function testOpenAiProviderOptionsUseResponsesSurface() {
  const options = buildProviderChatRequestOptions({
    provider: CHAT_PROVIDER_OPENAI,
    endpointUrl: '/v1/responses',
    chatModel: 'gpt-5.4-nano',
    chatTemperature: 0.5,
    chatServiceTier: 'auto',
    chatStream: true,
    chatMessagesJson: '',
    chatReasoningEffort: 'high',
    chatThinkingType: 'auto',
    chatThinkingJson: '',
    chatFrequencyPenalty: 0,
    chatPresencePenalty: 0,
    chatTopP: 1,
    chatLogprobs: true,
    chatTopLogprobs: 5,
    chatParallelToolCalls: true,
    chatStopJson: '',
    chatStreamOptionsJson: '',
    chatResponseFormatJson: '{"format":{"type":"text"}}',
    chatLogitBiasJson: '',
    chatToolsJson: '',
    chatToolChoiceJson: '',
  })
  const expected = {
    service_tier: 'auto',
    frequency_penalty: 0,
    presence_penalty: 0,
    parallel_tool_calls: true,
    include: ['message.output_text.logprobs'],
    top_logprobs: 5,
    text: { format: { type: 'text' } },
    reasoning: { effort: 'high' },
  }
  const serialized = stableStringify(options)
  const serializedExpected = stableStringify(expected)
  if (serialized !== serializedExpected) {
    throw new Error(`expected OpenAI responses options ${serializedExpected}, got ${serialized}`)
  }
}

export function testMiroMindProviderOptionsReuseSharedChatCompletionsShape() {
  const options = buildProviderChatRequestOptions({
    provider: CHAT_PROVIDER_MIROMIND,
    endpointUrl: '/v1/chat/completions',
    chatModel: 'mirothinker-1-7-deepresearch-mini',
    chatTemperature: 0.4,
    chatServiceTier: 'default',
    chatStream: true,
    chatMessagesJson: '',
    chatReasoningEffort: 'high',
    chatThinkingType: 'auto',
    chatThinkingJson: '',
    chatFrequencyPenalty: 0.2,
    chatPresencePenalty: 0.1,
    chatTopP: 0.85,
    chatLogprobs: false,
    chatTopLogprobs: 0,
    chatParallelToolCalls: true,
    chatStopJson: '["DONE"]',
    chatStreamOptionsJson: '{"include_usage":true}',
    chatResponseFormatJson: '{"type":"json_object"}',
    chatLogitBiasJson: '',
    chatToolsJson: '',
    chatToolChoiceJson: '',
  })
  const expected = {
    temperature: 0.4,
    service_tier: 'default',
    frequency_penalty: 0.2,
    presence_penalty: 0.1,
    top_p: 0.85,
    parallel_tool_calls: true,
    stop: ['DONE'],
    stream_options: { include_usage: true },
    response_format: { type: 'json_object' },
    logprobs: false,
  }
  const serialized = stableStringify(options)
  const serializedExpected = stableStringify(expected)
  if (serialized !== serializedExpected) {
    throw new Error(`expected MiroMind chat-completions options ${serializedExpected}, got ${serialized}`)
  }
}

export function testAgnesProviderOptionsReuseSharedChatCompletionsShape() {
  const options = buildProviderChatRequestOptions({
    provider: CHAT_PROVIDER_AGNES,
    endpointUrl: '/v1/chat/completions',
    chatModel: 'agnes-2.0-flash',
    chatTemperature: 0.35,
    chatServiceTier: 'default',
    chatStream: true,
    chatMessagesJson: '',
    chatReasoningEffort: 'medium',
    chatThinkingType: 'auto',
    chatThinkingJson: '',
    chatFrequencyPenalty: 0.2,
    chatPresencePenalty: 0.1,
    chatTopP: 0.9,
    chatLogprobs: false,
    chatTopLogprobs: 0,
    chatParallelToolCalls: true,
    chatStopJson: '["DONE"]',
    chatStreamOptionsJson: '{"include_usage":true}',
    chatResponseFormatJson: '{"type":"json_object"}',
    chatLogitBiasJson: '',
    chatToolsJson: '',
    chatToolChoiceJson: '',
  })
  const expected = {
    temperature: 0.35,
    service_tier: 'default',
    frequency_penalty: 0.2,
    presence_penalty: 0.1,
    top_p: 0.9,
    parallel_tool_calls: true,
    stop: ['DONE'],
    stream_options: { include_usage: true },
    response_format: { type: 'json_object' },
    logprobs: false,
  }
  const serialized = stableStringify(options)
  const serializedExpected = stableStringify(expected)
  if (serialized !== serializedExpected) {
    throw new Error(`expected Agnes chat-completions options ${serializedExpected}, got ${serialized}`)
  }
}

export function testBytePlusProviderOptionsRejectInvalidJsonConfig() {
  let failed = false
  try {
    buildProviderChatRequestOptions({
      provider: CHAT_PROVIDER_BYTEPLUS,
      chatTemperature: 0.5,
      chatServiceTier: 'auto',
      chatStream: true,
      chatMessagesJson: '',
      chatReasoningEffort: 'medium',
      chatThinkingType: 'enabled',
      chatThinkingJson: '',
      chatFrequencyPenalty: 0,
      chatPresencePenalty: 0,
      chatTopP: 0.7,
      chatLogprobs: false,
      chatTopLogprobs: 0,
      chatParallelToolCalls: true,
      chatStopJson: '',
      chatStreamOptionsJson: '{"include_usage":true',
      chatResponseFormatJson: '',
      chatLogitBiasJson: '',
      chatToolsJson: '',
      chatToolChoiceJson: '',
    })
  } catch (error) {
    failed = String(error instanceof Error ? error.message : error).includes('Invalid BytePlus stream_options JSON')
  }
  if (!failed) {
    throw new Error('expected invalid BytePlus JSON config to throw a field-specific error')
  }
}
