import type { NodeQuickEditorRegistryEntry } from '@/features/flow-editor-manager/nodeQuickEditorRegistryTypes'
import { FLOW_VIDEO_GENERATION_NODE_TYPE_ID } from '@/lib/config'

export function buildNodeQuickEditorDraftFromSmartFields(args: {
  nodeTypeId: string
}): Omit<NodeQuickEditorRegistryEntry, 'updatedAt'> {
  const nodeTypeId = String(args.nodeTypeId || '').trim()
  return {
    id: '',
    isEnabled: true,
    nodeTypeId,
    quickEditorTypeId: 'default',
    formId: 'nodeQuickEditor',
    fields: [
      { fieldKey: 'model', fieldType: 'select', schemaPath: 'properties.model', required: true, label: 'Model' },
      { fieldKey: 'prompt', fieldType: 'textarea', schemaPath: 'properties.prompt', required: true, label: 'Prompt' },
      {
        fieldKey: 'aspect_ratio',
        fieldType: 'select',
        schemaPath: 'properties.aspect_ratio',
        required: true,
        label: 'Aspect ratio',
      },
      {
        fieldKey: 'duration',
        fieldType: 'select',
        schemaPath: 'properties.duration',
        required: true,
        label: 'Duration',
      },
      {
        fieldKey: 'resolution',
        fieldType: 'select',
        schemaPath: 'properties.resolution',
        required: true,
        label: 'Resolution',
      },
      { fieldKey: 'generate_audio', fieldType: 'boolean', schemaPath: 'properties.generate_audio', label: 'Generate audio' },
      { fieldKey: 'fast', fieldType: 'boolean', schemaPath: 'properties.fast', label: 'Fast' },
      {
        fieldKey: 'reference_image',
        fieldType: 'text',
        schemaPath: 'properties.reference_image',
        label: 'Reference image',
      },
    ],
    ports: [
      { portKey: 'reference_image', direction: 'input', schemaPath: 'properties.reference_image' },
      { portKey: 'videoUrl', direction: 'output', schemaPath: 'properties.videoUrl' },
    ],
    schemaMappings: [],
  }
}

export function buildGenerateVideoRegistryDraft(): Omit<NodeQuickEditorRegistryEntry, 'updatedAt'> {
  return {
    ...buildNodeQuickEditorDraftFromSmartFields({ nodeTypeId: FLOW_VIDEO_GENERATION_NODE_TYPE_ID }),
    formId: 'videoGeneration',
  }
}
