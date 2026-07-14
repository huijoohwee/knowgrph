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
import {
  getDeerFlowApiRowAnchorId,
  mapOpenAiRowKeyToDeerFlowRowKey,
} from './chatApiDocAnchors'

export const DEERFLOW_API_DOC_AREA = 'DeerFlow Gateway API'

export { getDeerFlowApiRowAnchorId, mapOpenAiRowKeyToDeerFlowRowKey }

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
        return 'Orchestrator -> pin DeerFlow Gateway provider routing -> keep MainPanel Integrations, Flow Manager, and Widget Card provider semantics aligned.'
      }
      if (row.key === 'endpoint_url') {
        return 'Transport -> route requests to DeerFlow Gateway OpenAI-compatible endpoint -> keep Dev localhost and Prod Cloudflare Tunnel routing on one endpoint SSOT.'
      }
      return row.responsibility
    })()
    const notes = (() => {
      if (row.key === 'endpoint_url') {
        return 'DeerFlow runs on your local machine in both Dev and Prod; Prod exposure uses Cloudflare Tunnel URL ending with /api/llm/chat/completions.'
      }
      return row.notes || ''
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
        notes,
        modules: row.modules || ['POST /api/llm/chat/completions'],
        classes: row.classes || ['Request body'],
        functions: row.functions || ['DeerFlow Gateway LLM proxy'],
      },
    }
  })
