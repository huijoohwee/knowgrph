import {
  buildBytePlusTextGenerationFields,
  getBytePlusSharedTextApiDocRowByRowKey,
  resolveBytePlusTextWidgetSharedTextApiRowKey,
} from '@/features/integrations/byteplusChatApiSsot'
import { resolveOpenAiTextWidgetChatApiRowKey } from '@/features/integrations/openaiResponsesSsot'
import { BYTEPLUS_VALUE_TOOLTIP_BY_ROW_KEY } from '@/features/integrations/byteplusChatApiSsot.tooltips'
import { BYTEPLUS_MODELARK_MCP_DEFAULT_MODEL } from '@/features/panels/views/byteplusModelArkMcpApiDocs'
import { CHAT_BYTEPLUS_TEXT_MODEL_DEFAULT } from '@/lib/chatEndpoint'

export function testBytePlusTextWidgetKtvRowsStayBytePlus() {
  const schemaPaths = [
    'properties.chatProvider',
    'properties.chatModel',
    'properties.chatMessagesJson',
    'properties.chatTopP',
    'properties.chatTemperature',
  ]

  for (const schemaPath of schemaPaths) {
    const bytePlus = resolveBytePlusTextWidgetSharedTextApiRowKey({ schemaPath })
    if (!bytePlus || !bytePlus.startsWith('byteplusApi.')) {
      throw new Error(`Expected BytePlus resolver for ${schemaPath}, got ${String(bytePlus)}`)
    }
    const openAi = resolveOpenAiTextWidgetChatApiRowKey({ schemaPath })
    if (!openAi || !openAi.startsWith('openaiApi.')) {
      throw new Error(`Expected OpenAI resolver for ${schemaPath}, got ${String(openAi)}`)
    }
  }

  const row = getBytePlusSharedTextApiDocRowByRowKey('byteplusApi.model')
  if (!row || String(row.key || '').trim() !== 'model') {
    throw new Error('Expected BytePlus doc-row lookup for byteplusApi.model')
  }

  const providerField = buildBytePlusTextGenerationFields().find(f => f.fieldKey === 'chatProvider')
  if (!providerField || String(providerField.fieldType || '').trim().toLowerCase() !== 'readonly') {
    throw new Error('Expected BytePlus Text Widget provider field to be readonly')
  }

  if (
    BYTEPLUS_VALUE_TOOLTIP_BY_ROW_KEY.model?.defaultValue !== CHAT_BYTEPLUS_TEXT_MODEL_DEFAULT
    || BYTEPLUS_MODELARK_MCP_DEFAULT_MODEL !== CHAT_BYTEPLUS_TEXT_MODEL_DEFAULT
  ) {
    throw new Error('Expected BytePlus runtime, tooltip, and MCP docs to reuse one default text model')
  }
}
