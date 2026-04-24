import type { FlowDetails, SettingMeta } from '@/features/settings/types'
import type { VirtualSettingsEntry } from './byteplusChatApiDocs'

export const BYTEPLUS_VIDEO_GENERATION_API_DOC_AREA = 'BytePlus Video Generation API'

export const BYTEPLUS_VIDEO_GENERATION_API_DOCS_URL =
  'https://docs.byteplus.com/en/docs/ModelArk/Video_Generation_API'

export function getBytePlusVideoGenerationApiRowAnchorId(rowKey: string): string {
  const normalized = String(rowKey || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `byteplus-video-generation-api-row-${normalized || 'entry'}`
}

type BytePlusVideoApiDocRow = {
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

export const BYTEPLUS_VIDEO_GENERATION_MAPPED_VALUE_KEYS = [
  'byteplusVideoModel',
  'byteplusVideoContentJson',
  'byteplusVideoResolution',
  'byteplusVideoAspectRatio',
  'byteplusVideoDuration',
  'byteplusVideoGenerateAudio',
  'byteplusVideoFast',
  'byteplusVideoWatermark',
] as const

const BYTEPLUS_VIDEO_TOOLTIP_ROLE = 'BytePlus Video Generation API'

const BYTEPLUS_VIDEO_KEY_ACTIONS_BY_VALUE_KEY: Readonly<Record<string, string[]>> = {
  chatAuthMode: ['select auth mode', 'choose credential flow'],
  chatApiKey: ['store BYOK secret', 'authorize direct BytePlus calls'],
  byteplusVideoModel: ['select video model', 'pin integration default'],
  byteplusVideoContentJson: ['edit request content', 'override generated content payload'],
  byteplusVideoResolution: ['select resolution', 'set integration default'],
  byteplusVideoAspectRatio: ['select aspect ratio', 'set integration default'],
  byteplusVideoDuration: ['set duration', 'set integration default'],
  byteplusVideoGenerateAudio: ['toggle audio generation', 'set integration default'],
  byteplusVideoFast: ['toggle fast mode', 'set integration default'],
  byteplusVideoWatermark: ['toggle watermark', 'set integration default'],
}

const BYTEPLUS_VIDEO_API_DOC_ROWS: ReadonlyArray<BytePlusVideoApiDocRow> = [
  {
    key: 'docs_url',
    typeLabel: 'string',
    value: BYTEPLUS_VIDEO_GENERATION_API_DOCS_URL,
    responsibility: 'Links to the official BytePlus ModelArk Video Generation API documentation.',
    searchHints: ['byteplus docs modelark video generation api'],
  },
  {
    key: 'endpoint',
    typeLabel: 'string',
    value: 'POST /api/v3/contents/generations/tasks',
    responsibility: 'Creates a video generation task from prompt content and generation parameters.',
    searchHints: ['contents generations tasks post'],
    notes: 'Knowgrph routes this through the proxy and sets the upstream origin internally.',
  },
  {
    key: 'polling_endpoint',
    typeLabel: 'string',
    value: 'GET /api/v3/contents/generations/tasks/{id}',
    responsibility: 'Polls task status until it succeeds and returns the generated video URL.',
    searchHints: ['contents generations tasks get status'],
  },
  {
    key: 'auth_mode',
    typeLabel: 'string',
    value: 'Integration setting. serverManaged | byok.',
    valueKey: 'chatAuthMode',
    responsibility: 'Selects server-managed credentials or direct BYOK authentication for BytePlus.',
    searchHints: ['auth byok serverManaged api key'],
    notes: 'Video generation uses BytePlus routing regardless of the global chat provider.',
  },
  {
    key: 'api_key',
    typeLabel: 'string',
    value: 'Integration setting. Required for BYOK authentication.',
    valueKey: 'chatApiKey',
    responsibility: 'Supplies the caller-managed BytePlus API key when auth mode is BYOK.',
    searchHints: ['api key authentication bearer x-kg-chat-api-key'],
    notes: 'Never paste production keys into shared workspaces; prefer server-managed auth when possible.',
  },
  {
    key: 'byteplusVideoModel',
    typeLabel: 'string',
    value: 'Required. Video model ID.',
    valueKey: 'byteplusVideoModel',
    responsibility: 'Selects the BytePlus ModelArk video generation model used for the task.',
    searchHints: ['model byteplusVideoApi.model seedance dreamina bytedance video'],
    notes: 'Request body field: `model`.',
  },
  {
    key: 'content',
    typeLabel: 'object[]',
    value: 'Required. Prompt content items (text + optional reference image_url).',
    valueKey: 'byteplusVideoContentJson',
    responsibility: 'Carries the prompt text and optional reference image for video conditioning.',
    searchHints: ['content text image_url reference'],
  },
  {
    key: 'resolution',
    typeLabel: 'string',
    value: 'Optional. Default 720p.',
    valueKey: 'byteplusVideoResolution',
    responsibility: 'Controls the output video resolution preset.',
    searchHints: ['resolution 720p 1080p'],
  },
  {
    key: 'ratio',
    typeLabel: 'string',
    value: 'Optional. Aspect ratio string (mapped from widget aspectRatio).',
    valueKey: 'byteplusVideoAspectRatio',
    responsibility: 'Selects the output aspect ratio preset.',
    searchHints: ['ratio aspect 16:9 9:16 1:1'],
  },
  {
    key: 'duration',
    typeLabel: 'integer',
    value: 'Optional. Default 5 seconds.',
    valueKey: 'byteplusVideoDuration',
    responsibility: 'Controls the output duration in seconds.',
    searchHints: ['duration seconds'],
  },
  {
    key: 'generate_audio',
    typeLabel: 'boolean',
    value: 'Optional. Default false.',
    valueKey: 'byteplusVideoGenerateAudio',
    responsibility: 'Enables audio generation for the video task (if supported by the model).',
    searchHints: ['generate audio'],
  },
  {
    key: 'fast',
    typeLabel: 'boolean',
    value: 'Optional. Default false.',
    valueKey: 'byteplusVideoFast',
    responsibility: 'Requests the faster BytePlus video generation variant when available.',
    searchHints: ['fast seedance quick variant'],
  },
  {
    key: 'watermark',
    typeLabel: 'boolean',
    value: 'Optional. Default false.',
    valueKey: 'byteplusVideoWatermark',
    responsibility: 'Controls whether a watermark is added to the output.',
    searchHints: ['watermark'],
  },
]

const toBaseType = (typeLabel: string): SettingMeta['type'] => {
  const normalized = String(typeLabel || '').trim().toLowerCase()
  if (normalized.includes('boolean')) return 'boolean'
  if (normalized.includes('integer') || normalized.includes('float') || normalized.includes('number')) return 'number'
  if (normalized.includes('object') || normalized.includes('[]')) return 'json'
  return 'string'
}

export const BYTEPLUS_VIDEO_GENERATION_API_REQUEST_DOC_ENTRIES: ReadonlyArray<VirtualSettingsEntry> =
  BYTEPLUS_VIDEO_API_DOC_ROWS.map(row => ({
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
      notes: row.notes || '',
      modules: ['POST /api/v3/contents/generations/tasks', 'GET /api/v3/contents/generations/tasks/{id}'],
      classes: ['Request body', 'Task polling'],
      functions: ['BytePlus ModelArk Video Generation API'],
    } satisfies FlowDetails,
  }))
