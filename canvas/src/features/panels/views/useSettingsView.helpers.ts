import type { FlowDetails } from '@/features/settings/types'
import { settingsRegistry } from '@/features/settings/registry'
import { normalized as normalizeText } from '@/features/panels/utils/json'
import { BYTEPLUS_SHARED_TEXT_API_DOC_AREA } from './byteplusSharedTextApiDocs'
import { OPENAI_CHAT_API_DOC_AREA } from './openaiChatApiDocs'
import { OPENAI_IMAGES_API_DOC_AREA } from './openaiImagesApiDocs'
import { DEERFLOW_API_DOC_AREA } from './deerflowApiDocs'
import { STRIPE_PAYMENT_API_DOC_AREA } from './stripePaymentApiDocs'
import {
  BYTEPLUS_IMAGE_GENERATION_API_DOC_AREA,
} from './byteplusImageGenerationApiDocs'
import {
  BYTEPLUS_VIDEO_GENERATION_API_DOC_AREA,
} from './byteplusVideoGenerationApiDocs'
import {
  GEMINI_VIDEO_GENERATION_API_DOC_AREA,
} from './geminiVideoGenerationApiDocs'
import {
  MAPS_GRABMAPS_DOC_AREA,
  MAPS_GEO_DOC_AREA,
  MAPS_MAPLIBRE_DOC_AREA,
} from './mapsApiDocs'
import { MAPS_GRABMAPS_DIRECTIONS_REQUEST_DOC_AREA } from './grabmapsDirectionsApiDocs'
import { MAPS_GRABMAPS_MCP_DOC_AREA } from './grabmapsMcpApiDocs'

