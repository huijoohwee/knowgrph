import {
  normalizeTextGenerationWidgetPropertiesForProviderFamily,
  resolveEffectiveTextGenerationWidgetProperties,
} from '@/features/storyboard-widget-manager/textGenerationProviderProperties'
import { inferTextGenerationProviderFamily } from '@/features/storyboard-widget-manager/textGenerationProviderFamily'
import {
  CHAT_BYTEPLUS_AP_SOUTHEAST_ENDPOINT_URL,
  CHAT_BYTEPLUS_TEXT_MODEL_DEFAULT,
  CHAT_COMPLETIONS_PATH,
  CHAT_LOCAL_DEFAULT_MODEL,
  CHAT_PROVIDER_BYTEPLUS,
  CHAT_PROVIDER_LM_STUDIO,
  CHAT_PROXY_PATH_PREFIX,
} from '@/lib/chatEndpoint'

export function testStoryboardWidgetManagerInfersLmStudioLocalProviderFamily() {
  const explicitEndpointUrl = 'http://127.0.0.1:5199/v1/chat/completions'
  const explicitModel = 'acceptance-model'
  const family = inferTextGenerationProviderFamily({
    provider: { key: 'chatProvider', type: 'string', value: CHAT_PROVIDER_LM_STUDIO },
    endpointUrl: { key: 'chatEndpointUrl', type: 'string', value: explicitEndpointUrl },
    model: { key: 'chatModel', type: 'string', value: explicitModel },
    widgetTypeId: 'default',
    formId: 'textGeneration',
  })
  const formOnlyFamily = inferTextGenerationProviderFamily({
    widgetTypeId: 'default',
    formId: 'textGeneration.lmstudio-local',
  })
  if (family !== 'lmstudio-local' || formOnlyFamily !== 'lmstudio-local') {
    throw new Error(`expected explicit and form-owned LM Studio tuples to resolve locally, got ${JSON.stringify({ family, formOnlyFamily })}`)
  }
}

export function testStoryboardWidgetManagerPreservesLmStudioLocalProviderProfile() {
  const explicitEndpointUrl = 'http://127.0.0.1:5199/v1/chat/completions'
  const explicitModel = 'acceptance-model'
  const normalized = normalizeTextGenerationWidgetPropertiesForProviderFamily({
    providerFamily: 'lmstudio-local',
    properties: {
      chatProvider: CHAT_PROVIDER_LM_STUDIO,
      chatEndpointUrl: explicitEndpointUrl,
      chatModel: explicitModel,
      prompt: 'Generate a local-only response.',
    },
  })
  const effective = resolveEffectiveTextGenerationWidgetProperties({
    providerFamily: 'lmstudio-local',
    localProperties: {
      chatProvider: CHAT_PROVIDER_LM_STUDIO,
      chatEndpointUrl: explicitEndpointUrl,
      chatModel: explicitModel,
    },
    globalProperties: {
      chatProvider: CHAT_PROVIDER_BYTEPLUS,
      chatEndpointUrl: CHAT_BYTEPLUS_AP_SOUTHEAST_ENDPOINT_URL,
      chatModel: CHAT_BYTEPLUS_TEXT_MODEL_DEFAULT,
    },
  })
  const defaults = normalizeTextGenerationWidgetPropertiesForProviderFamily({
    providerFamily: 'lmstudio-local',
  })
  const expectedDefaultEndpointUrl = `${CHAT_PROXY_PATH_PREFIX}${CHAT_COMPLETIONS_PATH}`
  if (
    normalized.chatProvider !== CHAT_PROVIDER_LM_STUDIO
    || normalized.chatEndpointUrl !== explicitEndpointUrl
    || normalized.chatModel !== explicitModel
    || effective.chatProvider !== CHAT_PROVIDER_LM_STUDIO
    || effective.chatEndpointUrl !== explicitEndpointUrl
    || effective.chatModel !== explicitModel
    || defaults.chatProvider !== CHAT_PROVIDER_LM_STUDIO
    || defaults.chatEndpointUrl !== expectedDefaultEndpointUrl
    || defaults.chatModel !== CHAT_LOCAL_DEFAULT_MODEL
  ) {
    throw new Error(`expected LM Studio normalization to preserve the explicit local tuple and use local defaults, got ${JSON.stringify({ normalized, effective, defaults })}`)
  }
}
