import type { WidgetRegistryEntry } from '@/features/flow-editor-manager/widgetRegistryTypes'
import {
  CHAT_BYTEPLUS_AP_SOUTHEAST_ENDPOINT_URL,
  CHAT_BYTEPLUS_TEXT_MODEL_DEFAULT,
  CHAT_OPENAI_ENDPOINT_URL,
  CHAT_PROVIDER_BYTEPLUS,
  CHAT_PROVIDER_OPENAI,
  getDefaultChatModelForProvider,
  normalizeChatProviderId,
} from '@/lib/chatEndpoint'
import {
  FLOW_EDITOR_ASPECT_RATIO_OPTIONS,
  FLOW_EDITOR_DURATION_SECONDS_OPTIONS,
  FLOW_EDITOR_RESOLUTION_OPTIONS,
  FLOW_EDITOR_VIDEO_MODEL_OPTIONS,
  FLOW_IMAGE_GENERATION_NODE_LABEL,
  FLOW_IMAGE_GENERATION_NODE_TYPE_ID,
  FLOW_RICH_MEDIA_PANEL_FORM_ID,
  FLOW_RICH_MEDIA_PANEL_NODE_LABEL,
  FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID,
  FLOW_RICH_MEDIA_PANEL_WIDGET_TYPE_ID,
  FLOW_TEXT_GENERATION_NODE_LABEL,
  FLOW_TEXT_GENERATION_NODE_TYPE_ID,
  FLOW_VIDEO_TRANSCRIBER_FORM_ID,
  FLOW_VIDEO_TRANSCRIBER_NODE_LABEL,
  FLOW_VIDEO_TRANSCRIBER_NODE_TYPE_ID,
  FLOW_VIDEO_TRANSCRIBER_WIDGET_TYPE_ID,
  FLOW_VIDEO_SCRIPT_FORM_ID,
  FLOW_VIDEO_SCRIPT_WIDGET_LABEL,
  FLOW_VIDEO_GENERATION_NODE_LABEL,
  FLOW_VIDEO_GENERATION_NODE_TYPE_ID,
} from '@/lib/config.flow-editor'
import {
  getGrabMapsDiscoveryWidgetLabel,
  isGrabMapsDiscoveryWidgetEntry,
} from '@/features/flow-editor-manager/grabMapsDiscoveryWidget'
import { buildBytePlusTextGenerationFields } from '@/features/integrations/byteplusChatApiSsot'
import { buildBytePlusImageGenerationFields } from '@/features/integrations/byteplusImageGenerationSsot'
import { buildBytePlusVideoGenerationFields } from '@/features/integrations/byteplusVideoGenerationSsot'
import { buildOpenAiCompatibleTextGenerationFields } from '@/features/integrations/openaiResponsesSsot'

export type TextGenerationProviderFamily = 'byteplus' | 'openai' | 'zai'

type TextGenerationProviderProfile = {
  providerId: string
  defaultEndpointUrl: string
  defaultModel: string
  widgetLabel: string
}

const TEXT_GENERATION_PROVIDER_PROFILE_BY_FAMILY: Readonly<Record<TextGenerationProviderFamily, TextGenerationProviderProfile>> = {
  byteplus: {
    providerId: CHAT_PROVIDER_BYTEPLUS,
    defaultEndpointUrl: CHAT_BYTEPLUS_AP_SOUTHEAST_ENDPOINT_URL,
    defaultModel: CHAT_BYTEPLUS_TEXT_MODEL_DEFAULT,
    widgetLabel: 'BytePlus Text Widget',
  },
  openai: {
    providerId: CHAT_PROVIDER_OPENAI,
    defaultEndpointUrl: CHAT_OPENAI_ENDPOINT_URL,
    defaultModel: getDefaultChatModelForProvider(CHAT_PROVIDER_OPENAI),
    widgetLabel: 'OpenAI Text Widget',
  },
  zai: {
    providerId: CHAT_PROVIDER_OPENAI,
    defaultEndpointUrl: 'https://api.z.ai/api/paas/v4/chat/completions',
    defaultModel: 'glm-5.1',
    widgetLabel: 'z.ai Text Widget',
  },
} as const

function hasTextGenerationOverrideValue(value: unknown): boolean {
  if (typeof value === 'undefined' || value === null) return false
  if (typeof value === 'string') return value.trim().length > 0
  if (typeof value === 'number') return Number.isFinite(value)
  if (typeof value === 'boolean') return true
  if (Array.isArray(value)) return true
  if (typeof value === 'object') return Object.keys(value).length > 0
  return true
}

