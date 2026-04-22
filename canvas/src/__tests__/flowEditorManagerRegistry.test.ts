import { MemoryStorage } from '@/tests/lib/memoryStorage'
import {
  normalizeWidgetRegistryEntries,
  ensureDefaultWidgetRegistryEntries,
  readWidgetRegistryFromStorage,
  validateWidgetRegistryEntry,
  writeWidgetRegistryToStorage,
} from '@/hooks/store/flowEditorManagerSlice'
import {
  buildTextGenerationRegistryDraft,
  inferTextGenerationProviderFamily,
  getTextGenerationWidgetLabel,
  normalizeTextGenerationWidgetPropertiesForProviderFamily,
  resolveEffectiveTextGenerationWidgetProperties,
} from '@/features/flow-editor-manager/registryTemplates'
import {
  FLOW_IMAGE_GENERATION_NODE_TYPE_ID,
  FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID,
  FLOW_TEXT_GENERATION_NODE_TYPE_ID,
  FLOW_VIDEO_GENERATION_NODE_TYPE_ID,
} from '@/lib/config'
import {
  CHAT_BYTEPLUS_AP_SOUTHEAST_ENDPOINT_URL,
  CHAT_BYTEPLUS_TEXT_MODEL_DEFAULT,
  CHAT_PROVIDER_BYTEPLUS,
} from '@/lib/chatEndpoint'

export function testFlowEditorManagerRegistryValidatesAndNormalizes() {
  const valid = validateWidgetRegistryEntry({
    id: 'e1',
    isEnabled: true,
    nodeTypeId: 'Schema',
    widgetTypeId: 'Widget',
    formId: 'default',
    fields: [{ fieldKey: 'label', fieldType: 'text', schemaPath: 'label' }],
    ports: [],
    updatedAt: new Date().toISOString(),
  })
  if (!valid) throw new Error('expected entry to validate')

  const invalidEmpty = validateWidgetRegistryEntry({
    id: 'e2',
    isEnabled: true,
    nodeTypeId: 'Schema',
    widgetTypeId: 'Widget',
    formId: 'default',
    fields: [],
    ports: [],
    updatedAt: new Date().toISOString(),
  })
  if (invalidEmpty) throw new Error('expected entry with no fields/ports to be rejected')

  const normalized = normalizeWidgetRegistryEntries([
    {
      id: 'e1',
      isEnabled: true,
      nodeTypeId: 'B',
      widgetTypeId: 'Widget',
      formId: 'default',
      fields: [{ fieldKey: 'label', fieldType: 'text' }],
      ports: [],
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'e0',
      isEnabled: true,
      nodeTypeId: 'A',
      widgetTypeId: 'Widget',
      formId: 'default',
      fields: [{ fieldKey: 'label', fieldType: 'text' }],
      ports: [],
      updatedAt: new Date().toISOString(),
    },
  ])
  if (normalized.length !== 2) throw new Error('expected two entries after normalization')
  if (normalized[0].nodeTypeId !== 'A') throw new Error('expected normalization to sort by nodeTypeId')
}

export function testFlowEditorManagerRegistryStorageRoundTrip() {
  const storage = new MemoryStorage()
  const entries = [
    {
      id: 'e1',
      isEnabled: true,
      nodeTypeId: 'Schema',
      widgetTypeId: 'Widget',
      formId: 'default',
      fields: [{ fieldKey: 'label', fieldType: 'text', schemaPath: 'label' }],
      ports: [{ direction: 'input' as const, portKey: 'field:id' }],
      updatedAt: new Date().toISOString(),
    },
  ]

  writeWidgetRegistryToStorage(storage, entries)
  const reread = readWidgetRegistryFromStorage(storage)
  if (reread.length !== 1) throw new Error('expected one entry after read')
  if (reread[0].id !== 'e1') throw new Error('expected id to round trip')
  if (reread[0].ports.length !== 1) throw new Error('expected ports to round trip')
}

export function testFlowEditorManagerSeedsGenerateVideoRegistryEntry() {
  const empty = ensureDefaultWidgetRegistryEntries([], '2026-02-06T00:00:00.000Z')
  if (!empty.changed) throw new Error('expected seeding to report changed=true')
  const seeded = empty.entries
  const imageFound = seeded.find(
    e => e.nodeTypeId === FLOW_IMAGE_GENERATION_NODE_TYPE_ID && e.widgetTypeId === 'default' && e.formId === 'imageGeneration',
  )
  const found = seeded.find(
    e => e.nodeTypeId === FLOW_VIDEO_GENERATION_NODE_TYPE_ID && e.widgetTypeId === 'default' && e.formId === 'videoGeneration',
  )
  const textFound = seeded.find(
    e => e.nodeTypeId === FLOW_TEXT_GENERATION_NODE_TYPE_ID && e.widgetTypeId === 'default' && e.formId === 'textGeneration',
  )
  const richMediaPanelFound = seeded.find(
    e => e.nodeTypeId === FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID && e.widgetTypeId === 'default' && e.formId === 'richMediaPanel',
  )
  if (!imageFound) throw new Error('expected Image Widget mapping')
  if (!textFound) throw new Error('expected Text Widget mapping')
  if (!richMediaPanelFound) throw new Error('expected Rich Media Panel mapping')
  if (!found) throw new Error('expected Generate Video mapping')

  const stable = ensureDefaultWidgetRegistryEntries(seeded, '2026-02-06T00:00:00.000Z')
  if (stable.changed) throw new Error('expected seeding to be idempotent')
}

