import { buildGenerateVideoRegistryDraft, buildWidgetDraftFromSmartFields } from '@/features/storyboard-widget-manager/registryTemplates'
import { FLOW_VIDEO_GENERATION_NODE_TYPE_ID } from '@/lib/config'

export function testStoryboardWidgetManagerBuildDraftFromSmartFields() {
  const draft = buildWidgetDraftFromSmartFields({ nodeTypeId: 'Subject' })
  if (draft.nodeTypeId !== 'Subject') throw new Error('expected nodeTypeId to be preserved')
  if (draft.widgetTypeId !== 'default') throw new Error('expected widgetTypeId default')
  if (draft.formId !== 'widget') throw new Error('expected formId widget')
  const keys = new Set(draft.fields.map(f => f.fieldKey))
  if (!keys.has('prompt')) throw new Error('expected prompt field')
  if (!keys.has('model')) throw new Error('expected model field')
  const portKeys = new Set(draft.ports.map(p => `${p.direction}:${p.portKey}`))
  if (!portKeys.has('input:reference_image')) throw new Error('expected reference_image input port')
}

export function testStoryboardWidgetManagerBuildGenerateVideoDraftUsesSsotTypeId() {
  const draft = buildGenerateVideoRegistryDraft()
  if (draft.nodeTypeId !== FLOW_VIDEO_GENERATION_NODE_TYPE_ID) throw new Error('expected SSOT VideoGeneration nodeTypeId')
  if (draft.formId !== 'videoGeneration') throw new Error('expected videoGeneration formId')
}

export function testStoryboardWidgetManagerBuildVideoDraftFromSmartFieldsUsesVideoGenerationFormId() {
  const draft = buildWidgetDraftFromSmartFields({ nodeTypeId: FLOW_VIDEO_GENERATION_NODE_TYPE_ID, mode: 'video' })
  if (draft.formId !== 'videoGeneration') throw new Error('expected smart-fields video draft to use videoGeneration formId')
}
