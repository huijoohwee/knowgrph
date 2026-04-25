import type { WidgetRegistryField } from '@/features/flow-editor-manager/widgetRegistryTypes'

export type OpenAiApiDocRow = {
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
  modules?: string[]
  classes?: string[]
  functions?: string[]
}

type WidgetRowBinding = {
  rowKey: string
  field?: WidgetRegistryField
}

const OPENAI_TEXT_WIDGET_ROW_KEY_BY_PROPERTY_KEY: Readonly<Record<string, string>> = {
  chatProvider: 'openaiApi.provider',
  chatAuthMode: 'openaiApi.auth_mode',
  chatEndpointUrl: 'openaiApi.endpoint_url',
  chatApiKey: 'openaiApi.api_key',
  chatModel: 'openaiApi.model',
  prompt: 'openaiApi.input',
  chatMessagesJson: 'openaiApi.input',
  chatResponseFormatJson: 'openaiApi.response_format',
  chatTemperature: 'openaiApi.temperature',
  chatTopP: 'openaiApi.top_p',
  chatMaxCompletionTokens: 'openaiApi.max_output_tokens',
  chatReasoningEffort: 'openaiApi.reasoning_effort',
  chatStream: 'openaiApi.stream',
  chatFrequencyPenalty: 'openaiApi.frequency_penalty',
  chatPresencePenalty: 'openaiApi.presence_penalty',
  chatLogprobs: 'openaiApi.logprobs',
  chatTopLogprobs: 'openaiApi.top_logprobs',
  chatToolsJson: 'openaiApi.tools',
  chatToolChoiceJson: 'openaiApi.tool_choice',
  chatParallelToolCalls: 'openaiApi.parallel_tool_calls',
  output: 'openaiApi.input',
}

function normalizeTextWidgetLookupKey(raw: string | undefined): string {
  const trimmed = String(raw || '').trim()
  if (!trimmed) return ''
  if (trimmed.startsWith('properties.')) return trimmed.slice('properties.'.length).trim()
  return trimmed
}

function normalizeTextWidgetPortKey(raw: string | undefined): string {
  const trimmed = String(raw || '').trim()
  if (trimmed === 'prompt_in') return 'prompt'
  if (trimmed === 'text_out') return 'output'
  return trimmed
}

export function resolveOpenAiTextWidgetChatApiRowKey(args: {
  schemaPath?: string
  fieldKey?: string
  portKey?: string
}): string | null {
  const candidates = [
    normalizeTextWidgetLookupKey(args.schemaPath),
    String(args.fieldKey || '').trim(),
    normalizeTextWidgetPortKey(args.portKey),
  ]
  for (let i = 0; i < candidates.length; i += 1) {
    const candidate = candidates[i]
    if (!candidate) continue
    const rowKey = OPENAI_TEXT_WIDGET_ROW_KEY_BY_PROPERTY_KEY[candidate]
    if (rowKey) return rowKey
  }
  return null
}