export function testFlowEditorManagerReconcilesStaleBuiltInTextRegistryEntry() {
  const stale = ensureDefaultWidgetRegistryEntries([
    {
      id: 'legacy-text',
      isEnabled: true,
      nodeTypeId: FLOW_TEXT_GENERATION_NODE_TYPE_ID,
      widgetTypeId: 'default',
      formId: 'textGeneration',
      fields: [
        { fieldKey: 'chatProvider', fieldType: 'text', schemaPath: 'properties.chatProvider' },
        { fieldKey: 'chatApiKey', fieldType: 'text', schemaPath: 'properties.chatApiKey' },
        { fieldKey: 'aspect_ratio', fieldType: 'select', schemaPath: 'properties.aspect_ratio' },
      ],
      ports: [{ portKey: 'prompt_in', direction: 'input', schemaPath: 'properties.prompt' }],
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ] as any, '2026-02-06T00:00:00.000Z')
  if (!stale.changed) throw new Error('expected stale built-in text entry to be reconciled')
  const reconciled = stale.entries.find(
    e => e.nodeTypeId === FLOW_TEXT_GENERATION_NODE_TYPE_ID && e.widgetTypeId === 'default' && e.formId === 'textGeneration',
  )
  if (!reconciled) throw new Error('expected reconciled built-in text entry')
  const fieldKeys = new Set(reconciled.fields.map(field => field.fieldKey))
  ;['chatResponseFormatJson', 'chatThinkingJson', 'chatTopP', 'chatMessagesJson'].forEach(key => {
    if (!fieldKeys.has(key)) throw new Error(`expected reconciled built-in text entry to add ${key}`)
  })
  ;['chatApiKey', 'aspect_ratio'].forEach(key => {
    if (fieldKeys.has(key)) throw new Error(`expected reconciled built-in text entry to remove stale key ${key}`)
  })
  const stable = ensureDefaultWidgetRegistryEntries(stale.entries, '2026-02-06T00:00:00.000Z')
  if (stable.changed) throw new Error('expected stale built-in text entry reconciliation to become idempotent after repair')
}

export function testFlowEditorManagerBuildsReusableTextRegistryDrafts() {
  const openAiDraft = buildTextGenerationRegistryDraft({ providerFamily: 'openai' })
  if (openAiDraft.nodeTypeId !== FLOW_TEXT_GENERATION_NODE_TYPE_ID) {
    throw new Error(`expected openai text draft to reuse TextGeneration node type, got ${String(openAiDraft.nodeTypeId)}`)
  }
  if (openAiDraft.formId !== 'textGeneration.openai') {
    throw new Error(`expected openai text draft to keep a provider-specific form id, got ${String(openAiDraft.formId)}`)
  }
  if (!openAiDraft.fields.some(field => field.fieldKey === 'chatModel')) {
    throw new Error('expected reusable text draft to keep the shared chatModel field')
  }
  const openAiFieldKeys = new Set(openAiDraft.fields.map(field => field.fieldKey))
  ;['chatMessagesJson', 'chatResponseFormatJson', 'chatToolsJson', 'chatToolChoiceJson', 'chatTopP'].forEach(key => {
    if (!openAiFieldKeys.has(key)) {
      throw new Error(`expected openai text draft to expose ${key}`)
    }
  })
  ;['chatThinkingJson', 'chatThinkingType', 'chatServiceTier'].forEach(key => {
    if (openAiFieldKeys.has(key)) {
      throw new Error(`expected openai text draft to avoid BytePlus-only field ${key}`)
    }
  })

  const bytePlusDraft = buildTextGenerationRegistryDraft({ providerFamily: 'byteplus' })
  const bytePlusFieldKeys = new Set(bytePlusDraft.fields.map(field => field.fieldKey))
  ;['chatResponseFormatJson', 'chatThinkingJson', 'chatTopP', 'chatMessagesJson', 'chatToolsJson'].forEach(key => {
    if (!bytePlusFieldKeys.has(key)) {
      throw new Error(`expected byteplus text draft to expose ${key}`)
    }
  })
  ;['chatApiKey', 'aspect_ratio', 'duration', 'resolution', 'generate_audio', 'reference_image', 'fast'].forEach(key => {
    if (bytePlusFieldKeys.has(key)) {
      throw new Error(`expected byteplus text draft to exclude stale or non-chat field ${key}`)
    }
  })

  const zaiDraft = buildTextGenerationRegistryDraft({ providerFamily: 'zai' })
  if (zaiDraft.formId !== 'textGeneration.zai') {
    throw new Error(`expected z.ai text draft to keep a provider-specific form id, got ${String(zaiDraft.formId)}`)
  }
  if (!zaiDraft.fields.some(field => field.fieldKey === 'chatMessagesJson')) {
    throw new Error('expected z.ai text draft scaffold to stay on the OpenAI-compatible text widget field set')
  }
  const zaiLabel = getTextGenerationWidgetLabel({ formId: zaiDraft.formId })
  if (zaiLabel !== 'z.ai Text Widget') {
    throw new Error(`expected z.ai label helper to classify future text widgets, got ${String(zaiLabel)}`)
  }
}

export function testFlowEditorManagerSeedsOpenAiTextRegistryEntry() {
  const seeded = ensureDefaultWidgetRegistryEntries([], '2026-02-06T00:00:00.000Z')
  const openAiEntry = seeded.entries.find(entry => entry.nodeTypeId === FLOW_TEXT_GENERATION_NODE_TYPE_ID && entry.formId === 'textGeneration.openai')
  if (!openAiEntry) throw new Error('expected default widget registry seed to include OpenAI text widget entry')
  const fieldKeys = new Set((openAiEntry.fields || []).map(field => field.fieldKey))
  ;['chatMessagesJson', 'chatResponseFormatJson', 'chatToolsJson'].forEach(key => {
    if (!fieldKeys.has(key)) throw new Error(`expected seeded OpenAI text widget entry to expose ${key}`)
  })
}

export function testFlowEditorManagerNormalizesBytePlusTextWidgetProviderDefaults() {
  const family = inferTextGenerationProviderFamily({
    provider: 'openai',
    widgetTypeId: 'default',
    formId: 'textGeneration',
  })
  if (family !== 'byteplus') {
    throw new Error(`expected default textGeneration form to stay BytePlus, got ${String(family)}`)
  }

  const normalized = normalizeTextGenerationWidgetPropertiesForProviderFamily({
    providerFamily: family,
    properties: {
      chatProvider: 'openai',
      chatEndpointUrl: 'https://api.openai.com/v1/chat/completions',
      chatModel: 'gpt-5.4-nano',
      prompt: 'hello',
    },
  })
  if (String(normalized.chatProvider || '') !== CHAT_PROVIDER_BYTEPLUS) {
    throw new Error(`expected BytePlus normalization to force provider ${CHAT_PROVIDER_BYTEPLUS}`)
  }
  if (String(normalized.chatEndpointUrl || '') !== CHAT_BYTEPLUS_AP_SOUTHEAST_ENDPOINT_URL) {
    throw new Error(`expected BytePlus normalization to force endpoint ${CHAT_BYTEPLUS_AP_SOUTHEAST_ENDPOINT_URL}`)
  }
  if (String(normalized.chatModel || '') !== CHAT_BYTEPLUS_TEXT_MODEL_DEFAULT) {
    throw new Error(`expected BytePlus normalization to force model ${CHAT_BYTEPLUS_TEXT_MODEL_DEFAULT}`)
  }

  const effective = resolveEffectiveTextGenerationWidgetProperties({
    providerFamily: 'byteplus',
    localProperties: {
      prompt: 'hello',
    },
    globalProperties: {
      chatProvider: 'byteplus-modelark',
      chatEndpointUrl: CHAT_BYTEPLUS_AP_SOUTHEAST_ENDPOINT_URL,
      chatModel: CHAT_BYTEPLUS_TEXT_MODEL_DEFAULT,
    },
  })
  if (String(effective.chatProvider || '') !== CHAT_PROVIDER_BYTEPLUS) {
    throw new Error(`expected effective BytePlus widget properties to fall back to global provider ${CHAT_PROVIDER_BYTEPLUS}`)
  }
  if (String(effective.chatEndpointUrl || '') !== CHAT_BYTEPLUS_AP_SOUTHEAST_ENDPOINT_URL) {
    throw new Error(`expected effective BytePlus widget properties to fall back to global endpoint ${CHAT_BYTEPLUS_AP_SOUTHEAST_ENDPOINT_URL}`)
  }
  if (String(effective.chatModel || '') !== CHAT_BYTEPLUS_TEXT_MODEL_DEFAULT) {
    throw new Error(`expected effective BytePlus widget properties to fall back to global model ${CHAT_BYTEPLUS_TEXT_MODEL_DEFAULT}`)
  }
}
