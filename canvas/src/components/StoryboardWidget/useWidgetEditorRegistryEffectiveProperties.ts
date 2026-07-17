import React from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useGraphStore } from '@/hooks/useGraphStore'
import type { WidgetRegistryEntry } from '@/features/storyboard-widget-manager/widgetRegistryTypes'
import { FLOW_IMAGE_GENERATION_NODE_TYPE_ID, FLOW_TEXT_GENERATION_NODE_TYPE_ID, FLOW_VIDEO_GENERATION_NODE_TYPE_ID } from '@/lib/config.storyboard-widget'
import { resolveEffectiveBytePlusImageWidgetProperties } from '@/features/integrations/byteplusImageGenerationDefaults'
import { resolveEffectiveBytePlusVideoWidgetProperties } from '@/features/integrations/byteplusVideoGenerationDefaults'
import { resolveEffectiveTextGenerationWidgetProperties } from '@/features/storyboard-widget-manager/registryTemplates'
import { inferTextGenerationProviderFamily } from '@/features/storyboard-widget-manager/textGenerationProviderFamily'

export type RegistryPortRowModel = {
  port: WidgetRegistryEntry['ports'][number]
  rowIndex: number
  portKey: string
  isIn: boolean
  schemaPath: string
  normalizedSchemaPath: string
  portValueId: string
  handlePath: string
  portKeyLabel: string
  portSubLabel: string
  aria: string
  mainPanelLink: ReturnType<typeof import('@/features/storyboard-widget-manager/registryTemplates').resolveWidgetRegistryMainPanelLink>
  portValueText: string
}

export function useWidgetEditorRegistryEffectiveProperties(args: {
  properties: Record<string, unknown>
  registryEntry: WidgetRegistryEntry
}): Record<string, unknown> {
  const { properties, registryEntry } = args
  const globalTextDefaults = useGraphStore(
    useShallow(s => ({
      chatProvider: s.chatProvider,
      chatAuthMode: s.chatAuthMode,
      chatEndpointUrl: s.chatEndpointUrl,
      chatModel: s.chatModel,
      chatTemperature: s.chatTemperature,
      chatMaxCompletionTokens: s.chatMaxCompletionTokens,
      chatServiceTier: s.chatServiceTier,
      chatStream: s.chatStream,
      chatMessagesJson: s.chatMessagesJson,
      chatReasoningEffort: s.chatReasoningEffort,
      chatThinkingType: s.chatThinkingType,
      chatThinkingJson: s.chatThinkingJson,
      chatFrequencyPenalty: s.chatFrequencyPenalty,
      chatPresencePenalty: s.chatPresencePenalty,
      chatTopP: s.chatTopP,
      chatLogprobs: s.chatLogprobs,
      chatTopLogprobs: s.chatTopLogprobs,
      chatParallelToolCalls: s.chatParallelToolCalls,
      chatStopJson: s.chatStopJson,
      chatStreamOptionsJson: s.chatStreamOptionsJson,
      chatResponseFormatJson: s.chatResponseFormatJson,
      chatLogitBiasJson: s.chatLogitBiasJson,
      chatToolsJson: s.chatToolsJson,
      chatToolChoiceJson: s.chatToolChoiceJson,
    })),
  )

  return React.useMemo(() => {
    if (String(registryEntry.nodeTypeId || '').trim() === FLOW_IMAGE_GENERATION_NODE_TYPE_ID) {
      return resolveEffectiveBytePlusImageWidgetProperties({ localProperties: properties })
    }
    if (String(registryEntry.nodeTypeId || '').trim() === FLOW_VIDEO_GENERATION_NODE_TYPE_ID) {
      return resolveEffectiveBytePlusVideoWidgetProperties({ localProperties: properties })
    }
    if (String(registryEntry.nodeTypeId || '').trim() !== FLOW_TEXT_GENERATION_NODE_TYPE_ID) return properties
    const providerFamily = inferTextGenerationProviderFamily({
      provider: properties.chatProvider || globalTextDefaults.chatProvider,
      endpointUrl: properties.chatEndpointUrl || globalTextDefaults.chatEndpointUrl,
      model: properties.chatModel || globalTextDefaults.chatModel,
      widgetTypeId: registryEntry.widgetTypeId,
      formId: registryEntry.formId,
    })
    return resolveEffectiveTextGenerationWidgetProperties({
      providerFamily,
      localProperties: properties,
      globalProperties: globalTextDefaults,
    })
  }, [globalTextDefaults, properties, registryEntry.formId, registryEntry.nodeTypeId, registryEntry.widgetTypeId])
}
