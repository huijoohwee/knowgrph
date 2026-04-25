import type { FlowDetails, SettingMeta } from '@/features/settings/types'
import type { WidgetRegistryField } from '@/features/flow-editor-manager/widgetRegistryTypes'
import {
  FLOW_EDITOR_ASPECT_RATIO_OPTIONS,
  FLOW_EDITOR_DURATION_SECONDS_OPTIONS,
  FLOW_EDITOR_RESOLUTION_OPTIONS,
  FLOW_EDITOR_VIDEO_MODEL_OPTIONS,
} from '@/lib/config.flow-editor'
import { CHAT_BYTEPLUS_VIDEO_MODEL_DEFAULT } from '@/lib/chatEndpoint'

export type BytePlusVideoApiDocRow = {
  key: string
  typeLabel: string
  value: string
  responsibility: string
  keyDescription: string
  valueDescription: string
  ssot: string
  module: string[]
  className: string[]
  functionName: string[]
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

export type BytePlusVideoVirtualSettingsEntry = {
  meta: {
    key: string
    type: SettingMeta['type']
    source: 'backendEnv'
    read: () => string
  }
  value: string
  valueKey?: string
  typeLabel: string
  tooltipRole?: string
  tooltipActions?: string[]
  tooltipDefaultValue?: string | number | boolean | null
  tooltipMin?: string | number
  tooltipMax?: string | number
  tooltipInterval?: string | number
  tooltipExpansionNote?: string
  tooltipContractionNote?: string
  tooltipImpact?: string
  searchHints?: string[]
  details: FlowDetails
}

export const BYTEPLUS_VIDEO_GENERATION_API_DOC_AREA = 'BytePlus Video Generation API'
export const BYTEPLUS_VIDEO_GENERATION_API_DOCS_URL = 'https://api.byteplus.com/api-explorer/?action=CreateContentsGenerationsTasks&groupName=Video%20Generation%20API&serviceCode=ark&version=2024-01-01'
const BYTEPLUS_VIDEO_TOOLTIP_ROLE = 'BytePlus Video Generation API'

export function getBytePlusVideoGenerationApiRowAnchorId(rowKey: string): string {
  const normalized = String(rowKey || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `byteplus-video-generation-api-row-${normalized || 'entry'}`
}

export const BYTEPLUS_VIDEO_GENERATION_MAPPED_VALUE_KEYS = [
  'chatAuthMode',
  'chatApiKey',
  'byteplusVideoModel',
  'byteplusVideoContentJson',
  'byteplusVideoResolution',
  'byteplusVideoAspectRatio',
  'byteplusVideoDuration',
  'byteplusVideoGenerateAudio',
  'byteplusVideoFast',
  'byteplusVideoWatermark',
] as const

export const BYTEPLUS_VIDEO_KEY_ACTIONS_BY_VALUE_KEY: Readonly<Record<string, string[]>> = {
  chatAuthMode: ['select auth mode', 'choose credential flow'],
  chatApiKey: ['store BYOK secret', 'authorize direct BytePlus video calls'],
  byteplusVideoModel: ['select video model', 'pin video default'],
  byteplusVideoContentJson: ['edit content override', 'pin multimodal request payload'],
  byteplusVideoResolution: ['select resolution', 'pin output clarity'],
  byteplusVideoAspectRatio: ['select aspect ratio', 'pin frame geometry'],
  byteplusVideoDuration: ['set duration', 'bound run length'],
  byteplusVideoGenerateAudio: ['toggle audio generation', 'control synchronized sound'],
  byteplusVideoFast: ['prefer fast variant', 'bias fast model resolution'],
  byteplusVideoWatermark: ['toggle watermark', 'control output marking'],
}

function toBaseType(typeLabel: string): SettingMeta['type'] {
  const normalized = String(typeLabel || '').trim().toLowerCase()
  if (normalized.includes('boolean')) return 'boolean'
  if (normalized.includes('integer') || normalized.includes('float') || normalized.includes('number')) return 'number'
  if (normalized.includes('object') || normalized.includes('[]')) return 'json'
  return 'string'
}

function buildDetailNotes(row: BytePlusVideoApiDocRow): string {
  return String(row.notes || '').trim()
}

function buildFieldOptionLabels(options: ReadonlyArray<{ value: string | number; label: string }>): WidgetRegistryField['options'] {
  return options.map(option => ({
    value: option.value,
    label: option.label,
  }))
}

export const BYTEPLUS_VIDEO_GENERATION_DOC_ROWS: ReadonlyArray<BytePlusVideoApiDocRow> = [
  {
    key: 'api_key',
    typeLabel: 'string',
    value: 'Integration setting. Required for BYOK authentication.',
    keyDescription: 'Credential bridge -> supply the caller-managed BytePlus secret -> authorize direct BytePlus video requests when BYOK is enabled.',
    valueDescription: 'Default: empty; BYOK keys expand direct caller-managed execution; leaving it empty narrows video runs to server-managed credentials.',
    ssot: `${BYTEPLUS_VIDEO_GENERATION_API_DOCS_URL} :: Authentication`,
    module: ['canvas/src/features/settings/registry-ui.ui.ts', 'canvas/src/features/panels/views/byteplusVideoGenerationApiDocs.ts'],
    className: ['SettingsRegistryItem'],
    functionName: ['setChatApiKey'],
    valueKey: 'chatApiKey',
    responsibility: 'Supplies the caller-managed BytePlus API key when auth mode is BYOK.',
    searchHints: ['api key authentication bearer x-kg-chat-api-key video generation'],
    tooltipDefaultValue: '',
    tooltipExpansionNote: 'A valid BYOK secret expands direct BytePlus video execution.',
    tooltipContractionNote: 'No key narrows video execution to server-managed credentials.',
    notes: 'Never paste production keys into shared workspaces; prefer server-managed auth when possible.',
  },
  {
    key: 'auth_mode',
    typeLabel: 'string',
    value: 'Integration setting. serverManaged | byok.',
    keyDescription: 'Credential router -> choose server-managed or BYOK auth -> decide which trust boundary owns BytePlus video requests.',
    valueDescription: 'Default: serverManaged; Switching to byok expands caller-owned routing; keeping serverManaged narrows auth handling to the shared backend path.',
    ssot: `${BYTEPLUS_VIDEO_GENERATION_API_DOCS_URL} :: Authentication`,
    module: ['canvas/src/features/settings/registry-ui.ui.ts', 'canvas/src/features/panels/views/byteplusVideoGenerationApiDocs.ts'],
    className: ['SettingsRegistryItem'],
    functionName: ['setChatAuthMode'],
    valueKey: 'chatAuthMode',
    responsibility: 'Selects server-managed credentials or direct BYOK authentication for BytePlus video generation.',
    searchHints: ['auth byok serverManaged api key video generation'],
    tooltipDefaultValue: 'serverManaged',
    tooltipExpansionNote: 'BYOK expands per-user credential control.',
    tooltipContractionNote: 'Server-managed narrows credential handling to the shared backend.',
    notes: 'Video generation uses BytePlus routing regardless of the global chat provider.',
  },
  {
    key: 'byteplusVideoContentJson',
    typeLabel: 'json',
    value: 'Optional. Integration-level content override array.',
    keyDescription: 'Multimodal override payload -> provide an explicit upstream content array -> replace the widget-built prompt/reference-image content when you need exact text/image/video/audio items.',
    valueDescription: 'Default: empty; Supplying JSON expands exact multimodal control; leaving it empty narrows the request to the shared prompt + optional reference image builder.',
    ssot: `${BYTEPLUS_VIDEO_GENERATION_API_DOCS_URL} :: Request body > content`,
    module: ['canvas/src/features/settings/registry-ui.ui.ts', 'canvas/src/features/chat/byteplusRunGeneration.ts'],
    className: ['SettingsRegistryItem', 'RunVideoGenerationOptions'],
    functionName: ['readBytePlusVideoWidgetDefaults', 'generateRunVideoWithBytePlus'],
    valueKey: 'byteplusVideoContentJson',
    responsibility: 'Stores an optional JSON override for the upstream content array sent to BytePlus.',
    searchHints: ['content json multimodal override text image video audio reference'],
    tooltipDefaultValue: '',
    tooltipExpansionNote: 'Explicit JSON expands full multimodal request control, including reference audio/video items.',
    tooltipContractionNote: 'Empty content JSON narrows the request to the shared prompt builder.',
    notes: 'When present, this overrides the prompt + reference-image derived content array.',
  },
  {
    key: 'byteplusVideoFast',
    typeLabel: 'boolean',
    value: 'Optional. Default false.',
    keyDescription: 'Model resolver hint -> prefer the faster variant of the selected Seedance family when available -> bias task dispatch toward lower-latency models without changing the widget surface.',
    valueDescription: 'Default: false; Enabling fast expands model-resolution fallback toward fast variants; disabling it narrows dispatch to the pinned non-fast family.',
    ssot: 'App SSOT :: byteplus video model resolver',
    module: ['canvas/src/features/settings/registry-ui.ui.ts', 'canvas/src/features/chat/byteplusRunGeneration.ts', 'canvas/src/features/panels/views/useSettingsView.ts'],
    className: ['SettingsRegistryItem', 'RunVideoGenerationOptions'],
    functionName: ['readBytePlusVideoWidgetDefaults', 'resolveGenerationModelPreview', 'resolveBytePlusVideoPreviewModelLabel'],
    valueKey: 'byteplusVideoFast',
    responsibility: 'Hints the model resolver to prefer fast Seedance video variants when the family supports them.',
    searchHints: ['fast seedance quick variant video generation'],
    tooltipDefaultValue: false,
    tooltipExpansionNote: 'Fast mode expands selection toward lower-latency variants.',
    tooltipContractionNote: 'Disabling fast narrows dispatch to the pinned non-fast family.',
  },
  {
    key: 'byteplusVideoModel',
    typeLabel: 'string',
    value: 'Required. Video model ID.',
    keyDescription: 'Model selector -> pick the BytePlus video engine -> decide which Seedance capability family executes the generation task.',
    valueDescription: `Default: ${CHAT_BYTEPLUS_VIDEO_MODEL_DEFAULT}; Curated higher-tier models expand multimodal coverage and audio support; pinning one model narrows drift across Integrations, Workflow Manager, and widget runs.`,
    ssot: `${BYTEPLUS_VIDEO_GENERATION_API_DOCS_URL} :: Request body > model`,
    module: ['canvas/src/features/settings/registry-ui.ui.ts', 'canvas/src/features/chat/byteplusRunGeneration.ts', 'canvas/src/features/flow-editor-manager/registryTemplates.ts'],
    className: ['SettingsRegistryItem', 'RunVideoGenerationOptions', 'WidgetRegistryEntry'],
    functionName: ['readBytePlusVideoWidgetDefaults', 'generateRunVideoWithBytePlus', 'buildBytePlusVideoGenerationFields'],
    valueKey: 'byteplusVideoModel',
    responsibility: 'Selects the BytePlus ModelArk video generation model used for the task.',
    searchHints: ['model byteplus video seedance dreamina byteplus video widget integrations byteplusVideoApi.model'],
    tooltipDefaultValue: CHAT_BYTEPLUS_VIDEO_MODEL_DEFAULT,
    tooltipExpansionNote: 'Higher-tier curated models expand multimodal input and audio support.',
    tooltipContractionNote: 'Keeping one pinned model narrows drift and activation surprises.',
    notes: 'Request body field: `model`.',
  },
  {
    key: 'byteplusVideoAspectRatio',
    typeLabel: 'string',
    value: 'Optional. Default landscape -> upstream `ratio` mapping.',
    keyDescription: 'Frame-shape selector -> pick the layout geometry -> map widget-friendly aspect names into the BytePlus `ratio` field sent to the task API.',
    valueDescription: 'Default: landscape; Options: landscape | portrait | square; Wider frames expand cinematic horizontal space; portrait and square narrow canvas shape to vertical or symmetric framing.',
    ssot: `${BYTEPLUS_VIDEO_GENERATION_API_DOCS_URL} :: Request body > ratio`,
    module: ['canvas/src/features/settings/registry-ui.ui.ts', 'canvas/src/features/chat/byteplusRunGeneration.ts'],
    className: ['SettingsRegistryItem', 'RunVideoGenerationOptions'],
    functionName: ['readBytePlusVideoWidgetDefaults', 'mapAspectRatioToVideoRatio'],
    valueKey: 'byteplusVideoAspectRatio',
    responsibility: 'Controls the widget aspect-ratio preset that knowgrph maps into the upstream BytePlus `ratio` string.',
    searchHints: ['ratio aspect 16:9 9:16 1:1 landscape portrait square'],
    tooltipDefaultValue: 'landscape',
    tooltipExpansionNote: 'Landscape expands horizontal composition space.',
    tooltipContractionNote: 'Portrait and square narrow canvas geometry around vertical or centered framing.',
  },
  {
    key: 'byteplusVideoDuration',
    typeLabel: 'integer',
    value: 'Optional. Default 5 seconds.',
    keyDescription: 'Run-length cap -> bound the target video length -> control generation time, task cost, and output pacing from the widget surface.',
    valueDescription: 'Default: 5; Min: 1; Max: 60; Interval: 1; Longer durations expand narrative runtime and cost; shorter durations narrow output length and reduce generation time.',
    ssot: `${BYTEPLUS_VIDEO_GENERATION_API_DOCS_URL} :: Request body > duration`,
    module: ['canvas/src/features/settings/registry-ui.ui.ts', 'canvas/src/features/chat/byteplusRunGeneration.ts'],
    className: ['SettingsRegistryItem', 'RunVideoGenerationOptions'],
    functionName: ['readBytePlusVideoWidgetDefaults', 'generateRunVideoWithBytePlus'],
    valueKey: 'byteplusVideoDuration',
    responsibility: 'Controls the output duration in seconds for the generated video task.',
    searchHints: ['duration seconds video generation'],
    tooltipDefaultValue: 5,
    tooltipMin: 1,
    tooltipMax: 60,
    tooltipInterval: 1,
    tooltipExpansionNote: 'Longer durations expand narrative runtime.',
    tooltipContractionNote: 'Shorter durations narrow output length and reduce generation time.',
  },
  {
    key: 'byteplusVideoGenerateAudio',
    typeLabel: 'boolean',
    value: 'Optional. Default false.',
    keyDescription: 'Audio-output toggle -> request synchronized sound when the chosen model supports it -> decide whether BytePlus should generate audio alongside video frames.',
    valueDescription: 'Default: false; Enabling audio expands synchronized sound generation on supported models; disabling it narrows output to silent video.',
    ssot: `${BYTEPLUS_VIDEO_GENERATION_API_DOCS_URL} :: Request body > generate_audio`,
    module: ['canvas/src/features/settings/registry-ui.ui.ts', 'canvas/src/features/chat/byteplusRunGeneration.ts'],
    className: ['SettingsRegistryItem', 'RunVideoGenerationOptions'],
    functionName: ['readBytePlusVideoWidgetDefaults', 'generateRunVideoWithBytePlus'],
    valueKey: 'byteplusVideoGenerateAudio',
    responsibility: 'Controls whether BytePlus should generate synchronized audio with the output video.',
    searchHints: ['generate audio synchronized sound video generation'],
    tooltipDefaultValue: false,
    tooltipExpansionNote: 'Audio expands multimodal output on supported models.',
    tooltipContractionNote: 'Disabling audio narrows the task to silent video output.',
  },
  {
    key: 'byteplusVideoResolution',
    typeLabel: 'string',
    value: 'Optional. Default 720p.',
    keyDescription: 'Clarity preset -> choose the output video resolution -> control the render detail budget sent to BytePlus.',
    valueDescription: 'Default: 720p; Options: 720p | 1080p; Higher resolution expands detail and cost; lower resolution narrows output size and usually lowers latency.',
    ssot: `${BYTEPLUS_VIDEO_GENERATION_API_DOCS_URL} :: Request body > resolution`,
    module: ['canvas/src/features/settings/registry-ui.ui.ts', 'canvas/src/features/chat/byteplusRunGeneration.ts'],
    className: ['SettingsRegistryItem', 'RunVideoGenerationOptions'],
    functionName: ['readBytePlusVideoWidgetDefaults', 'generateRunVideoWithBytePlus'],
    valueKey: 'byteplusVideoResolution',
    responsibility: 'Controls the output video resolution preset.',
    searchHints: ['resolution 720p 1080p video generation'],
    tooltipDefaultValue: '720p',
    tooltipExpansionNote: 'Higher resolution expands detail and playback clarity.',
    tooltipContractionNote: 'Lower resolution narrows output size and usually lowers latency.',
  },
  {
    key: 'byteplusVideoWatermark',
    typeLabel: 'boolean',
    value: 'Optional. Default false.',
    keyDescription: 'Marking policy -> decide whether BytePlus adds a watermark -> control the default visible compliance marker on generated videos.',
    valueDescription: 'Default: false; Enabling watermark expands explicit AI marking; disabling it narrows visible output annotations.',
    ssot: `${BYTEPLUS_VIDEO_GENERATION_API_DOCS_URL} :: Request body > watermark`,
    module: ['canvas/src/features/settings/registry-ui.ui.ts', 'canvas/src/features/chat/byteplusRunGeneration.ts'],
    className: ['SettingsRegistryItem', 'RunVideoGenerationOptions'],
    functionName: ['readBytePlusVideoWidgetDefaults', 'generateRunVideoWithBytePlus'],
    valueKey: 'byteplusVideoWatermark',
    responsibility: 'Controls whether a watermark is added to the generated video.',
    searchHints: ['watermark video generation'],
    tooltipDefaultValue: false,
    tooltipExpansionNote: 'Enabling watermark expands explicit generated-video marking.',
    tooltipContractionNote: 'Disabling watermark narrows visible output annotations.',
  },
  {
    key: 'content',
    typeLabel: 'object[]',
    value: 'Required. Content items assembled from prompt text plus optional reference image, or overridden by content_json.',
    keyDescription: 'Multimodal request payload -> assemble text and reference assets into the upstream content array -> tell BytePlus which prompt/reference inputs should drive the generation task.',
    valueDescription: 'Default: prompt-only text item; Adding reference assets or content_json expands multimodal conditioning; leaving it prompt-only narrows the request to text-to-video generation.',
    ssot: `${BYTEPLUS_VIDEO_GENERATION_API_DOCS_URL} :: Request body > content`,
    module: ['canvas/src/features/chat/byteplusRunGeneration.ts', 'canvas/src/features/flow-editor-manager/registryTemplates.ts'],
    className: ['RunVideoGenerationOptions', 'WidgetRegistryEntry'],
    functionName: ['generateRunVideoWithBytePlus', 'buildBytePlusVideoGenerationFields'],
    responsibility: 'Carries the prompt text and optional reference assets sent to the BytePlus task API.',
    searchHints: ['content text image_url video_url audio_url reference multimodal'],
    notes: 'The raw API supports text, reference images, reference videos, reference audio, and draft-task reuse; knowgrph exposes prompt plus reference image directly and lets content_json override the rest.',
  },
  {
    key: 'docs_url',
    typeLabel: 'string',
    value: BYTEPLUS_VIDEO_GENERATION_API_DOCS_URL,
    keyDescription: 'Reference locator -> point the operator to the official BytePlus video task API explorer -> keep request interpretation anchored to the vendor source.',
    valueDescription: 'Default: https://api.byteplus.com/api-explorer/?action=CreateContentsGenerationsTasks&groupName=Video%20Generation%20API&serviceCode=ark&version=2024-01-01; Opening the vendor docs expands source context; staying inside knowgrph narrows attention to the curated request surface.',
    ssot: BYTEPLUS_VIDEO_GENERATION_API_DOCS_URL,
    module: ['canvas/src/features/panels/views/SettingsView.tsx', 'docs/documents/knowgrph-byteplus-openark-video-generation-api-reference.md'],
    className: ['SettingsView'],
    functionName: ['buildMarkdown'],
    responsibility: 'Links to the official BytePlus ModelArk Video Generation API explorer.',
    searchHints: ['byteplus docs modelark video generation api explorer'],
  },
  {
    key: 'endpoint',
    typeLabel: 'string',
    value: 'POST /api/v3/contents/generations/tasks',
    keyDescription: 'Task-creation dispatcher -> send the video-generation payload to BytePlus -> create an asynchronous video generation task for later polling.',
    valueDescription: 'Default: POST /api/v3/contents/generations/tasks; Sending to the BytePlus task endpoint expands runnable video output; changing the path narrows compatibility with the shared proxy pipeline.',
    ssot: `${BYTEPLUS_VIDEO_GENERATION_API_DOCS_URL} :: Request endpoint`,
    module: ['canvas/src/features/chat/byteplusRunGeneration.ts', 'canvas/src/lib/chatEndpoint.ts'],
    className: ['RunGenerationConfig'],
    functionName: ['generateRunVideoWithBytePlus', 'resolveBytePlusContentEndpointForRequest'],
    responsibility: 'Creates a BytePlus video generation task from prompt content and generation parameters.',
    searchHints: ['contents generations tasks post'],
    notes: 'Knowgrph routes this through the proxy and sets the upstream origin internally.',
  },
  {
    key: 'generate_audio',
    typeLabel: 'boolean',
    value: 'Optional. Upstream task field controlled by byteplusVideoGenerateAudio.',
    keyDescription: 'Synchronized-audio request flag -> forward the audio-generation preference into the task payload -> tell BytePlus whether to emit sound with the generated video.',
    valueDescription: 'Default: false; Enabling audio expands synchronized sound generation on supported models; disabling it narrows output to silent video.',
    ssot: `${BYTEPLUS_VIDEO_GENERATION_API_DOCS_URL} :: Request body > generate_audio`,
    module: ['canvas/src/features/chat/byteplusRunGeneration.ts'],
    className: ['RunVideoGenerationOptions'],
    functionName: ['generateRunVideoWithBytePlus'],
    responsibility: 'Forwards the audio-generation toggle into the upstream request body.',
    searchHints: ['generate_audio task request field'],
  },
  {
    key: 'polling_endpoint',
    typeLabel: 'string',
    value: 'GET /api/v3/contents/generations/tasks/{id}',
    keyDescription: 'Task-status reader -> poll the created task until it reaches a downloadable succeeded state -> retrieve the final video URL for the shared asset pipeline.',
    valueDescription: 'Default: GET /api/v3/contents/generations/tasks/{id}; Polling expands asynchronous task completion into a downloadable asset; skipping it narrows the flow to task creation without usable output.',
    ssot: `${BYTEPLUS_VIDEO_GENERATION_API_DOCS_URL} :: Query task endpoint`,
    module: ['canvas/src/features/chat/byteplusRunGeneration.ts'],
    className: ['RunGenerationConfig'],
    functionName: ['generateRunVideoWithBytePlus'],
    responsibility: 'Polls BytePlus task status until the generated video URL is available.',
    searchHints: ['contents generations tasks get status polling'],
  },
  {
    key: 'prompt',
    typeLabel: 'string',
    value: 'Required for the default builder. Video generation prompt text.',
    keyDescription: 'Scene brief -> describe the target motion, style, and narrative -> steer BytePlus toward the requested video outcome when content_json is not overriding the payload.',
    valueDescription: 'Default: empty; Richer prompt detail expands scene control; shorter prompts narrow specification and leave more to model inference.',
    ssot: `${BYTEPLUS_VIDEO_GENERATION_API_DOCS_URL} :: Request body > content.text`,
    module: ['canvas/src/features/chat/byteplusRunGeneration.ts', 'canvas/src/features/flow-editor-manager/registryTemplates.ts'],
    className: ['RunVideoGenerationOptions', 'WidgetRegistryEntry'],
    functionName: ['generateRunVideoWithBytePlus', 'buildBytePlusVideoGenerationFields'],
    responsibility: 'Carries the prompt text used by the default content-array builder.',
    searchHints: ['prompt video generation text content'],
    notes: 'Knowgrph uses this field when content_json is empty.',
  },
  {
    key: 'ratio',
    typeLabel: 'string',
    value: 'Optional. Upstream task field mapped from byteplusVideoAspectRatio.',
    keyDescription: 'Ratio mapper -> translate widget-friendly aspect presets into the BytePlus `ratio` string -> keep the widget UI simple while preserving the upstream contract.',
    valueDescription: 'Default: 16:9 from landscape mapping; Portrait and square expand alternate framing; leaving the default narrows output to the standard horizontal layout.',
    ssot: `${BYTEPLUS_VIDEO_GENERATION_API_DOCS_URL} :: Request body > ratio`,
    module: ['canvas/src/features/chat/byteplusRunGeneration.ts'],
    className: ['RunVideoGenerationOptions'],
    functionName: ['mapAspectRatioToVideoRatio', 'generateRunVideoWithBytePlus'],
    responsibility: 'Supplies the upstream BytePlus ratio string derived from the widget aspect-ratio preset.',
    searchHints: ['ratio 16:9 9:16 1:1 adaptive mapping'],
  },
  {
    key: 'reference_image',
    typeLabel: 'string',
    value: 'Optional. Public image URL used to append an image_url reference item.',
    keyDescription: 'Visual conditioner -> pass a first-frame or reference image into the content builder -> let BytePlus condition the video task on a source image when content_json is not overriding the payload.',
    valueDescription: 'Default: empty; Adding a reference image expands image-conditioned video generation; omitting it narrows the request to text-only generation.',
    ssot: `${BYTEPLUS_VIDEO_GENERATION_API_DOCS_URL} :: Request body > content.image_url`,
    module: ['canvas/src/features/chat/byteplusRunGeneration.ts', 'canvas/src/components/FlowEditor/NodeOverlayEditorForm.tsx'],
    className: ['RunVideoGenerationOptions'],
    functionName: ['generateRunVideoWithBytePlus', 'buildWidgetDraftFromSmartFields'],
    responsibility: 'Carries the optional reference image URL used by the default content builder.',
    searchHints: ['reference image first frame image_url video generation'],
    notes: 'Knowgrph appends this as an `image_url` item when content_json is empty.',
  },
  {
    key: 'resolution',
    typeLabel: 'string',
    value: 'Optional. Upstream task field controlled by byteplusVideoResolution.',
    keyDescription: 'Render-detail selector -> forward the widget resolution preset into the task payload -> control the output clarity requested from BytePlus.',
    valueDescription: 'Default: 720p; Options: 720p | 1080p; Higher resolution expands detail and cost; lower resolution narrows output size and usually lowers latency.',
    ssot: `${BYTEPLUS_VIDEO_GENERATION_API_DOCS_URL} :: Request body > resolution`,
    module: ['canvas/src/features/chat/byteplusRunGeneration.ts'],
    className: ['RunVideoGenerationOptions'],
    functionName: ['generateRunVideoWithBytePlus'],
    responsibility: 'Supplies the upstream BytePlus resolution string derived from the widget preset.',
    searchHints: ['resolution task request field'],
  },
  {
    key: 'watermark',
    typeLabel: 'boolean',
    value: 'Optional. Upstream task field controlled by byteplusVideoWatermark.',
    keyDescription: 'Output-marking flag -> forward the watermark preference into the task payload -> tell BytePlus whether to add a watermark to the video.',
    valueDescription: 'Default: false; Enabling watermark expands explicit AI marking; disabling it narrows visible output annotations.',
    ssot: `${BYTEPLUS_VIDEO_GENERATION_API_DOCS_URL} :: Request body > watermark`,
    module: ['canvas/src/features/chat/byteplusRunGeneration.ts'],
    className: ['RunVideoGenerationOptions'],
    functionName: ['generateRunVideoWithBytePlus'],
    responsibility: 'Supplies the upstream watermark flag derived from the widget preset.',
    searchHints: ['watermark task request field'],
  },
]

export const BYTEPLUS_VIDEO_GENERATION_API_DOC_ENTRIES: ReadonlyArray<BytePlusVideoVirtualSettingsEntry> =
  BYTEPLUS_VIDEO_GENERATION_DOC_ROWS.map(row => ({
    meta: {
      key: row.key.startsWith('byteplusVideo') ? row.key : `byteplusVideoApi.${row.key}`,
      type: toBaseType(row.typeLabel),
      source: 'backendEnv',
      read: () => row.value,
    },
    value: row.value,
    valueKey: row.valueKey,
    typeLabel: row.typeLabel,
    tooltipRole: row.valueKey ? BYTEPLUS_VIDEO_TOOLTIP_ROLE : undefined,
    tooltipActions: row.valueKey ? BYTEPLUS_VIDEO_KEY_ACTIONS_BY_VALUE_KEY[row.valueKey] : undefined,
    tooltipDefaultValue: row.tooltipDefaultValue,
    tooltipMin: row.tooltipMin,
    tooltipMax: row.tooltipMax,
    tooltipInterval: row.tooltipInterval,
    tooltipExpansionNote: row.tooltipExpansionNote,
    tooltipContractionNote: row.tooltipContractionNote,
    tooltipImpact: row.tooltipImpact,
    searchHints: [
      'byteplus video generation api request parameters',
      row.key,
      ...(row.searchHints || []),
    ],
    details: {
      area: BYTEPLUS_VIDEO_GENERATION_API_DOC_AREA,
      responsibility: row.responsibility,
      notes: buildDetailNotes(row),
      modules: row.module,
      classes: row.className,
      functions: row.functionName,
    } satisfies FlowDetails,
  }))

export function buildBytePlusVideoGenerationFields(): WidgetRegistryField[] {
  return [
    {
      fieldKey: 'model',
      fieldType: 'select',
      schemaPath: 'properties.model',
      required: true,
      label: 'Model',
      options: buildFieldOptionLabels(FLOW_EDITOR_VIDEO_MODEL_OPTIONS),
    },
    {
      fieldKey: 'prompt',
      fieldType: 'textarea',
      schemaPath: 'properties.prompt',
      required: true,
      label: 'Prompt',
    },
    {
      fieldKey: 'content_json',
      fieldType: 'json',
      schemaPath: 'properties.content_json',
      label: 'Content (JSON)',
    },
    {
      fieldKey: 'aspect_ratio',
      fieldType: 'select',
      schemaPath: 'properties.aspect_ratio',
      required: true,
      label: 'Aspect ratio',
      options: buildFieldOptionLabels(FLOW_EDITOR_ASPECT_RATIO_OPTIONS),
    },
    {
      fieldKey: 'resolution',
      fieldType: 'select',
      schemaPath: 'properties.resolution',
      required: true,
      label: 'Resolution',
      options: buildFieldOptionLabels(FLOW_EDITOR_RESOLUTION_OPTIONS),
    },
    {
      fieldKey: 'duration',
      fieldType: 'select',
      schemaPath: 'properties.duration',
      required: true,
      label: 'Duration',
      options: buildFieldOptionLabels(FLOW_EDITOR_DURATION_SECONDS_OPTIONS),
    },
    {
      fieldKey: 'generate_audio',
      fieldType: 'boolean',
      schemaPath: 'properties.generate_audio',
      label: 'Generate audio',
    },
    {
      fieldKey: 'fast',
      fieldType: 'boolean',
      schemaPath: 'properties.fast',
      label: 'Fast',
    },
    {
      fieldKey: 'watermark',
      fieldType: 'boolean',
      schemaPath: 'properties.watermark',
      label: 'Watermark',
    },
  ]
}

export function resolveBytePlusVideoWidgetApiRowKey(args: {
  schemaPath?: string
  fieldKey?: string
  portKey?: string
}): string | null {
  const candidates = [
    String(args.schemaPath || '').trim(),
    String(args.fieldKey || '').trim(),
    String(args.portKey || '').trim(),
  ]
    .filter(Boolean)
    .map(value => value.replace(/^properties\./, ''))
  for (const candidate of candidates) {
    if (candidate === 'model') return 'byteplusVideoModel'
    if (candidate === 'content_json') return 'byteplusVideoContentJson'
    if (candidate === 'aspect_ratio') return 'byteplusVideoAspectRatio'
    if (candidate === 'resolution') return 'byteplusVideoResolution'
    if (candidate === 'duration') return 'byteplusVideoDuration'
    if (candidate === 'generate_audio') return 'byteplusVideoGenerateAudio'
    if (candidate === 'fast') return 'byteplusVideoFast'
    if (candidate === 'watermark') return 'byteplusVideoWatermark'
    if (candidate === 'prompt' || candidate === 'prompt_in') return 'byteplusVideoApi.prompt'
    if (candidate === 'reference_image') return 'byteplusVideoApi.reference_image'
    if (candidate === 'videoUrl') return 'byteplusVideoApi.polling_endpoint'
  }
  return null
}
