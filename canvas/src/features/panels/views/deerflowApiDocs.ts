import type { VirtualSettingsEntry } from './byteplusSharedTextApiDocs'
import type { SettingMeta } from '@/features/settings/types'
import {
  OPENAI_KEY_ACTIONS_BY_VALUE_KEY,
  OPENAI_RESPONSES_API_DOC_ROWS,
  OPENAI_VALUE_TOOLTIP_BY_ROW_KEY,
} from '@/features/integrations/openaiResponsesSsot'
import {
  CHAT_DEERFLOW_ENDPOINT_URL,
  CHAT_PROVIDER_DEERFLOW,
} from '@/lib/chatEndpoint'

export const DEERFLOW_API_DOC_AREA = 'DeerFlow Gateway API'

export function getDeerFlowApiRowAnchorId(rowKey: string): string {
  const normalized = String(rowKey || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `deerflow-api-row-${normalized || 'entry'}`
}

export function mapOpenAiRowKeyToDeerFlowRowKey(rowKey: string): string {
  const normalized = String(rowKey || '').trim()
  if (!normalized) return ''
  if (normalized.startsWith('openaiApi.')) {
    return `deerflowApi.${normalized.slice('openaiApi.'.length)}`
  }
  return `deerflowApi.${normalized}`
}

const toBaseType = (typeLabel: string): SettingMeta['type'] => {
  const normalized = String(typeLabel || '').trim().toLowerCase()
  if (normalized.includes('boolean')) return 'boolean'
  if (normalized.includes('integer') || normalized.includes('float') || normalized.includes('number')) return 'number'
  if (normalized.includes('object') || normalized.includes('[]')) return 'json'
  return 'string'
}

const DEERFLOW_TOOLTIP_ROLE = 'DeerFlow Gateway API'

export const DEERFLOW_API_REQUEST_DOC_ENTRIES: ReadonlyArray<VirtualSettingsEntry> =
  OPENAI_RESPONSES_API_DOC_ROWS.map(row => {
    const deerFlowRowKey = mapOpenAiRowKeyToDeerFlowRowKey(`openaiApi.${row.key}`)
    const openAiTooltipKey = String(row.key || '').trim()
    const defaultValue = (() => {
      if (row.key === 'provider') return CHAT_PROVIDER_DEERFLOW
      if (row.key === 'endpoint_url') return CHAT_DEERFLOW_ENDPOINT_URL
      return row.value
    })()
    const responsibility = (() => {
      if (row.key === 'provider') {
        return 'Orchestrator -> pin DeerFlow Gateway provider routing -> keep MainPanel Integrations, Flow Manager, and Text Widget provider semantics aligned.'
      }
      if (row.key === 'endpoint_url') {
        return 'Transport -> route requests to DeerFlow Gateway OpenAI-compatible endpoint -> keep local gateway defaults and run dispatch on one endpoint SSOT.'
      }
      return row.responsibility
    })()
    return {
      meta: {
        key: deerFlowRowKey,
        type: toBaseType(row.typeLabel),
        source: 'backendEnv',
        read: () => defaultValue,
      },
      value: defaultValue,
      valueKey: row.valueKey,
      typeLabel: row.typeLabel,
      tooltipRole: row.valueKey ? DEERFLOW_TOOLTIP_ROLE : undefined,
      tooltipActions: row.valueKey ? OPENAI_KEY_ACTIONS_BY_VALUE_KEY[row.valueKey] : undefined,
      tooltipDefaultValue: typeof row.tooltipDefaultValue !== 'undefined'
        ? row.tooltipDefaultValue
        : OPENAI_VALUE_TOOLTIP_BY_ROW_KEY[openAiTooltipKey]?.defaultValue,
      tooltipMin: typeof row.tooltipMin !== 'undefined'
        ? row.tooltipMin
        : OPENAI_VALUE_TOOLTIP_BY_ROW_KEY[openAiTooltipKey]?.min,
      tooltipMax: typeof row.tooltipMax !== 'undefined'
        ? row.tooltipMax
        : OPENAI_VALUE_TOOLTIP_BY_ROW_KEY[openAiTooltipKey]?.max,
      tooltipInterval: typeof row.tooltipInterval !== 'undefined'
        ? row.tooltipInterval
        : OPENAI_VALUE_TOOLTIP_BY_ROW_KEY[openAiTooltipKey]?.interval,
      tooltipExpansionNote: row.tooltipExpansionNote || OPENAI_VALUE_TOOLTIP_BY_ROW_KEY[openAiTooltipKey]?.expansionNote,
      tooltipContractionNote: row.tooltipContractionNote || OPENAI_VALUE_TOOLTIP_BY_ROW_KEY[openAiTooltipKey]?.contractionNote,
      tooltipImpact: row.tooltipImpact || OPENAI_VALUE_TOOLTIP_BY_ROW_KEY[openAiTooltipKey]?.impact,
      searchHints: [
        'deerflow gateway openai-compatible llm request parameters',
        row.key,
        ...(row.searchHints || []),
      ],
      details: {
        area: DEERFLOW_API_DOC_AREA,
        responsibility,
        notes: row.notes || '',
        modules: row.modules || ['POST /api/llm/chat/completions'],
        classes: row.classes || ['Request body'],
        functions: row.functions || ['DeerFlow Gateway LLM proxy'],
      },
    }
  })