function getTextGenerationProviderProfile(providerFamily?: TextGenerationProviderFamily): TextGenerationProviderProfile {
  if (providerFamily === 'openai') return TEXT_GENERATION_PROVIDER_PROFILE_BY_FAMILY.openai
  if (providerFamily === 'zai') return TEXT_GENERATION_PROVIDER_PROFILE_BY_FAMILY.zai
  return TEXT_GENERATION_PROVIDER_PROFILE_BY_FAMILY.byteplus
}

export function inferTextGenerationProviderFamily(args: {
  provider?: unknown
  widgetTypeId?: unknown
  formId?: unknown
}): TextGenerationProviderFamily {
  const provider = String(args.provider || '').trim().toLowerCase()
  const widgetTypeId = String(args.widgetTypeId || '').trim().toLowerCase()
  const formId = String(args.formId || '').trim().toLowerCase()
  if (widgetTypeId.includes('z.ai') || widgetTypeId.includes('zai') || formId.includes('z.ai') || formId.includes('zai')) return 'zai'
  if (widgetTypeId.includes('openai') || formId.includes('openai')) return 'openai'
  if (formId === FLOW_VIDEO_SCRIPT_FORM_ID.toLowerCase()) return 'byteplus'
  if (widgetTypeId.includes('byteplus') || formId.includes('byteplus') || formId === 'textgeneration') return 'byteplus'
  if (provider.includes('z.ai') || provider.includes('zai')) return 'zai'
  if (provider.includes('openai')) return 'openai'
  if (provider.includes('byteplus') || provider.includes('modelark')) return 'byteplus'
  return 'byteplus'
}

export function getTextGenerationWidgetLabel(args: {
  provider?: unknown
  widgetTypeId?: unknown
  formId?: unknown
}): string {
  return getTextGenerationProviderProfile(inferTextGenerationProviderFamily(args)).widgetLabel
}

export function getWidgetRegistryEntryLabel(args: {
  nodeTypeId?: unknown
  widgetTypeId?: unknown
  formId?: unknown
}): string {
  const nodeTypeId = String(args.nodeTypeId || '').trim()
  const formId = String(args.formId || '').trim()
  if (isGrabMapsDiscoveryWidgetEntry(args)) return getGrabMapsDiscoveryWidgetLabel()
  if (nodeTypeId === FLOW_TEXT_GENERATION_NODE_TYPE_ID) {
    if (formId === FLOW_VIDEO_SCRIPT_FORM_ID) return FLOW_VIDEO_SCRIPT_WIDGET_LABEL
    return getTextGenerationWidgetLabel(args)
  }
  if (nodeTypeId === FLOW_IMAGE_GENERATION_NODE_TYPE_ID) return FLOW_IMAGE_GENERATION_NODE_LABEL
  if (nodeTypeId === FLOW_VIDEO_GENERATION_NODE_TYPE_ID) return FLOW_VIDEO_GENERATION_NODE_LABEL
  if (nodeTypeId === FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID) return FLOW_RICH_MEDIA_PANEL_NODE_LABEL
  if (nodeTypeId === FLOW_VIDEO_TRANSCRIBER_NODE_TYPE_ID) return FLOW_VIDEO_TRANSCRIBER_NODE_LABEL
  return nodeTypeId || String(args.formId || '').trim() || String(args.widgetTypeId || '').trim() || FLOW_TEXT_GENERATION_NODE_LABEL
}

export function normalizeTextGenerationWidgetPropertiesForProviderFamily(args: {
  providerFamily?: TextGenerationProviderFamily
  properties?: Record<string, unknown>
}): Record<string, unknown> {
  const providerFamily: TextGenerationProviderFamily =
    args.providerFamily === 'openai' ? 'openai' : args.providerFamily === 'zai' ? 'zai' : 'byteplus'
  const prev = { ...(args.properties || {}) }
  const profile = getTextGenerationProviderProfile(providerFamily)
  const rawProvider = String(prev.chatProvider || '').trim()
  const normalizedProvider = rawProvider ? normalizeChatProviderId(rawProvider) : profile.providerId
  const providerMatchesFamily = normalizedProvider === profile.providerId
  return {
    ...prev,
    chatProvider: profile.providerId,
    chatEndpointUrl:
      providerMatchesFamily && String(prev.chatEndpointUrl || '').trim()
        ? String(prev.chatEndpointUrl || '').trim()
        : profile.defaultEndpointUrl,
    chatModel:
      providerMatchesFamily && String(prev.chatModel || '').trim()
        ? String(prev.chatModel || '').trim()
        : profile.defaultModel,
  }
}