const OPENAI_TEXT_WIDGET_FIELD_BINDINGS: ReadonlyArray<WidgetRowBinding> = [
  {
    rowKey: 'openaiApi.provider',
    field: { fieldKey: 'chatProvider', fieldType: 'text', schemaPath: 'properties.chatProvider', required: true, label: 'Provider' },
  },
  {
    rowKey: 'openaiApi.auth_mode',
    field: { fieldKey: 'chatAuthMode', fieldType: 'text', schemaPath: 'properties.chatAuthMode', required: true, label: 'Auth mode' },
  },
  {
    rowKey: 'openaiApi.endpoint_url',
    field: { fieldKey: 'chatEndpointUrl', fieldType: 'text', schemaPath: 'properties.chatEndpointUrl', required: true, label: 'Endpoint URL' },
  },
  {
    rowKey: 'openaiApi.model',
    field: { fieldKey: 'chatModel', fieldType: 'text', schemaPath: 'properties.chatModel', required: true, label: 'Model' },
  },
  {
    rowKey: 'openaiApi.input',
    field: { fieldKey: 'prompt', fieldType: 'textarea', schemaPath: 'properties.prompt', required: true, label: 'Prompt' },
  },
  {
    rowKey: 'openaiApi.input',
    field: { fieldKey: 'chatMessagesJson', fieldType: 'json', schemaPath: 'properties.chatMessagesJson', label: 'Input' },
  },
  {
    rowKey: 'openaiApi.response_format',
    field: { fieldKey: 'chatResponseFormatJson', fieldType: 'json', schemaPath: 'properties.chatResponseFormatJson', label: 'Response format' },
  },
  {
    rowKey: 'openaiApi.temperature',
    field: { fieldKey: 'chatTemperature', fieldType: 'number', schemaPath: 'properties.chatTemperature', label: 'Temperature' },
  },
  {
    rowKey: 'openaiApi.top_p',
    field: { fieldKey: 'chatTopP', fieldType: 'number', schemaPath: 'properties.chatTopP', label: 'Top P' },
  },
  {
    rowKey: 'openaiApi.max_output_tokens',
    field: { fieldKey: 'chatMaxCompletionTokens', fieldType: 'number', schemaPath: 'properties.chatMaxCompletionTokens', label: 'Max output tokens' },
  },
  {
    rowKey: 'openaiApi.reasoning_effort',
    field: { fieldKey: 'chatReasoningEffort', fieldType: 'text', schemaPath: 'properties.chatReasoningEffort', label: 'Reasoning effort' },
  },
  {
    rowKey: 'openaiApi.stream',
    field: { fieldKey: 'chatStream', fieldType: 'boolean', schemaPath: 'properties.chatStream', label: 'Stream' },
  },
  {
    rowKey: 'openaiApi.frequency_penalty',
    field: { fieldKey: 'chatFrequencyPenalty', fieldType: 'number', schemaPath: 'properties.chatFrequencyPenalty', label: 'Frequency penalty' },
  },
  {
    rowKey: 'openaiApi.presence_penalty',
    field: { fieldKey: 'chatPresencePenalty', fieldType: 'number', schemaPath: 'properties.chatPresencePenalty', label: 'Presence penalty' },
  },
  {
    rowKey: 'openaiApi.logprobs',
    field: { fieldKey: 'chatLogprobs', fieldType: 'boolean', schemaPath: 'properties.chatLogprobs', label: 'Logprobs' },
  },
  {
    rowKey: 'openaiApi.top_logprobs',
    field: { fieldKey: 'chatTopLogprobs', fieldType: 'number', schemaPath: 'properties.chatTopLogprobs', label: 'Top logprobs' },
  },
  {
    rowKey: 'openaiApi.tools',
    field: { fieldKey: 'chatToolsJson', fieldType: 'json', schemaPath: 'properties.chatToolsJson', label: 'Tools' },
  },
  {
    rowKey: 'openaiApi.tool_choice',
    field: { fieldKey: 'chatToolChoiceJson', fieldType: 'json', schemaPath: 'properties.chatToolChoiceJson', label: 'Tool choice' },
  },
  {
    rowKey: 'openaiApi.parallel_tool_calls',
    field: { fieldKey: 'chatParallelToolCalls', fieldType: 'boolean', schemaPath: 'properties.chatParallelToolCalls', label: 'Parallel tool calls' },
  },
]

export function buildOpenAiCompatibleTextGenerationFields(): WidgetRegistryField[] {
  return OPENAI_TEXT_WIDGET_FIELD_BINDINGS
    .map(binding => binding.field)
    .filter((field): field is WidgetRegistryField => !!field)
    .map(field => ({ ...field }))
    .concat([{ fieldKey: 'output', fieldType: 'textarea', schemaPath: 'properties.output', label: 'Output' }])
}

