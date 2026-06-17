import { buildCanonicalWidgetRegistryDraft } from '@/features/flow-editor-manager/registryTemplates'
import { buildBytePlusTextGenerationFields } from '@/features/integrations/byteplusChatApiSsot'
import { buildBytePlusVideoGenerationFields } from '@/features/integrations/byteplusVideoGenerationSsot'
import {
  FLOW_IMAGE_GENERATION_NODE_TYPE_ID,
  FLOW_STORYBOARD_ELEMENT_FORM_ID,
  FLOW_STORYBOARD_ELEMENT_NODE_TYPE_ID,
  FLOW_TEXT_GENERATION_NODE_TYPE_ID,
  FLOW_VIDEO_GENERATION_NODE_TYPE_ID,
} from '@/lib/config.flow-editor'

export const testWidgetRegistryPortsCoverConnectedSchemaPaths = () => {
  const text = buildCanonicalWidgetRegistryDraft({ nodeTypeId: FLOW_TEXT_GENERATION_NODE_TYPE_ID })
  if (!text) throw new Error('expected canonical TextGeneration registry draft')
  const textPorts = new Set(text.ports.map(port => port.portKey))
  ;['prompt_in', 'text_out', 'outputSrcDoc'].forEach(key => {
    if (!textPorts.has(key)) throw new Error(`expected TextGeneration ports to include ${key}`)
  })

  const image = buildCanonicalWidgetRegistryDraft({ nodeTypeId: FLOW_IMAGE_GENERATION_NODE_TYPE_ID })
  if (!image) throw new Error('expected canonical ImageGeneration registry draft')
  const imagePorts = new Set(image.ports.map(port => port.portKey))
  ;['prompt_in', 'reference_image', 'imageUrl'].forEach(key => {
    if (!imagePorts.has(key)) throw new Error(`expected ImageGeneration ports to include ${key}`)
  })

  const video = buildCanonicalWidgetRegistryDraft({ nodeTypeId: FLOW_VIDEO_GENERATION_NODE_TYPE_ID })
  if (!video) throw new Error('expected canonical VideoGeneration registry draft')
  const videoPorts = new Set(video.ports.map(port => port.portKey))
  ;['prompt_in', 'reference_image', 'videoUrl'].forEach(key => {
    if (!videoPorts.has(key)) throw new Error(`expected VideoGeneration ports to include ${key}`)
  })

  const storyboardElement = buildCanonicalWidgetRegistryDraft({ nodeTypeId: FLOW_STORYBOARD_ELEMENT_NODE_TYPE_ID })
  if (!storyboardElement) throw new Error('expected canonical StoryboardElement registry draft')
  if (storyboardElement.formId !== FLOW_STORYBOARD_ELEMENT_FORM_ID) {
    throw new Error(`expected canonical StoryboardElement form id ${FLOW_STORYBOARD_ELEMENT_FORM_ID}, got ${String(storyboardElement.formId || '')}`)
  }
  const storyboardFieldKeys = new Set(storyboardElement.fields.map(field => field.fieldKey))
  ;['title', 'lane', 'summary', 'action', 'prompt', 'references'].forEach(key => {
    if (!storyboardFieldKeys.has(key)) throw new Error(`expected StoryboardElement fields to include ${key}`)
  })
}

export const testBytePlusVideoWidgetFieldsIncludeReferenceImage = () => {
  const keys = buildBytePlusVideoGenerationFields().map(field => field.fieldKey)
  if (!keys.includes('reference_image')) {
    throw new Error('expected BytePlus VideoGeneration widget fields to include reference_image')
  }
}

export const testBytePlusTextWidgetFieldsIncludeOutput = () => {
  const keys = buildBytePlusTextGenerationFields().map(field => field.fieldKey)
  if (!keys.includes('output')) throw new Error('expected BytePlus TextGeneration widget fields to include output')
}