export function resolveTextGenerationGlobalDefaultsForProviderFamily(args: {
  providerFamily?: TextGenerationProviderFamily
  globalProperties?: Record<string, unknown>
}): Record<string, unknown> {
  return normalizeTextGenerationWidgetPropertiesForProviderFamily({
    providerFamily: args.providerFamily,
    properties: args.globalProperties,
  })
}

export function resolveEffectiveTextGenerationWidgetProperties(args: {
  providerFamily?: TextGenerationProviderFamily
  localProperties?: Record<string, unknown>
  globalProperties?: Record<string, unknown>
}): Record<string, unknown> {
  const providerFamily: TextGenerationProviderFamily =
    args.providerFamily === 'openai' ? 'openai' : args.providerFamily === 'zai' ? 'zai' : 'byteplus'
  const base = resolveTextGenerationGlobalDefaultsForProviderFamily({
    providerFamily,
    globalProperties: args.globalProperties,
  })
  const local = { ...(args.localProperties || {}) }
  const normalizedLocalProviderFields = normalizeTextGenerationWidgetPropertiesForProviderFamily({
    providerFamily,
    properties: local,
  })
  const next: Record<string, unknown> = { ...base }

  for (const [key, value] of Object.entries(local)) {
    if (!hasTextGenerationOverrideValue(value)) continue
    if (key === 'chatProvider' || key === 'chatEndpointUrl' || key === 'chatModel') continue
    if (key === 'chatAuthMode') {
      const normalized = String(value || '').trim()
      if (normalized !== 'byok') continue
    }
    next[key] = value
  }

  if (hasTextGenerationOverrideValue(local.chatProvider)) {
    next.chatProvider = normalizedLocalProviderFields.chatProvider
  } else if (Object.prototype.hasOwnProperty.call(base, 'chatProvider')) {
    next.chatProvider = base.chatProvider
  }

  if (hasTextGenerationOverrideValue(local.chatEndpointUrl) || hasTextGenerationOverrideValue(local.chatProvider)) {
    next.chatEndpointUrl = normalizedLocalProviderFields.chatEndpointUrl
  } else if (Object.prototype.hasOwnProperty.call(base, 'chatEndpointUrl')) {
    next.chatEndpointUrl = base.chatEndpointUrl
  }

  if (hasTextGenerationOverrideValue(local.chatModel) || hasTextGenerationOverrideValue(local.chatProvider)) {
    next.chatModel = normalizedLocalProviderFields.chatModel
  } else if (Object.prototype.hasOwnProperty.call(base, 'chatModel')) {
    next.chatModel = base.chatModel
  }

  return next
}

function buildCommonTextGenerationFields(): WidgetRegistryEntry['fields'] {
  return [
    { fieldKey: 'chatProvider', fieldType: 'text', schemaPath: 'properties.chatProvider', required: true, label: 'Provider' },
    { fieldKey: 'chatAuthMode', fieldType: 'text', schemaPath: 'properties.chatAuthMode', required: true, label: 'Auth mode' },
    { fieldKey: 'chatEndpointUrl', fieldType: 'text', schemaPath: 'properties.chatEndpointUrl', required: true, label: 'Endpoint URL' },
    { fieldKey: 'chatModel', fieldType: 'text', schemaPath: 'properties.chatModel', required: true, label: 'Model' },
    { fieldKey: 'prompt', fieldType: 'textarea', schemaPath: 'properties.prompt', required: true, label: 'Prompt' },
  ]
}

function buildCommonTextGenerationPorts(): WidgetRegistryEntry['ports'] {
  return [
    { portKey: 'prompt_in', direction: 'input', schemaPath: 'properties.prompt' },
    { portKey: 'text_out', direction: 'output', schemaPath: 'properties.output' },
  ]
}