const OPENAI_DOC_ROW_BY_ROW_KEY: Readonly<Record<string, OpenAiApiDocRow>> = {
  'openaiApi.provider': {
    key: 'provider',
    typeLabel: 'string',
    value: 'Integration setting. Default openai.',
    valueKey: 'chatProvider',
    responsibility: 'Orchestrator -> pin OpenAI provider routing -> keep Integrations, Workflow Manager, and OpenAI Text Widget on the same provider family.',
    notes: 'Integration transport setting reused by the OpenAI Text Widget.',
    searchHints: ['chatProvider provider profile openai responses api'],
    modules: ['canvas/src/lib/chatEndpoint.ts', 'canvas/src/hooks/store/uiSlice.ts', 'canvas/src/features/flow-editor-manager/registryTemplates.ts'],
    classes: ['GraphState', 'WidgetRegistryEntry'],
    functions: ['normalizeChatProviderId', 'setChatProvider', 'inferTextGenerationProviderFamily'],
  },
  'openaiApi.auth_mode': {
    key: 'auth_mode',
    typeLabel: 'string',
    value: 'Integration setting. serverManaged | byok.',
    valueKey: 'chatAuthMode',
    responsibility: 'Orchestrator -> choose server-managed or BYOK credential flow -> keep auth policy aligned across Integrations and widget runs.',
    notes: 'Integration transport setting reused by the OpenAI Text Widget.',
    searchHints: ['chatAuthMode auth byok serverManaged api key'],
    modules: ['canvas/src/hooks/store/uiSlice.ts', 'canvas/src/features/settings/registry-ui.ui.ts', 'canvas/src/components/FlowEditorCanvas.tsx'],
    classes: ['GraphState', 'RunGenerationConfig'],
    functions: ['setChatAuthMode', 'setChatApiKey', 'generateRunMarkdownWithProvider'],
  },
  'openaiApi.endpoint_url': {
    key: 'endpoint_url',
    typeLabel: 'string',
    value: 'Integration setting. Default https://api.openai.com/v1/responses.',
    valueKey: 'chatEndpointUrl',
    responsibility: 'Transport -> route OpenAI requests to the Responses API upstream -> keep defaults, normalization, health checks, and widget execution on one endpoint SSOT.',
    notes: 'Integration transport setting reused by the OpenAI Text Widget.',
    searchHints: ['chatEndpointUrl responses endpoint /v1/responses'],
    modules: ['canvas/src/lib/chatEndpoint.ts', 'canvas/src/hooks/store/uiSlice.ts', 'canvas/src/features/flow-editor-manager/registryTemplates.ts'],
    classes: ['GraphState', 'RunGenerationConfig'],
    functions: ['normalizeChatEndpointUrlInput', 'resolveChatEndpointForRequest', 'setChatEndpointUrl'],
  },
  'openaiApi.api_key': {
    key: 'api_key',
    typeLabel: 'string',
    value: 'Integration setting. Required for BYOK authentication.',
    valueKey: 'chatApiKey',
    responsibility: 'Credential manager -> hold caller-supplied OpenAI secret for BYOK runs -> authorize direct OpenAI requests without leaking into persistent storage.',
    notes: 'Integration transport setting reused by the OpenAI Text Widget.',
    searchHints: ['chatApiKey api key authentication bearer'],
    modules: ['canvas/src/hooks/store/uiSlice.ts', 'canvas/src/features/settings/registry-ui.ui.ts', 'canvas/src/components/FlowEditorCanvas.tsx'],
    classes: ['GraphState', 'RunGenerationConfig'],
    functions: ['setChatApiKey', 'setChatAuthMode', 'generateRunMarkdownWithProvider'],
  },
  'openaiApi.model': {
    key: 'model',
    typeLabel: 'string',
    value: 'Required. Model ID.',
    valueKey: 'chatModel',
    responsibility: 'Model resolver -> choose the target Responses model -> keep global defaults, workflow registry drafts, and widget overrides on the same execution model.',
    searchHints: ['model required responses api'],
    modules: ['canvas/src/lib/chatEndpoint.ts', 'canvas/src/hooks/store/uiSlice.ts', 'canvas/src/features/flow-editor-manager/registryTemplates.ts'],
    classes: ['GraphState', 'WidgetRegistryEntry'],
    functions: ['getDefaultChatModelForProvider', 'normalizeChatModelIdForProvider', 'setChatModel'],
  },
  'openaiApi.input': {
    key: 'input',
    typeLabel: 'string | object[]',
    value: 'Optional. Text or input item list.',
    valueKey: 'chatMessagesJson',
    responsibility: 'Prompt builder -> assemble text or multimodal input items -> bind widget prompt/dataflow output into the Responses request body.',
    searchHints: ['input text image file input_items conversation state'],
    modules: ['canvas/src/features/flow-editor-manager/registryTemplates.ts', 'canvas/src/components/FlowEditorCanvas.tsx', 'canvas/src/features/chat/byteplusRunGeneration.ts'],
    classes: ['WidgetRegistryEntry', 'RunTextGenerationOptions'],
    functions: ['buildOpenAiCompatibleTextGenerationFields', 'resolveEffectiveTextGenerationWidgetProperties', 'generateRunMarkdownWithProvider'],
  },
  'openaiApi.temperature': {
    key: 'temperature',
    typeLabel: 'float | null',
    value: 'Optional. Default 1. Range: 0 to 2.',
    valueKey: 'chatTemperature',
    responsibility: 'Sampler -> tune output randomness -> widen or narrow lexical variation for the shared OpenAI text run path.',
    modules: ['canvas/src/features/settings/registry-ui.ui.ts', 'canvas/src/hooks/store/uiSlice.ts', 'canvas/src/features/chat/byteplusRunGeneration.ts'],
    classes: ['GraphState', 'RunTextGenerationOptions'],
    functions: ['setChatTemperature', 'buildProviderChatRequestOptions', 'generateRunMarkdownWithProvider'],
  },
  'openaiApi.top_p': {
    key: 'top_p',
    typeLabel: 'float | null',
    value: 'Optional. Default 1. Range: 0 to 1.',
    valueKey: 'chatTopP',
    responsibility: 'Sampler -> cap nucleus mass -> bound token-choice breadth for the shared OpenAI text run path.',
    modules: ['canvas/src/features/settings/registry-ui.ui.ts', 'canvas/src/hooks/store/uiSlice.ts', 'canvas/src/features/chat/byteplusRunGeneration.ts'],
    classes: ['GraphState', 'RunTextGenerationOptions'],
    functions: ['setChatTopP', 'buildProviderChatRequestOptions', 'generateRunMarkdownWithProvider'],
  },
  'openaiApi.max_output_tokens': {
    key: 'max_output_tokens',
    typeLabel: 'integer | null',
    value: 'Optional. Default null. Min: 1 when set.',
    valueKey: 'chatMaxCompletionTokens',
    responsibility: 'Budget controller -> cap visible plus reasoning token output -> keep long runs bounded and inspectable.',
    modules: ['canvas/src/features/settings/registry-ui.ui.ts', 'canvas/src/hooks/store/uiSlice.ts', 'canvas/src/features/chat/byteplusRunGeneration.ts'],
    classes: ['GraphState', 'RunTextGenerationOptions'],
    functions: ['setChatMaxCompletionTokens', 'clampChatCompletionTokens', 'generateRunMarkdownWithProvider'],
  },
  'openaiApi.reasoning_effort': {
    key: 'reasoning_effort',
    typeLabel: 'string | null',
    value: 'Optional. minimal | low | medium | high.',
    valueKey: 'chatReasoningEffort',
    responsibility: 'Reasoning controller -> choose how much deliberation supported models spend -> trade off cost, latency, and depth.',
    modules: ['canvas/src/features/settings/registry-ui.ui.ts', 'canvas/src/hooks/store/uiSlice.ts', 'canvas/src/features/chat/byteplusRunGeneration.ts'],
    classes: ['GraphState', 'RunTextGenerationOptions'],
    functions: ['setChatReasoningEffort', 'normalizeChatReasoningEffort', 'buildProviderChatRequestOptions'],
  },
  'openaiApi.response_format': {
    key: 'response_format',
    typeLabel: 'object | null',
    value: 'Optional. Text or structured-output configuration.',
    valueKey: 'chatResponseFormatJson',
    responsibility: 'Output contract -> constrain free-text vs structured responses -> keep Integrations docs, widget editor JSON, and run dispatch on one schema surface.',
    modules: ['canvas/src/features/settings/registry-ui.ui.ts', 'canvas/src/features/flow-editor-manager/registryTemplates.ts', 'canvas/src/features/chat/byteplusRunGeneration.ts'],
    classes: ['WidgetRegistryEntry', 'RunTextGenerationOptions'],
    functions: ['setChatResponseFormatJson', 'buildOpenAiCompatibleTextGenerationFields', 'buildProviderChatRequestOptions'],
  },
  'openaiApi.stream': {
    key: 'stream',
    typeLabel: 'boolean | null',
    value: 'Optional. Stream the response when true.',
    valueKey: 'chatStream',
    responsibility: 'Delivery controller -> choose SSE streaming vs one-shot response -> keep widget run UX and request payload behavior aligned.',
    modules: ['canvas/src/features/settings/registry-ui.ui.ts', 'canvas/src/hooks/store/uiSlice.ts', 'canvas/src/features/chat/byteplusRunGeneration.ts'],
    classes: ['GraphState', 'RunTextGenerationOptions'],
    functions: ['setChatStream', 'generateRunMarkdownWithProvider', 'parseSseEvents'],
  },
  'openaiApi.frequency_penalty': {
    key: 'frequency_penalty',
    typeLabel: 'float | null',
    value: 'Optional. Default 0. Range: -2.0 to 2.0.',
    valueKey: 'chatFrequencyPenalty',
    responsibility: 'Penalty controller -> discourage frequency-based repetition -> reduce duplicate phrasing in generated text.',
    modules: ['canvas/src/features/settings/registry-ui.ui.ts', 'canvas/src/hooks/store/uiSlice.ts', 'canvas/src/features/chat/byteplusRunGeneration.ts'],
    classes: ['GraphState', 'RunTextGenerationOptions'],
    functions: ['setChatFrequencyPenalty', 'buildProviderChatRequestOptions', 'generateRunMarkdownWithProvider'],
  },
  'openaiApi.presence_penalty': {
    key: 'presence_penalty',
    typeLabel: 'float | null',
    value: 'Optional. Default 0. Range: -2.0 to 2.0.',
    valueKey: 'chatPresencePenalty',
    responsibility: 'Penalty controller -> encourage topic novelty -> push the model away from already-used topics.',
    modules: ['canvas/src/features/settings/registry-ui.ui.ts', 'canvas/src/hooks/store/uiSlice.ts', 'canvas/src/features/chat/byteplusRunGeneration.ts'],
    classes: ['GraphState', 'RunTextGenerationOptions'],
    functions: ['setChatPresencePenalty', 'buildProviderChatRequestOptions', 'generateRunMarkdownWithProvider'],
  },
  'openaiApi.logprobs': {
    key: 'logprobs',
    typeLabel: 'boolean | null',
    value: 'Optional. Include output token logprobs.',
    valueKey: 'chatLogprobs',
    responsibility: 'Telemetry switch -> request token log probabilities -> expose richer debugging metadata when the model supports it.',
    modules: ['canvas/src/features/settings/registry-ui.ui.ts', 'canvas/src/features/flow-editor-manager/registryTemplates.ts', 'canvas/src/features/chat/byteplusRunGeneration.ts'],
    classes: ['WidgetRegistryEntry', 'RunTextGenerationOptions'],
    functions: ['setChatLogprobs', 'buildOpenAiCompatibleTextGenerationFields', 'buildProviderChatRequestOptions'],
  },
  'openaiApi.top_logprobs': {
    key: 'top_logprobs',
    typeLabel: 'integer | null',
    value: 'Optional. Range: 0 to 20.',
    valueKey: 'chatTopLogprobs',
    responsibility: 'Telemetry switch -> bound how many alternative tokens include logprob metadata -> keep debug payloads inspectable.',
    modules: ['canvas/src/features/settings/registry-ui.ui.ts', 'canvas/src/features/flow-editor-manager/registryTemplates.ts', 'canvas/src/features/chat/byteplusRunGeneration.ts'],
    classes: ['WidgetRegistryEntry', 'RunTextGenerationOptions'],
    functions: ['setChatTopLogprobs', 'buildOpenAiCompatibleTextGenerationFields', 'buildProviderChatRequestOptions'],
  },
  'openaiApi.tools': {
    key: 'tools',
    typeLabel: 'object[] | null',
    value: 'Optional. Tool definitions for function or built-in tools.',
    valueKey: 'chatToolsJson',
    responsibility: 'Tool registry -> publish callable tool definitions -> let the Responses API plan against the same schemas authored in Integrations or widget overrides.',
    modules: ['canvas/src/features/settings/registry-ui.ui.ts', 'canvas/src/features/flow-editor-manager/registryTemplates.ts', 'canvas/src/features/chat/byteplusRunGeneration.ts'],
    classes: ['WidgetRegistryEntry', 'RunTextGenerationOptions'],
    functions: ['setChatToolsJson', 'buildOpenAiCompatibleTextGenerationFields', 'buildProviderChatRequestOptions'],
  },
  'openaiApi.tool_choice': {
    key: 'tool_choice',
    typeLabel: 'string | object | null',
    value: 'Optional. auto | required | none | explicit tool selector.',
    valueKey: 'chatToolChoiceJson',
    responsibility: 'Tool planner -> constrain whether the model may call tools -> keep deterministic tool routing in sync across Integrations and widget overrides.',
    modules: ['canvas/src/features/settings/registry-ui.ui.ts', 'canvas/src/features/flow-editor-manager/registryTemplates.ts', 'canvas/src/features/chat/byteplusRunGeneration.ts'],
    classes: ['WidgetRegistryEntry', 'RunTextGenerationOptions'],
    functions: ['setChatToolChoiceJson', 'buildOpenAiCompatibleTextGenerationFields', 'buildProviderChatRequestOptions'],
  },
  'openaiApi.parallel_tool_calls': {
    key: 'parallel_tool_calls',
    typeLabel: 'boolean | null',
    value: 'Optional. Allows multiple tool calls in one response.',
    valueKey: 'chatParallelToolCalls',
    responsibility: 'Tool scheduler -> allow or forbid concurrent tool execution -> keep orchestration predictable while avoiding downstream duplicate handling logic.',
    modules: ['canvas/src/features/settings/registry-ui.ui.ts', 'canvas/src/features/flow-editor-manager/registryTemplates.ts', 'canvas/src/features/chat/byteplusRunGeneration.ts'],
    classes: ['WidgetRegistryEntry', 'RunTextGenerationOptions'],
    functions: ['setChatParallelToolCalls', 'buildOpenAiCompatibleTextGenerationFields', 'buildProviderChatRequestOptions'],
  },
}