export type SettingsEntry = {
  meta: {
    key: string
    type: string
    source: string
    read: () => string | number | boolean | null
    write?: (value: string | number | boolean) => void
    docKey?: string
    default?: () => string | number | boolean | null
    options?: string[]
  }
  details: FlowDetails
  writable: boolean
  index: string
  anchorId?: string
  typeLabel?: string
  valueKey?: string
  valueDisplayOverride?: string | number | boolean
  valueType?: string
  valueOptions?: string[]
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

export const SETTINGS_REGISTRY_BY_KEY = new Map(settingsRegistry.map(setting => [setting.key, setting] as const))
export const SETTINGS_REGISTRY_BY_VALUE_KEY = SETTINGS_REGISTRY_BY_KEY

const SETTINGS_AREA_ORDER: readonly string[] = [
  'Chat',
  'UI Density: Panels',
  'UI Density: Icons',
  MAPS_GRABMAPS_DOC_AREA,
  MAPS_GRABMAPS_MCP_DOC_AREA,
  MAPS_GRABMAPS_DIRECTIONS_REQUEST_DOC_AREA,
  MAPS_GEO_DOC_AREA,
  MAPS_MAPLIBRE_DOC_AREA,
  'Workspace',
  'Source File Management',
  'Markdown',
  'Flow Editor',
  'Canvas',
  'Rendering',
  'Performance',
  'Graph Data Table',
  'Import / Export',
  'Integrations',
  BYTEPLUS_SHARED_TEXT_API_DOC_AREA,
  BYTEPLUS_IMAGE_GENERATION_API_DOC_AREA,
  BYTEPLUS_VIDEO_GENERATION_API_DOC_AREA,
  GEMINI_VIDEO_GENERATION_API_DOC_AREA,
  OPENAI_CHAT_API_DOC_AREA,
  OPENAI_IMAGES_API_DOC_AREA,
  DEERFLOW_API_DOC_AREA,
]

const SETTINGS_AREA_CANONICAL: Readonly<Record<string, string>> = {
  'ui density panels': 'UI Density: Panels',
  'ui density panel': 'UI Density: Panels',
  'ui density icons': 'UI Density: Icons',
  'graph data table': 'Graph Data Table',
  'import export': 'Import / Export',
  'source file management': 'Source File Management',
  'source files management': 'Source File Management',
  integrations: 'Integrations',
}

export function normalizeSettingsAreaLabel(areaRaw: string): string {
  const area = String(areaRaw || '').trim()
  if (!area) return '—'
  const key = area.toLowerCase().replace(/[/:]+/g, ' ').replace(/\s+/g, ' ').trim()
  return SETTINGS_AREA_CANONICAL[key] || area
}

export function settingsAreaSortWeight(area: string): number {
  const idx = SETTINGS_AREA_ORDER.indexOf(area)
  return idx >= 0 ? idx : Number.MAX_SAFE_INTEGER
}

export function isIntegrationsOwnedSetting(key: string, areaRaw: string): boolean {
  const area = normalizeSettingsAreaLabel(areaRaw)
  if (
    area === 'Chat'
    || area === 'Integrations'
    || area === BYTEPLUS_SHARED_TEXT_API_DOC_AREA
    || area === BYTEPLUS_IMAGE_GENERATION_API_DOC_AREA
    || area === BYTEPLUS_VIDEO_GENERATION_API_DOC_AREA
    || area === GEMINI_VIDEO_GENERATION_API_DOC_AREA
    || area === OPENAI_CHAT_API_DOC_AREA
    || area === OPENAI_IMAGES_API_DOC_AREA
    || area === DEERFLOW_API_DOC_AREA
  ) {
    return true
  }
  return key.startsWith('chat') || key === 'integrationConfigsJson'
}

export function isPaymentsOwnedSetting(key: string, areaRaw: string): boolean {
  const area = normalizeSettingsAreaLabel(areaRaw)
  if (area === STRIPE_PAYMENT_API_DOC_AREA) return true
  return key.startsWith('payments.')
}

export function isMapsOwnedSetting(key: string, areaRaw: string): boolean {
  const area = normalizeSettingsAreaLabel(areaRaw)
  if (
    area === MAPS_GRABMAPS_DOC_AREA
    || area === MAPS_GRABMAPS_DIRECTIONS_REQUEST_DOC_AREA
    || area === MAPS_GEO_DOC_AREA
    || area === MAPS_MAPLIBRE_DOC_AREA
  ) return true
  if (key === 'autoEnableGeospatialOnGeoImport') return true
  if (key.includes('.mcp.')) return false
  return key.startsWith('maps.')
}

export function isMcpOwnedSetting(key: string, areaRaw: string): boolean {
  const area = normalizeSettingsAreaLabel(areaRaw)
  if (area === MAPS_GRABMAPS_MCP_DOC_AREA) return true
  return key.includes('.mcp.')
}

export function buildDocMappedEntry(
  entry: {
    meta: SettingsEntry['meta']
    details: FlowDetails
    typeLabel?: string
    value?: string | number | boolean
    valueKey?: string
    searchHints?: readonly string[]
    tooltipRole?: string
    tooltipActions?: string[]
    tooltipDefaultValue?: string | number | boolean | null
    tooltipMin?: string | number
    tooltipMax?: string | number
    tooltipInterval?: string | number
    tooltipExpansionNote?: string
    tooltipContractionNote?: string
    tooltipImpact?: string
  },
  values: Record<string, string | number | boolean>,
  anchorId: string | undefined,
): SettingsEntry {
  const mappedMeta = entry.valueKey
    ? SETTINGS_REGISTRY_BY_VALUE_KEY.get(entry.valueKey)
    : undefined
  return {
    meta: entry.meta,
    details: entry.details,
    writable: Boolean(mappedMeta?.write),
    index: normalizeText(
      [
        entry.details.area,
        entry.meta.key,
        entry.typeLabel,
        entry.valueKey ? String(values[entry.valueKey] ?? '') : entry.value,
        entry.details.responsibility,
        ...(entry.searchHints || []),
      ].join(' '),
    ),
    typeLabel: entry.typeLabel,
    valueKey: entry.valueKey,
    valueDisplayOverride:
      entry.valueKey && Object.prototype.hasOwnProperty.call(values, entry.valueKey)
        ? (values[entry.valueKey] as string | number | boolean | undefined)
        : undefined,
    valueType: mappedMeta?.type,
    valueOptions: mappedMeta?.options,
    tooltipRole: entry.tooltipRole,
    tooltipActions: entry.tooltipActions,
    tooltipDefaultValue: entry.tooltipDefaultValue,
    tooltipMin: entry.tooltipMin,
    tooltipMax: entry.tooltipMax,
    tooltipInterval: entry.tooltipInterval,
    tooltipExpansionNote: entry.tooltipExpansionNote,
    tooltipContractionNote: entry.tooltipContractionNote,
    tooltipImpact: entry.tooltipImpact,
    anchorId,
  }
}
