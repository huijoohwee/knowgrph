import type { WidgetRegistryEntry } from '@/features/storyboard-widget-manager/widgetRegistryTypes'
import {
  FLOW_STORYBOARD_ELEMENT_FORM_ID,
  FLOW_STORYBOARD_ELEMENT_NODE_TYPE_ID,
  FLOW_STORYBOARD_ELEMENT_WIDGET_TYPE_ID,
} from '@/lib/config.storyboard-widget'

export function buildStoryboardElementRegistryDraft(): Omit<WidgetRegistryEntry, 'updatedAt'> {
  return {
    id: '',
    isEnabled: true,
    nodeTypeId: FLOW_STORYBOARD_ELEMENT_NODE_TYPE_ID,
    widgetTypeId: FLOW_STORYBOARD_ELEMENT_WIDGET_TYPE_ID,
    formId: FLOW_STORYBOARD_ELEMENT_FORM_ID,
    fields: [
      { fieldKey: 'title', fieldType: 'text', schemaPath: 'properties.title', required: true, label: 'Title' },
      { fieldKey: 'lane', fieldType: 'text', schemaPath: 'properties.lane', label: 'Lane' },
      { fieldKey: 'summary', fieldType: 'textarea', schemaPath: 'properties.summary', label: 'Summary' },
      { fieldKey: 'action', fieldType: 'textarea', schemaPath: 'properties.action', label: 'Action' },
      { fieldKey: 'prompt', fieldType: 'textarea', schemaPath: 'properties.prompt', label: 'Prompt' },
      { fieldKey: 'references', fieldType: 'json', schemaPath: 'properties.references', label: 'References' },
    ],
    ports: [
      { portKey: 'mediaUrl', direction: 'input', schemaPath: 'properties.mediaUrl' },
      { portKey: 'imageUrl', direction: 'input', schemaPath: 'properties.imageUrl' },
      { portKey: 'videoUrl', direction: 'input', schemaPath: 'properties.videoUrl' },
      { portKey: 'mediaUrl', direction: 'output', schemaPath: 'properties.mediaUrl' },
      { portKey: 'imageUrl', direction: 'output', schemaPath: 'properties.imageUrl' },
      { portKey: 'videoUrl', direction: 'output', schemaPath: 'properties.videoUrl' },
    ],
    schemaMappings: [],
  }
}