const OPENAI_DOC_ROW_ORDER = OPENAI_TEXT_WIDGET_FIELD_BINDINGS
  .map(binding => binding.rowKey)
  .concat(['openaiApi.api_key'])

export const OPENAI_RESPONSES_API_DOC_ROWS: ReadonlyArray<OpenAiApiDocRow> = Array.from(
  new Set(OPENAI_DOC_ROW_ORDER),
).map(rowKey => OPENAI_DOC_ROW_BY_ROW_KEY[rowKey]).filter((row): row is OpenAiApiDocRow => !!row)

export const OPENAI_KEY_ACTIONS_BY_VALUE_KEY: Readonly<Record<string, string[]>> = {
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

export const OPENAI_VALUE_TOOLTIP_BY_ROW_KEY: Readonly<Record<string, {
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
    expansionNote: 'More capable models expand depth, latency, and cost tradeoffs.',
    contractionNote: 'One default model narrows execution variance.',
  },
  input: {
    defaultValue: '—',
    expansionNote: 'Richer inputs expand conversational and multimodal context.',
    contractionNote: 'Leaner inputs narrow payload complexity.',
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
    defaultValue: null,
    min: 1,
    interval: 1,
    expansionNote: 'Higher caps expand answer length and reasoning budget.',
    contractionNote: 'Lower caps narrow output budget.',
  },
  reasoning_effort: {
    defaultValue: 'medium',
    expansionNote: 'Higher effort expands deliberation depth.',
    contractionNote: 'Lower effort narrows reasoning cost and latency.',
  },
  response_format: {
    defaultValue: '{"type":"text"}',
    expansionNote: 'Structured modes expand machine-readable guarantees.',
    contractionNote: 'Text mode narrows output constraints.',
  },
  stream: {
    defaultValue: true,
    expansionNote: 'Streaming expands progressive delivery.',
    contractionNote: 'One-shot responses narrow delivery to a single payload.',
  },
  frequency_penalty: {
    defaultValue: 0,
    min: -2,
    max: 2,
    interval: 0.1,
    expansionNote: 'Higher values expand repetition suppression.',
    contractionNote: 'Lower values narrow anti-repetition pressure.',
  },
  presence_penalty: {
    defaultValue: 0,
    min: -2,
    max: 2,
    interval: 0.1,
    expansionNote: 'Higher values expand topic novelty.',
    contractionNote: 'Lower values narrow novelty pressure.',
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
    expansionNote: 'Higher counts expand alternative token visibility.',
    contractionNote: 'Lower counts narrow token probability detail.',
  },
  tools: {
    defaultValue: 'null',
    expansionNote: 'More tool definitions expand the callable surface.',
    contractionNote: 'Fewer tools narrow tool-planning choices.',
  },
  tool_choice: {
    defaultValue: 'auto',
    expansionNote: 'Explicit choices expand deterministic routing.',
    contractionNote: 'Auto narrows manual routing pressure.',
  },
  parallel_tool_calls: {
    defaultValue: true,
    expansionNote: 'Parallel calls expand concurrent tool execution.',
    contractionNote: 'Serial calls narrow concurrency.',
  },
}
