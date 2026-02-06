import { buildGenerateVideoRegistryDraft, buildNodeQuickEditorDraftFromSmartFields } from '@/features/flow-editor-manager/registryTemplates'
import { FLOW_VIDEO_GENERATION_NODE_TYPE_ID } from '@/lib/config'

export function testFlowEditorManagerBuildDraftFromSmartFields() {
  const draft = buildNodeQuickEditorDraftFromSmartFields({ nodeTypeId: 'Subject' })
  if (draft.nodeTypeId !== 'Subject') throw new Error('expected nodeTypeId to be preserved')
  if (draft.quickEditorTypeId !== 'default') throw new Error('expected quickEditorTypeId default')
  if (draft.formId !== 'nodeQuickEditor') throw new Error('expected formId nodeQuickEditor')
  const keys = new Set(draft.fields.map(f => f.fieldKey))
  if (!keys.has('prompt')) throw new Error('expected prompt field')
  if (!keys.has('model')) throw new Error('expected model field')
  const portKeys = new Set(draft.ports.map(p => `${p.direction}:${p.portKey}`))
  if (!portKeys.has('input:reference_image')) throw new Error('expected reference_image input port')
}

export function testFlowEditorManagerBuildGenerateVideoDraftUsesSsotTypeId() {
  const draft = buildGenerateVideoRegistryDraft()
  if (draft.nodeTypeId !== FLOW_VIDEO_GENERATION_NODE_TYPE_ID) throw new Error('expected SSOT VideoGeneration nodeTypeId')
  if (draft.formId !== 'videoGeneration') throw new Error('expected videoGeneration formId')
}