export function buildWidgetDraftFromSmartFields(args: {
  nodeTypeId: string
  mode?: 'image' | 'video'
}): Omit<WidgetRegistryEntry, 'updatedAt'> {
  const nodeTypeId = String(args.nodeTypeId || '').trim()
  const mode = args.mode === 'image' ? 'image' : args.mode === 'video' ? 'video' : null
  return {
    id: '',
    isEnabled: true,
    nodeTypeId,
    widgetTypeId: 'default',
    formId: mode === 'image' ? 'imageGeneration' : mode === 'video' ? 'videoGeneration' : 'widget',
    fields: [
      ...(mode === 'image'
        ? buildBytePlusImageGenerationFields()
        : mode === 'video'
          ? buildBytePlusVideoGenerationFields()
          : [
            {
              fieldKey: 'model',
              fieldType: 'select',
              schemaPath: 'properties.model',
              required: true,
              label: 'Model',
              options: FLOW_EDITOR_VIDEO_MODEL_OPTIONS,
            },
            { fieldKey: 'prompt', fieldType: 'textarea', schemaPath: 'properties.prompt', required: true, label: 'Prompt' },
          ]),
    ],
    ports: [
      { portKey: 'reference_image', direction: 'input', schemaPath: 'properties.reference_image' },
      {
        portKey: mode === 'image' ? 'imageUrl' : mode === 'video' ? 'videoUrl' : 'output',
        direction: 'output',
        schemaPath: mode === 'image' ? 'properties.imageUrl' : mode === 'video' ? 'properties.videoUrl' : 'properties.output',
      },
    ],
    schemaMappings: [],
  }
}

export function buildCanonicalWidgetRegistryDraft(args: {
  nodeTypeId: string
  providerFamily?: TextGenerationProviderFamily
  widgetTypeId?: string
  formId?: string
}): Omit<WidgetRegistryEntry, 'updatedAt'> | null {
  const nodeTypeId = String(args.nodeTypeId || '').trim()
  const widgetTypeId = String(args.widgetTypeId || '').trim()
  const formId = String(args.formId || '').trim()
  if (nodeTypeId === FLOW_TEXT_GENERATION_NODE_TYPE_ID) {
    return buildTextGenerationRegistryDraft({
      providerFamily: args.providerFamily,
      widgetTypeId: widgetTypeId || 'default',
      formId,
    })
  }
  if (nodeTypeId === FLOW_IMAGE_GENERATION_NODE_TYPE_ID) {
    return {
      ...buildWidgetDraftFromSmartFields({ nodeTypeId, mode: 'image' }),
      widgetTypeId: widgetTypeId || 'default',
      formId: formId || 'imageGeneration',
    }
  }
  if (nodeTypeId === FLOW_VIDEO_GENERATION_NODE_TYPE_ID) {
    return {
      ...buildWidgetDraftFromSmartFields({ nodeTypeId, mode: 'video' }),
      widgetTypeId: widgetTypeId || 'default',
      formId: formId || 'videoGeneration',
    }
  }
  if (nodeTypeId === FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID) {
    return {
      ...buildRichMediaPanelRegistryDraft(),
      widgetTypeId: widgetTypeId || FLOW_RICH_MEDIA_PANEL_WIDGET_TYPE_ID,
      formId: formId || FLOW_RICH_MEDIA_PANEL_FORM_ID,
    }
  }
  if (nodeTypeId === FLOW_VIDEO_TRANSCRIBER_NODE_TYPE_ID) {
    return {
      ...buildVideoTranscriberRegistryDraft(),
      widgetTypeId: widgetTypeId || FLOW_VIDEO_TRANSCRIBER_WIDGET_TYPE_ID,
      formId: formId || FLOW_VIDEO_TRANSCRIBER_FORM_ID,
    }
  }
  return null
}

export function buildVideoTranscriberRegistryDraft(): Omit<WidgetRegistryEntry, 'updatedAt'> {
  return {
    id: '',
    isEnabled: true,
    nodeTypeId: FLOW_VIDEO_TRANSCRIBER_NODE_TYPE_ID,
    widgetTypeId: FLOW_VIDEO_TRANSCRIBER_WIDGET_TYPE_ID,
    formId: FLOW_VIDEO_TRANSCRIBER_FORM_ID,
    fields: [
      { fieldKey: 'sourceUrl', fieldType: 'text', schemaPath: 'properties.sourceUrl', required: true, label: 'Video URL' },
      { fieldKey: 'languageHint', fieldType: 'text', schemaPath: 'properties.languageHint', required: false, label: 'Language hint (optional)' },
      { fieldKey: 'output', fieldType: 'textarea', schemaPath: 'properties.output', label: 'Output' },
    ],
    ports: [
      { portKey: 'sourceUrl_in', direction: 'input', schemaPath: 'properties.sourceUrl' },
      { portKey: 'text_out', direction: 'output', schemaPath: 'properties.output' },
    ],
    schemaMappings: [],
  }
}

