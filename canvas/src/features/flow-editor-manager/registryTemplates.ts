import type { WidgetRegistryEntry } from '@/features/flow-editor-manager/widgetRegistryTypes'
import { FLOW_IMAGE_GENERATION_NODE_TYPE_ID, FLOW_VIDEO_GENERATION_NODE_TYPE_ID } from '@/lib/config'

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
        fieldKey: 'resolution',
        fieldType: 'select',
        schemaPath: 'properties.resolution',
        required: true,
        label: 'Resolution',
      },
      ...(mode === 'video'
        ? [
            {
              fieldKey: 'duration',
              fieldType: 'select',
              schemaPath: 'properties.duration',
              required: true,
              label: 'Duration',
            },
            { fieldKey: 'generate_audio', fieldType: 'boolean', schemaPath: 'properties.generate_audio', label: 'Generate audio' },
            { fieldKey: 'fast', fieldType: 'boolean', schemaPath: 'properties.fast', label: 'Fast' },
          ]
        : [
            { fieldKey: 'fast', fieldType: 'boolean', schemaPath: 'properties.fast', label: 'Fast' },
          ]),
      {
        fieldKey: 'reference_image',
        fieldType: 'text',
        schemaPath: 'properties.reference_image',
        label: 'Reference image',
      },
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

export function buildGenerateImageRegistryDraft(): Omit<WidgetRegistryEntry, 'updatedAt'> {
  return {
    ...buildWidgetDraftFromSmartFields({ nodeTypeId: FLOW_IMAGE_GENERATION_NODE_TYPE_ID, mode: 'image' }),
    formId: 'imageGeneration',
  }
}

export function buildGenerateVideoRegistryDraft(): Omit<WidgetRegistryEntry, 'updatedAt'> {
  return {
    ...buildWidgetDraftFromSmartFields({ nodeTypeId: FLOW_VIDEO_GENERATION_NODE_TYPE_ID, mode: 'video' }),
    formId: 'videoGeneration',
  }
}
