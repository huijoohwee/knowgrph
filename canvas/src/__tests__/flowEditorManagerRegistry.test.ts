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
  getWidgetRegistryEntryLabel,
  inferTextGenerationProviderFamily,
  getTextGenerationWidgetLabel,
  normalizeTextGenerationWidgetPropertiesForProviderFamily,
  resolveEffectiveTextGenerationWidgetProperties,
} from '@/features/flow-editor-manager/registryTemplates'
import {
  FLOW_GRABMAPS_DISCOVERY_FORM_ID,
  FLOW_GRABMAPS_DISCOVERY_NODE_TYPE_ID,
  FLOW_GRABMAPS_DISCOVERY_WIDGET_TYPE_ID,
} from '@/features/flow-editor-manager/grabMapsDiscoveryWidget'
import {
  FLOW_IMAGE_GENERATION_NODE_TYPE_ID,
  FLOW_OPENAI_VIDEO_SCRIPT_FORM_ID,
  FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID,
  FLOW_TEXT_GENERATION_NODE_TYPE_ID,
  FLOW_VIDEO_SCRIPT_FORM_ID,
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
  const videoScriptFound = seeded.find(
    e => e.nodeTypeId === FLOW_TEXT_GENERATION_NODE_TYPE_ID && e.widgetTypeId === 'default' && e.formId === FLOW_VIDEO_SCRIPT_FORM_ID,
  )
  const openAiVideoScriptFound = seeded.find(
    e => e.nodeTypeId === FLOW_TEXT_GENERATION_NODE_TYPE_ID && e.widgetTypeId === 'default' && e.formId === FLOW_OPENAI_VIDEO_SCRIPT_FORM_ID,
  )
  const richMediaPanelFound = seeded.find(
    e => e.nodeTypeId === FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID && e.widgetTypeId === 'default' && e.formId === 'richMediaPanel',
  )
  const discoveryFound = seeded.find(
    e => e.nodeTypeId === FLOW_GRABMAPS_DISCOVERY_NODE_TYPE_ID && e.widgetTypeId === FLOW_GRABMAPS_DISCOVERY_WIDGET_TYPE_ID && e.formId === FLOW_GRABMAPS_DISCOVERY_FORM_ID,
  )
  if (!imageFound) throw new Error('expected BytePlus Image Widget mapping')
  if (!textFound) throw new Error('expected Text Widget mapping')
  if (!videoScriptFound) throw new Error('expected BytePlus Video Script Widget mapping')
  if (!openAiVideoScriptFound) throw new Error('expected OpenAI Video Script Widget mapping')
  if (!richMediaPanelFound) throw new Error('expected Rich Media Panel mapping')
  if (!discoveryFound) throw new Error('expected GrabMaps Chat Discovery Widget mapping')
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

export function testFlowEditorManagerSeedsGrabMapsDiscoveryRegistryEntry() {
  const seeded = ensureDefaultWidgetRegistryEntries([], '2026-02-06T00:00:00.000Z')
  const discoveryEntry = seeded.entries.find(
    entry => entry.nodeTypeId === FLOW_GRABMAPS_DISCOVERY_NODE_TYPE_ID && entry.formId === FLOW_GRABMAPS_DISCOVERY_FORM_ID,
  )
  if (!discoveryEntry) throw new Error('expected default widget registry seed to include GrabMaps Chat Discovery Widget entry')
  const fieldKeys = new Set((discoveryEntry.fields || []).map(field => field.fieldKey))
  ;['chatModel', 'searchQuery', 'searchCountry', 'nearbyRadiusKm', 'nearbyRankBy'].forEach(key => {
    if (!fieldKeys.has(key)) throw new Error(`expected seeded GrabMaps Chat Discovery Widget entry to expose ${key}`)
  })
  const label = getWidgetRegistryEntryLabel(discoveryEntry)
  if (label !== 'GrabMaps Chat Discovery Widget') {
    throw new Error(`expected shared widget label helper to classify GrabMaps Chat Discovery Widget, got ${String(label)}`)
  }
}

export function testFlowEditorManagerCanonicalizesConflictingGrabMapsDiscoveryRegistryEntry() {
  const normalized = normalizeWidgetRegistryEntries([
    {
      id: 'legacy-grabmaps-video-collision',
      isEnabled: true,
      nodeTypeId: FLOW_VIDEO_GENERATION_NODE_TYPE_ID,
      widgetTypeId: 'default',
      formId: FLOW_GRABMAPS_DISCOVERY_FORM_ID,
      fields: [
        { fieldKey: 'model', fieldType: 'text', schemaPath: 'properties.model' },
        { fieldKey: 'aspect_ratio', fieldType: 'select', schemaPath: 'properties.aspect_ratio' },
        { fieldKey: 'duration', fieldType: 'number', schemaPath: 'properties.duration' },
        { fieldKey: 'resolution', fieldType: 'select', schemaPath: 'properties.resolution' },
        { fieldKey: 'generate_audio', fieldType: 'boolean', schemaPath: 'properties.generate_audio' },
      ],
      ports: [],
      updatedAt: '2026-04-24T00:00:00.000Z',
    },
  ] as any)
  const discoveryEntries = normalized.filter(
    entry =>
      entry.nodeTypeId === FLOW_GRABMAPS_DISCOVERY_NODE_TYPE_ID
      || entry.formId === FLOW_GRABMAPS_DISCOVERY_FORM_ID,
  )
  if (discoveryEntries.length !== 1) {
    throw new Error(`expected exactly one canonical GrabMaps Chat Discovery Widget entry after normalization, got ${discoveryEntries.length}`)
  }
  const discoveryEntry = discoveryEntries[0]!
  if (discoveryEntry.nodeTypeId !== FLOW_GRABMAPS_DISCOVERY_NODE_TYPE_ID) {
    throw new Error(`expected conflicting discovery entry to normalize to ${FLOW_GRABMAPS_DISCOVERY_NODE_TYPE_ID}, got ${String(discoveryEntry.nodeTypeId)}`)
  }
  if (discoveryEntry.widgetTypeId !== FLOW_GRABMAPS_DISCOVERY_WIDGET_TYPE_ID) {
    throw new Error(`expected conflicting discovery entry to normalize widgetTypeId to ${FLOW_GRABMAPS_DISCOVERY_WIDGET_TYPE_ID}, got ${String(discoveryEntry.widgetTypeId)}`)
  }
  const fieldKeys = new Set((discoveryEntry.fields || []).map(field => field.fieldKey))
  ;['chatModel', 'searchQuery', 'searchCountry', 'nearbyRadiusKm', 'nearbyRankBy'].forEach(key => {
    if (!fieldKeys.has(key)) throw new Error(`expected canonicalized GrabMaps Chat Discovery Widget entry to expose ${key}`)
  })
  ;['model', 'aspect_ratio', 'duration', 'resolution', 'generate_audio'].forEach(key => {
    if (fieldKeys.has(key)) throw new Error(`expected canonicalized GrabMaps Chat Discovery Widget entry to remove conflicting stale field ${key}`)
  })
}

export function testFlowEditorManagerCanonicalizesConflictingBuiltInWidgetForms() {
  const normalized = normalizeWidgetRegistryEntries([
    {
      id: 'legacy-image-collision',
      isEnabled: true,
      nodeTypeId: FLOW_VIDEO_GENERATION_NODE_TYPE_ID,
      widgetTypeId: 'default',
      formId: 'imageGeneration',
      fields: [
        { fieldKey: 'aspect_ratio', fieldType: 'select', schemaPath: 'properties.aspect_ratio' },
        { fieldKey: 'duration', fieldType: 'select', schemaPath: 'properties.duration' },
      ],
      ports: [],
      updatedAt: '2026-04-24T00:00:00.000Z',
    },
    {
      id: 'legacy-video-collision',
      isEnabled: true,
      nodeTypeId: FLOW_IMAGE_GENERATION_NODE_TYPE_ID,
      widgetTypeId: 'default',
      formId: 'videoGeneration',
      fields: [
        { fieldKey: 'size', fieldType: 'select', schemaPath: 'properties.size' },
        { fieldKey: 'output_format', fieldType: 'select', schemaPath: 'properties.output_format' },
      ],
      ports: [],
      updatedAt: '2026-04-24T00:00:00.000Z',
    },
    {
      id: 'legacy-text-collision',
      isEnabled: true,
      nodeTypeId: FLOW_VIDEO_GENERATION_NODE_TYPE_ID,
      widgetTypeId: 'default',
      formId: 'textGeneration',
      fields: [
        { fieldKey: 'resolution', fieldType: 'select', schemaPath: 'properties.resolution' },
        { fieldKey: 'generate_audio', fieldType: 'boolean', schemaPath: 'properties.generate_audio' },
      ],
      ports: [],
      updatedAt: '2026-04-24T00:00:00.000Z',
    },
    {
      id: 'legacy-openai-collision',
      isEnabled: true,
      nodeTypeId: FLOW_IMAGE_GENERATION_NODE_TYPE_ID,
      widgetTypeId: 'default',
      formId: 'textGeneration.openai',
      fields: [
        { fieldKey: 'size', fieldType: 'select', schemaPath: 'properties.size' },
        { fieldKey: 'watermark', fieldType: 'boolean', schemaPath: 'properties.watermark' },
      ],
      ports: [],
      updatedAt: '2026-04-24T00:00:00.000Z',
    },
  ] as any)

  const imageEntry = normalized.find(entry => entry.formId === 'imageGeneration')
  if (!imageEntry) throw new Error('expected canonical imageGeneration entry after normalization')
  if (imageEntry.nodeTypeId !== FLOW_IMAGE_GENERATION_NODE_TYPE_ID) {
    throw new Error(`expected imageGeneration to normalize to ${FLOW_IMAGE_GENERATION_NODE_TYPE_ID}, got ${String(imageEntry.nodeTypeId)}`)
  }
  const imageFieldKeys = new Set((imageEntry.fields || []).map(field => field.fieldKey))
  ;['model', 'size', 'output_format', 'aspect_ratio', 'reference_image'].forEach(key => {
    if (!imageFieldKeys.has(key)) throw new Error(`expected canonical imageGeneration entry to expose ${key}`)
  })
  ;['duration', 'generate_audio'].forEach(key => {
    if (imageFieldKeys.has(key)) throw new Error(`expected canonical imageGeneration entry to remove stale key ${key}`)
  })

  const videoEntry = normalized.find(entry => entry.formId === 'videoGeneration')
  if (!videoEntry) throw new Error('expected canonical videoGeneration entry after normalization')
  if (videoEntry.nodeTypeId !== FLOW_VIDEO_GENERATION_NODE_TYPE_ID) {
    throw new Error(`expected videoGeneration to normalize to ${FLOW_VIDEO_GENERATION_NODE_TYPE_ID}, got ${String(videoEntry.nodeTypeId)}`)
  }
  const videoFieldKeys = new Set((videoEntry.fields || []).map(field => field.fieldKey))
  ;['model', 'ratio', 'resolution', 'duration', 'generate_audio'].forEach(key => {
    if (!videoFieldKeys.has(key)) throw new Error(`expected canonical videoGeneration entry to expose ${key}`)
  })
  ;['size', 'output_format', 'aspect_ratio'].forEach(key => {
    if (videoFieldKeys.has(key)) throw new Error(`expected canonical videoGeneration entry to remove stale key ${key}`)
  })

  const byteplusTextEntry = normalized.find(entry => entry.formId === 'textGeneration')
  if (!byteplusTextEntry) throw new Error('expected canonical textGeneration entry after normalization')
  if (byteplusTextEntry.nodeTypeId !== FLOW_TEXT_GENERATION_NODE_TYPE_ID) {
    throw new Error(`expected textGeneration to normalize to ${FLOW_TEXT_GENERATION_NODE_TYPE_ID}, got ${String(byteplusTextEntry.nodeTypeId)}`)
  }
  const byteplusTextFieldKeys = new Set((byteplusTextEntry.fields || []).map(field => field.fieldKey))
  ;['chatMessagesJson', 'chatResponseFormatJson', 'chatThinkingJson', 'chatTopP'].forEach(key => {
    if (!byteplusTextFieldKeys.has(key)) throw new Error(`expected canonical textGeneration entry to expose ${key}`)
  })
  ;['resolution', 'generate_audio', 'aspect_ratio', 'duration'].forEach(key => {
    if (byteplusTextFieldKeys.has(key)) throw new Error(`expected canonical textGeneration entry to remove stale key ${key}`)
  })

  const openAiTextEntry = normalized.find(entry => entry.formId === 'textGeneration.openai')
  if (!openAiTextEntry) throw new Error('expected canonical textGeneration.openai entry after normalization')
  if (openAiTextEntry.nodeTypeId !== FLOW_TEXT_GENERATION_NODE_TYPE_ID) {
    throw new Error(`expected textGeneration.openai to normalize to ${FLOW_TEXT_GENERATION_NODE_TYPE_ID}, got ${String(openAiTextEntry.nodeTypeId)}`)
  }
  const openAiTextFieldKeys = new Set((openAiTextEntry.fields || []).map(field => field.fieldKey))
  ;['chatMessagesJson', 'chatResponseFormatJson', 'chatTopP', 'chatParallelToolCalls'].forEach(key => {
    if (!openAiTextFieldKeys.has(key)) throw new Error(`expected canonical textGeneration.openai entry to expose ${key}`)
  })
  ;['size', 'watermark', 'resolution', 'generate_audio'].forEach(key => {
    if (openAiTextFieldKeys.has(key)) throw new Error(`expected canonical textGeneration.openai entry to remove stale key ${key}`)
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
      chatEndpointUrl: 'https://api.openai.com/v1/responses',
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
