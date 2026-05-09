export type OpenAiImagesApiDocRow = {
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

export const OPENAI_IMAGES_API_DOC_ROWS: ReadonlyArray<OpenAiImagesApiDocRow> = [
  {
    key: 'provider',
    typeLabel: 'string',
    value: 'openai',
    responsibility: 'Provider pin -> keep OpenAI Images API rows bound to the OpenAI provider family.',
    tooltipDefaultValue: 'openai',
    modules: ['canvas/src/features/panels/views/useSettingsView.ts'],
    classes: ['VirtualSettingsEntry'],
    functions: ['resolveIntegrationEntryMeta'],
  },
  {
    key: 'auth_mode',
    typeLabel: 'string',
    value: 'serverManaged',
    valueKey: 'chatAuthMode',
    responsibility: 'Auth mode selector -> reuse shared OpenAI credential policy for image requests.',
    tooltipDefaultValue: 'serverManaged',
    searchHints: ['openai image auth mode byok server-managed'],
    modules: ['canvas/src/hooks/store/uiSlice.ts', 'canvas/src/features/settings/registry-ui.ui.ts'],
    classes: ['GraphState'],
    functions: ['setChatAuthMode'],
  },
  {
    key: 'api_key',
    typeLabel: 'string',
    value: '',
    valueKey: 'chatApiKey',
    responsibility: 'Credential input -> reuse shared OpenAI BYOK secret for image generation.',
    tooltipDefaultValue: '',
    searchHints: ['openai image api key credential'],
    modules: ['canvas/src/hooks/store/uiSlice.ts', 'canvas/src/features/settings/registry-ui.ui.ts'],
    classes: ['GraphState'],
    functions: ['setChatApiKey'],
  },
  {
    key: 'endpoint',
    typeLabel: 'string',
    value: 'POST /images/generations',
    responsibility: 'Endpoint reference -> send image creation requests to OpenAI images generations route.',
    searchHints: ['openai images generations endpoint'],
    modules: ['docs/documents/knowgrph-api-reference/api-reference-index_202604261230/openai-images-api-reference-index.md'],
    classes: ['Request body'],
    functions: ['POST /images/generations'],
  },
  {
    key: 'model',
    typeLabel: 'string',
    value: 'gpt-image-1.5',
    responsibility: 'Model selector -> choose the OpenAI image model for generation.',
    tooltipDefaultValue: 'gpt-image-1.5',
    searchHints: ['gpt-image-1.5 dall-e-3 dall-e-2 model'],
    modules: ['docs/documents/knowgrph-api-reference/api-reference-index_202604261230/openai-images-api-reference-index.md'],
    classes: ['ImageModel'],
    functions: ['Create image'],
  },
  {
    key: 'prompt',
    typeLabel: 'string',
    value: '',
    responsibility: 'Prompt input -> describe the target image content.',
    tooltipDefaultValue: '',
    searchHints: ['prompt image description'],
    modules: ['docs/documents/knowgrph-api-reference/api-reference-index_202604261230/openai-images-api-reference-index.md'],
    classes: ['Request body'],
    functions: ['Create image'],
  },
  {
    key: 'size',
    typeLabel: 'string',
    value: '1024x1024',
    responsibility: 'Size selector -> control output dimensions for generated image.',
    tooltipDefaultValue: '1024x1024',
    searchHints: ['size 1024x1024 1536x1024 1024x1536'],
  },
  {
    key: 'quality',
    typeLabel: 'string',
    value: 'auto',
    responsibility: 'Quality selector -> tune image fidelity against cost/latency.',
    tooltipDefaultValue: 'auto',
    searchHints: ['quality auto low medium high standard hd'],
  },
  {
    key: 'background',
    typeLabel: 'string',
    value: 'auto',
    responsibility: 'Background mode -> choose transparent/opaque/auto background behavior.',
    tooltipDefaultValue: 'auto',
    searchHints: ['background transparent opaque auto'],
  },
  {
    key: 'output_format',
    typeLabel: 'string',
    value: 'png',
    responsibility: 'Output encoder -> choose generated image format.',
    tooltipDefaultValue: 'png',
    searchHints: ['output format png jpeg webp'],
  },
  {
    key: 'response_format',
    typeLabel: 'string',
    value: 'url',
    responsibility: 'Response transport -> choose url or base64 JSON return mode for dall-e.',
    tooltipDefaultValue: 'url',
    searchHints: ['response format url b64_json'],
  },
  {
    key: 'n',
    typeLabel: 'integer',
    value: '1',
    responsibility: 'Count control -> set number of images to generate per request.',
    tooltipDefaultValue: 1,
    tooltipMin: 1,
    tooltipMax: 10,
    tooltipInterval: 1,
    searchHints: ['n count image outputs'],
  },
  {
    key: 'moderation',
    typeLabel: 'string',
    value: 'auto',
    responsibility: 'Moderation mode -> choose low or auto moderation policy for GPT image models.',
    tooltipDefaultValue: 'auto',
    searchHints: ['moderation low auto'],
  },
  {
    key: 'stream',
    typeLabel: 'boolean',
    value: 'false',
    responsibility: 'Streaming toggle -> enable partial image events for GPT image models.',
    tooltipDefaultValue: false,
    searchHints: ['stream partial images'],
  },
  {
    key: 'partial_images',
    typeLabel: 'integer',
    value: '0',
    responsibility: 'Partial frame count -> configure number of partial images in streaming mode.',
    tooltipDefaultValue: 0,
    tooltipMin: 0,
    tooltipMax: 3,
    tooltipInterval: 1,
    searchHints: ['partial images streaming'],
  },
  {
    key: 'output_compression',
    typeLabel: 'integer',
    value: '100',
    responsibility: 'Compression level -> tune JPEG/WebP compression percentage for GPT image output.',
    tooltipDefaultValue: 100,
    tooltipMin: 0,
    tooltipMax: 100,
    tooltipInterval: 1,
    searchHints: ['output compression jpeg webp'],
  },
  {
    key: 'style',
    typeLabel: 'string',
    value: 'vivid',
    responsibility: 'Style selector -> pick vivid or natural style for dall-e-3 generation.',
    tooltipDefaultValue: 'vivid',
    searchHints: ['style vivid natural dalle-3'],
  },
  {
    key: 'user',
    typeLabel: 'string',
    value: '',
    responsibility: 'End-user identifier -> pass caller user id for safety telemetry.',
    tooltipDefaultValue: '',
    searchHints: ['end-user id abuse monitoring'],
  },
]

export const OPENAI_IMAGES_KEY_ACTIONS_BY_VALUE_KEY: Readonly<Record<string, string[]>> = {
  chatAuthMode: ['select auth mode', 'choose image credential flow'],
  chatApiKey: ['store API secret', 'authorize BYOK image requests'],
}

export const OPENAI_IMAGES_VALUE_TOOLTIP_BY_ROW_KEY: Readonly<Record<string, {
  defaultValue?: string | number | boolean | null
  min?: string | number
  max?: string | number
  interval?: string | number
  expansionNote?: string
  contractionNote?: string
  impact?: string
}>> = {
  provider: { defaultValue: 'openai' },
  auth_mode: { defaultValue: 'serverManaged' },
  api_key: { defaultValue: '' },
  model: { defaultValue: 'gpt-image-1.5' },
  prompt: { defaultValue: '' },
  size: { defaultValue: '1024x1024' },
  quality: { defaultValue: 'auto' },
  background: { defaultValue: 'auto' },
  output_format: { defaultValue: 'png' },
  response_format: { defaultValue: 'url' },
  n: { defaultValue: 1, min: 1, max: 10, interval: 1 },
  moderation: { defaultValue: 'auto' },
  stream: { defaultValue: false },
  partial_images: { defaultValue: 0, min: 0, max: 3, interval: 1 },
  output_compression: { defaultValue: 100, min: 0, max: 100, interval: 1 },
  style: { defaultValue: 'vivid' },
  user: { defaultValue: '' },
}
