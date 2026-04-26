import {
  buildBytePlusTextGenerationFields,
  getBytePlusApiDocRowByRowKey,
  resolveBytePlusTextWidgetChatApiRowKey,
} from '@/features/integrations/byteplusChatApiSsot'
import { resolveOpenAiTextWidgetChatApiRowKey } from '@/features/integrations/openaiResponsesSsot'

export function testBytePlusTextWidgetKtvRowsStayBytePlus() {
  const schemaPaths = [
    'properties.chatProvider',
    'properties.chatModel',
    'properties.chatMessagesJson',
    'properties.chatTopP',
    'properties.chatTemperature',
  ]

  for (const schemaPath of schemaPaths) {
    const bytePlus = resolveBytePlusTextWidgetChatApiRowKey({ schemaPath })
    if (!bytePlus || !bytePlus.startsWith('byteplusApi.')) {
      throw new Error(`Expected BytePlus resolver for ${schemaPath}, got ${String(bytePlus)}`)
    }
    const openAi = resolveOpenAiTextWidgetChatApiRowKey({ schemaPath })
    if (!openAi || !openAi.startsWith('openaiApi.')) {
      throw new Error(`Expected OpenAI resolver for ${schemaPath}, got ${String(openAi)}`)
    }
  }

  const row = getBytePlusApiDocRowByRowKey('byteplusApi.model')
  if (!row || String(row.key || '').trim() !== 'model') {
    throw new Error('Expected BytePlus doc-row lookup for byteplusApi.model')
  }

  const providerField = buildBytePlusTextGenerationFields().find(f => f.fieldKey === 'chatProvider')
  if (!providerField || String(providerField.fieldType || '').trim().toLowerCase() !== 'readonly') {
    throw new Error('Expected BytePlus Text Widget provider field to be readonly')
  }
}

