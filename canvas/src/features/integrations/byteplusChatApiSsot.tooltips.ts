import { CHAT_BYTEPLUS_TEXT_MODEL_DEFAULT } from '@/lib/chatEndpoint'

export const BYTEPLUS_VALUE_TOOLTIP_BY_ROW_KEY: Readonly<Record<string, {
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
    expansionNote: 'BYOK expands explicit caller-owned credential control.',
    contractionNote: 'Server-managed auth narrows credential handling to Cloudflare/dev proxy secrets.',
  },
  endpoint_url: {
    defaultValue: 'https://ark.ap-southeast.bytepluses.com/api/v3',
    expansionNote: 'Region-specific endpoints expands deployment locality.',
    contractionNote: 'One fixed endpoint narrows regional routing flexibility.',
  },
  api_key: {
    defaultValue: '—',
    expansionNote: 'A memory-only BYOK secret expands explicit caller-authenticated execution.',
    contractionNote: 'No key narrows execution to server-managed auth only.',
  },
  model: {
    defaultValue: CHAT_BYTEPLUS_TEXT_MODEL_DEFAULT,
    expansionNote: 'Switching to larger or more specialized models expands capability coverage.',
    contractionNote: 'Keeping one pinned model narrows drift across Integrations, Workflow Manager, and widget runs.',
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
    defaultValue: 3136,
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
    defaultValue: '{"type":"disabled"}',
    expansionNote: 'Enabled thinking expands reasoning depth.',
    contractionNote: 'Disabled thinking narrows deliberation overhead.',
  },
  'thinking.type': {
    defaultValue: 'disabled',
    expansionNote: 'Enabled thinking expands reasoning coverage.',
    contractionNote: 'Disabled thinking narrows chain-of-thought generation.',
  },
  stream: {
    defaultValue: true,
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
    defaultValue: 1000,
    min: 0,
    interval: 1,
    expansionNote: 'More tokens expands response length.',
    contractionNote: 'Fewer tokens narrows response budget.',
  },
  max_completion_tokens: {
    defaultValue: 1000,
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
    defaultValue: 'minimal',
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
