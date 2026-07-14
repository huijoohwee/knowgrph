import type { WidgetRegistryField, WidgetRegistryFieldOption } from '@/features/storyboard-widget-manager/widgetRegistryTypes'

import { CHAT_BYTEPLUS_TEXT_MODEL_OPTIONS } from '@/lib/chatEndpoint'

export type BytePlusSharedTextApiDocRow = {
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

const BYTEPLUS_TEXT_WIDGET_MODEL_OPTIONS: WidgetRegistryFieldOption[] = CHAT_BYTEPLUS_TEXT_MODEL_OPTIONS.map((value, index) => ({
  label: index === 0 ? `${value} (Default)` : value,
  value,
}))

const BYTEPLUS_TEXT_WIDGET_REASONING_EFFORT_OPTIONS: WidgetRegistryFieldOption[] = [
  { label: 'minimal (Default)', value: 'minimal' },
  { label: 'low', value: 'low' },
  { label: 'medium', value: 'medium' },
  { label: 'high', value: 'high' },
]

const BYTEPLUS_TEXT_WIDGET_THINKING_TYPE_OPTIONS: WidgetRegistryFieldOption[] = [
  { label: 'disabled (Default)', value: 'disabled' },
  { label: 'enabled', value: 'enabled' },
]

type CodebaseLocation = {
  modules: string[]
  classes: string[]
  functions: string[]
}

const BYTEPLUS_SHARED_OWNER_PREFIX = 'byteplus.'
const BYTEPLUS_TEXT_API_PREFIX = 'byteplusApi.'

const BYTEPLUS_TEXT_WIDGET_ROW_KEY_BY_PROPERTY_KEY: Readonly<Record<string, string>> = {
  chatProvider: 'byteplusApi.provider',
  chatAuthMode: 'byteplus.auth_mode',
  chatEndpointUrl: 'byteplus.endpoint_url',
  chatApiKey: 'byteplus.api_key',
  chatModel: 'byteplusApi.model',
  chatTemperature: 'byteplusApi.temperature',
  chatMaxCompletionTokens: 'byteplusApi.max_completion_tokens',
  chatServiceTier: 'byteplusApi.service_tier',
  chatStream: 'byteplusApi.stream',
  chatMessagesJson: 'byteplusApi.messages',
  chatReasoningEffort: 'byteplusApi.reasoning_effort',
  chatThinkingType: 'byteplusApi.thinking.type',
  chatThinkingJson: 'byteplusApi.thinking',
  chatFrequencyPenalty: 'byteplusApi.frequency_penalty',
  chatPresencePenalty: 'byteplusApi.presence_penalty',
  chatTopP: 'byteplusApi.top_p',
  chatLogprobs: 'byteplusApi.logprobs',
  chatTopLogprobs: 'byteplusApi.top_logprobs',
  chatParallelToolCalls: 'byteplusApi.parallel_tool_calls',
  chatStopJson: 'byteplusApi.stop',
  chatStreamOptionsJson: 'byteplusApi.stream_options',
  chatResponseFormatJson: 'byteplusApi.response_format',
  chatLogitBiasJson: 'byteplusApi.logit_bias',
  chatToolsJson: 'byteplusApi.tools',
  chatToolChoiceJson: 'byteplusApi.tool_choice',
  prompt: 'byteplusApi.messages.content.text',
  output: 'byteplusApi.messages.content.text',
}

const BYTEPLUS_TEXT_WIDGET_FIELD_BINDINGS: ReadonlyArray<WidgetRowBinding> = [
  { rowKey: 'byteplusApi.provider', field: { fieldKey: 'chatProvider', fieldType: 'readonly', schemaPath: 'properties.chatProvider', required: true, label: 'Provider' } },
  { rowKey: 'byteplus.auth_mode', field: { fieldKey: 'chatAuthMode', fieldType: 'text', schemaPath: 'properties.chatAuthMode', required: true, label: 'Auth mode' } },
  { rowKey: 'byteplus.endpoint_url', field: { fieldKey: 'chatEndpointUrl', fieldType: 'text', schemaPath: 'properties.chatEndpointUrl', required: true, label: 'Endpoint URL' } },
  { rowKey: 'byteplusApi.model', field: { fieldKey: 'chatModel', fieldType: 'select', schemaPath: 'properties.chatModel', required: true, label: 'Model', options: BYTEPLUS_TEXT_WIDGET_MODEL_OPTIONS } },
  { rowKey: 'byteplusApi.messages.content.text', field: { fieldKey: 'prompt', fieldType: 'textarea', schemaPath: 'properties.prompt', required: true, label: 'Prompt' } },
  { rowKey: 'byteplusApi.messages', field: { fieldKey: 'chatMessagesJson', fieldType: 'json', schemaPath: 'properties.chatMessagesJson', label: 'Messages' } },
  { rowKey: 'byteplusApi.response_format', field: { fieldKey: 'chatResponseFormatJson', fieldType: 'json', schemaPath: 'properties.chatResponseFormatJson', label: 'Response format' } },
  { rowKey: 'byteplusApi.thinking.type', field: { fieldKey: 'chatThinkingType', fieldType: 'select', schemaPath: 'properties.chatThinkingType', label: 'Thinking type', options: BYTEPLUS_TEXT_WIDGET_THINKING_TYPE_OPTIONS } },
  { rowKey: 'byteplusApi.thinking', field: { fieldKey: 'chatThinkingJson', fieldType: 'json', schemaPath: 'properties.chatThinkingJson', label: 'Thinking' } },
  { rowKey: 'byteplusApi.temperature', field: { fieldKey: 'chatTemperature', fieldType: 'number', schemaPath: 'properties.chatTemperature', label: 'Temperature' } },
  { rowKey: 'byteplusApi.top_p', field: { fieldKey: 'chatTopP', fieldType: 'number', schemaPath: 'properties.chatTopP', label: 'Top P' } },
  { rowKey: 'byteplusApi.max_completion_tokens', field: { fieldKey: 'chatMaxCompletionTokens', fieldType: 'number', schemaPath: 'properties.chatMaxCompletionTokens', label: 'Max completion tokens' } },
  { rowKey: 'byteplusApi.service_tier', field: { fieldKey: 'chatServiceTier', fieldType: 'text', schemaPath: 'properties.chatServiceTier', label: 'Service tier' } },
  { rowKey: 'byteplusApi.stream', field: { fieldKey: 'chatStream', fieldType: 'boolean', schemaPath: 'properties.chatStream', label: 'Stream' } },
  { rowKey: 'byteplusApi.reasoning_effort', field: { fieldKey: 'chatReasoningEffort', fieldType: 'select', schemaPath: 'properties.chatReasoningEffort', label: 'Reasoning effort', options: BYTEPLUS_TEXT_WIDGET_REASONING_EFFORT_OPTIONS } },
  { rowKey: 'byteplusApi.frequency_penalty', field: { fieldKey: 'chatFrequencyPenalty', fieldType: 'number', schemaPath: 'properties.chatFrequencyPenalty', label: 'Frequency penalty' } },
  { rowKey: 'byteplusApi.presence_penalty', field: { fieldKey: 'chatPresencePenalty', fieldType: 'number', schemaPath: 'properties.chatPresencePenalty', label: 'Presence penalty' } },
  { rowKey: 'byteplusApi.logprobs', field: { fieldKey: 'chatLogprobs', fieldType: 'boolean', schemaPath: 'properties.chatLogprobs', label: 'Logprobs' } },
  { rowKey: 'byteplusApi.top_logprobs', field: { fieldKey: 'chatTopLogprobs', fieldType: 'number', schemaPath: 'properties.chatTopLogprobs', label: 'Top logprobs' } },
  { rowKey: 'byteplusApi.parallel_tool_calls', field: { fieldKey: 'chatParallelToolCalls', fieldType: 'boolean', schemaPath: 'properties.chatParallelToolCalls', label: 'Parallel tool calls' } },
  { rowKey: 'byteplusApi.stop', field: { fieldKey: 'chatStopJson', fieldType: 'json', schemaPath: 'properties.chatStopJson', label: 'Stop' } },
  { rowKey: 'byteplusApi.stream_options', field: { fieldKey: 'chatStreamOptionsJson', fieldType: 'json', schemaPath: 'properties.chatStreamOptionsJson', label: 'Stream options' } },
  { rowKey: 'byteplusApi.logit_bias', field: { fieldKey: 'chatLogitBiasJson', fieldType: 'json', schemaPath: 'properties.chatLogitBiasJson', label: 'Logit bias' } },
  { rowKey: 'byteplusApi.tools', field: { fieldKey: 'chatToolsJson', fieldType: 'json', schemaPath: 'properties.chatToolsJson', label: 'Tools' } },
  { rowKey: 'byteplusApi.tool_choice', field: { fieldKey: 'chatToolChoiceJson', fieldType: 'json', schemaPath: 'properties.chatToolChoiceJson', label: 'Tool choice' } },
]

const BYTEPLUS_CODEBASE_LOCATION_BY_VALUE_KEY: Readonly<Record<string, CodebaseLocation>> = {
  chatProvider: { modules: ['canvas/src/lib/chatEndpoint.ts', 'canvas/src/lib/chatProviderSelection.ts', 'canvas/src/hooks/store/uiSlice.ts'], classes: ['GraphState'], functions: ['normalizeChatProviderId', 'resolveChatProviderSelectionValues', 'setChatProvider'] },
  chatAuthMode: { modules: ['canvas/src/hooks/store/uiSlice.ts', 'canvas/src/features/settings/registry-ui.ui.ts', 'canvas/src/components/StoryboardWidgetCanvas.tsx'], classes: ['GraphState', 'RunGenerationConfig'], functions: ['setChatAuthMode', 'setChatApiKey', 'generateRunMarkdownWithProvider'] },
  chatEndpointUrl: { modules: ['canvas/src/lib/chatEndpoint.ts', 'canvas/src/lib/chatProviderSelection.ts', 'canvas/src/hooks/store/uiSlice.ts'], classes: ['GraphState', 'RunGenerationConfig'], functions: ['normalizeChatEndpointUrlInput', 'resolveChatProviderSelectionValues', 'resolveChatEndpointForRequest'] },
  chatApiKey: { modules: ['canvas/src/hooks/store/uiSlice.ts', 'canvas/src/features/settings/registry-ui.ui.ts', 'canvas/src/components/StoryboardWidgetCanvas.tsx'], classes: ['GraphState', 'RunGenerationConfig'], functions: ['setChatApiKey', 'setChatAuthMode', 'generateRunMarkdownWithProvider'] },
  chatModel: { modules: ['canvas/src/lib/chatEndpoint.ts', 'canvas/src/hooks/store/uiSlice.ts', 'canvas/src/features/storyboard-widget-manager/registryTemplates.ts'], classes: ['GraphState', 'WidgetRegistryEntry'], functions: ['getDefaultChatModelForProvider', 'normalizeChatModelIdForProvider', 'setChatModel'] },
  chatMessagesJson: { modules: ['canvas/src/features/storyboard-widget-manager/registryTemplates.ts', 'canvas/src/components/StoryboardWidgetCanvas.tsx', 'canvas/src/features/chat/byteplusRunGeneration.ts'], classes: ['WidgetRegistryEntry', 'RunTextGenerationOptions'], functions: ['buildBytePlusTextGenerationFields', 'resolveEffectiveTextGenerationWidgetProperties', 'generateRunMarkdownWithProvider'] },
  chatThinkingJson: { modules: ['canvas/src/features/settings/registry-ui.ui.ts', 'canvas/src/features/chat/floatingPanelChat/floatingPanelChatProviderOptions.ts', 'canvas/src/features/chat/byteplusRunGeneration.ts'], classes: ['GraphState', 'RunTextGenerationOptions'], functions: ['setChatThinkingJson', 'buildProviderChatRequestOptions', 'generateRunMarkdownWithProvider'] },
  chatThinkingType: { modules: ['canvas/src/features/settings/registry-ui.ui.ts', 'canvas/src/features/chat/floatingPanelChat/floatingPanelChatProviderOptions.ts', 'canvas/src/features/chat/byteplusRunGeneration.ts'], classes: ['GraphState', 'RunTextGenerationOptions'], functions: ['setChatThinkingType', 'buildProviderChatRequestOptions', 'generateRunMarkdownWithProvider'] },
  chatStream: { modules: ['canvas/src/features/settings/registry-ui.ui.ts', 'canvas/src/features/chat/floatingPanelChat/floatingPanelChatProviderOptions.ts', 'canvas/src/features/chat/byteplusRunGeneration.ts'], classes: ['GraphState', 'RunTextGenerationOptions'], functions: ['setChatStream', 'buildProviderChatRequestOptions', 'generateRunMarkdownWithProvider'] },
  chatStreamOptionsJson: { modules: ['canvas/src/features/settings/registry-ui.ui.ts', 'canvas/src/features/chat/floatingPanelChat/floatingPanelChatProviderOptions.ts', 'canvas/src/features/chat/byteplusRunGeneration.ts'], classes: ['GraphState', 'RunTextGenerationOptions'], functions: ['setChatStreamOptionsJson', 'buildProviderChatRequestOptions', 'generateRunMarkdownWithProvider'] },
  chatMaxCompletionTokens: { modules: ['canvas/src/features/settings/registry-ui.ui.ts', 'canvas/src/hooks/store/uiSlice.ts', 'canvas/src/features/chat/floatingPanelChat/floatingPanelChatProviderOptions.ts'], classes: ['GraphState', 'RunTextGenerationOptions'], functions: ['setChatMaxCompletionTokens', 'buildProviderChatRequestOptions', 'generateRunMarkdownWithProvider'] },
  chatServiceTier: { modules: ['canvas/src/features/settings/registry-ui.ui.ts', 'canvas/src/hooks/store/uiSlice.ts', 'canvas/src/features/chat/floatingPanelChat/floatingPanelChatProviderOptions.ts'], classes: ['GraphState', 'RunTextGenerationOptions'], functions: ['setChatServiceTier', 'buildProviderChatRequestOptions', 'generateRunMarkdownWithProvider'] },
  chatStopJson: { modules: ['canvas/src/features/settings/registry-ui.ui.ts', 'canvas/src/features/chat/floatingPanelChat/floatingPanelChatProviderOptions.ts', 'canvas/src/features/chat/byteplusRunGeneration.ts'], classes: ['GraphState', 'RunTextGenerationOptions'], functions: ['setChatStopJson', 'buildProviderChatRequestOptions', 'generateRunMarkdownWithProvider'] },
  chatReasoningEffort: { modules: ['canvas/src/features/settings/registry-ui.ui.ts', 'canvas/src/features/chat/floatingPanelChat/floatingPanelChatProviderOptions.ts', 'canvas/src/features/chat/byteplusRunGeneration.ts'], classes: ['GraphState', 'RunTextGenerationOptions'], functions: ['setChatReasoningEffort', 'buildProviderChatRequestOptions', 'generateRunMarkdownWithProvider'] },
  chatResponseFormatJson: { modules: ['canvas/src/features/settings/registry-ui.ui.ts', 'canvas/src/features/chat/floatingPanelChat/floatingPanelChatProviderOptions.ts', 'canvas/src/features/chat/byteplusRunGeneration.ts'], classes: ['GraphState', 'RunTextGenerationOptions'], functions: ['setChatResponseFormatJson', 'buildProviderChatRequestOptions', 'generateRunMarkdownWithProvider'] },
  chatFrequencyPenalty: { modules: ['canvas/src/features/settings/registry-ui.ui.ts', 'canvas/src/features/chat/floatingPanelChat/floatingPanelChatProviderOptions.ts', 'canvas/src/features/chat/byteplusRunGeneration.ts'], classes: ['GraphState', 'RunTextGenerationOptions'], functions: ['setChatFrequencyPenalty', 'buildProviderChatRequestOptions', 'generateRunMarkdownWithProvider'] },
  chatPresencePenalty: { modules: ['canvas/src/features/settings/registry-ui.ui.ts', 'canvas/src/features/chat/floatingPanelChat/floatingPanelChatProviderOptions.ts', 'canvas/src/features/chat/byteplusRunGeneration.ts'], classes: ['GraphState', 'RunTextGenerationOptions'], functions: ['setChatPresencePenalty', 'buildProviderChatRequestOptions', 'generateRunMarkdownWithProvider'] },
  chatTemperature: { modules: ['canvas/src/features/settings/registry-ui.ui.ts', 'canvas/src/features/chat/floatingPanelChat/floatingPanelChatProviderOptions.ts', 'canvas/src/features/chat/byteplusRunGeneration.ts'], classes: ['GraphState', 'RunTextGenerationOptions'], functions: ['setChatTemperature', 'buildProviderChatRequestOptions', 'generateRunMarkdownWithProvider'] },
  chatTopP: { modules: ['canvas/src/features/settings/registry-ui.ui.ts', 'canvas/src/features/chat/floatingPanelChat/floatingPanelChatProviderOptions.ts', 'canvas/src/features/chat/byteplusRunGeneration.ts'], classes: ['GraphState', 'RunTextGenerationOptions'], functions: ['setChatTopP', 'buildProviderChatRequestOptions', 'generateRunMarkdownWithProvider'] },
  chatLogprobs: { modules: ['canvas/src/features/settings/registry-ui.ui.ts', 'canvas/src/features/chat/floatingPanelChat/floatingPanelChatProviderOptions.ts', 'canvas/src/features/chat/byteplusRunGeneration.ts'], classes: ['GraphState', 'RunTextGenerationOptions'], functions: ['setChatLogprobs', 'buildProviderChatRequestOptions', 'generateRunMarkdownWithProvider'] },
  chatTopLogprobs: { modules: ['canvas/src/features/settings/registry-ui.ui.ts', 'canvas/src/features/chat/floatingPanelChat/floatingPanelChatProviderOptions.ts', 'canvas/src/features/chat/byteplusRunGeneration.ts'], classes: ['GraphState', 'RunTextGenerationOptions'], functions: ['setChatTopLogprobs', 'buildProviderChatRequestOptions', 'generateRunMarkdownWithProvider'] },
  chatLogitBiasJson: { modules: ['canvas/src/features/settings/registry-ui.ui.ts', 'canvas/src/features/chat/floatingPanelChat/floatingPanelChatProviderOptions.ts', 'canvas/src/features/chat/byteplusRunGeneration.ts'], classes: ['GraphState', 'RunTextGenerationOptions'], functions: ['setChatLogitBiasJson', 'buildProviderChatRequestOptions', 'generateRunMarkdownWithProvider'] },
  chatToolsJson: { modules: ['canvas/src/features/settings/registry-ui.ui.ts', 'canvas/src/features/chat/floatingPanelChat/floatingPanelChatProviderOptions.ts', 'canvas/src/features/chat/byteplusRunGeneration.ts'], classes: ['GraphState', 'RunTextGenerationOptions'], functions: ['setChatToolsJson', 'buildProviderChatRequestOptions', 'generateRunMarkdownWithProvider'] },
  chatParallelToolCalls: { modules: ['canvas/src/features/settings/registry-ui.ui.ts', 'canvas/src/features/chat/floatingPanelChat/floatingPanelChatProviderOptions.ts', 'canvas/src/features/chat/byteplusRunGeneration.ts'], classes: ['GraphState', 'RunTextGenerationOptions'], functions: ['setChatParallelToolCalls', 'buildProviderChatRequestOptions', 'generateRunMarkdownWithProvider'] },
  chatToolChoiceJson: { modules: ['canvas/src/features/settings/registry-ui.ui.ts', 'canvas/src/features/chat/floatingPanelChat/floatingPanelChatProviderOptions.ts', 'canvas/src/features/chat/byteplusRunGeneration.ts'], classes: ['GraphState', 'RunTextGenerationOptions'], functions: ['setChatToolChoiceJson', 'buildProviderChatRequestOptions', 'generateRunMarkdownWithProvider'] },
}

function normalizeLookupKey(raw: string | undefined): string {
  const trimmed = String(raw || '').trim()
  if (!trimmed) return ''
  if (trimmed.startsWith('properties.')) return trimmed.slice('properties.'.length).trim()
  return trimmed
}

function normalizePortKey(raw: string | undefined): string {
  const trimmed = String(raw || '').trim()
  if (trimmed === 'prompt_in') return 'prompt'
  if (trimmed === 'text_out') return 'output'
  return trimmed
}

function row(input: Omit<BytePlusSharedTextApiDocRow, 'modules' | 'classes' | 'functions'> & Partial<CodebaseLocation>): BytePlusSharedTextApiDocRow {
  const location = (input.valueKey ? BYTEPLUS_CODEBASE_LOCATION_BY_VALUE_KEY[input.valueKey] : undefined) || undefined
  return {
    ...input,
    modules: input.modules || location?.modules,
    classes: input.classes || location?.classes,
    functions: input.functions || location?.functions,
  }
}

export function resolveBytePlusTextWidgetSharedTextApiRowKey(args: {
  schemaPath?: string
  fieldKey?: string
  portKey?: string
}): string | null {
  const candidates = [
    normalizeLookupKey(args.schemaPath),
    String(args.fieldKey || '').trim(),
    normalizePortKey(args.portKey),
  ]
  for (const candidate of candidates) {
    if (!candidate) continue
    const rowKey = BYTEPLUS_TEXT_WIDGET_ROW_KEY_BY_PROPERTY_KEY[candidate]
    if (rowKey) return rowKey
  }
  return null
}

export function buildBytePlusTextGenerationFields(): WidgetRegistryField[] {
  return [
    ...BYTEPLUS_TEXT_WIDGET_FIELD_BINDINGS
      .map(binding => binding.field)
      .filter((field): field is WidgetRegistryField => !!field)
      .map(field => ({ ...field })),
    {
      fieldKey: 'output',
      fieldType: 'textarea',
      schemaPath: 'properties.output',
      label: 'Output',
    },
  ]
}

export const BYTEPLUS_SHARED_TEXT_API_DOC_ROWS: ReadonlyArray<BytePlusSharedTextApiDocRow> = [
  row({ key: 'provider', typeLabel: 'string', value: 'Integration setting. Default byteplus-modelark.', valueKey: 'chatProvider', responsibility: 'Orchestrator -> pin BytePlus provider routing and reconcile its endpoint/model tuple -> prevent a same-provider selection from retaining another provider endpoint.', notes: 'Integration transport setting reused by the Widget Card when configured for BytePlus; reselecting BytePlus repairs tuple drift.', searchHints: ['chatProvider provider profile modelark byteplus tuple invariant'] }),
  row({ key: 'auth_mode', typeLabel: 'string', value: 'Integration setting. serverManaged | byok. Default serverManaged uses server-side Cloudflare/dev proxy secrets; BYOK is an explicit user fallback.', valueKey: 'chatAuthMode', responsibility: 'Orchestrator -> choose server-managed or memory-only BYOK credential flow -> keep auth policy aligned across Integrations and widget runs.', notes: 'Integration transport setting reused by the Widget Card when configured for BytePlus.', searchHints: ['chatAuthMode auth byok serverManaged api key Cloudflare secret'] }),
  row({ key: 'endpoint_url', typeLabel: 'string', value: 'Integration setting. Base URL by region: ap-southeast-1 or eu-west-1.', valueKey: 'chatEndpointUrl', responsibility: 'Transport -> route BytePlus requests to the correct regional ModelArk base URL -> reconcile provider, endpoint, and model as one selection invariant before widget execution.', notes: 'Integration transport setting reused by the Widget Card when configured for BytePlus; known foreign-provider defaults are replaced with the BytePlus regional default.', searchHints: ['chatEndpointUrl base url region ap-southeast-1 eu-west-1 provider tuple'] }),
  row({ key: 'api_key', typeLabel: 'string', value: 'Integration setting. Empty in serverManaged; required only for explicit BYOK fallback.', valueKey: 'chatApiKey', responsibility: 'Credential manager -> hold caller-supplied BytePlus secret in memory only for BYOK runs -> authorize proxied ModelArk requests without leaking into persistent storage.', notes: 'Integration transport setting reused by the Widget Card when configured for BytePlus.', searchHints: ['chatApiKey api key authentication bearer memory-only'] }),
  row({ key: 'model', typeLabel: 'enum', value: 'Required. seed-2-0-mini-260215 | seed-2-0-lite-260228 | seed-2-0-pro-260328 | seed-1-8-251228.', valueKey: 'chatModel', responsibility: 'Model resolver -> choose the target BytePlus text or multimodal model -> keep global defaults, workflow registry drafts, and widget overrides on the same execution model.', searchHints: ['request body required model endpoint id', 'seed-2-0-mini-260215', 'seed-2-0-lite-260228', 'seed-2-0-pro-260328', 'seed-1-8-251228'] }),
  row({ key: 'messages', typeLabel: 'object[]', value: 'Required. Chat history and prompt messages.', valueKey: 'chatMessagesJson', responsibility: 'Prompt builder -> assemble system, user, assistant, and tool turns -> bind widget prompt/dataflow output into the BytePlus request body.', searchHints: ['messages system user assistant tool multimodal'] }),
  row({ key: 'messages.role', typeLabel: 'string', value: 'Required. system | user | assistant | tool.', valueKey: 'chatMessagesJson', responsibility: 'Message orchestrator -> assign the sender role for each message object -> keep dialogue state and tool handoffs interpretable.' }),
  row({ key: 'messages.content', typeLabel: 'string | object[]', value: 'Required for system and user messages; plaintext or multimodal content list.', valueKey: 'chatMessagesJson', responsibility: 'Payload composer -> choose plaintext or multimodal content blocks -> keep message encoding aligned with model capability.' }),
  row({ key: 'messages.content.text', typeLabel: 'string', value: 'Required for text content objects.', valueKey: 'chatMessagesJson', responsibility: 'Prompt writer -> carry the literal text segment inside a multimodal content item -> preserve direct text intent.' }),
  row({ key: 'messages.content.type', typeLabel: 'string', value: 'Required. text | image_url | video_url.', valueKey: 'chatMessagesJson', responsibility: 'Content discriminator -> identify each multimodal payload kind -> route downstream encoding and validation correctly.' }),
  row({ key: 'messages.content.image_url', typeLabel: 'object', value: 'Required for image content.', valueKey: 'chatMessagesJson', responsibility: 'Vision payload builder -> hold image input configuration -> let BytePlus consume visual evidence alongside text.' }),
  row({ key: 'messages.content.image_url.url', typeLabel: 'string', value: 'Required. Image URL or base64-encoded image.', valueKey: 'chatMessagesJson', responsibility: 'Vision payload builder -> supply the concrete image source -> keep image-backed requests runnable.' }),
  row({ key: 'messages.content.image_url.detail', typeLabel: 'string | null', value: 'Optional. low | high | xhigh.', valueKey: 'chatMessagesJson', responsibility: 'Vision controller -> tune image understanding detail -> trade off visual fidelity, token usage, and latency.' }),
  row({ key: 'messages.content.image_url.image_pixel_limit', typeLabel: 'object | null', value: 'Optional. Default null.', valueKey: 'chatMessagesJson', responsibility: 'Resize guard -> constrain image resizing bounds by pixel count -> keep visual payloads within supported limits.' }),
  row({ key: 'messages.content.image_url.image_pixel_limit.max_pixels', typeLabel: 'integer', value: 'Optional. Maximum allowed image pixels.', valueKey: 'chatMessagesJson', responsibility: 'Resize guard -> cap oversized images before inference -> bound visual token cost and request failures.' }),
  row({ key: 'messages.content.image_url.image_pixel_limit.min_pixels', typeLabel: 'integer', value: 'Optional. Minimum allowed image pixels.', valueKey: 'chatMessagesJson', responsibility: 'Resize guard -> upscale undersized images before inference -> preserve minimum image clarity.' }),
  row({ key: 'messages.content.video_url', typeLabel: 'object', value: 'Required for video content.', valueKey: 'chatMessagesJson', responsibility: 'Vision payload builder -> hold video input configuration -> let BytePlus consume temporal evidence alongside text.' }),
  row({ key: 'messages.content.video_url.url', typeLabel: 'string', value: 'Required. Video URL or base64-encoded video.', valueKey: 'chatMessagesJson', responsibility: 'Vision payload builder -> supply the concrete video source -> keep video-backed requests runnable.' }),
  row({ key: 'messages.content.video_url.fps', typeLabel: 'float | null', value: 'Optional. Default 1. Range: 0.2 to 5.', valueKey: 'chatMessagesJson', responsibility: 'Vision controller -> set sampled frames per second for video understanding -> trade off motion sensitivity, token usage, and latency.' }),
  row({ key: 'messages.reasoning_content', typeLabel: 'string', value: 'Optional. Deep-reasoning chain-of-thought content.', valueKey: 'chatMessagesJson', responsibility: 'Conversation state manager -> preserve assistant reasoning traces when supported -> let follow-up turns reuse prior deliberation context.' }),
  row({ key: 'messages.encrypted_content', typeLabel: 'string', value: 'Optional. Encrypted/compressed reasoning content.', valueKey: 'chatMessagesJson', responsibility: 'Conversation state manager -> round-trip encrypted reasoning payloads when supported -> preserve private reasoning state safely.' }),
  row({ key: 'messages.tool_calls', typeLabel: 'object[]', value: 'Optional assistant tool-call history.', valueKey: 'chatMessagesJson', responsibility: 'Tool trace manager -> carry historical tool call records -> let the next request replay prior tool decisions.' }),
  row({ key: 'messages.tool_calls.function', typeLabel: 'object', value: 'Required inside each tool call.', valueKey: 'chatMessagesJson', responsibility: 'Tool trace manager -> describe the invoked function -> preserve callable intent across turns.' }),
  row({ key: 'messages.tool_calls.function.name', typeLabel: 'string', value: 'Required.', valueKey: 'chatMessagesJson', responsibility: 'Tool trace manager -> name the called tool function -> keep tool replay deterministic.' }),
  row({ key: 'messages.tool_calls.function.arguments', typeLabel: 'string', value: 'Required. JSON string.', valueKey: 'chatMessagesJson', responsibility: 'Tool trace manager -> carry model-generated function arguments -> preserve tool-call fidelity.' }),
  row({ key: 'messages.tool_calls.id', typeLabel: 'string', value: 'Required.', valueKey: 'chatMessagesJson', responsibility: 'Tool trace manager -> identify an assistant tool call -> correlate future tool outputs with the originating request.' }),
  row({ key: 'messages.tool_calls.type', typeLabel: 'string', value: 'Required. function.', valueKey: 'chatMessagesJson', responsibility: 'Tool trace manager -> define the tool call kind -> keep replay logic interpretable.' }),
  row({ key: 'messages.tool_call_id', typeLabel: 'string', value: 'Required for tool role messages.', valueKey: 'chatMessagesJson', responsibility: 'Tool trace manager -> associate tool output with the originating tool call -> preserve round-trip integrity.' }),
  row({ key: 'thinking', typeLabel: 'object', value: 'Optional. Default: {"type":"disabled"}.', valueKey: 'chatThinkingJson', responsibility: 'Reasoning controller -> configure deep-thinking mode -> keep widget settings and runtime reasoning policy aligned.' }),
  row({ key: 'thinking.type', typeLabel: 'enum', value: 'Required inside thinking. disabled | enabled.', valueKey: 'chatThinkingType', responsibility: 'Reasoning controller -> define deep-thinking behavior -> trade off deliberation depth, speed, and cost.' }),
  row({ key: 'stream', typeLabel: 'boolean | null', value: 'Optional. Default true.', valueKey: 'chatStream', responsibility: 'Delivery controller -> choose SSE streaming vs one-shot response -> keep widget run UX and request payload behavior aligned.' }),
  row({ key: 'stream_options', typeLabel: 'object | null', value: 'Optional. Default null.', valueKey: 'chatStreamOptionsJson', responsibility: 'Delivery controller -> configure streaming-specific behavior -> surface extra metadata only when streaming is enabled.' }),
  row({ key: 'stream_options.include_usage', typeLabel: 'boolean | null', value: 'Optional. Default false.', valueKey: 'chatStreamOptionsJson', responsibility: 'Delivery controller -> include usage accounting before stream completion -> improve runtime observability for streaming requests.' }),
  row({ key: 'max_tokens', typeLabel: 'integer | null', value: 'Optional. Default 1000.', valueKey: 'chatMaxCompletionTokens', responsibility: 'Budget controller -> cap visible response tokens, excluding reasoning traces -> keep runs bounded and inspectable.' }),
  row({ key: 'max_completion_tokens', typeLabel: 'integer | null', value: 'Optional. Default 1000. Range: 0 to 65536.', valueKey: 'chatMaxCompletionTokens', responsibility: 'Budget controller -> cap total output tokens, including reasoning content -> bound long-running deep-reasoning responses.' }),
  row({ key: 'service_tier', typeLabel: 'string | null', value: 'Optional. Default auto.', valueKey: 'chatServiceTier', responsibility: 'Throughput controller -> choose automatic or explicit TPM guarantee behavior -> keep latency and quota policy aligned.' }),
  row({ key: 'stop', typeLabel: 'string | string[] | null', value: 'Optional. Up to four stop strings.', valueKey: 'chatStopJson', responsibility: 'Termination controller -> stop generation when configured strings appear -> bound irrelevant continuation.' }),
  row({ key: 'reasoning_effort', typeLabel: 'enum', value: 'Optional. Default minimal. minimal | low | medium | high.', valueKey: 'chatReasoningEffort', responsibility: 'Reasoning controller -> choose how much deliberation supported models spend -> trade off cost, latency, and depth.' }),
  row({ key: 'response_format', typeLabel: 'object', value: 'Optional. Default: {"type":"text"}.', valueKey: 'chatResponseFormatJson', responsibility: 'Output contract -> constrain text, JSON object, or JSON schema output -> keep Integrations docs, widget editor JSON, and run dispatch on one schema surface.' }),
  row({ key: 'response_format.type', typeLabel: 'string', value: 'Required inside response_format. text | json_object | json_schema.', valueKey: 'chatResponseFormatJson', responsibility: 'Output contract -> select the response serialization mode -> keep downstream consumers aligned with expected structure.' }),
  row({ key: 'response_format.json_schema', typeLabel: 'object', value: 'Required when type=json_schema.', valueKey: 'chatResponseFormatJson', responsibility: 'Output contract -> define structured JSON-schema output -> keep model responses machine-readable.' }),
  row({ key: 'response_format.json_schema.name', typeLabel: 'string', value: 'Required.', valueKey: 'chatResponseFormatJson', responsibility: 'Output contract -> name the user-defined JSON schema -> preserve schema traceability across runs.' }),
  row({ key: 'response_format.json_schema.description', typeLabel: 'string | null', value: 'Optional.', valueKey: 'chatResponseFormatJson', responsibility: 'Output contract -> describe the structured response purpose -> guide the model toward the intended artifact.' }),
  row({ key: 'response_format.json_schema.schema', typeLabel: 'object', value: 'Required.', valueKey: 'chatResponseFormatJson', responsibility: 'Output contract -> carry the JSON Schema definition -> enforce downstream output shape.' }),
  row({ key: 'response_format.json_schema.strict', typeLabel: 'boolean | null', value: 'Optional. Default false.', valueKey: 'chatResponseFormatJson', responsibility: 'Output contract -> enable strict schema adherence -> reduce drift between generated output and the declared structure.' }),
  row({ key: 'frequency_penalty', typeLabel: 'float | null', value: 'Optional. Default 0. Range: -2.0 to 2.0.', valueKey: 'chatFrequencyPenalty', responsibility: 'Penalty controller -> discourage frequency-based repetition -> reduce duplicate phrasing in generated text.' }),
  row({ key: 'presence_penalty', typeLabel: 'float | null', value: 'Optional. Default 0. Range: -2.0 to 2.0.', valueKey: 'chatPresencePenalty', responsibility: 'Penalty controller -> encourage topic novelty -> push the model away from already-used topics.' }),
  row({ key: 'temperature', typeLabel: 'float | null', value: 'Optional. Default 1. Range: 0 to 2.', valueKey: 'chatTemperature', responsibility: 'Sampler -> tune output randomness -> widen or narrow lexical variation for the shared BytePlus text run path.' }),
  row({ key: 'top_p', typeLabel: 'float | null', value: 'Optional. Default 0.7. Range: 0 to 1.', valueKey: 'chatTopP', responsibility: 'Sampler -> cap nucleus mass -> bound token-choice breadth for the shared BytePlus text run path.' }),
  row({ key: 'logprobs', typeLabel: 'boolean | null', value: 'Optional. Default false.', valueKey: 'chatLogprobs', responsibility: 'Telemetry switch -> request token log probabilities -> expose richer debugging metadata when the model supports it.' }),
  row({ key: 'top_logprobs', typeLabel: 'integer | null', value: 'Optional. Default 0. Range: 0 to 20.', valueKey: 'chatTopLogprobs', responsibility: 'Telemetry switch -> bound how many alternative tokens include logprob metadata -> keep debug payloads inspectable.' }),
  row({ key: 'logit_bias', typeLabel: 'map | null', value: 'Optional. Default null. Token ID -> bias [-100, 100].', valueKey: 'chatLogitBiasJson', responsibility: 'Sampler override -> bias token selection toward or away from specific tokens -> steer outputs without rewriting prompts.' }),
  row({ key: 'tools', typeLabel: 'object[] | null', value: 'Optional. Default null.', valueKey: 'chatToolsJson', responsibility: 'Tool registry -> publish callable tool definitions -> let BytePlus plan against the same schemas authored in Integrations or widget overrides.' }),
  row({ key: 'tools.type', typeLabel: 'string', value: 'Required inside each tool. function.', valueKey: 'chatToolsJson', responsibility: 'Tool registry -> define the tool kind -> keep tool routing explicit.' }),
  row({ key: 'tools.function', typeLabel: 'object', value: 'Required inside each tool.', valueKey: 'chatToolsJson', responsibility: 'Tool registry -> describe a callable function tool -> keep model tool use grounded in declared capabilities.' }),
  row({ key: 'tools.function.name', typeLabel: 'string', value: 'Required.', valueKey: 'chatToolsJson', responsibility: 'Tool registry -> name the callable function -> preserve deterministic tool routing.' }),
  row({ key: 'tools.function.description', typeLabel: 'string', value: 'Optional.', valueKey: 'chatToolsJson', responsibility: 'Tool registry -> explain when a function should be used -> improve model tool-selection quality.' }),
  row({ key: 'tools.function.parameters', typeLabel: 'object', value: 'Optional. JSON Schema object.', valueKey: 'chatToolsJson', responsibility: 'Tool registry -> define function parameters in JSON Schema -> validate tool arguments and reduce hallucinated payloads.' }),
  row({ key: 'parallel_tool_calls', typeLabel: 'boolean', value: 'Optional. Default true.', valueKey: 'chatParallelToolCalls', responsibility: 'Tool scheduler -> allow or forbid concurrent tool execution -> keep orchestration predictable while avoiding duplicate handling logic.' }),
  row({ key: 'tool_choice', typeLabel: 'string | object', value: 'Optional. none | required | auto | explicit function selector.', valueKey: 'chatToolChoiceJson', responsibility: 'Tool planner -> constrain whether tools may or must be used -> keep deterministic tool routing in sync across Integrations and widget overrides.' }),
  row({ key: 'tool_choice.type', typeLabel: 'string', value: 'Required when tool_choice is an object. function.', valueKey: 'chatToolChoiceJson', responsibility: 'Tool planner -> define explicit tool-choice kind -> preserve deterministic routing semantics.' }),
  row({ key: 'tool_choice.function', typeLabel: 'object', value: 'Required when tool_choice is an object.', valueKey: 'chatToolChoiceJson', responsibility: 'Tool planner -> select a specific function tool -> force model routing toward one callable target.' }),
  row({ key: 'tool_choice.function.name', typeLabel: 'string', value: 'Required.', valueKey: 'chatToolChoiceJson', responsibility: 'Tool planner -> name the explicitly selected function tool -> keep forced tool execution deterministic.' }),
]

const BYTEPLUS_DOC_ROW_MAP: ReadonlyMap<string, BytePlusSharedTextApiDocRow> = new Map(
  BYTEPLUS_SHARED_TEXT_API_DOC_ROWS.map(row => [String(row.key || '').trim(), row] as const),
)

export function getBytePlusSharedTextApiDocRowByRowKey(rowKey: string): BytePlusSharedTextApiDocRow | null {
  const normalized = String(rowKey || '').trim()
  if (!normalized) return null
  const key = normalized.startsWith(BYTEPLUS_TEXT_API_PREFIX)
    ? normalized.slice(BYTEPLUS_TEXT_API_PREFIX.length)
    : normalized.startsWith(BYTEPLUS_SHARED_OWNER_PREFIX)
      ? normalized.slice(BYTEPLUS_SHARED_OWNER_PREFIX.length)
      : normalized
  return BYTEPLUS_DOC_ROW_MAP.get(key) || null
}
