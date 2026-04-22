import type { FlowDetails, SettingMeta } from '@/features/settings/types'
import type { VirtualSettingsEntry } from './byteplusChatApiDocs'

export const OPENAI_CHAT_API_DOC_AREA = 'OpenAI Chat API'

export function getOpenAiChatApiRowAnchorId(rowKey: string): string {
  const normalized = String(rowKey || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `openai-chat-api-row-${normalized || 'entry'}`
}

type OpenAiApiDocRow = {
  key: string
  typeLabel: string
  value: string
  responsibility: string
  valueKey?: string
  notes?: string
  searchHints?: string[]
  tooltipDefaultValue?: string | number | boolean | null
  tooltipMin?: string | number
  tooltipMax?: string | number
  tooltipInterval?: string | number
  tooltipExpansionNote?: string
  tooltipContractionNote?: string
  tooltipImpact?: string
}

const OPENAI_TOOLTIP_ROLE = 'OpenAI Chat API'

const OPENAI_KEY_ACTIONS_BY_VALUE_KEY: Readonly<Record<string, string[]>> = {
  chatProvider: ['select provider profile', 'bind OpenAI request routing'],
  chatAuthMode: ['select auth mode', 'choose credential flow'],
  chatEndpointUrl: ['set responses endpoint', 'route API requests'],
  chatApiKey: ['store API secret', 'authorize direct OpenAI calls'],
  chatModel: ['select target model', 'route response execution'],
  chatMessagesJson: ['compose input items', 'serialize request input'],
  chatTemperature: ['set sampling temperature', 'control output variability'],
  chatTopP: ['set nucleus threshold', 'limit token sampling'],
  chatMaxCompletionTokens: ['cap output budget', 'bound response length'],
  chatReasoningEffort: ['set reasoning effort', 'tune deliberation budget'],
  chatResponseFormatJson: ['define response format', 'constrain structured output'],
  chatStream: ['toggle stream mode', 'choose reply delivery'],
  chatFrequencyPenalty: ['set repetition penalty', 'discourage duplicate tokens'],
  chatPresencePenalty: ['set novelty penalty', 'encourage topic shifts'],
  chatLogprobs: ['toggle logprobs output', 'request token probabilities'],
  chatTopLogprobs: ['set top-logprobs count', 'bound token alternatives'],
  chatToolsJson: ['declare callable tools', 'publish tool schemas'],
  chatToolChoiceJson: ['set tool policy', 'select callable function'],
  chatParallelToolCalls: ['toggle parallel calls', 'coordinate tool concurrency'],
}

const OPENAI_VALUE_TOOLTIP_BY_ROW_KEY: Readonly<Record<string, {
  defaultValue?: string | number | boolean | null
  min?: string | number
  max?: string | number
  interval?: string | number
  expansionNote?: string
  contractionNote?: string
  impact?: string
}>> = {
  provider: {
    defaultValue: 'openai',
    expansionNote: 'OpenAI provider binds the widget to the Responses API routing profile.',
    contractionNote: 'Switching providers narrows OpenAI-specific behavior reuse.',
  },
  auth_mode: {
    defaultValue: 'serverManaged',
    expansionNote: 'BYOK expands direct caller control.',
    contractionNote: 'Server-managed auth narrows credential handling in the widget.',
  },
  endpoint_url: {
    defaultValue: 'https://api.openai.com/v1/responses',
    expansionNote: 'A custom upstream expands gateway compatibility.',
    contractionNote: 'One fixed endpoint narrows transport flexibility.',
  },
  api_key: {
    defaultValue: '—',
    expansionNote: 'A BYOK secret expands direct authenticated execution.',
    contractionNote: 'No key narrows execution to server-managed auth only.',
  },
  model: {
    defaultValue: 'gpt-5.4-nano',
    expansionNote: 'Other models expands capability and cost profiles.',
    contractionNote: 'One default model narrows execution variance.',
  },
  input: {
    defaultValue: '—',
    expansionNote: 'Richer inputs expands conversational and multimodal context.',
    contractionNote: 'Leaner inputs narrows payload complexity.',
  },
  temperature: {
    defaultValue: 1,
    min: 0,
    max: 2,
    interval: 0.1,
    expansionNote: 'Higher temperature expands randomness.',
    contractionNote: 'Lower temperature narrows output variability.',
  },
  top_p: {
    defaultValue: 1,
    min: 0,
    max: 1,
    interval: 0.01,
    expansionNote: 'Higher top_p expands candidate token mass.',
    contractionNote: 'Lower top_p narrows sampling breadth.',
  },
  max_output_tokens: {
    defaultValue: '—',
    min: 0,
    interval: 1,
    expansionNote: 'Higher caps expands answer length.',
    contractionNote: 'Lower caps narrows output budget.',
  },
  reasoning_effort: {
    defaultValue: 'medium',
    expansionNote: 'Higher effort expands deliberation depth.',
    contractionNote: 'Lower effort narrows reasoning cost and latency.',
  },
  response_format: {
    defaultValue: '{"type":"text"}',
    expansionNote: 'Structured modes expands machine-readable guarantees.',
    contractionNote: 'Text mode narrows output constraints.',
  },
  stream: {
    defaultValue: false,
    expansionNote: 'Streaming expands progressive delivery.',
    contractionNote: 'One-shot responses narrows delivery to a single payload.',
  },
  frequency_penalty: {
    defaultValue: 0,
    min: -2,
    max: 2,
    interval: 0.1,
    expansionNote: 'Higher values expands repetition suppression.',
    contractionNote: 'Lower values narrows anti-repetition pressure.',
  },
  presence_penalty: {
    defaultValue: 0,
    min: -2,
    max: 2,
    interval: 0.1,
    expansionNote: 'Higher values expands topic novelty.',
    contractionNote: 'Lower values narrows novelty pressure.',
  },
  logprobs: {
    defaultValue: false,
    expansionNote: 'Enabling logprobs expands token probability insight.',
    contractionNote: 'Disabling logprobs narrows response metadata.',
  },
  top_logprobs: {
    defaultValue: 0,
    min: 0,
    max: 20,
    interval: 1,
    expansionNote: 'Higher counts expands alternative token visibility.',
    contractionNote: 'Lower counts narrows token probability detail.',
  },
  tools: {
    defaultValue: 'null',
    expansionNote: 'More tool definitions expands callable surface.',
    contractionNote: 'Fewer tools narrows tool-planning choices.',
  },
  tool_choice: {
    defaultValue: 'auto',
    expansionNote: 'Explicit tool choices expands deterministic routing.',
    contractionNote: 'Auto narrows manual routing pressure.',
  },
  parallel_tool_calls: {
    defaultValue: true,
    expansionNote: 'Parallel calls expands concurrent tool execution.',
    contractionNote: 'Serial calls narrows concurrency.',
  },
}

const OPENAI_CHAT_API_DOC_ROWS: ReadonlyArray<OpenAiApiDocRow> = [
  {
    key: 'provider',
    typeLabel: 'string',
    value: 'Integration setting. Default openai.',
    valueKey: 'chatProvider',
    responsibility: 'Pins the widget and integration row set to the OpenAI provider profile.',
    searchHints: ['chatProvider provider profile openai responses api'],
    notes: 'Integration transport setting reused by the OpenAI Text Widget.',
  },
  {
    key: 'auth_mode',
    typeLabel: 'string',
    value: 'Integration setting. serverManaged | byok.',
    valueKey: 'chatAuthMode',
    responsibility: 'Selects server-managed credentials or direct BYOK authentication.',
    searchHints: ['chatAuthMode auth byok serverManaged api key'],
    notes: 'Integration transport setting reused by the OpenAI Text Widget.',
  },
  {
    key: 'endpoint_url',
    typeLabel: 'string',
    value: 'Integration setting. Default https://api.openai.com/v1/responses.',
    valueKey: 'chatEndpointUrl',
    responsibility: 'Targets the OpenAI Responses API endpoint for requests.',
    searchHints: ['chatEndpointUrl responses endpoint /v1/responses'],
    notes: 'Integration transport setting reused by the OpenAI Text Widget.',
  },
  {
    key: 'api_key',
    typeLabel: 'string',
    value: 'Integration setting. Required for BYOK authentication.',
    valueKey: 'chatApiKey',
    responsibility: 'Supplies the caller-managed OpenAI API key when auth mode is BYOK.',
    searchHints: ['chatApiKey api key authentication bearer'],
    notes: 'Integration transport setting reused by the OpenAI Text Widget.',
  },
  {
    key: 'model',
    typeLabel: 'string',
    value: 'Required. Model ID.',
    valueKey: 'chatModel',
    responsibility: 'Selects the model used by the Responses API request.',
    searchHints: ['model required responses api'],
  },
  {
    key: 'input',
    typeLabel: 'string | object[]',
    value: 'Optional. Text or input item list.',
    valueKey: 'chatMessagesJson',
    responsibility: 'Carries text, image, or prior message input items for the response.',
    searchHints: ['input text image file input_items conversation state'],
  },
  {
    key: 'temperature',
    typeLabel: 'float | null',
    value: 'Optional. Default 1. Range: 0 to 2.',
    valueKey: 'chatTemperature',
    responsibility: 'Controls sampling randomness.',
  },
  {
    key: 'top_p',
    typeLabel: 'float | null',
    value: 'Optional. Default 1. Range: 0 to 1.',
    valueKey: 'chatTopP',
    responsibility: 'Controls nucleus sampling.',
  },
  {
    key: 'max_output_tokens',
    typeLabel: 'integer | null',
    value: 'Optional. Caps the response token budget.',
    valueKey: 'chatMaxCompletionTokens',
    responsibility: 'Limits how many output tokens the response may produce.',
  },
  {
    key: 'reasoning_effort',
    typeLabel: 'string | null',
    value: 'Optional. minimal | low | medium | high.',
    valueKey: 'chatReasoningEffort',
    responsibility: 'Controls reasoning effort for supported models.',
  },
  {
    key: 'response_format',
    typeLabel: 'object | null',
    value: 'Optional. Text or structured-output configuration.',
    valueKey: 'chatResponseFormatJson',
    responsibility: 'Constrains text or JSON output shape.',
  },
  {
    key: 'stream',
    typeLabel: 'boolean | null',
    value: 'Optional. Stream the response when true.',
    valueKey: 'chatStream',
    responsibility: 'Returns the response progressively when enabled.',
  },
  {
    key: 'frequency_penalty',
    typeLabel: 'float | null',
    value: 'Optional. Default 0. Range: -2.0 to 2.0.',
    valueKey: 'chatFrequencyPenalty',
    responsibility: 'Discourages repetition by token frequency.',
  },
  {
    key: 'presence_penalty',
    typeLabel: 'float | null',
    value: 'Optional. Default 0. Range: -2.0 to 2.0.',
    valueKey: 'chatPresencePenalty',
    responsibility: 'Encourages topic novelty.',
  },
  {
    key: 'logprobs',
    typeLabel: 'boolean | null',
    value: 'Optional. Include output token logprobs.',
    valueKey: 'chatLogprobs',
    responsibility: 'Requests token probability metadata when supported.',
  },
  {
    key: 'top_logprobs',
    typeLabel: 'integer | null',
    value: 'Optional. Range: 0 to 20.',
    valueKey: 'chatTopLogprobs',
    responsibility: 'Controls how many alternative token logprobs to return.',
  },
  {
    key: 'tools',
    typeLabel: 'object[] | null',
    value: 'Optional. Tool definitions for function or built-in tools.',
    valueKey: 'chatToolsJson',
    responsibility: 'Declares callable tools for the response.',
  },
  {
    key: 'tool_choice',
    typeLabel: 'string | object | null',
    value: 'Optional. auto | required | none | explicit tool selector.',
    valueKey: 'chatToolChoiceJson',
    responsibility: 'Controls whether tools may or must be used.',
  },
  {
    key: 'parallel_tool_calls',
    typeLabel: 'boolean | null',
    value: 'Optional. Allows multiple tool calls in one response.',
    valueKey: 'chatParallelToolCalls',
    responsibility: 'Controls whether tool calls may run concurrently.',
  },
]

const toBaseType = (typeLabel: string): SettingMeta['type'] => {
  const normalized = String(typeLabel || '').trim().toLowerCase()
  if (normalized.includes('boolean')) return 'boolean'
  if (normalized.includes('integer') || normalized.includes('float') || normalized.includes('number')) return 'number'
  if (normalized.includes('object') || normalized.includes('[]')) return 'json'
  return 'string'
}

export const OPENAI_CHAT_API_REQUEST_DOC_ENTRIES: ReadonlyArray<VirtualSettingsEntry> =
  OPENAI_CHAT_API_DOC_ROWS.map(row => ({
    meta: {
      key: `openaiApi.${row.key}`,
      type: toBaseType(row.typeLabel),
      source: 'backendEnv',
      read: () => row.value,
    },
    value: row.value,
    valueKey: row.valueKey,
    typeLabel: row.typeLabel,
    tooltipRole: row.valueKey ? OPENAI_TOOLTIP_ROLE : undefined,
    tooltipActions: row.valueKey ? OPENAI_KEY_ACTIONS_BY_VALUE_KEY[row.valueKey] : undefined,
    tooltipDefaultValue: typeof row.tooltipDefaultValue !== 'undefined'
      ? row.tooltipDefaultValue
      : OPENAI_VALUE_TOOLTIP_BY_ROW_KEY[row.key]?.defaultValue,
    tooltipMin: typeof row.tooltipMin !== 'undefined'
      ? row.tooltipMin
      : OPENAI_VALUE_TOOLTIP_BY_ROW_KEY[row.key]?.min,
    tooltipMax: typeof row.tooltipMax !== 'undefined'
      ? row.tooltipMax
      : OPENAI_VALUE_TOOLTIP_BY_ROW_KEY[row.key]?.max,
    tooltipInterval: typeof row.tooltipInterval !== 'undefined'
      ? row.tooltipInterval
      : OPENAI_VALUE_TOOLTIP_BY_ROW_KEY[row.key]?.interval,
    tooltipExpansionNote: row.tooltipExpansionNote || OPENAI_VALUE_TOOLTIP_BY_ROW_KEY[row.key]?.expansionNote,
    tooltipContractionNote: row.tooltipContractionNote || OPENAI_VALUE_TOOLTIP_BY_ROW_KEY[row.key]?.contractionNote,
    tooltipImpact: row.tooltipImpact || OPENAI_VALUE_TOOLTIP_BY_ROW_KEY[row.key]?.impact,
    searchHints: [
      'openai chat api responses request parameters',
      row.key,
      ...(row.searchHints || []),
    ],
    details: {
      area: OPENAI_CHAT_API_DOC_AREA,
      responsibility: row.responsibility,
      notes: row.notes || '',
      modules: ['POST /responses'],
      classes: ['Request body'],
      functions: ['OpenAI Responses API'],
    },
  }))