export function buildGenerateImageRegistryDraft(): Omit<WidgetRegistryEntry, 'updatedAt'> {
  return buildCanonicalWidgetRegistryDraft({ nodeTypeId: FLOW_IMAGE_GENERATION_NODE_TYPE_ID })!
}

export function buildRichMediaPanelRegistryDraft(): Omit<WidgetRegistryEntry, 'updatedAt'> {
  return {
    id: '',
    isEnabled: true,
    nodeTypeId: FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID,
    widgetTypeId: FLOW_RICH_MEDIA_PANEL_WIDGET_TYPE_ID,
    formId: FLOW_RICH_MEDIA_PANEL_FORM_ID,
    fields: [
      { fieldKey: 'output', fieldType: 'textarea', schemaPath: 'properties.output', label: 'Output' },
      { fieldKey: 'imageUrl', fieldType: 'text', schemaPath: 'properties.imageUrl', label: 'Image URL' },
      { fieldKey: 'videoUrl', fieldType: 'text', schemaPath: 'properties.videoUrl', label: 'Video URL' },
      { fieldKey: 'outputSrcDoc', fieldType: 'textarea', schemaPath: 'properties.outputSrcDoc', label: 'HTML srcdoc' },
      { fieldKey: 'media_interactive', fieldType: 'boolean', schemaPath: 'properties.media_interactive', label: 'Interactive' },
    ],
    ports: [
      { portKey: 'output', direction: 'input', schemaPath: 'properties.output' },
      { portKey: 'imageUrl', direction: 'input', schemaPath: 'properties.imageUrl' },
      { portKey: 'videoUrl', direction: 'input', schemaPath: 'properties.videoUrl' },
      { portKey: 'outputSrcDoc', direction: 'input', schemaPath: 'properties.outputSrcDoc' },
      { portKey: 'output', direction: 'output', schemaPath: 'properties.output' },
      { portKey: 'imageUrl', direction: 'output', schemaPath: 'properties.imageUrl' },
      { portKey: 'videoUrl', direction: 'output', schemaPath: 'properties.videoUrl' },
      { portKey: 'outputSrcDoc', direction: 'output', schemaPath: 'properties.outputSrcDoc' },
    ],
    schemaMappings: [],
  }
}

export function buildTextGenerationRegistryDraft(args?: {
  providerFamily?: TextGenerationProviderFamily
  widgetTypeId?: string
  formId?: string
}): Omit<WidgetRegistryEntry, 'updatedAt'> {
  const providerFamily: TextGenerationProviderFamily =
    args?.providerFamily === 'openai' ? 'openai' : args?.providerFamily === 'zai' ? 'zai' : 'byteplus'
  return {
    id: '',
    isEnabled: true,
    nodeTypeId: FLOW_TEXT_GENERATION_NODE_TYPE_ID,
    widgetTypeId: String(args?.widgetTypeId || '').trim() || 'default',
    formId: String(args?.formId || '').trim() || (providerFamily === 'byteplus' ? 'textGeneration' : `textGeneration.${providerFamily}`),
    fields: providerFamily === 'byteplus'
      ? buildBytePlusTextGenerationFields()
      : buildOpenAiCompatibleTextGenerationFields({ providerFamily: providerFamily === 'zai' ? 'zai' : 'openai' }),
    ports: buildCommonTextGenerationPorts(),
    schemaMappings: [],
  }
}

export function buildBytePlusVideoScriptRegistryDraft(): Omit<WidgetRegistryEntry, 'updatedAt'> {
  return buildTextGenerationRegistryDraft({
    providerFamily: 'byteplus',
    widgetTypeId: 'default',
    formId: FLOW_VIDEO_SCRIPT_FORM_ID,
  })
}

export function buildGenerateTextRegistryDraft(): Omit<WidgetRegistryEntry, 'updatedAt'> {
  return buildCanonicalWidgetRegistryDraft({
    nodeTypeId: FLOW_TEXT_GENERATION_NODE_TYPE_ID,
    providerFamily: 'byteplus',
  })!
}

export function buildGenerateVideoRegistryDraft(): Omit<WidgetRegistryEntry, 'updatedAt'> {
  return buildCanonicalWidgetRegistryDraft({ nodeTypeId: FLOW_VIDEO_GENERATION_NODE_TYPE_ID })!
}

export function getRichMediaPanelWidgetLabel(): string {
  return FLOW_RICH_MEDIA_PANEL_NODE_LABEL
}
