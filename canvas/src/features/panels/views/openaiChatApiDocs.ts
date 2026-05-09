import type { VirtualSettingsEntry } from './byteplusSharedTextApiDocs'
import type { SettingMeta } from '@/features/settings/types'
import {
  OPENAI_KEY_ACTIONS_BY_VALUE_KEY,
  OPENAI_RESPONSES_API_DOC_ROWS,
  OPENAI_VALUE_TOOLTIP_BY_ROW_KEY,
} from '@/features/integrations/openaiResponsesSsot'
import { buildSettingsRowAnchorId } from './settingsRowAnchor'

export const OPENAI_CHAT_API_DOC_AREA = 'OpenAI Chat API'

export function getOpenAiChatApiRowAnchorId(rowKey: string): string {
  return buildSettingsRowAnchorId('openai-chat-api-row', rowKey)
}

const OPENAI_TOOLTIP_ROLE = 'OpenAI Chat API'

const toBaseType = (typeLabel: string): SettingMeta['type'] => {
  const normalized = String(typeLabel || '').trim().toLowerCase()
  if (normalized.includes('boolean')) return 'boolean'
  if (normalized.includes('integer') || normalized.includes('float') || normalized.includes('number')) return 'number'
  if (normalized.includes('object') || normalized.includes('[]')) return 'json'
  return 'string'
}

export const OPENAI_CHAT_API_REQUEST_DOC_ENTRIES: ReadonlyArray<VirtualSettingsEntry> =
  OPENAI_RESPONSES_API_DOC_ROWS.map(row => ({
    meta: {
      key: `openaiApi.${row.key}`,
      type: toBaseType(row.typeLabel),
      source: 'backendEnv',
      read: () => row.value,
    },
    value: row.value,
    valueKey: row.valueKey,
    typeLabel: row.typeLabel,
    tooltipRole: row.valueKey ? OPENAI_TOOLTIP_ROLE : undefined,
    tooltipActions: row.valueKey ? OPENAI_KEY_ACTIONS_BY_VALUE_KEY[row.valueKey] : undefined,
    tooltipDefaultValue: typeof row.tooltipDefaultValue !== 'undefined'
      ? row.tooltipDefaultValue
      : OPENAI_VALUE_TOOLTIP_BY_ROW_KEY[row.key]?.defaultValue,
    tooltipMin: typeof row.tooltipMin !== 'undefined'
      ? row.tooltipMin
      : OPENAI_VALUE_TOOLTIP_BY_ROW_KEY[row.key]?.min,
    tooltipMax: typeof row.tooltipMax !== 'undefined'
      ? row.tooltipMax
      : OPENAI_VALUE_TOOLTIP_BY_ROW_KEY[row.key]?.max,
    tooltipInterval: typeof row.tooltipInterval !== 'undefined'
      ? row.tooltipInterval
      : OPENAI_VALUE_TOOLTIP_BY_ROW_KEY[row.key]?.interval,
    tooltipExpansionNote: row.tooltipExpansionNote || OPENAI_VALUE_TOOLTIP_BY_ROW_KEY[row.key]?.expansionNote,
    tooltipContractionNote: row.tooltipContractionNote || OPENAI_VALUE_TOOLTIP_BY_ROW_KEY[row.key]?.contractionNote,
    tooltipImpact: row.tooltipImpact || OPENAI_VALUE_TOOLTIP_BY_ROW_KEY[row.key]?.impact,
    searchHints: [
      'openai chat api responses request parameters',
      row.key,
      ...(row.searchHints || []),
    ],
    details: {
      area: OPENAI_CHAT_API_DOC_AREA,
      responsibility: row.responsibility,
      notes: row.notes || '',
      modules: row.modules || ['POST /responses'],
      classes: row.classes || ['Request body'],
      functions: row.functions || ['OpenAI Responses API'],
    },
  }))
