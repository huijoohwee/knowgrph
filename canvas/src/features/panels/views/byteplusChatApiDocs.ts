import type { FlowDetails, SettingMeta } from '@/features/settings/types'

export const BYTEPLUS_CHAT_API_DOC_AREA = 'BytePlus Chat API'

export function getBytePlusChatApiRowAnchorId(rowKey: string): string {
  const normalized = String(rowKey || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `byteplus-chat-api-row-${normalized || 'entry'}`
}

const BYTEPLUS_TEXT_WIDGET_ROW_KEY_BY_PROPERTY_KEY: Readonly<Record<string, string>> = {
  chatProvider: 'byteplusApi.provider',
  chatAuthMode: 'byteplusApi.auth_mode',
  chatEndpointUrl: 'byteplusApi.endpoint_url',
  chatApiKey: 'byteplusApi.api_key',
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

function normalizeBytePlusTextWidgetLookupKey(raw: string | undefined): string {
  const trimmed = String(raw || '').trim()
  if (!trimmed) return ''
  if (trimmed.startsWith('properties.')) return trimmed.slice('properties.'.length).trim()
  return trimmed
}

function normalizeBytePlusTextWidgetPortKey(raw: string | undefined): string {
  const trimmed = String(raw || '').trim()
  if (trimmed === 'prompt_in') return 'prompt'
  if (trimmed === 'text_out') return 'output'
  return trimmed
}

export function resolveBytePlusTextWidgetChatApiRowKey(args: {
  schemaPath?: string
  fieldKey?: string
  portKey?: string
}): string | null {
  const candidates = [
    normalizeBytePlusTextWidgetLookupKey(args.schemaPath),
    String(args.fieldKey || '').trim(),
    normalizeBytePlusTextWidgetPortKey(args.portKey),
  ]
  for (let i = 0; i < candidates.length; i += 1) {
    const candidate = candidates[i]
    if (!candidate) continue
    const rowKey = BYTEPLUS_TEXT_WIDGET_ROW_KEY_BY_PROPERTY_KEY[candidate]
    if (rowKey) return rowKey
  }
  return null
}

export type VirtualSettingsEntry = {
  meta: SettingMeta
  details: FlowDetails
  value: string | number | boolean
  typeLabel: string
  valueKey?: string
  searchHints?: string[]
  tooltipRole?: string
  tooltipActions?: string[]
  tooltipDefaultValue?: string | number | boolean | null
  tooltipMin?: string | number
  tooltipMax?: string | number
  tooltipInterval?: string | number
  tooltipExpansionNote?: string
  tooltipContractionNote?: string
  tooltipImpact?: string
}

type BytePlusApiDocRow = {
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

const BYTEPLUS_TOOLTIP_ROLE = 'BytePlus Chat API'

const BYTEPLUS_KEY_ACTIONS_BY_VALUE_KEY: Readonly<Record<string, string[]>> = {
  chatProvider: ['select provider profile', 'bind BytePlus request routing'],
  chatAuthMode: ['select auth mode', 'choose credential flow'],
  chatEndpointUrl: ['set regional base URL', 'route API requests'],
  chatApiKey: ['store BYOK secret', 'authorize direct BytePlus calls'],
  chatModel: ['select target model', 'route request execution'],
  chatMessagesJson: ['compose message payload', 'serialize multimodal turns'],
  chatThinkingJson: ['shape thinking payload', 'govern reasoning mode'],
  chatThinkingType: ['set thinking mode', 'toggle deep reasoning'],
  chatStream: ['toggle stream mode', 'choose reply delivery'],
  chatStreamOptionsJson: ['define stream options', 'request usage metadata'],
  chatMaxCompletionTokens: ['cap output budget', 'bound completion length'],
  chatServiceTier: ['select service tier', 'pin throughput policy'],
  chatStopJson: ['define stop sequences', 'terminate generation early'],
  chatReasoningEffort: ['set reasoning effort', 'tune deliberation budget'],
  chatResponseFormatJson: ['define response format', 'constrain reply schema'],
  chatFrequencyPenalty: ['set repetition penalty', 'discourage duplicate tokens'],
  chatPresencePenalty: ['set novelty penalty', 'encourage topic shifts'],
  chatTemperature: ['set sampling temperature', 'control output variability'],
  chatTopP: ['set nucleus threshold', 'limit token sampling'],
  chatLogprobs: ['toggle logprobs output', 'request token probabilities'],
  chatTopLogprobs: ['set top-logprobs count', 'bound token alternatives'],
  chatLogitBiasJson: ['define token biases', 'shape token likelihoods'],
  chatToolsJson: ['declare callable tools', 'publish tool schemas'],
  chatParallelToolCalls: ['toggle parallel calls', 'coordinate tool concurrency'],
  chatToolChoiceJson: ['set tool policy', 'select callable function'],
}

const BYTEPLUS_VALUE_TOOLTIP_BY_ROW_KEY: Readonly<Record<string, {
  defaultValue?: string | number | boolean | null
  min?: string | number
  max?: string | number
  interval?: string | number
  expansionNote?: string
  contractionNote?: string
  impact?: string
}>> = {
  provider: {
    defaultValue: 'byteplus',
    expansionNote: 'BytePlus provider binds the widget to ModelArk routing.',
    contractionNote: 'Switching providers narrows BytePlus-specific behavior reuse.',
  },
  auth_mode: {
    defaultValue: 'serverManaged',
    expansionNote: 'BYOK expands direct caller control.',
    contractionNote: 'Server-managed auth narrows credential handling in the widget.',
  },
  endpoint_url: {
    defaultValue: 'https://ark.ap-southeast.bytepluses.com/api/v3',
    expansionNote: 'Region-specific endpoints expands deployment locality.',
    contractionNote: 'One fixed endpoint narrows regional routing flexibility.',
  },
  api_key: {
    defaultValue: '—',
    expansionNote: 'A BYOK secret expands direct authenticated execution.',
    contractionNote: 'No key narrows execution to server-managed auth only.',
  },
  messages: {
    defaultValue: '—',
    expansionNote: 'More message turns expands context.',
    contractionNote: 'Fewer turns narrows conversational scope.',
  },
  'messages.role': {
    defaultValue: 'system | user | assistant | tool',
    expansionNote: 'More role variants expands orchestration coverage.',
    contractionNote: 'Fewer roles narrows dialogue structure.',
  },
  'messages.content': {
    defaultValue: '—',
    expansionNote: 'Multimodal content expands evidence types.',
    contractionNote: 'Plain text narrows payload complexity.',
  },
  'messages.content.text': {
    defaultValue: '—',
    expansionNote: 'Longer text expands prompt context.',
    contractionNote: 'Shorter text narrows prompt detail.',
  },
  'messages.content.type': {
    defaultValue: 'text',
    expansionNote: 'Image or video types expands modality coverage.',
    contractionNote: 'Text-only narrows the request surface.',
  },
  'messages.content.image_url': {
    defaultValue: 'null',
    expansionNote: 'Image payloads expands visual context.',
    contractionNote: 'No image payload narrows inference to text.',
  },
  'messages.content.image_url.url': {
    defaultValue: '—',
    expansionNote: 'Richer image sources expands visual evidence.',
    contractionNote: 'No image source narrows the message payload.',
  },
  'messages.content.image_url.detail': {
    defaultValue: 'auto',
    expansionNote: 'Higher detail expands image understanding depth.',
    contractionNote: 'Lower detail narrows token use and latency.',
  },
  'messages.content.image_url.image_pixel_limit': {
    defaultValue: 'null',
    expansionNote: 'Wider pixel bounds expands retained image detail.',
    contractionNote: 'Tighter bounds narrows image token cost.',
  },
  'messages.content.image_url.image_pixel_limit.max_pixels': {
    defaultValue: 4014080,
    min: 3136,
    max: 4014080,
    interval: 1,
    expansionNote: 'Higher caps expands retained image resolution.',
    contractionNote: 'Lower caps narrows visual detail and token cost.',
  },
  'messages.content.image_url.image_pixel_limit.min_pixels': {
    defaultValue: 3136,
    min: 3136,
    max: 4014080,
    interval: 1,
    expansionNote: 'Higher floors expands enforced image clarity.',
    contractionNote: 'Lower floors narrows minimum resize work.',
  },
  'messages.content.video_url': {
    defaultValue: 'null',
    expansionNote: 'Video payloads expands temporal context.',
    contractionNote: 'No video payload narrows inference to text or images.',
  },
  'messages.content.video_url.url': {
    defaultValue: '—',
    expansionNote: 'Video sources expands motion evidence.',
    contractionNote: 'No video source narrows the message payload.',
  },
  'messages.content.video_url.fps': {
    defaultValue: 1,
    min: 0.2,
    max: 5,
    interval: 0.1,
    expansionNote: 'More frames expands motion sensitivity.',
    contractionNote: 'Fewer frames narrows detail and token use.',
  },
  'messages.reasoning_content': {
    defaultValue: '—',
    expansionNote: 'Reasoning traces expands recoverable chain details.',
    contractionNote: 'Omitting traces narrows exposed reasoning content.',
  },
  'messages.encrypted_content': {
    defaultValue: '—',
    expansionNote: 'Encrypted traces expands reasoning round-trip support.',
    contractionNote: 'No encrypted trace narrows payload complexity.',
  },
  'messages.tool_calls': {
    defaultValue: 'null',
    expansionNote: 'More tool calls expands callable history.',
    contractionNote: 'Fewer tool calls narrows prior tool context.',
  },
  'messages.tool_calls.function': {
    defaultValue: 'null',
    expansionNote: 'Function descriptors expands tool replay detail.',
    contractionNote: 'No function descriptors narrows tool context.',
  },
  'messages.tool_calls.function.name': {
    defaultValue: '—',
    expansionNote: 'Specific names expands tool replay precision.',
    contractionNote: 'No names narrows callable traceability.',
  },
  'messages.tool_calls.function.arguments': {
    defaultValue: '{}',
    expansionNote: 'Richer arguments expands replay fidelity.',
    contractionNote: 'Lean arguments narrows tool payload scope.',
  },
  'messages.tool_calls.id': {
    defaultValue: '—',
    expansionNote: 'Stable IDs expands tool-output correlation.',
    contractionNote: 'No IDs narrows traceability.',
  },
  'messages.tool_calls.type': {
    defaultValue: 'function',
    expansionNote: 'Function type expands tool replay support.',
    contractionNote: 'No type narrows callable interpretation.',
  },
  'messages.tool_call_id': {
    defaultValue: '—',
    expansionNote: 'Linked IDs expands tool round-trip integrity.',
    contractionNote: 'No link narrows tool-output association.',
  },
  thinking: {
    defaultValue: '{"type":"enabled"}',
    expansionNote: 'Enabled thinking expands reasoning depth.',
    contractionNote: 'Disabled thinking narrows deliberation overhead.',
  },
  'thinking.type': {
    defaultValue: 'enabled',
    expansionNote: 'Enabled or auto expands reasoning coverage.',
    contractionNote: 'Disabled narrows chain-of-thought generation.',
  },
  stream: {
    defaultValue: false,
    expansionNote: 'Streaming expands progressive delivery.',
    contractionNote: 'One-shot responses narrows delivery to a single payload.',
  },
  stream_options: {
    defaultValue: 'null',
    expansionNote: 'Extra stream options expands stream metadata.',
    contractionNote: 'Null narrows the response to core stream events.',
  },
  'stream_options.include_usage': {
    defaultValue: false,
    expansionNote: 'Usage inclusion expands stream accounting detail.',
    contractionNote: 'Disabling narrows stream metadata volume.',
  },
  max_tokens: {
    defaultValue: 4096,
    min: 0,
    interval: 1,
    expansionNote: 'More tokens expands response length.',
    contractionNote: 'Fewer tokens narrows response budget.',
  },
  max_completion_tokens: {
    defaultValue: '—',
    min: 0,
    max: 65536,
    interval: 1,
    expansionNote: 'Higher caps expands answer and reasoning length.',
    contractionNote: 'Lower caps narrows output budget.',
  },
  service_tier: {
    defaultValue: 'auto',
    expansionNote: 'Default pins explicit TPM package use.',
    contractionNote: 'Auto narrows manual throughput control.',
  },
  stop: {
    defaultValue: 'null',
    expansionNote: 'More stop strings expands early-stop triggers.',
    contractionNote: 'Fewer stop strings narrows termination checks.',
  },
  reasoning_effort: {
    defaultValue: 'medium',
    expansionNote: 'Higher effort expands deliberation depth.',
    contractionNote: 'Lower effort narrows reasoning cost and latency.',
  },
  response_format: {
    defaultValue: '{"type":"text"}',
    expansionNote: 'JSON modes expands structure guarantees.',
    contractionNote: 'Text mode narrows output constraints.',
  },
  'response_format.type': {
    defaultValue: 'text',
    expansionNote: 'Schema modes expands machine-readable guarantees.',
    contractionNote: 'Text mode narrows serialization rigidity.',
  },
  'response_format.json_schema': {
    defaultValue: 'null',
    expansionNote: 'Schema payloads expands strict structure control.',
    contractionNote: 'No schema narrows output guarantees.',
  },
  'response_format.json_schema.name': {
    defaultValue: '—',
    expansionNote: 'Named schemas expands artifact traceability.',
    contractionNote: 'Unnamed schemas narrows reuse clarity.',
  },
  'response_format.json_schema.description': {
    defaultValue: 'null',
    expansionNote: 'Descriptions expands schema guidance.',
    contractionNote: 'No description narrows semantic hints.',
  },
  'response_format.json_schema.schema': {
    defaultValue: '{}',
    expansionNote: 'Richer schema rules expands output validation.',
    contractionNote: 'Lean schemas narrows structural constraints.',
  },
  'response_format.json_schema.strict': {
    defaultValue: false,
    expansionNote: 'Strict mode expands schema adherence.',
    contractionNote: 'Relaxed mode narrows enforcement.',
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
  temperature: {
    defaultValue: 1,
    min: 0,
    max: 2,
    interval: 0.1,
    expansionNote: 'Higher temperature expands randomness.',
    contractionNote: 'Lower temperature narrows output variability.',
  },
  top_p: {
    defaultValue: 0.7,
    min: 0,
    max: 1,
    interval: 0.01,
    expansionNote: 'Higher top_p expands candidate token mass.',
    contractionNote: 'Lower top_p narrows sampling breadth.',
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
  logit_bias: {
    defaultValue: 'null',
    min: -100,
    max: 100,
    interval: 1,
    expansionNote: 'More bias rules expands token steering control.',
    contractionNote: 'Fewer bias rules narrows sampling intervention.',
  },
  tools: {
    defaultValue: 'null',
    expansionNote: 'More tool definitions expands callable surface.',
    contractionNote: 'Fewer tools narrows tool-planning choices.',
  },
  'tools.type': {
    defaultValue: 'function',
    expansionNote: 'Function tools expands callable operations.',
    contractionNote: 'No tool type narrows tool routing.',
  },
  'tools.function': {
    defaultValue: 'null',
    expansionNote: 'Richer function specs expands tool invocation precision.',
    contractionNote: 'Lean function specs narrows callable guidance.',
  },
  'tools.function.name': {
    defaultValue: '—',
    expansionNote: 'Specific names expands callable routing.',
    contractionNote: 'No names narrows tool selection clarity.',
  },
  'tools.function.description': {
    defaultValue: 'null',
    expansionNote: 'Longer descriptions expands tool-selection guidance.',
    contractionNote: 'Shorter descriptions narrows semantic hints.',
  },
  'tools.function.parameters': {
    defaultValue: '{}',
    expansionNote: 'Richer schemas expands tool argument validation.',
    contractionNote: 'Lean schemas narrows argument structure.',
  },
  parallel_tool_calls: {
    defaultValue: true,
    expansionNote: 'Parallel calls expands concurrent tool execution.',
    contractionNote: 'Serial calls narrows concurrency.',
  },
  tool_choice: {
    defaultValue: 'auto',
    expansionNote: 'Required or explicit choices expands tool control.',
    contractionNote: 'Auto narrows manual routing pressure.',
  },
  'tool_choice.type': {
    defaultValue: 'function',
    expansionNote: 'Function selection expands explicit routing.',
    contractionNote: 'No explicit type narrows forced selection.',
  },
  'tool_choice.function': {
    defaultValue: 'null',
    expansionNote: 'Explicit function picks expands deterministic routing.',
    contractionNote: 'Auto routing narrows manual pinning.',
  },
  'tool_choice.function.name': {
    defaultValue: '—',
    expansionNote: 'Pinned names expands deterministic tool invocation.',
    contractionNote: 'No pinned name narrows routing constraints.',
  },
}

const BYTEPLUS_CHAT_API_DOC_ROWS: ReadonlyArray<BytePlusApiDocRow> = [
  {
    key: 'provider',
    typeLabel: 'string',
    value: 'Integration setting. Default byteplus.',
    valueKey: 'chatProvider',
    responsibility: 'Pins the widget and integration row set to the BytePlus provider profile.',
    searchHints: ['chatProvider provider profile modelark byteplus'],
    notes: 'Integration transport setting reused by the Text Widget.',
  },
  {
    key: 'auth_mode',
    typeLabel: 'string',
    value: 'Integration setting. serverManaged | byok.',
    valueKey: 'chatAuthMode',
    responsibility: 'Selects server-managed credentials or direct BYOK authentication.',
    searchHints: ['chatAuthMode auth byok serverManaged api key'],
    notes: 'Integration transport setting reused by the Text Widget.',
  },
  {
    key: 'endpoint_url',
    typeLabel: 'string',
    value: 'Integration setting. Base URL by region: ap-southeast-1 or eu-west-1.',
    valueKey: 'chatEndpointUrl',
    responsibility: 'Targets the regional BytePlus ModelArk API base URL for requests.',
    searchHints: ['chatEndpointUrl base url region ap-southeast-1 eu-west-1'],
    notes: 'Integration transport setting reused by the Text Widget.',
  },
  {
    key: 'api_key',
    typeLabel: 'string',
    value: 'Integration setting. Required for BYOK authentication.',
    valueKey: 'chatApiKey',
    responsibility: 'Supplies the caller-managed BytePlus API key when auth mode is BYOK.',
    searchHints: ['chatApiKey api key authentication bearer'],
    notes: 'Integration transport setting reused by the Text Widget.',
  },
  {
    key: 'model',
    typeLabel: 'string',
    value: 'Required. Model ID or endpoint ID.',
    valueKey: 'chatModel',
    responsibility: 'Selects the text or visual-understanding model for the request.',
    searchHints: ['request body required model endpoint id'],
  },
  {
    key: 'messages',
    typeLabel: 'object[]',
    value: 'Required. Chat history and prompt messages.',
    valueKey: 'chatMessagesJson',
    responsibility: 'Carries system, user, assistant, and tool messages.',
    searchHints: ['messages system user assistant tool multimodal'],
  },
  {
    key: 'messages.role',
    typeLabel: 'string',
    value: 'Required. system | user | assistant | tool.',
    valueKey: 'chatMessagesJson',
    responsibility: 'Defines the sender role for each message object.',
  },
  {
    key: 'messages.content',
    typeLabel: 'string | object[]',
    value: 'Required for system and user messages; plaintext or multimodal content list.',
    valueKey: 'chatMessagesJson',
    responsibility: 'Carries text-only or multimodal content.',
  },
  {
    key: 'messages.content.text',
    typeLabel: 'string',
    value: 'Required for text content objects.',
    valueKey: 'chatMessagesJson',
    responsibility: 'Plain text inside a multimodal content item.',
  },
  {
    key: 'messages.content.type',
    typeLabel: 'string',
    value: 'Required. text | image_url | video_url.',
    valueKey: 'chatMessagesJson',
    responsibility: 'Identifies each multimodal content item type.',
  },
  {
    key: 'messages.content.image_url',
    typeLabel: 'object',
    value: 'Required for image content.',
    valueKey: 'chatMessagesJson',
    responsibility: 'Holds image input configuration.',
  },
  {
    key: 'messages.content.image_url.url',
    typeLabel: 'string',
    value: 'Required. Image URL or base64-encoded image.',
    valueKey: 'chatMessagesJson',
    responsibility: 'Supplies the image input source.',
  },
  {
    key: 'messages.content.image_url.detail',
    typeLabel: 'string | null',
    value: 'Optional. low | high | xhigh.',
    valueKey: 'chatMessagesJson',
    responsibility: 'Controls image understanding quality.',
  },
  {
    key: 'messages.content.image_url.image_pixel_limit',
    typeLabel: 'object | null',
    value: 'Optional. Default null.',
    valueKey: 'chatMessagesJson',
    responsibility: 'Constrains image resizing bounds by pixel count.',
  },
  {
    key: 'messages.content.image_url.image_pixel_limit.max_pixels',
    typeLabel: 'integer',
    value: 'Optional. Maximum allowed image pixels.',
    valueKey: 'chatMessagesJson',
    responsibility: 'Caps oversized images before inference.',
  },
  {
    key: 'messages.content.image_url.image_pixel_limit.min_pixels',
    typeLabel: 'integer',
    value: 'Optional. Minimum allowed image pixels.',
    valueKey: 'chatMessagesJson',
    responsibility: 'Upscales undersized images before inference.',
  },
  {
    key: 'messages.content.video_url',
    typeLabel: 'object',
    value: 'Required for video content.',
    valueKey: 'chatMessagesJson',
    responsibility: 'Holds video input configuration.',
  },
  {
    key: 'messages.content.video_url.url',
    typeLabel: 'string',
    value: 'Required. Video URL or base64-encoded video.',
    valueKey: 'chatMessagesJson',
    responsibility: 'Supplies the video input source.',
  },
  {
    key: 'messages.content.video_url.fps',
    typeLabel: 'float | null',
    value: 'Optional. Default 1. Range: 0.2 to 5.',
    valueKey: 'chatMessagesJson',
    responsibility: 'Controls how many frames per second are sampled for video understanding.',
  },
  {
    key: 'messages.reasoning_content',
    typeLabel: 'string',
    value: 'Optional. Deep-reasoning chain-of-thought content.',
    valueKey: 'chatMessagesJson',
    responsibility: 'Returns assistant reasoning when supported by the model.',
  },
  {
    key: 'messages.encrypted_content',
    typeLabel: 'string',
    value: 'Optional. Encrypted/compressed reasoning content.',
    valueKey: 'chatMessagesJson',
    responsibility: 'Round-trips encrypted reasoning payloads when supported.',
  },
  {
    key: 'messages.tool_calls',
    typeLabel: 'object[]',
    value: 'Optional assistant tool-call history.',
    valueKey: 'chatMessagesJson',
    responsibility: 'Carries tool call records generated by the model.',
  },
  {
    key: 'messages.tool_calls.function',
    typeLabel: 'object',
    value: 'Required inside each tool call.',
    valueKey: 'chatMessagesJson',
    responsibility: 'Describes the function invoked by the model.',
  },
  {
    key: 'messages.tool_calls.function.name',
    typeLabel: 'string',
    value: 'Required.',
    valueKey: 'chatMessagesJson',
    responsibility: 'Names the called tool function.',
  },
  {
    key: 'messages.tool_calls.function.arguments',
    typeLabel: 'string',
    value: 'Required. JSON string.',
    valueKey: 'chatMessagesJson',
    responsibility: 'Carries model-generated function arguments.',
  },
  {
    key: 'messages.tool_calls.id',
    typeLabel: 'string',
    value: 'Required.',
    valueKey: 'chatMessagesJson',
    responsibility: 'Identifies an assistant tool call.',
  },
  {
    key: 'messages.tool_calls.type',
    typeLabel: 'string',
    value: 'Required. function.',
    valueKey: 'chatMessagesJson',
    responsibility: 'Defines the tool call kind.',
  },
  {
    key: 'messages.tool_call_id',
    typeLabel: 'string',
    value: 'Required for tool role messages.',
    valueKey: 'chatMessagesJson',
    responsibility: 'Associates tool output with the originating tool call.',
  },
  {
    key: 'thinking',
    typeLabel: 'object',
    value: 'Optional. Default: {"type":"enabled"}.',
    valueKey: 'chatThinkingJson',
    responsibility: 'Controls deep-thinking mode.',
  },
  {
    key: 'thinking.type',
    typeLabel: 'string',
    value: 'Required inside thinking. enabled | disabled | auto.',
    valueKey: 'chatThinkingType',
    responsibility: 'Defines deep-thinking behavior.',
  },
  {
    key: 'stream',
    typeLabel: 'boolean | null',
    value: 'Optional. Default false.',
    valueKey: 'chatStream',
    responsibility: 'Returns the response in SSE streaming mode when true.',
  },
  {
    key: 'stream_options',
    typeLabel: 'object | null',
    value: 'Optional. Default null.',
    valueKey: 'chatStreamOptionsJson',
    responsibility: 'Configures streaming-specific behavior.',
  },
  {
    key: 'stream_options.include_usage',
    typeLabel: 'boolean | null',
    value: 'Optional. Default false.',
    valueKey: 'chatStreamOptionsJson',
    responsibility: 'Returns usage before [DONE] in streaming mode.',
  },
  {
    key: 'max_tokens',
    typeLabel: 'integer | null',
    value: 'Optional. Default 4096.',
    valueKey: 'chatMaxCompletionTokens',
    responsibility: 'Caps response tokens, excluding chain-of-thought.',
  },
  {
    key: 'max_completion_tokens',
    typeLabel: 'integer | null',
    value: 'Optional. Range: 0 to 65536.',
    valueKey: 'chatMaxCompletionTokens',
    responsibility: 'Caps total output tokens, including reasoning content.',
  },
  {
    key: 'service_tier',
    typeLabel: 'string | null',
    value: 'Optional. Default auto.',
    valueKey: 'chatServiceTier',
    responsibility: 'Chooses automatic or default TPM guarantee usage.',
  },
  {
    key: 'stop',
    typeLabel: 'string | string[] | null',
    value: 'Optional. Up to four stop strings.',
    valueKey: 'chatStopJson',
    responsibility: 'Stops generation when the model hits configured strings.',
  },
  {
    key: 'reasoning_effort',
    typeLabel: 'string | null',
    value: 'Optional. Default medium. minimal | low | medium | high.',
    valueKey: 'chatReasoningEffort',
    responsibility: 'Controls deep-reasoning effort.',
  },
  {
    key: 'response_format',
    typeLabel: 'object',
    value: 'Optional. Default: {"type":"text"}.',
    valueKey: 'chatResponseFormatJson',
    responsibility: 'Controls text, JSON object, or JSON schema output.',
  },
  {
    key: 'response_format.type',
    typeLabel: 'string',
    value: 'Required inside response_format. text | json_object | json_schema.',
    valueKey: 'chatResponseFormatJson',
    responsibility: 'Selects the response serialization mode.',
  },
  {
    key: 'response_format.json_schema',
    typeLabel: 'object',
    value: 'Required when type=json_schema.',
    valueKey: 'chatResponseFormatJson',
    responsibility: 'Defines structured JSON schema output.',
  },
  {
    key: 'response_format.json_schema.name',
    typeLabel: 'string',
    value: 'Required.',
    valueKey: 'chatResponseFormatJson',
    responsibility: 'Names the user-defined JSON schema.',
  },
  {
    key: 'response_format.json_schema.description',
    typeLabel: 'string | null',
    value: 'Optional.',
    valueKey: 'chatResponseFormatJson',
    responsibility: 'Describes the structured response purpose.',
  },
  {
    key: 'response_format.json_schema.schema',
    typeLabel: 'object',
    value: 'Required.',
    valueKey: 'chatResponseFormatJson',
    responsibility: 'Carries the JSON Schema definition.',
  },
  {
    key: 'response_format.json_schema.strict',
    typeLabel: 'boolean | null',
    value: 'Optional. Default false.',
    valueKey: 'chatResponseFormatJson',
    responsibility: 'Enables strict schema adherence.',
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
    key: 'temperature',
    typeLabel: 'float | null',
    value: 'Optional. Default 1. Range: 0 to 2.',
    valueKey: 'chatTemperature',
    responsibility: 'Controls sampling randomness.',
  },
  {
    key: 'top_p',
    typeLabel: 'float | null',
    value: 'Optional. Default 0.7. Range: 0 to 1.',
    valueKey: 'chatTopP',
    responsibility: 'Controls nucleus sampling.',
  },
  {
    key: 'logprobs',
    typeLabel: 'boolean | null',
    value: 'Optional. Default false.',
    valueKey: 'chatLogprobs',
    responsibility: 'Returns token log probabilities when supported.',
  },
  {
    key: 'top_logprobs',
    typeLabel: 'integer | null',
    value: 'Optional. Default 0. Range: 0 to 20.',
    valueKey: 'chatTopLogprobs',
    responsibility: 'Controls how many top token logprobs to return.',
  },
  {
    key: 'logit_bias',
    typeLabel: 'map | null',
    value: 'Optional. Default null. Token ID -> bias [-100, 100].',
    valueKey: 'chatLogitBiasJson',
    responsibility: 'Biases token selection toward or away from specific tokens.',
  },
  {
    key: 'tools',
    typeLabel: 'object[] | null',
    value: 'Optional. Default null.',
    valueKey: 'chatToolsJson',
    responsibility: 'Declares callable tools for model tool use.',
  },
  {
    key: 'tools.type',
    typeLabel: 'string',
    value: 'Required inside each tool. function.',
    valueKey: 'chatToolsJson',
    responsibility: 'Defines tool kind.',
  },
  {
    key: 'tools.function',
    typeLabel: 'object',
    value: 'Required inside each tool.',
    valueKey: 'chatToolsJson',
    responsibility: 'Describes a callable function tool.',
  },
  {
    key: 'tools.function.name',
    typeLabel: 'string',
    value: 'Required.',
    valueKey: 'chatToolsJson',
    responsibility: 'Names the callable function tool.',
  },
  {
    key: 'tools.function.description',
    typeLabel: 'string',
    value: 'Optional.',
    valueKey: 'chatToolsJson',
    responsibility: 'Helps the model decide when to call the tool.',
  },
  {
    key: 'tools.function.parameters',
    typeLabel: 'object',
    value: 'Optional. JSON Schema object.',
    valueKey: 'chatToolsJson',
    responsibility: 'Defines function parameters in JSON Schema.',
  },
  {
    key: 'parallel_tool_calls',
    typeLabel: 'boolean',
    value: 'Optional. Default true.',
    valueKey: 'chatParallelToolCalls',
    responsibility: 'Allows multiple tool calls in one model response.',
  },
  {
    key: 'tool_choice',
    typeLabel: 'string | object',
    value: 'Optional. none | required | auto | explicit function selector.',
    valueKey: 'chatToolChoiceJson',
    responsibility: 'Controls whether tools may or must be used.',
  },
  {
    key: 'tool_choice.type',
    typeLabel: 'string',
    value: 'Required when tool_choice is an object. function.',
    valueKey: 'chatToolChoiceJson',
    responsibility: 'Defines explicit tool-choice kind.',
  },
  {
    key: 'tool_choice.function',
    typeLabel: 'object',
    value: 'Required when tool_choice is an object.',
    valueKey: 'chatToolChoiceJson',
    responsibility: 'Selects a specific function tool.',
  },
  {
    key: 'tool_choice.function.name',
    typeLabel: 'string',
    value: 'Required.',
    valueKey: 'chatToolChoiceJson',
    responsibility: 'Names the explicitly selected function tool.',
  },
]

const toBaseType = (typeLabel: string): SettingMeta['type'] => {
  const normalized = String(typeLabel || '').trim().toLowerCase()
  if (normalized.includes('boolean')) return 'boolean'
  if (normalized.includes('integer') || normalized.includes('float') || normalized.includes('number')) return 'number'
  return 'string'
}

export const BYTEPLUS_CHAT_API_REQUEST_DOC_ENTRIES: ReadonlyArray<VirtualSettingsEntry> =
  BYTEPLUS_CHAT_API_DOC_ROWS.map(row => ({
    meta: {
      key: `byteplusApi.${row.key}`,
      type: toBaseType(row.typeLabel),
      source: 'backendEnv',
      read: () => row.value,
    },
    value: row.value,
    valueKey: row.valueKey,
    typeLabel: row.typeLabel,
    tooltipRole: row.valueKey ? BYTEPLUS_TOOLTIP_ROLE : undefined,
    tooltipActions: row.valueKey ? BYTEPLUS_KEY_ACTIONS_BY_VALUE_KEY[row.valueKey] : undefined,
    tooltipDefaultValue: typeof row.tooltipDefaultValue !== 'undefined'
      ? row.tooltipDefaultValue
      : BYTEPLUS_VALUE_TOOLTIP_BY_ROW_KEY[row.key]?.defaultValue,
    tooltipMin: typeof row.tooltipMin !== 'undefined'
      ? row.tooltipMin
      : BYTEPLUS_VALUE_TOOLTIP_BY_ROW_KEY[row.key]?.min,
    tooltipMax: typeof row.tooltipMax !== 'undefined'
      ? row.tooltipMax
      : BYTEPLUS_VALUE_TOOLTIP_BY_ROW_KEY[row.key]?.max,
    tooltipInterval: typeof row.tooltipInterval !== 'undefined'
      ? row.tooltipInterval
      : BYTEPLUS_VALUE_TOOLTIP_BY_ROW_KEY[row.key]?.interval,
    tooltipExpansionNote: row.tooltipExpansionNote || BYTEPLUS_VALUE_TOOLTIP_BY_ROW_KEY[row.key]?.expansionNote,
    tooltipContractionNote: row.tooltipContractionNote || BYTEPLUS_VALUE_TOOLTIP_BY_ROW_KEY[row.key]?.contractionNote,
    tooltipImpact: row.tooltipImpact || BYTEPLUS_VALUE_TOOLTIP_BY_ROW_KEY[row.key]?.impact,
    searchHints: [
      'byteplus modelark chat api request parameters',
      row.key,
      ...(row.searchHints || []),
    ],
    details: {
      area: BYTEPLUS_CHAT_API_DOC_AREA,
      responsibility: row.responsibility,
      notes: row.notes || '',
      modules: ['POST /api/v3/chat/completions'],
      classes: ['Request body'],
      functions: ['ModelArk Chat API'],
    },
  }))
