import type { FlowDetails, SettingMeta } from '@/features/settings/types'
import type { VirtualSettingsEntry } from './byteplusChatApiDocs'

export const BYTEPLUS_IMAGE_GENERATION_API_DOC_AREA = 'BytePlus Image Generation API'

export const BYTEPLUS_IMAGE_GENERATION_API_DOCS_URL =
  'https://docs.byteplus.com/en/docs/ModelArk/1666945'

export function getBytePlusImageGenerationApiRowAnchorId(rowKey: string): string {
  const normalized = String(rowKey || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `byteplus-image-generation-api-row-${normalized || 'entry'}`
}

type BytePlusImageApiDocRow = {
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

export const BYTEPLUS_IMAGE_GENERATION_MAPPED_VALUE_KEYS = [
  'chatAuthMode',
  'chatApiKey',
  'byteplusImageModel',
  'byteplusImageSize',
  'byteplusImageOutputFormat',
  'byteplusImageWatermark',
  'byteplusImageSeed',
  'byteplusImageGuidanceScale',
] as const

const BYTEPLUS_IMAGE_TOOLTIP_ROLE = 'BytePlus Image Generation API'

const BYTEPLUS_IMAGE_KEY_ACTIONS_BY_VALUE_KEY: Readonly<Record<string, string[]>> = {
  chatAuthMode: ['select auth mode', 'choose credential flow'],
  chatApiKey: ['store BYOK secret', 'authorize direct BytePlus calls'],
  byteplusImageModel: ['select image model', 'pin integration default'],
  byteplusImageSize: ['select image size', 'set integration default'],
  byteplusImageOutputFormat: ['select output format', 'set integration default'],
  byteplusImageWatermark: ['toggle watermark', 'set integration default'],
  byteplusImageSeed: ['set deterministic seed', 'set integration default'],
  byteplusImageGuidanceScale: ['set guidance scale', 'set integration default'],
}

const BYTEPLUS_IMAGE_API_DOC_ROWS: ReadonlyArray<BytePlusImageApiDocRow> = [
  {
    key: 'docs_url',
    typeLabel: 'string',
    value: BYTEPLUS_IMAGE_GENERATION_API_DOCS_URL,
    responsibility: 'Links to the official BytePlus ModelArk Image Generation API documentation.',
    searchHints: ['byteplus docs modelark image generation api'],
  },
  {
    key: 'endpoint',
    typeLabel: 'string',
    value: 'POST /api/v3/images/generations',
    responsibility: 'Creates an image generation request from prompt text plus optional image input.',
    searchHints: ['images generations post'],
    notes: 'Knowgrph routes this through the proxy and keeps binary decoding on the shared image pipeline.',
  },
  {
    key: 'auth_mode',
    typeLabel: 'string',
    value: 'Integration setting. serverManaged | byok.',
    valueKey: 'chatAuthMode',
    responsibility: 'Selects server-managed credentials or direct BYOK authentication for BytePlus image generation.',
    searchHints: ['auth byok serverManaged api key'],
    notes: 'Image generation uses BytePlus routing regardless of the global chat provider.',
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
    key: 'byteplusImageModel',
    typeLabel: 'string',
    value: 'Required. Image model ID.',
    valueKey: 'byteplusImageModel',
    responsibility: 'Selects the BytePlus ModelArk image generation model used for the request.',
    searchHints: ['model byteplusImageApi.model seedream bytedance dola image widget'],
    notes: 'Request body field: `model`.',
  },
  {
    key: 'size',
    typeLabel: 'string',
    value: 'Optional. Default 2K.',
    valueKey: 'byteplusImageSize',
    responsibility: 'Controls the output image size preset sent to the Image Generation API.',
    searchHints: ['size 1K 2K 3K 4K'],
  },
  {
    key: 'output_format',
    typeLabel: 'string',
    value: 'Optional. Default jpeg.',
    valueKey: 'byteplusImageOutputFormat',
    responsibility: 'Selects the generated image format returned by BytePlus.',
    searchHints: ['output format jpeg png'],
  },
  {
    key: 'watermark',
    typeLabel: 'boolean',
    value: 'Optional. Default false.',
    valueKey: 'byteplusImageWatermark',
    responsibility: 'Controls whether a watermark is added to the generated image.',
    searchHints: ['watermark'],
  },
  {
    key: 'seed',
    typeLabel: 'integer',
    value: 'Optional. Default 0 (omit deterministic seed).',
    valueKey: 'byteplusImageSeed',
    responsibility: 'Pins deterministic generation when you need reproducible image output.',
    searchHints: ['seed deterministic'],
    tooltipMin: 0,
    tooltipMax: 2147483647,
  },
  {
    key: 'guidance_scale',
    typeLabel: 'number',
    value: 'Optional. Default 0 (omit API override).',
    valueKey: 'byteplusImageGuidanceScale',
    responsibility: 'Controls prompt guidance strength when the selected image model supports it.',
    searchHints: ['guidance scale prompt strength'],
    tooltipMin: 0,
    tooltipMax: 20,
  },
]

const toBaseType = (typeLabel: string): SettingMeta['type'] => {
  const normalized = String(typeLabel || '').trim().toLowerCase()
  if (normalized.includes('boolean')) return 'boolean'
  if (normalized.includes('integer') || normalized.includes('float') || normalized.includes('number')) return 'number'
  if (normalized.includes('object') || normalized.includes('[]')) return 'json'
  return 'string'
}

export const BYTEPLUS_IMAGE_GENERATION_API_REQUEST_DOC_ENTRIES: ReadonlyArray<VirtualSettingsEntry> =
  BYTEPLUS_IMAGE_API_DOC_ROWS.map(row => ({
    meta: {
      key: row.key.startsWith('byteplusImage') ? row.key : `byteplusImageApi.${row.key}`,
      type: toBaseType(row.typeLabel),
      source: 'backendEnv',
      read: () => row.value,
    },
    value: row.value,
    valueKey: row.valueKey,
    typeLabel: row.typeLabel,
    tooltipRole: row.valueKey ? BYTEPLUS_IMAGE_TOOLTIP_ROLE : undefined,
    tooltipActions: row.valueKey ? BYTEPLUS_IMAGE_KEY_ACTIONS_BY_VALUE_KEY[row.valueKey] : undefined,
    tooltipDefaultValue: row.tooltipDefaultValue,
    tooltipMin: row.tooltipMin,
    tooltipMax: row.tooltipMax,
    tooltipInterval: row.tooltipInterval,
    tooltipExpansionNote: row.tooltipExpansionNote,
    tooltipContractionNote: row.tooltipContractionNote,
    tooltipImpact: row.tooltipImpact,
    searchHints: [
      'byteplus image generation api request parameters',
      row.key,
      ...(row.searchHints || []),
    ],
    details: {
      area: BYTEPLUS_IMAGE_GENERATION_API_DOC_AREA,
      responsibility: row.responsibility,
      notes: row.notes || '',
      modules: ['POST /api/v3/images/generations'],
      classes: ['Request body'],
      functions: ['BytePlus ModelArk Image Generation API'],
    } satisfies FlowDetails,
  }))
