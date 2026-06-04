import type { VirtualSettingsEntry } from './byteplusSharedTextApiDocs'
import type { SettingMeta } from '@/features/settings/types'
import {
  OPENAI_IMAGES_API_DOC_ROWS,
  OPENAI_IMAGES_KEY_ACTIONS_BY_VALUE_KEY,
  OPENAI_IMAGES_VALUE_TOOLTIP_BY_ROW_KEY,
} from '@/features/integrations/openaiImagesSsot'
import { buildSettingsRowAnchorId } from './settingsRowAnchor'

export const OPENAI_IMAGES_API_DOC_AREA = 'OpenAI Images API'

export function getOpenAiImagesApiRowAnchorId(rowKey: string): string {
  return buildSettingsRowAnchorId('openai-images-api-row', rowKey)
}

const OPENAI_IMAGES_TOOLTIP_ROLE = 'OpenAI Images API'

const toBaseType = (typeLabel: string): SettingMeta['type'] => {
  const normalized = String(typeLabel || '').trim().toLowerCase()
  if (normalized.includes('boolean')) return 'boolean'
  if (normalized.includes('integer') || normalized.includes('float') || normalized.includes('number')) return 'number'
  if (normalized.includes('object') || normalized.includes('[]')) return 'json'
  return 'string'
}

export const OPENAI_IMAGES_API_REQUEST_DOC_ENTRIES: ReadonlyArray<VirtualSettingsEntry> =
  OPENAI_IMAGES_API_DOC_ROWS.map(row => ({
    meta: {
      key: `openaiImageApi.${row.key}`,
      type: toBaseType(row.typeLabel),
      source: 'backendEnv',
      read: () => row.value,
      ...(row.options ? { options: [...row.options] } : {}),
    },
    value: row.value,
    valueKey: row.valueKey,
    typeLabel: row.typeLabel,
    tooltipRole: row.valueKey ? OPENAI_IMAGES_TOOLTIP_ROLE : undefined,
    tooltipActions: row.valueKey ? OPENAI_IMAGES_KEY_ACTIONS_BY_VALUE_KEY[row.valueKey] : undefined,
    tooltipDefaultValue: typeof row.tooltipDefaultValue !== 'undefined'
      ? row.tooltipDefaultValue
      : OPENAI_IMAGES_VALUE_TOOLTIP_BY_ROW_KEY[row.key]?.defaultValue,
    tooltipMin: typeof row.tooltipMin !== 'undefined'
      ? row.tooltipMin
      : OPENAI_IMAGES_VALUE_TOOLTIP_BY_ROW_KEY[row.key]?.min,
    tooltipMax: typeof row.tooltipMax !== 'undefined'
      ? row.tooltipMax
      : OPENAI_IMAGES_VALUE_TOOLTIP_BY_ROW_KEY[row.key]?.max,
    tooltipInterval: typeof row.tooltipInterval !== 'undefined'
      ? row.tooltipInterval
      : OPENAI_IMAGES_VALUE_TOOLTIP_BY_ROW_KEY[row.key]?.interval,
    tooltipExpansionNote: row.tooltipExpansionNote || OPENAI_IMAGES_VALUE_TOOLTIP_BY_ROW_KEY[row.key]?.expansionNote,
    tooltipContractionNote: row.tooltipContractionNote || OPENAI_IMAGES_VALUE_TOOLTIP_BY_ROW_KEY[row.key]?.contractionNote,
    tooltipImpact: row.tooltipImpact || OPENAI_IMAGES_VALUE_TOOLTIP_BY_ROW_KEY[row.key]?.impact,
    searchHints: [
      'openai images api request parameters',
      row.key,
      ...(row.searchHints || []),
    ],
    details: {
      area: OPENAI_IMAGES_API_DOC_AREA,
      responsibility: row.responsibility,
      notes: row.notes || '',
      modules: row.modules || ['POST /images/generations'],
      classes: row.classes || ['Request body'],
      functions: row.functions || ['OpenAI Images API'],
    },
  }))
